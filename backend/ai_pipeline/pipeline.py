"""
Pipeline Xu Ly Anh (Main Orchestrator)
Khoa luan: Section 2.4.1 (Luong xu ly tong quan), Hinh 2.4

Pipeline 5 buoc:
    Upload -> Blur Check -> Classification -> Confidence Check -> Class Handling -> OCR -> Result

    Buoc 1: Blur Detection     (Laplacian Variance, threshold=100)  ~0.1s
    Buoc 2: Classification     (EfficientNet-B0, 3 classes)         ~0.5s
    Buoc 3: Confidence Check   (threshold=0.7)                      ~0.01s
    Buoc 4: Xu ly theo class   (routing logic)                      ~0.01s
    Buoc 5: OCR                (VietOCR)                            ~1.5s

    Tong: ~2.1s (Bang 4.13), target < 5s (YC 2.1.2)

Mapping MESSAGES (Phu luc A.3):
    'blur'              -> 'Anh bi mo. Vui long chup lai.'
    'low_confidence'    -> 'Khong nhan dien duoc.'
    'anh_khong_lien_quan' -> 'Anh khong hop le.'
    'giay_to_khac'      -> 'Day khong phai so ho ngheo.'
    'so_ho_ngheo'       -> 'Xac minh thanh cong!'
"""
import time
import logging
from django.conf import settings

from .blur_detection import check_blur
from .classification import get_classifier
from .ocr_engine import extract_text

logger = logging.getLogger(__name__)

# Messages mapping (Phu luc A.3)
MESSAGES = {
    'blur': 'Anh bi mo. Vui long chup lai.',
    'low_confidence': 'Khong nhan dien duoc. Vui long chup lai.',
    'anh_khong_lien_quan': 'Anh khong hop le.',
    'giay_to_khac': 'Day khong phai so ho ngheo.',
    'so_ho_ngheo': 'Xac minh thanh cong!',
}


def run_pipeline(image_path: str) -> dict:
    """
    Chay toan bo pipeline xu ly anh.

    Args:
        image_path: duong dan den file anh da upload

    Returns:
        dict khop voi cac truong trong bang verification_requests (Bang 2.3):
        {
            'status': 'success' | 'failed' | 'pending',
            'result_type': 'blur' | 'invalid' | 'wrong_doc' | 'low_confidence' | 'success',
            'blur_score': float,
            'is_blurry': bool,
            'predicted_class': str,
            'confidence': float,
            'passed_confidence_check': bool,
            'extracted_text': str,
            'ocr_confidence': float,
            'household_name': str,
            'household_address': str,
            'household_id_number': str,
            'province': str,
            'processing_time_ms': int,
            'message': str,
            'need_retry': bool,
            'pipeline_details': dict,  # Chi tiet tung buoc (debug)
        }
    """
    start_time = time.time()
    pipeline_details = {}

    # Lay thresholds tu model (uu tien) hoac settings
    classifier = get_classifier()
    confidence_threshold = classifier.confidence_threshold if classifier.is_loaded else getattr(settings, 'CONFIDENCE_THRESHOLD', 0.7)
    blur_threshold = classifier.blur_threshold if classifier.is_loaded else getattr(settings, 'BLUR_THRESHOLD', 100)

    # ==================================================================
    # BUOC 1: Blur Detection (Section 1.5.2)
    # ==================================================================
    logger.info("Pipeline Step 1: Blur Detection")
    step1_start = time.time()

    blur_result = check_blur(image_path, threshold_override=blur_threshold)
    pipeline_details['blur_detection'] = {
        **blur_result,
        'time_ms': round((time.time() - step1_start) * 1000),
    }

    if blur_result['is_blurry']:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED at Step 1: Image is blurry (score={blur_result['blur_score']})")
        return {
            'status': 'failed',
            'result_type': 'blur',
            'blur_score': blur_result['blur_score'],
            'is_blurry': True,
            'predicted_class': None,
            'confidence': None,
            'passed_confidence_check': False,
            'extracted_text': None,
            'ocr_confidence': None,
            'household_name': None,
            'household_address': None,
            'household_id_number': None,
            'province': None,
            'processing_time_ms': total_time,
            'message': MESSAGES['blur'],
            'need_retry': True,
            'pipeline_details': pipeline_details,
        }

    # ==================================================================
    # BUOC 2: Document Classification (Section 1.3)
    # ==================================================================
    logger.info("Pipeline Step 2: Document Classification")
    step2_start = time.time()

    classification_result = classifier.classify(image_path)
    pipeline_details['classification'] = {
        **classification_result,
        'time_ms': round((time.time() - step2_start) * 1000),
    }

    predicted_class = classification_result['predicted_class']
    confidence = classification_result['confidence']

    # ==================================================================
    # BUOC 3: Confidence Check (Section 4.3.3, threshold=0.7)
    # ==================================================================
    logger.info(f"Pipeline Step 3: Confidence Check ({confidence} vs {confidence_threshold})")

    passed_confidence = confidence >= confidence_threshold
    pipeline_details['confidence_check'] = {
        'confidence': confidence,
        'threshold': confidence_threshold,
        'passed': passed_confidence,
    }

    if not passed_confidence:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED at Step 3: Low confidence ({confidence})")
        return {
            'status': 'failed',
            'result_type': 'low_confidence',
            'blur_score': blur_result['blur_score'],
            'is_blurry': False,
            'predicted_class': predicted_class,
            'confidence': confidence,
            'passed_confidence_check': False,
            'extracted_text': None,
            'ocr_confidence': None,
            'household_name': None,
            'household_address': None,
            'household_id_number': None,
            'province': None,
            'processing_time_ms': total_time,
            'message': MESSAGES['low_confidence'],
            'need_retry': True,
            'pipeline_details': pipeline_details,
        }

    # ==================================================================
    # BUOC 4: Xu ly theo class (Section 2.4.1)
    # ==================================================================
    logger.info(f"Pipeline Step 4: Class Handling -> {predicted_class}")

    if predicted_class == 'anh_khong_lien_quan':
        total_time = round((time.time() - start_time) * 1000)
        return {
            'status': 'failed',
            'result_type': 'invalid',
            'blur_score': blur_result['blur_score'],
            'is_blurry': False,
            'predicted_class': predicted_class,
            'confidence': confidence,
            'passed_confidence_check': True,
            'extracted_text': None,
            'ocr_confidence': None,
            'household_name': None,
            'household_address': None,
            'household_id_number': None,
            'province': None,
            'processing_time_ms': total_time,
            'message': MESSAGES['anh_khong_lien_quan'],
            'need_retry': True,
            'pipeline_details': pipeline_details,
        }

    if predicted_class == 'giay_to_khac':
        total_time = round((time.time() - start_time) * 1000)
        return {
            'status': 'failed',
            'result_type': 'wrong_doc',
            'blur_score': blur_result['blur_score'],
            'is_blurry': False,
            'predicted_class': predicted_class,
            'confidence': confidence,
            'passed_confidence_check': True,
            'extracted_text': None,
            'ocr_confidence': None,
            'household_name': None,
            'household_address': None,
            'household_id_number': None,
            'province': None,
            'processing_time_ms': total_time,
            'message': MESSAGES['giay_to_khac'],
            'need_retry': True,
            'pipeline_details': pipeline_details,
        }

    # ==================================================================
    # BUOC 5: OCR - VietOCR (Section 1.4.2)
    # Chi chay khi predicted_class == 'so_ho_ngheo'
    # ==================================================================
    logger.info("Pipeline Step 5: OCR (VietOCR)")
    step5_start = time.time()

    ocr_result = extract_text(image_path)
    pipeline_details['ocr'] = {
        'extracted_text_length': len(ocr_result.get('extracted_text', '') or ''),
        'ocr_confidence': ocr_result.get('ocr_confidence'),
        'is_demo': ocr_result.get('is_demo', False),
        'time_ms': round((time.time() - step5_start) * 1000),
    }

    # ==================================================================
    # KET QUA THANH CONG
    # ==================================================================
    total_time = round((time.time() - start_time) * 1000)
    logger.info(f"Pipeline COMPLETED successfully in {total_time}ms")

    return {
        'status': 'success',
        'result_type': 'success',
        'blur_score': blur_result['blur_score'],
        'is_blurry': False,
        'predicted_class': predicted_class,
        'confidence': confidence,
        'passed_confidence_check': True,
        'extracted_text': ocr_result.get('extracted_text'),
        'ocr_confidence': ocr_result.get('ocr_confidence'),
        'household_name': ocr_result.get('household_name'),
        'household_address': ocr_result.get('household_address'),
        'household_id_number': ocr_result.get('household_id_number'),
        'province': ocr_result.get('province'),
        'processing_time_ms': total_time,
        'message': MESSAGES['so_ho_ngheo'],
        'need_retry': False,
        'pipeline_details': pipeline_details,
    }

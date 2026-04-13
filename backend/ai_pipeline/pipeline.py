import time
import logging
from django.conf import settings

from .blur_detection import check_blur
from .classification import get_classifier
from .ocr_engine import extract_text
from .stamp_detection import detect_stamp
from .forgery_detection import detect_forgery

logger = logging.getLogger(__name__)

MESSAGES = {
    'blur': 'Anh bi mo. Vui long chup lai.',
    'forgery': 'Phat hien dau hieu chinh sua anh.',
    'forgery_review': 'Anh can duoc admin xem xet.',
    'low_confidence': 'Khong nhan dien duoc. Vui long chup lai.',
    'anh_khong_lien_quan': 'Anh khong hop le.',
    'giay_to_khac': 'Day khong phai so ho ngheo.',
    'no_stamp': 'Khong phat hien con dau chinh quyen.',
    'so_ho_ngheo': 'Xac minh thanh cong!',
}

FORGERY_REJECT_THRESHOLD = 0.7
FORGERY_REVIEW_THRESHOLD = 0.4


def run_pipeline(image_path: str) -> dict:
    """
    Chay toan bo pipeline xu ly anh (7 buoc).
    """
    start_time = time.time()
    pipeline_details = {}

    classifier = get_classifier()
    confidence_threshold = classifier.confidence_threshold if classifier.is_loaded else getattr(settings, 'CONFIDENCE_THRESHOLD', 0.7)
    blur_threshold = classifier.blur_threshold if classifier.is_loaded else getattr(settings, 'BLUR_THRESHOLD', 100)

    logger.info("Pipeline Step 1/7: Blur Detection")
    step_start = time.time()

    blur_result = check_blur(image_path, threshold_override=blur_threshold)
    pipeline_details['blur_detection'] = {
        **blur_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    if blur_result['is_blurry']:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED at Step 1: Image is blurry (score={blur_result['blur_score']})")
        return _build_result(
            status='failed', result_type='blur',
            blur_score=blur_result['blur_score'], is_blurry=True,
            message=MESSAGES['blur'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    logger.info("Pipeline Step 2/7: Forgery Detection")
    step_start = time.time()

    forgery_result = detect_forgery(image_path)
    pipeline_details['forgery_detection'] = {
        **forgery_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    forgery_score = forgery_result.get('forgery_score', 0.0)

    if forgery_score > FORGERY_REJECT_THRESHOLD:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED at Step 2: Forgery detected (score={forgery_score})")
        return _build_result(
            status='failed', result_type='forgery',
            blur_score=blur_result['blur_score'], is_blurry=False,
            forgery_score=forgery_score,
            message=MESSAGES['forgery'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    # Ghi nhan neu nghi ngo (0.4-0.7) nhung van tiep tuc pipeline
    needs_review = forgery_score >= FORGERY_REVIEW_THRESHOLD

    logger.info("Pipeline Step 3/7: Document Classification")
    step_start = time.time()

    classification_result = classifier.classify(image_path)
    pipeline_details['classification'] = {
        **classification_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    predicted_class = classification_result['predicted_class']
    confidence = classification_result['confidence']

    logger.info(f"Pipeline Step 4/7: Confidence Check ({confidence} vs {confidence_threshold})")

    passed_confidence = confidence >= confidence_threshold
    pipeline_details['confidence_check'] = {
        'confidence': confidence,
        'threshold': confidence_threshold,
        'passed': passed_confidence,
    }

    if not passed_confidence:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED at Step 4: Low confidence ({confidence})")
        return _build_result(
            status='failed', result_type='low_confidence',
            blur_score=blur_result['blur_score'], is_blurry=False,
            predicted_class=predicted_class, confidence=confidence,
            passed_confidence_check=False, forgery_score=forgery_score,
            message=MESSAGES['low_confidence'], need_retry=True,
            processing_time_ms=round((time.time() - start_time) * 1000),
            pipeline_details=pipeline_details,
        )

    logger.info(f"Pipeline Step 5/7: Class Handling -> {predicted_class}")

    if predicted_class == 'anh_khong_lien_quan':
        total_time = round((time.time() - start_time) * 1000)
        return _build_result(
            status='failed', result_type='invalid',
            blur_score=blur_result['blur_score'], is_blurry=False,
            predicted_class=predicted_class, confidence=confidence,
            passed_confidence_check=True, forgery_score=forgery_score,
            message=MESSAGES['anh_khong_lien_quan'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    if predicted_class == 'giay_to_khac':
        total_time = round((time.time() - start_time) * 1000)
        return _build_result(
            status='failed', result_type='wrong_doc',
            blur_score=blur_result['blur_score'], is_blurry=False,
            predicted_class=predicted_class, confidence=confidence,
            passed_confidence_check=True, forgery_score=forgery_score,
            message=MESSAGES['giay_to_khac'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    logger.info("Pipeline Step 6/7: Stamp Detection")
    step_start = time.time()

    stamp_result = detect_stamp(image_path)
    pipeline_details['stamp_detection'] = {
        **stamp_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    stamp_score = stamp_result.get('stamp_score', 0.0)
    stamp_detected = stamp_result.get('stamp_detected', False)

    final_confidence = round(0.7 * confidence + 0.3 * stamp_score, 4)

    pipeline_details['confidence_aggregation'] = {
        'model_confidence': confidence,
        'stamp_score': stamp_score,
        'final_confidence': final_confidence,
        'formula': '0.7 * model_conf + 0.3 * stamp_score',
    }

    # Neu final_confidence giam duoi threshold sau aggregation
    if final_confidence < confidence_threshold:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline: final_confidence ({final_confidence}) < threshold after stamp aggregation")
        return _build_result(
            status='pending', result_type='review',
            blur_score=blur_result['blur_score'], is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message='Day khong phai so ho ngheo.',
            need_retry=False,
            processing_time_ms=round((time.time() - start_time) * 1000),
            pipeline_details=pipeline_details,
        )

    logger.info("Pipeline Step 7/7: OCR (VietOCR)")
    step_start = time.time()

    ocr_result = extract_text(image_path)
    pipeline_details['ocr'] = {
        'extracted_text_length': len(ocr_result.get('extracted_text', '') or ''),
        'ocr_confidence': ocr_result.get('ocr_confidence'),
        'is_demo': ocr_result.get('is_demo', False),
        'time_ms': round((time.time() - step_start) * 1000),
    }

    total_time = round((time.time() - start_time) * 1000)

    # Neu forgery nghi ngo (0.4-0.7) -> pending review
    if needs_review:
        logger.info(f"Pipeline COMPLETED with REVIEW needed (forgery={forgery_score}) in {total_time}ms")
        return _build_result(
            status='pending', result_type='review',
            blur_score=blur_result['blur_score'], is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            extracted_text=ocr_result.get('extracted_text'),
            ocr_confidence=ocr_result.get('ocr_confidence'),
            household_name=ocr_result.get('household_name'),
            household_address=ocr_result.get('household_address'),
            household_id_number=ocr_result.get('household_id_number'),
            province=ocr_result.get('province'),
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['forgery_review'],
            need_retry=False,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    logger.info(f"Pipeline COMPLETED successfully in {total_time}ms")
    return _build_result(
        status='success', result_type='success',
        blur_score=blur_result['blur_score'], is_blurry=False,
        predicted_class=predicted_class, confidence=final_confidence,
        passed_confidence_check=True,
        extracted_text=ocr_result.get('extracted_text'),
        ocr_confidence=ocr_result.get('ocr_confidence'),
        household_name=ocr_result.get('household_name'),
        household_address=ocr_result.get('household_address'),
        household_id_number=ocr_result.get('household_id_number'),
        province=ocr_result.get('province'),
        stamp_detected=stamp_detected, stamp_score=stamp_score,
        forgery_score=forgery_score,
        message=MESSAGES['so_ho_ngheo'],
        need_retry=False,
        processing_time_ms=total_time, pipeline_details=pipeline_details,
    )


def _build_result(**kwargs) -> dict:
    """Helper tao result dict voi tat ca truong can thiet."""
    defaults = {
        'status': 'failed',
        'result_type': None,
        'blur_score': 0.0,
        'is_blurry': False,
        'predicted_class': None,
        'confidence': None,
        'passed_confidence_check': False,
        'extracted_text': None,
        'ocr_confidence': None,
        'household_name': None,
        'household_address': None,
        'household_id_number': None,
        'province': None,
        'stamp_detected': False,
        'stamp_score': 0.0,
        'forgery_score': 0.0,
        'processing_time_ms': 0,
        'message': '',
        'need_retry': True,
        'pipeline_details': {},
    }
    defaults.update(kwargs)
    return defaults
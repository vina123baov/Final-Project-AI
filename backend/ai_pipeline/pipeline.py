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
    'blur': 'Ảnh bị mờ. Vui lòng chụp lại.',
    'blur_partial': 'Ảnh mờ một phần (con dấu/chữ ký khó đọc). Gửi để nhân viên xem xét thủ công.',
    'forgery': 'Phát hiện dấu hiệu chỉnh sửa ảnh.',
    'forgery_review': 'Ảnh cần được admin xem xét (nghi ngờ nhẹ).',
    'low_confidence': 'Không nhận diện được. Vui lòng chụp lại.',
    'anh_khong_lien_quan': 'Ảnh không hợp lệ.',
    'giay_to_khac': 'Đây không phải sổ hộ nghèo.',
    'no_stamp': 'Không phát hiện con dấu chính quyền.',
    'so_ho_ngheo': 'Xác minh thành công!',
    'pending_low_confidence': 'Độ tin cậy chưa đủ cao — chuyển sang xem xét thủ công.',
    'pending_no_stamp': 'Không tìm thấy con dấu rõ ràng — chuyển sang xem xét thủ công.',
    'pending_forgery_suspect': 'Phát hiện dấu hiệu bất thường nhẹ — chuyển sang xem xét thủ công.',
    'review_blur_stamp': 'Con dấu/chữ ký bị mờ — chuyển sang xem xét thủ công thay vì từ chối.',
}

# Thresholds
FORGERY_REJECT_THRESHOLD = 0.7       # >= 0.7 → reject hẳn
FORGERY_PENDING_THRESHOLD = 0.4      # 0.4–0.7 → pending
FORGERY_REVIEW_THRESHOLD = 0.25      # 0.25–0.4 → review (nghi ngờ nhẹ)

BLUR_HARD_REJECT = 50                # < 50 → reject hẳn (quá mờ)
BLUR_SOFT_REJECT = 100               # 50–100 → review (mờ nhẹ, có thể đọc được)

CONFIDENCE_REJECT = 0.55             # < 0.55 → reject (quá thấp)
CONFIDENCE_PENDING = 0.70            # 0.55–0.70 → pending (chưa chắc chắn)

STAMP_PENDING_THRESHOLD = 0.3        # stamp_score < 0.3 trên sổ hộ nghèo → pending

REJECT_NON_SHN_THRESHOLD = 0.30
SHN_MAX_PROB_FOR_REJECT = 0.30


def run_pipeline(image_path: str) -> dict:
    """
    Pipeline xử lý ảnh với logic Pending/Review đầy đủ.

    TRẠNG THÁI:
    - failed:  Từ chối rõ ràng (ảnh quá mờ, sai tài liệu, forgery cao, confidence quá thấp)
    - pending: Cần admin duyệt thủ công (confidence biên giới, stamp không rõ, forgery trung bình)
    - review:  Cần xem xét kỹ hơn (mờ nhẹ ở vùng con dấu/chữ ký, forgery nhẹ)
    - success: Xác minh thành công

    LOGIC PENDING/REVIEW:
    pending:
      - confidence 0.55–0.70 (chưa đủ chắc nhưng không thấp đến mức reject)
      - stamp_score < 0.3 nhưng ảnh rõ (con dấu không tìm thấy rõ ràng)
      - forgery_score 0.4–0.7 (nghi ngờ vừa)

    review:
      - blur_score 50–100 (ảnh mờ vừa, con dấu/chữ ký khó đọc → KHÔNG từ chối ngay)
      - forgery_score 0.25–0.4 (nghi ngờ nhẹ)
      - final_confidence 0.55–0.70 sau stamp aggregation
    """
    start_time = time.time()
    pipeline_details = {}

    classifier = get_classifier()
    confidence_threshold = classifier.confidence_threshold if classifier.is_loaded else getattr(settings, 'CONFIDENCE_THRESHOLD', 0.7)
    blur_threshold = classifier.blur_threshold if classifier.is_loaded else getattr(settings, 'BLUR_THRESHOLD', 100)

    # ==================================================================
    # BƯỚC 1: Blur Detection — phân loại 3 mức
    # ==================================================================
    logger.info("Pipeline Step 1: Blur Detection")
    step_start = time.time()

    blur_result = check_blur(image_path, threshold_override=blur_threshold)
    pipeline_details['blur_detection'] = {
        **blur_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    blur_score = blur_result['blur_score']

    # Mức 1: Quá mờ → reject ngay
    if blur_score < BLUR_HARD_REJECT:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED: Image very blurry (score={blur_score} < {BLUR_HARD_REJECT})")
        return _build_result(
            status='failed', result_type='blur',
            blur_score=blur_score, is_blurry=True,
            message=MESSAGES['blur'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    # Mức 2: Mờ vừa (50–100) → tiếp tục nhưng đánh dấu để xét review sau
    is_partially_blurry = BLUR_HARD_REJECT <= blur_score < BLUR_SOFT_REJECT

    # ==================================================================
    # BƯỚC 2: Document Classification
    # ==================================================================
    logger.info("Pipeline Step 2: Document Classification")
    step_start = time.time()

    classification_result = classifier.classify(image_path)
    pipeline_details['classification'] = {
        **classification_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    predicted_class = classification_result['predicted_class']
    confidence = classification_result['confidence']
    all_probs = classification_result.get('all_probabilities', {})

    p_shn = all_probs.get('so_ho_ngheo', 0.0)
    p_gtk = all_probs.get('giay_to_khac', 0.0)
    p_akl = all_probs.get('anh_khong_lien_quan', 0.0)

    if not all_probs:
        if predicted_class == 'so_ho_ngheo': p_shn = confidence
        elif predicted_class == 'giay_to_khac': p_gtk = confidence
        elif predicted_class == 'anh_khong_lien_quan': p_akl = confidence

    logger.info(
        f"Classification: predicted={predicted_class}, conf={confidence:.3f} | "
        f"P(shn)={p_shn:.3f}, P(gtk)={p_gtk:.3f}, P(akl)={p_akl:.3f}"
    )

    # ==================================================================
    # BƯỚC 3: Reject rõ ràng — sai tài liệu, ảnh không liên quan
    # ==================================================================
    logger.info("Pipeline Step 3: Smart Rejection Check")

    if (predicted_class == 'giay_to_khac') or (p_gtk >= REJECT_NON_SHN_THRESHOLD and p_shn < confidence_threshold):
        total_time = round((time.time() - start_time) * 1000)
        return _build_result(
            status='failed', result_type='wrong_doc',
            blur_score=blur_score, is_blurry=is_partially_blurry,
            predicted_class='giay_to_khac',
            confidence=max(confidence, p_gtk),
            passed_confidence_check=True,
            message=MESSAGES['giay_to_khac'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    if (predicted_class == 'anh_khong_lien_quan') or (p_akl >= REJECT_NON_SHN_THRESHOLD and p_shn < confidence_threshold):
        total_time = round((time.time() - start_time) * 1000)
        return _build_result(
            status='failed', result_type='invalid',
            blur_score=blur_score, is_blurry=is_partially_blurry,
            predicted_class='anh_khong_lien_quan',
            confidence=max(confidence, p_akl),
            passed_confidence_check=True,
            message=MESSAGES['anh_khong_lien_quan'], need_retry=True,
            processing_time_ms=total_time, pipeline_details=pipeline_details,
        )

    # ==================================================================
    # BƯỚC 4: Confidence check — 3 ngưỡng
    # ==================================================================
    logger.info(f"Pipeline Step 4: Confidence Check ({confidence:.3f})")

    pipeline_details['confidence_check'] = {
        'confidence': confidence,
        'threshold': confidence_threshold,
        'reject_threshold': CONFIDENCE_REJECT,
        'pending_threshold': CONFIDENCE_PENDING,
    }

    # Quá thấp → reject (hoặc review nếu model chưa load)
    if confidence < CONFIDENCE_REJECT:
        total_time = round((time.time() - start_time) * 1000)

        # Model chưa load (demo mode) → review thủ công thay vì reject hẳn
        if not classifier.is_loaded:
            logger.info(f"Pipeline → REVIEW: model not loaded, confidence={confidence:.3f}")
            return _build_result(
                status='review', result_type='pending_low_confidence',
                blur_score=blur_score, is_blurry=is_partially_blurry,
                predicted_class=predicted_class, confidence=confidence,
                passed_confidence_check=False,
                message='Model AI chưa sẵn sàng — chuyển xét duyệt thủ công.',
                need_retry=False,
                processing_time_ms=total_time,
                pipeline_details=pipeline_details,
            )

        # Model đã load nhưng confidence thực sự thấp → reject
        logger.info(f"Pipeline STOPPED: Confidence too low ({confidence:.3f} < {CONFIDENCE_REJECT})")
        return _build_result(
            status='failed', result_type='low_confidence',
            blur_score=blur_score, is_blurry=is_partially_blurry,
            predicted_class=predicted_class, confidence=confidence,
            passed_confidence_check=False,
            message=MESSAGES['low_confidence'], need_retry=True,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
        )

    # ==================================================================
    # BƯỚC 5: Forgery Detection
    # ==================================================================
    logger.info("Pipeline Step 5: Forgery Detection")
    step_start = time.time()

    forgery_result = detect_forgery(image_path)
    pipeline_details['forgery_detection'] = {
        **forgery_result,
        'time_ms': round((time.time() - step_start) * 1000),
    }

    forgery_score = forgery_result.get('forgery_score', 0.0)

    # Forgery cao → reject
    if forgery_score >= FORGERY_REJECT_THRESHOLD:
        total_time = round((time.time() - start_time) * 1000)
        logger.info(f"Pipeline STOPPED: Forgery detected ({forgery_score:.3f})")
        return _build_result(
            status='failed', result_type='forgery',
            blur_score=blur_score, is_blurry=is_partially_blurry,
            predicted_class=predicted_class, confidence=confidence,
            passed_confidence_check=True,
            forgery_score=forgery_score,
            message=MESSAGES['forgery'], need_retry=True,
            processing_time_ms=round((time.time() - start_time) * 1000),
            pipeline_details=pipeline_details,
        )

    # ==================================================================
    # BƯỚC 6: Stamp Detection
    # ==================================================================
    logger.info("Pipeline Step 6: Stamp Detection")
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

    # ==================================================================
    # BƯỚC 7: OCR
    # ==================================================================
    logger.info("Pipeline Step 7: OCR")
    step_start = time.time()

    ocr_result = extract_text(image_path)
    pipeline_details['ocr'] = {
        'extracted_text_length': len(ocr_result.get('extracted_text', '') or ''),
        'ocr_confidence': ocr_result.get('ocr_confidence'),
        'is_demo': ocr_result.get('is_demo', False),
        'time_ms': round((time.time() - step_start) * 1000),
    }

    total_time = round((time.time() - start_time) * 1000)

    # ==================================================================
    # BƯỚC 8: Quyết định cuối — PENDING / REVIEW / SUCCESS
    # ==================================================================
    logger.info("Pipeline Step 8: Final Decision")

    ocr_data = dict(
        extracted_text=ocr_result.get('extracted_text'),
        ocr_confidence=ocr_result.get('ocr_confidence'),
        household_name=ocr_result.get('household_name'),
        household_address=ocr_result.get('household_address'),
        household_id_number=ocr_result.get('household_id_number'),
        province=ocr_result.get('province'),
    )

    # --- REVIEW: ảnh mờ vừa (con dấu/chữ ký khó đọc) ---
    if is_partially_blurry:
        logger.info(f"Pipeline → REVIEW: partial blur (score={blur_score})")
        return _build_result(
            status='review', result_type='review_blur',
            blur_score=blur_score, is_blurry=True,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['review_blur_stamp'],
            need_retry=False,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
            **ocr_data,
        )

    # --- REVIEW: forgery nhẹ (0.25–0.4) ---
    if FORGERY_REVIEW_THRESHOLD <= forgery_score < FORGERY_PENDING_THRESHOLD:
        logger.info(f"Pipeline → REVIEW: light forgery suspicion (score={forgery_score})")
        return _build_result(
            status='review', result_type='review_forgery',
            blur_score=blur_score, is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['forgery_review'],
            need_retry=False,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
            **ocr_data,
        )

    # --- PENDING: forgery trung bình (0.4–0.7) ---
    if FORGERY_PENDING_THRESHOLD <= forgery_score < FORGERY_REJECT_THRESHOLD:
        logger.info(f"Pipeline → PENDING: forgery suspect (score={forgery_score})")
        return _build_result(
            status='pending', result_type='pending_forgery',
            blur_score=blur_score, is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['pending_forgery_suspect'],
            need_retry=False,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
            **ocr_data,
        )

    # --- PENDING: stamp không tìm thấy rõ ---
    if stamp_score < STAMP_PENDING_THRESHOLD:
        logger.info(f"Pipeline → PENDING: no clear stamp (score={stamp_score})")
        return _build_result(
            status='pending', result_type='pending_no_stamp',
            blur_score=blur_score, is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=True,
            stamp_detected=False, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['pending_no_stamp'],
            need_retry=False,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
            **ocr_data,
        )

    # --- PENDING: confidence biên giới (0.55–0.70) ---
    if CONFIDENCE_REJECT <= final_confidence < CONFIDENCE_PENDING:
        logger.info(f"Pipeline → PENDING: borderline confidence ({final_confidence})")
        return _build_result(
            status='pending', result_type='pending_low_confidence',
            blur_score=blur_score, is_blurry=False,
            predicted_class=predicted_class, confidence=final_confidence,
            passed_confidence_check=False,
            stamp_detected=stamp_detected, stamp_score=stamp_score,
            forgery_score=forgery_score,
            message=MESSAGES['pending_low_confidence'],
            need_retry=False,
            processing_time_ms=total_time,
            pipeline_details=pipeline_details,
            **ocr_data,
        )

    # --- SUCCESS ---
    logger.info(f"Pipeline → SUCCESS (conf={final_confidence:.3f}, stamp={stamp_score:.3f}) in {total_time}ms")
    return _build_result(
        status='success', result_type='success',
        blur_score=blur_score, is_blurry=False,
        predicted_class=predicted_class, confidence=final_confidence,
        passed_confidence_check=True,
        stamp_detected=stamp_detected, stamp_score=stamp_score,
        forgery_score=forgery_score,
        message=MESSAGES['so_ho_ngheo'],
        need_retry=False,
        processing_time_ms=total_time,
        pipeline_details=pipeline_details,
        **ocr_data,
    )


def _build_result(**kwargs) -> dict:
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
"""
API Views
Khoa luan: Phu luc A.2 (API Documentation)

Endpoints:
    POST /api/verify/           UC03: Upload anh xac minh (chay pipeline AI)
    GET  /api/history/          UC05: Xem lich su
    GET  /api/result/<id>/      UC04: Xem ket qua
    GET  /api/admin/dashboard/  UC08: Xem thong ke
    GET  /api/admin/requests/   UC07: Xem yeu cau xac minh
    POST /api/admin/review/     UC07: Duyet yeu cau
    GET  /api/health/           Health check
"""
import os
import uuid
import logging
from datetime import datetime, timedelta

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import VerifyImageSerializer
from .supabase_service import (
    create_verification_request,
    update_verification_request,
    get_verification_request,
    get_user_verification_history,
    get_admin_dashboard,
    get_error_distribution,
    get_all_verification_requests,
    admin_review_request,
    create_audit_log,
    upload_image_to_storage,
    delete_image_from_storage,
)
from ai_pipeline.pipeline import run_pipeline

logger = logging.getLogger(__name__)


# ============================================================================
# POST /api/verify/ — UC03: Upload anh xac minh
# ============================================================================
# Day la endpoint chinh, chay toan bo AI Pipeline (Section 2.4.1)
# Request:  multipart/form-data { image, user_id?, latitude?, longitude?, address? }
# Response: Phu luc A.3 (thanh cong), A.4 (anh mo), A.5 (confidence thap)

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def verify_image(request):
    """
    POST /api/verify/

    Nhan anh upload, chay pipeline AI 5 buoc, luu ket qua vao Supabase.

    Pipeline (Section 2.4.1, Hinh 2.4):
        1. Blur Detection     -> is_blurry, blur_score
        2. Classification     -> predicted_class, confidence
        3. Confidence Check   -> passed_confidence_check
        4. Class Handling     -> result_type
        5. OCR (VietOCR)      -> extracted_text, household info

    Co 2 che do:
        - Co user_id: chay pipeline + luu vao Supabase (UC03 day du)
        - Khong user_id: chi chay pipeline AI va tra ket qua (validate nhanh)
    """
    # --- Validate input ---
    serializer = VerifyImageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'status': 'error',
            'message': 'Du lieu khong hop le',
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    image_file = serializer.validated_data['image']
    user_id = serializer.validated_data.get('user_id')  # None neu frontend khong gui
    latitude = serializer.validated_data.get('latitude')
    longitude = serializer.validated_data.get('longitude')
    address = serializer.validated_data.get('address', '')

    try:
        # --- Luu anh tam vao disk ---
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        file_ext = image_file.name.split('.')[-1].lower()
        temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
        temp_path = os.path.join(upload_dir, temp_filename)

        with open(temp_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)

        logger.info(f"Image saved: {temp_path} ({image_file.size} bytes)")

        # =============================================================
        # CHAY AI PIPELINE (Section 2.4.1)
        # =============================================================
        pipeline_result = run_pipeline(temp_path)

        logger.info(
            f"Pipeline done: status={pipeline_result['status']}, "
            f"class={pipeline_result['predicted_class']}, "
            f"confidence={pipeline_result['confidence']:.3f}, "
            f"blur={pipeline_result['blur_score']:.1f}, "
            f"time={pipeline_result['processing_time_ms']}ms"
        )

        # --- Luu vao Supabase chi khi co user_id (UUID hop le) ---
        request_id = None
        verification_code = None

        if user_id:
            verification_code = f"VF-{uuid.uuid4().hex[:8].upper()}"

            db_data = {
                'user_id': user_id,
                'image_path': image_file.name,
                'original_filename': image_file.name,
                'status': pipeline_result['status'],
                'result_type': pipeline_result['result_type'],
                'verification_code': verification_code,
                'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
                'blur_score': pipeline_result['blur_score'],
                'is_blurry': pipeline_result['is_blurry'],
                'predicted_class': pipeline_result['predicted_class'],
                'confidence': pipeline_result['confidence'],
                'passed_confidence_check': pipeline_result['passed_confidence_check'],
                'extracted_text': pipeline_result['extracted_text'],
                'ocr_confidence': pipeline_result['ocr_confidence'],
                'household_name': pipeline_result['household_name'],
                'household_address': pipeline_result['household_address'],
                'household_id_number': pipeline_result['household_id_number'],
                'province': pipeline_result['province'],
                'processing_time_ms': pipeline_result['processing_time_ms'],
                'message': pipeline_result['message'],
                'need_retry': pipeline_result['need_retry'],
                'user_latitude': latitude,
                'user_longitude': longitude,
                'user_location_address': address,
            }

            if pipeline_result['status'] == 'success':
                db_data['verified_at'] = datetime.utcnow().isoformat()

            # Upload anh len Supabase Storage
            try:
                storage_path = upload_image_to_storage(user_id, temp_path, temp_filename)
                if storage_path:
                    db_data['image_storage_path'] = storage_path
            except Exception as storage_err:
                logger.warning(f"Storage upload skipped: {storage_err}")

            # Luu vao database
            db_record = create_verification_request(db_data)
            request_id = db_record.get('id')

            logger.info(f"Saved to Supabase: id={request_id}, code={verification_code}")

            # Ghi audit log
            create_audit_log(
                user_id=user_id,
                action='verify_image',
                entity_type='verification_requests',
                entity_id=request_id,
                details={
                    'verification_code': verification_code,
                    'result_type': pipeline_result['result_type'],
                    'confidence': pipeline_result['confidence'],
                    'blur_score': pipeline_result['blur_score'],
                    'processing_time_ms': pipeline_result['processing_time_ms'],
                }
            )
        else:
            logger.info("No user_id provided - skipping Supabase save (validate-only mode)")

        # --- Xoa anh tam ---
        if os.path.exists(temp_path):
            os.remove(temp_path)

        # --- Tra ve response (Phu luc A.3-A.5) ---
        is_success = pipeline_result['status'] == 'success'

        return Response({
            'success': is_success,
            'status': pipeline_result['status'],
            'result_type': pipeline_result['result_type'],
            'message': pipeline_result['message'],
            'need_retry': pipeline_result['need_retry'],
            'predicted_class': pipeline_result['predicted_class'],
            'confidence': pipeline_result['confidence'],
            'blur_score': pipeline_result['blur_score'],
            'is_blurry': pipeline_result['is_blurry'],
            'data': {
                'id': request_id,
                'verification_code': verification_code,
                'predicted_class': pipeline_result['predicted_class'],
                'confidence': pipeline_result['confidence'],
                'blur_score': pipeline_result['blur_score'],
                'extracted_text': pipeline_result['extracted_text'],
                'household_name': pipeline_result['household_name'],
                'household_address': pipeline_result['household_address'],
                'household_id_number': pipeline_result['household_id_number'],
                'processing_time_ms': pipeline_result['processing_time_ms'],
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception(f"Verify error: {e}")

        # Ghi audit log loi (chi khi co user_id)
        if user_id:
            try:
                create_audit_log(
                    user_id=user_id,
                    action='verify_image_error',
                    entity_type='verification_requests',
                    details={'error': str(e)}
                )
            except Exception:
                pass

        # Xoa anh tam neu con
        try:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass

        return Response({
            'success': False,
            'status': 'error',
            'message': f'Loi he thong: {str(e)}',
            'need_retry': True,
            'data': {}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# GET /api/result/<id>/ — UC04: Xem ket qua
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_result(request, request_id):
    """Lay ket qua xac minh theo ID"""
    record = get_verification_request(request_id)
    if not record:
        return Response({'error': 'Khong tim thay'}, status=status.HTTP_404_NOT_FOUND)
    return Response(record)


# ============================================================================
# GET /api/history/?user_id=xxx — UC05: Xem lich su
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_history(request):
    """Lay lich su xac minh cua user"""
    user_id = request.query_params.get('user_id')
    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)

    limit = int(request.query_params.get('limit', 50))
    history = get_user_verification_history(user_id, limit=limit)
    return Response({'data': history, 'count': len(history)})


# ============================================================================
# ADMIN ENDPOINTS (UC06, UC07, UC08)
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])  # TODO: them admin auth check
def admin_dashboard(request):
    """UC08: Admin dashboard thong ke"""
    dashboard = get_admin_dashboard()
    errors = get_error_distribution()
    return Response({
        'dashboard': dashboard,
        'error_distribution': errors,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_requests(request):
    """UC07: Admin xem tat ca yeu cau"""
    filter_status = request.query_params.get('status')
    limit = int(request.query_params.get('limit', 100))
    requests_list = get_all_verification_requests(status=filter_status, limit=limit)
    return Response({'data': requests_list, 'count': len(requests_list)})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_review(request):
    """UC07: Admin duyet yeu cau"""
    request_id = request.data.get('request_id')
    admin_id = request.data.get('admin_id')
    notes = request.data.get('notes', '')

    if not request_id or not admin_id:
        return Response({'error': 'Thieu request_id hoac admin_id'}, status=status.HTTP_400_BAD_REQUEST)

    result = admin_review_request(int(request_id), admin_id, notes)
    create_audit_log(admin_id, 'admin_review', 'verification_requests', request_id, {'notes': notes})
    return Response({'data': result})


# ============================================================================
# Health Check
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint"""
    from ai_pipeline.classification import get_classifier

    classifier = get_classifier()
    model_path = getattr(settings, 'EFFICIENTNET_MODEL_PATH', 'models/efficientnet_b0_poverty.pth')

    return Response({
        'status': 'ok',
        'ai_model_loaded': classifier.is_loaded,
        'ai_model_path': model_path,
        'ai_model_device': classifier.device,
        'blur_threshold': getattr(settings, 'BLUR_THRESHOLD', 100),
        'confidence_threshold': getattr(settings, 'CONFIDENCE_THRESHOLD', 0.7),
        'supabase_connected': bool(settings.SUPABASE_URL),
    })
import os
import uuid
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

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
    get_all_users,
    toggle_user_status,
)
from ai_pipeline.pipeline import run_pipeline

logger = logging.getLogger(__name__)


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    email = request.data.get('email', '')
    password = request.data.get('password', '')

    if not email or not password:
        return Response(
            {'detail': 'Vui long nhap email va mat khau'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(email=email)
        if not user.check_password(password):
            return Response(
                {'detail': 'Email hoac mat khau khong dung'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not user.is_active:
            return Response(
                {'detail': 'Tai khoan da bi khoa'},
                status=status.HTTP_403_FORBIDDEN
            )
    except User.DoesNotExist:
        return Response(
            {'detail': 'Email hoac mat khau khong dung'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': str(user.id),
            'email': user.email,
            'full_name': user.get_full_name(),
            'is_staff': user.is_staff,
        }
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_register(request):
    full_name = request.data.get('full_name', '')
    email = request.data.get('email', '')
    phone = request.data.get('phone', '')
    password = request.data.get('password', '')

    if not email or not password:
        return Response(
            {'detail': 'Vui long nhap email va mat khau'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {'detail': 'Email da duoc su dung'},
            status=status.HTTP_409_CONFLICT
        )

    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=full_name.split(' ')[0] if full_name else '',
        last_name=' '.join(full_name.split(' ')[1:]) if full_name and len(full_name.split(' ')) > 1 else '',
    )

    return Response({
        'message': 'Dang ky thanh cong!',
        'user_id': str(user.id),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    user = request.user
    return Response({
        'id': str(user.id),
        'email': user.email,
        'full_name': user.get_full_name(),
        'phone': '',
        'role': 'admin' if user.is_staff else 'user',
        'is_active': user.is_active,
        'created_at': user.date_joined.isoformat(),
        'last_sign_in_at': user.last_login.isoformat() if user.last_login else None,
    })


# ============================================================================
# POST /api/verify/ — FIXED: chi insert cac cot co trong Supabase
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def verify_image(request):
    """
    POST /api/verify/
    FIX: Chi insert cac cot thuc su ton tai trong bang verification_requests.
    Neu cot nao khong co trong Supabase -> bo qua, khong crash.
    """
    serializer = VerifyImageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False, 'status': 'error',
            'message': 'Du lieu khong hop le', 'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    image_file = serializer.validated_data.get('image')
    if not image_file:
        return Response({
            'success': False, 'status': 'error',
            'message': 'Vui long chon anh', 'data': {},
        }, status=status.HTTP_400_BAD_REQUEST)

    # Lay user_id
    user_id = None
    if request.user and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        user_id = serializer.validated_data.get('user_id')

    latitude = serializer.validated_data.get('latitude')
    longitude = serializer.validated_data.get('longitude')
    address = serializer.validated_data.get('address', '')

    try:
        # Luu anh tam
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        file_ext = image_file.name.split('.')[-1].lower()
        temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
        temp_path = os.path.join(upload_dir, temp_filename)

        with open(temp_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)

        logger.info(f"Image saved: {temp_path} ({image_file.size} bytes)")

        # Chay AI Pipeline
        pipeline_result = run_pipeline(temp_path)

        logger.info(
            f"Pipeline done: status={pipeline_result['status']}, "
            f"class={pipeline_result.get('predicted_class')}, "
            f"conf={pipeline_result.get('confidence') or 0:.3f}, "
            f"time={pipeline_result.get('processing_time_ms', 0)}ms"
        )

        # Luu vao Supabase neu co user_id
        request_id = None
        verification_code = None

        if user_id:
            verification_code = f"VF-{uuid.uuid4().hex[:8].upper()}"

            # ============================================================
            # FIX: Chi insert cac cot DA TON TAI trong bang Supabase
            # Neu ban da them cac cot moi vao Supabase, co the uncomment
            # ============================================================
            db_data = {
                'user_id': user_id,
                'image_path': image_file.name,
                'status': pipeline_result['status'],
                'result_type': pipeline_result.get('result_type'),
                'verification_code': verification_code,
                'blur_score': pipeline_result.get('blur_score', 0),
                'predicted_class': pipeline_result.get('predicted_class'),
                'confidence': pipeline_result.get('confidence'),
                'extracted_text': pipeline_result.get('extracted_text'),
                'household_name': pipeline_result.get('household_name'),
                'household_address': pipeline_result.get('household_address'),
                'household_id_number': pipeline_result.get('household_id_number'),
                'processing_time_ms': pipeline_result.get('processing_time_ms', 0),
                'message': pipeline_result.get('message', ''),
                'need_retry': pipeline_result.get('need_retry', True),
                # Vi tri nguoi dung
                'user_latitude': latitude,
                'user_longitude': longitude,
                'user_location_address': address,
            }

            # Thu insert, neu loi thi bo bot cac cot khong ton tai
            try:
                db_record = create_verification_request(db_data)
                request_id = db_record.get('id')
            except Exception as db_err:
                logger.warning(f"Insert full data failed: {db_err}")
                # Fallback: chi insert cac cot co ban nhat
                minimal_data = {
                    'user_id': user_id,
                    'image_path': image_file.name,
                    'status': pipeline_result['status'],
                    'result_type': pipeline_result.get('result_type'),
                    'verification_code': verification_code,
                    'blur_score': pipeline_result.get('blur_score', 0),
                    'predicted_class': pipeline_result.get('predicted_class'),
                    'confidence': pipeline_result.get('confidence'),
                    'extracted_text': pipeline_result.get('extracted_text'),
                    'processing_time_ms': pipeline_result.get('processing_time_ms', 0),
                    'message': pipeline_result.get('message', ''),
                }
                try:
                    db_record = create_verification_request(minimal_data)
                    request_id = db_record.get('id')
                except Exception as db_err2:
                    logger.error(f"Insert minimal data also failed: {db_err2}")
                    # Van tra ve ket qua pipeline, chi khong luu DB

            try:
                create_audit_log(user_id, 'verify_image', 'verification_requests', request_id, {
                    'verification_code': verification_code,
                    'result_type': pipeline_result.get('result_type'),
                    'confidence': pipeline_result.get('confidence'),
                })
            except Exception:
                pass

        # Xoa file tam
        if os.path.exists(temp_path):
            os.remove(temp_path)

        is_success = pipeline_result['status'] == 'success'
        return Response({
            'success': is_success,
            'status': pipeline_result['status'],
            'result_type': pipeline_result.get('result_type'),
            'message': pipeline_result.get('message', ''),
            'need_retry': pipeline_result.get('need_retry', True),
            'predicted_class': pipeline_result.get('predicted_class'),
            'confidence': pipeline_result.get('confidence'),
            'blur_score': pipeline_result.get('blur_score'),
            'is_blurry': pipeline_result.get('is_blurry', False),
            'data': {
                'id': request_id,
                'verification_code': verification_code,
                'predicted_class': pipeline_result.get('predicted_class'),
                'confidence': pipeline_result.get('confidence'),
                'blur_score': pipeline_result.get('blur_score'),
                'extracted_text': pipeline_result.get('extracted_text'),
                'household_name': pipeline_result.get('household_name'),
                'household_address': pipeline_result.get('household_address'),
                'household_id_number': pipeline_result.get('household_id_number'),
                'processing_time_ms': pipeline_result.get('processing_time_ms'),
                'user_latitude': latitude,
                'user_longitude': longitude,
                'user_location_address': address,
            }
        })

    except Exception as e:
        logger.exception(f"Verify error: {e}")
        try:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return Response({
            'success': False, 'status': 'error',
            'message': f'Loi he thong: {str(e)}',
            'need_retry': True, 'data': {}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# GET /api/result/<id>/
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_result(request, request_id):
    record = get_verification_request(request_id)
    if not record:
        return Response({'error': 'Khong tim thay'}, status=status.HTTP_404_NOT_FOUND)
    return Response(record)


# ============================================================================
# GET /api/history/
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_history(request):
    if request.user and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        user_id = request.query_params.get('user_id')

    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)

    limit = int(request.query_params.get('limit', 50))
    history = get_user_verification_history(user_id, limit=limit)
    return Response({'data': history, 'count': len(history)})


# ============================================================================
# GET /api/verified-locations/ — NEW: lay vi tri cac ho da xac minh thanh cong
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_verified_locations(request):
    """
    Tra ve danh sach cac ho da xac minh thanh cong voi vi tri,
    de hien thi tren ban do Vietnam.
    """
    try:
        from .supabase_service import get_supabase_client
        supabase = get_supabase_client()
        result = (
            supabase.table('verification_requests')
            .select('id, verification_code, household_name, household_address, user_latitude, user_longitude, user_location_address, status, created_at')
            .eq('status', 'success')
            .not_.is_('user_latitude', 'null')
            .not_.is_('user_longitude', 'null')
            .order('created_at', desc=True)
            .limit(100)
            .execute()
        )
        return Response({'data': result.data or [], 'count': len(result.data or [])})
    except Exception as e:
        logger.error(f"get_verified_locations error: {e}")
        return Response({'data': [], 'count': 0})


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def admin_dashboard(request):
    dashboard = get_admin_dashboard()
    errors = get_error_distribution()
    return Response({'dashboard': dashboard, 'error_distribution': errors})


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_requests(request):
    filter_status = request.query_params.get('status')
    limit = int(request.query_params.get('limit', 100))
    requests_list = get_all_verification_requests(status=filter_status, limit=limit)
    return Response({'data': requests_list, 'count': len(requests_list)})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_review(request):
    request_id = request.data.get('request_id')
    admin_id = request.data.get('admin_id')
    notes = request.data.get('notes', '')
    if not request_id or not admin_id:
        return Response({'error': 'Thieu request_id hoac admin_id'}, status=status.HTTP_400_BAD_REQUEST)
    result = admin_review_request(int(request_id), admin_id, notes)
    return Response({'data': result})


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_users(request):
    users = get_all_users()
    return Response({'data': users, 'count': len(users)})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_toggle_user(request):
    user_id = request.data.get('user_id')
    is_active = request.data.get('is_active', True)
    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)
    result = toggle_user_status(user_id, is_active)
    return Response({'data': result})


# ============================================================================
# Health Check
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    from ai_pipeline.classification import get_classifier
    classifier = get_classifier()
    return Response({
        'status': 'ok',
        'ai_model_loaded': classifier.is_loaded,
        'ai_model_device': classifier.device,
        'blur_threshold': getattr(settings, 'BLUR_THRESHOLD', 100),
        'confidence_threshold': getattr(settings, 'CONFIDENCE_THRESHOLD', 0.7),
        'supabase_connected': bool(settings.SUPABASE_URL),
    })
import os
import uuid
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
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
    get_all_users,
    toggle_user_status,
)
from ai_pipeline.pipeline import run_pipeline

logger = logging.getLogger(__name__)


# ============================================================================
# Rate Limiting (Section 2.1.2: gioi han 10 request/user/ngay)
# ============================================================================

class VerifyRateThrottle(UserRateThrottle):
    rate = '10/day'
    scope = 'verify'

class VerifyAnonRateThrottle(AnonRateThrottle):
    rate = '5/day'
    scope = 'verify_anon'


# ============================================================================
# AUTH ENDPOINTS (UC01, UC02)
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    email = request.data.get('email', '')
    password = request.data.get('password', '')
    if not email or not password:
        return Response({'detail': 'Vui long nhap email va mat khau'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(email=email)
        if not user.check_password(password):
            return Response({'detail': 'Email hoac mat khau khong dung'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({'detail': 'Tai khoan da bi khoa'}, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        return Response({'detail': 'Email hoac mat khau khong dung'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    create_audit_log(str(user.id), 'login', 'users', str(user.id))
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {'id': str(user.id), 'email': user.email, 'full_name': user.get_full_name(), 'is_staff': user.is_staff}
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_register(request):
    full_name = request.data.get('full_name', '')
    email = request.data.get('email', '')
    phone = request.data.get('phone', '')
    password = request.data.get('password', '')
    if not email or not password:
        return Response({'detail': 'Vui long nhap email va mat khau'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'detail': 'Email da duoc su dung'}, status=status.HTTP_409_CONFLICT)
    user = User.objects.create_user(
        username=email, email=email, password=password,
        first_name=full_name.split(' ')[0] if full_name else '',
        last_name=' '.join(full_name.split(' ')[1:]) if full_name and len(full_name.split(' ')) > 1 else '',
    )
    create_audit_log(str(user.id), 'register', 'users', str(user.id))
    return Response({'message': 'Dang ky thanh cong!', 'user_id': str(user.id)}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    user = request.user
    return Response({
        'id': str(user.id), 'email': user.email, 'full_name': user.get_full_name(),
        'phone': '', 'role': 'admin' if user.is_staff else 'user',
        'is_active': user.is_active, 'created_at': user.date_joined.isoformat(),
        'last_sign_in_at': user.last_login.isoformat() if user.last_login else None,
    })


# ============================================================================
# POST /api/verify/ — UC03 (FULL FIX)
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def verify_image(request):
    """
    POST /api/verify/
    Nhan anh + vi tri + vat dung tiep te, chay AI Pipeline 7 buoc, luu tat ca vao Supabase.
    Rate limit: 10 req/user/ngay (Section 2.1.2)
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
    # MOI: lay support_categories tu request
    support_categories = request.data.getlist('support_categories', [])
    if not support_categories:
        # Fallback: thu lay dang JSON string
        cats_str = request.data.get('support_categories', '')
        if cats_str:
            import json
            try:
                support_categories = json.loads(cats_str)
            except (json.JSONDecodeError, TypeError):
                support_categories = [c.strip() for c in cats_str.split(',') if c.strip()]

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

        # Chay AI Pipeline 7 buoc
        pipeline_result = run_pipeline(temp_path)

        logger.info(
            f"Pipeline done: status={pipeline_result['status']}, "
            f"class={pipeline_result.get('predicted_class')}, "
            f"conf={pipeline_result.get('confidence') or 0:.3f}, "
            f"time={pipeline_result.get('processing_time_ms', 0)}ms"
        )

        # Luu vao Supabase
        request_id = None
        verification_code = None

        if user_id:
            verification_code = f"VF-{uuid.uuid4().hex[:8].upper()}"

            # Day du cac cot theo ERD Bang 2.3
            db_data = {
                'user_id': user_id,
                'image_path': image_file.name,
                'original_filename': image_file.name,
                'status': pipeline_result['status'],
                'result_type': pipeline_result.get('result_type'),
                'verification_code': verification_code,
                'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
                # Blur
                'blur_score': pipeline_result.get('blur_score', 0),
                'is_blurry': pipeline_result.get('is_blurry', False),
                # Classification
                'predicted_class': pipeline_result.get('predicted_class'),
                'confidence': pipeline_result.get('confidence'),
                'passed_confidence_check': pipeline_result.get('passed_confidence_check', False),
                # Stamp detection
                'stamp_detected': pipeline_result.get('stamp_detected', False),
                'stamp_score': pipeline_result.get('stamp_score', 0.0),
                # Forgery detection
                'forgery_score': pipeline_result.get('forgery_score', 0.0),
                # OCR
                'extracted_text': pipeline_result.get('extracted_text'),
                'ocr_confidence': pipeline_result.get('ocr_confidence'),
                'household_name': pipeline_result.get('household_name'),
                'household_address': pipeline_result.get('household_address'),
                'household_id_number': pipeline_result.get('household_id_number'),
                'province': pipeline_result.get('province'),
                # Thoi gian
                'processing_time_ms': pipeline_result.get('processing_time_ms', 0),
                'message': pipeline_result.get('message', ''),
                'need_retry': pipeline_result.get('need_retry', True),
                # Vi tri
                'user_latitude': latitude,
                'user_longitude': longitude,
                'user_location_address': address,
                # MOI: vat dung tiep te
                'support_categories': support_categories if support_categories else None,
            }

            if pipeline_result['status'] == 'success':
                db_data['verified_at'] = datetime.utcnow().isoformat()

            # Thu insert day du, fallback neu thieu cot
            db_record = _safe_insert(db_data)
            request_id = db_record.get('id') if db_record else None

            create_audit_log(user_id, 'verify_image', 'verification_requests', request_id, {
                'verification_code': verification_code,
                'result_type': pipeline_result.get('result_type'),
                'confidence': pipeline_result.get('confidence'),
                'processing_time_ms': pipeline_result.get('processing_time_ms'),
                'support_categories': support_categories,
            })

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
                'support_categories': support_categories,
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


def _safe_insert(db_data: dict) -> dict:
    """Insert voi fallback — bo bot cot neu Supabase chua co."""
    try:
        return create_verification_request(db_data)
    except Exception as e1:
        logger.warning(f"Full insert failed: {e1}, trying without optional cols")
        # Bo cac cot co the chua ton tai
        optional_cols = [
            'forgery_score', 'stamp_detected', 'stamp_score', 'is_blurry',
            'passed_confidence_check', 'ocr_confidence', 'province',
            'original_filename', 'image_storage_path', 'verified_at',
            'expires_at', 'support_categories',
        ]
        reduced = {k: v for k, v in db_data.items() if k not in optional_cols}
        try:
            return create_verification_request(reduced)
        except Exception as e2:
            logger.error(f"Reduced insert also failed: {e2}")
            # Minimal insert
            minimal = {
                'user_id': db_data.get('user_id'),
                'image_path': db_data.get('image_path', ''),
                'status': db_data.get('status', 'failed'),
                'result_type': db_data.get('result_type'),
                'verification_code': db_data.get('verification_code'),
                'message': db_data.get('message', ''),
            }
            try:
                return create_verification_request(minimal)
            except Exception as e3:
                logger.error(f"Minimal insert failed: {e3}")
                return {}


# ============================================================================
# GET /api/verified-locations/ — vi tri cac ho da xac minh (cho map)
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_verified_locations(request):
    try:
        from .supabase_service import get_supabase_client
        supabase = get_supabase_client()
        result = (
            supabase.table('verification_requests')
            .select('id, verification_code, household_name, household_address, user_latitude, user_longitude, user_location_address, status, created_at, support_categories')
            .eq('status', 'success')
            .not_.is_('user_latitude', 'null')
            .not_.is_('user_longitude', 'null')
            .order('created_at', desc=True)
            .limit(200)
            .execute()
        )
        return Response({'data': result.data or [], 'count': len(result.data or [])})
    except Exception as e:
        logger.error(f"get_verified_locations error: {e}")
        # Fallback: try without support_categories column
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
                .limit(200)
                .execute()
            )
            return Response({'data': result.data or [], 'count': len(result.data or [])})
        except Exception as e2:
            logger.error(f"get_verified_locations fallback error: {e2}")
            return Response({'data': [], 'count': 0})


# ============================================================================
# GET /api/result/<id>/ — UC04
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_result(request, request_id):
    record = get_verification_request(request_id)
    if not record:
        return Response({'error': 'Khong tim thay'}, status=status.HTTP_404_NOT_FOUND)
    return Response(record)


# ============================================================================
# GET /api/history/ — UC05
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
# ADMIN ENDPOINTS (UC06, UC07, UC08)
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
    create_audit_log(admin_id, 'admin_review', 'verification_requests', request_id, {'notes': notes})
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
    admin_id = str(request.user.id) if request.user and request.user.is_authenticated else 'system'
    create_audit_log(admin_id, 'toggle_user', 'users', user_id, {'is_active': is_active})
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
        'rate_limit': '10/day per user',
    })
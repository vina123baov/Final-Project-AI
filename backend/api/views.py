import os
import uuid
import logging
import re
import threading
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
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
    get_supabase_client,
)
from ai_pipeline.pipeline import run_pipeline

logger = logging.getLogger(__name__)

UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)

# Bật/tắt Storage upload
ENABLE_STORAGE_UPLOAD = True

# ============================================================================
# CACHE SETTINGS
# ============================================================================
# History cache 60s — lần đầu tốn ~10s, lần 2 trở đi gần như tức thời
# Verify mới sẽ invalidate cache (xóa key user_id) → user thấy data mới ngay
CACHE_HISTORY_TTL = 60
CACHE_DASHBOARD_TTL = 30
CACHE_LOCATIONS_TTL = 60
CACHE_REQUESTS_TTL = 20


def _cache_key_history(user_id: str, limit: int) -> str:
    return f"history:{user_id}:{limit}"


def _invalidate_user_history_cache(user_id: str):
    """Xóa cache history của user khi có verify mới"""
    for limit in [10, 20, 30, 50, 100]:
        cache.delete(_cache_key_history(user_id, limit))


def _is_valid_uuid(value: str) -> bool:
    if not value:
        return False
    return bool(UUID_PATTERN.match(str(value)))


# ============================================================================
# Rate Limiting
# ============================================================================

class VerifyRateThrottle(UserRateThrottle):
    rate = '10/day'
    scope = 'verify'

class VerifyAnonRateThrottle(AnonRateThrottle):
    rate = '5/day'
    scope = 'verify_anon'


# ============================================================================
# AUTH ENDPOINTS
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
# Storage upload helpers
# ============================================================================

def _upload_image_to_storage_sync(temp_path: str, user_id: str, filename: str, content_type: str) -> str | None:
    try:
        storage_key = f"{user_id}/{filename}" if user_id else f"anonymous/{filename}"

        with open(temp_path, 'rb') as f:
            get_supabase_client().storage.from_('verification-images').upload(
                path=storage_key,
                file=f,
                file_options={
                    "content-type": content_type or "image/jpeg",
                    "cache-control": "3600",
                }
            )

        logger.info(f"Image uploaded to Supabase Storage: verification-images/{storage_key}")
        return storage_key

    except Exception as e:
        logger.warning(f"Storage upload failed (non-critical): {e}")
        return None


def _upload_image_async(temp_path: str, user_id: str, filename: str, content_type: str, request_id: int):
    def _worker():
        try:
            storage_key = _upload_image_to_storage_sync(temp_path, user_id, filename, content_type)
            if storage_key and request_id:
                try:
                    update_verification_request(request_id, {'image_path': storage_key})
                    logger.info(f"Async storage upload + DB update OK for request #{request_id}")
                except Exception as e:
                    logger.warning(f"Async DB update failed for request #{request_id}: {e}")
            elif not storage_key:
                logger.info(f"Async storage upload skipped/failed for request #{request_id}")
        except Exception as e:
            logger.warning(f"Async upload thread error: {e}")

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


# ============================================================================
# POST /api/verify/ — UC03
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def verify_image(request):
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

    user_id = None
    if request.user and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        user_id = serializer.validated_data.get('user_id')

    latitude = serializer.validated_data.get('latitude')
    longitude = serializer.validated_data.get('longitude')
    address = serializer.validated_data.get('address', '')

    support_categories = request.data.getlist('support_categories', [])
    if not support_categories:
        cats_str = request.data.get('support_categories', '')
        if cats_str:
            import json
            try:
                support_categories = json.loads(cats_str)
            except (json.JSONDecodeError, TypeError):
                support_categories = [c.strip() for c in cats_str.split(',') if c.strip()]

    temp_path = None

    try:
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        file_ext = image_file.name.split('.')[-1].lower()
        temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
        temp_path = os.path.join(upload_dir, temp_filename)

        with open(temp_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)

        logger.info(f"Image saved locally: {temp_path} ({image_file.size} bytes)")

        pipeline_result = run_pipeline(temp_path)

        logger.info(
            f"Pipeline: status={pipeline_result['status']}, "
            f"class={pipeline_result.get('predicted_class')}, "
            f"conf={pipeline_result.get('confidence') or 0:.3f}, "
            f"time={pipeline_result.get('processing_time_ms', 0)}ms"
        )

        request_id = None
        verification_code = None

        if user_id and _is_valid_uuid(user_id):
            verification_code = f"VF-{uuid.uuid4().hex[:8].upper()}"

            db_data = {
                'user_id': user_id,
                'image_path': temp_filename,
                'original_filename': temp_filename,
                'status': pipeline_result['status'],
                'result_type': pipeline_result.get('result_type'),
                'verification_code': verification_code,
                'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),

                'blur_score': pipeline_result.get('blur_score', 0),
                'is_blurry': pipeline_result.get('is_blurry', False),

                'predicted_class': pipeline_result.get('predicted_class'),
                'confidence': pipeline_result.get('confidence'),
                'passed_confidence_check': pipeline_result.get('passed_confidence_check', False),

                'stamp_detected': pipeline_result.get('stamp_detected', False),
                'stamp_score': pipeline_result.get('stamp_score', 0.0),
                'forgery_score': pipeline_result.get('forgery_score', 0.0),

                'extracted_text': pipeline_result.get('extracted_text'),
                'ocr_confidence': pipeline_result.get('ocr_confidence'),
                'household_name': pipeline_result.get('household_name'),
                'household_address': pipeline_result.get('household_address'),
                'household_id_number': pipeline_result.get('household_id_number'),
                'province': pipeline_result.get('province'),

                'processing_time_ms': pipeline_result.get('processing_time_ms', 0),
                'message': pipeline_result.get('message', ''),
                'need_retry': pipeline_result.get('need_retry', True),

                'user_latitude': latitude,
                'user_longitude': longitude,
                'user_location_address': address,

                'support_categories': support_categories if support_categories else None,
            }

            if pipeline_result['status'] == 'success':
                db_data['verified_at'] = datetime.utcnow().isoformat()

            db_record = _safe_insert(db_data)
            request_id = db_record.get('id') if db_record else None

            # FIX: Invalidate cache history khi có verify mới
            _invalidate_user_history_cache(user_id)
            cache.delete('verified_locations')
            logger.info(f"Cache invalidated for user {user_id}")

            create_audit_log(user_id, 'verify_image', 'verification_requests', request_id, {
                'verification_code': verification_code,
                'result_type': pipeline_result.get('result_type'),
                'confidence': pipeline_result.get('confidence'),
                'processing_time_ms': pipeline_result.get('processing_time_ms'),
                'support_categories': support_categories,
                'local_filename': temp_filename,
            })

        if ENABLE_STORAGE_UPLOAD and request_id:
            _upload_image_async(
                temp_path=temp_path,
                user_id=user_id or 'anonymous',
                filename=temp_filename,
                content_type=image_file.content_type or 'image/jpeg',
                request_id=request_id,
            )
            logger.info(f"Storage upload scheduled in background for request #{request_id}")
        else:
            logger.info("Storage upload disabled or no request_id, using local file only")

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
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return Response({
            'success': False, 'status': 'error',
            'message': f'Loi he thong: {str(e)}',
            'need_retry': True, 'data': {}
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _safe_insert(db_data: dict) -> dict:
    try:
        return create_verification_request(db_data)
    except Exception as e1:
        logger.warning(f"Full insert failed: {e1}, trying without optional cols")
        optional_cols = [
            'forgery_score', 'stamp_detected', 'stamp_score', 'is_blurry',
            'passed_confidence_check', 'ocr_confidence', 'province',
            'image_storage_path', 'verified_at',
            'expires_at', 'support_categories',
        ]
        reduced = {k: v for k, v in db_data.items() if k not in optional_cols}
        try:
            return create_verification_request(reduced)
        except Exception as e2:
            logger.error(f"Reduced insert failed: {e2}")
            minimal = {
                'user_id': db_data.get('user_id'),
                'image_path': db_data.get('image_path', ''),
                'original_filename': db_data.get('original_filename', ''),
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
# GET /api/verified-locations/ — CÓ CACHE
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_verified_locations(request):
    # FIX: Cache 60s
    cache_key = 'verified_locations'
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug("verified_locations: cache HIT")
        return Response(cached)

    try:
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
        response_data = {'data': result.data or [], 'count': len(result.data or [])}
        cache.set(cache_key, response_data, CACHE_LOCATIONS_TTL)
        return Response(response_data)
    except Exception as e:
        logger.error(f"get_verified_locations error: {e}")
        try:
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
            response_data = {'data': result.data or [], 'count': len(result.data or [])}
            cache.set(cache_key, response_data, CACHE_LOCATIONS_TTL)
            return Response(response_data)
        except Exception as e2:
            logger.error(f"get_verified_locations fallback error: {e2}")
            # Trả cache cũ nếu có (stale-while-error)
            stale = cache.get(cache_key + ':stale')
            if stale:
                logger.info("Returning stale cache for verified_locations")
                return Response(stale)
            return Response({'data': [], 'count': 0})


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
# GET /api/history/ — CÓ CACHE 60s
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def get_history(request):
    """
    Lịch sử user — cache 60s để tránh query Supabase mỗi lần.
    Khi user verify mới, cache tự động invalidate (xem verify_image).
    """
    if request.user and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        user_id = request.query_params.get('user_id')

    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)

    limit = int(request.query_params.get('limit', 30))
    cache_key = _cache_key_history(user_id, limit)

    # Try cache first
    cached = cache.get(cache_key)
    if cached is not None:
        logger.info(f"history cache HIT for user {user_id[:8]}... (limit={limit})")
        return Response(cached)

    logger.info(f"history cache MISS for user {user_id[:8]}... fetching from Supabase")

    # Fetch fresh data
    try:
        history = get_user_verification_history(user_id, limit=limit)
        response_data = {'data': history, 'count': len(history), '_cached': False}
        # Cache 60s
        cache.set(cache_key, response_data, CACHE_HISTORY_TTL)
        # Backup stale cache (giữ lâu hơn để dùng khi mạng fail)
        cache.set(cache_key + ':stale', response_data, CACHE_HISTORY_TTL * 10)
        return Response(response_data)
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        # Fallback: trả stale cache nếu có
        stale = cache.get(cache_key + ':stale')
        if stale:
            logger.info(f"Returning STALE cache for user {user_id[:8]}...")
            stale['_stale'] = True
            return Response(stale)
        # Không có cache nào → trả empty + báo cho frontend biết
        return Response({
            'data': [],
            'count': 0,
            '_error': 'Không thể tải dữ liệu, mạng có thể chậm'
        }, status=status.HTTP_200_OK)  # 200 để frontend không treat như fatal error


# ============================================================================
# ADMIN ENDPOINTS — CÓ CACHE
# ============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def admin_dashboard(request):
    cache_key = 'admin_dashboard'
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    dashboard = get_admin_dashboard()
    errors = get_error_distribution()
    response_data = {'dashboard': dashboard, 'error_distribution': errors}
    cache.set(cache_key, response_data, CACHE_DASHBOARD_TTL)
    cache.set(cache_key + ':stale', response_data, CACHE_DASHBOARD_TTL * 10)
    return Response(response_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_requests(request):
    filter_status = request.query_params.get('status')
    limit = int(request.query_params.get('limit', 50))
    cache_key = f"admin_requests:{filter_status or 'all'}:{limit}"

    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    requests_list = get_all_verification_requests(status=filter_status, limit=limit)
    response_data = {'data': requests_list, 'count': len(requests_list)}
    cache.set(cache_key, response_data, CACHE_REQUESTS_TTL)
    cache.set(cache_key + ':stale', response_data, CACHE_REQUESTS_TTL * 10)
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_review(request):
    request_id = request.data.get('request_id')
    admin_id = request.data.get('admin_id')
    notes = request.data.get('notes', '')
    action = request.data.get('action', '').lower()

    if not request_id:
        return Response({'error': 'Thieu request_id'}, status=status.HTTP_400_BAD_REQUEST)

    new_status = None
    if action == 'approve':
        new_status = 'success'
    elif action == 'reject':
        new_status = 'failed'
    elif not action and notes:
        notes_lower = notes.lower()
        if 'phê duyệt' in notes_lower or 'duyệt' in notes_lower or 'approve' in notes_lower:
            new_status = 'success'
        elif 'từ chối' in notes_lower or 'reject' in notes_lower:
            new_status = 'failed'

    safe_admin_id = admin_id if _is_valid_uuid(admin_id) else None
    if admin_id and not safe_admin_id:
        logger.info(f"admin_id '{admin_id}' không phải UUID, vẫn cập nhật notes/status")

    result = admin_review_request(int(request_id), safe_admin_id, notes, new_status=new_status)

    # Invalidate cache khi review
    cache.delete('admin_dashboard')
    for s in [None, 'pending', 'review', 'success', 'failed']:
        for limit in [20, 50, 100]:
            cache.delete(f"admin_requests:{s or 'all'}:{limit}")

    create_audit_log(safe_admin_id, 'admin_review', 'verification_requests', request_id, {
        'notes': notes,
        'action': action,
        'new_status': new_status,
    })

    return Response({
        'success': True,
        'data': result,
        'new_status': new_status,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_users(request):
    cache_key = 'admin_users'
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    users = get_all_users()
    response_data = {'data': users, 'count': len(users)}
    cache.set(cache_key, response_data, 60)
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_toggle_user(request):
    user_id = request.data.get('user_id')
    is_active = request.data.get('is_active', True)
    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)
    result = toggle_user_status(user_id, is_active)
    cache.delete('admin_users')

    admin_id = None
    if request.user and request.user.is_authenticated:
        admin_id = str(request.user.id) if _is_valid_uuid(str(request.user.id)) else None

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
        'storage_upload_enabled': ENABLE_STORAGE_UPLOAD,
        'cache_ttl': {
            'history': CACHE_HISTORY_TTL,
            'dashboard': CACHE_DASHBOARD_TTL,
            'locations': CACHE_LOCATIONS_TTL,
        },
    })
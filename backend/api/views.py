"""
API Views
Phu luc A.2 + JWT Auth (Section 2.1.2)
"""
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
# AUTH ENDPOINTS (Section 2.1.2: JWT Authentication)
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    """
    POST /api/auth/login/
    Dang nhap bang email + password -> tra ve JWT tokens
    Khop voi Section 2.1.2: JWT tokens voi expiration time
    """
    email = request.data.get('email', '')
    password = request.data.get('password', '')

    if not email or not password:
        return Response(
            {'detail': 'Vui long nhap email va mat khau'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Tim user trong Django auth (hoac Supabase)
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

    # Tao JWT tokens
    refresh = RefreshToken.for_user(user)

    create_audit_log(str(user.id), 'login', 'users', str(user.id))

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
    """
    POST /api/auth/register/
    UC01: Dang ky tai khoan moi
    Fields: full_name, email, phone, password
    """
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

    # Tao Django user
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=full_name.split(' ')[0] if full_name else '',
        last_name=' '.join(full_name.split(' ')[1:]) if full_name and len(full_name.split(' ')) > 1 else '',
    )

    create_audit_log(str(user.id), 'register', 'users', str(user.id))

    return Response({
        'message': 'Dang ky thanh cong! Vui long dang nhap.',
        'user_id': str(user.id),
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    """
    GET /api/auth/me/
    Lay thong tin user hien tai (can JWT token)
    """
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
# POST /api/verify/ — UC03
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def verify_image(request):
    """
    POST /api/verify/
    Nhan anh, chay pipeline AI 7 buoc, luu ket qua.
    Cho phep AllowAny de user chua dang nhap van xac minh duoc.
    Neu co JWT token -> lay user_id tu token.
    """
    serializer = VerifyImageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False, 'status': 'error',
            'message': 'Du lieu khong hop le', 'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    image_file = serializer.validated_data['image']

    # Lay user_id: uu tien tu JWT token, fallback tu form data
    user_id = None
    if request.user and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        user_id = serializer.validated_data.get('user_id')

    latitude = serializer.validated_data.get('latitude')
    longitude = serializer.validated_data.get('longitude')
    address = serializer.validated_data.get('address', '')

    try:
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
            f"class={pipeline_result['predicted_class']}, "
            f"conf={pipeline_result['confidence'] or 0:.3f}, "
            f"time={pipeline_result['processing_time_ms']}ms"
        )

        # Luu vao Supabase neu co user_id
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
                'stamp_detected': pipeline_result.get('stamp_detected', False),
                'stamp_score': pipeline_result.get('stamp_score', 0.0),
                'forgery_score': pipeline_result.get('forgery_score', 0.0),
            }
            if pipeline_result['status'] == 'success':
                db_data['verified_at'] = datetime.utcnow().isoformat()

            try:
                storage_path = upload_image_to_storage(user_id, temp_path, temp_filename)
                if storage_path:
                    db_data['image_storage_path'] = storage_path
            except Exception as e:
                logger.warning(f"Storage upload skipped: {e}")

            db_record = create_verification_request(db_data)
            request_id = db_record.get('id')

            create_audit_log(user_id, 'verify_image', 'verification_requests', request_id, {
                'verification_code': verification_code,
                'result_type': pipeline_result['result_type'],
                'confidence': pipeline_result['confidence'],
                'processing_time_ms': pipeline_result['processing_time_ms'],
            })

        if os.path.exists(temp_path):
            os.remove(temp_path)

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
        })

    except Exception as e:
        logger.exception(f"Verify error: {e}")
        if user_id:
            try:
                create_audit_log(user_id, 'verify_image_error', 'verification_requests', details={'error': str(e)})
            except Exception:
                pass
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
    # Uu tien user_id tu JWT token
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
@permission_classes([AllowAny])  # Doi thanh IsAuthenticated khi deploy
def admin_dashboard(request):
    """UC08: Admin dashboard"""
    dashboard = get_admin_dashboard()
    errors = get_error_distribution()
    return Response({'dashboard': dashboard, 'error_distribution': errors})


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_requests(request):
    """UC07: Admin xem yeu cau"""
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


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_users(request):
    """UC06: Quan ly nguoi dung — lay danh sach tu Supabase"""
    users = get_all_users()
    return Response({'data': users, 'count': len(users)})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_toggle_user(request):
    """UC06: Khoa/mo khoa tai khoan"""
    user_id = request.data.get('user_id')
    is_active = request.data.get('is_active', True)
    if not user_id:
        return Response({'error': 'Thieu user_id'}, status=status.HTTP_400_BAD_REQUEST)
    result = toggle_user_status(user_id, is_active)

    # Ghi audit log
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
        'jwt_auth': True,
    })
import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .admin_auth_service import (
    login_admin,
    verify_admin_token,
    logout_admin,
)

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Lấy IP của client"""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def get_token_from_request(request):
    """Lấy token từ Authorization header"""
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


# ============================================================
# POST /api/admin/login/
# ============================================================
@csrf_exempt
@require_http_methods(['POST'])
def admin_login(request):
    """
    Body: { email: str, password: str }
    Returns: { success, admin?, token?, expires_at?, error? }
    """
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return JsonResponse({
                'success': False,
                'error': 'Vui lòng nhập đầy đủ email và mật khẩu'
            }, status=400)

        ip = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:200]

        result = login_admin(email, password, ip_address=ip, user_agent=user_agent)

        if result['success']:
            return JsonResponse(result, status=200)
        else:
            return JsonResponse(result, status=401)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON không hợp lệ'}, status=400)
    except Exception as e:
        logger.exception(f"admin_login error: {e}")
        return JsonResponse({'success': False, 'error': 'Lỗi hệ thống'}, status=500)


# ============================================================
# POST /api/admin/logout/
# ============================================================
@csrf_exempt
@require_http_methods(['POST'])
def admin_logout(request):
    """
    Header: Authorization: Bearer <token>
    """
    token = get_token_from_request(request)
    if not token:
        return JsonResponse({'success': False, 'error': 'Thiếu token'}, status=401)

    logout_admin(token)
    return JsonResponse({'success': True})


# ============================================================
# GET /api/admin/verify/
# ============================================================
@csrf_exempt
@require_http_methods(['GET'])
def admin_verify_token(request):
    """
    Header: Authorization: Bearer <token>
    Returns: { valid, admin? }
    """
    token = get_token_from_request(request)
    if not token:
        return JsonResponse({'valid': False}, status=401)

    admin = verify_admin_token(token)
    if admin:
        return JsonResponse({'valid': True, 'admin': admin}, status=200)
    else:
        return JsonResponse({'valid': False}, status=401)


# ============================================================
# Decorator bảo vệ admin endpoints
# ============================================================
def require_admin(view_func):
    """
    Decorator: chỉ admin đăng nhập mới được vào view
    Usage:
        @require_admin
        def my_admin_view(request):
            admin = request.admin  # ← admin info được attach vào request
            ...
    """
    def wrapper(request, *args, **kwargs):
        token = get_token_from_request(request)
        if not token:
            return JsonResponse({'error': 'Chưa đăng nhập'}, status=401)

        admin = verify_admin_token(token)
        if not admin:
            return JsonResponse({'error': 'Token không hợp lệ'}, status=401)

        request.admin = admin  # attach admin vào request
        return view_func(request, *args, **kwargs)

    return wrapper


def require_super_admin(view_func):
    """Chỉ super_admin mới được vào"""
    def wrapper(request, *args, **kwargs):
        token = get_token_from_request(request)
        if not token:
            return JsonResponse({'error': 'Chưa đăng nhập'}, status=401)

        admin = verify_admin_token(token)
        if not admin:
            return JsonResponse({'error': 'Token không hợp lệ'}, status=401)

        if admin['role'] != 'super_admin':
            return JsonResponse({'error': 'Cần quyền super_admin'}, status=403)

        request.admin = admin
        return view_func(request, *args, **kwargs)

    return wrapper
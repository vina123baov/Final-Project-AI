"""
Admin Authentication Service
Tách biệt hoàn toàn với Supabase Auth của user thường

Đặt file này tại: backend/api/admin_auth_service.py
"""

import os
import bcrypt
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# ============================================================
# Supabase client với SERVICE KEY (bypass RLS)
# ============================================================
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://pshspnvomfkxhrymetyf.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

_supabase_admin: Optional[Client] = None

def get_admin_supabase() -> Client:
    """Lazy init Supabase client với service key"""
    global _supabase_admin
    if _supabase_admin is None:
        if not SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_SERVICE_KEY chưa được cấu hình trong .env")
        _supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_admin


# ============================================================
# Password hashing
# ============================================================
def verify_password(plain_password: str, password_hash: str) -> bool:
    """So sánh password với hash bcrypt"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            password_hash.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verify error: {e}")
        return False


def hash_password(password: str) -> str:
    """Hash password với bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


# ============================================================
# Admin login
# ============================================================
def login_admin(email: str, password: str, ip_address: str = None, user_agent: str = None) -> Dict[str, Any]:
    """
    Đăng nhập admin
    Returns: { success, admin?, token?, error? }
    """
    try:
        supabase = get_admin_supabase()

        # 1. Tìm admin theo email
        result = supabase.table('admins').select('*').eq('email', email.lower()).execute()

        if not result.data:
            logger.warning(f"Login failed: email không tồn tại - {email}")
            return {'success': False, 'error': 'Email hoặc mật khẩu không đúng'}

        admin = result.data[0]

        # 2. Kiểm tra is_active
        if not admin.get('is_active'):
            logger.warning(f"Login failed: admin bị khóa - {email}")
            return {'success': False, 'error': 'Tài khoản đã bị vô hiệu hóa'}

        # 3. Verify password
        if not verify_password(password, admin['password_hash']):
            logger.warning(f"Login failed: sai password - {email}")
            return {'success': False, 'error': 'Email hoặc mật khẩu không đúng'}

        # 4. Tạo session token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        supabase.table('admin_sessions').insert({
            'admin_id': admin['id'],
            'token': token,
            'expires_at': expires_at.isoformat(),
            'ip_address': ip_address,
            'user_agent': user_agent,
        }).execute()

        # 5. Update last_login_at
        supabase.table('admins').update({
            'last_login_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', admin['id']).execute()

        # 6. Audit log
        supabase.table('admin_audit_logs').insert({
            'admin_id': admin['id'],
            'admin_email': admin['email'],
            'action': 'LOGIN',
            'ip_address': ip_address,
            'details': {'user_agent': user_agent},
        }).execute()

        logger.info(f"✅ Admin login: {email}")

        # KHÔNG trả password_hash về frontend
        admin_safe = {
            'id': admin['id'],
            'email': admin['email'],
            'full_name': admin['full_name'],
            'role': admin['role'],
        }

        return {
            'success': True,
            'admin': admin_safe,
            'token': token,
            'expires_at': expires_at.isoformat(),
        }

    except Exception as e:
        logger.exception(f"Login admin error: {e}")
        return {'success': False, 'error': 'Lỗi hệ thống'}


# ============================================================
# Verify admin token
# ============================================================
def verify_admin_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify admin session token
    Returns: admin dict nếu hợp lệ, None nếu không
    """
    if not token:
        return None

    try:
        supabase = get_admin_supabase()

        # Tìm session theo token
        session_result = supabase.table('admin_sessions').select(
            '*, admins(*)'
        ).eq('token', token).execute()

        if not session_result.data:
            return None

        session = session_result.data[0]

        # Check expired
        expires_at = datetime.fromisoformat(session['expires_at'].replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            logger.info(f"Token expired: {token[:10]}...")
            # Xóa session hết hạn
            supabase.table('admin_sessions').delete().eq('token', token).execute()
            return None

        admin = session.get('admins')
        if not admin or not admin.get('is_active'):
            return None

        return {
            'id': admin['id'],
            'email': admin['email'],
            'full_name': admin['full_name'],
            'role': admin['role'],
        }

    except Exception as e:
        logger.exception(f"Verify token error: {e}")
        return None


# ============================================================
# Logout
# ============================================================
def logout_admin(token: str) -> bool:
    """Xóa session token"""
    try:
        supabase = get_admin_supabase()

        # Lấy admin info trước khi xóa (để log)
        admin = verify_admin_token(token)

        # Xóa session
        supabase.table('admin_sessions').delete().eq('token', token).execute()

        # Audit log
        if admin:
            supabase.table('admin_audit_logs').insert({
                'admin_id': admin['id'],
                'admin_email': admin['email'],
                'action': 'LOGOUT',
            }).execute()

        return True
    except Exception as e:
        logger.exception(f"Logout error: {e}")
        return False
"""
Supabase Service Layer
Ket noi voi Supabase database thay vi Django ORM.
Khop voi: supabase_migration_v2.sql (Bang 2.2, 2.3, ERD Hinh 2.3)
"""
import os
import logging
from typing import Optional
from supabase import create_client, Client
from django.conf import settings

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Tao Supabase client voi service_role key (bypass RLS)"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )


def get_supabase_anon_client() -> Client:
    """Tao Supabase client voi anon key (co RLS)"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY
    )


# ============================================================================
# VERIFICATION REQUESTS (Bang 2.3 + ERD Hinh 2.3)
# ============================================================================

def create_verification_request(data: dict) -> dict:
    """
    Tao moi verification request.
    UC03: Upload anh xac minh
    """
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').insert(data).execute()
    return result.data[0] if result.data else {}


def update_verification_request(request_id: int, data: dict) -> dict:
    """
    Cap nhat verification request sau khi AI pipeline xu ly xong.
    Duoc goi boi pipeline sau khi chay Blur + Classification + OCR
    """
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').update(data).eq('id', request_id).execute()
    return result.data[0] if result.data else {}


def get_verification_request(request_id: int) -> Optional[dict]:
    """Lay 1 verification request theo id"""
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').select('*').eq('id', request_id).execute()
    return result.data[0] if result.data else None


def get_user_verification_history(user_id: str, limit: int = 50) -> list:
    """
    Lay lich su xac minh cua user.
    UC05: Xem lich su
    Dung view v_user_history
    """
    supabase = get_supabase_client()
    result = (
        supabase.table('v_user_history')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ============================================================================
# USERS (Bang 2.2)
# ============================================================================

def get_user_profile(user_id: str) -> Optional[dict]:
    """Lay profile user"""
    supabase = get_supabase_client()
    result = supabase.table('users').select('*').eq('id', user_id).execute()
    return result.data[0] if result.data else None


def update_user_profile(user_id: str, data: dict) -> dict:
    """Cap nhat profile user"""
    supabase = get_supabase_client()
    result = supabase.table('users').update(data).eq('id', user_id).execute()
    return result.data[0] if result.data else {}


# ============================================================================
# SYSTEM CONFIGS
# ============================================================================

def get_system_config(key: str) -> Optional[str]:
    """
    Lay gia tri config tu bang system_configs.
    Vi du: get_system_config('blur_threshold') -> '100'
    """
    supabase = get_supabase_client()
    result = supabase.table('system_configs').select('config_value').eq('config_key', key).execute()
    return result.data[0]['config_value'] if result.data else None


def get_all_configs() -> dict:
    """Lay tat ca system configs thanh dict"""
    supabase = get_supabase_client()
    result = supabase.table('system_configs').select('config_key, config_value').execute()
    return {row['config_key']: row['config_value'] for row in (result.data or [])}


# ============================================================================
# ADMIN (UC06, UC07, UC08)
# ============================================================================

def get_admin_dashboard() -> dict:
    """
    UC08: Xem thong ke
    Dung view v_admin_dashboard
    """
    supabase = get_supabase_client()
    result = supabase.table('v_admin_dashboard').select('*').execute()
    return result.data[0] if result.data else {}


def get_error_distribution() -> list:
    """
    UC08: Phan bo loi
    Dung view v_error_distribution
    """
    supabase = get_supabase_client()
    result = supabase.table('v_error_distribution').select('*').execute()
    return result.data or []


def get_all_verification_requests(status: Optional[str] = None, limit: int = 100) -> list:
    """
    UC07: Admin xem tat ca yeu cau xac minh
    """
    supabase = get_supabase_client()
    query = supabase.table('verification_requests').select('*').order('created_at', desc=True).limit(limit)
    if status:
        query = query.eq('status', status)
    result = query.execute()
    return result.data or []


def admin_review_request(request_id: int, admin_id: str, notes: str) -> dict:
    """
    UC07: Admin duyet yeu cau
    """
    from datetime import datetime
    return update_verification_request(request_id, {
        'reviewed_by': admin_id,
        'reviewed_at': datetime.utcnow().isoformat(),
        'admin_notes': notes,
    })


# ============================================================================
# AUDIT LOGS (YC 2.1.2: Bao mat)
# ============================================================================

def create_audit_log(user_id: Optional[str], action: str, entity_type: str = None,
                     entity_id: str = None, details: dict = None):
    """Ghi audit log"""
    try:
        supabase = get_supabase_client()
        supabase.table('audit_logs').insert({
            'user_id': user_id,
            'action': action,
            'entity_type': entity_type,
            'entity_id': str(entity_id) if entity_id else None,
            'details': details,
        }).execute()
    except Exception as e:
        logger.error(f"Audit log error: {e}")


# ============================================================================
# STORAGE (Supabase Storage - bucket verification-images)
# ============================================================================

def upload_image_to_storage(user_id: str, file_path: str, file_name: str) -> Optional[str]:
    """
    Upload anh len Supabase Storage bucket 'verification-images'
    Hinh 4.2: JPG, PNG, BMP, max 5MB
    Returns: storage path hoac None neu loi
    """
    try:
        supabase = get_supabase_client()
        storage_path = f"{user_id}/{file_name}"

        with open(file_path, 'rb') as f:
            supabase.storage.from_('verification-images').upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "image/jpeg"}
            )

        return storage_path
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        return None


def delete_image_from_storage(storage_path: str):
    """Xoa anh sau khi xu ly (YC 2.1.2: khong luu tru anh nhay cam)"""
    try:
        supabase = get_supabase_client()
        supabase.storage.from_('verification-images').remove([storage_path])
    except Exception as e:
        logger.error(f"Storage delete error: {e}")

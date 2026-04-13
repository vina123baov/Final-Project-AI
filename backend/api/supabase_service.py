"""
Supabase Service Layer
Ket noi voi Supabase database.
Khop voi: ERD Hinh 2.3
"""
import os
import logging
from typing import Optional
from supabase import create_client, Client
from django.conf import settings

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_anon_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


# ============================================================================
# VERIFICATION REQUESTS (Bang 2.3)
# ============================================================================

def create_verification_request(data: dict) -> dict:
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').insert(data).execute()
    return result.data[0] if result.data else {}


def update_verification_request(request_id: int, data: dict) -> dict:
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').update(data).eq('id', request_id).execute()
    return result.data[0] if result.data else {}


def get_verification_request(request_id: int) -> Optional[dict]:
    supabase = get_supabase_client()
    result = supabase.table('verification_requests').select('*').eq('id', request_id).execute()
    return result.data[0] if result.data else None


def get_user_verification_history(user_id: str, limit: int = 50) -> list:
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
# USERS (Bang 2.2 + UC06)
# ============================================================================

def get_user_profile(user_id: str) -> Optional[dict]:
    supabase = get_supabase_client()
    result = supabase.table('users').select('*').eq('id', user_id).execute()
    return result.data[0] if result.data else None


def update_user_profile(user_id: str, data: dict) -> dict:
    supabase = get_supabase_client()
    result = supabase.table('users').update(data).eq('id', user_id).execute()
    return result.data[0] if result.data else {}


def get_all_users() -> list:
    """UC06: Lay danh sach tat ca users voi so lan xac minh"""
    supabase = get_supabase_client()
    try:
        # Thu dung view v_admin_users neu co
        result = supabase.table('v_admin_users').select('*').execute()
        if result.data:
            return result.data
    except Exception:
        pass

    # Fallback: lay tu bang users
    try:
        result = supabase.table('users').select('*').order('created_at', desc=True).execute()
        users = result.data or []

        # Dem so lan xac minh cho moi user
        for user in users:
            try:
                count_result = (
                    supabase.table('verification_requests')
                    .select('id', count='exact')
                    .eq('user_id', user['id'])
                    .execute()
                )
                user['verification_count'] = count_result.count or 0
            except Exception:
                user['verification_count'] = 0

        return users
    except Exception as e:
        logger.error(f"get_all_users error: {e}")
        return []


def toggle_user_status(user_id: str, is_active: bool) -> dict:
    """UC06: Khoa/mo khoa tai khoan"""
    supabase = get_supabase_client()
    try:
        result = supabase.table('users').update({
            'is_active': is_active
        }).eq('id', user_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"toggle_user_status error: {e}")
        return {'error': str(e)}


# ============================================================================
# SYSTEM CONFIGS
# ============================================================================

def get_system_config(key: str) -> Optional[str]:
    supabase = get_supabase_client()
    result = supabase.table('system_configs').select('config_value').eq('config_key', key).execute()
    return result.data[0]['config_value'] if result.data else None


def get_all_configs() -> dict:
    supabase = get_supabase_client()
    result = supabase.table('system_configs').select('config_key, config_value').execute()
    return {row['config_key']: row['config_value'] for row in (result.data or [])}


# ============================================================================
# ADMIN (UC07, UC08)
# ============================================================================

def get_admin_dashboard() -> dict:
    supabase = get_supabase_client()
    result = supabase.table('v_admin_dashboard').select('*').execute()
    return result.data[0] if result.data else {}


def get_error_distribution() -> list:
    supabase = get_supabase_client()
    result = supabase.table('v_error_distribution').select('*').execute()
    return result.data or []


def get_all_verification_requests(status: Optional[str] = None, limit: int = 100) -> list:
    supabase = get_supabase_client()
    query = supabase.table('verification_requests').select('*').order('created_at', desc=True).limit(limit)
    if status:
        query = query.eq('status', status)
    result = query.execute()
    return result.data or []


def admin_review_request(request_id: int, admin_id: str, notes: str) -> dict:
    from datetime import datetime
    return update_verification_request(request_id, {
        'reviewed_by': admin_id,
        'reviewed_at': datetime.utcnow().isoformat(),
        'admin_notes': notes,
    })


# ============================================================================
# AUDIT LOGS
# ============================================================================

def create_audit_log(user_id: Optional[str], action: str, entity_type: str = None,
                     entity_id=None, details: dict = None):
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
# STORAGE
# ============================================================================

def upload_image_to_storage(user_id: str, file_path: str, file_name: str) -> Optional[str]:
    try:
        supabase = get_supabase_client()
        storage_path = f"{user_id}/{file_name}"
        with open(file_path, 'rb') as f:
            supabase.storage.from_('verification-images').upload(
                path=storage_path, file=f,
                file_options={"content-type": "image/jpeg"}
            )
        return storage_path
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        return None


def delete_image_from_storage(storage_path: str):
    try:
        supabase = get_supabase_client()
        supabase.storage.from_('verification-images').remove([storage_path])
    except Exception as e:
        logger.error(f"Storage delete error: {e}")
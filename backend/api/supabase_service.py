import os
import logging
from typing import Optional
from supabase import create_client, Client
from django.conf import settings
import httpx

logger = logging.getLogger(__name__)

# ============================================================================
# Supabase client với timeout 5 giây — tránh treo request
# ============================================================================

_service_client: Optional[Client] = None
_anon_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Service role client — dùng cho backend (có full quyền)"""
    global _service_client
    if _service_client is None:
        _service_client = _create_client(settings.SUPABASE_SERVICE_ROLE_KEY)
    return _service_client


def get_supabase_anon_client() -> Client:
    """Anon client — dùng cho public queries"""
    global _anon_client
    if _anon_client is None:
        _anon_client = _create_client(settings.SUPABASE_ANON_KEY)
    return _anon_client


def _create_client(key: str) -> Client:
    """Tạo Supabase client với timeout 5s"""
    client = create_client(settings.SUPABASE_URL, key)
    # Set timeout 5 giây cho tất cả requests
    client.postgrest.session.timeout = 8.0
    return client


def _reset_clients():
    """Reset clients khi bị timeout — tạo lại connection mới"""
    global _service_client, _anon_client
    _service_client = None
    _anon_client = None


def _safe_execute(query_fn, fallback=None):
    """
    Wrapper chạy Supabase query an toàn.
    Nếu timeout/lỗi mạng → reset client và trả về fallback thay vì crash.
    """
    try:
        return query_fn()
    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.RemoteProtocolError) as e:
        logger.warning(f"Supabase connection issue: {e} — resetting client")
        _reset_clients()
        return fallback
    except Exception as e:
        logger.error(f"Supabase error: {e}")
        return fallback


# ============================================================================
# VERIFICATION REQUESTS (Bảng 2.3)
# ============================================================================

def create_verification_request(data: dict) -> dict:
    def _run():
        result = get_supabase_client().table('verification_requests').insert(data).execute()
        return result.data[0] if result.data else {}
    return _safe_execute(_run, fallback={})


def update_verification_request(request_id: int, data: dict) -> dict:
    def _run():
        result = get_supabase_client().table('verification_requests').update(data).eq('id', request_id).execute()
        return result.data[0] if result.data else {}
    return _safe_execute(_run, fallback={})


def get_verification_request(request_id: int) -> Optional[dict]:
    def _run():
        result = get_supabase_client().table('verification_requests').select('*').eq('id', request_id).execute()
        return result.data[0] if result.data else None
    return _safe_execute(_run, fallback=None)


def get_user_verification_history(user_id: str, limit: int = 50) -> list:
    def _run():
        result = (
            get_supabase_client().table('v_user_history')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    return _safe_execute(_run, fallback=[])


# ============================================================================
# USERS
# ============================================================================

def get_user_profile(user_id: str) -> Optional[dict]:
    def _run():
        result = get_supabase_client().table('users').select('*').eq('id', user_id).execute()
        return result.data[0] if result.data else None
    return _safe_execute(_run, fallback=None)


def update_user_profile(user_id: str, data: dict) -> dict:
    def _run():
        result = get_supabase_client().table('users').update(data).eq('id', user_id).execute()
        return result.data[0] if result.data else {}
    return _safe_execute(_run, fallback={})


def get_all_users() -> list:
    def _run():
        try:
            result = get_supabase_client().table('v_admin_users').select('*').execute()
            if result.data:
                return result.data
        except Exception:
            pass

        result = get_supabase_client().table('users').select('*').order('created_at', desc=True).execute()
        users = result.data or []

        for user in users:
            try:
                count_result = (
                    get_supabase_client().table('verification_requests')
                    .select('id', count='exact')
                    .eq('user_id', user['id'])
                    .execute()
                )
                user['verification_count'] = count_result.count or 0
            except Exception:
                user['verification_count'] = 0

        return users

    return _safe_execute(_run, fallback=[])


def toggle_user_status(user_id: str, is_active: bool) -> dict:
    def _run():
        result = get_supabase_client().table('users').update({'is_active': is_active}).eq('id', user_id).execute()
        return result.data[0] if result.data else {}
    return _safe_execute(_run, fallback={})


# ============================================================================
# SYSTEM CONFIGS
# ============================================================================

def get_system_config(key: str) -> Optional[str]:
    def _run():
        result = get_supabase_client().table('system_configs').select('config_value').eq('config_key', key).execute()
        return result.data[0]['config_value'] if result.data else None
    return _safe_execute(_run, fallback=None)


def get_all_configs() -> dict:
    def _run():
        result = get_supabase_client().table('system_configs').select('config_key, config_value').execute()
        return {row['config_key']: row['config_value'] for row in (result.data or [])}
    return _safe_execute(_run, fallback={})


# ============================================================================
# ADMIN (UC07, UC08)
# ============================================================================

def get_admin_dashboard() -> dict:
    def _run():
        result = get_supabase_client().table('v_admin_dashboard').select('*').execute()
        return result.data[0] if result.data else {}
    return _safe_execute(_run, fallback={})


def get_error_distribution() -> list:
    def _run():
        result = get_supabase_client().table('v_error_distribution').select('*').execute()
        return result.data or []
    return _safe_execute(_run, fallback=[])


def get_all_verification_requests(status: Optional[str] = None, limit: int = 100) -> list:
    def _run():
        query = (
            get_supabase_client().table('verification_requests')
            .select('*')
            .order('created_at', desc=True)
            .limit(limit)
        )
        if status:
            query = query.eq('status', status)
        result = query.execute()
        return result.data or []
    return _safe_execute(_run, fallback=[])


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
    def _run():
        get_supabase_client().table('audit_logs').insert({
            'user_id': user_id,
            'action': action,
            'entity_type': entity_type,
            'entity_id': str(entity_id) if entity_id else None,
            'details': details,
        }).execute()

    try:
        _safe_execute(_run)
    except Exception as e:
        logger.error(f"Audit log error: {e}")


# ============================================================================
# STORAGE
# ============================================================================

def upload_image_to_storage(user_id: str, file_path: str, file_name: str) -> Optional[str]:
    try:
        storage_path = f"{user_id}/{file_name}"
        with open(file_path, 'rb') as f:
            get_supabase_client().storage.from_('verification-images').upload(
                path=storage_path, file=f,
                file_options={"content-type": "image/jpeg"}
            )
        return storage_path
    except Exception as e:
        logger.error(f"Storage upload error: {e}")
        return None


def delete_image_from_storage(storage_path: str):
    try:
        get_supabase_client().storage.from_('verification-images').remove([storage_path])
    except Exception as e:
        logger.error(f"Storage delete error: {e}")
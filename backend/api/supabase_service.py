import os
import logging
import time
from typing import Optional
from supabase import create_client, Client
from django.conf import settings
import httpx

logger = logging.getLogger(__name__)

# ============================================================================
# Supabase client với timeout 10s + retry 1 lần
# 
# FIX: Trước đây timeout 30s + retry 3 lần = ~90s mới fail khi mạng yếu.
# Giảm xuống 10s + retry 1 = ~20s tối đa, response không bị treo lâu.
# ============================================================================

_service_client: Optional[Client] = None
_anon_client: Optional[Client] = None

SUPABASE_TIMEOUT = 10.0
MAX_RETRIES = 1


def get_supabase_client() -> Client:
    global _service_client
    if _service_client is None:
        _service_client = _create_client(settings.SUPABASE_SERVICE_ROLE_KEY)
    return _service_client


def get_supabase_anon_client() -> Client:
    global _anon_client
    if _anon_client is None:
        _anon_client = _create_client(settings.SUPABASE_ANON_KEY)
    return _anon_client


def _create_client(key: str) -> Client:
    client = create_client(settings.SUPABASE_URL, key)
    try:
        client.postgrest.session.timeout = SUPABASE_TIMEOUT
    except Exception:
        pass
    return client


def _reset_clients():
    global _service_client, _anon_client
    _service_client = None
    _anon_client = None


def _safe_execute(query_fn, fallback=None, retries: int = MAX_RETRIES):
    last_error = None

    for attempt in range(retries + 1):
        try:
            return query_fn()

        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.RemoteProtocolError,
                httpx.ConnectError, httpx.PoolTimeout) as e:
            last_error = e
            logger.warning(
                f"Supabase connection issue (attempt {attempt + 1}/{retries + 1}): {e}"
            )
            _reset_clients()
            if attempt < retries:
                time.sleep(0.5)
                continue

        except Exception as e:
            err_str = str(e).lower()
            if 'timeout' in err_str or 'ssl' in err_str or 'handshake' in err_str or 'connection' in err_str:
                last_error = e
                logger.warning(
                    f"Supabase network/SSL issue (attempt {attempt + 1}/{retries + 1}): {e}"
                )
                _reset_clients()
                if attempt < retries:
                    time.sleep(0.5)
                    continue
            else:
                logger.error(f"Supabase error: {e}")
                return fallback

    logger.error(f"Supabase failed after {retries + 1} attempts: {last_error}")
    return fallback


# ============================================================================
# VERIFICATION REQUESTS
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
    """
    Lấy lịch sử của user.
    
    FIX: Trước đây query view v_user_history (chậm vì JOIN nhiều bảng).
    Giờ ưu tiên query trực tiếp bảng verification_requests (nhanh hơn 3-5x).
    Chỉ select các cột cần thiết để giảm payload.
    """
    def _run():
        # Query trực tiếp bảng verification_requests — nhanh hơn view
        result = (
            get_supabase_client().table('verification_requests')
            .select(
                'id, status, result_type, confidence, blur_score, message, '
                'need_retry, verification_code, created_at, predicted_class, '
                'original_filename, processing_time_ms, household_name, '
                'household_address, support_categories'
            )
            .eq('user_id', user_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        
        items = result.data or []
        # Thêm field result_message để đồng bộ với view cũ (frontend dùng field này)
        for item in items:
            item['result_message'] = item.get('message') or ''
        
        return items

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
# ADMIN
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


def admin_review_request(request_id: int, admin_id: Optional[str], notes: str,
                          new_status: Optional[str] = None) -> dict:
    from datetime import datetime
    import re

    update_data: dict = {
        'reviewed_at': datetime.utcnow().isoformat(),
        'admin_notes': notes,
    }

    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    if admin_id and UUID_PATTERN.match(str(admin_id)):
        update_data['reviewed_by'] = admin_id
    else:
        if admin_id:
            logger.warning(f"admin_id '{admin_id}' không phải UUID hợp lệ, bỏ qua reviewed_by")

    if new_status:
        update_data['status'] = new_status
        if new_status == 'success':
            update_data['verified_at'] = datetime.utcnow().isoformat()

    return update_verification_request(request_id, update_data)


# ============================================================================
# AUDIT LOGS
# ============================================================================

def create_audit_log(user_id: Optional[str], action: str, entity_type: str = None,
                     entity_id=None, details: dict = None):
    import re
    UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    
    safe_user_id = user_id if (user_id and UUID_PATTERN.match(str(user_id))) else None

    def _run():
        get_supabase_client().table('audit_logs').insert({
            'user_id': safe_user_id,
            'action': action,
            'entity_type': entity_type,
            'entity_id': str(entity_id) if entity_id else None,
            'details': details,
        }).execute()

    try:
        _safe_execute(_run, retries=0)
    except Exception as e:
        logger.error(f"Audit log error (non-critical): {e}")


# ============================================================================
# STORAGE
# ============================================================================

def upload_image_to_storage(user_id: str, file_path: str, file_name: str) -> Optional[str]:
    storage_path = f"{user_id}/{file_name}"

    for attempt in range(MAX_RETRIES + 1):
        try:
            with open(file_path, 'rb') as f:
                get_supabase_client().storage.from_('verification-images').upload(
                    path=storage_path, file=f,
                    file_options={"content-type": "image/jpeg", "cache-control": "3600"}
                )
            logger.info(f"Storage upload OK (attempt {attempt + 1}): {storage_path}")
            return storage_path
        except Exception as e:
            err_str = str(e).lower()
            if attempt < MAX_RETRIES and ('timeout' in err_str or 'reset' in err_str or 'ssl' in err_str):
                logger.warning(f"Storage upload retry {attempt + 1}: {e}")
                _reset_clients()
                time.sleep(0.5)
                continue
            logger.error(f"Storage upload failed: {e}")
            return None

    return None


def delete_image_from_storage(storage_path: str):
    try:
        get_supabase_client().storage.from_('verification-images').remove([storage_path])
    except Exception as e:
        logger.error(f"Storage delete error: {e}")
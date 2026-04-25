"""
Script tao admin accounts cho VerifyFamily
==========================================

DAT FILE NAY TAI: backend/create_admin.py

CACH CHAY (Windows + venv):
    cd backend
    venv\\Scripts\\activate
    pip install bcrypt python-dotenv
    python create_admin.py
"""

import os
import sys
import bcrypt
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# ============================================================
# Load .env tu thu muc backend/ (cung thu muc voi file nay)
# ============================================================
BASE_DIR = Path(__file__).resolve().parent  # -> backend/
ENV_PATH = BASE_DIR / '.env'

if not ENV_PATH.exists():
    print(f"[X] Khong tim thay file .env tai: {ENV_PATH}")
    sys.exit(1)

load_dotenv(ENV_PATH)

# ============================================================
# CONFIG - doc tu backend/.env
# Ho tro CA HAI ten bien (SERVICE_KEY hoac SERVICE_ROLE_KEY)
# ============================================================
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://pshspnvomfkxhrymetyf.supabase.co')

# Thu doc theo thu tu uu tien
SUPABASE_SERVICE_KEY = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')   # ten chuan cua Supabase
    or os.getenv('SUPABASE_SERVICE_KEY')     # ten ngan
    or os.getenv('SUPABASE_SECRET_KEY')      # ten cu
)

if not SUPABASE_SERVICE_KEY:
    print("[X] Khong tim thay service key trong backend/.env")
    print()
    print("    Script dang tim cac ten bien sau (theo thu tu):")
    print("      1. SUPABASE_SERVICE_ROLE_KEY  <- ten chuan")
    print("      2. SUPABASE_SERVICE_KEY")
    print("      3. SUPABASE_SECRET_KEY")
    print()
    print("    Trong .env cua ban hien co:")
    for key in os.environ:
        if 'SUPABASE' in key.upper():
            val = os.environ[key]
            preview = val[:20] + '...' if val else '(empty)'
            print(f"      - {key}={preview}")
    sys.exit(1)

# ============================================================
# DANH SACH ADMIN DEMO
# ============================================================
ADMINS_TO_CREATE = [
    {
        'email': 'admin@verifyfamily.vn',
        'password': 'Admin@2026',
        'full_name': 'Quan Tri Vien',
        'role': 'admin',
    },
    {
        'email': 'super@verifyfamily.vn',
        'password': 'Super@2026',
        'full_name': 'Quan Tri Cao Cap',
        'role': 'super_admin',
    },
]


def hash_password(password: str) -> str:
    """Hash password voi bcrypt 12 rounds"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_admin(supabase: Client, admin_data: dict) -> bool:
    """Tao 1 admin trong bang admins"""
    email = admin_data['email']
    print(f"\n[+] Dang tao: {email}")

    try:
        password_hash = hash_password(admin_data['password'])

        # Xoa neu da ton tai (cho phep chay lai script)
        supabase.table('admins').delete().eq('email', email).execute()

        result = supabase.table('admins').insert({
            'email': email,
            'password_hash': password_hash,
            'full_name': admin_data['full_name'],
            'role': admin_data['role'],
            'is_active': True,
        }).execute()

        if result.data:
            print(f"    [OK] Tao thanh cong")
            return True
        else:
            print(f"    [X] Khong co data tra ve: {result}")
            return False

    except Exception as e:
        print(f"    [X] Loi: {e}")
        return False


def check_table_exists(supabase: Client) -> bool:
    """Kiem tra bang admins da ton tai chua"""
    try:
        supabase.table('admins').select('id').limit(1).execute()
        return True
    except Exception as e:
        if 'does not exist' in str(e) or 'PGRST205' in str(e):
            return False
        # Co the bang ton tai nhung chua co data -> van return True
        return True


def main():
    print("=" * 60)
    print("VerifyFamily - Tao Admin Accounts")
    print("=" * 60)
    print(f"Thu muc: {BASE_DIR}")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Service key: {SUPABASE_SERVICE_KEY[:30]}...")
    print()

    # Ket noi
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("[OK] Ket noi Supabase thanh cong")
    except Exception as e:
        print(f"[X] Loi ket noi: {e}")
        sys.exit(1)

    # Kiem tra bang
    if not check_table_exists(supabase):
        print()
        print("[X] Bang 'admins' chua ton tai!")
        print("    Hay chay file SQL '01_create_admin_tables.sql' tren Supabase truoc.")
        print("    Vao: Dashboard -> SQL Editor -> New Query -> paste SQL -> Run")
        sys.exit(1)

    print("[OK] Bang admins da ton tai")

    # Tao tung admin
    success_count = 0
    for admin in ADMINS_TO_CREATE:
        if create_admin(supabase, admin):
            success_count += 1

    # Summary
    print()
    print("=" * 60)
    print(f"Da tao {success_count}/{len(ADMINS_TO_CREATE)} admin")
    print("=" * 60)

    if success_count > 0:
        print()
        print("THONG TIN DANG NHAP:")
        print("-" * 60)
        print("  URL: http://localhost:3000/admin/login")
        print()
        for admin in ADMINS_TO_CREATE:
            role_label = '[SUPER]' if admin['role'] == 'super_admin' else '[ADMIN]'
            print(f"  {role_label} {admin['email']}")
            print(f"          Password: {admin['password']}")
            print(f"          Role: {admin['role']}")
            print()
        print("[!] Doi password ngay sau khi dang nhap lan dau!")
        print("=" * 60)


if __name__ == '__main__':
    main()
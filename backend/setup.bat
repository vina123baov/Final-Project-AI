@echo off
chcp 65001 >nul
title Backend Setup - He Thong Xac Minh So Ho Ngheo

echo ============================================================
echo   SETUP BACKEND - Windows
echo   He thong xac minh hoan canh kho khan su dung AI
echo ============================================================
echo.

:: -----------------------------------------------------------
:: BUOC 1: Kiem tra Python
:: -----------------------------------------------------------
echo [1/7] Kiem tra Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python!
    echo Tai Python 3.10+ tai: https://www.python.org/downloads/
    echo Nho tich "Add Python to PATH" khi cai dat.
    pause
    exit /b 1
)
python --version
echo.

:: -----------------------------------------------------------
:: BUOC 2: Tao virtual environment
:: -----------------------------------------------------------
echo [2/7] Tao virtual environment...
if exist venv (
    echo Virtual environment da ton tai, bo qua.
) else (
    python -m venv venv
    if errorlevel 1 (
        echo [LOI] Khong tao duoc virtual environment!
        pause
        exit /b 1
    )
    echo Tao thanh cong!
)
echo.

:: -----------------------------------------------------------
:: BUOC 3: Kich hoat venv
:: -----------------------------------------------------------
echo [3/7] Kich hoat virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [LOI] Khong kich hoat duoc venv!
    pause
    exit /b 1
)
echo Kich hoat thanh cong!
echo.

:: -----------------------------------------------------------
:: BUOC 4: Upgrade pip
:: -----------------------------------------------------------
echo [4/7] Upgrade pip...
python -m pip install --upgrade pip --quiet
echo.

:: -----------------------------------------------------------
:: BUOC 5: Cai dependencies
:: -----------------------------------------------------------
echo [5/7] Cai dat dependencies (mat vai phut)...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [CANH BAO] Mot so package co the khong cai duoc.
    echo Thu cai tung phan:
    echo   pip install django djangorestframework django-cors-headers djangorestframework-simplejwt
    echo   pip install supabase python-dotenv Pillow numpy
    echo   pip install opencv-python-headless
    echo   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    echo   pip install vietocr
    echo.
)
echo.

:: -----------------------------------------------------------
:: BUOC 6: Tao file .env
:: -----------------------------------------------------------
echo [6/7] Cau hinh .env...
if exist .env (
    echo File .env da ton tai, giu nguyen.
) else (
    copy .env.example .env >nul
    echo Da tao file .env tu .env.example
    echo.
    echo *** QUAN TRONG: Mo file .env va dien thong tin Supabase ***
    echo    SUPABASE_URL=https://xxx.supabase.co
    echo    SUPABASE_ANON_KEY=eyJ...
    echo    SUPABASE_SERVICE_ROLE_KEY=eyJ...
)
echo.

:: -----------------------------------------------------------
:: BUOC 7: Django migrate
:: -----------------------------------------------------------
echo [7/7] Khoi tao Django database...
python manage.py migrate --run-syncdb
echo.

:: -----------------------------------------------------------
:: HOAN TAT
:: -----------------------------------------------------------
echo ============================================================
echo   SETUP HOAN TAT!
echo ============================================================
echo.
echo Cac buoc tiep theo:
echo   1. Mo file .env va dien Supabase keys
echo   2. Dat file model AI vao: models\efficientnet_b0_poverty.pth
echo   3. Chay server:  run.bat
echo      Hoac:         venv\Scripts\activate ^& python manage.py runserver 8000
echo.
echo API se chay tai: http://localhost:8000
echo Health check:    http://localhost:8000/api/health/
echo.
pause

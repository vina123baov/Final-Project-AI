@echo off
chcp 65001 >nul
title Test API Endpoints

echo ============================================================
echo   TEST API ENDPOINTS
echo   Server phai dang chay tai http://localhost:8000
echo ============================================================
echo.

call venv\Scripts\activate.bat

:: -----------------------------------------------------------
:: Test 1: Health check
:: -----------------------------------------------------------
echo [Test 1] GET /api/health/
echo ----------------------------------------------------------
python -c "import requests; r = requests.get('http://localhost:8000/api/health/'); print(f'Status: {r.status_code}'); print(r.json())"
echo.
echo.

:: -----------------------------------------------------------
:: Test 2: Verify image (can file test_image.jpg)
:: -----------------------------------------------------------
if exist test_image.jpg (
    echo [Test 2] POST /api/verify/ (voi test_image.jpg)
    echo ----------------------------------------------------------
    python -c "import requests; r = requests.post('http://localhost:8000/api/verify/', files={'image': open('test_image.jpg','rb')}, data={'user_id':'test-user-id'}); print(f'Status: {r.status_code}'); print(r.json())"
) else (
    echo [Test 2] BO QUA - Khong tim thay file test_image.jpg
    echo Dat 1 file anh ten test_image.jpg vao thu muc backend/ de test
)
echo.
echo.

:: -----------------------------------------------------------
:: Test 3: Admin dashboard
:: -----------------------------------------------------------
echo [Test 3] GET /api/admin/dashboard/
echo ----------------------------------------------------------
python -c "import requests; r = requests.get('http://localhost:8000/api/admin/dashboard/'); print(f'Status: {r.status_code}'); print(r.json())"
echo.
echo.

:: -----------------------------------------------------------
:: Test 4: History
:: -----------------------------------------------------------
echo [Test 4] GET /api/history/?user_id=test-user-id
echo ----------------------------------------------------------
python -c "import requests; r = requests.get('http://localhost:8000/api/history/?user_id=test-user-id'); print(f'Status: {r.status_code}'); print(r.json())"
echo.

echo ============================================================
echo   TEST HOAN TAT
echo ============================================================
pause

@echo off
chcp 65001 >nul
title Backend Server - Port 8000

echo ============================================================
echo   BACKEND SERVER
echo   http://localhost:8000
echo ============================================================
echo.

:: Kich hoat venv
call venv\Scripts\activate.bat

:: Kiem tra .env
if not exist .env (
    echo [LOI] Chua co file .env!
    echo Chay setup.bat truoc hoac copy .env.example thanh .env
    pause
    exit /b 1
)

:: Kiem tra model AI
if exist models\document_classifier_v3.pth (
    echo [OK] Model AI: da load
) else (
    echo [DEMO] Model AI: chua co file .pth - chay che do DEMO
    echo        Dat file vao: models\efficientnet_b0_poverty.pth
)
echo.

:: Chay server
echo Dang khoi dong server...
echo Nhan Ctrl+C de dung server.
echo.
python manage.py runserver 8000

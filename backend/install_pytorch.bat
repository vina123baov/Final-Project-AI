@echo off
chcp 65001 >nul
title Cai dat PyTorch cho Windows

echo ============================================================
echo   CAI DAT PYTORCH
echo   Chay file nay neu setup.bat bi loi o buoc cai torch
echo ============================================================
echo.

call venv\Scripts\activate.bat

echo Ban muon cai phien ban nao?
echo   1. CPU only (nhe, khong can GPU - khuyen nghi cho dev)
echo   2. CUDA 11.8 (can NVIDIA GPU + CUDA 11.8)
echo   3. CUDA 12.1 (can NVIDIA GPU + CUDA 12.1)
echo.
set /p choice="Chon (1/2/3): "

if "%choice%"=="1" (
    echo.
    echo Dang cai PyTorch CPU...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
)
if "%choice%"=="2" (
    echo.
    echo Dang cai PyTorch CUDA 11.8...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
)
if "%choice%"=="3" (
    echo.
    echo Dang cai PyTorch CUDA 12.1...
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
)

echo.
echo Kiem tra PyTorch...
python -c "import torch; print(f'PyTorch {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'Device: {\"cuda\" if torch.cuda.is_available() else \"cpu\"}')"

echo.
echo Hoan tat!
pause

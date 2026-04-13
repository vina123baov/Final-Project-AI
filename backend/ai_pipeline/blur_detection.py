import cv2
import numpy as np
from PIL import Image
from django.conf import settings


def check_blur(image_input, threshold_override: int = None) -> dict:
    """
    Kiem tra anh co bi mo hay khong bang Laplacian Variance.

    Args:
        image_input: duong dan file (str), numpy array, hoac PIL Image

    Returns:
        {
            'is_blurry': bool,       # True neu blur_score < threshold
            'blur_score': float,     # Laplacian Variance score
            'threshold': int,        # Nguong su dung (mac dinh 100)
            'message': str           # Thong bao cho nguoi dung
        }

    Cong thuc (Section 1.5.2):
        Laplacian: nabla^2 f = d^2f/dx^2 + d^2f/dy^2
        blur_score = Var(Laplacian(grayscale_image))
    """
    threshold = threshold_override if threshold_override is not None else getattr(settings, 'BLUR_THRESHOLD', 100)

    # --- Chuyen doi input thanh numpy array ---
    if isinstance(image_input, str):
        img_array = cv2.imread(image_input)
        if img_array is None:
            return {
                'is_blurry': True,
                'blur_score': 0.0,
                'threshold': threshold,
                'message': 'Khong doc duoc anh.'
            }
    elif isinstance(image_input, Image.Image):
        img_array = np.array(image_input)
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, np.ndarray):
        img_array = image_input
    else:
        return {
            'is_blurry': True,
            'blur_score': 0.0,
            'threshold': threshold,
            'message': 'Dinh dang anh khong ho tro.'
        }

    # --- Buoc 1: Chuyen sang grayscale ---
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)

    # --- Buoc 2: Ap dung toan tu Laplacian ---
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)

    # --- Buoc 3: Tinh variance ---
    blur_score = float(laplacian.var())

    # --- Buoc 4: So sanh voi nguong ---
    is_blurry = blur_score < threshold

    if is_blurry:
        message = 'Anh bi mo. Vui long chup lai ro hon.'
    else:
        message = 'Chat luong anh dat yeu cau.'

    return {
        'is_blurry': is_blurry,
        'blur_score': round(blur_score, 2),
        'threshold': threshold,
        'message': message,
    }

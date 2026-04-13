import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)


def detect_stamp(image_input) -> dict:
    """
    Phat hien con dau do chinh quyen tren anh so ho ngheo.

    Args:
        image_input: duong dan file (str), numpy array, hoac PIL Image

    Returns:
        {
            'stamp_detected': bool,
            'stamp_score': float,       # 0.0 - 1.0
            'stamp_count': int,
            'stamp_area_ratio': float,  # ty le dien tich con dau / anh
            'stamp_position': str,      # 'bottom_left', 'bottom_center', 'other'
            'message': str,
        }
    """
    try:
        # --- Chuyen doi input thanh numpy array ---
        if isinstance(image_input, str):
            img = cv2.imread(image_input)
            if img is None:
                return _empty_result('Khong doc duoc anh.')
        elif isinstance(image_input, Image.Image):
            img = np.array(image_input.convert('RGB'))
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        elif isinstance(image_input, np.ndarray):
            img = image_input.copy()
        else:
            return _empty_result('Dinh dang anh khong ho tro.')

        h, w = img.shape[:2]
        total_area = h * w

        # --- Buoc 1: Chuyen sang HSV ---
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # --- Buoc 2: Loc vung mau do ---
        # Mau do trong HSV nam o 2 dai: Hue 0-10 va 170-180
        lower_red1 = np.array([0, 100, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 100, 50])
        upper_red2 = np.array([180, 255, 255])

        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = cv2.bitwise_or(mask1, mask2)

        # --- Morphological operations de noi cac vung do gan nhau ---
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        red_mask = cv2.dilate(red_mask, kernel, iterations=2)
        red_mask = cv2.erode(red_mask, kernel, iterations=1)

        # --- Buoc 3: Tim contours ---
        contours, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        stamp_candidates = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            area_ratio = area / total_area

            # Con dau thuong chiem 2-20% dien tich anh
            if area_ratio < 0.01 or area_ratio > 0.25:
                continue

            # Kiem tra hinh dang gan tron/oval
            if len(cnt) < 5:
                continue

            ellipse = cv2.fitEllipse(cnt)
            (cx, cy), (ma, MA), angle = ellipse

            # Aspect ratio gan tron: 0.5 - 1.5
            if MA == 0:
                continue
            aspect = ma / MA
            if aspect < 0.4 or aspect > 1.6:
                continue

            # Kiem tra circularity
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * area / (perimeter * perimeter)

            # Xac dinh vi tri
            rel_x = cx / w
            rel_y = cy / h
            if rel_y > 0.6 and rel_x < 0.4:
                position = 'bottom_left'
            elif rel_y > 0.6 and 0.3 < rel_x < 0.7:
                position = 'bottom_center'
            else:
                position = 'other'

            stamp_candidates.append({
                'area_ratio': area_ratio,
                'aspect': aspect,
                'circularity': circularity,
                'position': position,
                'center': (cx, cy),
            })

        # --- Buoc 4: Tinh stamp_score ---
        if not stamp_candidates:
            return {
                'stamp_detected': False,
                'stamp_score': 0.1,
                'stamp_count': 0,
                'stamp_area_ratio': 0.0,
                'stamp_position': 'none',
                'message': 'Khong phat hien con dau.',
            }

        # Chon candidate tot nhat
        best = max(stamp_candidates, key=lambda c: c['area_ratio'] * c['circularity'])
        score = _calculate_stamp_score(best)

        return {
            'stamp_detected': score >= 0.5,
            'stamp_score': round(score, 4),
            'stamp_count': len(stamp_candidates),
            'stamp_area_ratio': round(best['area_ratio'], 4),
            'stamp_position': best['position'],
            'message': 'Phat hien con dau.' if score >= 0.5 else 'Con dau khong ro rang.',
        }

    except Exception as e:
        logger.error(f"Stamp detection error: {e}")
        return _empty_result(f'Loi: {str(e)}')


def _calculate_stamp_score(candidate: dict) -> float:
    """
    Tinh stamp_score tu 0 den 1 dua tren cac dac trung.
    - Co con dau ro rang, dung vi tri: 0.9-1.0
    - Co vung do nhung khong ro: 0.5-0.8
    - Khong tim thay: 0-0.4
    """
    score = 0.0

    # Diem cho circularity (con dau thuong tron)
    circ = candidate.get('circularity', 0)
    if circ > 0.7:
        score += 0.35
    elif circ > 0.5:
        score += 0.25
    elif circ > 0.3:
        score += 0.15

    # Diem cho kich thuoc (2-15% la hop ly)
    area = candidate.get('area_ratio', 0)
    if 0.03 <= area <= 0.15:
        score += 0.3
    elif 0.01 <= area <= 0.20:
        score += 0.15

    # Diem cho vi tri (bottom_left hoac bottom_center la dung)
    pos = candidate.get('position', 'other')
    if pos == 'bottom_left':
        score += 0.25
    elif pos == 'bottom_center':
        score += 0.20
    else:
        score += 0.05

    # Diem cho aspect ratio gan tron
    aspect = candidate.get('aspect', 0)
    if 0.8 <= aspect <= 1.2:
        score += 0.1
    elif 0.6 <= aspect <= 1.4:
        score += 0.05

    return min(score, 1.0)


def _empty_result(message: str) -> dict:
    return {
        'stamp_detected': False,
        'stamp_score': 0.0,
        'stamp_count': 0,
        'stamp_area_ratio': 0.0,
        'stamp_position': 'none',
        'message': message,
    }
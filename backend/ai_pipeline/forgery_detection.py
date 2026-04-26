import cv2
import numpy as np
from PIL import Image, ExifTags
import io
import logging

logger = logging.getLogger(__name__)

# TOI UU: Resize anh lon truoc khi chay ELA
# Giam tu 1024 xuong 800 de tang toc ~40% (ELA chay tren tung pixel)
MAX_IMAGE_DIMENSION = 800


def detect_forgery(image_input) -> dict:
    """
    Phat hien anh gia mao bang ELA + Metadata Analysis.

    Args:
        image_input: duong dan file (str) hoac PIL Image

    Returns:
        {
            'forgery_detected': bool,
            'forgery_score': float,         # 0.0 (that) - 1.0 (gia)
            'ela_score': float,             # Diem ELA
            'metadata_score': float,        # Diem metadata
            'has_exif': bool,
            'software_detected': str,       # 'Adobe Photoshop', None, etc.
            'double_compressed': bool,
            'message': str,
        }
    """
    try:
        # --- Load image ---
        if isinstance(image_input, str):
            pil_image = Image.open(image_input)
            file_path = image_input
        elif isinstance(image_input, Image.Image):
            pil_image = image_input
            file_path = None
        else:
            return _empty_result('Dinh dang anh khong ho tro.')

        pil_image = pil_image.convert('RGB')

        # --- TOI UU: Resize neu anh qua lon (tiet kiem thoi gian ELA) ---
        original_size = pil_image.size
        if max(original_size) > MAX_IMAGE_DIMENSION:
            ratio = MAX_IMAGE_DIMENSION / max(original_size)
            new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
            pil_image = pil_image.resize(new_size, Image.LANCZOS)
            logger.debug(f"Resized image from {original_size} to {new_size} for forgery detection")

        # --- Chay ELA ---
        ela_result = _error_level_analysis(pil_image)

        # --- Chay Metadata Analysis (dung anh goc neu co file path) ---
        if file_path:
            meta_result = _metadata_analysis(Image.open(file_path), file_path)
        else:
            meta_result = _metadata_analysis(pil_image, None)

        # --- Tinh forgery_score tong hop ---
        ela_score = ela_result.get('ela_score', 0.0)
        meta_score = meta_result.get('metadata_score', 0.0)

        # Trong so: ELA 60%, Metadata 40%
        forgery_score = 0.6 * ela_score + 0.4 * meta_score
        forgery_score = round(min(forgery_score, 1.0), 4)

        # Phan loai
        if forgery_score > 0.7:
            message = 'Phat hien dau hieu chinh sua anh.'
            forgery_detected = True
        elif forgery_score >= 0.4:
            message = 'Nghi ngo chinh sua. Can admin review.'
            forgery_detected = False
        else:
            message = 'Khong phat hien dau hieu chinh sua.'
            forgery_detected = False

        return {
            'forgery_detected': forgery_detected,
            'forgery_score': forgery_score,
            'ela_score': round(ela_score, 4),
            'metadata_score': round(meta_score, 4),
            'has_exif': meta_result.get('has_exif', False),
            'software_detected': meta_result.get('software', None),
            'double_compressed': ela_result.get('double_compressed', False),
            'message': message,
        }

    except Exception as e:
        logger.error(f"Forgery detection error: {e}")
        return _empty_result(f'Loi: {str(e)}')


def _error_level_analysis(pil_image: Image.Image, quality: int = 95) -> dict:
    """
    Error Level Analysis (ELA).

    Nguyen ly:
        - Luu anh lai o chat luong JPEG 95%
        - Tinh hieu tuyet doi giua anh goc va anh resaved
        - Anh chua chinh sua: ELA dong deu
        - Anh da chinh sua: vung chinh sua co ELA khac biet

    Returns:
        ela_score: 0.0 (khong chinh sua) - 1.0 (chinh sua nang)
        double_compressed: bool
    """
    try:
        # Buoc 1: Luu lai o JPEG quality
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=quality)
        buffer.seek(0)
        resaved = Image.open(buffer)

        # Buoc 2: Tinh hieu tuyet doi (dung float32 thay vi float64 - nhanh hon 2x)
        original_arr = np.array(pil_image, dtype=np.float32)
        resaved_arr = np.array(resaved, dtype=np.float32)
        ela_image = np.abs(original_arr - resaved_arr)

        # Buoc 3: Phan tich ELA
        ela_mean = float(np.mean(ela_image))
        ela_std = float(np.std(ela_image))
        ela_max = float(np.max(ela_image))

        # Tinh ty le vung co ELA cao (nghi chinh sua)
        threshold = ela_mean + 2 * ela_std
        suspicious_pixels = int(np.sum(ela_image > threshold))
        total_pixels = ela_image.size
        suspicious_ratio = suspicious_pixels / total_pixels if total_pixels > 0 else 0

        # Chuyen thanh score 0-1
        ela_score = 0.0
        if ela_std > 30:
            ela_score = 0.8 + min(0.2, (ela_std - 30) / 50)
        elif ela_std > 20:
            ela_score = 0.5 + (ela_std - 20) / 33
        elif ela_std > 15:
            ela_score = 0.3 + (ela_std - 15) / 25
        elif ela_std > 10:
            ela_score = 0.1 + (ela_std - 10) / 25

        # Kiem tra double JPEG compression
        double_compressed = ela_std > 20 and suspicious_ratio > 0.05

        return {
            'ela_score': min(ela_score, 1.0),
            'ela_mean': round(ela_mean, 2),
            'ela_std': round(ela_std, 2),
            'ela_max': round(ela_max, 2),
            'suspicious_ratio': round(suspicious_ratio, 4),
            'double_compressed': double_compressed,
        }

    except Exception as e:
        logger.error(f"ELA error: {e}")
        return {'ela_score': 0.0, 'double_compressed': False}


def _metadata_analysis(pil_image: Image.Image, file_path: str = None) -> dict:
    """
    Phan tich metadata/EXIF cua anh.

    Kiem tra:
        - Co EXIF hay khong (anh chup tu camera co EXIF)
        - Software tag (Adobe Photoshop, GIMP, etc.)
        - Camera model, thoi gian chup
    """
    try:
        exif_data = pil_image.getexif()
        has_exif = bool(exif_data)

        software = None
        camera_model = None
        datetime_original = None
        metadata_score = 0.0

        if has_exif:
            # Doc cac tag EXIF
            for tag_id, value in exif_data.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))

                if tag_name == 'Software':
                    software = str(value)
                elif tag_name == 'Model':
                    camera_model = str(value)
                elif tag_name == 'DateTimeOriginal':
                    datetime_original = str(value)

            # Phat hien phan mem chinh sua
            editing_software = [
                'photoshop', 'gimp', 'paint.net', 'lightroom',
                'affinity', 'pixlr', 'canva', 'snapseed',
                'picsart', 'fotor',
            ]

            if software:
                sw_lower = software.lower()
                for editor in editing_software:
                    if editor in sw_lower:
                        metadata_score = 0.8
                        break

            # Anh co camera model -> it kha nang gia mao
            if camera_model and metadata_score < 0.3:
                metadata_score = max(0.0, metadata_score - 0.1)

        else:
            # Khong co EXIF -> co the da bi strip (nghi ngo nhe)
            metadata_score = 0.2

        return {
            'metadata_score': metadata_score,
            'has_exif': has_exif,
            'software': software,
            'camera_model': camera_model,
            'datetime_original': datetime_original,
        }

    except Exception as e:
        logger.error(f"Metadata analysis error: {e}")
        return {'metadata_score': 0.0, 'has_exif': False, 'software': None}


def _empty_result(message: str) -> dict:
    return {
        'forgery_detected': False,
        'forgery_score': 0.0,
        'ela_score': 0.0,
        'metadata_score': 0.0,
        'has_exif': False,
        'software_detected': None,
        'double_compressed': False,
        'message': message,
    }
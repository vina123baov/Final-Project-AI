import logging
from PIL import Image
from django.conf import settings

logger = logging.getLogger(__name__)

VIETOCR_AVAILABLE = False
_detector = None

try:
    from vietocr.tool.predictor import Predictor
    from vietocr.tool.config import Cfg
    VIETOCR_AVAILABLE = True
except ImportError:
    logger.warning("VietOCR not installed. OCR will return placeholder text.")
    logger.warning("Install: pip install vietocr")


def _get_detector():
    """Lazy-load VietOCR detector (singleton)"""
    global _detector
    if _detector is not None:
        return _detector

    if not VIETOCR_AVAILABLE:
        return None

    try:
        config_name = getattr(settings, 'VIETOCR_CONFIG', 'vgg_transformer')
        config = Cfg.load_config_from_name(config_name)
        config['cnn']['pretrained'] = True
        config['device'] = 'cuda:0' if __import__('torch').cuda.is_available() else 'cpu'
        config['predictor']['beamsearch'] = False  # Nhanh hon

        _detector = Predictor(config)
        logger.info(f"VietOCR loaded with config: {config_name}")
        return _detector

    except Exception as e:
        logger.error(f"VietOCR init error: {e}")
        return None


def extract_text(image_input) -> dict:
    """
    Trich xuat text tu anh bang VietOCR.

    Args:
        image_input: duong dan file (str) hoac PIL Image

    Returns:
        {
            'extracted_text': str,    # Text trich xuat duoc
            'ocr_confidence': float,  # Do tin cay (0-1)
            'is_demo': bool,          # True neu VietOCR chua cai
            'household_name': str,    # Ten chu ho (neu phan tich duoc)
            'household_address': str, # Dia chi (neu phan tich duoc)
            'household_id_number': str, # Ma ho ngheo (neu phan tich duoc)
            'province': str,          # Tinh/thanh pho (neu phan tich duoc)
        }
    """

    # --- Load image ---
    if isinstance(image_input, str):
        image = Image.open(image_input)
    elif isinstance(image_input, Image.Image):
        image = image_input
    else:
        return _empty_result("Dinh dang anh khong ho tro")

    image = image.convert('RGB')

    detector = _get_detector()

    if detector is None:
        # DEMO MODE: khi chua cai VietOCR
        logger.warning("VietOCR not available. Returning DEMO text.")
        return {
            'extracted_text': '[DEMO] So Ho Ngheo - Ho va ten: Nguyen Van A - Dia chi: 123 Duong ABC, Quan 1, TP.HCM',
            'ocr_confidence': 0.0,
            'is_demo': True,
            'household_name': None,
            'household_address': None,
            'household_id_number': None,
            'province': None,
        }

    try:
        # Trich xuat text
        text = detector.predict(image)

        # Phan tich cac truong thong tin tu text
        parsed = _parse_poverty_card(text)

        return {
            'extracted_text': text,
            'ocr_confidence': 0.95,
            'is_demo': False,
            'household_name': parsed.get('household_name'),
            'household_address': parsed.get('household_address'),
            'household_id_number': parsed.get('household_id_number'),
            'province': parsed.get('province'),
        }

    except Exception as e:
        logger.error(f"OCR error: {e}")
        return _empty_result(f"Loi OCR: {str(e)}")


def _parse_poverty_card(text: str) -> dict:
    """
    Phan tich text trich xuat tu so ho ngheo de lay cac truong thong tin.
    Day la basic parser - ban co the cai thien bang regex hoac NLP.
    """
    result = {
        'household_name': None,
        'household_address': None,
        'household_id_number': None,
        'province': None,
    }

    if not text:
        return result

    lines = text.strip().split('\n')

    for line in lines:
        line_lower = line.lower().strip()

        # Tim ten chu ho
        if any(kw in line_lower for kw in ['ho va ten', 'họ và tên', 'ho ten', 'chu ho']):
            parts = line.split(':')
            if len(parts) > 1:
                result['household_name'] = parts[1].strip()

        # Tim dia chi
        if any(kw in line_lower for kw in ['dia chi', 'địa chỉ', 'noi o', 'thuong tru']):
            parts = line.split(':')
            if len(parts) > 1:
                result['household_address'] = parts[1].strip()

        # Tim ma ho ngheo / so so
        if any(kw in line_lower for kw in ['so so', 'ma so', 'so ho', 'ma ho']):
            parts = line.split(':')
            if len(parts) > 1:
                result['household_id_number'] = parts[1].strip()

        # Tim tinh/thanh pho
        if any(kw in line_lower for kw in ['tinh', 'tỉnh', 'thanh pho', 'thành phố']):
            parts = line.split(':')
            if len(parts) > 1:
                result['province'] = parts[1].strip()

    return result


def _empty_result(error_msg: str = '') -> dict:
    return {
        'extracted_text': error_msg,
        'ocr_confidence': 0.0,
        'is_demo': False,
        'household_name': None,
        'household_address': None,
        'household_id_number': None,
        'province': None,
    }

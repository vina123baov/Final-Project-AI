"""
Buoc 2: Document Classification
Khop voi code train Colab: PovertyCardVerifier class

Model file: document_classifier_production.pth
Checkpoint format:
    {
        'model_state_dict': ...,
        'classes': ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan'],
        'class_to_idx': {...},
        'idx_to_class': {...},
        'accuracy': 0.89,
        'confidence_threshold': 0.7,
        'blur_threshold': 100,
    }
"""
import os
import logging
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_CLASSES = ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']

CLASS_LABELS_VI = {
    'so_ho_ngheo': 'So ho ngheo',
    'giay_to_khac': 'Giay to khac',
    'anh_khong_lien_quan': 'Anh khong lien quan',
}

# Giong val_transform trong Colab
IMAGE_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class DocumentClassifier:
    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model = None
        self.is_loaded = False
        self.classes = DEFAULT_CLASSES
        self.confidence_threshold = 0.7
        self.blur_threshold = 100
        self.accuracy = 0.0
        logger.info(f"DocumentClassifier initialized on device: {self.device}")

    def load_model(self, model_path: str = None):
        """
        Load model .pth export tu Colab.
        Tim file theo thu tu uu tien.
        """
        search_paths = [
            model_path,
            getattr(settings, 'EFFICIENTNET_MODEL_PATH', None),
            'models/document_classifier_production.pth',
            'models/document_classifier_best.pth',
            'models/efficientnet_b0_poverty.pth',
        ]

        found_path = None
        for p in search_paths:
            if p and os.path.exists(p):
                found_path = p
                break

        if not found_path:
            logger.warning("=" * 60)
            logger.warning("MODEL KHONG TIM THAY! Chay che do DEMO.")
            logger.warning("Dat file .pth vao: backend/models/")
            logger.warning("=" * 60)
            self.is_loaded = False
            return

        try:
            logger.info(f"Loading model: {found_path}")
            checkpoint = torch.load(found_path, map_location=self.device, weights_only=False)

            # Doc thong tin tu checkpoint (giong Colab export)
            if 'classes' in checkpoint:
                self.classes = checkpoint['classes']
            if 'confidence_threshold' in checkpoint:
                self.confidence_threshold = checkpoint['confidence_threshold']
            if 'blur_threshold' in checkpoint:
                self.blur_threshold = checkpoint['blur_threshold']
            if 'accuracy' in checkpoint:
                self.accuracy = checkpoint['accuracy']
            elif 'val_acc' in checkpoint:
                self.accuracy = checkpoint['val_acc']

            # Tao model (giong Colab: models.efficientnet_b0 + thay classifier)
            self.model = models.efficientnet_b0(pretrained=False)
            self.model.classifier[1] = nn.Linear(1280, len(self.classes))

            # Load weights
            if 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
            else:
                self.model.load_state_dict(checkpoint)

            self.model.to(self.device)
            self.model.eval()
            self.is_loaded = True

            logger.info(f"Model loaded thanh cong!")
            logger.info(f"  Classes: {self.classes}")
            logger.info(f"  Accuracy: {self.accuracy:.1%}")
            logger.info(f"  Confidence threshold: {self.confidence_threshold}")
            logger.info(f"  Blur threshold: {self.blur_threshold}")

        except Exception as e:
            logger.error(f"LOI LOAD MODEL: {e}")
            self.is_loaded = False

    def classify(self, image_input) -> dict:
        """
        Phan loai tai lieu.
        Giong ham classify() trong PovertyCardVerifier (Colab).
        """
        if not self.is_loaded:
            return {
                'predicted_class': 'so_ho_ngheo',
                'confidence': 0.85,
                'all_probabilities': {c: 0.05 for c in self.classes},
                'label_vi': CLASS_LABELS_VI['so_ho_ngheo'],
                'is_demo': True,
            }

        if isinstance(image_input, str):
            image = Image.open(image_input)
        elif isinstance(image_input, Image.Image):
            image = image_input
        else:
            raise ValueError("image_input phai la file path hoac PIL Image")

        image = image.convert('RGB')
        tensor = IMAGE_TRANSFORM(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            out = self.model(tensor)
            probs = torch.softmax(out, 1)
            conf, idx = torch.max(probs, 1)

        predicted_class = self.classes[idx.item()]
        confidence_score = conf.item()

        all_probs = {
            self.classes[i]: round(probs[0][i].item(), 4)
            for i in range(len(self.classes))
        }

        return {
            'predicted_class': predicted_class,
            'confidence': round(confidence_score, 4),
            'all_probabilities': all_probs,
            'label_vi': CLASS_LABELS_VI.get(predicted_class, predicted_class),
            'is_demo': False,
        }


# Singleton
_classifier_instance = None

def get_classifier() -> DocumentClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = DocumentClassifier()
        _classifier_instance.load_model()
    return _classifier_instance

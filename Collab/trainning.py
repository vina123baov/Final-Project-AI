#@title 1. Cài đặt thư viện
!pip install -q torch torchvision pillow scikit-learn tqdm opencv-python

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models
from PIL import Image
import json, os, numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report
from tqdm import tqdm
import matplotlib.pyplot as plt
from collections import Counter
import seaborn as sns
import cv2

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🖥️ Đang sử dụng: {device}")

#@title 2. Kết nối Google Drive
from google.colab import drive
drive.mount('/content/drive')

PROJECT_PATH = '/content/drive/MyDrive/DoAn_HoNgheo'
DATASET_PATH = f'{PROJECT_PATH}/dataset'
IMAGES_PATH = f'{DATASET_PATH}/images'
ANNOTATIONS_PATH = f'{DATASET_PATH}/annotations'
MODELS_PATH = f'{PROJECT_PATH}/models'

os.makedirs(MODELS_PATH, exist_ok=True)
print("✅ Đã kết nối Google Drive")

#@title 3. Load dữ liệu
with open(f'{ANNOTATIONS_PATH}/labels.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"📊 Tổng số ảnh: {len(data['images'])}")

label_counts = Counter([img['label'] for img in data['images']])
for label, count in label_counts.items():
    print(f"   {label}: {count} ảnh")

# 3 CLASSES
CLASSES = ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CLASS = {i: c for c, i in CLASS_TO_IDX.items()}

print(f"\n🏷️ Classes: {CLASSES}")

#@title 4. Dataset class
class PovertyCardDataset(Dataset):
    def __init__(self, image_list, images_path, transform=None):
        self.image_list = image_list
        self.images_path = images_path
        self.transform = transform

    def __len__(self):
        return len(self.image_list)

    def __getitem__(self, idx):
        img_info = self.image_list[idx]
        folder = img_info.get('folder', img_info['label'])
        img_path = os.path.join(self.images_path, folder, img_info['filename'])

        try:
            image = Image.open(img_path).convert('RGB')
        except:
            image = Image.new('RGB', (224, 224), color='gray')

        if self.transform:
            image = self.transform(image)

        label = CLASS_TO_IDX[img_info['label']]
        return image, label

print("✅ Dataset class ready")

#@title 5. Data Transforms
train_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

val_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

print("✅ Transforms ready")

#@title 6. Chia Train/Validation
filtered_data = [img for img in data['images'] if img['label'] in CLASSES]

train_data, val_data = train_test_split(
    filtered_data, test_size=0.2, random_state=42,
    stratify=[img['label'] for img in filtered_data]
)

print(f"📊 Train: {len(train_data)} | Val: {len(val_data)}")

train_dataset = PovertyCardDataset(train_data, IMAGES_PATH, train_transform)
val_dataset = PovertyCardDataset(val_data, IMAGES_PATH, val_transform)

BATCH_SIZE = 16
train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

print(f"✅ DataLoaders ready")

#@title 7. Tạo Model
model = models.efficientnet_b0(pretrained=True)

for param in model.parameters():
    param.requires_grad = False

model.classifier[1] = nn.Linear(1280, len(CLASSES))

for param in model.classifier.parameters():
    param.requires_grad = True

model = model.to(device)
print(f"✅ Model EfficientNet-B0 với {len(CLASSES)} classes")

#@title 8. Training Functions
def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    loss_sum, correct, total = 0.0, 0, 0

    for images, labels in tqdm(loader, desc='Training'):
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        loss_sum += loss.item()
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return loss_sum/len(loader), correct/total

def validate(model, loader, criterion):
    model.eval()
    loss_sum, correct, total = 0.0, 0, 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            loss_sum += loss.item()
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    return loss_sum/len(loader), correct/total

print("✅ Training functions ready")

#@title 9. Training Functions
def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    loss_sum, correct, total = 0.0, 0, 0

    pbar = tqdm(loader, desc='Training')
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        loss_sum += loss.item()
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        pbar.set_postfix({'loss': f'{loss.item():.4f}', 'acc': f'{100*correct/total:.1f}%'})

    return loss_sum/len(loader), correct/total

def validate(model, loader, criterion):
    model.eval()
    loss_sum, correct, total = 0.0, 0, 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            loss_sum += loss.item()
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    return loss_sum/len(loader), correct/total

print("✅ Training functions ready")

#@title 9. 🚀 TRAIN MODEL
NUM_EPOCHS = 30
LEARNING_RATE = 0.001
PATIENCE = 7

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.classifier.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

history = {'train_loss': [], 'train_acc': [], 'val_loss': [], 'val_acc': []}
best_val_acc = 0.0
patience_counter = 0

print(f"🚀 Training {NUM_EPOCHS} epochs...")

for epoch in range(NUM_EPOCHS):
    print(f"\nEpoch {epoch+1}/{NUM_EPOCHS}")

    train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer)
    val_loss, val_acc = validate(model, val_loader, criterion)

    scheduler.step(val_loss)

    history['train_loss'].append(train_loss)
    history['train_acc'].append(train_acc)
    history['val_loss'].append(val_loss)
    history['val_acc'].append(val_acc)

    print(f"   Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}%")

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        patience_counter = 0
        torch.save({
            'model_state_dict': model.state_dict(),
            'classes': CLASSES,
            'class_to_idx': CLASS_TO_IDX,
            'idx_to_class': IDX_TO_CLASS,
            'val_acc': val_acc
        }, f'{MODELS_PATH}/document_classifier_best.pth')
        print(f"   💾 Saved! (Best: {val_acc*100:.1f}%)")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"\n⚠️ Early stopping")
            break

print(f"\n🎉 Best Accuracy: {best_val_acc*100:.1f}%")

#@title 10. Biểu đồ Training
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].plot(history['train_loss'], 'b-', label='Train')
axes[0].plot(history['val_loss'], 'r-', label='Val')
axes[0].set_title('Loss')
axes[0].legend()
axes[0].grid(True)

axes[1].plot([x*100 for x in history['train_acc']], 'b-', label='Train')
axes[1].plot([x*100 for x in history['val_acc']], 'r-', label='Val')
axes[1].set_title('Accuracy (%)')
axes[1].legend()
axes[1].grid(True)

plt.tight_layout()
plt.savefig(f'{MODELS_PATH}/training_history.png')
plt.show()

#@title 11. 📊 Phân tích Confidence & Tìm Threshold

model.eval()

all_confidences = []
all_preds = []
all_labels = []
correct_confidences = []
wrong_confidences = []

with torch.no_grad():
    for images, labels in val_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        probs = torch.softmax(outputs, dim=1)
        confidences, preds = torch.max(probs, dim=1)

        for conf, pred, label in zip(confidences, preds, labels):
            conf_val = conf.item()
            all_confidences.append(conf_val)
            all_preds.append(pred.item())
            all_labels.append(label.item())

            if pred.item() == label.item():
                correct_confidences.append(conf_val)
            else:
                wrong_confidences.append(conf_val)

# Vẽ biểu đồ
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

axes[0].hist(correct_confidences, bins=30, alpha=0.7, label='Đúng', color='green')
axes[0].hist(wrong_confidences, bins=30, alpha=0.7, label='Sai', color='red')
axes[0].axvline(x=0.7, color='blue', linestyle='--', label='Threshold 0.7')
axes[0].set_xlabel('Confidence')
axes[0].set_title('Confidence: Đúng vs Sai')
axes[0].legend()

# Test các threshold
thresholds = [0.5, 0.6, 0.7, 0.8, 0.9]
accuracies = []
reject_rates = []

for thresh in thresholds:
    accepted_correct = sum(1 for c, p, l in zip(all_confidences, all_preds, all_labels)
                          if c >= thresh and p == l)
    accepted_total = sum(1 for c in all_confidences if c >= thresh)
    rejected = sum(1 for c in all_confidences if c < thresh)

    acc = accepted_correct / accepted_total if accepted_total > 0 else 0
    rej = rejected / len(all_confidences)
    accuracies.append(acc * 100)
    reject_rates.append(rej * 100)

axes[1].plot(thresholds, accuracies, 'g-o', label='Accuracy (%)')
axes[1].plot(thresholds, reject_rates, 'r-s', label='Reject Rate (%)')
axes[1].set_xlabel('Threshold')
axes[1].set_title('Threshold vs Accuracy & Reject Rate')
axes[1].legend()
axes[1].grid(True)

plt.tight_layout()
plt.savefig(f'{MODELS_PATH}/threshold_analysis.png')
plt.show()

print("\n📊 Kết quả theo Threshold:")
print(f"{'Threshold':<12} {'Accuracy':<12} {'Reject Rate':<12}")
for t, a, r in zip(thresholds, accuracies, reject_rates):
    print(f"{t:<12} {a:<12.1f}% {r:<12.1f}%")
    

#@title 12. 📸 Blur Detection - Kiểm tra ảnh mờ
"""
Sử dụng Laplacian variance để detect ảnh mờ:
- Laplacian variance thấp → Ảnh mờ
- Laplacian variance cao → Ảnh rõ nét

Ngưỡng thường dùng: 100-150
"""

import cv2
import numpy as np
from PIL import Image

def calculate_blur_score(image):
    """
    Tính điểm blur của ảnh sử dụng Laplacian variance

    Args:
        image: PIL Image hoặc numpy array hoặc đường dẫn file

    Returns:
        float: Blur score (càng cao càng rõ nét)
    """
    # Convert to numpy array nếu cần
    if isinstance(image, str):
        image = cv2.imread(image)
    elif isinstance(image, Image.Image):
        image = np.array(image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Tính Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = laplacian.var()

    return variance

def is_blurry(image, threshold=100):
    """
    Kiểm tra ảnh có bị mờ không

    Args:
        image: Ảnh cần kiểm tra
        threshold: Ngưỡng blur (default 100)

    Returns:
        tuple: (is_blurry: bool, blur_score: float)
    """
    score = calculate_blur_score(image)
    return score < threshold, score

# Test với một số ảnh
print("🔍 Test Blur Detection:")
print("="*50)

# Test với ảnh từ dataset
test_images = []
for folder in ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']:
    folder_path = os.path.join(IMAGES_PATH, folder)
    if os.path.exists(folder_path):
        files = os.listdir(folder_path)[:3]  # Lấy 3 ảnh mỗi folder
        for f in files:
            test_images.append((os.path.join(folder_path, f), folder))

blur_scores = []
for img_path, label in test_images:
    try:
        score = calculate_blur_score(img_path)
        blur_scores.append(score)
        status = "🔴 MỜ" if score < 100 else "🟢 RÕ"
        print(f"{status} | Score: {score:>8.1f} | {label[:15]}")
    except Exception as e:
        print(f"❌ Lỗi: {img_path}")

print("="*50)
print(f"\n Thống kê Blur Score:")
print(f"   Min: {min(blur_scores):.1f}")
print(f"   Max: {max(blur_scores):.1f}")
print(f"   Mean: {np.mean(blur_scores):.1f}")
print(f"\n Đề xuất BLUR_THRESHOLD = 100")


#@title 13. 📊 Tìm Blur Threshold tối ưu
"""
Vẽ histogram blur score để chọn threshold phù hợp
"""

# Thu thập blur score từ tất cả ảnh trong dataset
all_blur_scores = []
blur_by_class = {c: [] for c in CLASSES}

for img_info in data['images']:
    folder = img_info.get('folder', img_info['label'])
    img_path = os.path.join(IMAGES_PATH, folder, img_info['filename'])

    try:
        score = calculate_blur_score(img_path)
        all_blur_scores.append(score)
        blur_by_class[img_info['label']].append(score)
    except:
        pass

# Vẽ histogram
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Tổng thể
axes[0].hist(all_blur_scores, bins=50, edgecolor='black', alpha=0.7)
axes[0].axvline(x=100, color='r', linestyle='--', label='Threshold 100')
axes[0].axvline(x=80, color='orange', linestyle='--', label='Threshold 80')
axes[0].set_xlabel('Blur Score')
axes[0].set_ylabel('Số lượng')
axes[0].set_title('Phân phối Blur Score')
axes[0].legend()

# Theo class
for cls, scores in blur_by_class.items():
    if scores:
        axes[1].hist(scores, bins=30, alpha=0.5, label=f'{cls} ({len(scores)})')
axes[1].axvline(x=100, color='r', linestyle='--', label='Threshold')
axes[1].set_xlabel('Blur Score')
axes[1].set_title('Blur Score theo Class')
axes[1].legend()

plt.tight_layout()
plt.savefig(f'{MODELS_PATH}/blur_analysis.png')
plt.show()

# Thống kê
print("\n📊 Thống kê Blur Score theo Class:")
for cls, scores in blur_by_class.items():
    if scores:
        print(f"\n   {cls}:")
        print(f"      Min: {min(scores):.1f} | Max: {max(scores):.1f} | Mean: {np.mean(scores):.1f}")
        blurry_count = sum(1 for s in scores if s < 100)
        print(f"      Số ảnh mờ (< 100): {blurry_count}/{len(scores)}")
        
        
#@title 14. 💾 Export Model với Confidence + Blur Threshold
#@markdown ### Cấu hình
CONFIDENCE_THRESHOLD = 0.7  #@param {type:"slider", min:0.5, max:0.95, step:0.05}
BLUR_THRESHOLD = 100  #@param {type:"slider", min:50, max:200, step:10}

checkpoint = torch.load(f'{MODELS_PATH}/document_classifier_best.pth')

# Export với cả 2 threshold
export_data = {
    'model_state_dict': checkpoint['model_state_dict'],
    'classes': CLASSES,
    'class_to_idx': CLASS_TO_IDX,
    'idx_to_class': IDX_TO_CLASS,
    'accuracy': checkpoint['val_acc'],
    'confidence_threshold': CONFIDENCE_THRESHOLD,
    'blur_threshold': BLUR_THRESHOLD,
}

torch.save(export_data, f'{MODELS_PATH}/document_classifier_production.pth')

# Model info
model_info = {
    'model': 'EfficientNet-B0',
    'num_classes': len(CLASSES),
    'classes': CLASSES,
    'thresholds': {
        'confidence': CONFIDENCE_THRESHOLD,
        'blur': BLUR_THRESHOLD
    },
    'responses': {
        'blur_detected': 'Ảnh bị mờ. Vui lòng chụp lại rõ hơn.',
        'low_confidence': 'Không xác định được. Vui lòng chụp lại.',
        'anh_khong_lien_quan': 'Ảnh không hợp lệ. Vui lòng chụp lại ảnh sổ hộ nghèo.',
        'giay_to_khac': 'Đây không phải sổ hộ nghèo. Vui lòng chụp lại đúng sổ hộ nghèo.',
        'so_ho_ngheo': 'Xác minh thành công!'
    },
    'accuracy': checkpoint['val_acc']
}

with open(f'{MODELS_PATH}/model_info.json', 'w', encoding='utf-8') as f:
    json.dump(model_info, f, ensure_ascii=False, indent=2)

print("✅ Exported!")
print(f"   📁 {MODELS_PATH}/document_classifier_production.pth")
print(f"\n⚙️ THRESHOLDS:")
print(f"   Confidence: {CONFIDENCE_THRESHOLD}")
print(f"   Blur: {BLUR_THRESHOLD}")

#@title 15. 🔥 PIPELINE HOÀN CHỈNH - Blur Detection + Classification + Threshold
"""
LUỒNG XỬ LÝ:
1. Kiểm tra ảnh mờ → Nếu mờ: "Chụp lại"
2. Phân loại bằng AI
3. Kiểm tra confidence threshold
4. Trả kết quả (tất cả trường hợp không hợp lệ đều yêu cầu "chụp lại")
"""

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import cv2
import numpy as np

class PovertyCardVerifier:
    """
    Pipeline xác minh sổ hộ nghèo hoàn chỉnh:
    - Bước 1: Kiểm tra ảnh mờ (Blur Detection)
    - Bước 2: Phân loại 3 classes
    - Bước 3: Kiểm tra Confidence Threshold
    - Bước 4: Trả kết quả (không hợp lệ → yêu cầu chụp lại)
    """

    CLASSES = ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']

    # Messages - TẤT CẢ đều yêu cầu "chụp lại" nếu không hợp lệ
    MESSAGES = {
        'blur': '📸 Ảnh bị mờ. Vui lòng chụp lại rõ hơn, đảm bảo đủ ánh sáng.',
        'low_confidence': '⚠️ Không nhận diện được. Vui lòng chụp lại ảnh sổ hộ nghèo rõ ràng hơn.',
        'anh_khong_lien_quan': '❌ Ảnh không hợp lệ. Vui lòng chụp lại ảnh sổ hộ nghèo của bạn.',
        'giay_to_khac': '❌ Đây không phải sổ hộ nghèo. Vui lòng chụp lại đúng sổ hộ nghèo.',
        'so_ho_ngheo': '✅ Xác minh thành công! Đây là sổ hộ nghèo hợp lệ.'
    }

    def __init__(self, model_path):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

        # Load model và thresholds
        ckpt = torch.load(model_path, map_location=self.device)

        self.model = models.efficientnet_b0(pretrained=False)
        self.model.classifier[1] = nn.Linear(1280, len(self.CLASSES))
        self.model.load_state_dict(ckpt['model_state_dict'])
        self.model.to(self.device).eval()

        # Thresholds
        self.confidence_threshold = ckpt.get('confidence_threshold', 0.7)
        self.blur_threshold = ckpt.get('blur_threshold', 100)

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        print(f"✅ Model loaded!")
        print(f"   Confidence threshold: {self.confidence_threshold}")
        print(f"   Blur threshold: {self.blur_threshold}")

    def check_blur(self, image):
        """Kiểm tra ảnh có bị mờ không"""
        if isinstance(image, str):
            img_array = cv2.imread(image)
        elif isinstance(image, Image.Image):
            img_array = np.array(image)
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_array = image

        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

        return blur_score < self.blur_threshold, blur_score

    def classify(self, image):
        """Phân loại ảnh"""
        if isinstance(image, str):
            image = Image.open(image)

        image = image.convert('RGB')
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            out = self.model(tensor)
            probs = torch.softmax(out, 1)
            conf, idx = torch.max(probs, 1)

        return self.CLASSES[idx.item()], conf.item()

    def verify(self, image_path):
        """
        Xác minh ảnh sổ hộ nghèo

        Returns:
            dict:
                - success: bool (True chỉ khi là sổ hộ nghèo hợp lệ)
                - status: str ('success' | 'blur' | 'low_confidence' | 'invalid' | 'wrong_document')
                - message: str (message hiển thị cho user)
                - need_retry: bool (True nếu cần chụp lại)
                - details: dict (thông tin chi tiết)
        """

        # ===== BƯỚC 1: KIỂM TRA ẢNH MỜ =====
        is_blurry, blur_score = self.check_blur(image_path)

        if is_blurry:
            return {
                'success': False,
                'status': 'blur',
                'message': self.MESSAGES['blur'],
                'need_retry': True,  # YÊU CẦU CHỤP LẠI
                'details': {
                    'blur_score': blur_score,
                    'blur_threshold': self.blur_threshold
                }
            }

        # ===== BƯỚC 2: PHÂN LOẠI =====
        predicted_class, confidence = self.classify(image_path)

        # ===== BƯỚC 3: KIỂM TRA CONFIDENCE =====
        if confidence < self.confidence_threshold:
            return {
                'success': False,
                'status': 'low_confidence',
                'message': self.MESSAGES['low_confidence'],
                'need_retry': True,  # YÊU CẦU CHỤP LẠI
                'details': {
                    'confidence': confidence,
                    'confidence_threshold': self.confidence_threshold,
                    'blur_score': blur_score
                }
            }

        # ===== BƯỚC 4: XỬ LÝ THEO CLASS =====

        # Ảnh không liên quan → Chụp lại
        if predicted_class == 'anh_khong_lien_quan':
            return {
                'success': False,
                'status': 'invalid',
                'message': self.MESSAGES['anh_khong_lien_quan'],
                'need_retry': True,  # YÊU CẦU CHỤP LẠI
                'details': {
                    'predicted_class': predicted_class,
                    'confidence': confidence,
                    'blur_score': blur_score
                }
            }

        # Giấy tờ khác → Chụp lại
        if predicted_class == 'giay_to_khac':
            return {
                'success': False,
                'status': 'wrong_document',
                'message': self.MESSAGES['giay_to_khac'],
                'need_retry': True,  # YÊU CẦU CHỤP LẠI
                'details': {
                    'predicted_class': predicted_class,
                    'confidence': confidence,
                    'blur_score': blur_score
                }
            }

        # ===== SỔ HỘ NGHÈO HỢP LỆ =====
        return {
            'success': True,
            'status': 'success',
            'message': self.MESSAGES['so_ho_ngheo'],
            'need_retry': False,
            'details': {
                'predicted_class': predicted_class,
                'confidence': confidence,
                'blur_score': blur_score
            }
        }


# ===== SỬ DỤNG =====
print("="*60)
print("🔥 KHỞI TẠO PIPELINE")
print("="*60)

verifier = PovertyCardVerifier(f'{MODELS_PATH}/document_classifier_production.pth')


#@title 16. 🧪 TEST PIPELINE
from google.colab import files
import io

print("\n📤 Upload ảnh để test:")
uploaded = files.upload()

for name, content in uploaded.items():
    # Lưu tạm
    with open(f'/tmp/{name}', 'wb') as f:
        f.write(content)

    # Verify
    result = verifier.verify(f'/tmp/{name}')

    # Hiển thị ảnh
    img = Image.open(io.BytesIO(content))
    plt.figure(figsize=(8, 6))
    plt.imshow(img)
    plt.axis('off')

    # Title với màu
    color = 'green' if result['success'] else 'red'
    plt.title(f"Status: {result['status']}", fontsize=14, color=color)
    plt.show()

    # In kết quả
    print(f"\n{'='*60}")
    print(f"📄 File: {name}")
    print(f"{'='*60}")
    print(f"\n{result['message']}")
    print(f"\n📊 Chi tiết:")
    print(f"   Status: {result['status']}")
    print(f"   Success: {result['success']}")
    print(f"   Need retry: {result['need_retry']}")

    if 'details' in result:
        d = result['details']
        if 'blur_score' in d:
            blur_status = "🔴 Mờ" if d['blur_score'] < verifier.blur_threshold else "🟢 Rõ"
            print(f"   Blur score: {d['blur_score']:.1f} {blur_status}")
        if 'confidence' in d:
            print(f"   Confidence: {d['confidence']*100:.1f}%")
        if 'predicted_class' in d:
            print(f"   Predicted: {d['predicted_class']}")

    print(f"{'='*60}")
    
#@title 🔴 STAMP DETECTION - Phát hiện con dấu đỏ
"""
PHƯƠNG PHÁP PHÁT HIỆN CON DẤU:
1. Color Detection: Tìm vùng màu đỏ (con dấu thường màu đỏ)
2. Shape Detection: Tìm hình tròn/oval (con dấu thường hình tròn)
3. Kết hợp cả 2 để tăng độ chính xác

CON DẤU SỔ HỘ NGHÈO thường có:
- Màu đỏ/đỏ đậm
- Hình tròn hoặc oval
- Kích thước trung bình (không quá nhỏ, không quá lớn)
- Có text bên trong (tên cơ quan)
"""

import cv2
import numpy as np
from PIL import Image

class StampDetector:
    """
    Phát hiện con dấu đỏ trong ảnh tài liệu
    """
    
    def __init__(self):
        # Ngưỡng màu đỏ trong HSV
        # Màu đỏ nằm ở 2 vùng trong HSV: 0-10 và 170-180
        self.lower_red1 = np.array([0, 50, 50])
        self.upper_red1 = np.array([10, 255, 255])
        self.lower_red2 = np.array([170, 50, 50])
        self.upper_red2 = np.array([180, 255, 255])
        
        # Ngưỡng kích thước con dấu (% so với ảnh)
        self.min_stamp_ratio = 0.01   # Tối thiểu 1% diện tích ảnh
        self.max_stamp_ratio = 0.15   # Tối đa 15% diện tích ảnh
        
        # Ngưỡng circularity (độ tròn)
        self.min_circularity = 0.5    # 0 = không tròn, 1 = tròn hoàn hảo
        
    def detect_red_regions(self, image):
        """
        Phát hiện vùng màu đỏ trong ảnh
        
        Args:
            image: BGR image (numpy array)
            
        Returns:
            mask: Binary mask của vùng đỏ
            red_ratio: Tỷ lệ vùng đỏ so với ảnh
        """
        # Convert sang HSV
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Tạo mask cho màu đỏ (2 vùng)
        mask1 = cv2.inRange(hsv, self.lower_red1, self.upper_red1)
        mask2 = cv2.inRange(hsv, self.lower_red2, self.upper_red2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Làm sạch mask
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Tính tỷ lệ vùng đỏ
        red_pixels = cv2.countNonZero(mask)
        total_pixels = image.shape[0] * image.shape[1]
        red_ratio = red_pixels / total_pixels
        
        return mask, red_ratio
    
    def detect_circles(self, image, mask=None):
        """
        Phát hiện hình tròn trong ảnh (có thể kết hợp với mask đỏ)
        
        Args:
            image: BGR image
            mask: Binary mask (optional) - chỉ tìm trong vùng này
            
        Returns:
            circles: List các hình tròn [(x, y, radius), ...]
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Nếu có mask, chỉ giữ vùng trong mask
        if mask is not None:
            gray = cv2.bitwise_and(gray, gray, mask=mask)
        
        # Blur để giảm nhiễu
        gray_blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        
        # Detect circles với Hough Transform
        circles = cv2.HoughCircles(
            gray_blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=50,
            param1=50,
            param2=30,
            minRadius=20,
            maxRadius=min(image.shape[0], image.shape[1]) // 4
        )
        
        if circles is not None:
            circles = np.uint16(np.around(circles[0]))
            return [(c[0], c[1], c[2]) for c in circles]
        
        return []
    
    def detect_contours(self, mask):
        """
        Phát hiện contours và lọc theo hình dạng (tròn/oval)
        
        Args:
            mask: Binary mask
            
        Returns:
            stamps: List các contour có thể là con dấu
        """
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        stamps = []
        total_area = mask.shape[0] * mask.shape[1]
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            
            # Kiểm tra kích thước
            area_ratio = area / total_area
            if area_ratio < self.min_stamp_ratio or area_ratio > self.max_stamp_ratio:
                continue
            
            # Kiểm tra độ tròn (circularity)
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
                
            circularity = 4 * np.pi * area / (perimeter ** 2)
            
            if circularity >= self.min_circularity:
                # Lấy bounding box và center
                (x, y), radius = cv2.minEnclosingCircle(cnt)
                stamps.append({
                    'contour': cnt,
                    'center': (int(x), int(y)),
                    'radius': int(radius),
                    'area': area,
                    'area_ratio': area_ratio,
                    'circularity': circularity
                })
        
        return stamps
    
    def detect_stamps(self, image):
        """
        Phát hiện con dấu trong ảnh (kết hợp color + shape detection)
        
        Args:
            image: PIL Image hoặc numpy array hoặc đường dẫn file
            
        Returns:
            dict:
                - has_stamp: bool
                - num_stamps: int
                - stamps: list of stamp info
                - red_ratio: float
                - confidence: float (0-1)
        """
        # Convert image
        if isinstance(image, str):
            img_array = cv2.imread(image)
        elif isinstance(image, Image.Image):
            img_array = np.array(image)
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_array = image.copy()
        
        # 1. Detect vùng đỏ
        red_mask, red_ratio = self.detect_red_regions(img_array)
        
        # 2. Detect contours tròn trong vùng đỏ
        stamps = self.detect_contours(red_mask)
        
        # 3. Detect circles (backup method)
        circles = self.detect_circles(img_array, red_mask)
        
        # 4. Tính confidence
        # - Có vùng đỏ đáng kể: +0.3
        # - Có contour tròn: +0.4
        # - Có circle detected: +0.3
        confidence = 0.0
        
        if red_ratio > 0.005:  # >0.5% vùng đỏ
            confidence += 0.3 * min(red_ratio / 0.02, 1.0)  # Max khi 2%
            
        if len(stamps) > 0:
            confidence += 0.4
            
        if len(circles) > 0:
            confidence += 0.3
        
        confidence = min(confidence, 1.0)
        
        has_stamp = len(stamps) > 0 or (red_ratio > 0.01 and len(circles) > 0)
        
        return {
            'has_stamp': has_stamp,
            'num_stamps': len(stamps),
            'stamps': stamps,
            'circles': circles,
            'red_ratio': red_ratio,
            'confidence': confidence
        }
    
    def visualize(self, image, result, save_path=None):
        """
        Vẽ kết quả detect lên ảnh
        """
        if isinstance(image, str):
            img = cv2.imread(image)
        elif isinstance(image, Image.Image):
            img = np.array(image)
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        else:
            img = image.copy()
        
        # Vẽ stamps (contours)
        for stamp in result['stamps']:
            cv2.circle(img, stamp['center'], stamp['radius'], (0, 255, 0), 3)
            cv2.putText(img, f"Stamp ({stamp['circularity']:.2f})", 
                       (stamp['center'][0] - 30, stamp['center'][1] - stamp['radius'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        # Vẽ circles
        for (x, y, r) in result['circles']:
            cv2.circle(img, (x, y), r, (255, 0, 0), 2)
        
        # Thêm text info
        status = "CON DẤU: CÓ ✓" if result['has_stamp'] else "CON DẤU: KHÔNG ✗"
        color = (0, 255, 0) if result['has_stamp'] else (0, 0, 255)
        cv2.putText(img, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        cv2.putText(img, f"Confidence: {result['confidence']*100:.1f}%", 
                   (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(img, f"Red ratio: {result['red_ratio']*100:.2f}%", 
                   (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        if save_path:
            cv2.imwrite(save_path, img)
        
        # Convert to RGB for display
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img_rgb


# ===== TEST STAMP DETECTOR =====
print("="*60)
print("🔴 STAMP DETECTOR - Phát hiện con dấu")
print("="*60)

stamp_detector = StampDetector()

# Test với ảnh từ dataset
print("\n🧪 Testing với ảnh từ dataset:\n")

test_results = []
for folder in ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']:
    folder_path = os.path.join(IMAGES_PATH, folder)
    if os.path.exists(folder_path):
        files = os.listdir(folder_path)[:5]  # Test 5 ảnh mỗi folder
        
        stamp_count = 0
        for f in files:
            img_path = os.path.join(folder_path, f)
            try:
                result = stamp_detector.detect_stamps(img_path)
                if result['has_stamp']:
                    stamp_count += 1
                test_results.append((folder, result['has_stamp'], result['confidence']))
            except Exception as e:
                pass
        
        print(f"   {folder}: {stamp_count}/{len(files)} có con dấu")

print("\n" + "="*60)


#@title 🔥 PIPELINE CẢI TIẾN - Thêm Stamp Detection
"""
LUỒNG XỬ LÝ MỚI:
1. Kiểm tra ảnh mờ → Nếu mờ: "Chụp lại"
2. Phát hiện con dấu → Nếu có con dấu đỏ: Boost confidence cho sổ hộ nghèo
3. Phân loại bằng AI
4. Kiểm tra confidence threshold
5. Trả kết quả
"""

class PovertyCardVerifierV2:
    """
    Pipeline xác minh sổ hộ nghèo V2 - Có thêm Stamp Detection
    """

    CLASSES = ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan']

    MESSAGES = {
        'blur': '📸 Ảnh bị mờ. Vui lòng chụp lại rõ hơn, đảm bảo đủ ánh sáng.',
        'low_confidence': '⚠️ Không nhận diện được. Vui lòng chụp lại ảnh sổ hộ nghèo rõ ràng hơn.',
        'anh_khong_lien_quan': '❌ Ảnh không hợp lệ. Vui lòng chụp lại ảnh sổ hộ nghèo của bạn.',
        'giay_to_khac': '❌ Đây không phải sổ hộ nghèo. Vui lòng chụp lại đúng sổ hộ nghèo.',
        'so_ho_ngheo': '✅ Xác minh thành công! Đây là sổ hộ nghèo hợp lệ.',
        'so_ho_ngheo_stamp': '✅ Xác minh thành công! Phát hiện con dấu chính thức.'
    }

    def __init__(self, model_path):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

        # Load model
        ckpt = torch.load(model_path, map_location=self.device)

        self.model = models.efficientnet_b0(pretrained=False)
        self.model.classifier[1] = nn.Linear(1280, len(self.CLASSES))
        self.model.load_state_dict(ckpt['model_state_dict'])
        self.model.to(self.device).eval()

        # Thresholds
        self.confidence_threshold = ckpt.get('confidence_threshold', 0.7)
        self.blur_threshold = ckpt.get('blur_threshold', 100)
        
        # Stamp detection threshold
        self.stamp_confidence_threshold = 0.5  # Nếu stamp confidence > 0.5 → boost
        self.stamp_boost = 0.15  # Boost thêm 15% confidence nếu có stamp

        # Transform
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        # Stamp detector
        self.stamp_detector = StampDetector()

        print(f"✅ Model V2 loaded!")
        print(f"   Confidence threshold: {self.confidence_threshold}")
        print(f"   Blur threshold: {self.blur_threshold}")
        print(f"   Stamp boost: +{self.stamp_boost*100:.0f}% nếu có con dấu")

    def check_blur(self, image):
        """Kiểm tra ảnh mờ"""
        if isinstance(image, str):
            img_array = cv2.imread(image)
        elif isinstance(image, Image.Image):
            img_array = np.array(image)
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        else:
            img_array = image

        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

        return blur_score < self.blur_threshold, blur_score

    def classify(self, image):
        """Phân loại ảnh"""
        if isinstance(image, str):
            image = Image.open(image)

        image = image.convert('RGB')
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            out = self.model(tensor)
            probs = torch.softmax(out, 1)
            conf, idx = torch.max(probs, 1)

        return self.CLASSES[idx.item()], conf.item(), probs[0].cpu().numpy()

    def verify(self, image_path):
        """
        Xác minh ảnh sổ hộ nghèo (V2 - có stamp detection)
        """

        # ===== BƯỚC 1: KIỂM TRA ẢNH MỜ =====
        is_blurry, blur_score = self.check_blur(image_path)

        if is_blurry:
            return {
                'success': False,
                'status': 'blur',
                'message': self.MESSAGES['blur'],
                'need_retry': True,
                'details': {
                    'blur_score': blur_score,
                    'blur_threshold': self.blur_threshold
                }
            }

        # ===== BƯỚC 2: PHÁT HIỆN CON DẤU =====
        stamp_result = self.stamp_detector.detect_stamps(image_path)
        has_stamp = stamp_result['has_stamp']
        stamp_confidence = stamp_result['confidence']

        # ===== BƯỚC 3: PHÂN LOẠI =====
        predicted_class, confidence, all_probs = self.classify(image_path)
        original_confidence = confidence
        
        # ===== BƯỚC 4: BOOST CONFIDENCE NẾU CÓ CON DẤU =====
        # Nếu có con dấu và model predict là sổ hộ nghèo → boost confidence
        if has_stamp and stamp_confidence > self.stamp_confidence_threshold:
            if predicted_class == 'so_ho_ngheo':
                confidence = min(confidence + self.stamp_boost, 1.0)
            elif predicted_class == 'giay_to_khac':
                # Nếu model nghĩ là giấy tờ khác nhưng có con dấu rõ ràng
                # → Có thể xem xét lại (nếu confidence của sổ hộ nghèo cũng cao)
                shn_prob = all_probs[self.CLASSES.index('so_ho_ngheo')]
                if shn_prob > 0.3 and stamp_confidence > 0.7:
                    # Swap sang sổ hộ nghèo nếu stamp confidence cao
                    predicted_class = 'so_ho_ngheo'
                    confidence = shn_prob + self.stamp_boost

        # ===== BƯỚC 5: KIỂM TRA CONFIDENCE =====
        if confidence < self.confidence_threshold:
            return {
                'success': False,
                'status': 'low_confidence',
                'message': self.MESSAGES['low_confidence'],
                'need_retry': True,
                'details': {
                    'confidence': confidence,
                    'original_confidence': original_confidence,
                    'confidence_threshold': self.confidence_threshold,
                    'blur_score': blur_score,
                    'has_stamp': has_stamp,
                    'stamp_confidence': stamp_confidence
                }
            }

        # ===== BƯỚC 6: XỬ LÝ THEO CLASS =====

        if predicted_class == 'anh_khong_lien_quan':
            return {
                'success': False,
                'status': 'invalid',
                'message': self.MESSAGES['anh_khong_lien_quan'],
                'need_retry': True,
                'details': {
                    'predicted_class': predicted_class,
                    'confidence': confidence,
                    'blur_score': blur_score,
                    'has_stamp': has_stamp
                }
            }

        if predicted_class == 'giay_to_khac':
            return {
                'success': False,
                'status': 'wrong_document',
                'message': self.MESSAGES['giay_to_khac'],
                'need_retry': True,
                'details': {
                    'predicted_class': predicted_class,
                    'confidence': confidence,
                    'blur_score': blur_score,
                    'has_stamp': has_stamp
                }
            }

        # ===== SỔ HỘ NGHÈO HỢP LỆ =====
        message = self.MESSAGES['so_ho_ngheo_stamp'] if has_stamp else self.MESSAGES['so_ho_ngheo']
        
        return {
            'success': True,
            'status': 'success',
            'message': message,
            'need_retry': False,
            'details': {
                'predicted_class': predicted_class,
                'confidence': confidence,
                'original_confidence': original_confidence,
                'confidence_boosted': confidence > original_confidence,
                'blur_score': blur_score,
                'has_stamp': has_stamp,
                'stamp_confidence': stamp_confidence,
                'num_stamps': stamp_result['num_stamps']
            }
        }


# ===== KHỞI TẠO PIPELINE V2 =====
print("\n" + "="*60)
print("🔥 KHỞI TẠO PIPELINE V2 (có Stamp Detection)")
print("="*60)

verifier_v2 = PovertyCardVerifierV2(f'{MODELS_PATH}/document_classifier_production.pth')


#@title 🧪 TEST PIPELINE V2 - So sánh với V1
"""
Test và so sánh kết quả giữa V1 (không có stamp) và V2 (có stamp detection)
"""

print("\n" + "="*60)
print("🧪 SO SÁNH V1 vs V2")
print("="*60)

# Test với một số ảnh
comparison_results = []

for folder in ['so_ho_ngheo', 'giay_to_khac']:
    folder_path = os.path.join(IMAGES_PATH, folder)
    if os.path.exists(folder_path):
        files = os.listdir(folder_path)[:10]
        
        for f in files:
            img_path = os.path.join(folder_path, f)
            try:
                # V1 result
                result_v1 = verifier.verify(img_path)
                
                # V2 result  
                result_v2 = verifier_v2.verify(img_path)
                
                comparison_results.append({
                    'file': f,
                    'actual': folder,
                    'v1_status': result_v1['status'],
                    'v1_conf': result_v1['details'].get('confidence', 0),
                    'v2_status': result_v2['status'],
                    'v2_conf': result_v2['details'].get('confidence', 0),
                    'has_stamp': result_v2['details'].get('has_stamp', False),
                    'boosted': result_v2['details'].get('confidence_boosted', False)
                })
            except:
                pass

# Hiển thị kết quả
print(f"\n{'File':<30} {'Actual':<15} {'V1':<12} {'V2':<12} {'Stamp':<8} {'Boosted':<8}")
print("-"*90)

for r in comparison_results[:20]:  # Hiển thị 20 kết quả đầu
    stamp_icon = "🔴" if r['has_stamp'] else "⚪"
    boost_icon = "⬆️" if r['boosted'] else ""
    print(f"{r['file'][:28]:<30} {r['actual']:<15} {r['v1_conf']*100:>5.1f}% {r['v2_conf']*100:>8.1f}% {stamp_icon:<8} {boost_icon:<8}")

# Thống kê
print("\n📊 THỐNG KÊ:")
boosted_count = sum(1 for r in comparison_results if r['boosted'])
stamp_count = sum(1 for r in comparison_results if r['has_stamp'])
print(f"   Tổng ảnh test: {len(comparison_results)}")
print(f"   Ảnh có con dấu: {stamp_count}")
print(f"   Ảnh được boost confidence: {boosted_count}")


#@title 💾 EXPORT MODEL V2
"""
Export model với stamp detection config
"""

# Load model gốc
checkpoint = torch.load(f'{MODELS_PATH}/document_classifier_best.pth')

# Export với config mới
export_data_v2 = {
    'model_state_dict': checkpoint['model_state_dict'],
    'classes': CLASSES,
    'class_to_idx': CLASS_TO_IDX,
    'idx_to_class': IDX_TO_CLASS,
    'accuracy': checkpoint['val_acc'],
    'confidence_threshold': 0.7,
    'blur_threshold': 100,
    # Stamp detection config
    'stamp_detection': {
        'enabled': True,
        'stamp_confidence_threshold': 0.5,
        'stamp_boost': 0.15
    }
}

torch.save(export_data_v2, f'{MODELS_PATH}/document_classifier_v2.pth')

# Model info
model_info_v2 = {
    'model': 'EfficientNet-B0 + StampDetection',
    'version': '2.0',
    'num_classes': len(CLASSES),
    'classes': CLASSES,
    'thresholds': {
        'confidence': 0.7,
        'blur': 100,
        'stamp_confidence': 0.5,
        'stamp_boost': 0.15
    },
    'features': [
        'Blur Detection (Laplacian Variance)',
        'Document Classification (EfficientNet-B0)',
        'Stamp Detection (Color + Shape)',
        'Confidence Boosting'
    ],
    'responses': {
        'blur_detected': 'Ảnh bị mờ. Vui lòng chụp lại rõ hơn.',
        'low_confidence': 'Không xác định được. Vui lòng chụp lại.',
        'anh_khong_lien_quan': 'Ảnh không hợp lệ.',
        'giay_to_khac': 'Đây không phải sổ hộ nghèo.',
        'so_ho_ngheo': 'Xác minh thành công!',
        'so_ho_ngheo_stamp': 'Xác minh thành công! Phát hiện con dấu chính thức.'
    }
}

with open(f'{MODELS_PATH}/model_info_v2.json', 'w', encoding='utf-8') as f:
    json.dump(model_info_v2, f, ensure_ascii=False, indent=2)

print("✅ Exported Model V2!")
print(f"   📁 {MODELS_PATH}/document_classifier_v2.pth")
print(f"   📁 {MODELS_PATH}/model_info_v2.json")

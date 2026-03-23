# Backend - Hệ Thống Xác Minh Sổ Hộ Nghèo

> Django REST Framework + AI Pipeline + Supabase  
> Khóa luận tốt nghiệp - Võ Huỳnh Thái Bảo (2201700186)

---

## Cài Đặt Nhanh (Windows)

### Cách 1: Chạy file setup tự động
```
Nhấp đúp setup.bat
```
Setup sẽ tự tạo venv, cài packages, tạo .env, migrate database.

### Cách 2: Cài thủ công trong CMD/PowerShell
```cmd
:: 1. Tạo virtual environment
python -m venv venv
venv\Scripts\activate

:: 2. Cài dependencies
pip install -r requirements.txt

:: 3. Nếu lỗi cài torch, chạy riêng:
install_pytorch.bat

:: 4. Cấu hình environment
copy .env.example .env
:: Mở .env và điền Supabase keys

:: 5. Khởi tạo Django
python manage.py migrate

:: 6. Chạy server
python manage.py runserver 8000
```

### Chạy server hàng ngày
```
Nhấp đúp run.bat
```

Server chạy tại: `http://localhost:8000`

---

## Cấu Hình .env

```env
# Lấy từ Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# AI Thresholds (Section 2.4.1)
BLUR_THRESHOLD=100
CONFIDENCE_THRESHOLD=0.7

# Model path
EFFICIENTNET_MODEL_PATH=models/efficientnet_b0_poverty.pth
```

---

## API Endpoints

### `POST /api/verify/` — Xác minh ảnh (UC03)

Endpoint chính. Nhận ảnh, chạy AI Pipeline 5 bước, lưu kết quả vào Supabase.

**Request:** `multipart/form-data`
```
image:     File (JPG/PNG/BMP, max 5MB)   [bắt buộc]
user_id:   string (Supabase Auth UUID)    [bắt buộc]
latitude:  float                          [tùy chọn]
longitude: float                          [tùy chọn]
address:   string                         [tùy chọn]
```

**Response thành công:**
```json
{
  "success": true,
  "status": "success",
  "message": "Xac minh thanh cong!",
  "need_retry": false,
  "data": {
    "id": 1,
    "verification_code": "VF-A1B2C3D4",
    "predicted_class": "so_ho_ngheo",
    "confidence": 0.947,
    "blur_score": 245.8,
    "extracted_text": "Ho va ten: Nguyen Van A...",
    "household_name": "Nguyen Van A",
    "household_address": "123 Duong ABC, Quan 1",
    "processing_time_ms": 2110
  }
}
```

**Response ảnh mờ:**
```json
{
  "success": false,
  "status": "blur",
  "message": "Anh bi mo. Vui long chup lai.",
  "need_retry": true,
  "data": {
    "blur_score": 45.2,
    "confidence": null
  }
}
```

**Response confidence thấp:**
```json
{
  "success": false,
  "status": "low_confidence",
  "message": "Khong nhan dien duoc. Vui long chup lai.",
  "need_retry": true,
  "data": {
    "confidence": 0.52,
    "blur_score": 180.5
  }
}
```

### `GET /api/result/<id>/` — Xem kết quả (UC04)

### `GET /api/history/?user_id=xxx` — Lịch sử xác minh (UC05)

### `GET /api/admin/dashboard/` — Thống kê (UC08)

### `GET /api/admin/requests/?status=pending` — Danh sách yêu cầu (UC07)

### `POST /api/admin/review/` — Duyệt yêu cầu (UC07)
```json
{ "request_id": 1, "admin_id": "uuid", "notes": "Da duyet" }
```

### `GET /api/health/` — Health check

---

## Thêm Model AI

### Bước 1: EfficientNet-B0 (Phân loại tài liệu)

Sau khi huấn luyện trên Google Colab (Bảng 2.4), lưu model:

```python
# Trên Google Colab, sau khi train xong:
torch.save({
    'model_state_dict': model.state_dict(),
    'confidence_threshold': 0.7,
    'blur_threshold': 100,
    'classes': ['so_ho_ngheo', 'giay_to_khac', 'anh_khong_lien_quan'],
    'accuracy': 0.89,
}, 'efficientnet_b0_poverty.pth')
```

Copy file vào:
```
backend/models/efficientnet_b0_poverty.pth
```

Backend tự động load khi khởi động. Kiểm tra:
```bash
curl http://localhost:8000/api/health/
# Xem "ai_model_loaded": true
```

### Bước 2: VietOCR (Trích xuất text)

VietOCR tự động download model khi lần đầu chạy:
```bash
pip install vietocr
```

Không cần config thêm. Model sẽ load config `vgg_transformer` mặc định.

---

## Pipeline Chi Tiết

```
Upload ảnh
    │
    ▼
┌─────────────────────────────────┐
│  Bước 1: Blur Detection        │  ~0.1s
│  Laplacian Variance             │
│  threshold = 100                │
│  blur_score < 100 → "Ảnh mờ"   │
└──────────┬──────────────────────┘
           │ ảnh rõ
           ▼
┌─────────────────────────────────┐
│  Bước 2: Classification        │  ~0.5s
│  EfficientNet-B0                │
│  3 classes:                     │
│    - so_ho_ngheo                │
│    - giay_to_khac               │
│    - anh_khong_lien_quan        │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Bước 3: Confidence Check      │  ~0.01s
│  threshold = 0.7                │
│  confidence < 0.7 → "Không     │
│  nhận diện được"                │
└──────────┬──────────────────────┘
           │ confidence >= 0.7
           ▼
┌─────────────────────────────────┐
│  Bước 4: Class Handling        │  ~0.01s
│  anh_khong_lien_quan → failed   │
│  giay_to_khac → failed          │
│  so_ho_ngheo → bước 5           │
└──────────┬──────────────────────┘
           │ so_ho_ngheo
           ▼
┌─────────────────────────────────┐
│  Bước 5: OCR (VietOCR)         │  ~1.5s
│  Trích xuất text                │
│  Parse: tên, địa chỉ, mã hộ   │
│  → "Xác minh thành công!"      │
└─────────────────────────────────┘

Tổng thời gian: ~2.1s (target < 5s)
```

---

## Test Nhanh (Windows)

### Cách 1: Chạy file test tự động
```
Nhấp đúp test_api.bat
```

### Cách 2: Test thủ công trong CMD
```cmd
:: Kích hoạt venv
venv\Scripts\activate

:: Health check
python -c "import requests; print(requests.get('http://localhost:8000/api/health/').json())"

:: Xác minh ảnh
curl -X POST http://localhost:8000/api/verify/ -F "image=@test_image.jpg" -F "user_id=your-id"

:: Admin dashboard
python -c "import requests; print(requests.get('http://localhost:8000/api/admin/dashboard/').json())"
```

---

## Kết Nối Frontend (Next.js)

Trong frontend Next.js, gọi API:

```typescript
const formData = new FormData()
formData.append('image', file)
formData.append('user_id', user.id)
formData.append('latitude', String(location.latitude))
formData.append('longitude', String(location.longitude))

const response = await fetch('http://localhost:8000/api/verify/', {
  method: 'POST',
  body: formData,
})

const result = await response.json()
```

Thêm vào `.env.local` của frontend:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

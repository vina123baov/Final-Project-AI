"""
API URLs
Khoa luan: Phu luc A.2 (API Documentation)

Endpoints:
    POST /api/verify/               UC03: Upload + AI Pipeline
    GET  /api/result/<id>/          UC04: Xem ket qua
    GET  /api/history/?user_id=     UC05: Lich su xac minh
    GET  /api/admin/dashboard/      UC08: Thong ke
    GET  /api/admin/requests/       UC07: Danh sach yeu cau
    POST /api/admin/review/         UC07: Duyet yeu cau
    GET  /api/health/               Health check
"""
from django.urls import path
from . import views

urlpatterns = [
    # User endpoints
    path('verify/', views.verify_image, name='verify-image'),
    path('result/<int:request_id>/', views.get_result, name='get-result'),
    path('history/', views.get_history, name='get-history'),

    # Admin endpoints
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('admin/requests/', views.admin_requests, name='admin-requests'),
    path('admin/review/', views.admin_review, name='admin-review'),

    # System
    path('health/', views.health_check, name='health-check'),
]

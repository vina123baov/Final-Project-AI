"""
API URLs
Phu luc A.2 (API Documentation) + JWT Auth (Section 2.1.2)

Endpoints:
    POST /api/auth/login/           Dang nhap -> JWT tokens
    POST /api/auth/register/        Dang ky tai khoan
    POST /api/auth/refresh/         Refresh JWT token
    GET  /api/auth/me/              Lay thong tin user hien tai

    POST /api/verify/               UC03: Upload + AI Pipeline
    GET  /api/result/<id>/          UC04: Xem ket qua
    GET  /api/history/              UC05: Lich su xac minh

    GET  /api/admin/dashboard/      UC08: Thong ke
    GET  /api/admin/requests/       UC07: Danh sach yeu cau
    POST /api/admin/review/         UC07: Duyet yeu cau
    GET  /api/admin/users/          UC06: Quan ly nguoi dung
    POST /api/admin/users/toggle/   UC06: Khoa/mo khoa tai khoan

    GET  /api/health/               Health check
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth (Section 2.1.2: JWT Authentication)
    path('auth/login/', views.auth_login, name='auth-login'),
    path('auth/register/', views.auth_register, name='auth-register'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', views.auth_me, name='auth-me'),

    # User endpoints
    path('verify/', views.verify_image, name='verify-image'),
    path('result/<int:request_id>/', views.get_result, name='get-result'),
    path('history/', views.get_history, name='get-history'),

    # Admin endpoints
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('admin/requests/', views.admin_requests, name='admin-requests'),
    path('admin/review/', views.admin_review, name='admin-review'),
    path('admin/users/', views.admin_users, name='admin-users'),
    path('admin/users/toggle/', views.admin_toggle_user, name='admin-toggle-user'),

    # System
    path('health/', views.health_check, name='health-check'),
]
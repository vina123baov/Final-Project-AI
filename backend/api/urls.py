from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.auth_login, name='auth-login'),
    path('auth/register/', views.auth_register, name='auth-register'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', views.auth_me, name='auth-me'),

    # User endpoints
    path('verify/', views.verify_image, name='verify-image'),
    path('result/<int:request_id>/', views.get_result, name='get-result'),
    path('history/', views.get_history, name='get-history'),

    # NEW: lay vi tri cac ho da xac minh de hien thi tren map
    path('verified-locations/', views.get_verified_locations, name='verified-locations'),

    # Admin endpoints
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('admin/requests/', views.admin_requests, name='admin-requests'),
    path('admin/review/', views.admin_review, name='admin-review'),
    path('admin/users/', views.admin_users, name='admin-users'),
    path('admin/users/toggle/', views.admin_toggle_user, name='admin-toggle-user'),

    # System
    path('health/', views.health_check, name='health-check'),
]
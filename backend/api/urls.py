from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('auth/login/', views.auth_login, name='auth-login'),
    path('auth/register/', views.auth_register, name='auth-register'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', views.auth_me, name='auth-me'),

    # User endpoints (UC03, UC04, UC05)
    path('verify/', views.verify_image, name='verify-image'),
    path('result/<int:request_id>/', views.get_result, name='get-result'),
    path('history/', views.get_history, name='get-history'),
    path('verified-locations/', views.get_verified_locations, name='verified-locations'),

    # Admin endpoints (UC06, UC07, UC08)
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('admin/requests/', views.admin_requests, name='admin-requests'),
    path('admin/review/', views.admin_review, name='admin-review'),
    path('admin/users/', views.admin_users, name='admin-users'),
    path('admin/users/toggle/', views.admin_toggle_user, name='admin-toggle-user'),
       
    # System
    path('health/', views.health_check, name='health-check'),
]
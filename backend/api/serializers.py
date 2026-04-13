from rest_framework import serializers


class VerifyImageSerializer(serializers.Serializer):
    """
    POST /api/verify/
    Phu luc A.2: Upload anh de xac minh
    """
    image = serializers.ImageField(
        required=False,
        help_text='Anh so ho ngheo (JPG, PNG, BMP, max 5MB)'
    )
    user_id = serializers.CharField(
        required=False,
        help_text='Supabase Auth user ID'
    )
    latitude = serializers.FloatField(
        required=False,
        help_text='Vi do nguoi dung'
    )
    longitude = serializers.FloatField(
        required=False,
        help_text='Kinh do nguoi dung'
    )
    address = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='Dia chi nguoi dung'
    )

    def validate_image(self, value):
        # Hinh 4.2: max 5MB
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Kich thuoc anh khong duoc vuot qua 5MB')

        # Hinh 4.2: JPG, PNG, BMP
        allowed_types = ['image/jpeg', 'image/png', 'image/bmp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                f'Dinh dang khong ho tro: {value.content_type}. Chi chap nhan: JPG, PNG, BMP'
            )

        return value


class VerificationResultSerializer(serializers.Serializer):
    """
    Response format (Phu luc A.3-A.5)
    """
    success = serializers.BooleanField()
    status = serializers.CharField()
    result_type = serializers.CharField(allow_null=True)
    message = serializers.CharField()
    need_retry = serializers.BooleanField()
    data = serializers.DictField()


class HistorySerializer(serializers.Serializer):
    """UC05: Lich su xac minh"""
    id = serializers.IntegerField()
    status = serializers.CharField()
    result_type = serializers.CharField(allow_null=True)
    confidence = serializers.FloatField(allow_null=True)
    blur_score = serializers.FloatField(allow_null=True)
    message = serializers.CharField(allow_null=True)
    need_retry = serializers.BooleanField()
    verification_code = serializers.CharField(allow_null=True)
    created_at = serializers.CharField()
    result_message = serializers.CharField()


class AdminDashboardSerializer(serializers.Serializer):
    """UC08: Thong ke admin"""
    total_active_users = serializers.IntegerField()
    total_admins = serializers.IntegerField()
    total_requests = serializers.IntegerField()
    total_success = serializers.IntegerField()
    total_failed = serializers.IntegerField()
    total_pending = serializers.IntegerField()
    avg_confidence = serializers.FloatField()
    avg_blur_score = serializers.FloatField()
    avg_processing_time_ms = serializers.FloatField()
    success_rate_percent = serializers.FloatField()

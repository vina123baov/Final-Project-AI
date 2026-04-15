from rest_framework import serializers


class VerifyImageSerializer(serializers.Serializer):
    image = serializers.ImageField(required=False)
    user_id = serializers.CharField(required=False)
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    address = serializers.CharField(required=False, allow_blank=True)
    # MOI: vat dung tiep te
    support_categories = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=[]
    )

    def validate_image(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Kich thuoc anh khong duoc vuot qua 5MB')
        allowed_types = ['image/jpeg', 'image/png', 'image/bmp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(f'Dinh dang khong ho tro: {value.content_type}')
        return value
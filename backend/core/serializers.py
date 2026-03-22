"""
Serializers for Burma Meat Point – covering all models with input sanitization.
"""

import bleach
from rest_framework import serializers
from .models import (
    User, VendorDetails, VendorRequest,
    Rating, VendorReply, FlaggedReview, RatingAlgorithmConfig,
    ShopNameChangeRequest
)


def sanitize_text(value):
    """Strip all HTML tags from user-provided text (XSS prevention)."""
    if value:
        return bleach.clean(value, tags=[], strip=True).strip()
    return value


# ──────────────────────────────────────────────────────────────────────────────
# AUTH SERIALIZERS
# ──────────────────────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'phone', 'password', 'confirm_password']

    def validate_name(self, value):
        return sanitize_text(value)

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'password': "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        phone = validated_data.get('phone')
        if not phone:
            phone = None
            
        # SECURITY: role is always Consumer on registration
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            phone=phone,
            password=validated_data['password'],
            role='Consumer',
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Read-only user profile."""
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'phone', 'role', 'status', 'is_vendor_approved', 'date_joined']
        read_only_fields = ['role', 'status', 'is_vendor_approved', 'date_joined']


class UserUpdateSerializer(serializers.ModelSerializer):
    """Allow user to update their name/phone only."""
    class Meta:
        model = User
        fields = ['name', 'phone']

    def validate_name(self, value):
        return sanitize_text(value)


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR SERIALIZERS
# ──────────────────────────────────────────────────────────────────────────────

class VendorDetailsSerializer(serializers.ModelSerializer):
    vendor_name = serializers.ReadOnlyField(source='vendor.name')
    vendor_email = serializers.ReadOnlyField(source='vendor.email')
    vendor_status = serializers.ReadOnlyField(source='vendor.status')

    class Meta:
        model = VendorDetails
        fields = [
            'id', 'vendor', 'vendor_name', 'vendor_email', 'vendor_status',
            'shop_name', 'location', 'kebs_license', 'meat_types', 'price_range',
            'description', 'profile_image', 'meat_photo',
            'hygiene_score', 'freshness_score', 'service_score', 'overall_score',
            'total_ratings', 'created_at',
        ]
        read_only_fields = [
            'vendor', 'hygiene_score', 'freshness_score',
            'service_score', 'overall_score', 'total_ratings', 'created_at',
        ]

    def validate_description(self, value):
        return sanitize_text(value)

    def validate_shop_name(self, value):
        return sanitize_text(value)


class VendorListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list/carousel views."""
    vendor_name = serializers.ReadOnlyField(source='vendor.name')

    class Meta:
        model = VendorDetails
        fields = [
            'id', 'vendor_name', 'shop_name', 'location',
            'meat_types', 'price_range', 'profile_image', 'meat_photo',
            'overall_score', 'hygiene_score', 'total_ratings',
        ]


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR REQUEST
# ──────────────────────────────────────────────────────────────────────────────

class VendorRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.ReadOnlyField(source='user.name')

    class Meta:
        model = VendorRequest
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'shop_name', 'location', 'kebs_license', 'meat_types',
            'price_range', 'description', 'status',
            'submitted_date', 'reviewed_date', 'admin_notes',
        ]
        read_only_fields = ['user', 'status', 'submitted_date', 'reviewed_date', 'admin_notes']

    def validate_shop_name(self, value):
        return sanitize_text(value)

    def validate_description(self, value):
        return sanitize_text(value)

    def validate_location(self, value):
        return sanitize_text(value)


# ──────────────────────────────────────────────────────────────────────────────
# RATING
# ──────────────────────────────────────────────────────────────────────────────

class RatingSerializer(serializers.ModelSerializer):
    consumer_name = serializers.SerializerMethodField()
    vendor_reply = serializers.SerializerMethodField()

    class Meta:
        model = Rating
        fields = [
            'id', 'vendor', 'consumer', 'consumer_name', 'anonymous_mode',
            'hygiene_score', 'freshness_score', 'service_score', 'comment',
            'is_flagged', 'timestamp', 'vendor_reply',
        ]
        read_only_fields = ['consumer', 'is_flagged', 'timestamp']

    def get_consumer_name(self, obj):
        if obj.anonymous_mode:
            return "Anonymous"
        return obj.consumer.name if obj.consumer else "Unknown"

    def get_vendor_reply(self, obj):
        if hasattr(obj, 'reply'):
            return {
                'id': obj.reply.id,
                'text': obj.reply.reply_text,
                'created_at': obj.reply.created_at,
            }
        return None

    def validate_comment(self, value):
        return sanitize_text(value)

    def validate(self, data):
        for field in ['hygiene_score', 'freshness_score', 'service_score']:
            val = data.get(field)
            if val and (val < 1 or val > 5):
                raise serializers.ValidationError({field: "Score must be between 1 and 5."})
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        anonymous = validated_data.get('anonymous_mode', False)
        if anonymous:
            validated_data['consumer'] = None
        else:
            validated_data['consumer'] = request.user
        return super().create(validated_data)


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR REPLY
# ──────────────────────────────────────────────────────────────────────────────

class VendorReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorReply
        fields = ['id', 'rating', 'reply_text', 'created_at', 'updated_at']
        read_only_fields = ['rating', 'created_at', 'updated_at']

    def validate_reply_text(self, value):
        return sanitize_text(value)


# ──────────────────────────────────────────────────────────────────────────────
# FLAGGED REVIEW
# ──────────────────────────────────────────────────────────────────────────────

class FlaggedReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = FlaggedReview
        fields = ['id', 'rating', 'flagged_by', 'reason', 'status', 'submitted_at', 'resolved_at', 'admin_notes']
        read_only_fields = ['flagged_by', 'status', 'submitted_at', 'resolved_at', 'admin_notes']

    def validate_reason(self, value):
        return sanitize_text(value)


# ──────────────────────────────────────────────────────────────────────────────
# RATING ALGORITHM CONFIG
# ──────────────────────────────────────────────────────────────────────────────

class RatingAlgorithmConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = RatingAlgorithmConfig
        fields = ['hygiene_weight', 'freshness_weight', 'service_weight', 'updated_at']
        read_only_fields = ['updated_at']

    def validate(self, data):
        hw = float(data.get('hygiene_weight', 0))
        fw = float(data.get('freshness_weight', 0))
        sw = float(data.get('service_weight', 0))
        total = hw + fw + sw
        if abs(total - 1.0) > 0.001:
            raise serializers.ValidationError(
                f"Weights must sum to 1.0 (100%). Current sum: {total:.3f}"
            )
        return data


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR PROFILE UPDATE & SHOP NAME REQUESTS
# ──────────────────────────────────────────────────────────────────────────────

class VendorProfileUpdateSerializer(serializers.ModelSerializer):
    """Allows vendors to securely update their public display info."""
    meat_types = serializers.CharField(allow_blank=True, required=False, validators=[sanitize_text])
    price_range = serializers.CharField(allow_blank=True, required=False, validators=[sanitize_text])
    meat_photo = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = VendorDetails
        fields = ['meat_types', 'price_range', 'profile_image', 'meat_photo']


class ShopNameChangeRequestSerializer(serializers.ModelSerializer):
    vendor_email = serializers.CharField(source='vendor.email', read_only=True)
    new_name = serializers.CharField(validators=[sanitize_text])

    class Meta:
        model = ShopNameChangeRequest
        fields = '__all__'
        read_only_fields = ['vendor', 'old_name', 'status', 'request_date', 'reviewed_date', 'admin_notes']

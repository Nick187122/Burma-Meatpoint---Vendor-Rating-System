"""
Django admin configuration for Burma Meat Point.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, VendorDetails, VendorRequest,
    Rating, VendorReply, FlaggedReview, RatingAlgorithmConfig
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'name', 'role', 'status', 'is_vendor_approved', 'date_joined']
    list_filter = ['role', 'status', 'is_vendor_approved']
    search_fields = ['email', 'name', 'phone']
    ordering = ['-date_joined']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('name', 'phone')}),
        ('Role & Status', {'fields': ('role', 'status', 'is_vendor_approved')}),
        ('Security', {'fields': ('login_attempts', 'account_locked', 'locked_until', 'permanently_locked')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'phone', 'password1', 'password2', 'role'),
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        # Prevent any UI promotion to Admin
        if obj and not request.user.is_superuser:
            return ['role', 'is_staff', 'is_superuser']
        return []


@admin.register(VendorDetails)
class VendorDetailsAdmin(admin.ModelAdmin):
    list_display = ['shop_name', 'location', 'meat_types', 'overall_score', 'total_ratings']
    list_filter = ['meat_types', 'price_range']
    search_fields = ['shop_name', 'location', 'kebs_license']
    readonly_fields = ['hygiene_score', 'freshness_score', 'service_score', 'overall_score', 'total_ratings']


@admin.register(VendorRequest)
class VendorRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'shop_name', 'location', 'status', 'submitted_date']
    list_filter = ['status']
    search_fields = ['user__email', 'shop_name']
    readonly_fields = ['submitted_date', 'reviewed_date']


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ['vendor', 'consumer', 'anonymous_mode', 'hygiene_score', 'freshness_score', 'service_score', 'is_flagged', 'timestamp']
    list_filter = ['is_flagged', 'anonymous_mode']
    search_fields = ['vendor__shop_name', 'consumer__email']
    readonly_fields = ['timestamp']


@admin.register(FlaggedReview)
class FlaggedReviewAdmin(admin.ModelAdmin):
    list_display = ['rating', 'flagged_by', 'reason', 'status', 'submitted_at']
    list_filter = ['status']


@admin.register(RatingAlgorithmConfig)
class RatingConfigAdmin(admin.ModelAdmin):
    list_display = ['hygiene_weight', 'freshness_weight', 'service_weight', 'updated_at', 'updated_by']
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        # Only one config row allowed (singleton)
        return not RatingAlgorithmConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

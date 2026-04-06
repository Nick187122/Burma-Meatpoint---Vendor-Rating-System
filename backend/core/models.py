"""
Core models for Burma Meat Point – Vendor Rating System.
Implements: User (Consumer/Vendor), VendorDetails, VendorRequest, Rating,
            RatingAlgorithmConfig, VendorReply, FlaggedReview.
DB indexes applied on heavily-queried columns per spec.
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from datetime import timedelta


# ──────────────────────────────────────────────────────────────────────────────
# USER MANAGER
# ──────────────────────────────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not name:
            raise ValueError('Name is required')
        email = self.normalize_email(email)
        # SECURITY: Prevent any non-superuser from being an Admin
        if extra_fields.get('role') == 'Admin' and not extra_fields.get('is_superuser'):
            raise ValueError('Cannot assign Admin role through normal registration.')
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'Admin')
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, name, password, **extra_fields)


# ──────────────────────────────────────────────────────────────────────────────
# USER MODEL
# ──────────────────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('Consumer', 'Consumer'),
        ('Vendor', 'Vendor'),
        ('Admin', 'Admin'),
    )
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Suspended', 'Suspended'),
    )

    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Consumer', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    is_vendor_approved = models.BooleanField(default=False)

    # Account lock / security
    login_attempts = models.IntegerField(default=0)
    account_locked = models.BooleanField(default=False)
    locked_until = models.DateTimeField(null=True, blank=True)
    permanently_locked = models.BooleanField(default=False)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=False)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['email']),
        ]
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.email} ({self.role})"

    def lock_account(self, minutes=5, permanent=False):
        if permanent:
            self.permanently_locked = True
            self.account_locked = True
            self.locked_until = None
        else:
            self.account_locked = True
            self.locked_until = timezone.now() + timedelta(minutes=minutes)
        self.save()

    def unlock_account(self):
        self.account_locked = False
        self.permanently_locked = False
        self.locked_until = None
        self.login_attempts = 0
        self.save()

    def is_locked(self):
        if self.permanently_locked:
            return True
        if self.account_locked and self.locked_until:
            if timezone.now() < self.locked_until:
                return True
            else:
                self.account_locked = False
                self.locked_until = None
                self.save()
                return False
        return False


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR DETAILS
# ──────────────────────────────────────────────────────────────────────────────

class VendorDetails(models.Model):
    MEAT_TYPE_CHOICES = [
        ('Beef', 'Beef'),
        ('Goat', 'Goat'),
        ('Poultry', 'Poultry'),
        ('Pork', 'Pork'),
        ('Mixed', 'Mixed'),
    ]

    vendor = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='vendor_details',
        limit_choices_to={'role': 'Vendor'}
    )
    shop_name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, db_index=True)
    kebs_license = models.CharField(max_length=100, unique=True)
    meat_types = models.CharField(max_length=200, default='Mixed')  # e.g. "Beef,Goat"
    price_range = models.CharField(max_length=50, blank=True, null=True)  # e.g. "Low", "Medium", "High"
    description = models.TextField(blank=True, null=True)
    profile_image = models.URLField(blank=True, null=True)
    meat_photo = models.TextField(blank=True, null=True)  # Base64 image payload
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Composite rating scores (updated on every new Rating)
    hygiene_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, db_index=True)
    freshness_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    service_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    overall_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, db_index=True)
    total_ratings = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['location']),
            models.Index(fields=['hygiene_score']),
            models.Index(fields=['overall_score']),
            models.Index(fields=['meat_types']),
        ]
        verbose_name = 'Vendor Details'

    def __str__(self):
        return self.shop_name

    def recalculate_scores(self, config=None):
        """Recalculate composite scores using current rating algorithm weights."""
        from django.db.models import Avg
        ratings = self.vendor_ratings.all()
        if not ratings.exists():
            self.hygiene_score = 0
            self.freshness_score = 0
            self.service_score = 0
            self.overall_score = 0
            self.total_ratings = 0
            self.save(update_fields=[
                'hygiene_score',
                'freshness_score',
                'service_score',
                'overall_score',
                'total_ratings',
                'updated_at',
            ])
            return

        if config is None:
            config = RatingAlgorithmConfig.get_config()

        aggs = ratings.aggregate(
            avg_hygiene=Avg('hygiene_score'),
            avg_freshness=Avg('freshness_score'),
            avg_service=Avg('service_score'),
        )
        h = float(aggs['avg_hygiene'] or 0)
        f = float(aggs['avg_freshness'] or 0)
        s = float(aggs['avg_service'] or 0)
        hw = float(config.hygiene_weight)
        fw = float(config.freshness_weight)
        sw = float(config.service_weight)

        self.hygiene_score = round(h, 2)
        self.freshness_score = round(f, 2)
        self.service_score = round(s, 2)
        self.overall_score = round(h * hw + f * fw + s * sw, 2)
        self.total_ratings = ratings.count()
        self.save()


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR REQUEST (Become a Vendor application)
# ──────────────────────────────────────────────────────────────────────────────

class VendorRequest(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vendor_requests')
    shop_name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    kebs_license = models.CharField(max_length=100)
    meat_types = models.CharField(max_length=200, default='Mixed')
    price_range = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending', db_index=True)
    submitted_date = models.DateTimeField(auto_now_add=True)
    reviewed_date = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['submitted_date']),
        ]
        ordering = ['-submitted_date']

    def __str__(self):
        return f"{self.user.email} – {self.shop_name} ({self.status})"


# ──────────────────────────────────────────────────────────────────────────────
# RATING
# ──────────────────────────────────────────────────────────────────────────────

class Rating(models.Model):
    SCORE_CHOICES = [(i, str(i)) for i in range(1, 6)]

    vendor = models.ForeignKey(
        VendorDetails,
        on_delete=models.CASCADE,
        related_name='vendor_ratings',
        db_index=True
    )
    consumer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='given_ratings',
        limit_choices_to={'role': 'Consumer'},
        null=True,
        blank=True  # NULL when anonymous
    )
    anonymous_mode = models.BooleanField(default=False)

    hygiene_score = models.IntegerField(choices=SCORE_CHOICES)
    freshness_score = models.IntegerField(choices=SCORE_CHOICES)
    service_score = models.IntegerField(choices=SCORE_CHOICES)
    comment = models.TextField(blank=True, null=True, max_length=1000)

    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=255, blank=True, null=True)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['vendor', 'timestamp']),
            models.Index(fields=['consumer']),
            models.Index(fields=['is_flagged']),
        ]
        ordering = ['-timestamp']
        # Prevent duplicate ratings: one per consumer per vendor
        constraints = [
            models.UniqueConstraint(
                fields=['vendor', 'consumer'],
                condition=models.Q(anonymous_mode=False),
                name='unique_consumer_vendor_rating'
            )
        ]

    def __str__(self):
        consumer_label = "Anonymous" if self.anonymous_mode else (self.consumer.name if self.consumer else "Unknown")
        return f"Rating by {consumer_label} for {self.vendor.shop_name}"

    def average_score(self):
        return (self.hygiene_score + self.freshness_score + self.service_score) / 3.0

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculate vendor scores after every new/updated rating
        self.vendor.recalculate_scores()

    def delete(self, *args, **kwargs):
        vendor = self.vendor
        result = super().delete(*args, **kwargs)
        vendor.recalculate_scores()
        return result


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR REPLY TO REVIEW
# ──────────────────────────────────────────────────────────────────────────────

class VendorReply(models.Model):
    rating = models.OneToOneField(Rating, on_delete=models.CASCADE, related_name='reply')
    vendor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='replies')
    reply_text = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reply by {self.vendor.email} on rating #{self.rating.id}"


# ──────────────────────────────────────────────────────────────────────────────
# FLAGGED REVIEW (Admin dispute queue)
# ──────────────────────────────────────────────────────────────────────────────

class FlaggedReview(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Resolved', 'Resolved'),
        ('Dismissed', 'Dismissed'),
    )

    rating = models.ForeignKey(Rating, on_delete=models.CASCADE, related_name='flags')
    flagged_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='flagged_reviews')
    reason = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Flag on Rating #{self.rating.id} – {self.status}"


# ──────────────────────────────────────────────────────────────────────────────
# RATING ALGORITHM CONFIGURATION (Admin-adjustable weights)
# ──────────────────────────────────────────────────────────────────────────────

class RatingAlgorithmConfig(models.Model):
    """
    Singleton config for rating calculation weights.
    Weights must sum to 1.0 (100%).
    """
    hygiene_weight = models.DecimalField(max_digits=4, decimal_places=3, default=0.400)
    freshness_weight = models.DecimalField(max_digits=4, decimal_places=3, default=0.350)
    service_weight = models.DecimalField(max_digits=4, decimal_places=3, default=0.250)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='config_updates',
        limit_choices_to={'role': 'Admin'}
    )

    class Meta:
        verbose_name = 'Rating Algorithm Config'

    @classmethod
    def get_config(cls):
        config, _ = cls.objects.get_or_create(pk=1, defaults={
            'hygiene_weight': 0.400,
            'freshness_weight': 0.350,
            'service_weight': 0.250,
        })
        return config

    def clean(self):
        from django.core.exceptions import ValidationError
        total = float(self.hygiene_weight) + float(self.freshness_weight) + float(self.service_weight)
        if abs(total - 1.0) > 0.001:
            raise ValidationError(f'Weights must sum to 1.0, got {total:.3f}')

    def __str__(self):
        return f"Config: H={self.hygiene_weight} F={self.freshness_weight} S={self.service_weight}"


# ──────────────────────────────────────────────────────────────────────────────
# SHOP NAME CHANGE REQUEST
# ──────────────────────────────────────────────────────────────────────────────

class ShopNameChangeRequest(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    )

    vendor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shop_name_requests')
    old_name = models.CharField(max_length=255)
    new_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    request_date = models.DateTimeField(auto_now_add=True)
    reviewed_date = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-request_date']

    def __str__(self):
        return f"{self.vendor.email}: {self.old_name} -> {self.new_name} ({self.status})"


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER FAVORITES
# ──────────────────────────────────────────────────────────────────────────────

class Favorite(models.Model):
    """Consumer saves/bookmarks a vendor shop."""
    consumer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='favorites',
        limit_choices_to={'role': 'Consumer'}
    )
    vendor = models.ForeignKey(
        VendorDetails,
        on_delete=models.CASCADE,
        related_name='favorited_by'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('consumer', 'vendor')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.consumer.email} ♥ {self.vendor.shop_name}"
class AdminAuditLog(models.Model):
    ACTION_CHOICES = (
        ('vendor_request_approved', 'Vendor request approved'),
        ('vendor_request_rejected', 'Vendor request rejected'),
        ('vendor_suspended', 'Vendor suspended'),
        ('vendor_unsuspended', 'Vendor unsuspended'),
        ('flag_resolved', 'Flag resolved'),
        ('flag_dismissed', 'Flag dismissed'),
        ('shop_name_approved', 'Shop name approved'),
        ('shop_name_rejected', 'Shop name rejected'),
        ('rating_config_updated', 'Rating config updated'),
    )

    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=64, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=64)
    target_id = models.CharField(max_length=64, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.admin.email}: {self.action} ({self.target_type}:{self.target_id})"


class Notification(models.Model):
    KIND_CHOICES = (
        ('rating_received', 'Rating received'),
        ('reply_received', 'Reply received'),
        ('vendor_request_submitted', 'Vendor request submitted'),
        ('vendor_request_approved', 'Vendor request approved'),
        ('vendor_request_rejected', 'Vendor request rejected'),
        ('shop_name_approved', 'Shop name approved'),
        ('shop_name_rejected', 'Shop name rejected'),
        ('vendor_suspended', 'Vendor suspended'),
        ('vendor_unsuspended', 'Vendor unsuspended'),
        ('review_flagged', 'Review flagged'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    kind = models.CharField(max_length=64, choices=KIND_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email}: {self.kind}"


class DevicePushToken(models.Model):
    PLATFORM_CHOICES = (
        ('android', 'Android'),
        ('ios', 'iOS'),
        ('web', 'Web'),
        ('unknown', 'Unknown'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='device_push_tokens')
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='unknown')
    device_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['platform']),
        ]

    def __str__(self):
        return f"{self.user.email}: {self.platform} push token"

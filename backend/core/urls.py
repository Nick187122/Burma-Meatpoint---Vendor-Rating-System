"""
URL routes for core app – versioned under /api/v1/
"""

from django.urls import path
from . import views

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────────
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/token/refresh/', views.TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', views.UserProfileView.as_view(), name='user-profile'),

    # ── Consumer – Discovery ──────────────────────────────────────────────────
    path('vendors/top-rated/', views.TopRatedVendorsView.as_view(), name='top-rated-vendors'),
    path('vendors/search/', views.VendorSearchView.as_view(), name='vendor-search'),
    path('vendors/<int:vendor_id>/', views.VendorProfileView.as_view(), name='vendor-profile'),
    path('vendors/<int:vendor_id>/ratings/', views.VendorRatingsView.as_view(), name='vendor-ratings'),

    # ── Consumer – Rating & Vendor Application ────────────────────────────────
    path('ratings/', views.SubmitRatingView.as_view(), name='submit-rating'),
    path('vendor-requests/', views.VendorRequestView.as_view(), name='vendor-requests'),

    # ── Vendor Portal ─────────────────────────────────────────────────────────
    path('vendor/dashboard/', views.VendorDashboardView.as_view(), name='vendor-dashboard'),
    path('vendor/profile/', views.VendorProfileUpdateView.as_view(), name='vendor-profile-update'),
    path('vendor/shop-name-request/', views.ShopNameRequestView.as_view(), name='vendor-shop-name-request'),
    path('vendor/ratings/', views.VendorMyRatingsView.as_view(), name='vendor-my-ratings'),
    path('vendor/ratings/<int:rating_id>/reply/', views.VendorReplyView.as_view(), name='vendor-reply'),
    path('vendor/ratings/<int:rating_id>/flag/', views.FlagRatingView.as_view(), name='flag-rating'),

    # ── Admin Portal ──────────────────────────────────────────────────────────
    path('admin/vendor-requests/', views.AdminVendorRequestQueueView.as_view(), name='admin-vendor-queue'),
    path('admin/vendor-requests/<int:request_id>/approve/', views.AdminApproveVendorView.as_view(), name='admin-approve-vendor'),
    path('admin/vendor-requests/<int:request_id>/reject/', views.AdminRejectVendorView.as_view(), name='admin-reject-vendor'),
    path('admin/vendors/', views.AdminAllVendorsView.as_view(), name='admin-all-vendors'),
    path('admin/vendors/<int:vendor_id>/suspend/', views.AdminSuspendVendorView.as_view(), name='admin-suspend'),
    path('admin/vendors/<int:vendor_id>/unsuspend/', views.AdminUnsuspendVendorView.as_view(), name='admin-unsuspend'),
    path('admin/flagged-reviews/', views.AdminFlaggedReviewsView.as_view(), name='admin-flagged-reviews'),
    path('admin/flagged-reviews/<int:flag_id>/resolve/', views.AdminResolveFlagView.as_view(), name='admin-resolve-flag'),
    path('admin/shop-name-requests/', views.AdminShopNameRequestQueueView.as_view(), name='admin-shop-name-queue'),
    path('admin/shop-name-requests/<int:request_id>/approve/', views.AdminShopNameApproveView.as_view(), name='admin-approve-shop-name'),
    path('admin/shop-name-requests/<int:request_id>/reject/', views.AdminShopNameRejectView.as_view(), name='admin-reject-shop-name'),
    path('admin/rating-config/', views.AdminRatingConfigView.as_view(), name='admin-rating-config'),
    path('admin/users/', views.AdminUserListView.as_view(), name='admin-users'),
]

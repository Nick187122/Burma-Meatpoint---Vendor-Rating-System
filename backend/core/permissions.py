"""
RBAC Permission classes for Burma Meat Point.
"""

from rest_framework.permissions import BasePermission


class IsConsumer(BasePermission):
    """Allows access only to users with role='Consumer'."""
    message = "Only Consumers can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Consumer' and
            request.user.status == 'Active'
        )


class IsVendor(BasePermission):
    """Allows access only to approved Vendors."""
    message = "Only approved Vendors can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Vendor' and
            request.user.is_vendor_approved and
            request.user.status == 'Active'
        )


class IsConsumerOrVendor(BasePermission):
    """Allows access to either Consumers or approved Vendors."""
    message = "Authentication required with Consumer or Vendor role."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.status != 'Active':
            return False
        return request.user.role in ('Consumer', 'Vendor')


class IsAdmin(BasePermission):
    """Allows access only to Admin users. Singleton enforcement."""
    message = "Only the system Admin can perform this action."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Admin' and
            request.user.is_staff and
            request.user.is_superuser
        )


class IsOwnerVendor(BasePermission):
    """Allows vendor to only manage their own profile/reviews."""
    message = "You can only manage your own vendor resources."

    def has_object_permission(self, request, view, obj):
        # obj is a Rating or VendorDetails
        if hasattr(obj, 'vendor'):
            # Rating.vendor is a VendorDetails; VendorDetails.vendor is a User
            vendor_user = obj.vendor.vendor if hasattr(obj.vendor, 'vendor') else obj.vendor
            return vendor_user == request.user
        return False

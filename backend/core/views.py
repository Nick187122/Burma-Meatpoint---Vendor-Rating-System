"""
Views for Burma Meat Point – Vendor Rating System.
Implements: Auth, Consumer, Vendor, Admin API endpoints.
Security: JWT, rate limiting, RBAC permissions, input sanitization.
"""

from django.utils import timezone
from django.core.cache import cache
from django.db.models import Q
from django.contrib.auth import authenticate

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from django_ratelimit.decorators import ratelimit
from django_ratelimit.core import get_usage

from .models import (
    User, VendorDetails, VendorRequest,
    Rating, VendorReply, FlaggedReview, RatingAlgorithmConfig,
    ShopNameChangeRequest
)
from .serializers import (
    RegisterSerializer, UserSerializer, UserUpdateSerializer,
    VendorDetailsSerializer, VendorListSerializer,
    VendorRequestSerializer, RatingSerializer,
    VendorReplySerializer, FlaggedReviewSerializer,
    RatingAlgorithmConfigSerializer,
    ShopNameChangeRequestSerializer, VendorProfileUpdateSerializer
)
from .permissions import IsConsumer, IsVendor, IsAdmin, IsConsumerOrVendor


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def set_refresh_cookie(response, refresh_token):
    """Store JWT refresh token in an HTTP-only cookie."""
    from django.conf import settings
    jwt_settings = getattr(settings, 'SIMPLE_JWT', {})
    response.set_cookie(
        key=jwt_settings.get('AUTH_COOKIE', 'refresh_token'),
        value=str(refresh_token),
        httponly=jwt_settings.get('AUTH_COOKIE_HTTP_ONLY', True),
        secure=jwt_settings.get('AUTH_COOKIE_SECURE', False),
        samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'),
        max_age=7 * 24 * 60 * 60,  # 7 days
    )


def clear_refresh_cookie(response):
    from django.conf import settings
    jwt_settings = getattr(settings, 'SIMPLE_JWT', {})
    response.delete_cookie(jwt_settings.get('AUTH_COOKIE', 'refresh_token'))


# ──────────────────────────────────────────────────────────────────────────────
# AUTH VIEWS
# ──────────────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    """POST /api/v1/auth/register/ — open to all."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            response = Response({
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data,
                'message': 'Registration successful. Welcome to Burma Meat Point!'
            }, status=status.HTTP_201_CREATED)
            set_refresh_cookie(response, refresh)
            return response
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """POST /api/v1/auth/login/ — rate limited to 10/hour."""
    permission_classes = [AllowAny]

    def post(self, request):
        # Rate limit check (10 per hour per IP)
        usage = get_usage(request, group='login', key='ip', rate='10/h', method='POST', increment=True)
        if usage and usage.get('should_limit'):
            return Response(
                {'error': 'Too many login attempts. Please wait before trying again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({'error': 'Email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if user.is_locked():
            return Response(
                {'error': 'Account is locked. Contact admin or try again later.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if user.status == 'Suspended':
            return Response(
                {'error': 'Your account has been suspended. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        authenticated_user = authenticate(request, username=email, password=password)

        if not authenticated_user:
            user.login_attempts += 1
            if user.login_attempts >= 7:
                user.lock_account(permanent=True)
                return Response({'error': 'Account permanently locked due to too many failed attempts.'}, status=status.HTTP_403_FORBIDDEN)
            elif user.login_attempts >= 5:
                user.lock_account(minutes=5)
                return Response({'error': 'Too many attempts. Account locked for 5 minutes.'}, status=status.HTTP_403_FORBIDDEN)
            else:
                user.save()
            remaining = max(0, 7 - user.login_attempts)
            return Response({
                'error': 'Invalid credentials.',
                'attempts_remaining': remaining,
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Successful login
        user.unlock_account()
        refresh = RefreshToken.for_user(authenticated_user)
        response = Response({
            'access': str(refresh.access_token),
            'user': UserSerializer(authenticated_user).data,
        }, status=status.HTTP_200_OK)
        set_refresh_cookie(response, refresh)
        return response


class TokenRefreshView(APIView):
    """POST /api/v1/auth/token/refresh/ — uses HTTP-only cookie."""
    permission_classes = [AllowAny]

    def post(self, request):
        from django.conf import settings
        cookie_name = getattr(settings, 'SIMPLE_JWT', {}).get('AUTH_COOKIE', 'refresh_token')
        refresh_token = request.COOKIES.get(cookie_name)

        if not refresh_token:
            return Response({'error': 'No refresh token provided.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(refresh_token)
            access = str(refresh.access_token)
            response = Response({'access': access}, status=status.HTTP_200_OK)
            set_refresh_cookie(response, refresh)
            return response
        except TokenError:
            return Response({'error': 'Invalid or expired refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklists the refresh token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.conf import settings
        cookie_name = getattr(settings, 'SIMPLE_JWT', {}).get('AUTH_COOKIE', 'refresh_token')
        refresh_token = request.COOKIES.get(cookie_name)

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        clear_refresh_cookie(response)
        return response


class UserProfileView(APIView):
    """GET /api/v1/auth/me/ — returns current user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER – VENDOR DISCOVERY
# ──────────────────────────────────────────────────────────────────────────────

class TopRatedVendorsView(APIView):
    """GET /api/v1/vendors/top-rated/ — homepage feed, cached 5 minutes."""
    permission_classes = [AllowAny]

    def get(self, request):
        cache_key = 'top_rated_vendors'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        vendors = (
            VendorDetails.objects
            .select_related('vendor')
            .filter(vendor__status='Active', vendor__is_vendor_approved=True, total_ratings__gt=0)
            .order_by('-overall_score')[:12]
        )
        data = VendorListSerializer(vendors, many=True).data
        cache.set(cache_key, data, timeout=300)  # 5-minute cache
        return Response(data)


class VendorSearchView(APIView):
    """GET /api/v1/vendors/search/ — filter by location, meat_type, price_range."""
    permission_classes = [AllowAny]

    def get(self, request):
        qs = VendorDetails.objects.select_related('vendor').filter(
            vendor__status='Active',
            vendor__is_vendor_approved=True,
        )
        location = request.query_params.get('location', '').strip()
        meat_type = request.query_params.get('meat_type', '').strip()
        price_range = request.query_params.get('price_range', '').strip()
        query = request.query_params.get('q', '').strip()

        if location:
            qs = qs.filter(location__icontains=location)
        if meat_type:
            qs = qs.filter(meat_types__icontains=meat_type)
        if price_range:
            qs = qs.filter(price_range__iexact=price_range)
        if query:
            qs = qs.filter(
                Q(shop_name__icontains=query) |
                Q(location__icontains=query) |
                Q(meat_types__icontains=query)
            )

        qs = qs.order_by('-overall_score')
        data = VendorListSerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})


class VendorProfileView(APIView):
    """GET /api/v1/vendors/<id>/ — full vendor profile (cached per vendor)."""
    permission_classes = [AllowAny]

    def get(self, request, vendor_id):
        cache_key = f'vendor_profile_{vendor_id}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            vendor = VendorDetails.objects.select_related('vendor').get(
                id=vendor_id,
                vendor__status='Active',
                vendor__is_vendor_approved=True,
            )
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = VendorDetailsSerializer(vendor).data
        cache.set(cache_key, data, timeout=300)
        return Response(data)


class VendorRatingsView(generics.ListAPIView):
    """GET /api/v1/vendors/<vendor_id>/ratings/ — paginated ratings."""
    permission_classes = [AllowAny]
    serializer_class = RatingSerializer

    def get_queryset(self):
        vendor_id = self.kwargs['vendor_id']
        return Rating.objects.select_related('consumer', 'vendor').filter(
            vendor__id=vendor_id,
            is_flagged=False,
        ).order_by('-timestamp')


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER – RATING SUBMISSION
# ──────────────────────────────────────────────────────────────────────────────

class SubmitRatingView(APIView):
    """POST /api/v1/ratings/ — rate limited to 50/day per user."""
    permission_classes = [IsConsumer]

    def post(self, request):
        # Rate limit: 50 ratings per day per user
        usage = get_usage(request, group='rating', key='user', rate='50/d', method='POST', increment=True)
        if usage and usage.get('should_limit'):
            return Response(
                {'error': 'Rating limit reached. Please try again tomorrow.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        serializer = RatingSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            rating = serializer.save()
            # Invalidate vendor profile cache
            cache.delete(f'vendor_profile_{rating.vendor.id}')
            cache.delete('top_rated_vendors')
            return Response(RatingSerializer(rating).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER – BECOME A VENDOR
# ──────────────────────────────────────────────────────────────────────────────

class VendorRequestView(APIView):
    """POST /api/v1/vendor-requests/ — submit application."""
    permission_classes = [IsConsumer]

    def post(self, request):
        # One pending request at a time
        existing = VendorRequest.objects.filter(user=request.user, status='Pending').exists()
        if existing:
            return Response(
                {'error': 'You already have a pending vendor application.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if request.user.is_vendor_approved:
            return Response({'error': 'You are already an approved vendor.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VendorRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({
                'message': 'Application submitted successfully. Awaiting admin review.',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        """GET own application status."""
        requests = VendorRequest.objects.filter(user=request.user).order_by('-submitted_date')
        return Response(VendorRequestSerializer(requests, many=True).data)


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR PORTAL VIEWS
# ──────────────────────────────────────────────────────────────────────────────

class VendorDashboardView(APIView):
    """GET /api/v1/vendor/dashboard/ — analytics for the logged-in vendor."""
    permission_classes = [IsVendor]

    def get(self, request):
        try:
            vendor = request.user.vendor_details
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Nearby vendors for benchmark (same location)
        nearby = VendorDetails.objects.filter(
            location__icontains=vendor.location,
            vendor__status='Active',
        ).exclude(id=vendor.id)

        nearby_avg = 0.0
        if nearby.exists():
            from django.db.models import Avg
            agg = nearby.aggregate(avg=Avg('overall_score'))
            nearby_avg = float(agg['avg'] or 0)

        # Recent 30 ratings
        recent_ratings = Rating.objects.filter(vendor=vendor).order_by('-timestamp')[:30]

        data = {
            'vendor': VendorDetailsSerializer(vendor).data,
            'benchmark': {
                'your_score': float(vendor.overall_score),
                'area_average': round(nearby_avg, 2),
                'difference': round(float(vendor.overall_score) - nearby_avg, 2),
            },
            'recent_ratings': RatingSerializer(recent_ratings, many=True).data,
            'score_breakdown': {
                'hygiene': float(vendor.hygiene_score),
                'freshness': float(vendor.freshness_score),
                'service': float(vendor.service_score),
                'overall': float(vendor.overall_score),
                'total_ratings': vendor.total_ratings,
            }
        }
        return Response(data)


class VendorMyRatingsView(generics.ListAPIView):
    """GET /api/v1/vendor/ratings/ — vendor sees all their ratings."""
    permission_classes = [IsVendor]
    serializer_class = RatingSerializer

    def get_queryset(self):
        try:
            vendor = self.request.user.vendor_details
            return Rating.objects.filter(vendor=vendor).order_by('-timestamp')
        except VendorDetails.DoesNotExist:
            return Rating.objects.none()


class VendorReplyView(APIView):
    """POST /api/v1/vendor/ratings/<rating_id>/reply/ — post public reply."""
    permission_classes = [IsVendor]

    def post(self, request, rating_id):
        try:
            vendor = request.user.vendor_details
            rating = Rating.objects.get(id=rating_id, vendor=vendor)
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Rating.DoesNotExist:
            return Response({'error': 'Rating not found or does not belong to your shop.'}, status=status.HTTP_404_NOT_FOUND)

        if hasattr(rating, 'reply'):
            return Response({'error': 'A reply already exists. Use PATCH to update.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VendorReplySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(rating=rating, vendor=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, rating_id):
        try:
            vendor = request.user.vendor_details
            rating = Rating.objects.get(id=rating_id, vendor=vendor)
            reply = rating.reply
        except (VendorDetails.DoesNotExist, Rating.DoesNotExist, VendorReply.DoesNotExist):
            return Response({'error': 'Reply not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = VendorReplySerializer(reply, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FlagRatingView(APIView):
    """POST /api/v1/vendor/ratings/<rating_id>/flag/ — flag for admin review."""
    permission_classes = [IsVendor]

    def post(self, request, rating_id):
        try:
            vendor = request.user.vendor_details
            rating = Rating.objects.get(id=rating_id, vendor=vendor)
        except (VendorDetails.DoesNotExist, Rating.DoesNotExist):
            return Response({'error': 'Rating not found.'}, status=status.HTTP_404_NOT_FOUND)

        if rating.is_flagged:
            return Response({'error': 'This rating is already flagged.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'A reason is required to flag a review.'}, status=status.HTTP_400_BAD_REQUEST)

        import bleach
        reason = bleach.clean(reason, tags=[], strip=True)

        flag = FlaggedReview.objects.create(
            rating=rating,
            flagged_by=request.user,
            reason=reason,
        )
        rating.is_flagged = True
        rating.flag_reason = reason
        rating.save(update_fields=['is_flagged', 'flag_reason'])

        return Response({'message': 'Review flagged for admin review.', 'flag_id': flag.id}, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# ADMIN PORTAL VIEWS
# ──────────────────────────────────────────────────────────────────────────────

class AdminVendorRequestQueueView(APIView):
    """GET/PATCH /api/v1/admin/vendor-requests/ — manage application queue."""
    permission_classes = [IsAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status', 'Pending')
        requests = VendorRequest.objects.select_related('user').filter(status=status_filter)
        return Response(VendorRequestSerializer(requests, many=True).data)


class AdminApproveVendorView(APIView):
    """POST /api/v1/admin/vendor-requests/<id>/approve/ — approve application."""
    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        try:
            vendor_request = VendorRequest.objects.select_related('user').get(id=request_id, status='Pending')
        except VendorRequest.DoesNotExist:
            return Response({'error': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = vendor_request.user

        # Update request status
        vendor_request.status = 'Approved'
        vendor_request.reviewed_date = timezone.now()
        vendor_request.admin_notes = request.data.get('admin_notes', '')
        vendor_request.save()

        # Upgrade user role
        user.role = 'Vendor'
        user.is_vendor_approved = True
        user.save(update_fields=['role', 'is_vendor_approved'])

        # Create VendorDetails profile
        VendorDetails.objects.get_or_create(
            vendor=user,
            defaults={
                'shop_name': vendor_request.shop_name,
                'location': vendor_request.location,
                'kebs_license': vendor_request.kebs_license,
                'meat_types': vendor_request.meat_types,
                'price_range': vendor_request.price_range or '',
            }
        )

        return Response({
            'message': f"{user.email} has been approved as a Vendor.",
            'user': UserSerializer(user).data,
        }, status=status.HTTP_200_OK)


class AdminRejectVendorView(APIView):
    """POST /api/v1/admin/vendor-requests/<id>/reject/ — reject application."""
    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        try:
            vendor_request = VendorRequest.objects.get(id=request_id, status='Pending')
        except VendorRequest.DoesNotExist:
            return Response({'error': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)

        vendor_request.status = 'Rejected'
        vendor_request.reviewed_date = timezone.now()
        vendor_request.admin_notes = request.data.get('admin_notes', 'Rejected by administrator.')
        vendor_request.save()

        return Response({'message': 'Vendor application rejected.'})


class AdminSuspendVendorView(APIView):
    """POST /api/v1/admin/vendors/<vendor_id>/suspend/ — 1-click suspension."""
    permission_classes = [IsAdmin]

    def post(self, request, vendor_id):
        try:
            vendor_details = VendorDetails.objects.select_related('vendor').get(id=vendor_id)
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = vendor_details.vendor
        reason = request.data.get('reason', 'Hygiene violation compliance suspension.')

        user.status = 'Suspended'
        user.save(update_fields=['status'])

        # Invalidate caches
        cache.delete(f'vendor_profile_{vendor_id}')
        cache.delete('top_rated_vendors')

        return Response({
            'message': f"Vendor '{vendor_details.shop_name}' has been suspended.",
            'reason': reason,
        }, status=status.HTTP_200_OK)


class AdminUnsuspendVendorView(APIView):
    """POST /api/v1/admin/vendors/<vendor_id>/unsuspend/ — restore vendor."""
    permission_classes = [IsAdmin]

    def post(self, request, vendor_id):
        try:
            vendor_details = VendorDetails.objects.select_related('vendor').get(id=vendor_id)
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        vendor_details.vendor.status = 'Active'
        vendor_details.vendor.save(update_fields=['status'])
        cache.delete(f'vendor_profile_{vendor_id}')
        cache.delete('top_rated_vendors')

        return Response({'message': f"Vendor '{vendor_details.shop_name}' has been reinstated."})


class AdminFlaggedReviewsView(APIView):
    """GET /api/v1/admin/flagged-reviews/ — view flagged reviews queue."""
    permission_classes = [IsAdmin]

    def get(self, request):
        flags = FlaggedReview.objects.select_related('rating', 'flagged_by').filter(status='Pending')
        return Response(FlaggedReviewSerializer(flags, many=True).data)


class AdminResolveFlagView(APIView):
    """POST /api/v1/admin/flagged-reviews/<id>/resolve/ — resolve or dismiss flag."""
    permission_classes = [IsAdmin]

    def post(self, request, flag_id):
        try:
            flag = FlaggedReview.objects.select_related('rating').get(id=flag_id)
        except FlaggedReview.DoesNotExist:
            return Response({'error': 'Flag not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', '')  # 'resolve' or 'dismiss'
        if action not in ('resolve', 'dismiss'):
            return Response({'error': "action must be 'resolve' or 'dismiss'."}, status=status.HTTP_400_BAD_REQUEST)

        flag.status = 'Resolved' if action == 'resolve' else 'Dismissed'
        flag.admin_notes = request.data.get('admin_notes', '')
        flag.resolved_at = timezone.now()
        flag.save()

        # If resolved, remove the rating
        if action == 'resolve':
            vendor_id = flag.rating.vendor.id
            flag.rating.delete()
            cache.delete(f'vendor_profile_{vendor_id}')
            cache.delete('top_rated_vendors')
            return Response({'message': 'Review removed and flag resolved.'})

        # Unset flag on rating if dismissed
        flag.rating.is_flagged = False
        flag.rating.save(update_fields=['is_flagged'])
        return Response({'message': 'Flag dismissed. Review remains visible.'})


class AdminRatingConfigView(APIView):
    """GET/PATCH /api/v1/admin/rating-config/ — adjust algorithm weights."""
    permission_classes = [IsAdmin]

    def get(self, request):
        config = RatingAlgorithmConfig.get_config()
        return Response(RatingAlgorithmConfigSerializer(config).data)

    def patch(self, request):
        config = RatingAlgorithmConfig.get_config()
        serializer = RatingAlgorithmConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            instance = serializer.save(updated_by=request.user)
            # Recalculate all vendor scores with new weights
            for vendor in VendorDetails.objects.filter(total_ratings__gt=0):
                vendor.recalculate_scores(config=instance)
            cache.delete('top_rated_vendors')
            return Response({
                'message': 'Rating algorithm updated. All vendor scores recalculated.',
                'config': RatingAlgorithmConfigSerializer(instance).data,
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminAllVendorsView(generics.ListAPIView):
    """GET /api/v1/admin/vendors/ — list all vendors (with status filter)."""
    permission_classes = [IsAdmin]
    serializer_class = VendorDetailsSerializer

    def get_queryset(self):
        status_filter = self.request.query_params.get('status', '')
        qs = VendorDetails.objects.select_related('vendor')
        if status_filter:
            qs = qs.filter(vendor__status=status_filter)
        return qs.order_by('-overall_score')


class AdminUserListView(generics.ListAPIView):
    """GET /api/v1/admin/users/ — list all users."""
    permission_classes = [IsAdmin]
    serializer_class = UserSerializer

    def get_queryset(self):
        role = self.request.query_params.get('role', '')
        qs = User.objects.exclude(role='Admin')
        if role:
            qs = qs.filter(role=role)
        return qs.order_by('-date_joined')


# ──────────────────────────────────────────────────────────────────────────────
# VENDOR PROFILE UPDATES & SHOP NAME REQUESTS
# ──────────────────────────────────────────────────────────────────────────────

class VendorProfileUpdateView(APIView):
    """PATCH /api/v1/vendor/profile/ — update products/prices."""
    permission_classes = [IsVendor]

    def patch(self, request):
        details = VendorDetails.objects.get(vendor=request.user)
        serializer = VendorProfileUpdateSerializer(details, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            cache.delete(f'vendor_profile_{details.id}')
            cache.delete('top_rated_vendors')
            return Response({'message': 'Profile updated successfully.', 'data': serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ShopNameRequestView(APIView):
    """POST /api/v1/vendor/shop-name-request/ — request a name change."""
    permission_classes = [IsVendor]

    def post(self, request):
        new_name = request.data.get('new_name')
        if not new_name:
            return Response({'error': 'new_name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        details = VendorDetails.objects.get(vendor=request.user)
        
        if ShopNameChangeRequest.objects.filter(vendor=request.user, status='Pending').exists():
            return Response({'error': 'You already have a pending name change request.'}, status=status.HTTP_400_BAD_REQUEST)

        ShopNameChangeRequest.objects.create(
            vendor=request.user,
            old_name=details.shop_name,
            new_name=new_name
        )
        return Response({'message': 'Shop name change requested successfully.'}, status=status.HTTP_201_CREATED)


class AdminShopNameRequestQueueView(APIView):
    """GET /api/v1/admin/shop-name-requests/ — list pending name changes."""
    permission_classes = [IsAdmin]

    def get(self, request):
        reqs = ShopNameChangeRequest.objects.select_related('vendor').filter(status='Pending')
        return Response(ShopNameChangeRequestSerializer(reqs, many=True).data)


class AdminShopNameApproveView(APIView):
    """POST /api/v1/admin/shop-name-requests/<id>/approve/"""
    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        try:
            req = ShopNameChangeRequest.objects.get(id=request_id, status='Pending')
        except ShopNameChangeRequest.DoesNotExist:
            return Response({'error': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        req.status = 'Approved'
        req.reviewed_date = timezone.now()
        req.save()

        details = VendorDetails.objects.get(vendor=req.vendor)
        details.shop_name = req.new_name
        details.save(update_fields=['shop_name'])

        cache.delete(f'vendor_profile_{details.id}')
        cache.delete('top_rated_vendors')

        return Response({'message': 'Shop name change approved.'})


class AdminShopNameRejectView(APIView):
    """POST /api/v1/admin/shop-name-requests/<id>/reject/"""
    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        try:
            req = ShopNameChangeRequest.objects.get(id=request_id, status='Pending')
        except ShopNameChangeRequest.DoesNotExist:
            return Response({'error': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        req.status = 'Rejected'
        req.reviewed_date = timezone.now()
        req.admin_notes = request.data.get('admin_notes', 'Rejected by admin.')
        req.save()

        return Response({'message': 'Shop name change rejected.'})

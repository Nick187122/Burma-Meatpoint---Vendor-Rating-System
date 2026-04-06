"""
Views for Burma Meat Point – Vendor Rating System.
Implements: Auth, Consumer, Vendor, Admin API endpoints.
Security: JWT, rate limiting, RBAC permissions, input sanitization.
"""

from django.utils import timezone
from django.core.cache import cache
from django.db.models import Q
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.http import Http404
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from math import radians, sin, cos, asin, sqrt
from io import BytesIO
import base64
import requests

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
    ShopNameChangeRequest, Favorite, AdminAuditLog, Notification, DevicePushToken
)
from .serializers import (
    RegisterSerializer, UserSerializer, UserUpdateSerializer,
    VendorDetailsSerializer, VendorListSerializer,
    VendorRequestSerializer, RatingSerializer,
    VendorReplySerializer, FlaggedReviewSerializer,
    RatingAlgorithmConfigSerializer,
    ShopNameChangeRequestSerializer, VendorProfileUpdateSerializer,
    FavoriteSerializer, AdminAuditLogSerializer, NotificationSerializer,
    DevicePushTokenSerializer
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


def get_vendor_details_by_identifier(vendor_id):
    """
    Accept either a VendorDetails id or a vendor User id.
    This keeps admin actions working across older and newer frontend payloads.
    """
    try:
        return VendorDetails.objects.select_related('vendor').get(id=vendor_id)
    except VendorDetails.DoesNotExist:
        return VendorDetails.objects.select_related('vendor').get(vendor__id=vendor_id)


def haversine_km(lat1, lon1, lat2, lon2):
    """Return distance between two WGS84 points in kilometers."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return 6371 * c


def build_vendor_profile_urls(request, vendor_id):
    profile_path = f"/vendor/{vendor_id}"
    web_url = f"{settings.FRONTEND_URL.rstrip('/')}{profile_path}"
    mobile_url = f"{settings.MOBILE_APP_SCHEME}://vendor/{vendor_id}"
    fallback_url = request.build_absolute_uri(profile_path) if request is not None else web_url
    return {
        'web_url': web_url,
        'mobile_url': mobile_url,
        'fallback_url': fallback_url,
    }


def send_email_verification(user, request):
    token = PasswordResetTokenGenerator().make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/auth?mode=verify&uid={uid}&token={token}"
    send_mail(
        subject='Verify your Burma Meat Point email',
        message=(
            'Use the link below to verify your email address.\n'
            f'{verify_url}\n\n'
            'If you did not create this account, you can ignore this email.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    user.email_verification_sent_at = timezone.now()
    user.save(update_fields=['email_verification_sent_at'])


def create_audit_log(admin_user, action, target_type, target_id=None, metadata=None):
    AdminAuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        metadata=metadata or {},
    )


def create_notification(user, kind, title, message, metadata=None):
    notification = Notification.objects.create(
        user=user,
        kind=kind,
        title=title,
        message=message,
        metadata=metadata or {},
    )
    send_push_notifications_for_user(user, title, message, metadata=notification.metadata)
    return notification


def send_push_notifications_for_user(user, title, message, metadata=None):
    tokens = list(
        user.device_push_tokens.filter(is_active=True).values_list('token', flat=True)
    )
    if not tokens:
        return False

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    access_token = getattr(settings, 'EXPO_PUSH_ACCESS_TOKEN', '')
    if access_token:
        headers['Authorization'] = f"Bearer {access_token}"

    payload = []
    for token in tokens:
        payload.append({
            'to': token,
            'title': title,
            'body': message,
            'sound': 'default',
            'data': metadata or {},
        })

    try:
        response = requests.post(
            getattr(settings, 'EXPO_PUSH_API_URL', 'https://exp.host/--/api/v2/push/send'),
            json=payload,
            headers=headers,
            timeout=10,
        )
        if response.ok:
            return True
    except Exception:
        pass
    return False


def get_or_create_social_user(email, name):
    user = User.objects.filter(email=email).first()
    if user:
        return user, False

    base_name = (name or email.split('@')[0]).strip() or 'Social User'
    user = User.objects.create_user(
        email=email,
        name=base_name,
        password=f"social-login-{timezone.now().timestamp()}",
        role='Consumer',
        email_verified=True,
    )
    return user, True


def build_auth_response(user, status_code=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    response = Response({
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
    }, status=status_code)
    set_refresh_cookie(response, refresh)
    return response


def send_transactional_email(subject, message, recipient_list):
    """
    Best-effort email delivery.
    User-facing actions should not fail just because SMTP is unavailable.
    """
    recipients = [email for email in recipient_list if email]
    if not recipients:
        return False
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        return True
    except Exception:
        return False


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
            verification_sent = False
            try:
                send_email_verification(user, request)
                verification_sent = True
            except Exception:
                verification_sent = False
            refresh = RefreshToken.for_user(user)
            response = Response({
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data,
                'message': (
                    'Registration successful. Check your email to verify your account.'
                    if verification_sent else
                    'Registration successful. Welcome to Burma Meat Point!'
                ),
                'verification_sent': verification_sent,
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


class SocialLoginView(APIView):
    """POST /api/v1/auth/social-login/ - sign in with Google or Facebook."""
    permission_classes = [AllowAny]

    def post(self, request):
        provider = request.data.get('provider', '').strip().lower()
        id_token = request.data.get('id_token', '').strip()
        access_token = request.data.get('access_token', '').strip()

        if provider not in {'google', 'facebook'}:
            return Response({'error': 'provider must be google or facebook.'}, status=status.HTTP_400_BAD_REQUEST)

        if provider == 'google':
            token_value = id_token or access_token
            token_field = 'id_token' if id_token else 'access_token'
            if not token_value:
                return Response({'error': 'Google login requires id_token or access_token.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                provider_response = requests.get(
                    'https://oauth2.googleapis.com/tokeninfo',
                    params={token_field: token_value},
                    timeout=10,
                )
                provider_response.raise_for_status()
                payload = provider_response.json()
            except Exception:
                return Response({'error': 'Unable to verify Google credentials.'}, status=status.HTTP_400_BAD_REQUEST)

            email = (payload.get('email') or '').strip().lower()
            name = payload.get('name') or payload.get('given_name') or ''
            email_verified = str(payload.get('email_verified', '')).lower() == 'true'
        else:
            if not access_token:
                return Response({'error': 'Facebook login requires access_token.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                provider_response = requests.get(
                    'https://graph.facebook.com/me',
                    params={
                        'fields': 'id,name,email',
                        'access_token': access_token,
                    },
                    timeout=10,
                )
                provider_response.raise_for_status()
                payload = provider_response.json()
            except Exception:
                return Response({'error': 'Unable to verify Facebook credentials.'}, status=status.HTTP_400_BAD_REQUEST)

            email = (payload.get('email') or '').strip().lower()
            name = payload.get('name') or ''
            email_verified = bool(email)

        if not email:
            return Response({'error': 'The social provider did not return an email address.'}, status=status.HTTP_400_BAD_REQUEST)
        if not email_verified:
            return Response({'error': 'The social account email is not verified.'}, status=status.HTTP_400_BAD_REQUEST)

        user, created = get_or_create_social_user(email, name)

        if user.is_locked():
            return Response({'error': 'Account is locked. Contact admin or try again later.'}, status=status.HTTP_403_FORBIDDEN)
        if user.status == 'Suspended':
            return Response({'error': 'Your account has been suspended. Please contact support.'}, status=status.HTTP_403_FORBIDDEN)

        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=['email_verified', 'email_verified_at'])

        response = build_auth_response(
            user,
            status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
        response.data['created'] = created
        response.data['provider'] = provider
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

class PasswordResetRequestView(APIView):
    """POST /api/v1/auth/password-reset/request/ ? email reset link."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if user:
            token = PasswordResetTokenGenerator().make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/auth?mode=reset&uid={uid}&token={token}"
            send_mail(
                subject='Burma Meat Point password reset',
                message=(
                    'Use the link below to reset your password\n'
                    f'{reset_url}\n\n'
                    'If you did not request this, you can ignore this email.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response({
            'message': 'If an account with that email exists, a password reset link has been sent.'
        })


class PasswordResetConfirmView(APIView):
    """POST /api/v1/auth/password-reset/confirm/ ? validate token and set new password."""
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        password = request.data.get('password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not uid or not token or not password or not confirm_password:
            return Response({'error': 'uid, token, password and confirm_password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm_password:
            return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response({'error': 'Reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'message': 'Password reset successful. You can now sign in.'})


class EmailVerificationRequestView(APIView):
    """POST /api/v1/auth/email-verification/request/ ? resend verification link."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if user and not user.email_verified:
            send_email_verification(user, request)

        return Response({'message': 'If the account exists and is not verified, a verification link has been sent.'})


class EmailVerificationConfirmView(APIView):
    """POST /api/v1/auth/email-verification/confirm/ ? verify email token."""
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')

        if not uid or not token:
            return Response({'error': 'uid and token are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'error': 'Invalid verification link.'}, status=status.HTTP_400_BAD_REQUEST)

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return Response({'error': 'Verification link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = timezone.now()
            user.save(update_fields=['email_verified', 'email_verified_at'])

        return Response({'message': 'Email verification successful. You can continue using your account.'})


class TopRatedVendorsView(APIView):
    """GET /api/v1/vendors/top-rated/ ? homepage feed, cached 5 minutes."""
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


class VendorListView(APIView):
    """GET /api/v1/vendors/ ? lightweight vendor listing for web/mobile discovery."""
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            VendorDetails.objects
            .select_related('vendor')
            .filter(vendor__status='Active', vendor__is_vendor_approved=True)
            .order_by('-overall_score', 'shop_name')
        )
        data = VendorListSerializer(qs[:100], many=True).data
        return Response({'count': len(data), 'results': data})


class VendorSearchView(APIView):
    """GET /api/v1/vendors/search/ ? filter by location, meat_type, price_range and radius."""
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
        min_rating = request.query_params.get('min_rating', '').strip()
        latitude = request.query_params.get('latitude', '').strip()
        longitude = request.query_params.get('longitude', '').strip()
        radius_km = request.query_params.get('radius_km', '').strip()

        if location:
            qs = qs.filter(location__icontains=location)
        if meat_type:
            qs = qs.filter(meat_types__icontains=meat_type)
        if price_range:
            qs = qs.filter(price_range__iexact=price_range)
        if min_rating:
            try:
                qs = qs.filter(overall_score__gte=float(min_rating))
            except ValueError:
                return Response({'error': 'min_rating must be numeric.'}, status=status.HTTP_400_BAD_REQUEST)
        if query:
            qs = qs.filter(
                Q(shop_name__icontains=query) |
                Q(location__icontains=query) |
                Q(meat_types__icontains=query)
            )

        distance_map = {}
        if latitude and longitude:
            try:
                ref_lat = float(latitude)
                ref_lon = float(longitude)
                max_radius = float(radius_km) if radius_km else 10.0
            except ValueError:
                return Response(
                    {'error': 'latitude, longitude and radius_km must be numeric.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            nearby_ids = []
            for vendor in qs.exclude(latitude__isnull=True).exclude(longitude__isnull=True):
                distance = haversine_km(ref_lat, ref_lon, float(vendor.latitude), float(vendor.longitude))
                if distance <= max_radius:
                    nearby_ids.append(vendor.id)
                    distance_map[vendor.id] = round(distance, 2)
            qs = qs.filter(id__in=nearby_ids)

        qs = qs.order_by('-overall_score', 'shop_name')
        data = VendorListSerializer(qs, many=True).data
        for item in data:
            if item['id'] in distance_map:
                item['distance_km'] = distance_map[item['id']]
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
            create_notification(
                rating.vendor.vendor,
                'rating_received',
                'New customer rating received',
                f"{rating.vendor.shop_name} received a new rating from {rating.consumer.name if rating.consumer and not rating.anonymous_mode else 'an anonymous customer'}.",
                {'vendor_id': rating.vendor.id, 'rating_id': rating.id}
            )
            send_transactional_email(
                subject='New rating received for your shop',
                message=(
                    f"Your shop '{rating.vendor.shop_name}' received a new customer rating.\n"
                    f"Hygiene: {rating.hygiene_score}/5\n"
                    f"Freshness: {rating.freshness_score}/5\n"
                    f"Service: {rating.service_score}/5\n\n"
                    f"Comment: {rating.comment or 'No comment provided.'}"
                ),
                recipient_list=[rating.vendor.vendor.email],
            )
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
        if not request.user.email_verified:
            return Response(
                {'error': 'Verify your email address before submitting a vendor application.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = VendorRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            create_notification(
                request.user,
                'vendor_request_submitted',
                'Vendor application submitted',
                'Your vendor application was submitted and is awaiting admin review.',
                {'vendor_request_id': serializer.instance.id, 'shop_name': serializer.instance.shop_name}
            )
            send_transactional_email(
                subject='Vendor application received',
                message=(
                    f"Hello {request.user.name},\n\n"
                    "Your request to become a vendor has been received and is awaiting admin review."
                ),
                recipient_list=[request.user.email],
            )
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


class VendorQrCodeView(APIView):
    """GET /api/v1/vendor/qr-code/ ? return a QR image for the vendor's public profile."""
    permission_classes = [IsVendor]

    def get(self, request):
        try:
            import qrcode
        except ImportError:
            return Response({'error': 'QR code dependency is not installed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            vendor = request.user.vendor_details
        except VendorDetails.DoesNotExist:
            raise Http404('Vendor profile not found.')

        urls = build_vendor_profile_urls(request, vendor.id)
        qr = qrcode.QRCode(box_size=8, border=2)
        qr.add_data(urls['web_url'])
        qr.make(fit=True)
        image = qr.make_image(fill_color='black', back_color='white')
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode('ascii')

        return Response({
            'vendor_id': vendor.id,
            'shop_name': vendor.shop_name,
            'profile_url': urls['web_url'],
            'mobile_url': urls['mobile_url'],
            'qr_code_data_url': f'data:image/png;base64,{encoded}',
        })


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
            if rating.consumer and rating.consumer.email:
                create_notification(
                    rating.consumer,
                    'reply_received',
                    'Vendor replied to your review',
                    f"The vendor replied to your review for {rating.vendor.shop_name}.",
                    {'vendor_id': rating.vendor.id, 'rating_id': rating.id}
                )
                send_transactional_email(
                    subject=f"Vendor replied to your review of {rating.vendor.shop_name}",
                    message=(
                        f"The vendor has replied to your review for '{rating.vendor.shop_name}'.\n\n"
                        f"Reply: {serializer.instance.reply_text}"
                    ),
                    recipient_list=[rating.consumer.email],
                )
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
            if rating.consumer and rating.consumer.email:
                create_notification(
                    rating.consumer,
                    'reply_received',
                    'Vendor updated a reply to your review',
                    f"The vendor updated their reply to your review for {rating.vendor.shop_name}.",
                    {'vendor_id': rating.vendor.id, 'rating_id': rating.id}
                )
                send_transactional_email(
                    subject=f"Vendor updated a reply to your review of {rating.vendor.shop_name}",
                    message=(
                        f"The vendor updated their reply to your review for '{rating.vendor.shop_name}'.\n\n"
                        f"Reply: {reply.reply_text}"
                    ),
                    recipient_list=[rating.consumer.email],
                )
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
        create_notification(
            request.user,
            'review_flagged',
            'Review flagged for admin review',
            f'You flagged a review for {rating.vendor.shop_name}.',
            {'rating_id': rating.id, 'flag_id': flag.id}
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
                'latitude': vendor_request.latitude,
                'longitude': vendor_request.longitude,
            }
        )

        create_audit_log(
            request.user,
            'vendor_request_approved',
            'VendorRequest',
            vendor_request.id,
            {'approved_user_id': user.id, 'shop_name': vendor_request.shop_name}
        )
        create_notification(
            user,
            'vendor_request_approved',
            'Vendor application approved',
            f"Your application for '{vendor_request.shop_name}' was approved.",
            {'vendor_request_id': vendor_request.id},
        )
        send_transactional_email(
            subject='Your vendor application was approved',
            message=(
                f"Hello {user.name},\n\n"
                f"Your application for '{vendor_request.shop_name}' has been approved. "
                "You can now sign in as a vendor and manage your public profile."
            ),
            recipient_list=[user.email],
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

        create_audit_log(
            request.user,
            'vendor_request_rejected',
            'VendorRequest',
            vendor_request.id,
            {'user_id': vendor_request.user_id, 'shop_name': vendor_request.shop_name}
        )
        create_notification(
            vendor_request.user,
            'vendor_request_rejected',
            'Vendor application reviewed',
            f"Your application for '{vendor_request.shop_name}' was not approved.",
            {'vendor_request_id': vendor_request.id},
        )
        send_transactional_email(
            subject='Your vendor application was reviewed',
            message=(
                f"Hello {vendor_request.user.name},\n\n"
                f"Your application for '{vendor_request.shop_name}' was not approved.\n"
                f"Notes: {vendor_request.admin_notes or 'No additional notes provided.'}"
            ),
            recipient_list=[vendor_request.user.email],
        )

        return Response({'message': 'Vendor application rejected.'})


class AdminSuspendVendorView(APIView):
    """POST /api/v1/admin/vendors/<vendor_id>/suspend/ — 1-click suspension."""
    permission_classes = [IsAdmin]

    def post(self, request, vendor_id):
        try:
            vendor_details = get_vendor_details_by_identifier(vendor_id)
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = vendor_details.vendor
        reason = request.data.get('reason', 'Hygiene violation compliance suspension.')

        user.status = 'Suspended'
        user.save(update_fields=['status'])

        create_audit_log(
            request.user,
            'vendor_suspended',
            'VendorDetails',
            vendor_details.id,
            {'vendor_user_id': user.id, 'reason': reason}
        )
        create_notification(
            user,
            'vendor_suspended',
            'Vendor account suspended',
            f"Your vendor account for '{vendor_details.shop_name}' has been suspended.",
            {'vendor_id': vendor_details.id, 'reason': reason},
        )

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
            vendor_details = get_vendor_details_by_identifier(vendor_id)
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        vendor_details.vendor.status = 'Active'
        vendor_details.vendor.save(update_fields=['status'])
        create_audit_log(
            request.user,
            'vendor_unsuspended',
            'VendorDetails',
            vendor_details.id,
            {'vendor_user_id': vendor_details.vendor.id}
        )
        create_notification(
            vendor_details.vendor,
            'vendor_unsuspended',
            'Vendor account restored',
            f"Your vendor account for '{vendor_details.shop_name}' has been reinstated.",
            {'vendor_id': vendor_details.id},
        )
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
            create_audit_log(
                request.user,
                'flag_resolved',
                'FlaggedReview',
                flag.id,
                {'rating_id': flag.rating.id, 'vendor_id': vendor_id}
            )
            flag.rating.delete()
            cache.delete(f'vendor_profile_{vendor_id}')
            cache.delete('top_rated_vendors')
            return Response({'message': 'Review removed and flag resolved.'})

        # Unset flag on rating if dismissed
        flag.rating.is_flagged = False
        flag.rating.save(update_fields=['is_flagged'])
        create_audit_log(
            request.user,
            'flag_dismissed',
            'FlaggedReview',
            flag.id,
            {'rating_id': flag.rating.id, 'vendor_id': flag.rating.vendor.id}
        )
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
            create_audit_log(
                request.user,
                'rating_config_updated',
                'RatingAlgorithmConfig',
                instance.pk,
                {
                    'hygiene_weight': str(instance.hygiene_weight),
                    'freshness_weight': str(instance.freshness_weight),
                    'service_weight': str(instance.service_weight),
                }
            )
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
        qs = User.objects.select_related('vendor_details').exclude(role='Admin')
        if role:
            qs = qs.filter(role=role)
        return qs.order_by('-date_joined')


class AdminAuditLogListView(generics.ListAPIView):
    """GET /api/v1/admin/audit-logs/ â€” list recent admin actions."""
    permission_classes = [IsAdmin]
    serializer_class = AdminAuditLogSerializer

    def get_queryset(self):
        action = self.request.query_params.get('action', '')
        qs = AdminAuditLog.objects.select_related('admin')
        if action:
            qs = qs.filter(action=action)
        return qs


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

        create_audit_log(
            request.user,
            'shop_name_approved',
            'ShopNameChangeRequest',
            req.id,
            {'vendor_user_id': req.vendor_id, 'new_name': req.new_name}
        )
        create_notification(
            req.vendor,
            'shop_name_approved',
            'Shop name updated',
            f"Your shop name was updated to '{req.new_name}'.",
            {'shop_name_request_id': req.id, 'vendor_id': details.id},
        )
        send_transactional_email(
            subject='Your shop name change was approved',
            message=(
                f"Hello {req.vendor.name},\n\n"
                f"Your shop name has been updated to '{req.new_name}'."
            ),
            recipient_list=[req.vendor.email],
        )

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

        create_audit_log(
            request.user,
            'shop_name_rejected',
            'ShopNameChangeRequest',
            req.id,
            {'vendor_user_id': req.vendor_id, 'new_name': req.new_name}
        )
        create_notification(
            req.vendor,
            'shop_name_rejected',
            'Shop name request reviewed',
            f"Your request to rename your shop to '{req.new_name}' was not approved.",
            {'shop_name_request_id': req.id},
        )
        send_transactional_email(
            subject='Your shop name change request was reviewed',
            message=(
                f"Hello {req.vendor.name},\n\n"
                f"Your request to rename your shop to '{req.new_name}' was not approved.\n"
                f"Notes: {req.admin_notes or 'No additional notes provided.'}"
            ),
            recipient_list=[req.vendor.email],
        )

        return Response({'message': 'Shop name change rejected.'})


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER – MY RATINGS
# ──────────────────────────────────────────────────────────────────────────────

class ConsumerRatingsView(generics.ListAPIView):
    """GET /api/v1/consumer/my-ratings/ — all ratings the consumer has submitted."""
    permission_classes = [IsConsumer]
    serializer_class = RatingSerializer

    def get_queryset(self):
        return Rating.objects.select_related('vendor', 'consumer').filter(
            consumer=self.request.user
        ).order_by('-timestamp')


# ──────────────────────────────────────────────────────────────────────────────
# CONSUMER – FAVORITES
# ──────────────────────────────────────────────────────────────────────────────

class FavoriteListView(generics.ListAPIView):
    """GET /api/v1/consumer/favorites/ — list all bookmarked vendors."""
    permission_classes = [IsConsumer]
    serializer_class = FavoriteSerializer

    def get_queryset(self):
        return Favorite.objects.select_related('vendor', 'consumer').filter(
            consumer=self.request.user
        )


class FavoriteToggleView(APIView):
    """POST /api/v1/consumer/favorites/<vendor_id>/ — save vendor.
       DELETE /api/v1/consumer/favorites/<vendor_id>/ — unsave vendor."""
    permission_classes = [IsConsumer]

    def post(self, request, vendor_id):
        try:
            vendor = VendorDetails.objects.get(id=vendor_id, vendor__status='Active')
        except VendorDetails.DoesNotExist:
            return Response({'error': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)

        fav, created = Favorite.objects.get_or_create(consumer=request.user, vendor=vendor)
        if created:
            return Response({'message': f"'{vendor.shop_name}' added to favorites.", 'favorited': True}, status=status.HTTP_201_CREATED)
        return Response({'message': 'Already in favorites.', 'favorited': True}, status=status.HTTP_200_OK)

    def delete(self, request, vendor_id):
        try:
            fav = Favorite.objects.get(consumer=request.user, vendor__id=vendor_id)
            fav.delete()
            return Response({'message': 'Removed from favorites.', 'favorited': False}, status=status.HTTP_200_OK)
        except Favorite.DoesNotExist:
            return Response({'error': 'Not in favorites.'}, status=status.HTTP_404_NOT_FOUND)


# ──────────────────────────────────────────────────────────────────────────────
# ADMIN – SYSTEM STATISTICS
# ──────────────────────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    """GET /api/v1/notifications/ - current user's notification inbox."""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = Notification.objects.filter(user=self.request.user)
        unread_only = self.request.query_params.get('unread_only', '').strip().lower()
        if unread_only in {'1', 'true', 'yes'}:
            queryset = queryset.filter(is_read=False)
        return queryset


class NotificationMarkReadView(APIView):
    """POST /api/v1/notifications/<id>/read/ - mark one notification as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(APIView):
    """POST /api/v1/notifications/read-all/ - mark all of a user's notifications as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response({'message': 'Notifications marked as read.', 'updated': updated})


class DevicePushTokenView(APIView):
    """POST/DELETE /api/v1/auth/push-token/ - register or deactivate a device push token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DevicePushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['token']
        platform = serializer.validated_data.get('platform', 'unknown')
        device_name = serializer.validated_data.get('device_name', '')

        device_token, _ = DevicePushToken.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'platform': platform,
                'device_name': device_name,
                'is_active': True,
            },
        )
        return Response(DevicePushTokenSerializer(device_token).data, status=status.HTTP_200_OK)

    def delete(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({'error': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        updated = DevicePushToken.objects.filter(user=request.user, token=token).update(is_active=False)
        if not updated:
            return Response({'error': 'Push token not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Push token deactivated.'})


class AdminStatsView(APIView):
    """GET /api/v1/admin/stats/ — platform-wide analytics dashboard."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Count, Avg

        total_users = User.objects.exclude(role='Admin').count()
        total_consumers = User.objects.filter(role='Consumer').count()
        total_vendors = User.objects.filter(role='Vendor').count()
        active_vendors = User.objects.filter(role='Vendor', status='Active', is_vendor_approved=True).count()
        suspended_vendors = User.objects.filter(role='Vendor', status='Suspended').count()
        total_ratings = Rating.objects.count()
        total_flagged = Rating.objects.filter(is_flagged=True).count()
        pending_vendor_requests = VendorRequest.objects.filter(status='Pending').count()
        pending_name_requests = ShopNameChangeRequest.objects.filter(status='Pending').count()

        top_vendor = (
            VendorDetails.objects
            .filter(vendor__status='Active', total_ratings__gt=0)
            .order_by('-overall_score')
            .first()
        )

        avg_platform_score = VendorDetails.objects.filter(
            total_ratings__gt=0
        ).aggregate(avg=Avg('overall_score'))['avg'] or 0

        return Response({
            'users': {
                'total': total_users,
                'consumers': total_consumers,
                'vendors': total_vendors,
                'active_vendors': active_vendors,
                'suspended_vendors': suspended_vendors,
            },
            'ratings': {
                'total': total_ratings,
                'flagged': total_flagged,
                'avg_platform_score': round(float(avg_platform_score), 2),
            },
            'pending': {
                'vendor_requests': pending_vendor_requests,
                'name_change_requests': pending_name_requests,
            },
            'top_vendor': {
                'shop_name': top_vendor.shop_name if top_vendor else None,
                'overall_score': float(top_vendor.overall_score) if top_vendor else None,
                'location': top_vendor.location if top_vendor else None,
            }
        })

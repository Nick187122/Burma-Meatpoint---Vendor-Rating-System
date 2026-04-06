from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.test import TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase
from unittest.mock import Mock, patch

from .models import AdminAuditLog, Notification, Rating, RatingAlgorithmConfig, User, VendorDetails
from .serializers import RatingSerializer


class RatingLifecycleTests(TestCase):
    def setUp(self):
        self.consumer = User.objects.create_user(
            email='consumer@example.com',
            name='Consumer',
            password='strongpass123',
            role='Consumer',
        )
        self.vendor_user = User.objects.create_user(
            email='vendor@example.com',
            name='Vendor',
            password='strongpass123',
            role='Vendor',
            is_vendor_approved=True,
        )
        self.vendor_details = VendorDetails.objects.create(
            vendor=self.vendor_user,
            shop_name='Prime Cuts',
            location='Nairobi',
            kebs_license='KEBS-123',
        )

    def test_rating_delete_recalculates_vendor_scores_to_zero(self):
        rating = Rating.objects.create(
            vendor=self.vendor_details,
            consumer=self.consumer,
            hygiene_score=5,
            freshness_score=4,
            service_score=3,
        )

        self.vendor_details.refresh_from_db()
        self.assertEqual(self.vendor_details.total_ratings, 1)

        rating.delete()

        self.vendor_details.refresh_from_db()
        self.assertEqual(self.vendor_details.total_ratings, 0)
        self.assertEqual(float(self.vendor_details.hygiene_score), 0.0)
        self.assertEqual(float(self.vendor_details.freshness_score), 0.0)
        self.assertEqual(float(self.vendor_details.service_score), 0.0)
        self.assertEqual(float(self.vendor_details.overall_score), 0.0)

    def test_anonymous_rating_hides_consumer_identity_but_keeps_ownership(self):
        rating = Rating.objects.create(
            vendor=self.vendor_details,
            consumer=self.consumer,
            anonymous_mode=True,
            hygiene_score=5,
            freshness_score=5,
            service_score=4,
        )

        serialized = RatingSerializer(rating).data

        self.assertEqual(rating.consumer, self.consumer)
        self.assertIsNone(serialized['consumer'])
        self.assertEqual(serialized['consumer_name'], 'Anonymous')


class ConsumerHistoryTests(APITestCase):
    def setUp(self):
        self.consumer = User.objects.create_user(
            email='history@example.com',
            name='History Consumer',
            password='strongpass123',
            role='Consumer',
        )
        self.vendor_user = User.objects.create_user(
            email='history-vendor@example.com',
            name='History Vendor',
            password='strongpass123',
            role='Vendor',
            is_vendor_approved=True,
        )
        self.vendor_details = VendorDetails.objects.create(
            vendor=self.vendor_user,
            shop_name='History Meats',
            location='Nairobi',
            kebs_license='KEBS-456',
        )

    def test_consumer_history_includes_anonymous_ratings(self):
        Rating.objects.create(
            vendor=self.vendor_details,
            consumer=self.consumer,
            anonymous_mode=True,
            hygiene_score=4,
            freshness_score=4,
            service_score=4,
        )

        self.client.force_authenticate(user=self.consumer)
        response = self.client.get('/api/v1/consumer/my-ratings/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['consumer_name'], 'Anonymous')
        self.assertIsNone(response.data['results'][0]['consumer'])


class RatingConfigTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='admin@example.com',
            name='Admin',
            password='strongpass123',
        )
        self.config = RatingAlgorithmConfig.get_config()

    def test_partial_patch_preserves_unsent_weights(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            '/api/v1/admin/rating-config/',
            {'hygiene_weight': '0.450', 'freshness_weight': '0.300'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.config.refresh_from_db()
        self.assertEqual(float(self.config.hygiene_weight), 0.45)
        self.assertEqual(float(self.config.freshness_weight), 0.3)
        self.assertEqual(float(self.config.service_weight), 0.25)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='reset@example.com',
            name='Reset User',
            password='strongpass123',
            role='Consumer',
        )

    def test_password_reset_confirm_updates_password(self):
        token = PasswordResetTokenGenerator().make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        response = self.client.post(
            '/api/v1/auth/password-reset/confirm/',
            {
                'uid': uid,
                'token': token,
                'password': 'newpass123',
                'confirm_password': 'newpass123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpass123'))


class EmailVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='verify@example.com',
            name='Verify User',
            password='strongpass123',
            role='Consumer',
        )

    def test_email_verification_confirm_marks_user_verified(self):
        token = PasswordResetTokenGenerator().make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        response = self.client.post(
            '/api/v1/auth/email-verification/confirm/',
            {'uid': uid, 'token': token},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)


class AdminAuditLogTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='auditor@example.com',
            name='Auditor',
            password='strongpass123',
        )
        self.vendor_user = User.objects.create_user(
            email='shop@example.com',
            name='Vendor',
            password='strongpass123',
            role='Vendor',
            is_vendor_approved=True,
            email_verified=True,
        )
        self.vendor_details = VendorDetails.objects.create(
            vendor=self.vendor_user,
            shop_name='Audit Shop',
            location='Nairobi',
            kebs_license='KEBS-AUDIT',
        )

    def test_suspend_vendor_creates_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/v1/admin/vendors/{self.vendor_details.id}/suspend/',
            {'reason': 'Manual moderation'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AdminAuditLog.objects.filter(
                action='vendor_suspended',
                target_type='VendorDetails',
                target_id=str(self.vendor_details.id),
            ).exists()
        )


class NotificationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='notify@example.com',
            name='Notify User',
            password='strongpass123',
            role='Consumer',
        )
        self.notification = Notification.objects.create(
            user=self.user,
            kind='vendor_request_submitted',
            title='Request submitted',
            message='Your request is pending review.',
        )

    def test_notification_endpoints_mark_read(self):
        self.client.force_authenticate(user=self.user)

        list_response = self.client.get('/api/v1/notifications/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['count'], 1)
        self.assertFalse(list_response.data['results'][0]['is_read'])

        mark_response = self.client.post(f'/api/v1/notifications/{self.notification.id}/read/')
        self.assertEqual(mark_response.status_code, 200)

        unread_response = self.client.get('/api/v1/notifications/?unread_only=true')
        self.assertEqual(unread_response.status_code, 200)
        self.assertEqual(unread_response.data['count'], 0)


class SocialLoginTests(APITestCase):
    @patch('core.views.requests.get')
    def test_google_social_login_creates_verified_user(self, mock_get):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            'email': 'social@example.com',
            'name': 'Social User',
            'email_verified': 'true',
        }
        mock_get.return_value = mock_response

        response = self.client.post(
            '/api/v1/auth/social-login/',
            {'provider': 'google', 'id_token': 'fake-token'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['created'])
        self.assertEqual(response.data['user']['email'], 'social@example.com')
        self.assertTrue(User.objects.get(email='social@example.com').email_verified)

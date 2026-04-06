from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_user_email_verification_adminauditlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('rating_received', 'Rating received'), ('reply_received', 'Reply received'), ('vendor_request_submitted', 'Vendor request submitted'), ('vendor_request_approved', 'Vendor request approved'), ('vendor_request_rejected', 'Vendor request rejected'), ('shop_name_approved', 'Shop name approved'), ('shop_name_rejected', 'Shop name rejected'), ('vendor_suspended', 'Vendor suspended'), ('vendor_unsuspended', 'Vendor unsuspended'), ('review_flagged', 'Review flagged')], max_length=64)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DevicePushToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=255, unique=True)),
                ('platform', models.CharField(choices=[('android', 'Android'), ('ios', 'iOS'), ('web', 'Web'), ('unknown', 'Unknown')], default='unknown', max_length=20)),
                ('device_name', models.CharField(blank=True, max_length=255)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_used_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='device_push_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='devicepushtoken',
            index=models.Index(fields=['user', 'is_active'], name='core_device_user_is_act_7d7431_idx'),
        ),
        migrations.AddIndex(
            model_name='devicepushtoken',
            index=models.Index(fields=['platform'], name='core_device_platform_956c06_idx'),
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_vendor_geolocation_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verification_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='email_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='email_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='AdminAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('vendor_request_approved', 'Vendor request approved'), ('vendor_request_rejected', 'Vendor request rejected'), ('vendor_suspended', 'Vendor suspended'), ('vendor_unsuspended', 'Vendor unsuspended'), ('flag_resolved', 'Flag resolved'), ('flag_dismissed', 'Flag dismissed'), ('shop_name_approved', 'Shop name approved'), ('shop_name_rejected', 'Shop name rejected'), ('rating_config_updated', 'Rating config updated')], max_length=64)),
                ('target_type', models.CharField(max_length=64)),
                ('target_id', models.CharField(blank=True, max_length=64, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('admin', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

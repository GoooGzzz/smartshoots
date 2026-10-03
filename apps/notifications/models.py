from django.db import models
import uuid

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('schedule_conflict', 'Schedule Conflict'),
        ('upcoming_session', 'Upcoming Session'),
        ('new_deposit', 'New Deposit'),
        ('outstanding_balance', 'Outstanding Balance'),
        ('pending_production', 'Pending Production Task'),
        ('delivery_status', 'Delivery Status Update'),
        ('operational_reminder', 'Operational Reminder'),
    ]
    notification_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    title_ar = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    message_ar = models.TextField(blank=True)
    deep_link = models.CharField(max_length=500, blank=True)
    idempotency_key = models.CharField(max_length=255, unique=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['idempotency_key']),
        ]

    @classmethod
    def create_or_update(cls, idempotency_key, **kwargs):
        notification, created = cls.objects.update_or_create(
            idempotency_key=idempotency_key,
            defaults=kwargs
        )
        return notification, created

class NotificationPreference(models.Model):
    user = models.OneToOneField('accounts.User', on_delete=models.CASCADE, related_name='notification_prefs')
    enable_browser = models.BooleanField(default=True)
    enable_pwa = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=False)
    schedule_conflicts = models.BooleanField(default=True)
    upcoming_sessions = models.BooleanField(default=True)
    new_deposits = models.BooleanField(default=True)
    outstanding_balances = models.BooleanField(default=True)
    pending_production = models.BooleanField(default=True)
    delivery_status = models.BooleanField(default=True)
    operational_reminders = models.BooleanField(default=True)

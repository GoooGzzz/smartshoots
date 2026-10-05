from django.db import models
from django.core.validators import MinValueValidator
from django_fsm import FSMField, transition
from decimal import Decimal
import uuid

class Package(models.Model):
    # FIX: only 2 package types existed (Learning, Reels) - "Outdoor" was
    # missing from the system entirely (not just the UI), so it could
    # never appear as a selectable option no matter what. Added properly.
    PACKAGE_TYPES = [
        ('hourly_learning', 'Hourly Learning Video Recording'),
        ('per_minute_reels', 'Per-Minute Reels'),
        ('outdoor_shoot', 'Outdoor Shoot'),
    ]
    package_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=30, choices=PACKAGE_TYPES)
    description = models.TextField(blank=True)
    default_rate = models.DecimalField(max_digits=10, decimal_places=2)
    # FIX: outdoor shoots are typically priced per session, not per
    # hour/minute like the other two package types - 'session' was
    # missing as a unit choice.
    unit = models.CharField(max_length=20, choices=[('hour', 'Hour'), ('minute', 'Minute'), ('session', 'Session')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ProductionOrder(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('delivered', 'Delivered'),
        ('closed', 'Closed'),
        ('cancelled', 'Cancelled'),
    ]
    order_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order_number = models.CharField(max_length=50, unique=True, editable=False)
    client = models.ForeignKey('accounts.Client', on_delete=models.PROTECT, related_name='orders')
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name='orders')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0'))
    remaining_balance = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    status = FSMField(max_length=20, choices=STATUS_CHOICES, default='draft')
    order_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)
    requirements = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_financially_closed = models.BooleanField(default=False, editable=False)
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-order_date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = self.generate_order_number()
        self.total_amount = (self.quantity * self.rate).quantize(Decimal('0.01'))
        self.remaining_balance = self.total_amount - self.paid_amount
        self.is_financially_closed = self.remaining_balance <= 0 and self.status in ['delivered', 'closed']
        super().save(*args, **kwargs)

    @staticmethod
    def generate_order_number():
        from datetime import datetime
        year = datetime.now().year
        last_order = ProductionOrder.objects.filter(
            order_number__contains=f'ORD-{year}'
        ).order_by('order_number').last()
        if last_order:
            last_num = int(last_order.order_number.split('-')[-1])
            return f'ORD-{year}-{last_num + 1:05d}'
        return f'ORD-{year}-00001'

    @transition(field=status, source='draft', target='pending')
    def submit_order(self):
        pass

    @transition(field=status, source='pending', target='in_progress')
    def start_production(self):
        pass

    @transition(field=status, source='in_progress', target='completed')
    def complete_production(self):
        pass

    @transition(field=status, source='completed', target='delivered')
    def mark_delivered(self):
        pass

    @transition(field=status, source='delivered', target='closed')
    def close_order(self):
        pass

class ProductionAssignment(models.Model):
    ASSIGNMENT_STATUS = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('late', 'Late'),
        ('cancelled', 'Cancelled'),
    ]
    assignment_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='assignments')
    staff = models.ForeignKey('accounts.StaffMember', on_delete=models.PROTECT, related_name='assignments')
    role = models.CharField(max_length=20)
    assigned_date = models.DateField()
    deadline = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ASSIGNMENT_STATUS, default='pending')
    notes = models.TextField(blank=True)

class Delivery(models.Model):
    DELIVERY_METHODS = [
        ('google_drive', 'Google Drive'),
        ('dropbox', 'Dropbox'),
        ('we_transfer', 'WeTransfer'),
        ('physical', 'Physical Media'),
        ('direct_link', 'Direct Link'),
        ('other', 'Other'),
    ]
    delivery_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order = models.OneToOneField(ProductionOrder, on_delete=models.CASCADE, related_name='delivery')
    delivery_date = models.DateField()
    client_received_date = models.DateField(null=True, blank=True)
    method = models.CharField(max_length=20, choices=DELIVERY_METHODS)
    delivery_link = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('received', 'Received'),
        ('failed', 'Failed'),
    ], default='pending')
    notes = models.TextField(blank=True)
    is_financially_closed = models.BooleanField(default=False, editable=False)
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)


class TimeLog(models.Model):
    log_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='time_logs')
    staff = models.ForeignKey('accounts.StaffMember', on_delete=models.PROTECT, related_name='time_logs')
    hours = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    work_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-work_date', '-created_at']

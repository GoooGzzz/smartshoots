from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid

# FIX: reuse the same phone validator defined in accounts, so business
# settings phone follows the same 11-digit Egyptian mobile rule as every
# other phone field instead of being left completely unvalidated.
from apps.accounts.models import egypt_mobile_regex

class Payment(models.Model):
    PAYMENT_METHODS = [
        ('vodafone_cash', 'Vodafone Cash'),
        ('instapay', 'InstaPay'),
        ('cash', 'Cash'),
    ]
    payment_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order = models.ForeignKey('production.ProductionOrder', on_delete=models.PROTECT, related_name='payments')
    client = models.ForeignKey('accounts.Client', on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS)
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    is_deposit = models.BooleanField(default=False)
    resulting_balance = models.DecimalField(max_digits=15, decimal_places=2, editable=False)
    recorded_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.pk:
            self.order.paid_amount += self.amount
            self.order.remaining_balance = self.order.total_amount - self.order.paid_amount
            self.order.save()
        self.resulting_balance = self.order.remaining_balance
        super().save(*args, **kwargs)

class ExpenseCategory(models.Model):
    DEFAULT_CATEGORIES = ['internet', 'office_rent', 'electricity', 'custom']
    category_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=50)
    category_type = models.CharField(max_length=20, choices=[
        ('internet', 'Internet'),
        ('office_rent', 'Office Rent'),
        ('electricity', 'Electricity'),
        ('custom', 'Custom'),
    ], default='custom')
    description = models.TextField(blank=True)
    is_recurring = models.BooleanField(default=False)
    recurring_interval = models.CharField(max_length=20, choices=[
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
    ], null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create_default_categories(cls, user):
        defaults = [
            ('Internet', 'internet'),
            ('Office Rent', 'office_rent'),
            ('Electricity', 'electricity'),
        ]
        for name, category_type in defaults:
            cls.objects.get_or_create(
                name=name,
                category_type=category_type,
                created_by=user,
                defaults={'is_recurring': True, 'recurring_interval': 'monthly'}
            )

class Expense(models.Model):
    # NEW: how the expense actually left the business - buying something
    # directly (Purchasing) vs pulling cash out (Withdraw) - mirroring the
    # "method" concept Payment already has for money coming in.
    METHOD_CHOICES = [
        ('purchasing', 'Purchasing'),
        ('withdraw', 'Withdraw'),
    ]
    expense_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='purchasing')
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    expense_date = models.DateField()
    description = models.TextField(blank=True)
    receipt = models.FileField(upload_to='expenses/receipts/', null=True, blank=True)
    is_recurring = models.BooleanField(default=False)
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date']

class Attachment(models.Model):
    attachment_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, null=True, related_name='attachments')
    order = models.ForeignKey('production.ProductionOrder', on_delete=models.CASCADE, null=True, related_name='attachments')
    file = models.FileField(upload_to='attachments/%Y/%m/%d/')
    filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    file_size = models.PositiveIntegerField()
    description = models.CharField(max_length=255, blank=True)
    is_shareable = models.BooleanField(default=False)
    share_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    uploaded_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    uploaded_at = models.DateTimeField(auto_now_add=True)

class BusinessSettings(models.Model):
    business_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='business/logo/', null=True, blank=True)
    currency = models.CharField(max_length=3, default='EGP')
    timezone = models.CharField(max_length=50, default='Africa/Cairo')
    language = models.CharField(max_length=2, choices=[('en', 'English'), ('ar', 'Arabic')], default='en')
    theme = models.CharField(max_length=10, choices=[('light', 'Light'), ('dark', 'Dark')], default='light')
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=17, blank=True, validators=[egypt_mobile_regex])  # FIX: was unvalidated
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    tax_number = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_settings(cls):
        settings = cls.objects.first()
        if not settings:
            settings = cls.objects.create(name='SMART SHOOTS')
        return settings

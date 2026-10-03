from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from decimal import Decimal
import uuid

# FIX / NEW: shared validators requested for data-entry integrity across
# the whole app - reused everywhere a phone number or a person/business
# name is entered, so mistyped data (letters in a phone number, digits in
# a name, a phone number with the wrong length/prefix) is rejected before
# it's ever saved, not just cosmetically hinted at in the UI.
#
# Egyptian mobile numbers: exactly 11 digits, starting with one of the
# four current carrier prefixes (010/011/012/015).
egypt_mobile_regex = RegexValidator(
    regex=r'^(010|011|012|015)\d{8}$',
    message="Mobile number must be 11 digits and start with 010, 011, 012, or 015.",
)
# Names: letters (English or Arabic) and spaces/apostrophes/hyphens only -
# no digits or stray symbols, to catch typos like "Ahmed2" or "12John".
name_regex = RegexValidator(
    regex=r"^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s'\-]*$",
    message="Name must contain letters only (no numbers or symbols).",
)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
    ]
    # FIX: overriding these inherited fields to add name_regex - Django
    # lets a subclass redeclare a parent field to attach extra validators.
    first_name = models.CharField(max_length=150, blank=True, validators=[name_regex])
    last_name = models.CharField(max_length=150, blank=True, validators=[name_regex])
    user_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    # FIX: was a loose international-format regex that accepted almost
    # anything with 9-15 digits; replaced with the actual business rule
    # (11-digit Egyptian mobile, specific prefixes).
    phone = models.CharField(validators=[egypt_mobile_regex], max_length=17, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    language_preference = models.CharField(max_length=2, choices=[('en', 'English'), ('ar', 'Arabic')], default='en')
    theme_preference = models.CharField(max_length=10, choices=[('light', 'Light'), ('dark', 'Dark')], default='light')
    is_active_staff = models.BooleanField(default=True)

class ClientTag(models.Model):
    tag_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#2196F3')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Client(models.Model):
    CLIENT_TYPES = [
        ('doctor', 'Doctor'),
        ('teacher', 'Teacher'),
        ('professor', 'Professor'),
        ('lab', 'Laboratory'),
        ('other', 'Other'),
    ]
    # NEW: many clients don't fit the academic professions above (doctor/
    # teacher/professor) - they're businesses/brands instead. Rather than
    # forcing everyone into the catch-all "Other" bucket, a separate,
    # always-selectable category distinguishes Academic vs Business
    # clients so they can be filtered/reported on separately.
    CATEGORY_CHOICES = [
        ('academic', 'Academic'),
        ('business', 'Business'),
    ]
    client_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=200, validators=[name_regex])  # FIX: was unvalidated
    type = models.CharField(max_length=20, choices=CLIENT_TYPES, default='other')
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='academic')
    primary_phone = models.CharField(max_length=17, validators=[egypt_mobile_regex])  # FIX: was unvalidated
    email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    address = models.TextField(blank=True)
    tags = models.ManyToManyField(ClientTag, blank=True, related_name='clients')
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='clients_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def get_session_count(self):
        return self.sessions.filter(status__in=['completed', 'confirmed']).count()

    def get_total_revenue(self):
        return self.orders.aggregate(total=models.Sum('total_amount'))['total'] or Decimal('0')

    def get_outstanding_balance(self):
        return self.orders.exclude(status='cancelled').aggregate(
            outstanding=models.Sum('remaining_balance')
        )['outstanding'] or Decimal('0')

class PhoneNumber(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='additional_phones')
    phone = models.CharField(max_length=17, validators=[egypt_mobile_regex])  # FIX: was unvalidated
    label = models.CharField(max_length=50, blank=True)
    is_whatsapp = models.BooleanField(default=False)

    class Meta:
        unique_together = ['client', 'phone']

class StaffMember(models.Model):
    ROLE_CHOICES = [
        ('editor', 'Editor'),
        ('camera_operator', 'Camera Operator'),
        ('assistant', 'Assistant'),
        ('manager', 'Manager'),
    ]
    staff_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    monthly_salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    hire_date = models.DateField()
    skills = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

class StaffEvaluation(models.Model):
    evaluation_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    staff = models.ForeignKey(StaffMember, on_delete=models.CASCADE, related_name='evaluations')
    evaluation_date = models.DateField()
    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    year = models.IntegerField()
    completed_assignments = models.IntegerField(default=0)
    late_assignments = models.IntegerField(default=0)
    quality_score = models.DecimalField(max_digits=3, decimal_places=1, validators=[MinValueValidator(0), MaxValueValidator(10)])
    reliability_score = models.DecimalField(max_digits=3, decimal_places=1, validators=[MinValueValidator(0), MaxValueValidator(10)])
    teamwork_score = models.DecimalField(max_digits=3, decimal_places=1, validators=[MinValueValidator(0), MaxValueValidator(10)])
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['staff', 'month', 'year']

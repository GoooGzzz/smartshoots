#!/usr/bin/env python3
"""
SMART SHOOTS Backend Setup Script
Run this inside the smart-shoots folder (where manage.py is).
It creates all business apps with models, serializers, views, URLs, and admin.
"""

import os
import shutil

BASE_DIR = os.getcwd()  # should be the folder containing manage.py

def write_file(path, content):
    """Write content to a file, creating directories if needed."""
    full_path = os.path.join(BASE_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ {path}")

# ---------------------------------------------------------------------
# 1. Update settings.py
# ---------------------------------------------------------------------
settings_content = '''"""
Django settings for SMART SHOOTS project.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-smart-shoots-development-key'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'corsheaders',
    'django_filters',
    'django_fsm',

    # Local apps
    'apps.accounts',
    'apps.production',
    'apps.scheduling',
    'apps.finance',
    'apps.notifications',
    'apps.reports',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Cairo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
'''
write_file('config/settings.py', settings_content)

# ---------------------------------------------------------------------
# 2. Update config/urls.py
# ---------------------------------------------------------------------
urls_content = '''from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/production/', include('apps.production.urls')),
    path('api/scheduling/', include('apps.scheduling.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/reports/', include('apps.reports.urls')),
]
'''
write_file('config/urls.py', urls_content)

# ---------------------------------------------------------------------
# 3. Create apps package
# ---------------------------------------------------------------------
write_file('apps/__init__.py', '')

# ---------------------------------------------------------------------
# 4. Accounts app
# ---------------------------------------------------------------------
write_file('apps/accounts/__init__.py', '')
write_file('apps/accounts/migrations/__init__.py', '')

accounts_models = '''from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from decimal import Decimal
import uuid

class User(AbstractUser):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
    ]
    user_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    phone_regex = RegexValidator(regex=r'^\\+?1?\\d{9,15}$', message="Phone number must be in format: '+999999999'")
    phone = models.CharField(validators=[phone_regex], max_length=17, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    language_preference = models.CharField(max_length=2, choices=[('en', 'English'), ('ar', 'Arabic')], default='en')
    theme_preference = models.CharField(max_length=10, choices=[('light', 'Light'), ('dark', 'Dark')], default='light')
    is_active_staff = models.BooleanField(default=True)

class Client(models.Model):
    CLIENT_TYPES = [
        ('doctor', 'Doctor'),
        ('teacher', 'Teacher'),
        ('professor', 'Professor'),
        ('other', 'Other'),
    ]
    client_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=CLIENT_TYPES, default='other')
    primary_phone = models.CharField(max_length=17)
    email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    address = models.TextField(blank=True)
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
    phone = models.CharField(max_length=17)
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
'''
write_file('apps/accounts/models.py', accounts_models)

accounts_serializers = '''from rest_framework import serializers
from .models import User, Client, PhoneNumber, StaffMember, StaffEvaluation

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'language_preference', 'theme_preference']
        read_only_fields = ['id']

class ClientSerializer(serializers.ModelSerializer):
    session_count = serializers.IntegerField(read_only=True)
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    outstanding_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['client_id', 'created_at', 'updated_at']

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = '__all__'

class StaffMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StaffMember
        fields = '__all__'

class StaffEvaluationSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = StaffEvaluation
        fields = '__all__'
'''
write_file('apps/accounts/serializers.py', accounts_serializers)

accounts_views = '''from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Client, PhoneNumber, StaffMember, StaffEvaluation
from .serializers import ClientSerializer, PhoneNumberSerializer, StaffMemberSerializer, StaffEvaluationSerializer

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'primary_phone', 'email']
    ordering_fields = ['name', 'created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        for client in queryset:
            client.session_count = client.get_session_count()
            client.total_revenue = client.get_total_revenue()
            client.outstanding_balance = client.get_outstanding_balance()
        return queryset

    @action(detail=True, methods=['get'])
    def full_details(self, request, pk=None):
        client = self.get_object()
        data = {
            'client': self.get_serializer(client).data,
            'phones': PhoneNumberSerializer(client.additional_phones.all(), many=True).data,
            'orders': client.orders.all().values('order_number', 'status', 'total_amount', 'remaining_balance'),
            'sessions': client.sessions.all().values('start_time', 'end_time', 'status'),
            'payments': client.payments.all().values('amount', 'payment_date', 'method'),
            'attachments': client.attachments.all().values('filename', 'file_type', 'uploaded_at'),
        }
        return Response(data)

class StaffMemberViewSet(viewsets.ModelViewSet):
    queryset = StaffMember.objects.all()
    serializer_class = StaffMemberSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['role', 'is_active']
    search_fields = ['user__first_name', 'user__last_name', 'role']

class StaffEvaluationViewSet(viewsets.ModelViewSet):
    queryset = StaffEvaluation.objects.all()
    serializer_class = StaffEvaluationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['staff', 'month', 'year']
'''
write_file('apps/accounts/views.py', accounts_views)

accounts_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'clients', views.ClientViewSet)
router.register(r'staff', views.StaffMemberViewSet)
router.register(r'evaluations', views.StaffEvaluationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
write_file('apps/accounts/urls.py', accounts_urls)

accounts_admin = '''from django.contrib import admin
from .models import User, Client, PhoneNumber, StaffMember, StaffEvaluation

admin.site.register(User)
admin.site.register(Client)
admin.site.register(PhoneNumber)
admin.site.register(StaffMember)
admin.site.register(StaffEvaluation)
'''
write_file('apps/accounts/admin.py', accounts_admin)

# ---------------------------------------------------------------------
# 5. Production app
# ---------------------------------------------------------------------
write_file('apps/production/__init__.py', '')
write_file('apps/production/migrations/__init__.py', '')

production_models = '''from django.db import models
from django.core.validators import MinValueValidator
from django_fsm import FSMField, transition
from decimal import Decimal
import uuid

class Package(models.Model):
    PACKAGE_TYPES = [
        ('hourly_learning', 'Hourly Learning Video Recording'),
        ('per_minute_reels', 'Per-Minute Reels'),
    ]
    package_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=30, choices=PACKAGE_TYPES)
    description = models.TextField(blank=True)
    default_rate = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, choices=[('hour', 'Hour'), ('minute', 'Minute')])
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
'''
write_file('apps/production/models.py', production_models)

production_serializers = '''from rest_framework import serializers
from .models import Package, ProductionOrder, ProductionAssignment, Delivery

class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = '__all__'

class ProductionOrderSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    package_name = serializers.CharField(source='package.name', read_only=True)

    class Meta:
        model = ProductionOrder
        fields = '__all__'
        read_only_fields = ['order_id', 'order_number', 'total_amount', 'remaining_balance', 'is_financially_closed']

class ProductionAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = ProductionAssignment
        fields = '__all__'

class DeliverySerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.CharField(source='order.client.name', read_only=True)

    class Meta:
        model = Delivery
        fields = '__all__'
'''
write_file('apps/production/serializers.py', production_serializers)

production_views = '''from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Package, ProductionOrder, ProductionAssignment, Delivery
from .serializers import PackageSerializer, ProductionOrderSerializer, ProductionAssignmentSerializer, DeliverySerializer

class PackageViewSet(viewsets.ModelViewSet):
    queryset = Package.objects.all()
    serializer_class = PackageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'description']

class ProductionOrderViewSet(viewsets.ModelViewSet):
    queryset = ProductionOrder.objects.all()
    serializer_class = ProductionOrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'client', 'package', 'is_financially_closed']
    search_fields = ['order_number', 'client__name']
    ordering_fields = ['order_date', 'created_at', 'total_amount']

class ProductionAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ProductionAssignment.objects.all()
    serializer_class = ProductionAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'staff', 'role']
    search_fields = ['order__order_number', 'staff__user__first_name']

class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.all()
    serializer_class = DeliverySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'method', 'is_financially_closed']
    search_fields = ['order__order_number', 'order__client__name']
'''
write_file('apps/production/views.py', production_views)

production_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'packages', views.PackageViewSet)
router.register(r'orders', views.ProductionOrderViewSet)
router.register(r'assignments', views.ProductionAssignmentViewSet)
router.register(r'deliveries', views.DeliveryViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
write_file('apps/production/urls.py', production_urls)

production_admin = '''from django.contrib import admin
from .models import Package, ProductionOrder, ProductionAssignment, Delivery

admin.site.register(Package)
admin.site.register(ProductionOrder)
admin.site.register(ProductionAssignment)
admin.site.register(Delivery)
'''
write_file('apps/production/admin.py', production_admin)

# ---------------------------------------------------------------------
# 6. Scheduling app
# ---------------------------------------------------------------------
write_file('apps/scheduling/__init__.py', '')
write_file('apps/scheduling/migrations/__init__.py', '')

scheduling_models = '''from django.db import models
from django.core.exceptions import ValidationError
from datetime import timedelta
import uuid

class Resource(models.Model):
    RESOURCE_TYPES = [
        ('staff', 'Staff'),
        ('equipment', 'Equipment'),
        ('venue', 'Venue'),
        ('vehicle', 'Vehicle'),
    ]
    resource_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=RESOURCE_TYPES)
    description = models.TextField(blank=True)
    hourly_rate = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    color = models.CharField(max_length=7, default='#4A90E2')
    capacity = models.PositiveIntegerField(default=1)

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    appointment_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    client = models.ForeignKey('accounts.Client', on_delete=models.PROTECT, related_name='sessions')
    project = models.ForeignKey('production.ProductionOrder', on_delete=models.SET_NULL, null=True, related_name='sessions')
    resources = models.ManyToManyField(Resource, related_name='appointments')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration = models.DurationField(editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    buffer_before = models.DurationField(default=timedelta(minutes=15))
    buffer_after = models.DurationField(default=timedelta(minutes=15))
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['status']),
        ]

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        actual_start = self.start_time - self.buffer_before
        actual_end = self.end_time + self.buffer_after
        for resource in self.resources.all():
            conflicts = Appointment.objects.filter(
                resources=resource,
                status__in=['pending', 'confirmed', 'in_progress'],
                start_time__lt=actual_end,
                end_time__gt=actual_start
            ).exclude(pk=self.pk)
            if conflicts.exists():
                raise ValidationError(f"Resource {resource.name} is already booked")
            blocks = ResourceBlock.objects.filter(
                resource=resource,
                start_time__lt=actual_end,
                end_time__gt=actual_start
            )
            if blocks.exists():
                raise ValidationError(f"Resource {resource.name} is blocked")

    def save(self, *args, **kwargs):
        self.duration = self.end_time - self.start_time
        self.clean()
        super().save(*args, **kwargs)

class ResourceBlock(models.Model):
    BLOCK_TYPES = [
        ('maintenance', 'Maintenance'),
        ('vacation', 'Vacation'),
        ('holiday', 'Holiday'),
        ('other', 'Other'),
    ]
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='blocks')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    block_type = models.CharField(max_length=20, choices=BLOCK_TYPES)
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.PROTECT)
'''
write_file('apps/scheduling/models.py', scheduling_models)

scheduling_serializers = '''from rest_framework import serializers
from .models import Resource, Appointment, ResourceBlock

class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = '__all__'

class AppointmentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['duration', 'created_at', 'updated_at']

class ResourceBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceBlock
        fields = '__all__'
'''
write_file('apps/scheduling/serializers.py', scheduling_serializers)

scheduling_views = '''from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Resource, Appointment, ResourceBlock
from .serializers import ResourceSerializer, AppointmentSerializer, ResourceBlockSerializer

class ResourceViewSet(viewsets.ModelViewSet):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'description']

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'client']
    search_fields = ['client__name', 'location']
    ordering_fields = ['start_time', 'end_time']

class ResourceBlockViewSet(viewsets.ModelViewSet):
    queryset = ResourceBlock.objects.all()
    serializer_class = ResourceBlockSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['resource', 'block_type']
'''
write_file('apps/scheduling/views.py', scheduling_views)

scheduling_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'resources', views.ResourceViewSet)
router.register(r'appointments', views.AppointmentViewSet)
router.register(r'blocks', views.ResourceBlockViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
write_file('apps/scheduling/urls.py', scheduling_urls)

scheduling_admin = '''from django.contrib import admin
from .models import Resource, Appointment, ResourceBlock

admin.site.register(Resource)
admin.site.register(Appointment)
admin.site.register(ResourceBlock)
'''
write_file('apps/scheduling/admin.py', scheduling_admin)

# ---------------------------------------------------------------------
# 7. Finance app
# ---------------------------------------------------------------------
write_file('apps/finance/__init__.py', '')
write_file('apps/finance/migrations/__init__.py', '')

finance_models = '''from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid

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
    expense_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
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
    phone = models.CharField(max_length=17, blank=True)
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
'''
write_file('apps/finance/models.py', finance_models)

finance_serializers = '''from rest_framework import serializers
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings

class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['resulting_balance']

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['share_token', 'uploaded_at']

class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = '__all__'
'''
write_file('apps/finance/serializers.py', finance_serializers)

finance_views = '''from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings
from .serializers import PaymentSerializer, ExpenseCategorySerializer, ExpenseSerializer, AttachmentSerializer, BusinessSettingsSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['method', 'is_deposit', 'client']
    search_fields = ['reference', 'order__order_number', 'client__name']
    ordering_fields = ['payment_date', 'amount']

class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category_type', 'is_active', 'is_recurring']
    search_fields = ['name']

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category', 'is_recurring']
    search_fields = ['description']
    ordering_fields = ['expense_date', 'amount']

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['client', 'order', 'is_shareable']
    search_fields = ['filename', 'description']

class BusinessSettingsViewSet(viewsets.ModelViewSet):
    queryset = BusinessSettings.objects.all()
    serializer_class = BusinessSettingsSerializer
    permission_classes = [IsAuthenticated]
'''
write_file('apps/finance/views.py', finance_views)

finance_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'payments', views.PaymentViewSet)
router.register(r'expense-categories', views.ExpenseCategoryViewSet)
router.register(r'expenses', views.ExpenseViewSet)
router.register(r'attachments', views.AttachmentViewSet)
router.register(r'settings', views.BusinessSettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
write_file('apps/finance/urls.py', finance_urls)

finance_admin = '''from django.contrib import admin
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings

admin.site.register(Payment)
admin.site.register(ExpenseCategory)
admin.site.register(Expense)
admin.site.register(Attachment)
admin.site.register(BusinessSettings)
'''
write_file('apps/finance/admin.py', finance_admin)

# ---------------------------------------------------------------------
# 8. Notifications app
# ---------------------------------------------------------------------
write_file('apps/notifications/__init__.py', '')
write_file('apps/notifications/migrations/__init__.py', '')

notifications_models = '''from django.db import models
from django.contrib.postgres.fields import JSONField
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
    metadata = JSONField(default=dict, blank=True)
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
'''
write_file('apps/notifications/models.py', notifications_models)

notifications_serializers = '''from rest_framework import serializers
from .models import Notification, NotificationPreference

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['created_at']

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = '__all__'
'''
write_file('apps/notifications/serializers.py', notifications_serializers)

notifications_views = '''from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'is_read']
    ordering_fields = ['created_at']

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'success'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response({'status': 'success'})

class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    queryset = NotificationPreference.objects.all()
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)
'''
write_file('apps/notifications/views.py', notifications_views)

notifications_urls = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.NotificationViewSet, basename='notification')
router.register(r'preferences', views.NotificationPreferenceViewSet, basename='notification-preference')

urlpatterns = [
    path('', include(router.urls)),
]
'''
write_file('apps/notifications/urls.py', notifications_urls)

notifications_admin = '''from django.contrib import admin
from .models import Notification, NotificationPreference

admin.site.register(Notification)
admin.site.register(NotificationPreference)
'''
write_file('apps/notifications/admin.py', notifications_admin)

# ---------------------------------------------------------------------
# 9. Reports app
# ---------------------------------------------------------------------
write_file('apps/reports/__init__.py', '')
write_file('apps/reports/migrations/__init__.py', '')

reports_views = '''from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.production.models import ProductionOrder
        from apps.finance.models import Payment, Expense
        from apps.scheduling.models import Appointment
        from apps.accounts.models import Client

        today = timezone.now().date()
        month_start = today.replace(day=1)

        monthly_revenue = Payment.objects.filter(payment_date__gte=month_start).aggregate(
            total=Sum('amount'))['total'] or Decimal('0')
        total_outstanding = ProductionOrder.objects.exclude(status='cancelled').aggregate(
            total=Sum('remaining_balance'))['total'] or Decimal('0')
        monthly_expenses = Expense.objects.filter(expense_date__gte=month_start).aggregate(
            total=Sum('amount'))['total'] or Decimal('0')

        upcoming_appointments = Appointment.objects.filter(
            start_time__gte=timezone.now(),
            status__in=['pending', 'confirmed']
        ).count()
        pending_production = ProductionOrder.objects.filter(
            status__in=['pending', 'in_progress']
        ).count()
        active_clients = Client.objects.filter(is_active=True).count()

        recent_payments = Payment.objects.order_by('-created_at')[:5]
        recent_orders = ProductionOrder.objects.order_by('-created_at')[:5]

        return Response({
            'monthly_revenue': monthly_revenue,
            'collected_payments': monthly_revenue,
            'outstanding_balance': total_outstanding,
            'monthly_expenses': monthly_expenses,
            'net_cash_flow': monthly_revenue - monthly_expenses,
            'upcoming_appointments': upcoming_appointments,
            'pending_production': pending_production,
            'active_clients': active_clients,
            'recent_payments': [
                {'id': p.payment_id, 'amount': p.amount, 'date': p.payment_date, 'client': p.client.name}
                for p in recent_payments
            ],
            'recent_orders': [
                {'id': o.order_id, 'number': o.order_number, 'status': o.status, 'client': o.client.name}
                for o in recent_orders
            ],
        })

class FinancialReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.finance.models import Payment, Expense
        from apps.production.models import ProductionOrder

        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        payments = Payment.objects.filter(payment_date__gte=start_date)
        expenses = Expense.objects.filter(expense_date__gte=start_date)
        orders = ProductionOrder.objects.filter(order_date__gte=start_date)

        daily_data = []
        for i in range(days):
            date = start_date + timedelta(days=i)
            daily_payments = payments.filter(payment_date=date).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            daily_expenses = expenses.filter(expense_date=date).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            daily_data.append({
                'date': date,
                'revenue': daily_payments,
                'expenses': daily_expenses,
                'net': daily_payments - daily_expenses,
            })

        return Response({
            'daily_data': daily_data,
            'total_revenue': payments.aggregate(total=Sum('amount'))['total'] or Decimal('0'),
            'total_expenses': expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0'),
            'total_orders': orders.count(),
            'total_order_value': orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0'),
        })
'''
write_file('apps/reports/views.py', reports_views)

reports_urls = '''from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.DashboardReportView.as_view(), name='dashboard-report'),
    path('financial/', views.FinancialReportView.as_view(), name='financial-report'),
]
'''
write_file('apps/reports/urls.py', reports_urls)

print("\n✅ All apps and files created successfully.")
print("\nNext steps:")
print("1. Run migrations: python manage.py makemigrations && python manage.py migrate")
print("2. Create a superuser: python manage.py createsuperuser")
print("3. (Optional) Load sample data: python manage.py loaddata sample_data.json")
print("4. Start the server: python manage.py runserver")
print("5. Access the API at http://127.0.0.1:8000/api/")
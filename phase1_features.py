import os

BASE = os.getcwd()

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

def append(path, content):
    full = os.path.join(BASE, path)
    with open(full, 'a', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Appended to {path}")

# ---------------------------------------------------------------------
# 1. Overwrite apps/accounts/models.py with full content including ClientTag and tags field
# ---------------------------------------------------------------------
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

class ClientTag(models.Model):
    tag_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default='#2196F3')

    def __str__(self):
        return self.name

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

write('apps/accounts/models.py', accounts_models)

# ---------------------------------------------------------------------
# 2. Add profitability endpoint (append to reports/views.py)
# ---------------------------------------------------------------------
profitability_view = '''

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from decimal import Decimal
from apps.accounts.models import Client
from apps.production.models import ProductionOrder

class ClientProfitabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        clients = Client.objects.filter(is_active=True)
        data = []
        for client in clients:
            orders = ProductionOrder.objects.filter(client=client).exclude(status='cancelled')
            total_revenue = orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            total_paid = orders.aggregate(total=Sum('paid_amount'))['total'] or Decimal('0')
            # Simple cost assumption: 60% of revenue
            total_cost = total_revenue * Decimal('0.6')
            profit = total_revenue - total_cost
            data.append({
                'client_id': client.id,
                'client_name': client.name,
                'total_revenue': total_revenue,
                'total_paid': total_paid,
                'total_cost': total_cost,
                'profit': profit,
                'profit_margin': (profit / total_revenue * 100) if total_revenue else Decimal('0'),
            })
        return Response(data)
'''
append('apps/reports/views.py', profitability_view)

# Add URL
profitability_url = '''

from django.urls import path
from .views import ClientProfitabilityView

urlpatterns += [
    path('client-profitability/', ClientProfitabilityView.as_view(), name='client-profitability'),
]
'''
append('apps/reports/urls.py', profitability_url)

# ---------------------------------------------------------------------
# 3. PWA manifest
# ---------------------------------------------------------------------
manifest = '''{
  "name": "SMART SHOOTS",
  "short_name": "SmartShoots",
  "theme_color": "#2563EB",
  "background_color": "#F8FAFC",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
'''
write('frontend/public/manifest.json', manifest)

# Update index.html
index_path = os.path.join(BASE, 'frontend', 'index.html')
with open(index_path, 'r', encoding='utf-8') as f:
    index_content = f.read()
if 'manifest' not in index_content:
    index_content = index_content.replace('<head>', '<head>\n  <link rel="manifest" href="/manifest.json" />')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(index_content)
    print("✅ Updated index.html")
else:
    print("✅ Manifest already linked")

# ---------------------------------------------------------------------
# 4. FilePreview component
# ---------------------------------------------------------------------
file_preview = '''import React from 'react';
import { Modal, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface FilePreviewProps {
  url: string;
  filename: string;
  open: boolean;
  onClose: () => void;
}

export default function FilePreview({ url, filename, open, onClose }: FilePreviewProps) {
  const isImage = /\\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const isPDF = /\\.pdf$/i.test(filename);

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        bgcolor: 'background.paper', boxShadow: 24, p: 2, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
      }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        {isImage && <img src={url} alt={filename} style={{ maxWidth: '100%', maxHeight: '80vh' }} />}
        {isPDF && <iframe src={url} width="100%" height="500px" title={filename} />}
        {!isImage && !isPDF && <p>Preview not available for this file type.</p>}
      </Box>
    </Modal>
  );
}
'''
write('frontend/src/components/Common/FilePreview.tsx', file_preview)

# ---------------------------------------------------------------------
# 5. BulkUpload component
# ---------------------------------------------------------------------
bulk_upload = '''import React, { useState } from 'react';
import { Button, Input, Box, LinearProgress } from '@mui/material';
import apiClient from '../../api/client';

interface BulkUploadProps {
  onUploadComplete: () => void;
}

export default function BulkUpload({ onUploadComplete }: BulkUploadProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      await apiClient.post('/finance/attachments/bulk/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setFiles(null);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Input type="file" inputProps={{ multiple: true }} onChange={handleFileChange} />
      <Button variant="contained" onClick={handleUpload} disabled={!files || uploading} sx={{ ml: 2 }}>
        {uploading ? 'Uploading...' : 'Upload Files'}
      </Button>
      {uploading && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  );
}
'''
write('frontend/src/components/Common/BulkUpload.tsx', bulk_upload)

print("\n✅ Phase 1 features added successfully.")
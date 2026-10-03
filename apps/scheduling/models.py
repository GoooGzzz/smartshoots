from django.db import models
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
    # FIX: no blank=True meant DRF treated 'resources' as a REQUIRED field
    # on create (it's a to-many field with no model-level default). The
    # "Add Appointment" form never sends a resources list - equipment/venue
    # assignment happens later, in Schedule follow-ups - so every single
    # appointment create request failed serializer validation with
    # "This field is required" before anything was saved. React Query then
    # had a create mutation stuck pending with no visible error, which is
    # what looked like "the table disappears and doesn't save".
    resources = models.ManyToManyField(Resource, related_name='appointments', blank=True)
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

        # Skip resource conflict check for unsaved instances
        if self.pk is None:
            return

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
from django.conf import settings  # FIX: was used below but never imported -> NameError every run
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.scheduling.models import Appointment
from apps.notifications.services import send_whatsapp, send_sms

class Command(BaseCommand):
    help = 'Send reminders for upcoming appointments'

    def handle(self, *args, **kwargs):
        now = timezone.now()
        upcoming = Appointment.objects.filter(
            start_time__gte=now,
            start_time__lte=now + timedelta(hours=24),
            status__in=['confirmed', 'pending']
        )
        for appt in upcoming:
            message = f'Reminder: Your appointment is at {appt.start_time}'
            # Send WhatsApp and SMS if credentials are configured
            if hasattr(settings, 'TWILIO_ACCOUNT_SID') and settings.TWILIO_ACCOUNT_SID:
                try:
                    send_whatsapp(appt.client.primary_phone, message)
                    send_sms(appt.client.primary_phone, message)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Failed to send reminder: {e}'))
            else:
                self.stdout.write(f'Reminder for {appt.client.name} at {appt.start_time}')

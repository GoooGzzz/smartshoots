from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.accounts.models import User, Client, PhoneNumber
from apps.production.models import Package, ProductionOrder, ProductionAssignment, Delivery
from apps.finance.models import Payment, ExpenseCategory, Expense, BusinessSettings
from apps.scheduling.models import Resource, Appointment

class Command(BaseCommand):
    help = 'Load sample data for SMART SHOOTS'

    def handle(self, *args, **kwargs):
        self.stdout.write('Loading sample data...')

        # Get or create a superuser
        if User.objects.filter(is_superuser=True).exists():
            admin = User.objects.filter(is_superuser=True).first()
        else:
            admin = User.objects.create_superuser(
                username='admin',
                email='admin@example.com',
                password='admin12345'
            )
            self.stdout.write('Created superuser "admin" with password "admin12345"')

        # Create business settings
        settings, _ = BusinessSettings.objects.get_or_create(
            name='SMART SHOOTS Studio',
            defaults={
                'currency': 'EGP',
                'timezone': 'Africa/Cairo',
                'language': 'en',
                'theme': 'light',
            }
        )

        # Create expense categories
        categories = [
            ('Internet', 'internet'),
            ('Office Rent', 'office_rent'),
            ('Electricity', 'electricity'),
        ]
        for name, ctype in categories:
            cat, created = ExpenseCategory.objects.get_or_create(
                name=name,
                category_type=ctype,
                created_by=admin,
                defaults={'is_recurring': True, 'recurring_interval': 'monthly'}
            )
            if created:
                self.stdout.write(f'Created expense category: {name}')

        # Create packages
        packages = [
            {'name': 'Hourly Learning Recording', 'type': 'hourly_learning', 'default_rate': '500.00', 'unit': 'hour'},
            {'name': 'Per-Minute Reels', 'type': 'per_minute_reels', 'default_rate': '50.00', 'unit': 'minute'},
            {'name': 'Outdoor Shoot', 'type': 'outdoor_shoot', 'default_rate': '1500.00', 'unit': 'session'},
        ]
        pkg_objects = []
        for pkg in packages:
            obj, created = Package.objects.get_or_create(
                name=pkg['name'],
                defaults={
                    'type': pkg['type'],
                    'default_rate': Decimal(pkg['default_rate']),
                    'unit': pkg['unit'],
                }
            )
            pkg_objects.append(obj)
            if created:
                self.stdout.write(f'Created package: {obj.name}')

        # Create clients
        clients_data = [
            {'name': 'Dr. Ahmed Hassan', 'type': 'doctor', 'phone': '+201001234567', 'email': 'dr.ahmed@example.com', 'notes': 'Cardiologist, prefers morning sessions'},
            {'name': 'Prof. Sara Mahmoud', 'type': 'professor', 'phone': '+201112345678', 'email': 'prof.sara@example.com', 'notes': 'University professor, needs educational content'},
            {'name': 'Mr. Mohamed Ali', 'type': 'teacher', 'phone': '+201223456789', 'email': 'mohamed.ali@example.com', 'notes': 'High school teacher, weekly sessions'},
        ]
        clients = []
        for cd in clients_data:
            client, created = Client.objects.get_or_create(
                name=cd['name'],
                defaults={
                    'type': cd['type'],
                    'primary_phone': cd['phone'],
                    'email': cd['email'],
                    'notes': cd['notes'],
                    'created_by': admin,
                }
            )
            if created:
                # Add an additional phone number
                PhoneNumber.objects.create(client=client, phone=cd['phone'], label='Primary', is_whatsapp=True)
            clients.append(client)
            self.stdout.write(f'Client: {client.name}')

        # Create production orders (only if none exist)
        if ProductionOrder.objects.count() == 0:
            # Order 1
            order1 = ProductionOrder.objects.create(
                client=clients[0],
                package=pkg_objects[0],  # Hourly learning
                quantity=Decimal('2.00'),
                rate=Decimal('500.00'),
                status='in_progress',
                order_date=timezone.now().date() - timedelta(days=7),
                requirements='Two one-hour sessions',
                notes='Client requested high-definition recording',
                created_by=admin,
            )
            # Payment for order1 (deposit)
            Payment.objects.create(
                order=order1,
                client=clients[0],
                amount=Decimal('500.00'),
                payment_date=timezone.now().date() - timedelta(days=6),
                method='vodafone_cash',
                reference='VCF-12345',
                notes='Initial deposit',
                is_deposit=True,
                recorded_by=admin,
            )

            # Order 2
            order2 = ProductionOrder.objects.create(
                client=clients[1],
                package=pkg_objects[1],  # Per-minute reels
                quantity=Decimal('10.00'),
                rate=Decimal('50.00'),
                status='delivered',
                order_date=timezone.now().date() - timedelta(days=14),
                delivery_date=timezone.now().date() - timedelta(days=10),
                requirements='Ten 1-minute reels for social media',
                notes='Delivered via Google Drive',
                created_by=admin,
            )
            # Payment for order2 (full)
            Payment.objects.create(
                order=order2,
                client=clients[1],
                amount=Decimal('500.00'),
                payment_date=timezone.now().date() - timedelta(days=12),
                method='instapay',
                reference='INSTA-67890',
                notes='Full payment',
                is_deposit=False,
                recorded_by=admin,
            )
            # Delivery for order2
            Delivery.objects.create(
                order=order2,
                delivery_date=timezone.now().date() - timedelta(days=10),
                client_received_date=timezone.now().date() - timedelta(days=9),
                method='google_drive',
                delivery_link='https://drive.google.com/example',
                status='received',
                notes='Client confirmed receipt',
                created_by=admin,
            )

            self.stdout.write('Created sample orders, payments, and delivery')

        # Create scheduling resources and an appointment (if none exist)
        if Resource.objects.count() == 0:
            camera = Resource.objects.create(name='Canon EOS R5', type='equipment', description='Main camera', color='#FF5733')
            studio = Resource.objects.create(name='Studio A', type='venue', description='Primary shooting studio', color='#33FF57')
            editor_staff = Resource.objects.create(name='Senior Editor', type='staff', description='Editing resource', color='#3357FF')
            self.stdout.write('Created resources')

            # Create appointment (only if none)
            if Appointment.objects.count() == 0:
                start = timezone.now() + timedelta(days=1, hours=10)
                end = start + timedelta(hours=1)
                appt = Appointment.objects.create(
                    client=clients[0],
                    start_time=start,
                    end_time=end,
                    status='confirmed',
                    location='Studio A',
                    notes='Sample appointment',
                    created_by=admin,
                )
                appt.resources.add(camera, studio)
                self.stdout.write('Created sample appointment')

        self.stdout.write(self.style.SUCCESS('Sample data loaded successfully!'))
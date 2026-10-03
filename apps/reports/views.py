from rest_framework.views import APIView
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

        # FIX: the Dashboard's "Appointment Status" pie chart was using
        # hardcoded placeholder numbers (45/30/15/10) that never reflected
        # real data - a fake chart sitting right next to genuinely live
        # ones is exactly the kind of thing that undermines trust in the
        # rest of the dashboard. Real counts, grouped by actual status.
        status_counts = dict(Appointment.objects.values_list('status').annotate(count=Count('id')))
        appointment_status_breakdown = [
            {'status': value, 'label': label, 'count': status_counts.get(value, 0)}
            for value, label in Appointment.STATUS_CHOICES
            if status_counts.get(value, 0) > 0
        ]

        return Response({
            'monthly_revenue': monthly_revenue,
            'collected_payments': monthly_revenue,
            'outstanding_balance': total_outstanding,
            'monthly_expenses': monthly_expenses,
            'net_cash_flow': monthly_revenue - monthly_expenses,
            'upcoming_appointments': upcoming_appointments,
            'pending_production': pending_production,
            'active_clients': active_clients,
            'appointment_status_breakdown': appointment_status_breakdown,
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
        from apps.accounts.models import Client

        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        payments = Payment.objects.filter(payment_date__gte=start_date)
        expenses = Expense.objects.filter(expense_date__gte=start_date)
        orders = ProductionOrder.objects.filter(order_date__gte=start_date)

        # NEW: per-day new-client counts, for the Dashboard's "Clients vs
        # Dates" trend chart (replaces the old Revenue vs Expenses chart -
        # see DashboardPage.tsx). Computed as both new clients that day and
        # a running cumulative total, so the frontend can plot either.
        clients_before_range = Client.objects.filter(created_at__date__lt=start_date).count()
        running_total = clients_before_range

        daily_data = []
        for i in range(days):
            date = start_date + timedelta(days=i)
            daily_payments = payments.filter(payment_date=date).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            daily_expenses = expenses.filter(expense_date=date).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            new_clients = Client.objects.filter(created_at__date=date).count()
            running_total += new_clients
            daily_data.append({
                'date': date,
                'revenue': daily_payments,
                'expenses': daily_expenses,
                'net': daily_payments - daily_expenses,
                'new_clients': new_clients,
                'total_clients': running_total,
            })

        return Response({
            'daily_data': daily_data,
            'total_revenue': payments.aggregate(total=Sum('amount'))['total'] or Decimal('0'),
            'total_expenses': expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0'),
            'total_orders': orders.count(),
            'total_order_value': orders.aggregate(total=Sum('total_amount'))['total'] or Decimal('0'),
            'new_clients_in_range': Client.objects.filter(created_at__date__gte=start_date).count(),
        })


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

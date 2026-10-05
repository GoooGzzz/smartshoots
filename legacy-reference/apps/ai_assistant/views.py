from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.accounts.models import Client
from apps.production.models import ProductionOrder
from apps.finance.models import Payment, Expense

class AssistantQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get('query', '').lower()
        response = self.process_query(query)
        return Response(response)

    def process_query(self, query):
        today = timezone.now().date()
        month_start = today.replace(day=1)

        if 'revenue' in query or 'income' in query:
            if 'month' in query or 'this month' in query:
                total = Payment.objects.filter(payment_date__gte=month_start).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                return {'answer': f'This month\'s revenue is {total} EGP.'}
            else:
                total = Payment.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                return {'answer': f'Total revenue is {total} EGP.'}

        elif 'owe' in query or 'outstanding' in query or 'unpaid' in query:
            outstanding = ProductionOrder.objects.exclude(status='cancelled').aggregate(total=Sum('remaining_balance'))['total'] or Decimal('0')
            return {'answer': f'Total outstanding balance is {outstanding} EGP.'}

        elif 'pending' in query and 'order' in query:
            count = ProductionOrder.objects.filter(status__in=['pending', 'in_progress']).count()
            return {'answer': f'There are {count} pending orders.'}

        elif 'vip' in query or 'regular' in query:
            clients = Client.objects.filter(tags__name__iexact=query).distinct()
            names = ', '.join([c.name for c in clients[:5]])
            return {'answer': f'{query.capitalize()} clients: {names}'}

        elif 'profit' in query:
            # Simple profit = revenue - expenses
            revenue = Payment.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0')
            expenses = Expense.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0')
            profit = revenue - expenses
            return {'answer': f'Net profit is {profit} EGP.'}

        elif 'expense' in query or 'spent' in query:
            if 'month' in query:
                total = Expense.objects.filter(expense_date__gte=month_start).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                return {'answer': f'This month\'s expenses are {total} EGP.'}
            else:
                total = Expense.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                return {'answer': f'Total expenses are {total} EGP.'}

        elif 'session' in query or 'appointment' in query:
            from apps.scheduling.models import Appointment
            upcoming = Appointment.objects.filter(start_time__gte=timezone.now(), status__in=['confirmed', 'pending']).count()
            return {'answer': f'There are {upcoming} upcoming sessions.'}

        elif 'client' in query or 'clients' in query:
            count = Client.objects.filter(is_active=True).count()
            return {'answer': f'There are {count} active clients.'}

        else:
            return {'answer': 'I can help with revenue, expenses, profit, outstanding balances, pending orders, VIP clients, and upcoming sessions.'}
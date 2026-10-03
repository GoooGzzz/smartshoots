from django.http import HttpResponse

def home(request):
    return HttpResponse("Welcome to SMART SHOOTS API")

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Client, ClientTag, PhoneNumber, StaffMember, StaffEvaluation
from .serializers import ClientSerializer, ClientTagSerializer, PhoneNumberSerializer, StaffMemberSerializer, StaffEvaluationSerializer
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': {'id': user.id, 'username': user.username}
        })

# NEW: there was no route to list/create ClientTags at all before this -
# the "Tags" field on the Add Client form had nowhere to fetch options
# from, so it could only ever be a free-text field. This exposes the
# fixed package-style tags (Outdoor / Reels / Learning) as selectable
# options, while still allowing new tags to be added if needed.
class ClientTagViewSet(viewsets.ModelViewSet):
    queryset = ClientTag.objects.all()
    serializer_class = ClientTagSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name']

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['type', 'category', 'is_active']
    search_fields = ['name', 'primary_phone', 'email']
    ordering_fields = ['name', 'created_at']

    def perform_create(self, serializer):
        # FIX: created_by is now read-only on the serializer (it's derived
        # from who's logged in, not user input) - it has to be supplied
        # here instead, or ModelSerializer.create()'s **validated_data
        # call would be missing this required model field.
        serializer.save(created_by=self.request.user)

    # FIX: session_count/total_revenue/outstanding_balance are now proper
    # SerializerMethodFields (see accounts/serializers.py), which call the
    # model's get_*() methods directly during serialization - manually
    # pre-computing and stashing them onto every instance in the queryset
    # here is no longer needed (and was redundant / ran the aggregation
    # queries twice: once here, once again in the serializer).

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

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

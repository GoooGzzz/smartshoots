from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Package, ProductionOrder, ProductionAssignment, Delivery, TimeLog
from .serializers import PackageSerializer, ProductionOrderSerializer, ProductionAssignmentSerializer, DeliverySerializer, TimeLogSerializer

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

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class TimeLogViewSet(viewsets.ModelViewSet):
    queryset = TimeLog.objects.all()
    serializer_class = TimeLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['order', 'staff', 'work_date']
    search_fields = ['order__order_number', 'staff__user__first_name']

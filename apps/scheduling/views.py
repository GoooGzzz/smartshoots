from rest_framework import viewsets
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

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ResourceBlockViewSet(viewsets.ModelViewSet):
    queryset = ResourceBlock.objects.all()
    serializer_class = ResourceBlockSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['resource', 'block_type']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

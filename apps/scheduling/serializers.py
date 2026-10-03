from rest_framework import serializers
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
        read_only_fields = ['duration', 'created_at', 'updated_at', 'created_by']

class ResourceBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceBlock
        fields = '__all__'
        read_only_fields = ['created_by']  # FIX: required FK, not user input

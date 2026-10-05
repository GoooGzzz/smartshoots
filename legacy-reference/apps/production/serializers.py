from rest_framework import serializers
from .models import Package, ProductionOrder, ProductionAssignment, Delivery

class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = '__all__'

class ProductionOrderSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    package_name = serializers.CharField(source='package.name', read_only=True)

    class Meta:
        model = ProductionOrder
        fields = '__all__'
        read_only_fields = ['order_id', 'order_number', 'total_amount', 'remaining_balance', 'is_financially_closed', 'created_by']

class ProductionAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = ProductionAssignment
        fields = '__all__'

class DeliverySerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.CharField(source='order.client.name', read_only=True)

    class Meta:
        model = Delivery
        fields = '__all__'
        read_only_fields = ['created_by']  # FIX: required FK, not user input

from .models import TimeLog

class TimeLogSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = TimeLog
        fields = '__all__'
        read_only_fields = ['created_at']

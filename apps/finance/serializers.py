from rest_framework import serializers
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings

class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['resulting_balance']

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'
        read_only_fields = ['created_by']  # FIX: required FK, not user input

class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['created_by']  # FIX: required FK, not user input

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = '__all__'
        # FIX: filename/file_type/file_size/uploaded_by are all derived
        # from the uploaded file itself (see AttachmentViewSet below) -
        # the frontend never sends them. With fields = '__all__' they were
        # required, writable fields, so every single-file upload failed
        # DRF validation before the file was ever saved.
        read_only_fields = ['share_token', 'uploaded_at', 'filename', 'file_type', 'file_size', 'uploaded_by']

class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessSettings
        fields = '__all__'

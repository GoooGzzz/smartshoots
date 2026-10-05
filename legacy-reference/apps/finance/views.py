from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.management import call_command
from django.http import FileResponse
import tempfile, os
from .models import Payment, ExpenseCategory, Expense, Attachment, BusinessSettings
from .serializers import PaymentSerializer, ExpenseCategorySerializer, ExpenseSerializer, AttachmentSerializer, BusinessSettingsSerializer

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['method', 'is_deposit', 'client']
    search_fields = ['reference', 'order__order_number', 'client__name']
    ordering_fields = ['payment_date', 'amount']

class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category_type', 'is_active', 'is_recurring']
    search_fields = ['name']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category', 'is_recurring']
    search_fields = ['description']
    ordering_fields = ['expense_date', 'amount']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['client', 'order', 'is_shareable']
    search_fields = ['filename', 'description']

    def perform_create(self, serializer):
        # FIX: filename/file_type/file_size/uploaded_by are now read-only
        # on the serializer (see serializers.py) - they have to be filled
        # in here from the actual uploaded file instead, or every single
        # (non-bulk) upload would 400 on missing required fields.
        file = self.request.FILES.get('file')
        extra = {}
        if file:
            extra = {
                'filename': file.name,
                'file_type': file.content_type or '',
                'file_size': file.size,
            }
        serializer.save(uploaded_by=self.request.user, **extra)

    # FIX: the frontend (BulkUpload.tsx) posts multiple files to
    # /finance/attachments/bulk/, but no such route ever existed - only
    # the standard router-generated /finance/attachments/ (single-object
    # create) did. Every bulk upload 404'd. This adds the actual endpoint
    # the frontend is calling, reusing the multi-file handling that was
    # previously (uselessly) stuck inside create() but never reachable
    # from that URL.
    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        files = request.FILES.getlist('file') or request.FILES.getlist('files')
        if not files:
            return Response({'error': 'No files provided'}, status=status.HTTP_400_BAD_REQUEST)

        attachments = []
        for file in files:
            data = {
                'file': file,
                'filename': file.name,
                'file_type': file.content_type or '',
                'file_size': file.size,
                'uploaded_by': request.user,
            }
            if request.data.get('client'):
                data['client_id'] = request.data['client']
            if request.data.get('order'):
                data['order_id'] = request.data['order']
            attachments.append(Attachment.objects.create(**data))

        serializer = self.get_serializer(attachments, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class BusinessSettingsViewSet(viewsets.ModelViewSet):
    queryset = BusinessSettings.objects.all()
    serializer_class = BusinessSettingsSerializer
    permission_classes = [IsAuthenticated]

class BackupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # FIX: without an explicit encoding, Windows opens this in its
        # locale default text encoding (often cp1252, not UTF-8). Any
        # Arabic client name/note - this app explicitly supports Arabic -
        # then raised UnicodeEncodeError and the backup silently 500'd.
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as f:
            call_command('backup_data', stdout=f)
            backup_path = f.name
        response = FileResponse(open(backup_path, 'rb'), as_attachment=True, filename='smart_shoots_backup.json')
        return response

class RestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=400)
        temp_path = os.path.join(tempfile.gettempdir(), file.name)
        with open(temp_path, 'wb+') as dest:
            for chunk in file.chunks():
                dest.write(chunk)
        try:
            call_command('restore_data', temp_path)
            return Response({'status': 'success'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

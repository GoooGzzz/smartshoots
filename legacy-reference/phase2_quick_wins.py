import os
import base64
from pathlib import Path

BASE = os.getcwd()

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

def append(path, content):
    full = os.path.join(BASE, path)
    with open(full, 'a', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Appended to {path}")

# ---------------------------------------------------------------------
# 1. Generate PWA icons using Pillow (if available) else placeholders
# ---------------------------------------------------------------------
public_dir = os.path.join(BASE, 'frontend', 'public')
os.makedirs(public_dir, exist_ok=True)

try:
    from PIL import Image, ImageDraw
    for size, name in [(192, 'pwa-192x192.png'), (512, 'pwa-512x512.png')]:
        img = Image.new('RGB', (size, size), color='#2563EB')
        draw = ImageDraw.Draw(img)
        # Draw a simple "S" or a camera icon
        draw.rectangle([size//4, size//4, 3*size//4, 3*size//4], outline='white', width=size//20)
        draw.text((size//2, size//2), "SS", fill='white', anchor='mm', font=None, size=size//3)
        img.save(os.path.join(public_dir, name))
        print(f"✅ Generated {name}")
except ImportError:
    print("⚠️ Pillow not installed. Creating placeholder text files; replace with real PNGs.")
    for name in ['pwa-192x192.png', 'pwa-512x512.png']:
        with open(os.path.join(public_dir, name), 'wb') as f:
            f.write(b'')
        print(f"✅ Created placeholder {name}")

# ---------------------------------------------------------------------
# 2. TimeLog backend model, serializer, view, URL
# ---------------------------------------------------------------------
timelog_model = '''

class TimeLog(models.Model):
    log_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='time_logs')
    staff = models.ForeignKey(StaffMember, on_delete=models.PROTECT, related_name='time_logs')
    hours = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    work_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-work_date', '-created_at']
'''
append('apps/production/models.py', timelog_model)

# Serializer for TimeLog
timelog_serializer = '''
from .models import TimeLog

class TimeLogSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    staff_name = serializers.CharField(source='staff.user.get_full_name', read_only=True)

    class Meta:
        model = TimeLog
        fields = '__all__'
        read_only_fields = ['created_at']
'''
append('apps/production/serializers.py', timelog_serializer)

# ViewSet for TimeLog
timelog_view = '''
class TimeLogViewSet(viewsets.ModelViewSet):
    queryset = TimeLog.objects.all()
    serializer_class = TimeLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['order', 'staff', 'work_date']
    search_fields = ['order__order_number', 'staff__user__first_name']
'''
append('apps/production/views.py', timelog_view)

# URL for TimeLog
timelog_url = '''
router.register(r'time-logs', views.TimeLogViewSet)
'''
append('apps/production/urls.py', timelog_url)

# ---------------------------------------------------------------------
# 3. Frontend: TimeTrackingPage.tsx
# ---------------------------------------------------------------------
time_tracking_page = '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

export default function TimeTrackingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [formData, setFormData] = useState({
    order: '',
    staff: '',
    hours: '',
    work_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const { data: ordersData } = useQuery({ queryKey: ['orders-select'], queryFn: () => apiClient.get('/production/orders/').then(res => res.data) });
  const { data: staffData } = useQuery({ queryKey: ['staff-select'], queryFn: () => apiClient.get('/accounts/staff/').then(res => res.data) });

  const { data, isLoading } = useQuery({
    queryKey: ['time-logs'],
    queryFn: () => apiClient.get('/production/time-logs/').then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (newLog: any) => apiClient.post('/production/time-logs/', newLog),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-logs'] }); handleClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: (updatedLog: any) => apiClient.put(`/production/time-logs/${updatedLog.id}/`, updatedLog),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-logs'] }); handleClose(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/production/time-logs/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-logs'] }),
  });

  const handleOpen = (log?: any) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        order: log.order,
        staff: log.staff,
        hours: log.hours,
        work_date: log.work_date,
        notes: log.notes,
      });
    } else {
      setEditingLog(null);
      setFormData({ order: '', staff: '', hours: '', work_date: new Date().toISOString().split('T')[0], notes: '' });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingLog(null); };
  const handleSubmit = () => {
    if (editingLog) updateMutation.mutate({ ...formData, id: editingLog.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => { if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id); };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const logs = data?.results ?? [];
  const orders = ordersData?.results ?? [];
  const staff = staffData?.results ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('timeTracking')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addTimeLog')}</Button>
      </Box>
      <Table>
        <TableHead><TableRow><TableCell>{t('order')}</TableCell><TableCell>{t('staff')}</TableCell><TableCell>{t('hours')}</TableCell><TableCell>{t('date')}</TableCell><TableCell>{t('notes')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id} hover>
              <TableCell>{log.order_number}</TableCell>
              <TableCell>{log.staff_name}</TableCell>
              <TableCell>{log.hours}</TableCell>
              <TableCell>{log.work_date}</TableCell>
              <TableCell>{log.notes}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(log)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(log.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingLog ? t('editTimeLog') : t('addTimeLog')}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth margin="dense" label={t('order')} value={formData.order} onChange={(e) => setFormData({ ...formData, order: e.target.value })}>
            {orders.map((o: any) => <MenuItem key={o.id} value={o.id}>{o.order_number}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('staff')} value={formData.staff} onChange={(e) => setFormData({ ...formData, staff: e.target.value })}>
            {staff.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.user?.first_name} {s.user?.last_name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('hours')} type="number" value={formData.hours} onChange={(e) => setFormData({ ...formData, hours: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('date')} type="date" value={formData.work_date} onChange={(e) => setFormData({ ...formData, work_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>{editingLog ? t('save') : t('create')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
'''
write('frontend/src/pages/TimeTrackingPage.tsx', time_tracking_page)

# ---------------------------------------------------------------------
# 4. Attachments page with BulkUpload and FilePreview
# ---------------------------------------------------------------------
attachments_page = '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton,
} from '@mui/material';
import { Delete, Visibility } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import BulkUpload from '../components/Common/BulkUpload';
import FilePreview from '../components/Common/FilePreview';

export default function AttachmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['attachments'],
    queryFn: () => apiClient.get('/finance/attachments/').then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/attachments/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments'] }),
  });

  const handlePreview = (url: string, filename: string) => {
    setPreviewUrl(url);
    setPreviewName(filename);
    setPreviewOpen(true);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const attachments = data?.results ?? [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('attachments')}</Typography>
      <BulkUpload onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['attachments'] })} />
      <Table>
        <TableHead><TableRow><TableCell>{t('filename')}</TableCell><TableCell>{t('type')}</TableCell><TableCell>{t('size')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {attachments.map((att: any) => (
            <TableRow key={att.id} hover>
              <TableCell>{att.filename}</TableCell>
              <TableCell>{att.file_type}</TableCell>
              <TableCell>{att.file_size}</TableCell>
              <TableCell>
                <IconButton onClick={() => handlePreview(att.file, att.filename)}><Visibility /></IconButton>
                <IconButton onClick={() => deleteMutation.mutate(att.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <FilePreview
        url={previewUrl}
        filename={previewName}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </Box>
  );
}
'''
write('frontend/src/pages/AttachmentsPage.tsx', attachments_page)

# ---------------------------------------------------------------------
# 5. Add routes for TimeTracking and Attachments
# ---------------------------------------------------------------------
# We'll modify App.tsx by replacing it with a version that includes new routes.
# Read current App.tsx, add imports and routes.

app_path = os.path.join(BASE, 'frontend', 'src', 'App.tsx')
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# Add imports
if "TimeTrackingPage" not in app_content:
    app_content = app_content.replace(
        "import SettingsPage from './pages/SettingsPage';",
        "import SettingsPage from './pages/SettingsPage';\nimport TimeTrackingPage from './pages/TimeTrackingPage';\nimport AttachmentsPage from './pages/AttachmentsPage';"
    )
    # Add routes
    app_content = app_content.replace(
        "<Route path=\"settings\" element={<SettingsPage />} />",
        "<Route path=\"settings\" element={<SettingsPage />} />\n              <Route path=\"time-tracking\" element={<TimeTrackingPage />} />\n              <Route path=\"attachments\" element={<AttachmentsPage />} />"
    )
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_content)
    print("✅ Updated App.tsx with new routes")
else:
    print("ℹ️ App.tsx already contains new routes")

# ---------------------------------------------------------------------
# 6. Client Tags UI: add display and selection in ClientsPage
# We'll update ClientsPage to include tags in table and form (simplified as text input).
# For full functionality, we'd need a multiselect; but we'll just display tags if any.
# We'll modify the ClientsPage.tsx to show tags column and add tags input in dialog as comma-separated.
# For simplicity, we'll add a text field for tags (comma separated) in form.
# We'll also modify the backend serializer to accept tags.

# First, update ClientsPage to display tags (assuming tags field returns array of tag names)
# We'll add a column "Tags" and a text field in dialog.
clients_page_path = os.path.join(BASE, 'frontend', 'src', 'pages', 'ClientsPage.tsx')
with open(clients_page_path, 'r', encoding='utf-8') as f:
    clients_content = f.read()

# Add tags column in table header
clients_content = clients_content.replace(
    "<TableCell>{t('email')}</TableCell>",
    "<TableCell>{t('email')}</TableCell><TableCell>{t('tags')}</TableCell>"
)
# Add tags cell
clients_content = clients_content.replace(
    "<TableCell>{client.email}</TableCell>",
    "<TableCell>{client.email}</TableCell>\n              <TableCell>{client.tags?.map((tag: any) => tag.name).join(', ') || '-'}</TableCell>"
)
# Add tags field in formData (initial state)
clients_content = clients_content.replace(
    "is_active: true,",
    "is_active: true,\n    tags: '',"
)
# Add tags field in dialog form (after address or notes)
clients_content = clients_content.replace(
    "<TextField fullWidth margin=\"dense\" label={t('notes')} multiline rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />",
    "<TextField fullWidth margin=\"dense\" label={t('notes')} multiline rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />\n          <TextField fullWidth margin=\"dense\" label={t('tags')} value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} helperText=\"Comma separated\" />"
)
# Update formData when opening edit dialog
clients_content = clients_content.replace(
    "is_active: client.is_active,",
    "is_active: client.is_active,\n        tags: client.tags?.map((tag: any) => tag.name).join(', ') || '',"
)
# Update submit to split tags into array
clients_content = clients_content.replace(
    "if (editingClient) updateMutation.mutate({ ...formData, id: editingClient.id });",
    "const payload = { ...formData, tags: formData.tags ? formData.tags.split(',').map((s: string) => s.trim()) : [] };\n    if (editingClient) updateMutation.mutate({ ...payload, id: editingClient.id });"
)
clients_content = clients_content.replace(
    "else createMutation.mutate(formData);",
    "else createMutation.mutate(payload);"
)

with open(clients_page_path, 'w', encoding='utf-8') as f:
    f.write(clients_content)
print("✅ Updated ClientsPage with tags column and input")

# Also update backend serializers to handle tags
# We'll modify ClientSerializer to accept tags as list of names and get_or_create tags.
client_serializer_path = os.path.join(BASE, 'apps', 'accounts', 'serializers.py')
with open(client_serializer_path, 'r', encoding='utf-8') as f:
    serializer_content = f.read()

# Add tags field handling
if "tags" not in serializer_content:
    serializer_content = serializer_content.replace(
        "class ClientSerializer(serializers.ModelSerializer):",
        "class ClientSerializer(serializers.ModelSerializer):\n    tags = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)\n    tags_display = serializers.SerializerMethodField()"
    )
    serializer_content = serializer_content.replace(
        "    def get_session_count(self):",
        "    def get_tags_display(self, obj):\n        return [tag.name for tag in obj.tags.all()]\n\n    def get_session_count(self):"
    )
    # Override create/update
    serializer_content = serializer_content.replace(
        "    class Meta:",
        "    def create(self, validated_data):\n        tags_data = validated_data.pop('tags', [])\n        client = Client.objects.create(**validated_data)\n        for tag_name in tags_data:\n            tag, _ = ClientTag.objects.get_or_create(name=tag_name.strip())\n            client.tags.add(tag)\n        return client\n\n    def update(self, instance, validated_data):\n        tags_data = validated_data.pop('tags', [])\n        for attr, value in validated_data.items():\n            setattr(instance, attr, value)\n        instance.save()\n        if tags_data:\n            instance.tags.clear()\n            for tag_name in tags_data:\n                tag, _ = ClientTag.objects.get_or_create(name=tag_name.strip())\n                instance.tags.add(tag)\n        return instance\n\n    class Meta:"
    )
    with open(client_serializer_path, 'w', encoding='utf-8') as f:
        f.write(serializer_content)
    print("✅ Updated ClientSerializer with tags handling")
else:
    print("ℹ️ ClientSerializer already has tags")

print("\n✅ Phase 2 quick wins and Time Tracking added.")
print("\nNext steps:")
print("1. Run migrations: python manage.py makemigrations accounts production && python manage.py migrate")
print("2. Restart frontend: cd frontend && npm run dev")
print("3. You can now access /time-tracking and /attachments pages, and clients have tags.")
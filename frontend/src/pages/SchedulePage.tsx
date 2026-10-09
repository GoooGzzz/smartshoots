import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search, CalendarMonth } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';
import CalendarBoard from '../components/Scheduling/CalendarBoard';
import { cairoInput, cairoInstant, clashes } from '../components/Scheduling/calendarUtils';
async function allPages(path: string) {
 const results:any[]=[]; let page=1, cached=false;
 while(true){ const res=await apiClient.get(`${path}?page_size=100&page=${page}`); results.push(...(res.data.results || [])); cached ||= !!(res as any)._fromCache; if(!res.data.next)break; page++; if(page>1000)throw new Error('Calendar too large. Contact studio support.'); }
 return {results,cached};
}

const statusChoices = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const arabic = i18n.language.startsWith('ar');
  const say = (en:string, ar:string) => arabic ? ar : en;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    client: '',
    start_time: '',
    end_time: '',
    status: 'pending',
    location: '',
    notes: '',
  });
  const { showError, SnackbarElement } = useErrorSnackbar();
  const [fieldErrors, setFieldErrors] = useState<{ client?: string | null; start_time?: string | null; end_time?: string | null }>({});

  const { data: clientsData } = useQuery({
    queryKey: ['clients-select'],
    queryFn: () => allPages('/accounts/clients/'),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => allPages('/scheduling/appointments/'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: (newAppt: any) => apiClient.post('/scheduling/appointments/', newAppt),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); handleClose(); },
    onError: showError,
  });
  const updateMutation = useMutation({
    mutationFn: (updatedAppt: any) => apiClient.put(`/scheduling/appointments/${updatedAppt.id}/`, updatedAppt),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); handleClose(); },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/scheduling/appointments/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: showError,
  });

  const handleOpen = (appt?: any, date?: string) => {
    setFieldErrors({});
    setEditingAppt(appt || null);
    if(appt) setFormData({client:appt.client,start_time:cairoInput(appt.start_time),end_time:cairoInput(appt.end_time),status:appt.status,location:appt.location || '',notes:appt.notes || ''});
    else { const start=date || cairoInput(new Date()); let end=''; try {end=cairoInput(Date.parse(cairoInstant(start))+3600000);}catch{} setFormData({client:'',start_time:start,end_time:end,status:'pending',location:'',notes:''}); }
    setOpen(true);
  };
  const handleClose = () => { setOpen(false); setEditingAppt(null); setFieldErrors({}); };
  const handleSubmit = () => {
    const errors: typeof fieldErrors = {
      client: formData.client ? null : t('required'),
      start_time: formData.start_time ? null : t('required'),
      end_time: formData.end_time ? null : t('required'),
    };
    if (formData.start_time && formData.end_time && formData.end_time <= formData.start_time) {
      errors.end_time = t('endTime') + ' must be after ' + t('startTime');
    }
    if (errors.client || errors.start_time || errors.end_time) {
      setFieldErrors(errors);
      return;
    }
    if(data?.cached || isError){showError(new Error(say('Refresh the live calendar before saving.','حدّث التقويم المباشر قبل الحفظ.')));return;}
    let payload:any;
    try { payload={...formData,start_time:editingAppt && cairoInput(editingAppt.start_time)===formData.start_time?editingAppt.start_time:cairoInstant(formData.start_time),end_time:editingAppt && cairoInput(editingAppt.end_time)===formData.end_time?editingAppt.end_time:cairoInstant(formData.end_time)}; }
    catch(error){setFieldErrors({start_time:say('Invalid or repeated Cairo time. Choose another time.','وقت غير صالح أو متكرر بالقاهرة. اختر وقتاً آخر.')});return;}
    const candidate={...editingAppt,...payload,id:editingAppt?.id};
    const conflict=appointments.find((a:any)=>clashes(candidate,a));
    if(conflict){setFieldErrors({end_time:say('This reservation overlaps '+conflict.client_name+' including setup buffers.','الحجز يتعارض مع '+conflict.client_name+' بما يشمل فترات التجهيز.')});return;}
    if (editingAppt) updateMutation.mutate({ ...payload, id: editingAppt.id });
    else createMutation.mutate(payload);
  };
  const handleDelete = (id: number) => {
    if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const appointments = data?.results ?? [];
  const clients = clientsData?.results ?? [];

  return (
    <Box>
      <PageHeader
        title={t('schedule')}
        icon={<CalendarMonth />}
        color="#00BCD4"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addAppointment')}</Button>}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField label={t('search')} variant="outlined" size="small" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TextField select label={t('status')} size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">{t('all')}</MenuItem>
          {statusChoices.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
        </TextField>
      </Box>
      {isError && <Alert severity="error" action={<Button onClick={()=>refetch()}>{say('Retry','إعادة المحاولة')}</Button>}>{say('Calendar could not load. Do not rely on this view for availability.','تعذر تحميل التقويم. لا تعتمد عليه لتحديد الإتاحة.')}</Alert>}
      {data?.cached && <Alert severity="warning" action={<Button onClick={()=>refetch()}>{say('Refresh','تحديث')}</Button>}>{say('Offline copy: availability may be outdated. Booking is disabled until a live refresh.','نسخة غير متصلة وقد تكون الإتاحة قديمة. الحفظ متوقف حتى التحديث المباشر.')}</Alert>}
      {!isError && <CalendarBoard appointments={appointments} search={search} status={statusFilter} arabic={arabic} onEdit={a=>handleOpen(a)} onNew={date=>handleOpen(undefined,date)}/>}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingAppt ? t('editAppointment') : t('addAppointment')}</DialogTitle>
        <DialogContent>
          <Alert severity="info">{say('All dates and times use Cairo time. Setup buffers are included in conflict checks.','كل التواريخ والأوقات بتوقيت القاهرة. فترات التجهيز مشمولة في فحص التعارض.')}</Alert>
          <TextField select fullWidth margin="dense" label={t('client')} value={formData.client}
            onChange={(e) => { setFormData({ ...formData, client: e.target.value }); setFieldErrors({ ...fieldErrors, client: null }); }}
            error={!!fieldErrors.client} helperText={fieldErrors.client || ' '}>
            {clients.map((client: any) => <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('startTime')} type="datetime-local" value={formData.start_time}
            onChange={(e) => { setFormData({ ...formData, start_time: e.target.value }); setFieldErrors({ ...fieldErrors, start_time: null }); }}
            InputLabelProps={{ shrink: true }} error={!!fieldErrors.start_time} helperText={fieldErrors.start_time || ' '} />
          <TextField fullWidth margin="dense" label={t('endTime')} type="datetime-local" value={formData.end_time}
            onChange={(e) => { setFormData({ ...formData, end_time: e.target.value }); setFieldErrors({ ...fieldErrors, end_time: null }); }}
            InputLabelProps={{ shrink: true }} error={!!fieldErrors.end_time} helperText={fieldErrors.end_time || ' '} />
          <TextField select fullWidth margin="dense" label={t('status')} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
            {statusChoices.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('location')} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" disabled={createMutation.isPending || updateMutation.isPending || isError || !!data?.cached} onClick={handleSubmit}>{editingAppt ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}

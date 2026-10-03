import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search, CalendarMonth } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const statusChoices = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export default function SchedulePage() {
  const { t } = useTranslation();
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
    queryFn: () => apiClient.get('/accounts/clients/').then(res => res.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      return apiClient.get(`/scheduling/appointments/?${params.toString()}`).then(res => res.data);
    },
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
  });

  const handleOpen = (appt?: any) => {
    if (appt) {
      setEditingAppt(appt);
      setFormData({
        client: appt.client,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        location: appt.location,
        notes: appt.notes,
      });
    } else {
      setEditingAppt(null);
      setFormData({ client: '', start_time: '', end_time: '', status: 'pending', location: '', notes: '' });
    }
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
    // datetime-local inputs give "YYYY-MM-DDTHH:mm" with no seconds - add
    // them explicitly so the payload is unambiguous ISO-8601 either way.
    const payload = {
      ...formData,
      start_time: formData.start_time.length === 16 ? `${formData.start_time}:00` : formData.start_time,
      end_time: formData.end_time.length === 16 ? `${formData.end_time}:00` : formData.end_time,
    };
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
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label={t('search')} variant="outlined" size="small" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TextField select label={t('status')} size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">{t('all')}</MenuItem>
          {statusChoices.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
        </TextField>
      </Box>
      <Table>
        <TableHead><TableRow><TableCell>{t('client')}</TableCell><TableCell>{t('startTime')}</TableCell><TableCell>{t('endTime')}</TableCell><TableCell>{t('status')}</TableCell><TableCell>{t('location')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {appointments.map((appt: any) => (
            <TableRow key={appt.id} hover>
              <TableCell>{appt.client_name}</TableCell>
              <TableCell>{new Date(appt.start_time).toLocaleString()}</TableCell>
              <TableCell>{new Date(appt.end_time).toLocaleString()}</TableCell>
              <TableCell>{t(appt.status)}</TableCell>
              <TableCell>{appt.location}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(appt)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(appt.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingAppt ? t('editAppointment') : t('addAppointment')}</DialogTitle>
        <DialogContent>
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
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" onClick={handleSubmit}>{editingAppt ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}

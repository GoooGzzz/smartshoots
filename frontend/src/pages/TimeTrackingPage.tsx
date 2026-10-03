import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Card, CardContent, Grid, LinearProgress,
} from '@mui/material';
import { Edit, Delete, Add, Groups, Person, Timer } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import apiClient from '../api/client';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const STAFF_COLORS = ['#B5482A', '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'];

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
  const { showError, SnackbarElement } = useErrorSnackbar();

  const { data, isLoading } = useQuery({
    queryKey: ['time-logs'],
    queryFn: () => apiClient.get('/production/time-logs/').then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (newLog: any) => apiClient.post('/production/time-logs/', newLog),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-logs'] }); handleClose(); },
    onError: showError,
  });
  const updateMutation = useMutation({
    mutationFn: (updatedLog: any) => apiClient.put(`/production/time-logs/${updatedLog.id}/`, updatedLog),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['time-logs'] }); handleClose(); },
    onError: showError,
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

  // NEW: "who's in charge" (hours per staff member) and "client progress"
  // (hours/sessions logged per client, via the order each log belongs to)
  // - lets a manager see at a glance which team member is carrying the
  // workload, and which clients are getting the most (or least) attention.
  const staffHours: Record<string, number> = {};
  logs.forEach((log: any) => {
    const name = log.staff_name || t('unassigned');
    staffHours[name] = (staffHours[name] || 0) + Number(log.hours || 0);
  });
  const staffChartData = Object.entries(staffHours)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);

  const orderClientMap: Record<string, string> = {};
  orders.forEach((o: any) => { orderClientMap[o.id] = o.client_name; });
  const clientHours: Record<string, { hours: number; sessions: number }> = {};
  logs.forEach((log: any) => {
    const clientName = orderClientMap[log.order] || t('unassigned');
    if (!clientHours[clientName]) clientHours[clientName] = { hours: 0, sessions: 0 };
    clientHours[clientName].hours += Number(log.hours || 0);
    clientHours[clientName].sessions += 1;
  });
  const clientProgressData = Object.entries(clientHours)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.hours - a.hours);
  const maxClientHours = Math.max(1, ...clientProgressData.map((c) => c.hours));
  const totalHoursAll = staffChartData.reduce((sum, s) => sum + s.hours, 0);

  return (
    <Box>
      <PageHeader
        title={t('timeTracking')}
        icon={<Timer />}
        color="#FF6E9C"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addTimeLog')}</Button>}
      />

      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Groups color="primary" /> {t('teamPerformance')}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>{t('hoursByStaff')}</Typography>
              {staffChartData.length === 0 ? (
                <Typography color="text.secondary">{t('noData')}</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={staffChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip />
                    <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                      {staffChartData.map((_, i) => <Cell key={i} fill={STAFF_COLORS[i % STAFF_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Typography variant="caption" color="text.secondary">{t('totalHours')}: {totalHoursAll.toFixed(1)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person fontSize="small" /> {t('clientSessionProgress')}
              </Typography>
              {clientProgressData.length === 0 ? (
                <Typography color="text.secondary">{t('noData')}</Typography>
              ) : (
                <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                  {clientProgressData.map((c, i) => (
                    <Box key={c.name} sx={{ mb: 1.2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">{c.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.hours.toFixed(1)}h · {c.sessions} {t('schedule')}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(c.hours / maxClientHours) * 100}
                        sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: STAFF_COLORS[i % STAFF_COLORS.length], borderRadius: 4 } }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
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
      {SnackbarElement}
    </Box>
  );
}

import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search, Receipt } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { amountFilter, validateAmount } from '../utils/validators';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const orderStatuses = ['draft', 'pending', 'in_progress', 'completed', 'delivered', 'closed', 'cancelled'];

export default function OrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    client: '',
    package: '',
    quantity: '1',
    rate: '0',
    status: 'draft',
    order_date: new Date().toISOString().split('T')[0],
    requirements: '',
    notes: '',
  });
  const [numError, setNumError] = useState<{ quantity?: string | null; rate?: string | null }>({});
  const { showError, SnackbarElement } = useErrorSnackbar();

  const { data: clientsData } = useQuery({
    queryKey: ['clients-select'],
    queryFn: () => apiClient.get('/accounts/clients/').then(res => res.data),
  });
  const { data: packagesData } = useQuery({
    queryKey: ['packages-select'],
    queryFn: () => apiClient.get('/production/packages/').then(res => res.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      return apiClient.get(`/production/orders/?${params.toString()}`).then(res => res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (newOrder: any) => apiClient.post('/production/orders/', newOrder),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); handleClose(); },
    onError: showError,
  });
  const updateMutation = useMutation({
    mutationFn: (updatedOrder: any) => apiClient.put(`/production/orders/${updatedOrder.id}/`, updatedOrder),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); handleClose(); },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/production/orders/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const handleOpen = (order?: any) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        client: order.client,
        package: order.package,
        quantity: String(order.quantity),
        rate: String(order.rate),
        status: order.status,
        order_date: order.order_date,
        requirements: order.requirements,
        notes: order.notes,
      });
    } else {
      setEditingOrder(null);
      setFormData({
        client: '',
        package: '',
        quantity: '1',
        rate: '0',
        status: 'draft',
        order_date: new Date().toISOString().split('T')[0],
        requirements: '',
        notes: '',
      });
    }
    setNumError({});
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingOrder(null); setNumError({}); };
  const handleSubmit = () => {
    const quantityError = validateAmount(formData.quantity) || (!formData.quantity ? t('required') : null);
    const rateError = validateAmount(formData.rate) || (!formData.rate ? t('required') : null);
    if (quantityError || rateError) {
      setNumError({ quantity: quantityError, rate: rateError });
      return;
    }
    if (editingOrder) updateMutation.mutate({ ...formData, id: editingOrder.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => {
    if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;

  const orders = data?.results ?? [];
  const clients = clientsData?.results ?? [];
  const packages = packagesData?.results ?? [];

  return (
    <Box>
      <PageHeader
        title={t('orders')}
        icon={<Receipt />}
        color="#FF9800"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addOrder')}</Button>}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label={t('search')} variant="outlined" size="small" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
        />
        <TextField
          select label={t('status')} size="small" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 150 }}
        >
          <MenuItem value="">{t('all')}</MenuItem>
          {orderStatuses.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
        </TextField>
      </Box>

      <Table>
        <TableHead><TableRow><TableCell>{t('orderNumber')}</TableCell><TableCell>{t('client')}</TableCell><TableCell>{t('package')}</TableCell><TableCell>{t('quantity')}</TableCell><TableCell>{t('totalAmount')}</TableCell><TableCell>{t('status')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {orders.map((order: any) => (
            <TableRow key={order.id} hover>
              <TableCell>{order.order_number}</TableCell>
              <TableCell>{order.client_name}</TableCell>
              <TableCell>{order.package_name}</TableCell>
              <TableCell>{order.quantity}</TableCell>
              <TableCell>{order.total_amount}</TableCell>
              <TableCell>{t(order.status)}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(order)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(order.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingOrder ? t('editOrder') : t('addOrder')}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth margin="dense" label={t('client')} value={formData.client} onChange={(e) => setFormData({ ...formData, client: e.target.value })}>
            {clients.map((client: any) => <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('package')} value={formData.package} onChange={(e) => {
            const pkg = packages.find((p: any) => p.id === e.target.value);
            setFormData({ ...formData, package: e.target.value, rate: pkg ? String(pkg.default_rate) : formData.rate });
          }}>
            {packages.length === 0 && <MenuItem disabled value="">{t('noData')}</MenuItem>}
            {packages.map((pkg: any) => <MenuItem key={pkg.id} value={pkg.id}>{pkg.name}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth margin="dense" label={t('quantity')} value={formData.quantity}
            onChange={(e) => { const v = amountFilter(e.target.value); setFormData({ ...formData, quantity: v }); setNumError({ ...numError, quantity: validateAmount(v) }); }}
            error={!!numError.quantity}
            helperText={numError.quantity || (packages.find((p: any) => p.id === formData.package)?.unit ? `In ${packages.find((p: any) => p.id === formData.package)?.unit}s` : ' ')}
            inputProps={{ inputMode: 'decimal' }}
          />
          <TextField
            fullWidth margin="dense" label={t('rate')} value={formData.rate}
            onChange={(e) => { const v = amountFilter(e.target.value); setFormData({ ...formData, rate: v }); setNumError({ ...numError, rate: validateAmount(v) }); }}
            error={!!numError.rate} helperText={numError.rate || ' '}
            inputProps={{ inputMode: 'decimal' }}
          />
          <TextField select fullWidth margin="dense" label={t('status')} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
            {orderStatuses.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('orderDate')} type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth margin="dense" label={t('requirements')} multiline rows={2} value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>{editingOrder ? t('save') : t('create')}</Button>
        </DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}

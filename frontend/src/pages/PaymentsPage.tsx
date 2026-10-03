import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search, Payment as PaymentIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { amountFilter, validateAmount } from '../utils/validators';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const paymentMethods = ['vodafone_cash', 'instapay', 'cash'];

export default function PaymentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [formData, setFormData] = useState({
    order: '',
    client: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    method: 'cash',
    reference: '',
    notes: '',
    is_deposit: false,
  });

  const { data: ordersData } = useQuery({ queryKey: ['orders-select'], queryFn: () => apiClient.get('/production/orders/').then(res => res.data) });
  const { data: clientsData } = useQuery({ queryKey: ['clients-select'], queryFn: () => apiClient.get('/accounts/clients/').then(res => res.data) });
  const { showError, SnackbarElement } = useErrorSnackbar();

  const { data, isLoading } = useQuery({
    queryKey: ['payments', search, methodFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (methodFilter) params.append('method', methodFilter);
      return apiClient.get(`/finance/payments/?${params.toString()}`).then(res => res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (newPayment: any) => apiClient.post('/finance/payments/', newPayment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payments'] }); queryClient.invalidateQueries({ queryKey: ['orders'] }); handleClose(); },
    onError: showError,
  });
  const updateMutation = useMutation({
    mutationFn: (updatedPayment: any) => apiClient.put(`/finance/payments/${updatedPayment.id}/`, updatedPayment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payments'] }); queryClient.invalidateQueries({ queryKey: ['orders'] }); handleClose(); },
    onError: showError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/payments/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  const handleOpen = (payment?: any) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        order: payment.order,
        client: payment.client,
        amount: payment.amount,
        payment_date: payment.payment_date,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        is_deposit: payment.is_deposit,
      });
    } else {
      setEditingPayment(null);
      setFormData({ order: '', client: '', amount: '', payment_date: new Date().toISOString().split('T')[0], method: 'cash', reference: '', notes: '', is_deposit: false });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingPayment(null); setAmountError(null); setOrderError(null); };
  const [amountError, setAmountError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const handleSubmit = () => {
    const err = validateAmount(formData.amount) || (!formData.amount ? t('required') : null);
    const orderErr = formData.order ? null : t('required');
    if (err || orderErr) { setAmountError(err); setOrderError(orderErr); return; }
    if (editingPayment) updateMutation.mutate({ ...formData, id: editingPayment.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => { if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id); };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const payments = data?.results ?? [];
  const orders = ordersData?.results ?? [];
  const clients = clientsData?.results ?? [];

  return (
    <Box>
      <PageHeader
        title={t('payments')}
        icon={<PaymentIcon />}
        color="#4CAF50"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addPayment')}</Button>}
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label={t('search')} variant="outlined" size="small" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TextField select label={t('method')} size="small" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">{t('all')}</MenuItem>
          {paymentMethods.map(m => <MenuItem key={m} value={m}>{t(m)}</MenuItem>)}
        </TextField>
      </Box>
      <Table>
        <TableHead><TableRow><TableCell>{t('orderNumber')}</TableCell><TableCell>{t('client')}</TableCell><TableCell>{t('amount')}</TableCell><TableCell>{t('paymentDate')}</TableCell><TableCell>{t('method')}</TableCell><TableCell>{t('reference')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {payments.map((payment: any) => (
            <TableRow key={payment.id} hover>
              <TableCell>{payment.order_number}</TableCell>
              <TableCell>{payment.client_name}</TableCell>
              <TableCell>{payment.amount}</TableCell>
              <TableCell>{payment.payment_date}</TableCell>
              <TableCell>{t(payment.method)}</TableCell>
              <TableCell>{payment.reference}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(payment)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(payment.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingPayment ? t('editPayment') : t('addPayment')}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth margin="dense" label={t('order')} value={formData.order}
            error={!!orderError} helperText={orderError || (orders.length === 0 ? t('noData') : ' ')}
            onChange={(e) => {
              const ord = orders.find((o: any) => o.id === e.target.value);
              setFormData({ ...formData, order: e.target.value, client: ord ? ord.client : formData.client });
              setOrderError(null);
            }}>
            {orders.length === 0 && <MenuItem disabled value="">{t('noData')}</MenuItem>}
            {orders.map((order: any) => <MenuItem key={order.id} value={order.id}>{order.order_number} — {order.client_name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('client')} value={formData.client} onChange={(e) => setFormData({ ...formData, client: e.target.value })}>
            {clients.map((client: any) => <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth margin="dense" label={t('amount')} value={formData.amount}
            onChange={(e) => { const v = amountFilter(e.target.value); setFormData({ ...formData, amount: v }); setAmountError(validateAmount(v)); }}
            error={!!amountError} helperText={amountError || ' '}
            inputProps={{ inputMode: 'decimal' }}
          />
          <TextField fullWidth margin="dense" label={t('paymentDate')} type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField select fullWidth margin="dense" label={t('method')} value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
            {paymentMethods.map(m => <MenuItem key={m} value={m}>{t(m)}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('reference')} value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          <TextField select fullWidth margin="dense" label={t('deposit')} value={formData.is_deposit ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, is_deposit: e.target.value === 'true' })}>
            <MenuItem value="false">No</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" onClick={handleSubmit}>{editingPayment ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}

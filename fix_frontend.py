import os

BASE = os.path.join(os.getcwd(), 'frontend', 'src')

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

# ---------------------------------------------------------------------
# OrdersPage.tsx
# ---------------------------------------------------------------------
write('pages/OrdersPage.tsx', '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

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
    quantity: 1,
    rate: 0,
    status: 'draft',
    order_date: new Date().toISOString().split('T')[0],
    requirements: '',
    notes: '',
  });

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
  });
  const updateMutation = useMutation({
    mutationFn: (updatedOrder: any) => apiClient.put(`/production/orders/${updatedOrder.id}/`, updatedOrder),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); handleClose(); },
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
        quantity: order.quantity,
        rate: order.rate,
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
        quantity: 1,
        rate: 0,
        status: 'draft',
        order_date: new Date().toISOString().split('T')[0],
        requirements: '',
        notes: '',
      });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingOrder(null); };
  const handleSubmit = () => {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('orders')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addOrder')}</Button>
      </Box>

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
          <TextField select fullWidth margin="dense" label={t('package')} value={formData.package} onChange={(e) => setFormData({ ...formData, package: e.target.value })}>
            {packages.map((pkg: any) => <MenuItem key={pkg.id} value={pkg.id}>{pkg.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('quantity')} type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })} />
          <TextField fullWidth margin="dense" label={t('rate')} type="number" value={formData.rate} onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })} />
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
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# SchedulePage.tsx
# ---------------------------------------------------------------------
write('pages/SchedulePage.tsx', '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

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
  });
  const updateMutation = useMutation({
    mutationFn: (updatedAppt: any) => apiClient.put(`/scheduling/appointments/${updatedAppt.id}/`, updatedAppt),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments'] }); handleClose(); },
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

  const handleClose = () => { setOpen(false); setEditingAppt(null); };
  const handleSubmit = () => {
    if (editingAppt) updateMutation.mutate({ ...formData, id: editingAppt.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => {
    if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const appointments = data?.results ?? [];
  const clients = clientsData?.results ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('schedule')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addAppointment')}</Button>
      </Box>
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
          <TextField select fullWidth margin="dense" label={t('client')} value={formData.client} onChange={(e) => setFormData({ ...formData, client: e.target.value })}>
            {clients.map((client: any) => <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('startTime')} type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth margin="dense" label={t('endTime')} type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField select fullWidth margin="dense" label={t('status')} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
            {statusChoices.map(status => <MenuItem key={status} value={status}>{t(status)}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('location')} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" onClick={handleSubmit}>{editingAppt ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# PaymentsPage.tsx
# ---------------------------------------------------------------------
write('pages/PaymentsPage.tsx', '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payments'] }); handleClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: (updatedPayment: any) => apiClient.put(`/finance/payments/${updatedPayment.id}/`, updatedPayment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payments'] }); handleClose(); },
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

  const handleClose = () => { setOpen(false); setEditingPayment(null); };
  const handleSubmit = () => {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('payments')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addPayment')}</Button>
      </Box>
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
          <TextField select fullWidth margin="dense" label={t('order')} value={formData.order} onChange={(e) => setFormData({ ...formData, order: e.target.value })}>
            {orders.map((order: any) => <MenuItem key={order.id} value={order.id}>{order.order_number}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('client')} value={formData.client} onChange={(e) => setFormData({ ...formData, client: e.target.value })}>
            {clients.map((client: any) => <MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('amount')} type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
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
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# ExpensesPage.tsx
# ---------------------------------------------------------------------
write('pages/ExpensesPage.tsx', '''import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

export default function ExpensesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    is_recurring: false,
  });

  const { data: categoriesData } = useQuery({ queryKey: ['expense-categories'], queryFn: () => apiClient.get('/finance/expense-categories/').then(res => res.data) });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      return apiClient.get(`/finance/expenses/?${params.toString()}`).then(res => res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (newExpense: any) => apiClient.post('/finance/expenses/', newExpense),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); handleClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: (updatedExpense: any) => apiClient.put(`/finance/expenses/${updatedExpense.id}/`, updatedExpense),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); handleClose(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/expenses/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const handleOpen = (expense?: any) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        amount: expense.amount,
        expense_date: expense.expense_date,
        description: expense.description,
        is_recurring: expense.is_recurring,
      });
    } else {
      setEditingExpense(null);
      setFormData({ category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', is_recurring: false });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingExpense(null); };
  const handleSubmit = () => {
    if (editingExpense) updateMutation.mutate({ ...formData, id: editingExpense.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => { if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id); };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const expenses = data?.results ?? [];
  const categories = categoriesData?.results ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{t('expenses')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addExpense')}</Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label={t('search')} variant="outlined" size="small" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TextField select label={t('category')} size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">{t('all')}</MenuItem>
          {categories.map((cat: any) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
        </TextField>
      </Box>
      <Table>
        <TableHead><TableRow><TableCell>{t('category')}</TableCell><TableCell>{t('amount')}</TableCell><TableCell>{t('expenseDate')}</TableCell><TableCell>{t('description')}</TableCell><TableCell>{t('recurring')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {expenses.map((expense: any) => (
            <TableRow key={expense.id} hover>
              <TableCell>{expense.category_name}</TableCell>
              <TableCell>{expense.amount}</TableCell>
              <TableCell>{expense.expense_date}</TableCell>
              <TableCell>{expense.description}</TableCell>
              <TableCell>{expense.is_recurring ? t('yes') : t('no')}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleOpen(expense)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(expense.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editingExpense ? t('editExpense') : t('addExpense')}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth margin="dense" label={t('category')} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
            {categories.map((cat: any) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth margin="dense" label={t('amount')} type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('expenseDate')} type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth margin="dense" label={t('description')} multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <TextField select fullWidth margin="dense" label={t('recurring')} value={formData.is_recurring ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.value === 'true' })}>
            <MenuItem value="false">No</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" onClick={handleSubmit}>{editingExpense ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# ReportsPage.tsx
# ---------------------------------------------------------------------
write('pages/ReportsPage.tsx', '''import React, { useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, TextField, Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-report'],
    queryFn: () => apiClient.get('/reports/dashboard/').then(res => res.data),
  });

  const { data: financialData } = useQuery({
    queryKey: ['financial-report', days],
    queryFn: () => apiClient.get(`/reports/financial/?days=${days}`).then(res => res.data),
  });

  const exportToExcel = () => {
    if (!financialData?.daily_data) return;
    const worksheet = XLSX.utils.json_to_sheet(financialData.daily_data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Report');
    XLSX.writeFile(workbook, 'financial_report.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('SMART SHOOTS - Financial Report', 14, 15);
    autoTable(doc, {
      head: [['Date', 'Revenue', 'Expenses', 'Net']],
      body: financialData?.daily_data.map((row: any) => [row.date, row.revenue, row.expenses, row.net]) || [],
    });
    doc.save('financial_report.pdf');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('reports')}</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('dashboardReport')}</Typography>
            <Typography>{t('monthlyRevenue')}: {dashboardData?.monthly_revenue ?? '-'}</Typography>
            <Typography>{t('outstandingBalance')}: {dashboardData?.outstanding_balance ?? '-'}</Typography>
            <Typography>{t('monthlyExpenses')}: {dashboardData?.monthly_expenses ?? '-'}</Typography>
            <Typography>{t('netCashFlow')}: {dashboardData?.net_cash_flow ?? '-'}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('financialReport')} ({days} {t('days')})</Typography>
            <Typography>{t('totalRevenue')}: {financialData?.total_revenue ?? '-'}</Typography>
            <Typography>{t('totalExpenses')}: {financialData?.total_expenses ?? '-'}</Typography>
            <Typography>{t('totalOrders')}: {financialData?.total_orders ?? '-'}</Typography>
            <Typography>{t('totalOrderValue')}: {financialData?.total_order_value ?? '-'}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>
      <Box sx={{ mt: 3 }}>
        <TextField
          label={t('days')}
          type="number"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value) || 30)}
          size="small"
          sx={{ mr: 2 }}
        />
        <Button variant="contained" onClick={exportToExcel} sx={{ mr: 2 }}>{t('exportExcel')}</Button>
        <Button variant="outlined" onClick={exportToPDF}>{t('exportPDF')}</Button>
      </Box>
    </Box>
  );
}
''')

# ---------------------------------------------------------------------
# SettingsPage.tsx (already fixed but ensure no stray comments)
# ---------------------------------------------------------------------
write('pages/SettingsPage.tsx', '''import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    name: '',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    language: 'en',
    theme: 'light',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_number: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['business-settings'],
    queryFn: () => apiClient.get('/finance/settings/').then(res => res.data),
  });

  useEffect(() => {
    if (data?.results?.length > 0) {
      const s = data.results[0];
      setSettings({
        name: s.name || '',
        currency: s.currency || 'EGP',
        timezone: s.timezone || 'Africa/Cairo',
        language: s.language || 'en',
        theme: s.theme || 'light',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        website: s.website || '',
        tax_number: s.tax_number || '',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updated: any) => apiClient.put(`/finance/settings/${updated.id}/`, updated),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-settings'] }),
  });
  const createMutation = useMutation({
    mutationFn: (newSettings: any) => apiClient.post('/finance/settings/', newSettings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-settings'] }),
  });

  const handleSave = () => {
    if (data?.results?.length > 0) {
      const current = data.results[0];
      updateMutation.mutate({ ...settings, id: current.id });
    } else {
      createMutation.mutate(settings);
    }
  };

  if (isLoading && !data) return <Typography>{t('loading')}</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('settings')}</Typography>
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('businessName')} value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('currency')} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('timezone')} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('language')} value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('theme')} value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('address')} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('phone')} value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('email')} value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('website')} value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('taxNumber')} value={settings.tax_number} onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })} margin="normal" />
            </Grid>
          </Grid>
          <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }}>{t('save')}</Button>
        </CardContent>
      </Card>
    </Box>
  );
}
''')

print("\\n✅ All remaining pages fixed successfully.")
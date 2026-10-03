import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { Edit, Delete, Add, Search, MoneyOff } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { amountFilter, validateAmount } from '../utils/validators';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const expenseMethods = ['purchasing', 'withdraw'];

export default function ExpensesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    method: 'purchasing',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    is_recurring: false,
  });
  const { showError, SnackbarElement } = useErrorSnackbar();

  const { data: categoriesData } = useQuery({ queryKey: ['expense-categories'], queryFn: () => apiClient.get('/finance/expense-categories/').then(res => res.data) });
  // Unfiltered fetch used only to compute per-category counts for the
  // filter dropdown breakdown, independent of whatever filter is active.
  const { data: allExpensesData } = useQuery({ queryKey: ['expenses-all'], queryFn: () => apiClient.get('/finance/expenses/').then(res => res.data) });

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
    onError: showError,
  });
  const updateMutation = useMutation({
    mutationFn: (updatedExpense: any) => apiClient.put(`/finance/expenses/${updatedExpense.id}/`, updatedExpense),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); handleClose(); },
    onError: showError,
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
        method: expense.method || 'purchasing',
        amount: expense.amount,
        expense_date: expense.expense_date,
        description: expense.description,
        is_recurring: expense.is_recurring,
      });
    } else {
      setEditingExpense(null);
      setFormData({ category: '', method: 'purchasing', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', is_recurring: false });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingExpense(null); setAmountError(null); };
  const [amountError, setAmountError] = useState<string | null>(null);
  const handleSubmit = () => {
    const err = validateAmount(formData.amount) || (!formData.amount ? t('required') : null);
    if (err) { setAmountError(err); return; }
    if (editingExpense) updateMutation.mutate({ ...formData, id: editingExpense.id });
    else createMutation.mutate(formData);
  };
  const handleDelete = (id: number) => { if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id); };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const expenses = data?.results ?? [];
  const allExpenses = allExpensesData?.results ?? expenses;
  const categories = categoriesData?.results ?? [];

  return (
    <Box>
      <PageHeader
        title={t('expenses')}
        icon={<MoneyOff />}
        color="#F44336"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addExpense')}</Button>}
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label={t('search')} variant="outlined" size="small" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
        <TextField select label={t('category')} size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ width: 220 }}>
          <MenuItem value="">{t('all')} ({allExpenses.length})</MenuItem>
          {categories.length === 0 && <MenuItem disabled value="">{t('noData')}</MenuItem>}
          {categories.map((cat: any) => {
            const count = allExpenses.filter((e: any) => e.category === cat.id).length;
            return <MenuItem key={cat.id} value={cat.id}>{cat.name} ({count})</MenuItem>;
          })}
        </TextField>
      </Box>
      <Table>
        <TableHead><TableRow><TableCell>{t('category')}</TableCell><TableCell>{t('method')}</TableCell><TableCell>{t('amount')}</TableCell><TableCell>{t('expenseDate')}</TableCell><TableCell>{t('description')}</TableCell><TableCell>{t('recurring')}</TableCell><TableCell>{t('actions')}</TableCell></TableRow></TableHead>
        <TableBody>
          {expenses.map((expense: any) => (
            <TableRow key={expense.id} hover>
              <TableCell>{expense.category_name}</TableCell>
              <TableCell>{t(expense.method || 'purchasing')}</TableCell>
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
            {categories.length === 0 && <MenuItem disabled value="">{t('noData')}</MenuItem>}
            {categories.map((cat: any) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('method')} value={formData.method} onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
            {expenseMethods.map(m => <MenuItem key={m} value={m}>{t(m)}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth margin="dense" label={t('amount')} value={formData.amount}
            onChange={(e) => { const v = amountFilter(e.target.value); setFormData({ ...formData, amount: v }); setAmountError(validateAmount(v)); }}
            error={!!amountError} helperText={amountError || ' '}
            inputProps={{ inputMode: 'decimal' }}
          />
          <TextField fullWidth margin="dense" label={t('expenseDate')} type="date" value={formData.expense_date} onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth margin="dense" label={t('description')} multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <TextField select fullWidth margin="dense" label={t('recurring')} value={formData.is_recurring ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.value === 'true' })}>
            <MenuItem value="false">No</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={handleClose}>{t('cancel')}</Button><Button variant="contained" onClick={handleSubmit}>{editingExpense ? t('save') : t('create')}</Button></DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}

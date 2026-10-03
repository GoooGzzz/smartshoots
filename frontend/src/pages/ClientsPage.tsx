import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Autocomplete, Chip,
} from '@mui/material';
import { Edit, Delete, Add, Search, WhatsApp, People } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { validateName, validatePhone, nameFilter, digitsOnlyFilter, toWhatsAppNumber } from '../utils/validators';
import { useErrorSnackbar } from '../components/Common/useErrorSnackbar';
import PageHeader from '../components/Common/PageHeader';

const clientTypes = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'professor', label: 'Professor' },
  { value: 'other', label: 'Other' },
];

const clientCategories = [
  { value: 'academic', label: 'Academic' },
  { value: 'business', label: 'Business' },
];

export default function ClientsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'other',
    category: 'academic',
    primary_phone: '',
    email: '',
    notes: '',
    address: '',
    is_active: true,
    tags: [] as string[],
  });
  const { showError, SnackbarElement } = useErrorSnackbar();

  // NEW: tags are now a real selectable list (Outdoor / Reels / Learning
  // by default, seeded automatically - see run_server.py) instead of a
  // free-text field with nowhere to fetch options from.
  const { data: tagsData } = useQuery({
    queryKey: ['client-tags'],
    queryFn: () => apiClient.get('/accounts/client-tags/').then(res => res.data),
  });
  const tagOptions: string[] = (tagsData?.results ?? tagsData ?? []).map((tg: any) => tg.name);

  // Fetch clients with search and filter
  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type) params.append('type', type);
      return apiClient.get(`/accounts/clients/?${params.toString()}`).then(res => res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (newClient: any) => apiClient.post('/accounts/clients/', newClient),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); handleClose(); },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: (updatedClient: any) => apiClient.put(`/accounts/clients/${updatedClient.id}/`, updatedClient),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); handleClose(); },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/accounts/clients/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const handleOpen = (client?: any) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        type: client.type,
        category: client.category || 'academic',
        primary_phone: client.primary_phone,
        email: client.email,
        notes: client.notes,
        address: client.address,
        is_active: client.is_active,
        tags: client.tags?.map((tag: any) => tag.name) || [],
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        type: 'other',
        category: 'academic',
        primary_phone: '',
        email: '',
        notes: '',
        address: '',
        is_active: true,
        tags: [],
      });
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditingClient(null); setErrors({}); };

  const [errors, setErrors] = useState<{ name?: string | null; primary_phone?: string | null }>({});

  const handleSubmit = () => {
    const nameError = validateName(formData.name) || (!formData.name ? t('required') : null);
    const phoneError = validatePhone(formData.primary_phone) || (!formData.primary_phone ? t('required') : null);
    if (nameError || phoneError) {
      setErrors({ name: nameError, primary_phone: phoneError });
      return;
    }
    // FIX: the serializer exposes the client's tags as a read-only nested
    // field named `tags` (id + name + color) - it can never be written to
    // directly. Writing happens through the separate `tags_input` field
    // (a plain list of tag name strings), which the serializer's
    // create()/update() use to get_or_create ClientTag rows. The old code
    // sent `tags: "a, b, c"` here, which DRF silently dropped as a
    // read-only field on every single save - tags picked in the form were
    // never actually persisted.
    const { tags, ...rest } = formData;
    const payload = { ...rest, tags_input: tags };
    if (editingClient) updateMutation.mutate({ ...payload, id: editingClient.id });
    else createMutation.mutate(payload);
  };

  const handleDelete = (id: number) => {
    if (window.confirm(t('confirmDelete'))) deleteMutation.mutate(id);
  };

  if (isLoading) return <Typography>{t('loading')}</Typography>;
  const clients = data?.results ?? [];

  return (
    <Box>
      <PageHeader
        title={t('clients')}
        icon={<People />}
        color="#2196F3"
        action={<Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>{t('addClient')}</Button>}
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label={t('search')} variant="outlined" size="small" value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
        />
        <TextField
          select label={t('type')} size="small" value={type}
          onChange={(e) => setType(e.target.value)} sx={{ width: 150 }}
        >
          <MenuItem value="">{t('all')}</MenuItem>
          {clientTypes.map(option => <MenuItem key={option.value} value={option.value}>{t(option.value)}</MenuItem>)}
        </TextField>
      </Box>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{t('name')}</TableCell>
            <TableCell>{t('type')}</TableCell>
            <TableCell>{t('businessType')}</TableCell>
            <TableCell>{t('phone')}</TableCell>
            <TableCell>{t('email')}</TableCell>
            <TableCell>{t('tags')}</TableCell>
            <TableCell>{t('actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client: any) => (
            <TableRow key={client.id} hover onClick={() => navigate(`/clients/${client.id}`)} sx={{ cursor: 'pointer' }}>
              <TableCell>{client.name}</TableCell>
              <TableCell>{t(client.type)}</TableCell>
              <TableCell>{client.primary_phone}</TableCell>
              <TableCell>{client.email}</TableCell>
              <TableCell>{client.tags?.map((tag: any) => tag.name).join(', ') || '-'}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <IconButton href={`https://wa.me/${toWhatsAppNumber(client.primary_phone)}`} target="_blank" color="success"><WhatsApp /></IconButton>
                <IconButton onClick={() => handleOpen(client)}><Edit /></IconButton>
                <IconButton onClick={() => handleDelete(client.id)}><Delete /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingClient ? t('editClient') : t('addClient')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="dense" label={t('name')} value={formData.name}
            onChange={(e) => { const v = nameFilter(e.target.value); setFormData({ ...formData, name: v }); setErrors({ ...errors, name: validateName(v) }); }}
            error={!!errors.name} helperText={errors.name || ' '}
          />
          <TextField select fullWidth margin="dense" label={t('type')} value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
            {clientTypes.map(option => <MenuItem key={option.value} value={option.value}>{t(option.value)}</MenuItem>)}
          </TextField>
          <TextField select fullWidth margin="dense" label={t('businessType')} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
            {clientCategories.map(option => <MenuItem key={option.value} value={option.value}>{t(option.value)}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth margin="dense" label={t('phone')} value={formData.primary_phone}
            onChange={(e) => { const v = digitsOnlyFilter(e.target.value).slice(0, 11); setFormData({ ...formData, primary_phone: v }); setErrors({ ...errors, primary_phone: validatePhone(v) }); }}
            error={!!errors.primary_phone} helperText={errors.primary_phone || 'e.g. 01012345678'}
            inputProps={{ inputMode: 'numeric', maxLength: 11 }}
          />
          <TextField fullWidth margin="dense" label={t('email')} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          <TextField fullWidth margin="dense" label={t('address')} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          <Autocomplete
            multiple freeSolo fullWidth
            options={tagOptions}
            value={formData.tags}
            onChange={(_e, newValue) => setFormData({ ...formData, tags: newValue })}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => <Chip label={option} {...getTagProps({ index })} key={option} size="small" />)
            }
            renderInput={(params) => <TextField {...params} margin="dense" label={t('tags')} placeholder={t('selectTags')} />}
          />
          <TextField fullWidth margin="dense" label={t('notes')} multiline rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit}>{editingClient ? t('save') : t('create')}</Button>
        </DialogActions>
      </Dialog>
      {SnackbarElement}
    </Box>
  );
}
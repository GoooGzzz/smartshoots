import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Grid, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { Person } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import PageHeader from '../components/Common/PageHeader';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['client-detail', id],
    queryFn: () => apiClient.get(`/accounts/clients/${id}/full_details/`).then(res => res.data),
  });

  if (isLoading) return <Typography>{t('loading')}</Typography>;

  const client = data?.client;
  const orders = data?.orders ?? [];
  const sessions = data?.sessions ?? [];
  const payments = data?.payments ?? [];
  const attachments = data?.attachments ?? [];

  return (
    <Box>
      <PageHeader title={client?.name || ''} icon={<Person />} color="#2196F3" subtitle={`${client?.email || ''}${client?.email ? ' | ' : ''}${client?.primary_phone || ''}`} />
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('orders')}</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('orderNumber')}</TableCell><TableCell>{t('status')}</TableCell><TableCell>{t('totalAmount')}</TableCell></TableRow></TableHead>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.order_number}><TableCell>{o.order_number}</TableCell><TableCell>{o.status}</TableCell><TableCell>{o.total_amount}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('schedule')}</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('startTime')}</TableCell><TableCell>{t('endTime')}</TableCell><TableCell>{t('status')}</TableCell></TableRow></TableHead>
              <TableBody>
                {sessions.map((s: any, idx: number) => (
                  <TableRow key={idx}><TableCell>{new Date(s.start_time).toLocaleString()}</TableCell><TableCell>{new Date(s.end_time).toLocaleString()}</TableCell><TableCell>{s.status}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('payments')}</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('amount')}</TableCell><TableCell>{t('paymentDate')}</TableCell><TableCell>{t('method')}</TableCell></TableRow></TableHead>
              <TableBody>
                {payments.map((p: any, idx: number) => (
                  <TableRow key={idx}><TableCell>{p.amount}</TableCell><TableCell>{p.payment_date}</TableCell><TableCell>{p.method}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="h6">{t('attachments')}</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('filename')}</TableCell><TableCell>{t('type')}</TableCell><TableCell>{t('uploadedAt')}</TableCell></TableRow></TableHead>
              <TableBody>
                {attachments.map((a: any, idx: number) => (
                  <TableRow key={idx}><TableCell>{a.filename}</TableCell><TableCell>{a.file_type}</TableCell><TableCell>{new Date(a.uploaded_at).toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  );
}

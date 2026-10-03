import React, { useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, TextField, Button } from '@mui/material';
import { Assessment } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../components/Common/PageHeader';

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
      <PageHeader title={t('reports')} icon={<Assessment />} color="#9C27B0" />
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

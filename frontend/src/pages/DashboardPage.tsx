import StudioToday from '../components/StudioToday';
import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusChip from '../components/Common/SyncStatusChip';
import { TrendingUp, People, Schedule, Receipt, Groups, Dashboard as DashboardIcon, Payment as PaymentIcon, Description, CalendarMonth } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import apiClient from '../api/client';
import PageHeader from '../components/Common/PageHeader';

const COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#F44336'];

// Reusable "3D" card treatment: a soft gradient face, a bright top-edge
// highlight, and a layered shadow stack (a tight dark shadow plus a wider
// soft one) to fake real depth instead of MUI's flat default elevation.
const raised3d = (_accent:string)=>({borderRadius:2,background:'background.paper',boxShadow:'none',border:'1px solid',borderColor:'divider'});

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get('/reports/dashboard/').then(res => res.data),
  });

  const { data: financialData } = useQuery({
    queryKey: ['financial-report', 30],
    queryFn: () => apiClient.get('/reports/financial/?days=30').then(res => res.data),
  });

  // FIX: was hardcoded placeholder numbers (45/30/15/10) that never
  // reflected reality - now sourced from the real per-status counts
  // added to DashboardReportView above.
  const appointmentStatusData = (dashboardData?.appointment_status_breakdown ?? []).map((s: any) => ({
    name: t(s.status),
    value: s.count,
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 18 ? t('goodAfternoon') : t('goodEvening');

  const stats = [
    { title: t('monthlyRevenue'), value: dashboardData?.monthly_revenue ?? 0, icon: <TrendingUp />, color: '#4CAF50' },
    { title: t('activeClients'), value: dashboardData?.active_clients ?? 0, icon: <People />, color: '#2196F3' },
    { title: t('upcomingSessions'), value: dashboardData?.upcoming_appointments ?? 0, icon: <Schedule />, color: '#FF9800' },
    { title: t('outstandingBalance'), value: dashboardData?.outstanding_balance ?? 0, icon: <Receipt />, color: '#F44336' },
  ];

  // Data that feeds the "Clients vs Dates" trend chart requested to
  // replace Revenue vs Expenses - each day's new client signups, plus the
  // running cumulative client count (see reports/views.py FinancialReportView).
  const clientTrendData = (financialData?.daily_data ?? []).map((d: any) => ({
    date: d.date,
    newClients: d.new_clients,
    totalClients: d.total_clients,
  }));

  return (
    <Box>
      <StudioToday />
      <PageHeader title={t('dashboard')} icon={<DashboardIcon />} color="#173c60" />
      {/* NEW: greeting hero - time-aware welcome, live sync status, and
          one-tap shortcuts to the things done most. */}
      <Card sx={{ mb: 3, position: 'relative', overflow: 'hidden', color: '#fff', border: 'none',
        background: '#252421' }}>
        <CardContent sx={{ position: 'relative', p: { xs: 2.5, sm: 3.5 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: '0.12em' }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {greeting}{user?.first_name || user?.username ? `, ${user.first_name || user.username}` : ''}
              </Typography>
            </Box>
            <SyncStatusChip />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
            {[
              { l: t('clients'), i: <People />, p: '/clients' },
              { l: t('orders'), i: <Receipt />, p: '/orders' },
              { l: t('schedule'), i: <CalendarMonth />, p: '/schedule' },
              { l: t('payments'), i: <PaymentIcon />, p: '/payments' },
              { l: t('reportDrafts'), i: <Description />, p: '/tools?tab=reports' },
            ].map((a) => (
              <Chip key={a.p} icon={a.i} label={a.l} onClick={() => navigate(a.p)}
                sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', backdropFilter: 'blur(8px)', height: 38, px: 0.5,
                  '& .MuiChip-icon': { color: '#fff' }, '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' } }} />
            ))}
          </Box>
        </CardContent>
      </Card>
      <Grid container spacing={3}>
        {stats.map((stat, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Card data-score-card="true" sx={raised3d(stat.color)}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: 2.5, mr: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background:'rgba(172,72,45,0.1)',
                    boxShadow:'none',
                  }}>
                    {React.cloneElement(stat.icon, { sx: { color: 'primary.main' } })}
                  </Box>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">{stat.title}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Card sx={raised3d('#2196F3')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Groups sx={{ color: '#2196F3' }} />
                <Typography variant="h6">{t('clientsVsDates')}</Typography>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={clientTrendData} style={{ filter: 'drop-shadow(0 10px 12px rgba(33,150,243,0.25))' }}>
                  <defs>
                    <linearGradient id="totalClientsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2196F3" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#2196F3" stopOpacity={0.08} />
                    </linearGradient>
                    <linearGradient id="newClientsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" name={t('activeClients')} dataKey="totalClients" stroke="#1565C0" strokeWidth={2} fill="url(#totalClientsFill)" />
                  <Area type="monotone" name={t('newClientsTrend')} dataKey="newClients" stroke="#2E7D32" strokeWidth={2} fill="url(#newClientsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={raised3d('#FF9800')}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('appointmentStatus')}</Typography>
              {appointmentStatusData.length === 0 ? (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">{t('noAppointmentsYet')}</Typography>
                </Box>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart style={{ filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.25))' }}>
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient id={`pieGrad${i}`} key={c} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie data={appointmentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={2}>
                    {appointmentStatusData.map((entry: any, index: number) => (
                      <Cell key={index} fill={`url(#pieGrad${index % COLORS.length})`} stroke={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12}>
          <Card sx={raised3d('#9C27B0')}>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('netProfitTrend')}</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={financialData?.daily_data ?? []} style={{ filter: 'drop-shadow(0 10px 10px rgba(156,39,176,0.2))' }}>
                  <defs>
                    <linearGradient id="netBarPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4CAF50" stopOpacity={1} />
                      <stop offset="100%" stopColor="#4CAF50" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="netBarNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F44336" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#F44336" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="net" name={t('netProfitTrend')} radius={[6, 6, 6, 6]}>
                    {(financialData?.daily_data ?? []).map((d: any, i: number) => (
                      <Cell key={i} fill={Number(d.net) >= 0 ? 'url(#netBarPos)' : 'url(#netBarNeg)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

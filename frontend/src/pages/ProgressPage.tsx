import React, { useMemo, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Chip, TextField, MenuItem, Collapse, Table, TableBody, TableRow, TableCell, Button } from '@mui/material';
import { ExpandMore, ExpandLess, TrendingUp, EventNote, EmojiEvents, AccountBalanceWallet, Groups, Percent, Timeline } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import apiClient from '../api/client';
import PageHeader from '../components/Common/PageHeader';

const STATUS_COLORS: Record<string, string> = {
  draft: '#9E9E9E', pending: '#FF9800', in_progress: '#2196F3',
  completed: '#4CAF50', delivered: '#00BCD4', closed: '#4CAF50', cancelled: '#F44336',
};

const raised3d = (accent: string) => ({
  position: 'relative' as const,
  borderRadius: 3,
  background: `linear-gradient(160deg, ${accent}14 0%, transparent 55%)`,
  boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 30px -14px ${accent}55, 0 4px 10px -4px rgba(0,0,0,0.2)`,
  border: `1px solid ${accent}30`,
});

// Enhanced "3D" gauge - three visually distinct layers instead of one:
// an outer conic-gradient progress ring, a middle glass disc with a
// diagonal glossy highlight, and the percentage text raised on top with
// its own soft text-shadow. A very slight resting tilt (perspective +
// rotateX) plus a bigger tilt on hover sells the depth further.
function ProgressGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <Box
      sx={{
        position: 'relative', width: 100, height: 100, flexShrink: 0,
        transform: 'perspective(600px) rotateX(4deg)',
        transition: 'transform .3s ease',
        '&:hover': { transform: 'perspective(600px) rotateX(0deg) scale(1.04)' },
      }}
    >
      <Box
        sx={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(0,0,0,0.08) ${pct * 3.6}deg)`,
          boxShadow: `0 14px 24px -10px ${color}88, inset 0 0 0 1px rgba(0,0,0,0.06)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '76%', height: '76%', borderRadius: '50%', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.95), rgba(255,255,255,0.55))',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* diagonal glass highlight streak */}
          <Box sx={{
            position: 'absolute', top: '-40%', left: '-20%', width: '60%', height: '180%',
            background: 'linear-gradient(120deg, rgba(255,255,255,0.7), rgba(255,255,255,0))',
            transform: 'rotate(20deg)',
          }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color, textShadow: '0 1px 0 rgba(255,255,255,0.6)', zIndex: 1 }}>
            {Math.round(pct)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// Small revenue-over-time sparkline per client - a compact way to show
// momentum (growing / flat / shrinking) that a single progress % can't
// convey on its own.
function RevenueSparkline({ orders, color }: { orders: any[]; color: string }) {
  const points = orders
    .slice()
    .sort((a, b) => (a.order_date || '').localeCompare(b.order_date || ''))
    .map((o, i) => ({ i, value: Number(o.total_amount) || 0 }));
  if (points.length < 2) return null;
  return (
    <Box sx={{ height: 36, mt: 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.6} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#spark-${color.replace('#', '')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

type SortKey = 'progress' | 'revenue' | 'name';

export default function ProgressPage() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('progress');

  const { data: clientsData } = useQuery({
    queryKey: ['clients-progress'],
    queryFn: () => apiClient.get('/accounts/clients/').then(res => res.data),
  });
  // FIX: the previous version read `client.orders` directly off each
  // client record to compute progress - but ClientSerializer never
  // includes a nested order list (reverse FK relations aren't part of a
  // ModelSerializer's `fields = '__all__'`), so `client.orders` was
  // always `undefined` and every client's progress silently showed 0%.
  // Orders are fetched separately here and grouped by client id instead.
  const { data: ordersData } = useQuery({
    queryKey: ['orders-progress'],
    queryFn: () => apiClient.get('/production/orders/').then(res => res.data),
  });

  const clients = clientsData?.results ?? [];
  const orders = ordersData?.results ?? [];

  const ordersByClient: Record<number, any[]> = {};
  orders.forEach((o: any) => {
    if (!ordersByClient[o.client]) ordersByClient[o.client] = [];
    ordersByClient[o.client].push(o);
  });

  // Precompute progress/metrics once per client so both the summary row
  // and the sort/filter logic below use one consistent source of truth.
  const enriched = useMemo(() => {
    return clients.map((client: any) => {
      const clientOrders = (ordersByClient[client.id] || []).slice().sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
      const totalOrders = clientOrders.length;
      const completedOrders = clientOrders.filter((o: any) => o.status === 'closed' || o.status === 'delivered' || o.status === 'completed').length;
      const progress = totalOrders ? (completedOrders / totalOrders) * 100 : 0;
      return { client, clientOrders, totalOrders, completedOrders, progress, revenue: Number(client.total_revenue ?? 0) };
    });
  }, [clients, orders]);

  const filtered = categoryFilter ? enriched.filter((e: any) => e.client.category === categoryFilter) : enriched;
  const sorted = filtered.slice().sort((a: any, b: any) => {
    if (sortKey === 'revenue') return b.revenue - a.revenue;
    if (sortKey === 'name') return a.client.name.localeCompare(b.client.name);
    return b.progress - a.progress;
  });

  // NEW: fleet-wide summary so you see the big picture before scanning
  // individual cards - average progress across active clients, total
  // revenue collected, total still outstanding, and who's #1.
  const withOrders = enriched.filter((e: any) => e.totalOrders > 0);
  const avgProgress = withOrders.length ? withOrders.reduce((s: number, e: any) => s + e.progress, 0) / withOrders.length : 0;
  const totalRevenue = enriched.reduce((s: number, e: any) => s + e.revenue, 0);
  const totalOutstanding = enriched.reduce((s: number, e: any) => s + Number(e.client.outstanding_balance ?? 0), 0);
  const topPerformerId = withOrders.length
    ? withOrders.slice().sort((a: any, b: any) => b.progress - a.progress || b.revenue - a.revenue)[0].client.id
    : null;

  const summaryCards = [
    { label: t('clientsTracked'), value: enriched.length.toLocaleString(), icon: <Groups />, color: '#2196F3' },
    { label: t('avgProgress'), value: `${Math.round(avgProgress)}%`, icon: <Percent />, color: '#4CAF50' },
    { label: t('totalRevenue'), value: totalRevenue.toLocaleString(), icon: <TrendingUp />, color: '#9C27B0' },
    { label: t('outstandingBalance'), value: totalOutstanding.toLocaleString(), icon: <AccountBalanceWallet />, color: totalOutstanding > 0 ? '#F44336' : '#4CAF50' },
  ];

  return (
    <Box>
      <PageHeader
        title={t('progress')}
        icon={<Timeline />}
        color="#00C896"
        action={
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label={t('sortBy')} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} sx={{ width: 170 }}>
              <MenuItem value="progress">{t('progress')}</MenuItem>
              <MenuItem value="revenue">{t('totalRevenue')}</MenuItem>
              <MenuItem value="name">{t('name')}</MenuItem>
            </TextField>
            <TextField select size="small" label={t('businessType')} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ width: 170 }}>
              <MenuItem value="">{t('all')}</MenuItem>
            <MenuItem value="academic">{t('academic')}</MenuItem>
            <MenuItem value="business">{t('business')}</MenuItem>
          </TextField>
          </Box>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card sx={raised3d(s.color)}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '16px !important' }}>
                <Box sx={{
                  width: 42, height: 42, borderRadius: 2, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(145deg, ${s.color}, ${s.color}99)`,
                  boxShadow: `0 6px 12px -4px ${s.color}88`,
                }}>
                  {React.cloneElement(s.icon, { sx: { color: '#fff', fontSize: 22 } })}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {sorted.map(({ client, clientOrders, totalOrders, completedOrders, progress }: any) => {
          const gaugeColor = progress >= 75 ? '#4CAF50' : progress >= 40 ? '#FF9800' : '#F44336';
          const isOpen = expanded === client.id;
          const isTop = client.id === topPerformerId;

          return (
            <Grid item xs={12} md={6} key={client.id}>
              <Card
                sx={{
                  ...raised3d(gaugeColor),
                  transition: 'transform .25s ease, box-shadow .25s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, 0 26px 40px -16px ${gaugeColor}66, 0 8px 16px -6px rgba(0,0,0,0.28)`,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <ProgressGauge value={progress} color={gaugeColor} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                          {isTop && (
                            <EmojiEvents fontSize="small" sx={{ color: '#F5A524', filter: 'drop-shadow(0 2px 3px rgba(245,165,36,0.5))' }} />
                          )}
                          <Typography variant="h6" noWrap>{client.name}</Typography>
                        </Box>
                        <Chip label={t(client.category || 'academic')} size="small" color={client.category === 'business' ? 'secondary' : 'primary'} variant="outlined" />
                      </Box>
                      <Typography variant="body2" color="text.secondary">{t(client.type)} · {client.primary_phone}</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{t('orders')}</Typography>
                          <Typography variant="subtitle2">{totalOrders}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{t('completed')}</Typography>
                          <Typography variant="subtitle2">{completedOrders}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{t('totalRevenue')}</Typography>
                          <Typography variant="subtitle2">{Number(client.total_revenue ?? 0).toLocaleString()}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{t('outstandingBalance')}</Typography>
                          <Typography variant="subtitle2" color={Number(client.outstanding_balance ?? 0) > 0 ? 'error.main' : 'text.primary'}>
                            {Number(client.outstanding_balance ?? 0).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                      <RevenueSparkline orders={clientOrders} color={gaugeColor} />
                    </Box>
                  </Box>

                  <Button
                    size="small"
                    startIcon={<EventNote fontSize="small" />}
                    endIcon={isOpen ? <ExpandLess /> : <ExpandMore />}
                    onClick={() => setExpanded(isOpen ? null : client.id)}
                    sx={{ mt: 1.5 }}
                    disabled={totalOrders === 0}
                  >
                    {t('orderHistory')} ({totalOrders})
                  </Button>
                  <Collapse in={isOpen}>
                    <Table size="small" sx={{ mt: 1 }}>
                      <TableBody>
                        {clientOrders.map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell sx={{ pl: 0 }}>{o.order_number}</TableCell>
                            <TableCell>{o.package_name}</TableCell>
                            <TableCell>{o.order_date}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={t(o.status)}
                                sx={{ bgcolor: `${STATUS_COLORS[o.status] || '#9E9E9E'}22`, color: STATUS_COLORS[o.status] || '#9E9E9E', fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ pr: 0 }}>{Number(o.total_amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        {sorted.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              <TrendingUp sx={{ fontSize: 40, opacity: 0.3, display: 'block', mx: 'auto', mb: 1 }} />
              {t('noData')}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

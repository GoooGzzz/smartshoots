import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, InputAdornment, Chip, Card, CardContent,
  Tabs, Tab, Grid, Button, MenuItem, Select, FormControl, InputLabel,
  Snackbar, Alert, Tooltip, IconButton, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Search, ContentCopy, School, Science, LocalHospital, MenuBook, AutoAwesome, CloudUpload, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import PageHeader from '../components/Common/PageHeader';
import ReportDraftCard, { ReportDraft } from '../components/Common/ReportDraftCard';
import ReportDraftUploadDialog from '../components/Common/ReportDraftUploadDialog';
import ReportDraftQrDialog from '../components/Common/ReportDraftQrDialog';
import ReportViewerDialog from '../components/Common/ReportViewerDialog';
import { subscribeBackendStatus } from '../api/connectionStatus';
import { saveReportOffline, listSavedReports, removeSavedReport, getSavedReportHtml } from '../utils/offlineReports';

// NEW: "Tools" page - a library of ready-to-use, copy-paste outreach
// scripts (cold outreach, follow-up, pricing, etc.) plus a service
// catalogue organized by academic/client category (Doctors, Teachers,
// Labs, ...), each showing what that category typically needs and which
// real packages fit them. Layout (search bar + filter pills + card
// grid + badges) follows the reference design provided for this feature.

const CATEGORY_COLORS: Record<string, string> = {
  cold_outreach: '#B5482A', follow_up: '#2196F3', quote_pricing: '#F5A524',
  objection_handling: '#EF4444', renewal: '#10B981', referral: '#00BCD4', social_caption: '#EC4899',
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  doctor: <LocalHospital fontSize="small" />, teacher: <School fontSize="small" />,
  professor: <MenuBook fontSize="small" />, lab: <Science fontSize="small" />,
};
const REPORT_CATEGORIES = ['medical', 'multi_category', 'business', 'education', 'custom'];

function substitute(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined && vars[key] !== '' ? vars[key] : match));
}

export default function ToolsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'reports' ? 2 : 0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reportCategoryFilter, setReportCategoryFilter] = useState('all');
  const [personalizeClient, setPersonalizeClient] = useState('');
  const [personalizePackage, setPersonalizePackage] = useState('');
  const [copiedMsg, setCopiedMsg] = useState('');
  const [uploadOpen, setUploadOpen] = useState(searchParams.get('upload') === '1');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'name'>('newest');
  const [offline, setOffline] = useState(false);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<{ title: string; html: string } | null>(null);
  const [qrDraft, setQrDraft] = useState<ReportDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportDraft | null>(null);

  const { data: scriptsData } = useQuery({ queryKey: ['toolkit-scripts'], queryFn: () => apiClient.get('/toolkit/scripts/').then(r => r.data) });
  const { data: profilesData } = useQuery({ queryKey: ['toolkit-profiles'], queryFn: () => apiClient.get('/toolkit/service-profiles/').then(r => r.data) });
  const { data: clientsData } = useQuery({ queryKey: ['clients-for-tools'], queryFn: () => apiClient.get('/accounts/clients/').then(r => r.data) });
  const { data: packagesData } = useQuery({ queryKey: ['packages-for-tools'], queryFn: () => apiClient.get('/production/packages/').then(r => r.data) });
  const { data: businessData } = useQuery({ queryKey: ['business-for-tools'], queryFn: () => apiClient.get('/finance/settings/').then(r => r.data) });
  const { data: reportDraftsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['toolkit-report-drafts'],
    queryFn: () => apiClient.get('/toolkit/report-drafts/').then(r => r.data),
    enabled: tab === 2,
  });

  const scripts = scriptsData?.results ?? [];
  const profiles = profilesData?.results ?? [];
  const clients = clientsData?.results ?? [];
  const packages = packagesData?.results ?? [];
  const business = businessData?.results?.[0];

  const selectedClient = clients.find((c: any) => c.id === personalizeClient);
  const selectedPackage = packages.find((p: any) => p.id === personalizePackage);

  // NEW (the "valuable idea" layered on top): fill placeholders from a
  // REAL selected client/package, so the copied draft is already
  // personalized instead of generic fill-in-the-blank text.
  const substitutionVars = useMemo(() => ({
    client_name: selectedClient?.name || '',
    package_name: selectedPackage?.name || '',
    price: selectedPackage ? String(selectedPackage.default_rate) : '',
    unit: selectedPackage?.unit || '',
    business_name: business?.name || '',
    business_name_tag: (business?.name || '').replace(/\s+/g, ''),
  }), [selectedClient, selectedPackage, business]);

  const handleCopy = async (body: string) => {
    const text = substitute(body, substitutionVars);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsg(t('copiedToClipboard'));
    } catch {
      setCopiedMsg(t('copyFailed'));
    }
  };

  const filteredScripts = scripts.filter((s: any) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (search && !`${s.title} ${s.body}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const filteredProfiles = profiles.filter((p: any) => {
    if (typeFilter !== 'all' && p.client_type !== typeFilter) return false;
    if (search && !`${p.title} ${p.typical_needs}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const scriptCategories = Array.from(new Set(scripts.map((s: any) => s.category)));
  const profileTypes = Array.from(new Set(profiles.map((p: any) => p.client_type)));

  useEffect(() => subscribeBackendStatus(setOffline), []);
  useEffect(() => { listSavedReports().then(setSavedSet); }, []);
  const reportDrafts: ReportDraft[] = reportDraftsData?.results ?? [];
  // NEW: quietly keep every HTML report saved for offline viewing while online.
  useEffect(() => {
    if (offline || !reportDraftsData?.results?.length) return;
    let cancelled = false;
    (async () => {
      for (const d of reportDraftsData.results as ReportDraft[]) await saveReportOffline(d as any);
      if (!cancelled) setSavedSet(await listSavedReports());
    })();
    return () => { cancelled = true; };
  }, [reportDraftsData, offline]);

  const openDraft = async (d: ReportDraft) => {
    if (offline || navigator.onLine === false) {
      const html = await getSavedReportHtml(d.public_view_url);
      if (html !== null) setViewer({ title: d.title, html });
      else setCopiedMsg(t('notSavedOffline'));
      return;
    }
    window.open(d.public_view_url, '_blank', 'noopener');
  };
  const filteredReportDrafts = reportDrafts.filter((d) => {
    if (reportCategoryFilter !== 'all' && d.category !== reportCategoryFilter) return false;
    if (search && !`${d.title} ${d.description || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => sortBy === 'views' ? b.view_count - a.view_count
    : sortBy === 'name' ? a.title.localeCompare(b.title)
    : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleDeleteReport = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/toolkit/report-drafts/${deleteTarget.id}/`);
      removeSavedReport(deleteTarget.public_view_url).then(() => listSavedReports().then(setSavedSet));
      queryClient.invalidateQueries({ queryKey: ['toolkit-report-drafts'] });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title={t('tools')} icon={<AutoAwesome />} color="#B5482A" subtitle={t('toolsHint')}
        action={tab === 2 ? (
          <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)}>
            {t('uploadReport')}
          </Button>
        ) : undefined}
      />

      {/* Personalize bar - applies to every script's Copy button below */}
      <Card sx={{ mb: 3, backgroundImage: 'linear-gradient(135deg, #B5482A11, transparent)' }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t('personalizeWith')}:</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('client')}</InputLabel>
            <Select value={personalizeClient} label={t('client')} onChange={(e) => setPersonalizeClient(e.target.value)}>
              <MenuItem value="">{t('none')}</MenuItem>
              {clients.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('package')}</InputLabel>
            <Select value={personalizePackage} label={t('package')} onChange={(e) => setPersonalizePackage(e.target.value)}>
              <MenuItem value="">{t('none')}</MenuItem>
              {packages.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <TextField
        fullWidth placeholder={t('searchToolsPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('scriptsAndTemplates')} />
        <Tab label={t('serviceCatalogue')} />
        <Tab label={t('reportDrafts')} />
      </Tabs>

      {tab === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            <Chip label={t('all')} onClick={() => setCategoryFilter('all')} color={categoryFilter === 'all' ? 'primary' : 'default'} />
            {scriptCategories.map((cat: any) => (
              <Chip key={cat} label={t(cat)} onClick={() => setCategoryFilter(cat)} sx={categoryFilter === cat ? { bgcolor: CATEGORY_COLORS[cat], color: '#fff' } : {}} />
            ))}
          </Box>
          <Grid container spacing={2}>
            {filteredScripts.map((script: any) => (
              <Grid item xs={12} md={6} lg={4} key={script.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Chip
                      label={t(script.category)} size="small"
                      sx={{ alignSelf: 'flex-start', mb: 1.5, bgcolor: `${CATEGORY_COLORS[script.category]}22`, color: CATEGORY_COLORS[script.category], fontWeight: 700 }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{script.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', flex: 1, mb: 2 }}>
                      {substitute(script.body, substitutionVars)}
                    </Typography>
                    <Button startIcon={<ContentCopy />} variant="outlined" onClick={() => handleCopy(script.body)} sx={{ alignSelf: 'flex-start' }}>
                      {t('copy')}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {filteredScripts.length === 0 && (
              <Grid item xs={12}><Typography color="text.secondary">{t('noResults')}</Typography></Grid>
            )}
          </Grid>
        </>
      )}

      {tab === 1 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            <Chip label={t('all')} onClick={() => setTypeFilter('all')} color={typeFilter === 'all' ? 'primary' : 'default'} />
            {profileTypes.map((pt: any) => (
              <Chip key={pt} icon={TYPE_ICONS[pt] as any} label={t(pt)} onClick={() => setTypeFilter(pt)} color={typeFilter === pt ? 'primary' : 'default'} />
            ))}
          </Box>
          <Grid container spacing={2}>
            {filteredProfiles.map((profile: any) => (
              <Grid item xs={12} md={6} key={profile.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {TYPE_ICONS[profile.client_type]}
                      <Chip label={t(profile.client_type)} size="small" color="primary" variant="outlined" />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{profile.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{profile.typical_needs}</Typography>

                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{t('recommendedServices')}</Typography>
                    <Box component="ul" sx={{ m: '4px 0 12px', pl: 2.5 }}>
                      {profile.recommended_packages_detail?.map((pkg: any) => (
                        <li key={pkg.id}>
                          <Typography variant="body2">{pkg.name} — {Number(pkg.default_rate).toLocaleString()} {business?.currency || ''} / {pkg.unit}</Typography>
                        </li>
                      ))}
                    </Box>

                    {profile.suggested_script_detail && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary">{t('suggestedScript')}: {profile.suggested_script_detail.title}</Typography>
                        <Tooltip title={t('copy')}>
                          <IconButton size="small" onClick={() => handleCopy(profile.suggested_script_detail.body)}><ContentCopy fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {filteredProfiles.length === 0 && (
              <Grid item xs={12}><Typography color="text.secondary">{t('noResults')}</Typography></Grid>
            )}
          </Grid>
        </>
      )}

      {tab === 2 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3, alignItems: 'center' }}>
            <Chip label={t('allCategories')} onClick={() => setReportCategoryFilter('all')} color={reportCategoryFilter === 'all' ? 'primary' : 'default'} />
            {REPORT_CATEGORIES.map((cat) => (
              <Chip key={cat} label={t(`category_${cat}`)} onClick={() => setReportCategoryFilter(cat)} color={reportCategoryFilter === cat ? 'primary' : 'default'} />
            ))}
            <FormControl size="small" sx={{ ml: 'auto', minWidth: 140 }}>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <MenuItem value="newest">{t('sortNewest')}</MenuItem>
                <MenuItem value="views">{t('sortMostViewed')}</MenuItem>
                <MenuItem value="name">{t('sortName')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Grid container spacing={2.5}>
            {reportsLoading && [0, 1, 2, 3].map((i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={`sk${i}`}>
                <Card><Skeleton variant="rectangular" height={190} animation="wave" /><Box sx={{ p: 2 }}><Skeleton width="70%" /><Skeleton width="40%" /></Box></Card>
              </Grid>
            ))}
            {filteredReportDrafts.map((draft) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={draft.id}>
                <ReportDraftCard draft={draft} onShowQr={setQrDraft} onDelete={setDeleteTarget} onOpen={openDraft} savedOffline={savedSet.has(draft.public_view_url)} offline={offline} />
              </Grid>
            ))}
            {filteredReportDrafts.length === 0 && !reportsLoading && (
              <Grid item xs={12}>
                <Card sx={{ p: 4, textAlign: 'center' }}>
                  <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography color="text.secondary">{t('noReportDrafts')}</Typography>
                </Card>
              </Grid>
            )}
          </Grid>
        </>
      )}

      <ReportDraftUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(queuedOffline) => {
          queryClient.invalidateQueries({ queryKey: ['toolkit-report-drafts'] });
          // NEW: be honest about which of these actually happened - a
          // report queued offline isn't live/shareable/QR-able yet,
          // that only happens once it syncs after reconnecting.
          setCopiedMsg(queuedOffline ? t('uploadQueuedOffline') : t('uploadSuccess'));
        }}
      />
      <ReportDraftQrDialog draft={qrDraft} onClose={() => setQrDraft(null)} />
      <ReportViewerDialog title={viewer?.title ?? ''} html={viewer ? viewer.html : null} onClose={() => setViewer(null)} />
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('deleteReport')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">{t('deleteReportConfirm')}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>{t('cancel')}</Button>
          <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteReport}>
            {t('deleteReport')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!copiedMsg} autoHideDuration={2500} onClose={() => setCopiedMsg('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setCopiedMsg('')} sx={{ width: '100%' }}>{copiedMsg}</Alert>
      </Snackbar>
    </Box>
  );
}

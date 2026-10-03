import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  SelectChangeEvent, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { CloudDownload, CloudUpload, WarningAmber, QrCodeScanner, PhoneIphone, Settings as SettingsIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { getServerUrl, setServerUrl as setServerUrlStorage } from '../api/serverConfig';
import { nameFilter, validateName, digitsOnlyFilter, validatePhone } from '../utils/validators';
import ServerQRCode from '../components/Common/ServerQRCode';
import ScanServerQRDialog from '../components/Common/ScanServerQRDialog';
import PageHeader from '../components/Common/PageHeader';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { darkMode, toggleDarkMode } = useThemeMode();
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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string | null; phone?: string | null }>({});
  const [serverUrl, setServerUrl] = useState(getServerUrl());
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<File | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const { logout } = useAuth();
  const navigate = useNavigate();

  // NEW: only present when this page is running inside the Electron
  // desktop app (see desktop-app/preload.js) - lets the Windows app
  // itself optionally become a thin client pointed at a cloud server
  // (DEPLOY.md), sharing one real database with the Android app instead
  // of each keeping separate local data. Absent entirely in a plain
  // browser or the Android build, where this concept doesn't apply the
  // same way (Android always needs a Server Address; Electron normally
  // runs its own backend and doesn't).
  const desktopBridge = (window as any).smartshootsDesktop;
  const [desktopMode, setDesktopMode] = useState<'local' | 'remote'>('local');
  const [desktopRemoteUrl, setDesktopRemoteUrl] = useState('');
  const [desktopSaving, setDesktopSaving] = useState(false);
  const [desktopError, setDesktopError] = useState<string | null>(null);

  useEffect(() => {
    if (desktopBridge) {
      desktopBridge.getConnectionConfig().then((cfg: { mode: 'local' | 'remote'; remoteUrl: string }) => {
        setDesktopMode(cfg.mode);
        setDesktopRemoteUrl(cfg.remoteUrl || '');
      });
      // NEW: powers the "scan to connect your phone" QR code below -
      // only meaningful in local mode (a remote/cloud server already has
      // its own real address the phone should use instead).
      desktopBridge.getLanAddress().then((info: { address: string; port: number } | null) => {
        if (info) setLanAddress(`http://${info.address}:${info.port}`);
      });
    }
  }, []);

  const [lanAddress, setLanAddress] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

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

  const showError = (err: any, fallback: string) => {
    const message = err?.response?.data ? JSON.stringify(err.response.data) : fallback;
    setSnackbar({ open: true, message, severity: 'error' });
  };

  // FIX: backupMutation uses responseType: 'blob' (needed so the browser
  // can turn a successful response into a downloadable file). But that
  // means a FAILED response also arrives as a Blob, not parsed JSON -
  // `JSON.stringify(blob)` on a Blob object serializes to the literal
  // text "{}" (a Blob has no enumerable own properties), which is
  // exactly the meaningless "{}"-looking error text reported from the
  // Backup button. This reads the blob's actual text content first (it's
  // really a JSON or HTML error body) and falls back sensibly if it
  // can't be parsed as JSON.
  const showBlobError = async (err: any, fallback: string) => {
    const blob: Blob | undefined = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        try {
          const parsed = JSON.parse(text);
          setSnackbar({ open: true, message: parsed?.error || parsed?.detail || text || fallback, severity: 'error' });
        } catch {
          setSnackbar({ open: true, message: text?.slice(0, 300) || fallback, severity: 'error' });
        }
        return;
      } catch {
        // fall through to generic fallback below
      }
    }
    setSnackbar({ open: true, message: fallback, severity: 'error' });
  };

  const updateMutation = useMutation({
    mutationFn: (updated: any) => apiClient.put(`/finance/settings/${updated.id}/`, updated),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['business-settings'] }); setSnackbar({ open: true, message: t('saved'), severity: 'success' }); },
    onError: (err) => showError(err, t('saveFailed')),
  });

  const createMutation = useMutation({
    mutationFn: (newSettings: any) => apiClient.post('/finance/settings/', newSettings),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['business-settings'] }); setSnackbar({ open: true, message: t('saved'), severity: 'success' }); },
    onError: (err) => showError(err, t('saveFailed')),
  });

  // FIX: backup previously had no onError handler at all - if it failed
  // (as it did before the UTF-8 encoding bug was fixed server-side), the
  // button just did nothing with zero feedback, indistinguishable from
  // "still working on it". Now both outcomes are always visible.
  const backupMutation = useMutation({
    mutationFn: () => apiClient.get('/finance/backup/', { responseType: 'blob' }),
    onSuccess: (response) => {
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.setAttribute('download', `smart_shoots_backup_${stamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: t('backupSuccess'), severity: 'success' });
    },
    onError: (err) => showBlobError(err, t('backupFailed')),
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/finance/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: t('restoreSuccess'), severity: 'success' });
      // Restored data affects nearly every screen - refresh everything
      // cached by react-query instead of leaving stale data on screen.
      queryClient.invalidateQueries();
    },
    onError: (err) => showError(err, t('restoreFailed')),
  });

  const handleSave = () => {
    const nameError = validateName(settings.name) || (!settings.name ? t('required') : null);
    const phoneError = validatePhone(settings.phone); // phone is optional here, so only checked if non-empty
    if (nameError || phoneError) {
      setFieldErrors({ name: nameError, phone: phoneError });
      return;
    }
    if (data?.results?.length > 0) {
      const current = data.results[0];
      updateMutation.mutate({ ...settings, id: current.id });
    } else {
      createMutation.mutate(settings);
    }
  };

  const handleLanguageChange = (e: SelectChangeEvent<string>) => {
    const newLang = e.target.value;
    setSettings({ ...settings, language: newLang });
    i18n.changeLanguage(newLang);
  };

  const handleThemeChange = () => {
    setSettings({ ...settings, theme: darkMode ? 'light' : 'dark' });
    toggleDarkMode();
  };

  // FIX: restoring overwrites/merges live business data - there was no
  // confirmation step at all before, a single accidental file pick could
  // clobber current records. Now it requires an explicit confirm.
  const handleRestoreFileSelected = (file: File | null) => {
    if (file) setRestoreConfirmFile(file);
  };

  const confirmRestore = () => {
    if (restoreConfirmFile) restoreMutation.mutate(restoreConfirmFile);
    setRestoreConfirmFile(null);
  };

  if (isLoading && !data) return <Typography>{t('loading')}</Typography>;

  return (
    <Box>
      <PageHeader title={t('settings')} icon={<SettingsIcon />} color="#607D8B" />
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth label={t('businessName')} value={settings.name}
                onChange={(e) => { const v = nameFilter(e.target.value); setSettings({ ...settings, name: v }); setFieldErrors({ ...fieldErrors, name: validateName(v) }); }}
                error={!!fieldErrors.name} helperText={fieldErrors.name || ' '}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('currency')} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('timezone')} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('language')}</InputLabel>
                <Select value={settings.language} label={t('language')} onChange={handleLanguageChange}>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="ar">العربية</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={<Switch checked={darkMode} onChange={handleThemeChange} />}
                label={darkMode ? t('darkMode') : t('lightMode')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('address')} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth label={t('phone')} value={settings.phone}
                onChange={(e) => { const v = digitsOnlyFilter(e.target.value).slice(0, 11); setSettings({ ...settings, phone: v }); setFieldErrors({ ...fieldErrors, phone: validatePhone(v) }); }}
                error={!!fieldErrors.phone} helperText={fieldErrors.phone || 'e.g. 01012345678'}
                inputProps={{ inputMode: 'numeric', maxLength: 11 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('email')} value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('website')} value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label={t('taxNumber')} value={settings.tax_number} onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })} />
            </Grid>
          </Grid>
          <Button
            variant="contained" onClick={handleSave} sx={{ mt: 3 }}
            disabled={updateMutation.isPending || createMutation.isPending}
            startIcon={(updateMutation.isPending || createMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('save')}
          </Button>
        </CardContent>
      </Card>

      {desktopBridge ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{t('desktopConnection')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('desktopConnectionHelp')}
            </Typography>
            <TextField
              select size="small" sx={{ minWidth: 220, mb: 2 }}
              value={desktopMode}
              onChange={(e) => setDesktopMode(e.target.value as 'local' | 'remote')}
            >
              <MenuItem value="local">{t('thisComputer')}</MenuItem>
              <MenuItem value="remote">{t('remoteServer')}</MenuItem>
            </TextField>
            {desktopMode === 'remote' && (
              <TextField
                fullWidth size="small" sx={{ mb: 2 }}
                placeholder="https://smartshoots.yourdomain.com"
                value={desktopRemoteUrl}
                onChange={(e) => setDesktopRemoteUrl(e.target.value)}
              />
            )}
            {desktopError && <Typography variant="body2" color="error" sx={{ mb: 2 }}>{desktopError}</Typography>}
            <Box>
              <Button
                variant="outlined"
                disabled={desktopSaving}
                onClick={async () => {
                  setDesktopSaving(true);
                  setDesktopError(null);
                  const result = await desktopBridge.setConnectionConfig({ mode: desktopMode, remoteUrl: desktopRemoteUrl });
                  // On success the whole app relaunches from main.js, so
                  // there's nothing more to do here - only a failure
                  // (unreachable address) actually returns control to us.
                  if (!result.ok) {
                    setDesktopError(result.error);
                    setDesktopSaving(false);
                  }
                }}
              >
                {desktopSaving ? t('checking') : t('applyAndRestart')}
              </Button>
            </Box>

            {desktopMode === 'local' && lanAddress && (
              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PhoneIphone fontSize="small" /> {t('connectYourPhone')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('connectYourPhoneHelp')}
                </Typography>
                <ServerQRCode value={lanAddress} />
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{t('serverAddress')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('serverAddressHelp')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                size="small" sx={{ minWidth: 280 }}
                placeholder="http://192.168.1.20:8000"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setServerUrlStorage(serverUrl);
                  // The old auth token (if any) was just cleared because
                  // it belongs to whichever server was previously
                  // configured - send the person to log in fresh against
                  // the new one rather than leaving them on a page that
                  // will just 401 on every request.
                  logout();
                  navigate('/login');
                }}
              >
                {t('save')}
              </Button>
              <Button
                variant="text"
                startIcon={<QrCodeScanner />}
                onClick={() => setScannerOpen(true)}
              >
                {t('scanQr')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('backupRestore')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('backupRestoreHint')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined" onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              startIcon={backupMutation.isPending ? <CircularProgress size={16} /> : <CloudDownload />}
            >
              {t('backup')}
            </Button>
            <Button
              variant="outlined" component="label" color="warning" disabled={restoreMutation.isPending}
              startIcon={restoreMutation.isPending ? <CircularProgress size={16} /> : <CloudUpload />}
            >
              {t('restore')}
              <input
                type="file" hidden accept=".json"
                onChange={(e) => {
                  handleRestoreFileSelected(e.target.files?.[0] ?? null);
                  e.target.value = ''; // FIX: without this, re-selecting the same file did nothing (no change event)
                }}
              />
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={!!restoreConfirmFile} onClose={() => setRestoreConfirmFile(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber color="warning" /> {t('confirmRestoreTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('confirmRestoreBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreConfirmFile(null)}>{t('cancel')}</Button>
          <Button onClick={confirmRestore} color="warning" variant="contained">{t('confirmRestoreAction')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ScanServerQRDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={(text) => {
          setScannerOpen(false);
          setServerUrl(text);
          setServerUrlStorage(text);
          logout();
          navigate('/login');
        }}
      />
    </Box>
  );
}

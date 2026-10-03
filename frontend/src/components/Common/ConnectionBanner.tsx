import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { subscribeBackendStatus } from '../../api/connectionStatus';
import { onQueueChange } from '../../api/offlineQueue';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../../queryClient';

export default function ConnectionBanner() {
  const { t } = useTranslation();
  const [unreachable, setUnreachable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [queueLen, setQueueLen] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const wasUnreachable = useRef(false);

  useEffect(() => subscribeBackendStatus((isUnreachable) => {
    setUnreachable(isUnreachable);
    // FIX (the "vice versa" direction): invalidateQueries() previously
    // only ran when the offline queue drained from >0 back to 0 - so if
    // the PC made changes (a new order, a payment, anything) while this
    // device was simply offline with nothing of ITS OWN queued, nothing
    // ever told the UI to refetch. It would keep showing stale cached
    // data indefinitely, with no visible sign anything was wrong. Now
    // any transition from unreachable -> reachable refetches everything,
    // regardless of whether this device had pending writes of its own.
    if (wasUnreachable.current && !isUnreachable) {
      queryClient.invalidateQueries();
      setJustSynced(true);
    }
    wasUnreachable.current = isUnreachable;
  }), []);
  useEffect(() => onQueueChange((n) => {
    setQueueLen((prev) => {
      if (prev > 0 && n === 0) {
        setJustSynced(true);
        // Complementary to the reconnect-triggered invalidation above,
        // not redundant with it: that one fires the moment connectivity
        // returns, which can be slightly BEFORE this device's own queued
        // writes have actually finished replaying. This one guarantees a
        // second refetch specifically after they've landed, so the UI
        // ends up showing real server-assigned records, not the
        // temporary offline placeholders, even if the two fire close
        // together.
        queryClient.invalidateQueries();
      }
      return n;
    });
  }), []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await apiClient.get('/accounts/clients/?page_size=1');
    } catch {
      // response interceptor keeps the banner showing if still down
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      {(unreachable || queueLen > 0) && (
        <Box
          className="ss-pill-in"
          sx={{
            position: 'fixed', top: { xs: 62, sm: 72 }, left: '50%', transform: 'translateX(-50%)', zIndex: 1250,
            maxWidth: 'calc(100% - 24px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap',
            bgcolor: unreachable ? 'rgba(185,28,28,0.94)' : 'rgba(180,83,9,0.94)', color: '#fff', py: 0.75, px: 2, borderRadius: 999,
            backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px -8px rgba(0,0,0,0.5)',
          }}
        >
          {unreachable ? <WifiOffIcon fontSize="small" /> : <CloudQueueIcon fontSize="small" />}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {unreachable
              ? t('backendUnreachable') + (queueLen > 0 ? ` (${queueLen} ${t('pendingSync')})` : '')
              : `${queueLen} ${t('pendingSync')}`}
          </Typography>
          {unreachable && (
            <Button
              size="small" variant="outlined" onClick={handleRetry} disabled={retrying}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#fff' } }}
            >
              {retrying ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : t('retry')}
            </Button>
          )}
        </Box>
      )}
      <Snackbar
        open={justSynced}
        autoHideDuration={4000}
        onClose={() => setJustSynced(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setJustSynced(false)}>{t('syncComplete')}</Alert>
      </Snackbar>
    </>
  );
}

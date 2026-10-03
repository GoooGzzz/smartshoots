import React, { useEffect, useState } from 'react';
import { Chip } from '@mui/material';
import { CloudDone, CloudOff, CloudSync } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { subscribeBackendStatus } from '../../api/connectionStatus';
import { onQueueChange, getCachedGet } from '../../api/offlineQueue';
import { onFileQueueChange } from '../../api/offlineFileQueue';

// NEW: honest at-a-glance state - online/offline, how old the data on
// screen is (taken from the last REAL successful fetch, not "now"), and
// how many offline changes are waiting to sync (JSON edits AND queued
// file uploads combined - see offlineFileQueue.ts).
export default function SyncStatusChip({ probeUrl = '/reports/dashboard/' }: { probeUrl?: string }) {
  const { t, i18n } = useTranslation();
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [queuedFiles, setQueuedFiles] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => subscribeBackendStatus(setOffline), []);
  useEffect(() => onQueueChange(setQueued), []);
  useEffect(() => onFileQueueChange(setQueuedFiles), []);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, []);

  const totalQueued = queued + queuedFiles;
  const at = getCachedGet(probeUrl)?.cachedAt;
  const ago = at ? formatDistanceToNow(at, { addSuffix: true, locale: i18n.language === 'ar' ? ar : undefined }) : null;
  const label = offline
    ? `${t('offlineMode')}${ago ? ` \u00B7 ${ago}` : ''}`
    : totalQueued > 0 ? `${totalQueued} ${t('pendingSync')}` : `${t('online')}${ago ? ` \u00B7 ${ago}` : ''}`;
  return (
    <Chip
      size="small" label={label}
      icon={offline ? <CloudOff /> : totalQueued > 0 ? <CloudSync /> : <CloudDone />}
      sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(6px)', fontWeight: 600, '& .MuiChip-icon': { color: offline ? '#FFB4B4' : '#9CF0C8' } }}
    />
  );
}

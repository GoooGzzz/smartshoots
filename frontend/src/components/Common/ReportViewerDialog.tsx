import React from 'react';
import { Dialog, Box, IconButton, Typography } from '@mui/material';
import { Close, CloudOff } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// NEW: in-app, full-screen report viewer used when the report has to be
// shown from the offline copy (no server reachable).
export default function ReportViewerDialog({ title, html, onClose }: { title: string; html: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog fullScreen open={html !== null} onClose={onClose}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, pt: 'calc(8px + env(safe-area-inset-top, 0px))', background: 'linear-gradient(90deg,#1E1712,#B5482A)', color: '#fff' }}>
        <IconButton color="inherit" onClick={onClose}><Close /></IconButton>
        <Typography sx={{ fontWeight: 700, flex: 1 }} noWrap>{title}</Typography>
        <CloudOff fontSize="small" sx={{ opacity: 0.8 }} />
        <Typography variant="caption" sx={{ opacity: 0.85 }}>{t('offlineCopy')}</Typography>
      </Box>
      {html !== null && <iframe title={title} srcDoc={html} sandbox="allow-scripts" style={{ flex: 1, border: 0, width: '100%', background: '#fff' }} />}
    </Dialog>
  );
}

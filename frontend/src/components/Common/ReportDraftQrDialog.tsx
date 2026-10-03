import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Snackbar, Alert } from '@mui/material';
import { ContentCopy, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ServerQRCode from './ServerQRCode';
import type { ReportDraft } from './ReportDraftCard';

interface Props {
  draft: ReportDraft | null;
  onClose: () => void;
}

export default function ReportDraftQrDialog({ draft, onClose }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.public_view_url);
      setCopied(true);
    } catch {
      /* clipboard unavailable - link is still shown/selectable below */
    }
  };

  return (
    <>
      <Dialog open={!!draft} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('qrDialogTitle')}
          <Close sx={{ cursor: 'pointer' }} onClick={onClose} />
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('qrDialogHint')}</Typography>
          {draft && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ServerQRCode value={draft.public_view_url} size={220} />
            </Box>
          )}
          {draft && (
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{draft.title}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button variant="contained" startIcon={<ContentCopy />} onClick={handleCopy}>{t('copyLink')}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={copied} autoHideDuration={2200} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setCopied(false)}>{t('linkCopied')}</Alert>
      </Snackbar>
    </>
  );
}

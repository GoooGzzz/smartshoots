import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Typography, LinearProgress,
} from '@mui/material';
import { CloudUpload, InsertDriveFile, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

const ACCEPTED = ['.html', '.htm', '.doc', '.docx'];
const CATEGORIES = ['medical', 'multi_category', 'business', 'education', 'custom'];

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: (queuedOffline?: boolean) => void;
}

export default function ReportDraftUploadDialog({ open, onClose, onUploaded }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null); setTitle(''); setDescription(''); setCategory('custom'); setError('');
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(t('uploadFailed'));
      return;
    }
    setError('');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file || !title) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    try {
      // FIX: axios/the browser must generate this header ITSELF for a
      // FormData body - it has to append a `boundary=...` parameter that
      // matches the actual delimiters written into the request body.
      // Setting 'multipart/form-data' by hand (no boundary) stops that
      // from happening, so the server receives a body it cannot parse at
      // all - every upload failed with "Invalid boundary in multipart:
      // None" (proven against the real backend), regardless of the file.
      const res = await apiClient.post('/toolkit/report-drafts/', formData);
      // NEW: offline, this now resolves as a queued-for-later save
      // (status 202, see api/client.ts + offlineFileQueue.ts) rather
      // than throwing - tell the person which one actually happened
      // instead of claiming a plain "uploaded" that isn't true yet.
      onUploaded(!!(res.data && (res.data as any)._queuedFile));
      reset();
      onClose();
    } catch (e: any) {
      if (e?.offlineUploadUnsupported) {
        setError(t('uploadNeedsConnection'));
      } else {
        // FIX: surface the server's actual reason (e.g. "file: Only
        // .html, .doc or .docx files can be uploaded here.") instead of
        // a generic message that hides what actually went wrong -
        // that's what turned this bug into several rounds of "still
        // failed" with no detail to act on.
        const data = e?.response?.data;
        let detail = '';
        if (typeof data === 'string') detail = data;
        else if (data?.detail) detail = data.detail;
        else if (data && typeof data === 'object') {
          detail = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ');
        }
        setError(detail ? `${t('uploadFailed')} (${detail})` : t('uploadFailed'));
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => { if (!uploading) { reset(); onClose(); } }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('uploadReportTitle')}
        <Close sx={{ cursor: 'pointer' }} onClick={() => { if (!uploading) { reset(); onClose(); } }} />
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('uploadReportHint')}</Typography>

        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] || null); }}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: '2px dashed', borderColor: dragOver ? 'primary.main' : 'divider',
            borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
            bgcolor: dragOver ? 'action.hover' : 'transparent', transition: 'all .2s ease',
            mb: 2,
          }}
        >
          <input
            ref={inputRef} type="file" hidden accept={ACCEPTED.join(',')}
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <InsertDriveFile color="primary" />
              <Typography sx={{ fontWeight: 600 }}>{file.name}</Typography>
            </Box>
          ) : (
            <>
              <CloudUpload sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">{t('dropFileHere')}</Typography>
            </>
          )}
        </Box>

        <TextField
          fullWidth label={t('reportTitleField')} value={title}
          onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }}
        />
        <TextField
          fullWidth select label={t('reportCategoryField')} value={category}
          onChange={(e) => setCategory(e.target.value)} sx={{ mb: 2 }}
        >
          {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{t(`category_${c}`)}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth multiline minRows={2} label={t('reportDescriptionField')} value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>{error}</Typography>}
        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => { reset(); onClose(); }} disabled={uploading}>{t('cancel')}</Button>
        <Button variant="contained" onClick={handleUpload} disabled={!file || !title || uploading}>
          {uploading ? t('uploading') : t('uploadReport')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

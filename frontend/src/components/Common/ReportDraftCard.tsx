import React, { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Chip, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  OpenInNew, QrCode2, Download, MoreVert, Delete, Description, Language, Visibility, CloudDone,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getSavedReportHtml } from '../../utils/offlineReports';

// NEW: "Report Drafts" gallery card. The centerpiece is a REAL live
// preview of the uploaded report - not a generic file icon - by loading
// the actual file in a scaled-down, non-interactive iframe. This is
// what makes the gallery feel like a design portfolio (Figma/Notion
// style) instead of a plain file list, and it works for any HTML
// report a user uploads, not just the two reference reports.

const CATEGORY_THEME: Record<string, { gradient: string; accent: string; label: string }> = {
  medical: { gradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)', accent: '#0d9488', label: 'category_medical' },
  multi_category: { gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%)', accent: '#0ea5e9', label: 'category_multi_category' },
  business: { gradient: 'linear-gradient(135deg, #78350f 0%, #F5A524 100%)', accent: '#F5A524', label: 'category_business' },
  education: { gradient: 'linear-gradient(135deg, #312e81 0%, #B5482A 100%)', accent: '#B5482A', label: 'category_education' },
  custom: { gradient: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)', accent: '#64748B', label: 'category_custom' },
};

export interface ReportDraft {
  id: string | number;
  title: string;
  description?: string;
  category: string;
  file_type: 'html' | 'doc' | 'docx';
  file_url: string;
  public_view_url: string;
  view_count: number;
  created_at: string;
  updated_at?: string;
  token?: string;
}

interface Props {
  draft: ReportDraft;
  onShowQr: (draft: ReportDraft) => void;
  onDelete: (draft: ReportDraft) => void;
  onOpen: (draft: ReportDraft) => void;
  savedOffline?: boolean;
  offline?: boolean;
}

export default function ReportDraftCard({ draft, onShowQr, onDelete, onOpen, savedOffline, offline }: Props) {
  const { t } = useTranslation();
  const theme = CATEGORY_THEME[draft.category] || CATEGORY_THEME.custom;
  const isHtml = draft.file_type === 'html';
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [offlineHtml, setOfflineHtml] = useState<string | null>(null);
  // Offline: build the live preview from the saved copy instead of the server.
  useEffect(() => {
    if (offline && isHtml) getSavedReportHtml(draft.public_view_url).then(setOfflineHtml).catch(() => setOfflineHtml(null));
    else setOfflineHtml(null);
  }, [offline, isHtml, draft.public_view_url]);

  return (
    <Card
      sx={{
        overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%',
        transition: 'transform .25s ease, box-shadow .25s ease',
        '&:hover': { transform: 'translateY(-6px)' },
      }}
    >
      {/* Live preview / hero area */}
      <Box
        sx={{
          position: 'relative', height: 190, background: theme.gradient,
          overflow: 'hidden', cursor: 'pointer',
        }}
        onClick={() => onOpen(draft)}
      >
        {isHtml ? (
          <Box
            sx={{
              position: 'absolute', top: 0, left: 0,
              width: '400%', height: '400%',
              transform: 'scale(0.25)', transformOrigin: 'top left',
              pointerEvents: 'none', background: '#fff',
              opacity: previewLoaded ? 1 : 0, transition: 'opacity .4s ease',
            }}
          >
            <iframe
              title={draft.title}
              {...(offline ? (offlineHtml ? { srcDoc: offlineHtml } : {}) : { src: `${draft.public_view_url}?preview=1` })}
              onLoad={() => setPreviewLoaded(true)}
              style={{ width: '100%', height: '100%', border: 0 }}
              sandbox="allow-scripts"
            />
          </Box>
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Description sx={{ fontSize: 64, color: 'rgba(255,255,255,0.9)' }} />
          </Box>
        )}
        {!previewLoaded && isHtml && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Language sx={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%)',
            display: 'flex', alignItems: 'flex-end', p: 1.5,
          }}
        >
          <Chip
            size="small" icon={isHtml ? <Language sx={{ fontSize: 14 }} /> : <Description sx={{ fontSize: 14 }} />}
            label={isHtml ? t('htmlReport') : t('wordReport')}
            sx={{ bgcolor: 'rgba(255,255,255,0.92)', fontWeight: 700 }}
          />
        </Box>
        <Box
          sx={{
            position: 'absolute', top: 10, insetInlineEnd: 10, width: 34, height: 34, borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <OpenInNew sx={{ fontSize: 18, color: theme.accent }} />
        </Box>
      </Box>

      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap title={draft.title}>
              {draft.title}
            </Typography>
            <Chip
              size="small" label={t(theme.label)}
              sx={{ mt: 0.5, bgcolor: `${theme.accent}22`, color: theme.accent, fontWeight: 700, height: 20, fontSize: 11 }}
            />
          </Box>
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>

        {draft.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, flex: 1 }}>
            {draft.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, color: 'text.secondary' }}>
          {savedOffline && (
            <Tooltip title={t('savedOffline')}><CloudDone sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} /></Tooltip>
          )}
          <Visibility sx={{ fontSize: 15 }} />
          <Typography variant="caption">{draft.view_count} {t('views')}</Typography>
          <Typography variant="caption" sx={{ ml: 'auto' }}>
            {new Date(draft.created_at).toLocaleDateString()}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          <Tooltip title={t('viewFullScreen')}>
            <IconButton
              size="small" sx={{ bgcolor: `${theme.accent}18`, color: theme.accent, '&:hover': { bgcolor: `${theme.accent}30` } }}
              onClick={() => onOpen(draft)}
            >
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('shareQr')}>
            <IconButton
              size="small" sx={{ bgcolor: `${theme.accent}18`, color: theme.accent, '&:hover': { bgcolor: `${theme.accent}30` } }}
              onClick={() => onShowQr(draft)}
            >
              <QrCode2 fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('download')}>
            <IconButton
              size="small" sx={{ bgcolor: `${theme.accent}18`, color: theme.accent, '&:hover': { bgcolor: `${theme.accent}30` } }}
              component="a" href={isHtml ? `${draft.public_view_url}?download=1` : draft.file_url} download
            >
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => { setMenuAnchor(null); onDelete(draft); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{t('deleteReport')}</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
}

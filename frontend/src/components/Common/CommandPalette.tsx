import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Box, Typography } from '@mui/material';
import { Search, Dashboard, People, Receipt, CalendarMonth, Payment, MoneyOff, Assessment, AutoAwesome, Settings, Timer, AttachFile, Timeline, Brightness4, Language, CloudUpload, Description, Sync } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../contexts/ThemeContext';
import apiClient from '../../api/client';

// NEW: Ctrl/Cmd+K quick switcher (also opened from the search button in
// the top bar, so it works on phones too): jump to any page or run a
// common action without hunting through the menu.
interface Cmd { id: string; label: string; icon: React.ReactNode; group: string; run: () => void }

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toggleDarkMode } = useThemeMode();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  const cmds: Cmd[] = useMemo(() => {
    const go = (p: string) => () => navigate(p);
    const pages = t('pages');
    const actions = t('actions');
    return [
      { id: 'd', label: t('dashboard'), icon: <Dashboard />, group: pages, run: go('/') },
      { id: 'c', label: t('clients'), icon: <People />, group: pages, run: go('/clients') },
      { id: 'o', label: t('orders'), icon: <Receipt />, group: pages, run: go('/orders') },
      { id: 's', label: t('schedule'), icon: <CalendarMonth />, group: pages, run: go('/schedule') },
      { id: 'p', label: t('payments'), icon: <Payment />, group: pages, run: go('/payments') },
      { id: 'e', label: t('expenses'), icon: <MoneyOff />, group: pages, run: go('/expenses') },
      { id: 'r', label: t('reports'), icon: <Assessment />, group: pages, run: go('/reports') },
      { id: 't', label: t('tools'), icon: <AutoAwesome />, group: pages, run: go('/tools') },
      { id: 'tt', label: t('timeTracking'), icon: <Timer />, group: pages, run: go('/time-tracking') },
      { id: 'a', label: t('attachments'), icon: <AttachFile />, group: pages, run: go('/attachments') },
      { id: 'pr', label: t('progress'), icon: <Timeline />, group: pages, run: go('/progress') },
      { id: 'st', label: t('settings'), icon: <Settings />, group: pages, run: go('/settings') },
      { id: 'rd', label: t('reportDrafts'), icon: <Description />, group: pages, run: go('/tools?tab=reports') },
      { id: 'ur', label: t('uploadReport'), icon: <CloudUpload />, group: actions, run: go('/tools?tab=reports&upload=1') },
      { id: 'dm', label: t('toggleTheme'), icon: <Brightness4 />, group: actions, run: toggleDarkMode },
      { id: 'lg', label: t('switchLanguage'), icon: <Language />, group: actions, run: () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar') },
      { id: 'sy', label: t('syncNow'), icon: <Sync />, group: actions, run: () => { apiClient.get('/reports/dashboard/').catch(() => null); } },
    ];
  }, [t, i18n, navigate, toggleDarkMode]);

  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase()));
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { if (open) setQ(''); }, [open]);

  const run = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(list[idx]); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { position: 'absolute', top: { xs: 8, sm: 72 }, m: 1, width: 'calc(100% - 16px)', borderRadius: 4, overflow: 'hidden' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Search color="primary" />
        <InputBase autoFocus fullWidth placeholder={t('typeToSearch')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} sx={{ fontSize: 17 }} />
        <Typography variant="caption" sx={{ px: 0.75, py: 0.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, color: 'text.secondary' }}>esc</Typography>
      </Box>
      <List sx={{ maxHeight: '60vh', overflow: 'auto', py: 0.5 }}>
        {list.length === 0 && <Typography sx={{ p: 3, textAlign: 'center' }} color="text.secondary">{t('noResults')}</Typography>}
        {list.map((c, i) => (
          <React.Fragment key={c.id}>
            {(i === 0 || list[i - 1].group !== c.group) && <Typography variant="overline" sx={{ px: 2, pt: 1, display: 'block', color: 'text.secondary' }}>{c.group}</Typography>}
            <ListItemButton selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => run(c)} sx={{ mx: 1, borderRadius: 2 }}>
              <ListItemIcon sx={{ minWidth: 38, color: 'primary.main' }}>{c.icon}</ListItemIcon>
              <ListItemText primary={c.label} />
            </ListItemButton>
          </React.Fragment>
        ))}
      </List>
    </Dialog>
  );
}

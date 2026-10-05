import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Container, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CloudUploadOutlined, DownloadOutlined, LockOutlined, Logout, PlayCircleOutline } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
type Recording = { id: string; title: string; filename: string; size: number; created_at: string; status: string };
const sizeLabel = (bytes: number) => bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(2) + ' GiB' : (bytes / 1024 ** 2).toFixed(1) + ' MiB';
export default function DeliveryPage() {
 const { user, logout } = useAuth(), { i18n } = useTranslation(), navigate = useNavigate();
 const ar = i18n.language === 'ar', client = user?.role === 'client';
 const t = (en: string, arabic: string) => ar ? arabic : en;
 const [clients, setClients] = useState<any[]>([]), [selected, setSelected] = useState(''), [videos, setVideos] = useState<Recording[]>([]), [pending, setPending] = useState<any[]>([]);
 const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [enabled, setEnabled] = useState(true);
 const [title, setTitle] = useState(''), [file, setFile] = useState<File | null>(null), [progress, setProgress] = useState<number | null>(null);
 const [message, setMessage] = useState(''), [error, setError] = useState(''), [playing, setPlaying] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
 const cancel = useRef(false), fileInput = useRef<HTMLInputElement>(null), mounted = useRef(true);
 useEffect(() => () => { mounted.current = false; cancel.current = true; }, []);
 const showError = (e: any) => setError(e.response?.data?.detail || e.message || t('Request failed. Try again.', 'تعذر الطلب. حاول مرة أخرى.'));
 const refresh = async () => {
  if (!client && !selected) { setVideos([]); return; }
  const r = await api.get('/delivery/recordings', { params: client ? {} : { client: selected } }); setVideos(r.data.results);
 };
 const loadPending = async () => { if (!client) setPending((await api.get('/delivery/pending')).data.results); };
 useEffect(() => {
  if (!client) (async () => {
   try { let next: string | null = '/accounts/clients/?page_size=100', list: any[] = []; while (next) { const r: any = await api.get(next.startsWith('http') ? new URL(next).pathname.replace(/^\/api/, '') + new URL(next).search : next); list.push(...r.data.results); next = r.data.next; } setClients(list); await loadPending(); } catch (e) { showError(e); } finally { setLoading(false); }
  })();
 }, [client]);
 useEffect(() => {
  let active = true; setPlaying(''); setVideos([]); setError(''); setPassword(''); setUsername(''); setEnabled(true);
  (async () => { setLoading(true); try {
   if (client || selected) { const r = await api.get('/delivery/recordings', { params: client ? {} : { client: selected } }); if (active) setVideos(r.data.results); }
   if (!client && selected) { const a = (await api.get('/delivery/access', { params: { client: selected } })).data; if (active) { setUsername(a?.username || ''); setEnabled(a ? !!a.is_active : true); } }
  } catch (e) { if (active) showError(e); } finally { if (active) setLoading(false); } })(); return () => { active = false; };
 }, [selected, client]);
 async function saveAccess() {
  setError(''); setMessage(''); setSaving(true);
  try { await api.post('/delivery/access', { client_id: Number(selected), username, password: password || undefined, is_active: enabled }); setPassword(''); setMessage(t('Access saved. Give this client the username and password you entered. Existing sessions have been signed out.', 'تم حفظ الدخول. أعطِ العميل اسم المستخدم وكلمة المرور التي أدخلتها. تم إنهاء جلسات الدخول السابقة.')); } catch (e) { showError(e); } finally { setSaving(false); }
 }
 async function uploadVideo() {
  if (!file) return; setError(''); setMessage(''); setProgress(0); cancel.current = false; let id = '';
  try {
   const start = await api.post('/delivery/uploads', { client_id: Number(selected), title, filename: file.name, content_type: file.type || (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'video/webm'), size: file.size });
   id = start.data.id; const chunk = start.data.chunk_size;
   for (let offset = 0, n = 1; offset < file.size; offset += chunk, n++) {
    if (cancel.current) throw new Error(t('Upload cancelled.', 'تم إلغاء الرفع.'));
    const part = file.slice(offset, offset + chunk);
    for (let attempt = 0; ; attempt++) {
     try { await api.put(`/delivery/uploads/${id}/parts/${n}`, part, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 300000, onUploadProgress: e => { if (mounted.current) setProgress(Math.min(99, Math.round((offset + Math.min(e.loaded, part.size)) / file.size * 100))); } }); break; }
     catch (e: any) { if (attempt >= 2 || e.response && e.response.status < 500) throw e; }
    }
   }
   if (cancel.current) throw new Error(t('Upload cancelled.', 'تم إلغاء الرفع.'));
   await api.post(`/delivery/uploads/${id}/complete`); id = ''; setFile(null); setTitle(''); if (fileInput.current) fileInput.current.value = ''; await refresh(); setMessage(t('Video delivered securely to this client.', 'تم تسليم الفيديو لهذا العميل بأمان.'));
  } catch (e) { if (id) await api.delete(`/delivery/uploads/${id}`).catch(() => {}); showError(e); }
  finally { if (mounted.current) { setProgress(null); await loadPending().catch(showError); } }
 }
 async function changeVideo(v: Recording, remove = false) {
  if (remove && !window.confirm(t(`Delete “${v.title}” permanently?`, `حذف «${v.title}» نهائيًا؟`))) return;
  try { if (remove) await api.delete('/delivery/recordings/' + v.id); else await api.patch('/delivery/recordings/' + v.id, { status: v.status === 'ready' ? 'hidden' : 'ready' }); setPlaying(''); await refresh(); } catch (e) { showError(e); }
 }
 const media = (id: string) => '/api/delivery/recordings/' + id + '/file';
 return <Box sx={client ? { '& .MuiButton-outlined': { borderColor: '#132a44', color: '#132a44' }, minHeight: '100vh', bgcolor: '#f6f3ed', color: '#132a44', '& .MuiTypography-root.MuiTypography-colorTextSecondary': { color: '#586779' } } : {}}>
  {client && <Box component="header" sx={{ bgcolor: '#132a44', color: '#fff', py: 2, px: { xs: 2, md: 5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}><Stack direction="row" spacing={1.5} alignItems="center"><Box component="img" src="/profile/brand-logo.webp" alt="" sx={{ width: 48, height: 48, objectFit: 'contain' }} /><Typography fontWeight={800}>SMART SHOOTS</Typography></Stack><Button color="inherit" startIcon={<Logout />} onClick={() => { logout(); navigate('/login'); }}>{t('Sign out', 'خروج')}</Button></Box>}
  <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
   <Stack spacing={3}>
    <Box><Chip icon={<LockOutlined />} label={t('PRIVATE CLIENT DELIVERY', 'تسليم خاص للعملاء')} sx={{ mb: 2, bgcolor: '#eee3c9', color: '#132a44' }} /><Typography variant="h4" sx={{ fontSize: { xs: '1.9rem', md: '2.8rem' } }}>{client ? t(`Your recording room, ${user?.first_name || ''}`, `مساحة تسجيلاتك، ${user?.first_name || ''}`) : t('Client recordings', 'تسجيلات العملاء')}</Typography><Typography sx={{ mt: 1 }} color="text.secondary">{client ? t('Watch your delivered videos or download the original files.', 'شاهد الفيديوهات التي تم تسليمها لك أو نزّل الملفات الأصلية.') : t('Choose a client, set their login, then upload their recordings.', 'اختر العميل، واضبط بيانات دخوله، ثم ارفع تسجيلاته.')}</Typography></Box>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}{message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
    {!client && <>
     <TextField select fullWidth label={t('Client', 'العميل')} value={selected} disabled={progress !== null} onChange={e => { setSelected(e.target.value); setMessage(''); }}><MenuItem value="">{t('Select a client', 'اختر العميل')}</MenuItem>{clients.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}</TextField>
     {selected && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
      <Card sx={{ p: 3 }}><Stack spacing={2}><Typography variant="h6">{t('Client login', 'دخول العميل')}</Typography><Typography variant="body2">{t('Use the same /login page. Only this client’s videos will appear.', 'يستخدم العميل صفحة /login نفسها. تظهر له فيديوهاته فقط.')}</Typography><TextField label={t('Username', 'اسم المستخدم')} value={username} autoComplete="off" onChange={e => setUsername(e.target.value)} /><TextField label={t('New password (12+ characters)', 'كلمة مرور جديدة (12 حرفًا فأكثر)')} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} helperText={t('Leave blank to keep an existing password.', 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية.')} /><TextField select label={t('Access', 'صلاحية الدخول')} value={enabled ? 'on' : 'off'} onChange={e => setEnabled(e.target.value === 'on')}><MenuItem value="on">{t('Enabled', 'مفعّل')}</MenuItem><MenuItem value="off">{t('Disabled', 'معطّل')}</MenuItem></TextField><Button variant="contained" disabled={saving || !username} onClick={saveAccess}>{t('Save access', 'حفظ الدخول')}</Button><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{window.location.origin}/login</Typography></Stack></Card>
      <Card sx={{ p: 3 }}><Stack spacing={2}><Typography variant="h6">{t('Deliver a recording', 'تسليم تسجيل')}</Typography><TextField label={t('Video title', 'عنوان الفيديو')} value={title} disabled={progress !== null} onChange={e => setTitle(e.target.value)} /><Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />} disabled={progress !== null}>{t('Choose MP4 / WebM', 'اختر MP4 / WebM')}<input ref={fileInput} hidden type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} /></Button>{file && <Typography sx={{ overflowWrap: 'anywhere' }}>{file.name} · {sizeLabel(file.size)}</Typography>}<Typography variant="caption">{t('Up to 20 GiB per video. MP4 with H.264/AAC works on most devices. Keep this page open until delivery finishes.', 'حتى 20 GiB لكل فيديو. يُنصح بـ MP4 بترميز H.264/AAC. أبقِ الصفحة مفتوحة حتى انتهاء التسليم.')}</Typography>{progress !== null ? <><LinearProgress variant="determinate" value={progress} /><Typography role="status">{progress}%</Typography><Button onClick={() => { cancel.current = true; }} disabled={cancel.current}>{t('Cancel upload', 'إلغاء الرفع')}</Button></> : <Button variant="contained" disabled={!file || !title} onClick={uploadVideo}>{t('Upload & deliver', 'رفع وتسليم')}</Button>}</Stack></Card>
     </Box>}
     {pending.length > 0 && <Alert severity="warning">{t('Unfinished uploads — cancel before retrying:', 'عمليات رفع غير مكتملة — ألغها قبل المحاولة:')}{pending.map(p => <Box key={p.id}>{p.title} <Button onClick={async () => { try { await api.delete('/delivery/uploads/' + p.id); await loadPending(); } catch (e) { showError(e); } }}>{t('Cancel', 'إلغاء')}</Button></Box>)}</Alert>}
    </>}
    {loading && <LinearProgress />}
    {!loading && (client || selected) && videos.length === 0 && <Card sx={{ p: 5, textAlign: 'center' }}><PlayCircleOutline sx={{ fontSize: 50, color: '#b28a3d' }} /><Typography variant="h6">{t('Your recordings will appear here', 'ستظهر التسجيلات هنا')}</Typography><Typography>{t('Videos become available after the studio finishes uploading them.', 'تظهر الفيديوهات بعد اكتمال رفعها من الاستوديو.')}</Typography></Card>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>{videos.map(v => <Card key={v.id} sx={{ overflow: 'hidden', bgcolor: client ? '#fff' : undefined, color: client ? '#132a44' : undefined }}>
     <Box sx={{ bgcolor: '#132a44', minHeight: 190, aspectRatio: '16 / 9', display: 'grid', placeItems: 'center' }}>{playing === v.id ? <video key={v.id} controls autoPlay playsInline preload="metadata" src={media(v.id)} style={{ width: '100%', height: '100%', maxHeight: '70vh' }} onError={() => setError(t('Preview unavailable. Download the original file or sign in again if your session expired.', 'تعذرت المعاينة. نزّل الملف الأصلي أو سجّل الدخول مجددًا إذا انتهت الجلسة.'))} /> : <Button onClick={() => setPlaying(v.id)} startIcon={<PlayCircleOutline />} sx={{ color: '#e8c879', fontSize: '1.1rem', p: 3 }}>{t('Watch recording', 'مشاهدة التسجيل')}</Button>}</Box>
     <Stack spacing={1.5} sx={{ p: 3 }}><Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{v.title}</Typography><Typography variant="body2">{new Date(v.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')} · {sizeLabel(v.size)} {v.status === 'hidden' && t('· Hidden from client', '· مخفي عن العميل')}</Typography><Button href={media(v.id) + '?download=1'} variant="outlined" startIcon={<DownloadOutlined />}>{t('Download original', 'تنزيل الملف الأصلي')}</Button>{!client && <Stack direction="row" spacing={1}><Button onClick={() => changeVideo(v)}>{v.status === 'ready' ? t('Hide from client', 'إخفاء عن العميل') : t('Publish', 'إظهار')}</Button><Button color="error" onClick={() => changeVideo(v, true)}>{t('Delete', 'حذف')}</Button></Stack>}</Stack>
    </Card>)}</Box>
    {client && <Typography variant="body2" sx={{ textAlign: 'center', py: 2 }}>{t('Need help? Contact SMART SHOOTS', 'تحتاج مساعدة؟ تواصل مع SMART SHOOTS')} · <a href="https://wa.me/201039331699">01039331699</a></Typography>}
   </Stack>
  </Container>
 </Box>;
}

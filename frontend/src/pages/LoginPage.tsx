import React, { useEffect,useState } from 'react';
import { Box, TextField, Button, Typography, Alert, InputAdornment, IconButton, CircularProgress } from '@mui/material';
import { Visibility, VisibilityOff, ArrowForward, LockOutlined, Language, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import './StudioLogin.css';
export default function LoginPage() {
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false);
 const[film,setFilm]=useState('');useEffect(()=>{Promise.all([fetch('/profile/config.json').then(r=>r.json()),fetch('/api/studio/public').then(r=>r.json()).catch(()=>({settings:{}}))]).then(([a,b])=>{const url=b.settings?.studio_film||a.studio_film;if(url&&/^https:\/\//.test(url)||url?.startsWith('/profile/'))setFilm(url);}).catch(()=>{});},[]);
 const navigate=useNavigate(),{login}=useAuth(),{i18n}=useTranslation();const ar=i18n.language==='ar',text=(en:string,arabic:string)=>ar?arabic:en;
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setSubmitting(true);try{await login(username,password);navigate('/');}catch(err:any){setError(err.response?.status===429?text('Too many attempts. Please try again in 15 minutes.','محاولات كثيرة. حاول مجددًا بعد 15 دقيقة.'):err.response?.status>=500||!err.response?text('We could not connect to the studio. Please try again.','تعذر الاتصال بالاستوديو. حاول مجددًا.'):text('The username or password is incorrect.','اسم المستخدم أو كلمة المرور غير صحيحة.'));}finally{setSubmitting(false);}}
 return <Box className="studio-login">
  <Box component="header" className="login-header"><a href="https://smartshoots.uk/" className="login-brand"><img src="/profile/brand-logo.webp" alt="Smart Shoots" /><span>SMART SHOOTS</span></a><Button startIcon={<Language />} onClick={()=>i18n.changeLanguage(ar?'en':'ar')} sx={{color:'#10233d',minHeight:44}}>{ar?'English':'العربية'}</Button></Box>
  <Box className="login-layout">
   <Box className="login-form-side"><Box className="login-form-inner">
    <a className="back-to-studio" href="https://smartshoots.uk/"><ArrowBack fontSize="small" />{text('Back to the studio','العودة للاستوديو')}</a>
    <span className="login-eyebrow">SMART SHOOTS / PRIVATE ACCESS</span>
    <Typography component="h1" className="login-title">{text('Your work.','أعمالك.')}<br /><span>{text('Your space.','مساحتك.')}</span></Typography>
    <Typography className="login-subtitle">{text('Sign in to your recordings, the shared screening room or your studio workspace.','سجّل الدخول لتسجيلاتك أو قاعة المشاهدة المشتركة أو مساحة إدارة الاستوديو.')}</Typography>
    <Box component="form" onSubmit={submit} className="login-form">
     {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
     <TextField fullWidth label={text('Username','اسم المستخدم')} value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" inputProps={{maxLength:150}} disabled={submitting} />
     <TextField fullWidth label={text('Password','كلمة المرور')} type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" disabled={submitting} InputProps={{endAdornment:<InputAdornment position="end"><IconButton aria-label={text(showPassword?'Hide password':'Show password',showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور')} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} edge="end">{showPassword?<VisibilityOff />:<Visibility />}</IconButton></InputAdornment>}} />
     <Button fullWidth type="submit" variant="contained" disabled={submitting} endIcon={submitting?<CircularProgress size={18} color="inherit" />:<ArrowForward />} sx={{minHeight:56,bgcolor:'#10233d',color:'#fff',borderRadius:'12px',boxShadow:'none','&:hover':{bgcolor:'#1d3d60'}}}>{text('Enter your space','ادخل مساحتك')}</Button>
    </Box>
    <Box className="login-role-hints"><span>{text('Client','عميل')}</span><span>{text('Invited guest','ضيف مدعو')}</span><span>{text('Studio admin','مدير الاستوديو')}</span></Box><Box className="login-access-note"><LockOutlined fontSize="small" /><Typography>{text('Use the credentials supplied by SMART SHOOTS. Your account opens the right space automatically.','استخدم بيانات الدخول التي وفّرها SMART SHOOTS. حسابك يفتح المساحة المناسبة تلقائيًا.')}</Typography></Box>
    <Box className="login-help"><span>{text('Need access?','تحتاج بيانات الدخول؟')}</span><a href="https://wa.me/201039331699">{text('Contact the studio ↗','تواصل مع الاستوديو ↗')}</a></Box>
   </Box></Box>
   <Box className="login-visual">{film&&<video className="login-scene" src={film} autoPlay={!matchMedia('(prefers-reduced-motion:reduce)').matches} muted loop playsInline preload="none" controls poster="/profile/studio-concept.webp" onError={()=>setFilm('')}/>}<img hidden={!!film} className="login-scene" src="/profile/studio-concept.webp" alt="" /><Box className="login-visual-copy"><span className="login-eyebrow">A CREATIVE PRODUCTION STUDIO</span><Typography component="h2">{text('Expertise,','خبرتك،')}<br /><span>{text('in focus.','في الكادر.')}</span></Typography><p>{text('A dedicated space for ideas worth sharing.','مساحة مخصصة للأفكار التي تستحق المشاركة.')}</p></Box><Box className="login-equipment"><div><b>90″</b><span>{text('Interactive display','شاشة تفاعلية')}</span></div><div><b>Canon</b><span>{text('Premium cameras','كاميرات احترافية')}</span></div><div><b>Audio</b><span>{text('Premium microphones','مايكروفونات احترافية')}</span></div></Box><span className="login-concept-note">{film?text('SMART SHOOTS studio film','فيلم استوديو SMART SHOOTS'):text('Illustrative equipment concept','تصوّر توضيحي للتجهيزات')}</span></Box>
  </Box>
  <Box component="footer" className="login-footer"><span>© {new Date().getFullYear()} SMART SHOOTS</span><span>{text('HELWAN, EGYPT • YOUR EXPERTISE DESERVES A STAGE','حلوان، مصر • خبرتك تستحق الظهور')}</span></Box>
 </Box>;
}

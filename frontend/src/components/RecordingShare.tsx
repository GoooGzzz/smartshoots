import React, { useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { YouTube, Telegram, WhatsApp, DownloadRounded, ShareRounded, ContentCopyRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import './RecordingShare.css';
export default function RecordingShare({recording}:{recording:{id:string;title:string}}) {
 const {i18n}=useTranslation(),ar=i18n.language==='ar',t=(en:string,arabic:string)=>ar?arabic:en;
 const [youtube,setYoutube]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const [selectedFile,setSelectedFile]=useState<File|null>(null);
 const portal=new URL('/recordings',window.location.origin).href;
 const message=recording.title+' — '+t('Open your private recording room (sign-in required).','افتح مساحة تسجيلاتك الخاصة (يلزم تسجيل الدخول).')+' '+portal;
 const download='/api/delivery/recordings/'+encodeURIComponent(recording.id)+'/file?download=1';
 async function shareFile(){
  const file=selectedFile;if(!file)return;
  setError('');setNotice('');
  if(!navigator.canShare?.({files:[file]})||!navigator.share){setError(t('This browser cannot share this file. Attach the downloaded video manually in WhatsApp or Telegram.','لا يدعم المتصفح مشاركة هذا الملف. أرفق الفيديو المنزّل يدويًا في واتساب أو تيليجرام.'));return;}
  try{await navigator.share({files:[file],title:recording.title});setNotice(t('File handed to your device sharing menu.','تم إرسال الملف إلى قائمة المشاركة على جهازك.'));}catch(e:any){if(e.name!=='AbortError')setError(t('Could not share this file. Attach it manually in your messaging app.','تعذرت مشاركة الملف. أرفقه يدويًا في تطبيق المراسلة.'));}
 }
 return <Box className="recording-share">
  <Typography variant="h6">{t('Your content. Ready to go.','محتواك جاهز للمشاركة.')}</Typography>
  <Typography variant="body2">{t('Download your video or share your private portal link.','نزّل الفيديو أو شارك رابط مساحة تسجيلاتك الخاصة.')}</Typography>
  <Box className="recording-share-grid">
   <Button className="share-action share-youtube" onClick={()=>setYoutube(true)}><span className="share-icon"><YouTube/></span><span>YouTube<small>{t('Upload guide','دليل الرفع')}</small></span></Button>
   <Button className="share-action share-telegram" component="a" href={'https://t.me/share/url?url='+encodeURIComponent(portal)+'&text='+encodeURIComponent(recording.title)} target="_blank" rel="noopener noreferrer"><span className="share-icon"><Telegram/></span><span>Telegram<small>{t('Share portal link','مشاركة رابط المساحة')}</small></span></Button>
   <Button className="share-action share-whatsapp" component="a" href={'https://wa.me/?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer"><span className="share-icon"><WhatsApp/></span><span>WhatsApp<small>{t('Share portal link','مشاركة رابط المساحة')}</small></span></Button>
   <Button className="share-action share-download" component="a" href={download}><span className="share-icon"><DownloadRounded/></span><span>{t('Download','تنزيل')}<small>{t('Original video','الفيديو الأصلي')}</small></span></Button>
  </Box>
  <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
   <Button startIcon={<ContentCopyRounded/>} onClick={async()=>{try{await navigator.clipboard.writeText(message);setNotice(t('Private portal link copied.','تم نسخ رابط المساحة الخاصة.'));}catch{setError(t('Copy unavailable. Use WhatsApp or Telegram above.','تعذر النسخ. استخدم واتساب أو تيليجرام أعلاه.'));}}}>{t('Copy portal link','نسخ رابط المساحة')}</Button>
   <Button startIcon={<ShareRounded/>} onClick={()=>input.current?.click()}>{t('Share a downloaded video','مشاركة فيديو من الجهاز')}</Button>
   <input ref={input} type="file" accept="video/*" hidden onChange={e=>{setSelectedFile(e.target.files?.[0]||null);e.target.value='';}}/>
   {selectedFile&&<Button startIcon={<ShareRounded/>} onClick={shareFile}>{t('Share selected file','مشاركة الملف المختار')}</Button>}
  </Stack>
  <Typography variant="caption" component="p">{selectedFile&&<span>{selectedFile.name} · </span>}{t('Portal links require an authorised login. To send the actual video, download it and attach it in your messaging app, or choose it using “Share a downloaded video”. No passwords are included in links.','روابط المساحة تتطلب حسابًا مصرحًا له. لإرسال الفيديو نفسه، نزّله وأرفقه في تطبيق المراسلة، أو اختره عبر «مشاركة فيديو من الجهاز». الروابط لا تتضمن كلمات المرور.')}</Typography>
  {notice&&<Alert severity="success" onClose={()=>setNotice('')}>{notice}</Alert>}{error&&<Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}
  <Dialog open={youtube} onClose={()=>setYoutube(false)} maxWidth="sm" fullWidth>
   <DialogTitle>{t('Publish to your YouTube channel','النشر على قناتك في يوتيوب')}</DialogTitle>
   <DialogContent><Stack spacing={2}><Typography>{t('1. Download the original video to your device.','١. نزّل الفيديو الأصلي إلى جهازك.')}</Typography><Button href={download} startIcon={<DownloadRounded/>} variant="outlined">{t('Download original','تنزيل الأصل')}</Button><Typography>{t('2. Open YouTube Studio, sign in to your own channel and select Create → Upload videos. On mobile, use the YouTube app’s upload option.','٢. افتح استوديو يوتيوب وسجّل الدخول إلى قناتك، ثم اختر إنشاء ← تحميل فيديوهات. على الهاتف استخدم خيار الرفع في تطبيق يوتيوب.')}</Typography><Button href="https://studio.youtube.com/" target="_blank" rel="noopener noreferrer" startIcon={<YouTube/>} variant="outlined">{t('Open YouTube Studio','فتح استوديو يوتيوب')}</Button><Typography>{t('3. Choose the downloaded file, add the title and thumbnail, then choose Private, Unlisted or Public before publishing.','٣. اختر الملف المنزّل وأضف العنوان والصورة المصغرة، ثم حدّد خاص أو غير مدرج أو علني قبل النشر.')}</Typography><Alert severity="info">{t('This guide does not upload or publish automatically. Only publish content you are authorised to share.','هذا الدليل لا يرفع أو ينشر تلقائيًا. انشر فقط المحتوى المصرح لك بمشاركته.')}</Alert></Stack></DialogContent>
   <DialogActions><Button onClick={()=>setYoutube(false)}>{t('Close','إغلاق')}</Button></DialogActions>
  </Dialog>
 </Box>;
}

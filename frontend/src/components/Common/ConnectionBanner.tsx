import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { subscribeBackendStatus } from '../../api/connectionStatus';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../../queryClient';
export default function ConnectionBanner() {
  const { t } = useTranslation(); const [offline,setOffline] = useState(false);const [retrying,setRetrying]=useState(false);const previous=useRef(false);
  useEffect(()=>subscribeBackendStatus(value=>{setOffline(value);if(previous.current&&!value)queryClient.invalidateQueries();previous.current=value;}),[]);
  if(!offline)return null;
  return <Alert severity="warning" sx={{position:'fixed',top:72,left:'50%',transform:'translateX(-50%)',zIndex:1250,maxWidth:'calc(100% - 24px)'}} action={<Button disabled={retrying} onClick={async()=>{setRetrying(true);try{await apiClient.get('/health/');}catch{}finally{setRetrying(false);}}}>{retrying?<CircularProgress size={16}/>:t('retry')}</Button>}>{t('backendUnreachable')}</Alert>;
}

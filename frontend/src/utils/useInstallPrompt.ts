import { useEffect, useState } from 'react';

// NEW: captures the browser's "install app" event so the shell can show an
// Install button (web/PWA only - the APK is already installed).
export default function useInstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return {
    canInstall: !!evt,
    install: async () => { if (!evt) return; evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); },
  };
}

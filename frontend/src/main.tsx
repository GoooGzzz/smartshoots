import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// FIX / NEW: theme declared 'Inter' as the font but never actually
// loaded it anywhere - it silently fell back to the OS default font the
// whole time. This self-hosts Plus Jakarta Sans (bundled by Vite, works
// fully offline - unlike a Google Fonts CDN link, which would break with
// no internet) for the distinctive look used in the new theme.
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles/global.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// NEW: offline app shell. Registered only in production builds; in the
// Android app (Capacitor) the UI is already bundled locally, and this adds
// caching of the CDN libraries the report viewer needs.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // FIX: a NEW service worker (shipped with a rebuild) sits "waiting"
      // until every open tab of the OLD version fully closes - which on
      // a machine that's never fully closed the browser could be days.
      // Until then the OLD worker keeps serving the OLD cached shell,
      // so a fix could be deployed and still look like it "didn't take"
      // (part of what "cache not working" looked like). This forces the
      // new one to take over immediately and reloads once so the page
      // that's open actually gets the new code, instead of silently
      // running stale JS underneath a seemingly-fine-looking page.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) sw.postMessage('SKIP_WAITING');
        });
      });
    }).catch(() => { /* http on LAN (not a secure context) - safely skipped */ });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

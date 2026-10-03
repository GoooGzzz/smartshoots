import apiClient from '../api/client';
import { isBackendUnreachable, subscribeBackendStatus } from '../api/connectionStatus';

// NEW: pre-loads the main lists in the background while online, so every
// screen already has saved data the first time the connection drops -
// previously a page only worked offline if you had opened it while online.
const ENDPOINTS = [
  '/reports/dashboard/', '/accounts/clients/', '/production/orders/', '/production/packages/',
  '/scheduling/appointments/', '/finance/payments/', '/finance/expenses/', '/finance/expense-categories/',
  '/finance/settings/', '/finance/attachments/', '/production/time-logs/', '/accounts/staff/', '/accounts/client-tags/',
  '/toolkit/scripts/', '/toolkit/service-profiles/', '/toolkit/report-drafts/', '/reports/financial/?days=30',
  '/notifications/?is_read=false',
];
const STAMP = 'offline_prefetch_at';
let running = false;

export async function prefetchForOffline(force = false) {
  if (running || isBackendUnreachable() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const last = Number(localStorage.getItem(STAMP) || 0);
  if (!force && Date.now() - last < 5 * 60 * 1000) return;
  running = true;
  try {
    for (const url of ENDPOINTS) {
      if (isBackendUnreachable()) break;
      await apiClient.get(url).catch(() => null);
    }
    localStorage.setItem(STAMP, String(Date.now()));
  } finally { running = false; }
}

/** Run now, every 15 min, and whenever the server becomes reachable again. */
export function startOfflinePrefetch(): () => void {
  const first = setTimeout(() => prefetchForOffline(), 1500);
  const id = setInterval(() => prefetchForOffline(), 15 * 60 * 1000);
  let wasDown = false;
  const un = subscribeBackendStatus((down) => { if (wasDown && !down) prefetchForOffline(true); wasDown = down; });
  return () => { clearTimeout(first); clearInterval(id); un(); };
}

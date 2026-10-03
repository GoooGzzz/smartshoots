import axios from 'axios';
import { reportBackendUnreachable, registerFlushHandler, isBackendUnreachable } from './connectionStatus';
import { getApiBaseUrl } from './serverConfig';
import { cacheGet, getCachedGet, enqueueMutation, flushQueue, QueuedMutation } from './offlineQueue';
import { enqueueFileMutation, flushFileQueue, toFormData, QueuedFileMutation } from './offlineFileQueue';

// NEW: axios has no timeout by default - a request to an address nothing
// is actually listening on (wrong IP, blocked by a firewall that drops
// packets instead of rejecting them, wrong Wi-Fi network entirely)
// doesn't fail, it just hangs, potentially for minutes, with no error
// ever surfacing to react-query or this file's own "unreachable"
// detection below. From the person's side that looks exactly like
// infinite loading with zero feedback - a fixed timeout guarantees any
// request eventually turns into an actual, visible error instead.
const apiClient = axios.create({ withCredentials: true, timeout: 8000 });

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function authHeaders() {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('auth_token');
  if (token) headers.Authorization = `Token ${token}`;
  return headers;
}

// NEW: when we already know there is no connection, a cached GET should
// return IMMEDIATELY, not after another failed round-trip. Custom
// adapter = axios never opens a socket at all for this request; the
// cached copy resolves in the same tick data was already in memory/
// localStorage. Falls through to a normal (fast-timeout) request only
// when there's no cached copy to fall back to, or it's not a GET.
function cachedInstantAdapter(cachedAt: number, data: any) {
  return async (config: any) => ({
    data, status: 200, statusText: 'OK (cached, offline)', headers: {}, config,
    request: null, _fromCache: true, _cachedAt: cachedAt,
  });
}

// FIX (real bug, not hypothetical): once the backend was marked
// unreachable, EVERY GET with a cached copy started skipping the
// network completely (see cachedInstantAdapter above) to make offline
// screens feel instant. That part is good - but it meant the app could
// never observe a real network response again to notice the server had
// come back, because nothing ever asked it. Result: after any outage -
// even a brief one, a sleeping laptop, the PC's Wi-Fi blipping - the app
// could stay in "offline" mode FOREVER: every new order/client/payment
// kept getting silently queued as a fake local "success" instead of
// actually reaching the server, which is exactly what "the app doesn't
// sync with the web app" looks like from the outside. This throttled
// background probe (fire-and-forget, never blocks the instant cached
// response the person sees) is what allows recovery to be noticed again.
let lastProbeAt = 0;
function maybeProbeBackend() {
  const now = Date.now();
  if (now - lastProbeAt < 8000) return;
  lastProbeAt = now;
  axios
    .get(`${getApiBaseUrl()}/accounts/clients/`, { timeout: 3000, headers: authHeaders(), withCredentials: true })
    .then(() => reportBackendUnreachable(false))
    .catch(() => { /* still genuinely down - try again on the next throttle window */ });
}

apiClient.interceptors.request.use((config) => {
  // Recomputed on every request (not just at module load) so changing
  // the server address in Settings takes effect immediately without a
  // reload.
  config.baseURL = getApiBaseUrl();

  const knownOffline = (typeof navigator !== 'undefined' && navigator.onLine === false) || isBackendUnreachable();

  if (knownOffline && (config.method || 'get').toLowerCase() === 'get' && config.url) {
    const cached = getCachedGet(config.url);
    if (cached) {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) maybeProbeBackend();
      // Skip the network entirely for what the person SEES - this is the
      // response - but a real check for recovery still runs above.
      config.adapter = cachedInstantAdapter(cached.cachedAt, cached.data) as any;
      return config;
    }
  }

  // NEW: when the OS already says there is no network, don't make the
  // person wait the full 12s timeout before the cached copy appears (for
  // requests with no cached copy at all, e.g. the very first load).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) config.timeout = 1500;
  // Server already known to be unreachable: fail fast so saved data shows in ~2s, not 8-25s.
  else if (isBackendUnreachable()) config.timeout = 2500;

  Object.assign(config.headers, authHeaders());

  const csrfToken = getCookie('csrftoken');
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  return config;
});

const MUTATION_METHODS = ['post', 'put', 'patch', 'delete'];

// A second, un-intercepted axios instance used only to replay queued
// mutations - going through apiClient itself would re-trigger the same
// "offline? queue it" logic and the request would just re-queue itself
// forever instead of ever actually being sent.
async function sendRaw(m: QueuedMutation) {
  return axios.request({
    baseURL: getApiBaseUrl(),
    url: m.url,
    method: m.method,
    data: m.data,
    withCredentials: true,
    timeout: 12000,
    headers: authHeaders(),
  });
}

async function sendRawFile(m: QueuedFileMutation) {
  return axios.request({
    baseURL: getApiBaseUrl(),
    url: m.url,
    method: m.method,
    data: toFormData(m),
    withCredentials: true,
    timeout: 60000, // real file bodies take longer than a JSON mutation
    headers: authHeaders(),
  });
}

// One combined flush point: replay queued JSON mutations first (an order
// created offline should exist before a payment queued against it
// replays), then queued file uploads.
registerFlushHandler(async () => {
  const a = await flushQueue(sendRaw);
  const b = await flushFileQueue(sendRawFile);
  return { synced: a.synced + b.synced, remaining: a.remaining + b.remaining };
});

apiClient.interceptors.response.use(
  (response) => {
    // FIX: a response served instantly from cache by the adapter above
    // (see cachedInstantAdapter) never actually touched the network - it
    // must NOT report the backend as reachable again (that would wrongly
    // trigger the offline mutation queue to start flushing) and there is
    // nothing new to re-cache.
    if ((response as any)._fromCache) return response;
    reportBackendUnreachable(false);
    if (response.config.method?.toLowerCase() === 'get' && response.config.url) {
      cacheGet(response.config.url, response.data);
    }
    return response;
  },
  (error) => {
    const isUnreachable = !error.response && !!error.request;
    reportBackendUnreachable(isUnreachable);

    if (isUnreachable) {
      const method = error.config?.method?.toLowerCase();
      const url = error.config?.url as string | undefined;

      // Offline GET: serve the last cached copy instead of a hard
      // failure, so the page still shows data instead of going blank.
      if (method === 'get' && url) {
        const cached = getCachedGet(url);
        if (cached) {
          return Promise.resolve({ ...error.response, data: cached.data, status: 200, _fromCache: true, _cachedAt: cached.cachedAt, config: error.config });
        }
      }

      // Offline write: queue it instead of failing outright - EXCEPT
      // auth endpoints. Login/logout have no meaningful "queued" outcome
      // (there's no token to hand back yet), so queuing a login attempt
      // would resolve as a fake 202 success with no real token/user in
      // it, and the app would think it's logged in with garbage
      // credentials. Let those fail normally instead.
      // NEW: a file upload (FormData) made offline is now queued for
      // real, using IndexedDB (see offlineFileQueue.ts) instead of the
      // JSON-only queue, and replayed automatically once reconnected -
      // rather than being rejected outright, which is what happened
      // before and meant a photo taken on-site with no signal had to be
      // manually redone later.
      if (method && (method === 'post' || method === 'put' || method === 'patch') && typeof FormData !== 'undefined' && error.config?.data instanceof FormData && url) {
        return enqueueFileMutation(method, url, error.config.data).then((queued) => {
          if (!queued) {
            // IndexedDB genuinely unavailable (very old WebView, private
            // mode with storage blocked) - be honest instead of silently
            // losing the file.
            (error as any).offlineUploadUnsupported = true;
            return Promise.reject(error);
          }
          return { data: { id: queued.id, _queued: true, _queuedFile: true }, status: 202, _queued: true, config: error.config };
        });
      }

      const isAuthEndpoint = url?.includes('/auth/');
      if (method && url && MUTATION_METHODS.includes(method) && !isAuthEndpoint) {
        let data: any;
        try { data = typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data; } catch { data = error.config.data; }
        const queued = enqueueMutation(method as any, url, data);
        return Promise.resolve({
          data: { ...data, id: queued.id, _queued: true },
          status: 202,
          _queued: true,
          config: error.config,
        });
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

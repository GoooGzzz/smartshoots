import axios from 'axios';
import { reportBackendUnreachable, isBackendUnreachable } from './connectionStatus';
import { getApiBaseUrl } from './serverConfig';
import { cacheGet, getCachedGet } from './offlineQueue';

const apiClient = axios.create({ baseURL: getApiBaseUrl(), withCredentials: true, timeout: 15000 });
const authHeaders = () => { const token = localStorage.getItem('auth_token'); return token ? { Authorization: `Token ${token}` } : {}; };
let lastProbeAt = 0;
function probeCloud() {
  if (Date.now() - lastProbeAt < 8000) return;
  lastProbeAt = Date.now();
  axios.get('/api/health/', { timeout: 4000 }).then(() => reportBackendUnreachable(false)).catch(() => {});
}
apiClient.interceptors.request.use(config => {
  config.baseURL = getApiBaseUrl();
  Object.assign(config.headers, authHeaders());
  if (config.data instanceof FormData) config.timeout = 60000;
  const offline = !navigator.onLine || isBackendUnreachable();
  if (offline && !config.url?.startsWith('/academy/') && !config.url?.startsWith('/delivery/') && !config.url?.startsWith('/accounts/auth/') && config.method === 'get' && config.url) {
    const cached = getCachedGet(config.url);
    if (cached) {
      if (navigator.onLine) probeCloud();
      config.adapter = async c => ({ data: cached.data, status: 200, statusText: 'Cached read', headers: {}, config: c, _fromCache: true, _cachedAt: cached.cachedAt });
    }
  }
  return config;
});
apiClient.interceptors.response.use(response => {
  if ((response as any)._fromCache) return response;
  reportBackendUnreachable(false);
  if (response.config.method === 'get' && !response.config.url?.startsWith('/academy/') && !response.config.url?.startsWith('/delivery/') && !response.config.url?.startsWith('/accounts/auth/') && response.config.url && response.config.responseType !== 'blob') cacheGet(response.config.url, response.data);
  return response;
}, error => {
  const unreachable = !error.response && !!error.request;
  reportBackendUnreachable(unreachable);
  if (unreachable && !error.config?.url?.startsWith('/academy/') && !error.config?.url?.startsWith('/delivery/') && !error.config?.url?.startsWith('/accounts/auth/') && error.config?.method === 'get' && error.config?.url) {
    const cached = getCachedGet(error.config.url);
    if (cached) return { data: cached.data, status: 200, _fromCache: true, _cachedAt: cached.cachedAt, config: error.config };
  }
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
    localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user');
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('offline_cache')) localStorage.removeItem(k); }
    window.location.assign('/login');
  }
  // Saves succeed only after Cloudflare acknowledges them; do not queue local writes.
  return Promise.reject(error);
});
export default apiClient;

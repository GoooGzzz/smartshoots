// NEW: the desktop app works because Electron loads the SPA FROM the
// Django server itself (http://127.0.0.1:<port>/), so a relative
// baseURL like '/api' just works - same origin. The Android build is a
// static app bundled into the APK; it has no "same origin" server to be
// relative to, so it needs an actual address (the PC's LAN IP) to talk
// to. This is that address, configurable from Settings so it's a
// one-time setup step per device rather than a rebuild.
const KEY = 'smartshoots_server_url';

export function getServerUrl(): string {
  return localStorage.getItem(KEY) || '';
}

export function setServerUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '');
  const changed = trimmed !== getServerUrl();
  if (trimmed) localStorage.setItem(KEY, trimmed);
  else localStorage.removeItem(KEY);
  // FIX: switching server address without clearing the old auth token
  // left the app in a broken half-logged-in state - isAuthenticated
  // stayed true (AuthContext only checks whether *a* token exists, not
  // which server issued it), so the person stayed on the app's main
  // screens, but every request came back 401 because that token means
  // nothing to the new server. Clearing it forces a clean re-login
  // against whichever server is now configured, which is the actually
  // correct behavior - it's a different account/database now.
  if (changed) localStorage.removeItem('auth_token');
}

export function getApiBaseUrl(): string {
  const server = getServerUrl();
  return server ? `${server}/api` : '/api';
}

// True when running inside the Capacitor-wrapped Android app rather than
// a normal browser/Electron window (Capacitor injects this global).
export function isNativeApp(): boolean {
  return typeof (window as any).Capacitor !== 'undefined';
}

// Web requests always use the Cloudflare Worker that served the app.
// Ignore legacy LAN/localStorage addresses so old installs cannot redirect cloud traffic.
export function isNativeApp(): boolean { return typeof (window as any).Capacitor !== 'undefined'; }
export function getServerUrl(): string { return window.location.origin; }
export function setServerUrl(url: string) { if (url.replace(/\/+$/, '') !== window.location.origin) throw new Error('Open your Cloudflare app URL to connect.'); }
export function getApiBaseUrl(): string { return '/api'; }

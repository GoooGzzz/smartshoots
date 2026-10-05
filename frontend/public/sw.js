/* SMART SHOOTS service worker - app-shell + runtime caching so the web/PWA
   build opens instantly and keeps working with no connection. API data is
   NOT handled here (the app's own cache + write queue does that). */
const V = 'cloud-studio-v4-academic-page'; // NEW: bump this on every release so old cached bundles are dropped automatically
const SHELL = 'ss-shell-' + V, RUNTIME = 'ss-runtime-' + V, CDN = 'ss-cdn-' + V;
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.add('/')).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('ss-') && ![SHELL, RUNTIME, CDN].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) cache.put(fallbackKey || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackKey || req) || await caches.match(fallbackKey || req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/profile') || (url.pathname === '/' && ['smartshoots.uk','www.smartshoots.uk'].includes(url.hostname))) return;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/') || url.pathname.startsWith('/files/') || url.pathname.startsWith('/r/')) return;
    if (req.mode === 'navigate') {
      if (url.pathname.startsWith('/r/')) { event.respondWith(networkFirst(req, RUNTIME)); return; }
      event.respondWith(networkFirst(req, SHELL, '/')); // SPA: offline -> cached index
      return;
    }
    if (/^\/(static\/)?assets\//.test(url.pathname) || /\.(woff2?|ttf|svg|png|ico)$/.test(url.pathname)) { event.respondWith(cacheFirst(req, SHELL)); return; }
    if (url.pathname.startsWith('/media/')) { event.respondWith(staleWhileRevalidate(req, RUNTIME)); return; }
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(req, CDN));
});

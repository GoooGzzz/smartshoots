// NEW: makes Report Drafts viewable with no connection (web AND Android).
// The gallery quietly saves each HTML report (plus the few CDN libraries
// its styling needs, once, shared) into the browser's Cache Storage.
// Offline, the report is rebuilt from that copy with the libraries inlined
// - inlining matters because the report renders inside a sandboxed iframe,
// which the service worker cannot reach.
const REPORTS = 'ss-offline-reports-v1';
const LIBS = 'ss-offline-libs-v1';
const META_KEY = 'ss_offline_reports_meta';
const LIB_RE = /<script[^>]*\ssrc=["'](https:\/\/(?:cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com)[^"']*)["'][^>]*>\s*<\/script>/gi;
const SHELL_LIBS = ['https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js'];

const supported = () => typeof caches !== 'undefined';
const readMeta = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } };
const writeMeta = (m: Record<string, string>) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* full */ } };
const previewUrl = (publicUrl: string) => `${publicUrl}?preview=1`;

async function ensureLibs() {
  const c = await caches.open(LIBS);
  await Promise.all(SHELL_LIBS.map(async (u) => {
    if (await c.match(u)) return;
    try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch { /* try again next time */ }
  }));
}

export async function saveReportOffline(draft: { public_view_url: string; updated_at?: string; file_type: string }): Promise<boolean> {
  if (!supported() || draft.file_type !== 'html') return false;
  const meta = readMeta();
  const stamp = draft.updated_at || '';
  const c = await caches.open(REPORTS);
  if (meta[draft.public_view_url] === stamp && await c.match(previewUrl(draft.public_view_url))) return true;
  try {
    const res = await fetch(previewUrl(draft.public_view_url));
    if (!res.ok) return false;
    await c.put(previewUrl(draft.public_view_url), res);
    meta[draft.public_view_url] = stamp;
    writeMeta(meta);
    ensureLibs();
    return true;
  } catch { return false; }
}

export async function listSavedReports(): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supported()) return out;
  const c = await caches.open(REPORTS);
  for (const k of await c.keys()) out.add(k.url.replace(/\?preview=1$/, ''));
  return out;
}

export async function removeSavedReport(publicUrl: string) {
  if (!supported()) return;
  (await caches.open(REPORTS)).delete(previewUrl(publicUrl));
  const m = readMeta(); delete m[publicUrl]; writeMeta(m);
}

/** Saved report HTML with CDN libraries inlined, or null if not saved. */
export async function getSavedReportHtml(publicUrl: string): Promise<string | null> {
  if (!supported()) return null;
  const hit = await (await caches.open(REPORTS)).match(previewUrl(publicUrl));
  if (!hit) return null;
  let html = await hit.text();
  const libs = await caches.open(LIBS);
  const matches = Array.from(html.matchAll(LIB_RE));
  for (const m of matches) {
    const lib = await libs.match(m[1]);
    if (lib) {
      const code = (await lib.text()).replace(/<\/script/gi, '<\\/script');
      html = html.replace(m[0], () => `<script>${code}</script>`);
    }
  }
  return html;
}

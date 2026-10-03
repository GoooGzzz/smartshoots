// NEW: this is what makes "works without Wi-Fi for a while" real instead
// of aspirational. Two pieces:
//
// 1. A response cache - every successful GET is stashed in localStorage
//    keyed by URL. When a GET fails because the server is unreachable,
//    we serve the cached copy instead of an error, so pages still show
//    the last-known clients/orders/etc. rather than going blank.
//
// 2. A mutation queue - a create/update/delete made while offline is
//    stored here instead of failing outright, and replayed in order the
//    moment the connection comes back (see flushQueue, wired up from
//    connectionStatus.ts).
//
// Scope, deliberately: this is a cache + retry queue on top of the SAME
// backend, not an independent copy of the business logic running on the
// device. Validation, computed totals, FSM status transitions etc. still
// happen server-side, only once a queued request actually reaches
// Django. Two people editing the same record while both offline, or
// editing something you yourself created offline before it's synced,
// aren't reconciled automatically - full multi-writer sync is a much
// larger project than this.

const CACHE_PREFIX = 'offline_cache:';
const QUEUE_KEY = 'offline_queue';

export interface QueuedMutation {
  id: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  data?: any;
  createdAt: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ---- response cache (GET) -------------------------------------------
const PATH_PREFIX = 'offline_cache_path:';
const pathOf = (url: string) => url.split('?')[0];

// FIX: when storage was full the old code silently stopped caching for
// good. Now the oldest cached responses are evicted to make room.
function evictOldest(count: number) {
  const entries: { k: string; at: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) entries.push({ k, at: safeParse<any>(localStorage.getItem(k), {}).cachedAt || 0 });
  }
  entries.sort((a, b) => a.at - b.at).slice(0, count).forEach((e) => localStorage.removeItem(e.k));
}

export function cacheGet(url: string, data: any) {
  const value = JSON.stringify({ data, cachedAt: Date.now() });
  const write = () => {
    localStorage.setItem(CACHE_PREFIX + url, value);
    // Remember the newest copy per endpoint too, so a page opened with a
    // filter/page number that was never fetched still shows saved data.
    localStorage.setItem(PATH_PREFIX + pathOf(url), url);
  };
  try { write(); } catch {
    try { evictOldest(12); write(); } catch { /* caching is best-effort */ }
  }
}

export function getCachedGet(url: string): { data: any; cachedAt: number } | null {
  const exact = safeParse<any>(localStorage.getItem(CACHE_PREFIX + url), null);
  if (exact) return exact;
  const latestUrl = localStorage.getItem(PATH_PREFIX + pathOf(url));
  return latestUrl ? safeParse<any>(localStorage.getItem(CACHE_PREFIX + latestUrl), null) : null;
}

// ---- mutation queue (POST/PUT/PATCH/DELETE) --------------------------
export function getQueue(): QueuedMutation[] {
  return safeParse(localStorage.getItem(QUEUE_KEY), []);
}

function saveQueue(queue: QueuedMutation[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch { /* ignore */ }
}

export function enqueueMutation(method: QueuedMutation['method'], url: string, data?: any): QueuedMutation {
  const entry: QueuedMutation = { id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, method, url, data, createdAt: Date.now() };
  const queue = getQueue();
  queue.push(entry);
  saveQueue(queue);
  notifyQueueChange(); // FIX: the pending-changes counter never updated on queueing
  return entry;
}

export function queueLength(): number {
  return getQueue().length;
}

type FlushListener = (remaining: number) => void;
let flushListeners: FlushListener[] = [];
export function onQueueChange(listener: FlushListener): () => void {
  flushListeners.push(listener);
  listener(queueLength());
  return () => { flushListeners = flushListeners.filter((l) => l !== listener); };
}
function notifyQueueChange() {
  const n = queueLength();
  flushListeners.forEach((l) => l(n));
}

let flushing = false;

/**
 * Replay queued mutations in the order they were made. Stops at the
 * first failure (so a later request that depends on an earlier one - e.g.
 * a payment queued against an order that was itself queued - never runs
 * out of order) and leaves the rest queued for the next attempt.
 */
export async function flushQueue(sendRaw: (m: QueuedMutation) => Promise<any>): Promise<{ synced: number; remaining: number }> {
  if (flushing) return { synced: 0, remaining: queueLength() };
  flushing = true;
  let synced = 0;
  try {
    let queue = getQueue();
    while (queue.length > 0) {
      const next = queue[0];
      try {
        await sendRaw(next);
        queue = queue.slice(1);
        saveQueue(queue);
        notifyQueueChange();
        synced += 1;
      } catch {
        break; // still offline, or this one genuinely fails - stop here
      }
    }
    return { synced, remaining: queue.length };
  } finally {
    flushing = false;
  }
}

export function clearQueueEntry(id: string) {
  saveQueue(getQueue().filter((q) => q.id !== id));
  notifyQueueChange();
}

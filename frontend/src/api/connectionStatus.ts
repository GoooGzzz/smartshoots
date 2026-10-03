type StatusListener = (unreachable: boolean) => void;

// NEW: apiClient.ts lives outside the React tree and has no way to tell
// the UI "hey, the backend just stopped responding" other than the
// per-request error each individual form already handles. That's fine
// for a single failed save, but if the backend process itself dies mid-
// session (crashed, antivirus killed it, disk full, etc.) - or, on the
// Android build, if Wi-Fi to the PC just drops - every request from then
// on fails the same way and the person just sees "Add Client" (or
// Order, or Payment...) silently doing nothing over and over with no
// obvious cause. This lets apiClient broadcast that state so a single,
// persistent, honest banner can explain it, and so the offline mutation
// queue knows the exact moment it's safe to try flushing again.
let listeners: StatusListener[] = [];
let currentlyUnreachable = false;
let flushHandler: (() => Promise<{ synced: number; remaining: number }>) | null = null;

export function registerFlushHandler(handler: () => Promise<{ synced: number; remaining: number }>) {
  flushHandler = handler;
}

export function reportBackendUnreachable(unreachable: boolean) {
  const wasUnreachable = currentlyUnreachable;
  currentlyUnreachable = unreachable;
  if (unreachable !== wasUnreachable) {
    listeners.forEach((l) => l(unreachable));
  }
  // Came back online (or a request just succeeded while some mutations
  // were still queued from an earlier outage) - try to flush.
  if (!unreachable && flushHandler) {
    flushHandler().catch(() => { /* will retry on the next successful request */ });
  }
}

export function subscribeBackendStatus(listener: StatusListener): () => void {
  listeners.push(listener);
  listener(currentlyUnreachable);
  return () => { listeners = listeners.filter((l) => l !== listener); };
}

export function isBackendUnreachable(): boolean {
  return currentlyUnreachable;
}

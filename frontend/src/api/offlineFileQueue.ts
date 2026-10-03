// NEW: file-carrying requests (Report Drafts upload, client/order photo
// attachments, anything sent as FormData) used to be flatly rejected
// while offline - "uploads need a connection, try again" - even though
// everything else in the app gets queued and replayed automatically.
// That's a real gap for a business that works on-site with unreliable
// venue Wi-Fi: the photo/report taken right now has to wait for the
// person to remember to redo it later.
//
// This closes that gap using IndexedDB rather than localStorage:
// localStorage (used for the JSON queue in offlineQueue.ts) cannot hold
// binary data at all without lossy/bloated base64 encoding, and has a
// small (~5-10MB) quota - hopeless for real photos. IndexedDB stores
// actual Blobs natively, and its quota scales with real device storage
// (hundreds of MB to GBs), which is what "utilizing device storage" for
// files actually requires. This works identically in a browser tab and
// inside the Capacitor/Android WebView used for the APK - both are
// standard IndexedDB implementations.

const DB_NAME = 'smartshoots-offline';
const DB_VERSION = 1;
const STORE = 'file-queue';

export interface QueuedFile {
  field: string;
  blob: Blob;
  filename: string;
  type: string;
}

export interface QueuedFileMutation {
  id: string;
  method: 'post' | 'put' | 'patch';
  url: string;
  fields: Record<string, string>;
  files: QueuedFile[];
  createdAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; } // very old WebView - degrade gracefully
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // private-browsing mode etc. - queueing this file just won't happen
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): { store: IDBObjectStore; transaction: IDBTransaction } {
  const transaction = db.transaction(STORE, mode);
  return { store: transaction.objectStore(STORE), transaction };
}

export async function enqueueFileMutation(method: 'post' | 'put' | 'patch', url: string, formData: FormData): Promise<QueuedFileMutation | null> {
  const db = await openDb();
  if (!db) return null;

  const fields: Record<string, string> = {};
  const files: QueuedFile[] = [];
  formData.forEach((value, key) => {
    if (value instanceof Blob) {
      files.push({ field: key, blob: value, filename: (value as File).name || 'upload', type: value.type || 'application/octet-stream' });
    } else {
      fields[key] = String(value);
    }
  });

  const entry: QueuedFileMutation = {
    id: `filequeue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method, url, fields, files, createdAt: Date.now(),
  };

  await new Promise((resolve, reject) => {
    const { store, transaction } = tx(db, 'readwrite');
    store.put(entry);
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  notifyChange();
  return entry;
}

export async function listFileQueue(): Promise<QueuedFileMutation[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const req = tx(db, 'readonly').store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); resolve([]); };
  });
}

export async function removeFileQueueItem(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const { store, transaction } = tx(db, 'readwrite');
    store.delete(id);
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => resolve(undefined);
  });
  db.close();
  notifyChange();
}

export async function fileQueueLength(): Promise<number> {
  return (await listFileQueue()).length;
}

type Listener = (count: number) => void;
let listeners: Listener[] = [];
export function onFileQueueChange(listener: Listener): () => void {
  listeners.push(listener);
  fileQueueLength().then(listener);
  return () => { listeners = listeners.filter((l) => l !== listener); };
}
function notifyChange() {
  fileQueueLength().then((n) => listeners.forEach((l) => l(n)));
}

/** Rebuild a real FormData from a queued entry, for replay once back online. */
export function toFormData(entry: QueuedFileMutation): FormData {
  const fd = new FormData();
  Object.entries(entry.fields).forEach(([k, v]) => fd.append(k, v));
  entry.files.forEach((f) => fd.append(f.field, new File([f.blob], f.filename, { type: f.type })));
  return fd;
}

let flushing = false;

/** Same "stop at first failure" behavior as the JSON queue (offlineQueue.ts), for the same reason: preserve request order. */
export async function flushFileQueue(sendRaw: (m: QueuedFileMutation) => Promise<any>): Promise<{ synced: number; remaining: number }> {
  if (flushing) return { synced: 0, remaining: await fileQueueLength() };
  flushing = true;
  let synced = 0;
  try {
    let queue = await listFileQueue();
    queue.sort((a, b) => a.createdAt - b.createdAt);
    while (queue.length > 0) {
      const next = queue[0];
      try {
        await sendRaw(next);
        await removeFileQueueItem(next.id);
        queue = queue.slice(1);
        synced += 1;
      } catch {
        break; // still offline, or this one genuinely fails - stop, keep order
      }
    }
    return { synced, remaining: queue.length };
  } finally {
    flushing = false;
  }
}

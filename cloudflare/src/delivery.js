import {guestAuthenticate,guestLogin,guestLogout,guestRoute,guestMaintenance} from './guest-sharing.js';
import { fail, digest, passwordHash, verifyPassword } from './core.js';
const CHUNK = 8 * 1024 * 1024, MAX_SIZE = 20 * 1024 ** 3;
const sql = (env, query, ...args) => env.DB.prepare(query).bind(...args);
const first = (env, query, ...args) => sql(env, query, ...args).first();
const rows = async (env, query, ...args) => (await sql(env, query, ...args).all()).results;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...headers } });
const cookie = token => `ss_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${token ? 86400 : 0}`;
const rawToken = req => req.headers.get('Authorization')?.match(/^(?:Token|Bearer) (.+)$/)?.[1] || req.headers.get('Cookie')?.match(/(?:^|;\s*)ss_session=([^;]+)/)?.[1];
const view = u => ({ id: u.id, role: 'client', username: u.username, first_name: u.name, client_id: u.client_id });
export async function deliveryAuthenticate(req, env) {
 const token = rawToken(req); if (!token) return null;
 const u = await first(env, `SELECT a.id,a.username,a.client_id,c.name FROM delivery_sessions s JOIN delivery_access a ON a.id=s.access_id JOIN accounts_client c ON c.id=a.client_id WHERE s.token_hash=? AND s.expires_at>? AND a.is_active=1 AND c.is_active=1`, await digest(token), Date.now());
 return u ? view(u) : await guestAuthenticate(req, env);
}
export async function deliveryLogin(env, username, password) {
 const u = await first(env, `SELECT a.*,c.name FROM delivery_access a JOIN accounts_client c ON c.id=a.client_id WHERE a.username=? AND a.is_active=1 AND c.is_active=1`, username);
 if (!u) { const guest=await guestLogin(env,username,password); if(guest)return guest; }
 if (!await verifyPassword(password, u?.password || await passwordHash('dummy-password')) || !u) fail(400, 'Unable to log in with provided credentials');
 const token = crypto.randomUUID() + crypto.randomUUID();
 await sql(env, 'INSERT INTO delivery_sessions VALUES (?,?,?)', await digest(token), u.id, Date.now() + 86400000).run();
 return json({ token, user: view(u) }, 200, { 'Set-Cookie': cookie(token) });
}
function admin(user) { if (!['owner', 'admin'].includes(user.role)) fail(403, 'Administrator access required'); }
async function body(req) { try { return await req.json(); } catch { fail(400, 'Invalid JSON'); } }
function text(value, max) { return String(value || '').trim().slice(0, max); }
function publicRecording(r) { return { id: r.id, client_id: r.client_id, title: r.title, filename: r.filename, content_type: r.content_type, size: r.size, status: r.status, created_at: r.created_at, shared: !!r.shared }; }
async function recording(env, id) { const r = await first(env, 'SELECT * FROM delivery_recordings WHERE id=?', id); if (!r || r.status === 'deleted') fail(404, 'Recording not found'); return r; }
export async function deliveryRoute(req, env, user) {
 const url = new URL(req.url), path = url.pathname.replace(/\/+$/, ''), method = req.method;
 if (user.role === 'client') {
  if (path === '/api/accounts/auth/me' && method === 'GET') return json(user);
  if (path === '/api/accounts/auth/logout' && method === 'POST') { if(user.audience==='shared')await guestLogout(req,env); await sql(env, 'DELETE FROM delivery_sessions WHERE token_hash=?', await digest(rawToken(req))).run(); return json({ status: 'logged_out' }, 200, { 'Set-Cookie': cookie('') }); }
  if (!path.startsWith('/api/delivery/')) fail(403, 'Client accounts can only access their recordings');
 }
 if (path === '/api/delivery/recordings' && method === 'GET') {
  if (user.role !== 'client') admin(user);
  if(user.audience==='shared'||user.role!=='client'&&url.searchParams.get('shared')==='1'){
   const list=await rows(env,"SELECT *,1 AS shared FROM delivery_recordings WHERE status='ready' AND id NOT IN (SELECT asset_id FROM delivery_variants) AND id IN (SELECT recording_id FROM delivery_guest_recordings) ORDER BY created_at DESC");
   return json({results:list.map(r=>{const v=publicRecording(r);if(user.audience==='shared')delete v.client_id;return v;})});
  }
  const client = user.role === 'client' ? user.client_id : Number(url.searchParams.get('client'));
  if (!Number.isSafeInteger(client) || client <= 0) fail(400, 'Select a client');
  const list = await rows(env, `SELECT *,EXISTS(SELECT 1 FROM delivery_guest_recordings g WHERE g.recording_id=delivery_recordings.id) AS shared FROM delivery_recordings WHERE client_id=? AND id NOT IN (SELECT asset_id FROM delivery_variants) AND ${user.role === 'client' ? "status='ready'" : "status IN ('ready','hidden')"} ORDER BY created_at DESC`, client);
  return json({ results: list.map(publicRecording) });
 }
 const media = path.match(/^\/api\/delivery\/recordings\/([^/]+)\/file$/);
 if (media && ['GET', 'HEAD'].includes(method)) {
  if (user.role !== 'client') admin(user);
  const r = await recording(env, media[1]);
  if(user.role==='client'&&await first(env,'SELECT asset_id FROM delivery_variants WHERE asset_id=?',r.id))fail(404,'Use the parent recording download choices');
  const guestAllowed=user.audience==='shared'&&r.status==='ready'&&await first(env,'SELECT recording_id FROM delivery_guest_recordings WHERE recording_id=?',r.id);
  if (!['ready', 'hidden'].includes(r.status) || user.role === 'client' && (user.audience==='shared' ? !guestAllowed : r.client_id !== user.client_id || r.status !== 'ready')) fail(404, 'Recording not found');
  const h = new Headers({ 'Content-Type': r.content_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Content-Disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="recording.${r.content_type === 'video/mp4' ? 'mp4' : 'webm'}"; filename*=UTF-8''${encodeURIComponent(r.filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` });
  const range = req.headers.get('Range'); let offset = 0, length = r.size, status = 200;
  if (range) {
   const match = /^bytes=(\d*)-(\d*)$/.exec(range);
   if (!match || !match[1] && !match[2]) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${r.size}`, 'Cache-Control': 'no-store' } });
   offset = match[1] ? Number(match[1]) : Math.max(0, r.size - Number(match[2]));
   const end = match[1] ? match[2] ? Math.min(Number(match[2]), r.size - 1) : r.size - 1 : r.size - 1;
   if (!Number.isSafeInteger(offset) || offset >= r.size || end < offset || !Number.isSafeInteger(end)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${r.size}`, 'Cache-Control': 'no-store' } });
   length = end - offset + 1; status = 206; h.set('Content-Range', `bytes ${offset}-${end}/${r.size}`);
  }
  h.set('Content-Length', String(length));
  const object = method === 'HEAD' ? await env.FILES.head(r.object_key) : await env.FILES.get(r.object_key, range ? { range: { offset, length } } : undefined);
  if (!object) fail(404, 'Recording file unavailable');
  if(method==='GET'&&url.searchParams.has('download')&&!range)await sql(env,'INSERT INTO delivery_activity VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),r.id,String(user.id),user.first_name||user.username||'Studio','download','original',new Date().toISOString()).run();
  return new Response(method === 'HEAD' ? null : object.body, { status, headers: h });
 }
 if (!path.startsWith('/api/delivery/')) return null;
 admin(user);
 const guestResponse=await guestRoute(req,env,user);if(guestResponse)return guestResponse;
 if (path === '/api/delivery/access' && method === 'GET') {
  const a = await first(env, 'SELECT id,client_id,username,is_active,updated_at FROM delivery_access WHERE client_id=?', Number(url.searchParams.get('client')));
  return json(a);
 }
 if (path === '/api/delivery/access' && method === 'POST') {
  const b = await body(req), client = Number(b.client_id), username = text(b.username, 150);
  if (!await first(env, 'SELECT id FROM accounts_client WHERE id=?', client)) fail(404, 'Client not found');
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username)) fail(400, 'Use 3–80 letters, digits, dots, underscores or hyphens for username');
  if (await first(env, 'SELECT id FROM delivery_guest_access WHERE username=?', username) || await first(env, 'SELECT id FROM accounts_user WHERE username=?', username)) fail(409, 'Username is already used by a studio account');
  const old = await first(env, 'SELECT * FROM delivery_access WHERE client_id=?', client);
  if (!old && String(b.password || '').length < 12 || b.password && (String(b.password).length < 12 || String(b.password).length > 128)) fail(400, 'Password must have 12–128 characters');
  const hash = b.password ? await passwordHash(String(b.password)) : old.password, id = old?.id || crypto.randomUUID();
  await env.DB.batch([sql(env, `INSERT INTO delivery_access VALUES (?,?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET username=excluded.username,password=excluded.password,is_active=excluded.is_active,updated_at=excluded.updated_at`, id, client, username, hash, b.is_active === false ? 0 : 1, new Date().toISOString()), sql(env, 'DELETE FROM delivery_sessions WHERE access_id=?', id)]);
  return json({ username, client_id: client, is_active: b.is_active !== false });
 }
 if (path === '/api/delivery/uploads' && method === 'POST') {
  const b = await body(req), client = Number(b.client_id), size = Number(b.size), filename = text(b.filename, 200).replace(/[\r\n\x00]/g, ''), title = text(b.title, 200);
  if (!await first(env, 'SELECT id FROM accounts_client WHERE id=?', client)) fail(404, 'Client not found');
  if (!title || !filename || !['video/mp4', 'video/webm','audio/mpeg','audio/mp4','audio/wav','audio/webm'].includes(b.content_type) || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE) fail(400, 'Choose MP4/WebM or audio up to 20 GiB and enter its title');
  if ((await first(env, "SELECT COUNT(*) n FROM delivery_recordings WHERE created_by=? AND status='uploading'", user.id)).n >= 5) fail(409, 'Cancel unfinished uploads before starting more');
  const id = crypto.randomUUID(), key = `delivery/${client}/${id}`, upload = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: b.content_type } });
  try { await sql(env, 'INSERT INTO delivery_recordings VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, client, title, filename, b.content_type, size, key, upload.uploadId, 'uploading', user.id, new Date().toISOString()).run(); } catch (e) { await upload.abort(); throw e; }
  return json({ id, chunk_size: CHUNK }, 201);
 }
 const uploadMatch = path.match(/^\/api\/delivery\/uploads\/([^/]+)(?:\/(parts\/\d+|complete))?$/);
 if (uploadMatch) {
  const r = await recording(env, uploadMatch[1]);
  if (r.created_by !== user.id) fail(403, 'Only the uploading administrator can complete or cancel this upload');
  if (uploadMatch[2] === 'complete' && method === 'POST' && r.status === 'ready') return json(publicRecording(r));
  if (r.status !== 'uploading') fail(409, 'Upload is no longer active');
  const upload = env.FILES.resumeMultipartUpload(r.object_key, r.upload_id);
  if (uploadMatch[2]?.startsWith('parts/') && method === 'PUT') {
   const n = Number(uploadMatch[2].split('/')[1]), count = Math.ceil(r.size / CHUNK), expected = n === count ? r.size - CHUNK * (count - 1) : CHUNK;
   if (n < 1 || n > count) fail(400, 'Invalid upload part');
   // A bounded buffer validates actual size before passing the chunk to R2.
   const reader = req.body?.getReader(); if (!reader) fail(400, 'Upload part is empty');
   const chunks = []; let size = 0;
   for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > expected) { await reader.cancel(); fail(413, 'Upload part exceeds expected size'); } chunks.push(value); }
   if (size !== expected) fail(400, 'Upload part has incorrect size');
   const part = await upload.uploadPart(n, await new Blob(chunks).arrayBuffer());
   await sql(env, 'INSERT INTO delivery_parts VALUES (?,?,?,?) ON CONFLICT(recording_id,part_number) DO UPDATE SET etag=excluded.etag,size=excluded.size', r.id, n, part.etag, size).run();
   return json({ part_number: n });
  }
  if (uploadMatch[2] === 'complete' && method === 'POST') {
   const parts = await rows(env, 'SELECT part_number,etag,size FROM delivery_parts WHERE recording_id=? ORDER BY part_number', r.id);
   if (parts.length !== Math.ceil(r.size / CHUNK) || parts.reduce((n, p) => n + p.size, 0) !== r.size) fail(409, 'Upload is incomplete');
   // HEAD allows retry after R2 completed but the D1 update failed.
   let object = await env.FILES.head(r.object_key);
   if (!object) object = await upload.complete(parts.map(p => ({ partNumber: p.part_number, etag: p.etag })));
   if (object.size !== r.size) fail(409, 'Stored video size does not match');
   await env.DB.batch([sql(env, "UPDATE delivery_recordings SET status='ready',upload_id=NULL WHERE id=? AND status='uploading'", r.id), sql(env, 'DELETE FROM delivery_parts WHERE recording_id=?', r.id)]);
   await sql(env,'INSERT INTO studio_outbox(id,dedupe,client_id,subject,message,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(dedupe) DO NOTHING',crypto.randomUUID(),'ready:'+r.id,r.client_id,'Your recording is ready','Your recording '+r.title+' is ready. Sign in at https://smartshoots.uk/login .',new Date().toISOString()).run();
   return json(publicRecording({ ...r, status: 'ready' }));
  }
  if (!uploadMatch[2] && method === 'DELETE') { await upload.abort(); await env.FILES.delete(r.object_key); await sql(env, 'DELETE FROM delivery_recordings WHERE id=?', r.id).run(); return new Response(null, { status: 204 }); }
 }
 const change = path.match(/^\/api\/delivery\/recordings\/([^/]+)$/);
 if (change && ['PATCH', 'DELETE'].includes(method)) {
  const r = await recording(env, change[1]); if (!['ready', 'hidden'].includes(r.status)) fail(409, 'Finish or cancel the upload first');
  if (method === 'DELETE') { await sql(env, "UPDATE delivery_recordings SET status='deleted' WHERE id=?", r.id).run(); await env.FILES.delete(r.object_key); return new Response(null, { status: 204 }); }
  const b = await body(req); if (!['ready', 'hidden'].includes(b.status)) fail(400, 'Invalid recording status');
  await sql(env, 'UPDATE delivery_recordings SET status=? WHERE id=?', b.status, r.id).run(); return json(publicRecording({ ...r, status: b.status }));
 }
 if (path === '/api/delivery/pending' && method === 'GET') return json({ results: await rows(env, "SELECT id,title,client_id,created_at FROM delivery_recordings WHERE created_by=? AND status='uploading'", user.id) });
 fail(404, 'Delivery endpoint not found');
}
export async function deliveryMaintenance(env) {
 await guestMaintenance(env);
 await sql(env, 'DELETE FROM delivery_sessions WHERE expires_at<?', Date.now()).run();
 const stale = await rows(env, "SELECT * FROM delivery_recordings WHERE status='uploading' AND created_at<? LIMIT 20", new Date(Date.now() - 86400000).toISOString());
 for (const r of stale) { await env.FILES.resumeMultipartUpload(r.object_key, r.upload_id).abort(); await env.FILES.delete(r.object_key); await sql(env, 'DELETE FROM delivery_recordings WHERE id=?', r.id).run(); }
 const removed = await rows(env, "SELECT * FROM delivery_recordings WHERE status='deleted' LIMIT 20");
 for (const r of removed) { await env.FILES.delete(r.object_key); await sql(env, 'DELETE FROM delivery_recordings WHERE id=?', r.id).run(); }
 const access = await rows(env, 'SELECT * FROM delivery_access'), recordings = await rows(env, "SELECT * FROM delivery_recordings WHERE status IN ('ready','hidden')");
 await env.FILES.put('backups/client-delivery-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify({ access, recordings, guest_access:await rows(env,'SELECT * FROM delivery_guest_access'), guest_recordings:await rows(env,'SELECT * FROM delivery_guest_recordings') }), { httpMetadata: { contentType: 'application/json' } });
}

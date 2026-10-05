import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase, runStatements } from './native-sqlite.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/worker.js';
import { deliveryMaintenance } from '../src/delivery.js';
test('private client delivery: chunked upload, isolation, ranges, reset, revoke and cleanup', async () => {
 const dir = mkdtempSync(join(tmpdir(), 'ss-delivery-')), db = join(dir, 'db'); initializeDatabase(db);
 class Statement { constructor(query, args=[]) { this.query=query;this.args=args; } bind(...args) { return new Statement(this.query,args); } async run(){return runStatements(db,[this])[0];} async all(){return this.run();} async first(){return (await this.run()).results[0]||null;} }
 const objects=new Map(), uploads=new Map();
 const multipart=(key,id)=>({uploadId:id, async uploadPart(partNumber,data){const u=uploads.get(id);if(!u)throw Error('No upload');const etag='etag-'+partNumber;u.parts.set(partNumber,{data:Buffer.from(data),etag});return {partNumber,etag};},async complete(parts){const u=uploads.get(id);assert.ok(u);const data=Buffer.concat(parts.map(p=>{assert.equal(u.parts.get(p.partNumber).etag,p.etag);return u.parts.get(p.partNumber).data;}));objects.set(key,data);uploads.delete(id);return {size:data.length};},async abort(){uploads.delete(id);}});
 const env={BOOTSTRAP_TOKEN:'setup-test',DB:{prepare:q=>new Statement(q),batch:async ss=>runStatements(db,ss)},ASSETS:{fetch:()=>new Response('SPA')},FILES:{async createMultipartUpload(key){const id=crypto.randomUUID();uploads.set(id,{parts:new Map()});return multipart(key,id);},resumeMultipartUpload:multipart,async head(key){const b=objects.get(key);return b?{size:b.length}:null;},async get(key,options){const b=objects.get(key);if(!b)return null;return {body:options?.range?b.subarray(options.range.offset,options.range.offset+options.range.length):b,writeHttpMetadata(){}};},async put(key,data){objects.set(key,Buffer.from(await new Response(data).arrayBuffer()));},async delete(key){objects.delete(key);}}};
 let token='';
 async function request(path,method='GET',data,expected=200,extra={}){const binary=data instanceof Uint8Array;const r=await worker.fetch(new Request('https://studio.example'+path,{method,headers:{Authorization:'Token '+token,...(data!==undefined?{'Content-Type':binary?'application/octet-stream':'application/json'}:{}),...extra},body:data===undefined?undefined:binary?data:JSON.stringify(data)}),env);const content=await r.text();assert.equal(r.status,expected,content);return {r,data:content&&r.headers.get('Content-Type')?.includes('json')?JSON.parse(content):content};}
 const api=(path,...args)=>request('/api/'+path,...args);
 try {
  await api('setup','POST',{username:'admin',password:'long-admin-password'},201,{Authorization:'Bearer setup-test'});
  const owner=(await api('accounts/auth/login','POST',{username:'admin',password:'long-admin-password'})).data.token;token=owner;
  const a=(await api('accounts/clients','POST',{name:'Doctor Alpha',primary_phone:'01012345678'},201)).data;
  const b=(await api('accounts/clients','POST',{name:'Doctor Beta',primary_phone:'01112345678'},201)).data;
  for(const [c,username] of [[a,'doctor-a'],[b,'doctor-b']])await api('delivery/access','POST',{client_id:c.id,username,password:'private-client-password'});
  await api('delivery/access','POST',{client_id:a.id,username:'admin',password:'private-client-password'},409);
  const CHUNK=8*1024*1024, video=Buffer.alloc(CHUNK+3,65);video.write('XYZ',CHUNK);
  const init=(await api('delivery/uploads','POST',{client_id:a.id,title:'Lecture one',filename:'محاضرة.mp4',content_type:'video/mp4',size:video.length},201)).data;
  await api(`delivery/uploads/${init.id}/complete`,'POST',{},409);
  await api(`delivery/uploads/${init.id}/parts/0`,'PUT',Buffer.from('bad'),400);
  await api(`delivery/uploads/${init.id}/parts/1`,'PUT',Buffer.from('bad'),400);
  await api(`delivery/uploads/${init.id}/parts/1`,'PUT',video.subarray(0,CHUNK));
  await api(`delivery/uploads/${init.id}/parts/1`,'PUT',video.subarray(0,CHUNK)); // retry safely replaces the same part
  await api(`delivery/uploads/${init.id}/parts/2`,'PUT',video.subarray(CHUNK));
  await api(`delivery/uploads/${init.id}/complete`,'POST',{});
  await api(`delivery/uploads/${init.id}/complete`,'POST',{}); // idempotent finalization
  token=(await api('accounts/auth/login','POST',{username:'doctor-a',password:'private-client-password'})).data.token;
  const clientToken=token;
  await api(`delivery/recordings/${init.id}/file`,'HEAD',undefined,200,{Authorization:'',Cookie:'ss_session='+clientToken});
  assert.equal((await api('accounts/auth/me')).data.role,'client');
  assert.equal((await api('delivery/recordings?client='+b.id)).data.results.length,1); // query cannot change scope
  for(const path of ['accounts/clients','accounts/users','reports/dashboard','finance/backup','notifications','production/orders'])await api(path,'GET',undefined,403);
  await api('delivery/access','POST',{client_id:b.id,username:'evil',password:'private-client-password'},403);
  await api('delivery/uploads','POST',{},403);
  const ranged=await api(`delivery/recordings/${init.id}/file`,'GET',undefined,206,{Range:`bytes=${CHUNK}-${CHUNK+2}`});assert.equal(ranged.data,'XYZ');assert.equal(ranged.r.headers.get('Content-Range'),`bytes ${CHUNK}-${CHUNK+2}/${video.length}`);
  const suffix=await api(`delivery/recordings/${init.id}/file`,'GET',undefined,206,{Range:'bytes=-3'});assert.equal(suffix.data,'XYZ');
  await api(`delivery/recordings/${init.id}/file`,'GET',undefined,416,{Range:'bytes=99999999999-'});
  const download=await api(`delivery/recordings/${init.id}/file?download=1`,'HEAD');assert.ok(download.r.headers.get('Content-Disposition').startsWith('attachment'));assert.equal(download.r.headers.get('Cache-Control'),'private, no-store');
  token=(await api('accounts/auth/login','POST',{username:'doctor-b',password:'private-client-password'})).data.token;
  assert.equal((await api('delivery/recordings')).data.results.length,0);
  await api(`delivery/recordings/${init.id}/file`,'GET',undefined,404);
  token='';await api(`delivery/recordings/${init.id}/file`,'GET',undefined,401);
  token=owner;await api(`delivery/recordings/${init.id}`,'PATCH',{status:'hidden'});token=clientToken;assert.equal((await api('delivery/recordings')).data.results.length,0);await api(`delivery/recordings/${init.id}/file`,'GET',undefined,404);
  token=owner;await api(`delivery/recordings/${init.id}`,'PATCH',{status:'ready'});
  await api('delivery/access','POST',{client_id:a.id,username:'doctor-a',password:'new-private-password'});token=clientToken;await api('delivery/recordings','GET',undefined,401);
  token='';await api('accounts/auth/login','POST',{username:'doctor-a',password:'private-client-password'},400);
  token=(await api('accounts/auth/login','POST',{username:'doctor-a',password:'new-private-password'})).data.token;
  await api('accounts/auth/logout','POST',{});await api('delivery/recordings','GET',undefined,401);
  token=owner;await api('delivery/access','POST',{client_id:a.id,username:'doctor-a',is_active:false});token='';await api('accounts/auth/login','POST',{username:'doctor-a',password:'new-private-password'},400);
  token=owner;await api('delivery/access','POST',{client_id:a.id,username:'doctor-a',is_active:true});
  // Private legacy attachments must also reject portal credentials.
  const attachmentForm=new FormData();attachmentForm.append('file',new Blob(['private file']),'file.txt');
  const attached=await worker.fetch(new Request('https://studio.example/api/finance/attachments',{method:'POST',headers:{Authorization:'Token '+owner},body:attachmentForm}),env);assert.equal(attached.status,201,await attached.clone().text());const attachment=await attached.json();
  token=(await api('accounts/auth/login','POST',{username:'doctor-a',password:'new-private-password'})).data.token;
  await request('/files/attachment/'+attachment.share_token,'GET',undefined,403);
  token=owner;
  const incomplete=(await api('delivery/uploads','POST',{client_id:b.id,title:'Unfinished',filename:'x.mp4',content_type:'video/mp4',size:3},201)).data;
  await api(`delivery/uploads/${incomplete.id}`,'DELETE',undefined,204);assert.equal(uploads.size,0);
  const stale=(await api('delivery/uploads','POST',{client_id:b.id,title:'Stale',filename:'x.mp4',content_type:'video/mp4',size:3},201)).data;
  await sqlUpdate("UPDATE delivery_recordings SET created_at='2020-01-01' WHERE id=?",stale.id);
  await deliveryMaintenance(env);assert.equal(uploads.size,0);assert.ok([...objects.keys()].some(k=>k.startsWith('backups/client-delivery-')));
  await api(`delivery/recordings/${init.id}`,'DELETE',undefined,204);assert.ok(![...objects.keys()].some(k=>k.startsWith('delivery/')));
  await api('delivery/access','POST',{client_id:b.id,username:'doctor-b',password:'short'},400);
  await api('delivery/access','POST',{client_id:b.id,username:'doctor-b',is_active:false},403,{Origin:'https://evil.example'});
 } finally { rmSync(dir,{recursive:true,force:true}); }
 async function sqlUpdate(q,...args){await env.DB.prepare(q).bind(...args).run();}
});

import { fail, digest, passwordHash, verifyPassword } from './core.js';
const sql=(env,query,...args)=>env.DB.prepare(query).bind(...args);
const first=(env,query,...args)=>sql(env,query,...args).first();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store',...headers}});
const rawToken=req=>req.headers.get('Authorization')?.match(/^(?:Token|Bearer) (.+)$/)?.[1]||req.headers.get('Cookie')?.match(/(?:^|;\s*)ss_session=([^;]+)/)?.[1];
export async function guestAuthenticate(req,env){
 const token=rawToken(req);if(!token)return null;
 const a=await first(env,'SELECT a.username FROM delivery_guest_access a JOIN delivery_guest_sessions s ON a.id=1 WHERE s.token_hash=? AND s.expires_at>? AND a.is_active=1',await digest(token),Date.now());
 return a?{id:'shared-guests',role:'client',audience:'shared',username:a.username,first_name:'Guests'}:null;
}
export async function guestLogin(env,username,password){
 const a=await first(env,'SELECT * FROM delivery_guest_access WHERE username=? AND is_active=1',username);
 if(!a||!await verifyPassword(password,a.password))return null;
 const token=crypto.randomUUID()+crypto.randomUUID();
 await sql(env,'INSERT INTO delivery_guest_sessions VALUES (?,?)',await digest(token),Date.now()+86400000).run();
 return json({token,user:{id:'shared-guests',role:'client',audience:'shared',username:a.username,first_name:'Guests'}},200,{'Set-Cookie':`ss_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`});
}
export async function guestLogout(req,env){await sql(env,'DELETE FROM delivery_guest_sessions WHERE token_hash=?',await digest(rawToken(req))).run();}
export async function guestRoute(req,env,user){
 const url=new URL(req.url),path=url.pathname.replace(/\/+$/,''),method=req.method;
 if(path!='/api/delivery/guest-access'&&!/^\/api\/delivery\/recordings\/[^/]+\/shared$/.test(path))return null;
 if(!['owner','admin'].includes(user.role))fail(403,'Administrator access required');
 if(path==='/api/delivery/guest-access'){
  if(method==='GET')return json(await first(env,'SELECT username,is_active,updated_at FROM delivery_guest_access WHERE id=1'));
  if(method==='POST'){
   let b;try{b=await req.json();}catch{fail(400,'Invalid JSON');}
   const username=String(b.username||'').trim();
   if(!/^[A-Za-z0-9._-]{3,80}$/.test(username))fail(400,'Use 3–80 letters, digits, dots, underscores or hyphens for username');
   if(await first(env,'SELECT id FROM accounts_user WHERE username=?',username)||await first(env,'SELECT id FROM delivery_access WHERE username=?',username))fail(409,'Username is already used by a studio or client account');
   const old=await first(env,'SELECT * FROM delivery_guest_access WHERE id=1');
   if(!old&&String(b.password||'').length<12||b.password&&(String(b.password).length<12||String(b.password).length>128))fail(400,'Password must have 12–128 characters');
   const hash=b.password?await passwordHash(String(b.password)):old.password;
   await env.DB.batch([sql(env,'INSERT INTO delivery_guest_access VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password=excluded.password,is_active=excluded.is_active,updated_at=excluded.updated_at',username,hash,b.is_active===false?0:1,new Date().toISOString()),sql(env,'DELETE FROM delivery_guest_sessions')]);
   return json({username,is_active:b.is_active!==false});
  }
  fail(405,'Method not allowed');
 }
 const id=path.split('/')[4],r=await first(env,'SELECT id,status FROM delivery_recordings WHERE id=?',id);
 if(!r||!['ready','hidden'].includes(r.status))fail(404,'Recording not found');
 if(method==='POST'){
  await sql(env,'INSERT INTO delivery_guest_recordings VALUES (?,?,?) ON CONFLICT(recording_id) DO NOTHING',id,user.id,new Date().toISOString()).run();
  return json({shared:true});
 }
 if(method==='DELETE'){await sql(env,'DELETE FROM delivery_guest_recordings WHERE recording_id=?',id).run();return new Response(null,{status:204});}
 fail(405,'Method not allowed');
}
export async function guestMaintenance(env){await sql(env,'DELETE FROM delivery_guest_sessions WHERE expires_at<?',Date.now()).run();}

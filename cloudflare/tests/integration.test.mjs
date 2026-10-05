import {test} from 'node:test';import assert from 'node:assert/strict';import {initializeDatabase,runStatements} from './native-sqlite.mjs';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import worker from '../src/worker.js';
const dir=mkdtempSync(join(tmpdir(),'smartshoots-')),db=join(dir,'test.sqlite');let activeDb=db;
initializeDatabase(db);
function run(statements){return runStatements(activeDb,statements);}
class Statement{constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Statement(this.query,args)}async run(){return run([this])[0]}async all(){return this.run()}async first(){return (await this.run()).results[0]||null;}}
const objects=new Map();const env={DB:{prepare:q=>new Statement(q),batch:async ss=>run(ss)},FILES:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{body:objects.get(k),writeHttpMetadata:()=>{}}:null,delete:async k=>objects.delete(k)},ASSETS:{fetch:()=>new Response('SPA')},BOOTSTRAP_TOKEN:'test-bootstrap-token'};let token='';
async function call(path,method='GET',data,expected=200){const res=await worker.fetch(new Request('https://studio.example/api/'+path,{method,headers:{...(data instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Token '+token},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)}),env);const b=await res.json();assert.equal(res.status,expected,JSON.stringify(b));return b;}
test('cloud login, business workflow, financial integrity, bookings, uploads and restore',async()=>{try{
 const setup=await worker.fetch(new Request('https://studio.example/api/setup',{method:'POST',headers:{Authorization:'Bearer test-bootstrap-token','Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'secure-test-password'})}),env);assert.equal(setup.status,201,await setup.text());
 token=(await call('accounts/auth/login/','POST',{username:'admin',password:'secure-test-password'})).token;
 const c=await call('accounts/clients/','POST',{name:'أحمد جودة',primary_phone:'01012345678',tags_input:['Learning']},201);assert.equal(c.tags[0].name,'Learning');
 await call('accounts/clients/','POST',{name:'Test',primary_phone:'123'},400);
 const o=await call('production/orders/','POST',{client:c.id,package:1,quantity:'2.00',rate:'250.00',order_date:'2026-10-05',status:'pending'},201);assert.equal(o.total_amount,'500.00');
 const pay=await call('finance/payments/','POST',{order:o.id,client:c.id,amount:'100.00',payment_date:'2026-10-05',method:'instapay'},201);assert.equal(pay.resulting_balance,'400.00');
 await call('finance/payments/'+pay.id+'/','PATCH',{amount:'150.00'});assert.equal((await call('production/orders/'+o.id+'/')).remaining_balance,'350.00');
 const c2=await call('accounts/clients/','POST',{name:'Other Client',primary_phone:'01112345678'},201);await call('finance/payments/','POST',{order:o.id,client:c2.id,amount:'1',payment_date:'2026-10-05',method:'cash'},409);
 await call('production/orders/'+o.id+'/','PATCH',{paid_amount:'999'});assert.equal((await call('production/orders/'+o.id+'/')).paid_amount,'150.00');
 const a=await call('scheduling/appointments/','POST',{client:c.id,start_time:'2026-10-05T10:00:00Z',end_time:'2026-10-05T11:00:00Z'},201);
 await call('scheduling/appointments/','POST',{client:c.id,start_time:'2026-10-05T11:20:00Z',end_time:'2026-10-05T12:00:00Z'},409);
 const a2=await call('scheduling/appointments/','POST',{client:c.id,start_time:'2026-10-05T12:00:00Z',end_time:'2026-10-05T13:00:00Z'},201);await call('scheduling/appointments/'+a2.id+'/','PATCH',{start_time:'2026-10-05T10:30:00Z'},409);
 await call('scheduling/blocks/','POST',{resource:1,start_time:'2026-10-05T10:00:00Z',end_time:'2026-10-05T11:00:00Z',block_type:'maintenance'},409);
 const dashboard=await call('reports/dashboard/');assert.equal(dashboard.active_clients,2);assert.equal((await call('accounts/clients/'+c.id+'/full_details/')).orders.length,1);
 const form=new FormData();form.set('title','تقرير');form.set('file',new File(['<h1>Report</h1>'],'report.html',{type:'text/html'}));const draft=await call('toolkit/report-drafts/','POST',form,201);assert.ok(draft.public_view_url.startsWith('https://studio.example/r/'));const publicRes=await worker.fetch(new Request(draft.public_view_url),env);assert.equal(publicRes.status,200);assert.ok((await publicRes.text()).includes('sandbox='));
 const staffUser=await call('accounts/users/','POST',{username:'editor',password:'secure-editor-password'},201);const staff=await call('accounts/staff/','POST',{user:staffUser.id,role:'editor',hire_date:'2026-10-05'},201);await call('production/time-logs/','POST',{order:o.id,staff:staff.id,hours:'1.50',work_date:'2026-10-05'},201);
 const b=await call('finance/backup/');assert.ok(b['accounts.client']);assert.equal(b['accounts.user'],undefined);await call('finance/restore/','POST',b,409);
 const deleted=await worker.fetch(new Request('https://studio.example/api/finance/payments/'+pay.id+'/',{method:'DELETE',headers:{Authorization:'Token '+token}}),env);assert.equal(deleted.status,204);assert.equal((await call('production/orders/'+o.id+'/')).remaining_balance,'500.00');

 const originalToken=token;activeDb=join(dir,'import.sqlite');initializeDatabase(activeDb);
 const setup2=await worker.fetch(new Request('https://studio.example/api/setup',{method:'POST',headers:{Authorization:'Bearer test-bootstrap-token','Content-Type':'application/json'},body:JSON.stringify({username:'newadmin',password:'secure-test-password'})}),env);assert.equal(setup2.status,201,await setup2.text());token=(await call('accounts/auth/login/','POST',{username:'newadmin',password:'secure-test-password'})).token;
 const invalid=structuredClone(b);invalid['finance.payment'][0].fields.client=99999;await call('finance/restore/','POST',invalid,409);assert.equal((await call('accounts/clients/')).count,0);
 const restored=await call('finance/restore/','POST',b);assert.equal(restored.staff_accounts,1);assert.equal((await call('accounts/clients/')).count,2);assert.equal((await call('production/orders/'+o.id+'/')).remaining_balance,'350.00');assert.equal((await call('production/time-logs/')).results[0].hours,'1.50');assert.equal((await call('accounts/staff/')).results[0].user.is_active,0);
 activeDb=db;token=originalToken;
 await call('accounts/auth/logout/','POST',{});await call('accounts/clients/', 'GET',undefined,401);
 }finally{rmSync(dir,{recursive:true,force:true});}});

import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
// The installer adjusts this import to the repository worker.
for(const host of ['smartshoots.uk','www.smartshoots.uk'])test('Public homepage on '+host,async()=>{
 let served;const response=await worker.fetch(new Request('https://'+host+'/'),{ASSETS:{fetch:async req=>{served=new URL(req.url).pathname;return new Response('profile');}}});
 assert.equal(response.status,200);assert.equal(served,'/profile/');
});
test('Management homepage stays on workers.dev',async()=>{let served;await worker.fetch(new Request('https://smartshoots.gouda-wise.workers.dev/'),{ASSETS:{fetch:async req=>{served=new URL(req.url).pathname;return new Response('app');}}});assert.equal(served,'/');});
test('Profile preview without authentication',async()=>{let served;await worker.fetch(new Request('https://smartshoots.gouda-wise.workers.dev/profile/'),{ASSETS:{fetch:async req=>{served=new URL(req.url).pathname;return new Response('profile');}}});assert.equal(served,'/profile/');});
test('Login still uses the management app',async()=>{let served;await worker.fetch(new Request('https://smartshoots.uk/login'),{ASSETS:{fetch:async req=>{served=new URL(req.url).pathname;return new Response('app');}}});assert.equal(served,'/login');});

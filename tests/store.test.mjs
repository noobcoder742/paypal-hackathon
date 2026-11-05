import test from 'node:test';import assert from 'node:assert/strict';
import {getStore,resetMemoryStore} from '../server/store.js';
import {checkRate} from '../server/ratelimit.js';
import {assertSandbox} from '../server/env.js';
test('store round-trips values and lists by prefix',async()=>{
 resetMemoryStore();const s=getStore();await s.set('plan:1',{a:1});await s.set('plan:2',{a:2});await s.set('order:x',{b:1});
 assert.deepEqual(await s.get('plan:1'),{a:1});assert.equal((await s.list('plan:')).length,2);assert.equal(await s.get('nope'),null);
});
test('the sixth agent run in an hour is refused',async()=>{
 for(let i=0;i<5;i++)assert.equal((await checkRate('1.2.3.4')).ok,true);
 const r=await checkRate('1.2.3.4');assert.equal(r.ok,false);assert.ok(r.resetSeconds>0);
 assert.equal((await checkRate('5.6.7.8')).ok,true);
});
test('refuses anything but the PayPal sandbox',()=>{
 const old=process.env.PAYPAL_ENV;process.env.PAYPAL_ENV='live';assert.throws(()=>assertSandbox(),/sandbox/);
 process.env.PAYPAL_ENV='sandbox';assertSandbox();if(old===undefined)delete process.env.PAYPAL_ENV;else process.env.PAYPAL_ENV=old;
});
test('cached answers cost a quarter of a run',async()=>{
 for(let i=0;i<20;i++)assert.equal((await checkRate('9.9.9.9',{weight:.25})).ok,true);
 assert.equal((await checkRate('9.9.9.9',{weight:.25})).ok,false);
});

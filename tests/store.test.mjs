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
import {redisConfig} from '../server/store.js';
test('Redis settings: Upstash names, or the KV_REST_API names the Vercel integration adds',()=>{
 const saved={...process.env};
 try{
  for(const k of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'])delete process.env[k];
  assert.equal(redisConfig(),null);
  process.env.KV_REST_API_URL='https://kv.example';process.env.KV_REST_API_TOKEN='t1';
  assert.deepEqual(redisConfig(),{url:'https://kv.example',token:'t1'});
  process.env.UPSTASH_REDIS_REST_URL='https://up.example';process.env.UPSTASH_REDIS_REST_TOKEN='t2';
  assert.deepEqual(redisConfig(),{url:'https://up.example',token:'t2'});
 }finally{process.env=saved}
});

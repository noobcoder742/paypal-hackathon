// When a cell or district is due for download (review: evict/refetch loop on low-memory phones;
// parked map filling the whole island while the studio streams its own).
import test from 'node:test';import assert from 'node:assert/strict';
import {isDue} from '../src/explorer/stream/cityStream.js';
const now=1e6;
test('never loaded: due nearby, and in the background only while filling',()=>{
 assert.ok(isDue(undefined,{near:true,fill:false,now}));
 assert.ok(isDue(undefined,{near:false,fill:true,now}));
 assert.ok(!isDue(undefined,{near:false,fill:false,now}));
});
test('evicted for memory: only due again once it is in range',()=>{
 const c={state:'evicted'};
 assert.ok(!isDue(c,{near:false,fill:true,now}),'far evicted file must not be refetched');
 assert.ok(isDue(c,{near:true,fill:true,now}));
});
test('failed: retried after the back-off, at most 3 times',()=>{
 assert.ok(!isDue({state:'failed',tries:1,retryAt:now+10},{near:true,fill:true,now}));
 assert.ok(isDue({state:'failed',tries:1,retryAt:now-10},{near:true,fill:true,now}));
 assert.ok(!isDue({state:'failed',tries:3,retryAt:0},{near:true,fill:true,now}));
});
test('loading or ready: not due',()=>{
 for(const state of ['loading','ready'])assert.ok(!isDue({state},{near:true,fill:true,now}));
});

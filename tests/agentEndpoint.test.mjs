import test from 'node:test';import assert from 'node:assert/strict';
import {MockLanguageModelV1,simulateReadableStream} from 'ai/test';
import {POST} from '../api/agent.js';
import {setModelFactory} from '../server/models.js';
import {resetMemoryStore,getStore} from '../server/store.js';
import {cacheKey} from '../server/agent/cache.js';
let modelCalls=0;
setModelFactory(async()=>[new MockLanguageModelV1({modelId:'fake',doStream:async()=>{modelCalls++;return {rawCall:{rawPrompt:null,rawSettings:{}},stream:simulateReadableStream({chunks:[{type:'text-delta',textDelta:'Here is a plan.'},{type:'finish',finishReason:'stop',usage:{promptTokens:1,completionTokens:1}}]})}}})]);
const req=(text,{origin='https://demo.example',ip='1.1.1.1',planId='plan-a1b2c3d4'}={})=>new Request('https://demo.example/api/agent',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':ip},body:JSON.stringify({planId,messages:[{role:'user',content:text}]})});
test('other sites are refused',async()=>{resetMemoryStore();assert.equal((await POST(req('hi',{origin:'https://evil.example'}))).status,403)});
test('the sixth model run in an hour is refused',async()=>{
 resetMemoryStore();for(let i=0;i<5;i++){const r=await POST(req('plan number '+i,{ip:'2.2.2.2'}));assert.equal(r.status,200);await r.text()}
 assert.equal((await POST(req('plan number 6',{ip:'2.2.2.2'}))).status,429);
});
test('cache key ignores spacing, case and small budget differences',()=>{
 const k=t=>cacheKey([{role:'user',content:t}]);
 assert.equal(k('30 tables, S$60,000 budget'),k('30 tables,  s$60,400 budget'));
 assert.notEqual(k('30 tables, S$60,000 budget'),k('31 tables, S$60,000 budget'));
});
test('a repeated request is answered from the cache without the model',async()=>{
 resetMemoryStore();modelCalls=0;
 const a=await POST(req('30 tables, S$60,000, garden',{ip:'3.3.3.3'}));const ta=await a.text();
 await new Promise(r=>setTimeout(r,20));
 const b=await POST(req('30 tables,  s$60,200, garden',{ip:'3.3.3.4',planId:'plan-zzzz9999'}));const tb=await b.text();
 assert.equal(modelCalls,1);assert.equal(tb,ta);assert.equal(b.headers.get('x-cache'),'hit');
 void getStore;
});

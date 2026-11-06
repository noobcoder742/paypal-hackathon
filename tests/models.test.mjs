import test from 'node:test';import assert from 'node:assert/strict';
import {MockLanguageModelV1,simulateReadableStream} from 'ai/test';
import {streamText,generateText} from 'ai';
import {fallbackModel} from '../server/models.js';
const textModel=(id,text)=>new MockLanguageModelV1({modelId:id,
 doGenerate:async()=>({rawCall:{rawPrompt:null,rawSettings:{}},finishReason:'stop',usage:{promptTokens:1,completionTokens:1},text}),
 doStream:async()=>({rawCall:{rawPrompt:null,rawSettings:{}},stream:simulateReadableStream({chunks:[{type:'text-delta',textDelta:text},{type:'finish',finishReason:'stop',usage:{promptTokens:1,completionTokens:1}}]})})});
const broken=id=>{let calls=0;const m=new MockLanguageModelV1({modelId:id,doGenerate:async()=>{calls++;throw new Error('overloaded')},doStream:async()=>{calls++;throw new Error('overloaded')}});m.calls=()=>calls;return m};
test('streams from the backup when the primary fails before its first chunk',async()=>{
 const m=fallbackModel([broken('claude'),textModel('gemini','hello from gemini')]);
 const r=streamText({model:m,prompt:'hi'});let out='';for await(const t of r.textStream)out+=t;
 assert.equal(out,'hello from gemini');assert.equal(m.lastModelUsed(),'gemini');
});
test('uses the primary when it works and never calls the backup',async()=>{
 const backup=broken('gemini');const m=fallbackModel([textModel('claude','hello from claude'),backup]);
 const {text}=await generateText({model:m,prompt:'hi'});assert.equal(text,'hello from claude');assert.equal(backup.calls(),0);
});
test('throws when every model fails',async()=>{
 const m=fallbackModel([broken('a'),broken('b')]);await assert.rejects(generateText({model:m,prompt:'hi'}),/overloaded/);
});
test('Gemini fallback uses the auto-updating Flash alias, overridable with GEMINI_MODEL',async()=>{
 const {defaultModels}=await import('../server/models.js');
 const saved={...process.env};delete process.env.ANTHROPIC_API_KEY;delete process.env.AGENT_FAKE;process.env.GOOGLE_GENERATIVE_AI_API_KEY='test-key';
 try{
  delete process.env.GEMINI_MODEL;assert.deepEqual((await defaultModels()).map(m=>m.modelId),['gemini-flash-latest']);
  process.env.GEMINI_MODEL='gemini-3.6-flash';assert.deepEqual((await defaultModels()).map(m=>m.modelId),['gemini-3.6-flash']);
 }finally{process.env=saved}
});
test('a model that never starts answering is abandoned after the first-chunk timeout',async()=>{
 const {setFirstChunkTimeout}=await import('../server/models.js');setFirstChunkTimeout(50);
 const hung=new MockLanguageModelV1({modelId:'hung',doStream:async()=>({rawCall:{rawPrompt:null,rawSettings:{}},stream:new ReadableStream({pull(){return new Promise(()=>{})}})})});
 try{
  const m=fallbackModel([hung,textModel('gemini','backup answer')]);
  let out='';for await(const t of streamText({model:m,prompt:'hi'}).textStream)out+=t;
  assert.equal(out,'backup answer');
  await assert.rejects(fallbackModel([hung]).doStream({prompt:[]}),e=>e.name==='FirstChunkTimeout');
 }finally{setFirstChunkTimeout(25000)}
});

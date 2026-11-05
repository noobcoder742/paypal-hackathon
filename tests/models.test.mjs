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

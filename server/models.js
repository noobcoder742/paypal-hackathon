// Claude Haiku first, Gemini's free tier if Claude fails before it has sent anything.
// Returns an AI SDK LanguageModelV1, so streamText/generateText use it like any model.
let modelFactory=null;
/** Tests replace the default models. */
export function setModelFactory(fn){modelFactory=fn}
export async function defaultModels(){
 if(modelFactory)return modelFactory();
 if(process.env.AGENT_FAKE==='1'&&!process.env.VERCEL){const {fakeModel}=await import('./devFakeModel.js');return [fakeModel()]}
 const out=[];
 if(process.env.ANTHROPIC_API_KEY){const {anthropic}=await import('@ai-sdk/anthropic');out.push(anthropic('claude-haiku-5-5'))}
 if(process.env.GOOGLE_GENERATIVE_AI_API_KEY){const {google}=await import('@ai-sdk/google');out.push(google(process.env.GEMINI_MODEL||'gemini-flash-latest'))}
 return out;
}
// A model that has not started answering by then is abandoned (the next model tries,
// or the chat gets an error) instead of running into Vercel's 60 s function limit.
let firstChunkMs=25000;
export function setFirstChunkTimeout(ms){firstChunkMs=ms}
/** Start a stream; if it fails before its first chunk, report failure so the next model can try. */
async function startStream(model,options){
 const res=await model.doStream(options);const reader=res.stream.getReader();
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(`${model.modelId} sent nothing for ${firstChunkMs} ms`),{name:'FirstChunkTimeout'})),firstChunkMs)});
 let first;try{first=await Promise.race([reader.read(),timeout])}catch(e){reader.cancel(e).catch(()=>{});throw e}finally{clearTimeout(timer)}
 if(first.done)throw new Error('empty response from '+model.modelId);
 if(first.value?.type==='error')throw (first.value.error instanceof Error?first.value.error:new Error(String(first.value.error)));
 const stream=new ReadableStream({start(c){c.enqueue(first.value)},async pull(c){const {done,value}=await reader.read();if(done)c.close();else c.enqueue(value)},cancel(r){reader.cancel(r)}});
 return {...res,stream};
}
export function fallbackModel(models){
 if(!models.length)throw new Error('no AI model is configured (set ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)');
 let used=null;
 const tryEach=async fn=>{let err;for(const m of models){try{const r=await fn(m);used=m.modelId;return r}catch(e){err=e}}throw err};
 return {
  specificationVersion:'v1',provider:'fallback',modelId:models.map(m=>m.modelId).join('>'),
  defaultObjectGenerationMode:models[0].defaultObjectGenerationMode||'tool',supportsImageUrls:false,
  doGenerate:options=>tryEach(m=>m.doGenerate(options)),
  doStream:options=>tryEach(m=>startStream(m,options)),
  lastModelUsed:()=>used
 };
}

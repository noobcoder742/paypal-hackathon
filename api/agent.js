import {agentErrorMessage} from '../server/agentError.js';
// POST /api/agent — the couple's planning agent (streams steps to the "Plan with AI" panel).
import {streamText} from 'ai';
import {fallbackModel,defaultModels} from '../server/models.js';
import {coupleTools} from '../server/agent/coupleTools.js';
import {COUPLE_PROMPT} from '../server/agent/couplePrompt.js';
import {getStore} from '../server/store.js';
import {checkRate} from '../server/ratelimit.js';
import {cacheKey,getCachedRun,saveRun,replayStream,UNCACHEABLE} from '../server/agent/cache.js';
import {sameOrigin,clientIp,json} from '../server/http.js';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'forbidden'},403);
 let body;try{body=await request.json()}catch{return json({error:'bad_request'},400)}
 const {messages,planId}=body||{};
 if(!Array.isArray(messages)||!messages.length||messages.length>40||!/^[A-Za-z0-9-]{8,64}$/.test(planId||''))return json({error:'bad_request'},400);
 const store=getStore(),key=cacheKey(messages),cached=await getCachedRun(store,key),ip=clientIp(request);
 const rate=await checkRate(ip,{weight:cached?.25:1});
 if(!rate.ok)return json({error:'rate_limited',resetSeconds:rate.resetSeconds},429);
 if(cached){if(cached.plan)await store.set('plan:'+planId,{...cached.plan,planId});return replayStream(cached.body,{'x-model-used':cached.model||'cache'})}
 let model;try{model=fallbackModel(await defaultModels())}catch(e){return json({error:'no_model'},503)}
 let toolNames=[];
 const result=streamText({model,system:COUPLE_PROMPT,messages,tools:coupleTools({store,planId}),maxSteps:8,maxTokens:1200,temperature:0,
  onStepFinish:s=>{for(const c of s.toolCalls||[])toolNames.push(c.toolName)}});
 const res=result.toDataStreamResponse({getErrorMessage:agentErrorMessage});
 const [toClient,toCache]=res.body.tee();
 (async()=>{const chunks=[];const reader=toCache.getReader();const dec=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(dec.decode(value,{stream:true}))}
  const text=chunks.join('');if(/(^|\n)3:/.test(text))return;            // an error part: don't cache
  if(toolNames.some(n=>UNCACHEABLE.has(n)))return;
  await saveRun(store,key,{body:text,plan:await store.get('plan:'+planId),model:model.lastModelUsed?.()||null})})().catch(()=>{});
 return new Response(toClient,{status:200,headers:{...Object.fromEntries(res.headers),'x-model-used':'live','x-cache':'miss'}});
}

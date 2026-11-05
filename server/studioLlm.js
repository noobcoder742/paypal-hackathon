// One AG Studio agent turn, run on our models (Claude Haiku, then Gemini).
// AG Studio's agents run in the browser and call this through the adapter in src/hotel/studioAgent.js;
// tools are returned as calls for Studio to execute, never executed here.
import {generateText,generateObject,jsonSchema} from 'ai';
import {fallbackModel,defaultModels} from './models.js';
const textOf=content=>(content||[]).map(c=>c.text||c.refusal||'').join('');
/** AG Studio conversation items → AI SDK messages. */
export function toMessages(input){
 const names=new Map(),out=[];
 for(const item of input||[]){
  if(item.type==='message'&&item.kind==='input'){out.push({role:item.role==='system'?'system':'user',content:textOf(item.content)||' '});continue}
  if(item.type==='message'){const t=textOf(item.content);if(t)out.push({role:'assistant',content:t});continue}
  if(item.type==='function_call'){names.set(item.callId,item.name);let args={};try{args=JSON.parse(item.arguments||'{}')}catch{}
   const last=out[out.length-1];const part={type:'tool-call',toolCallId:item.callId,toolName:item.name,args};
   if(last?.role==='assistant'&&Array.isArray(last.content))last.content.push(part);else out.push({role:'assistant',content:[part]});continue}
  if(item.type==='function_call_output'){const part={type:'tool-result',toolCallId:item.callId,toolName:names.get(item.callId)||'tool',result:item.output};
   const last=out[out.length-1];if(last?.role==='tool')last.content.push(part);else out.push({role:'tool',content:[part]})}
 }
 if(!out.some(m=>m.role==='user'))out.push({role:'user',content:'Continue.'});
 return out;
}
const toolChoiceOf=c=>!c||c==='auto'?'auto':c==='none'?'none':c==='required'?'required':{type:'tool',toolName:c.name};
/** Returns {text, toolCalls:[{callId,name,arguments}], model}. */
export async function runStudioTurn(request,{models}={}){
 const model=fallbackModel(models||await defaultModels());
 const messages=toMessages(request.input),system=request.instructions||undefined;
 if(request.responseFormat?.type==='json'){
  const {object}=await generateObject({model,system,messages,schema:jsonSchema(request.responseFormat.schema),maxTokens:1500,temperature:0});
  return {text:JSON.stringify(object),toolCalls:[],model:model.lastModelUsed()};
 }
 const tools=Object.fromEntries((request.tools||[]).slice(0,64).map(t=>[t.name,{description:t.description,parameters:jsonSchema(t.parameters||{type:'object',properties:{}})}]));
 const r=await generateText({model,system,messages,tools:Object.keys(tools).length?tools:undefined,toolChoice:Object.keys(tools).length?toolChoiceOf(request.toolChoice):undefined,maxSteps:1,maxTokens:1500,temperature:0});
 return {text:r.text||'',toolCalls:(r.toolCalls||[]).map(c=>({callId:c.toolCallId,name:c.toolName,arguments:JSON.stringify(c.args||{})})),model:model.lastModelUsed()};
}

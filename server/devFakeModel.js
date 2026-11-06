// A scripted stand-in for the AI model, for local development and tests only (AGENT_FAKE=1).
// It calls the real tools in the order a good run would, so the whole flow can be exercised
// without API keys. Never enabled on Vercel.
import {MockLanguageModelV1,simulateReadableStream} from 'ai/test';
const textOf=m=>typeof m.content==='string'?m.content:(m.content||[]).map(p=>p.text||'').join(' ');
function hotelPlan(prompt){
 const done=prompt.filter(m=>m.role==='tool').flatMap(m=>m.content);const user=textOf(prompt.find(m=>m.role==='user')||{});
 const q=done.find(c=>c.toolName==='draft_quote');
 if(!q)return {call:'draft_quote',args:{enquiryId:(user.match(/Enquiry (\S+):/)||[])[1]||''}};
 const r=q.result||{};const sgd=n=>'S$'+Number(n||0).toLocaleString('en-SG',{maximumFractionDigits:2});
 return {text:`Dear ${r.coupleName||'both'}, thank you for considering ${r.venueName}. For ${r.tables} tables on ${r.date}: Grand Ballroom wedding dinner at ${sgd(r.pricePerTable)}++ per table, ${sgd(r.subtotal)} before charges, ${sgd(r.total)} including 10% service and 9% GST. A 30% deposit of ${sgd(r.deposit)} holds your date.`};
}
function plan(prompt){
 if(textOf(prompt.find(m=>m.role==='system')||{}).includes('banquet sales assistant'))return hotelPlan(prompt);
 const users=prompt.filter(m=>m.role==='user'),last=textOf(users[users.length-1]||{}).toLowerCase();
 const done=prompt.filter(m=>m.role==='tool').flatMap(m=>m.content.map(c=>c.toolName));
 const tables=+(last.match(/(\d+)\s*tables?/)||[])[1]||16,budget=(()=>{const m=last.match(/s?\$\s*([\d,]+)\s*(k)?/);return m?parseFloat(m[1].replace(/,/g,''))*(m[2]?1000:1):null})();
 const style=['garden','classic','modern','romantic','minimal'].find(s=>last.includes(s))||'garden';
 const venueId='orchard-grand',lines=style==='garden'?[{id:'floral-greenery',qty:tables},{id:'floral-arch',qty:1},{id:'light-canopy',qty:1},{id:'music-strings',qty:1}]:[{id:'floral-white',qty:tables},{id:'light-ambient',qty:1},{id:'music-piano',qty:1}];
 if(/secure|deposit|pay/.test(last))return done.includes('create_deposit_order')?{text:'Your deposit order is ready. Approve it with the PayPal button below; nothing is charged until you do.'}:{call:'create_deposit_order',args:{}};
 if(/enquiry|send to/.test(last))return done.includes('send_enquiry')?{text:'Sent. The venue will reply with a quote and a deposit invoice.'}:{call:'send_enquiry',args:{coupleName:'Mei & Daniel',email:'couple@example.com',date:'2027-06-12'}};
 const steps=[['search_venues',{tables}],['search_vendors',{style}],['check_budget',{venueId,tables,lines,budget:budget??undefined}],['place_in_ballroom',{venueId,tables,lines,budget:budget??undefined}]];
 const next=steps.find(([n])=>!done.includes(n));
 return next?{call:next[0],args:next[1]}:{text:`Here is a ${style} plan for ${tables} tables at The Orchard Grand, placed in the ballroom. Prices are illustrative demo prices. Say "secure these vendors" to pay 20% deposits with PayPal.`};
}
export function fakeModel(){
 let n=0;
 return new MockLanguageModelV1({modelId:'dev-fake',doGenerate:async()=>({rawCall:{rawPrompt:null,rawSettings:{}},finishReason:'stop',usage:{promptTokens:1,completionTokens:1},text:'Just a friendly heads-up: your wedding date is held for you, and the deposit link is ready whenever you are. Any questions, we are happy to help!'}),doStream:async({prompt})=>{const p=plan(prompt),id='call-'+(++n);
  const chunks=p.call?[{type:'tool-call',toolCallType:'function',toolCallId:id,toolName:p.call,args:JSON.stringify(p.args)},{type:'finish',finishReason:'tool-calls',usage:{promptTokens:1,completionTokens:1}}]
   :[...p.text.match(/.{1,24}(\s|$)/g).map(t=>({type:'text-delta',textDelta:t})),{type:'finish',finishReason:'stop',usage:{promptTokens:1,completionTokens:1}}];
  return {rawCall:{rawPrompt:null,rawSettings:{}},stream:simulateReadableStream({chunks,chunkDelayInMs:60})}}});
}

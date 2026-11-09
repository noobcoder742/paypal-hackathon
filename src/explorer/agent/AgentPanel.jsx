// "Plan with AI": the couple's planning agent beside the map and the ballroom.
// Steps stream in as short lines; a finished plan updates the 3D room; deposits go through PayPal.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useChat} from '@ai-sdk/react';
import {Sparkles,X,Send,PlayCircle} from 'lucide-react';
import PlanCard from './PlanCard.jsx';
import replay from './replay.json';
import {rememberEnquiry} from '../../components/planner/DepositInvoices.jsx';
import './agent.css';

const PRESETS=['30 tables, S$95,000 all-in, garden style, near Orchard','25 tables, S$75,000, classic and romantic','40 tables for S$40,000'];
const planIdFor=()=>{try{let id=sessionStorage.getItem('wedding-agent-plan');if(!id){id='plan-'+crypto.randomUUID();sessionStorage.setItem('wedding-agent-plan',id)}return id}catch{return 'plan-'+Math.random().toString(36).slice(2,14)}};
const sgd=n=>n==null?'':'S$'+Math.round(n).toLocaleString('en-SG');
/** One readable line per tool step. */
export function stepLine({toolName,args={},state,result}){
 const done=state==='result';
 switch(toolName){
  case 'search_venues':return done?`Found ${result?.venues?.length||0} venues for ${args.tables} tables`:`Comparing venues for ${args.tables||'your'} tables…`;
  case 'search_vendors':return done?`Found ${result?.items?.length||0} ${args.style||''} vendor options`:`Searching ${args.style||''} vendors…`;
  case 'check_budget':return done?(result?.ok?`Fits the budget: ${sgd(result.grandTotal)} all-in, ${sgd(result.remaining)} left`:`Doesn't fit: ${(result?.problems||[])[0]||'checking again'}`):'Checking the budget and capacity…';
  case 'place_in_ballroom':return done?(result?.error?'Could not place that plan':`Placed ${args.lines?.length||0} items in the ballroom at ${result.venueName}`):'Placing items in the 3D ballroom…';
  case 'open_checkout':return done?(result?.error?'Could not open the payment page':`Your vendors are in your cart: ${sgd(result.depositTotal)} in deposits`):'Putting your vendors in your cart…';
  case 'send_enquiry':return done?(result?.error?'Could not send the enquiry':`Enquiry sent to ${result.venueName}`):'Sending the enquiry…';
  default:return toolName;
 }
}
/** Plays the recorded example run as if it were streaming. */
function replayFetch(){
 const enc=new TextEncoder(),parts=replay.body.split(/(?<=\n)/);
 const stream=new ReadableStream({async start(c){for(const p of parts){c.enqueue(enc.encode(p));await new Promise(r=>setTimeout(r,140))}c.close()}});
 return Promise.resolve(new Response(stream,{headers:{'content-type':'text/plain; charset=utf-8','x-vercel-ai-data-stream':'v1'}}));
}

export default function AgentPanel({onPlan,onPaid}){
 const [open,setOpen]=useState(false),[replaying,setReplaying]=useState(false),[failure,setFailure]=useState(null);
 const planId=useMemo(planIdFor,[]),replayRef=useRef(false),handled=useRef(new Set()),listRef=useRef(null);
 const {messages,input,setInput,append,status,stop}=useChat({api:'/api/agent',body:{planId},
  fetch:(url,init)=>replayRef.current?replayFetch():fetch(url,init).then(r=>{if(r.status===429)setFailure('limit');else if(!r.ok)setFailure('down');return r}),
  onError:()=>setFailure(f=>f||'down')});
 const busy=status==='submitted'||status==='streaming';
 const ask=text=>{if(!text.trim()||busy)return;setFailure(null);append({role:'user',content:text.trim()});setInput('')};
 const watchReplay=()=>{replayRef.current=true;setReplaying(true);setFailure(null);append({role:'user',content:replay.prompt})};
 // the newest finished plan updates the 3D room once
 useEffect(()=>{for(const m of messages)for(const p of m.parts||[]){const t=p.toolInvocation;if(p.type!=='tool-invocation'||t.state!=='result')continue;const k=m.id+':'+t.toolCallId;if(handled.current.has(k))continue;handled.current.add(k);
  if(t.toolName==='place_in_ballroom'&&!t.result?.error)onPlan?.({venueId:t.result.venueId,studioPatch:t.result.studioPatch});
  // "secure these vendors": the plan goes into the cart and the payment page opens (all payments happen there)
  if(t.toolName==='open_checkout'&&t.result?.checkout&&!replayRef.current){setOpen(false);window.dispatchEvent(new CustomEvent('wedding-checkout',{detail:{planId:t.result.planId,lines:t.result.lines}}))}
  if(t.toolName==='send_enquiry'&&t.result?.enquiryId&&!replayRef.current)rememberEnquiry({enquiryId:t.result.enquiryId,venueName:t.result.venueName})}},[messages,onPlan]);
 useEffect(()=>{listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:'smooth'})},[messages,status]);
 // the map or studio narrows beside the open panel instead of being covered
 useEffect(()=>{document.body.classList.toggle('agent-open',open);return()=>document.body.classList.remove('agent-open')},[open]);
 const latestPlan=[...messages].reverse().flatMap(m=>[...(m.parts||[])].reverse()).find(p=>p.type==='tool-invocation'&&p.toolInvocation.toolName==='place_in_ballroom'&&p.toolInvocation.state==='result'&&!p.toolInvocation.result?.error)?.toolInvocation.result;
 if(!open)return <button type="button" className="agent-launch" onClick={()=>setOpen(true)}><Sparkles size={16}/> Plan with AI</button>;
 return <aside className="agent-panel" aria-label="Plan with AI">
  <header className="agent-head"><div><h2>Plan with AI</h2><p>Fictional demo venues and vendors · PayPal sandbox, no real money</p></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}><X size={18}/></button></header>
  <div className="agent-body" ref={listRef}>
   {!messages.length&&<div className="agent-empty"><p>Tell me your tables, budget and style. I'll pick a venue and vendors, set up the ballroom and prepare PayPal deposits for you to approve.</p>
    <div className="agent-presets">{PRESETS.map(p=><button type="button" key={p} onClick={()=>ask(p)}>{p}</button>)}</div></div>}
   {replaying&&<p className="agent-replay-tag">Recorded example run</p>}
   {messages.map(m=><div key={m.id} className={'agent-msg '+m.role}>
    {(m.parts||[]).map((p,i)=>{
     if(p.type==='text'&&p.text.trim())return <p key={i} className="agent-text">{p.text}</p>;
     if(p.type!=='tool-invocation')return null;const t=p.toolInvocation;
     return <div key={i}><p className={'agent-step'+(t.state==='result'?' done':'')}>{stepLine(t)}</p>
      {t.toolName==='open_checkout'&&t.state==='result'&&t.result?.checkout&&!replaying&&<button type="button" className="agent-checkout" onClick={()=>window.dispatchEvent(new CustomEvent('wedding-checkout',{detail:{planId:t.result.planId,lines:t.result.lines}}))}>Go to payment</button>}
      {t.toolName==='open_checkout'&&t.state==='result'&&replaying&&<p className="agent-note">In a live run, this opens your cart to pay with PayPal.</p>}</div>})}
   </div>)}
   {latestPlan&&<PlanCard plan={latestPlan} disabled={busy} onSecure={()=>ask('Secure these vendors.')} onEnquire={d=>ask(`Send the enquiry to the venue. We are ${d.name}, ${d.email}, date ${d.date}.`)}/>}
   {failure&&<div className="agent-failure" role="status"><p>{failure==='limit'?"You've used this hour's planning runs on the demo.":"The assistant is unavailable right now."}</p><button type="button" onClick={watchReplay}><PlayCircle size={15}/> Watch a recorded example run</button></div>}
  </div>
  <form className="agent-input" onSubmit={e=>{e.preventDefault();ask(input)}}>
   <label htmlFor="agent-ask" className="sr-only">Ask the planning assistant</label>
   <input id="agent-ask" value={input} onChange={e=>setInput(e.target.value)} placeholder="e.g. swap the strings for a jazz trio" maxLength={400} disabled={replaying}/>
   {busy?<button type="button" onClick={stop}>Stop</button>:<button type="submit" aria-label="Send" disabled={!input.trim()||replaying}><Send size={16}/></button>}
  </form>
 </aside>;
}

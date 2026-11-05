// AG Studio Agent Framework for the Banquet Sales dashboard.
// - An adapter sends each model turn to /api/hotel/studio-llm (Claude Haiku, then Gemini), so no key
//   is ever in the browser.
// - Our "Bookings assistant" is the primary agent. It answers from the hotel's PayPal deposit data
//   and drafts friendly reminders, and delegates building or editing widgets to AG Studio's built-in
//   agents (lead, data, page, planning, widget) with delegateTo.
import {createAiHarness,directLlmRunner} from 'ag-studio';
import {stillToPay} from './dashboardData.js';

export function studioAdapter(getToken){
 return {executeTurn(request,{signal}={}){
  const id='turn-'+Math.random().toString(36).slice(2,10);
  const complete=fetch('/api/hotel/studio-llm',{method:'POST',signal,headers:{'content-type':'application/json',authorization:'Bearer '+getToken()},body:JSON.stringify(request)})
   .then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error==='rate_limited'?'The assistant has reached its hourly limit.':'The assistant is unavailable right now.');return j})
   .then(j=>({id,createdAt:Date.now(),status:'completed',model:j.model||undefined,output:[
    ...(j.text?[{id:id+'-msg',kind:'output',type:'message',role:'assistant',status:'completed',content:[{type:'text',text:j.text,annotations:[]}]}]:[]),
    ...(j.toolCalls||[]).map(c=>({id:c.callId,kind:'output',type:'function_call',callId:c.callId,name:c.name,arguments:c.arguments,status:'completed'}))]}));
  const stream={async *[Symbol.asyncIterator](){
   const r=await complete;
   for(const o of r.output){
    if(o.type==='message'){yield {type:'TEXT_MESSAGE_START',messageId:o.id,role:'assistant'};yield {type:'TEXT_MESSAGE_CONTENT',messageId:o.id,delta:o.content[0].text};yield {type:'TEXT_MESSAGE_END',messageId:o.id}}
    else{yield {type:'TOOL_CALL_START',toolCallId:o.callId,toolCallName:o.name};yield {type:'TOOL_CALL_ARGS',toolCallId:o.callId,delta:o.arguments};yield {type:'TOOL_CALL_END',toolCallId:o.callId}}
   }
  }};
  return {stream,complete};
 }};
}

const sgd=n=>'S$'+Number(n||0).toLocaleString('en-SG',{maximumFractionDigits:2});
const tool=(name,description,parameters,run)=>({name,description,kind:'client',
 schema:()=>({name,description,parameters}),
 execute:async(call,ctx)=>{try{const {text,data}=await run(call.args||{});return ctx.success(text,data)}catch(e){return ctx.error(e.message||'failed')}}});

export const BOOKINGS_PROMPT=`You are the Bookings assistant on a fictional demo hotel's Banquet Sales dashboard in Wedding Studio.
Deposits are paid through PayPal invoices (sandbox). Couples marked "(example)" are example bookings.
- To answer who still owes deposits, call unpaid_deposits.
- To write a reminder, call draft_reminder with the enquiry id; reminders are friendly heads-ups, never demands. The sales manager sends it.
- To add, change or explain charts, grids and filters on the dashboard, delegate to the built-in agents with delegate_to (the lead agent can plan multi-widget changes; the widget agent configures one widget).
Answer in short sentences. Money is S$.`;

export function buildAi({getToken,getRows,draftReminder}){
 const adapter=studioAdapter(getToken);
 return ({api})=>createAiHarness(api,({tools,builtIn})=>{
  const bookingTools=[
   tool('unpaid_deposits','List couples whose PayPal deposit invoice is still unpaid, largest first.',{type:'object',properties:{},additionalProperties:false},
    async()=>{const due=stillToPay(getRows());return {text:due.length?due.map(r=>`${r.couple} (${r.id}): ${sgd(r.depositDue)} due, wedding ${r.weddingDate}, ${r.reminders} reminder(s) sent`).join('\n'):'Every invoiced deposit is paid.',data:due}}),
   tool('draft_reminder','Draft a friendly payment reminder for one unpaid deposit invoice. Returns the draft; the manager reviews and sends it.',
    {type:'object',properties:{enquiryId:{type:'string',description:'The enquiry id from unpaid_deposits'}},required:['enquiryId'],additionalProperties:false},
    async({enquiryId})=>{const text=await draftReminder(enquiryId);return {text:'Draft reminder (not sent): '+text,data:{enquiryId,text}}})
  ];
  const bookings=directLlmRunner({id:'bookings',name:'Bookings assistant',description:'Answers questions about bookings and PayPal deposits, drafts reminders, and asks the dashboard agents to build widgets.',
   instructions:()=>BOOKINGS_PROMPT,
   tools:()=>[...bookingTools,tools.studio.viewReport(),tools.studio.viewSchema(),tools.studio.executeQuery(),tools.delegateTo(['lead','widget','page','data'])],
   maxTurns:8,adapter});
  const builtIns=Object.values(builtIn).map(def=>directLlmRunner({...def,adapter}));
  return {agents:[bookings,...builtIns],primary:'bookings',promptStarters:[
   {label:'Who still owes a deposit?',prompt:'Who still owes a deposit, and how much in total?'},
   {label:'Deposits by month',prompt:'Add a column chart of PayPal deposits paid by wedding month.'},
   {label:'Draft a reminder',prompt:'Draft a friendly reminder for the largest unpaid deposit.'}
  ]};
 });
}

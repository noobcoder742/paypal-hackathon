// AG Studio set-up for a vendor's Insights page: data, opening report and the agents.
// Reuses the custom widgets and the server-side model adapter from the hotel dashboard.
import {createAiHarness,directLlmRunner} from 'ag-studio';
import StillToPay from '../hotel/widgets/StillToPay.jsx';
import DateCalendar from '../hotel/widgets/DateCalendar.jsx';
import {studioAdapter,tool} from '../hotel/studioAgent.js';
import {sgd} from './status.js';

const CAL='calendar';
const f=(id,name,format,hide)=>({id,name,format,...(hide&&{hide})});
export function buildVendorStudioData(rows,vendor){
 const dates=rows.map(r=>r.weddingDate).filter(Boolean).sort(),today=new Date().toISOString().slice(0,10);
 return {
  description:`Wedding bookings for ${vendor.name}, a fictional demo vendor. Couples pay a 20% deposit through PayPal when they book; the vendor collects the balance with a PayPal invoice. Couples marked "(example)" are example bookings.`,
  sources:[{id:'bookings',name:'Bookings',description:'One row per booking: status and PayPal amounts in SGD.',data:rows,fields:[
   f('id','Booking ID','textFormat',true),f('couple','Couple','textFormat'),f('item','Item','textFormat'),f('statusLabel','Status','textFormat'),f('status','Status key','textFormat',true),
   f('weddingDate','Wedding date','dateFormat'),f('weddingMonth','Wedding month','textFormat'),
   f('total','Booking total','currencyFormat'),f('deposit','Deposit paid','currencyFormat'),f('balance','Balance','currencyFormat'),f('balanceDue','Balance due','currencyFormat'),f('paidInFull','Balance paid','currencyFormat'),
   f('reminders','Reminders sent','integerFormat'),f('isExample','Example booking','booleanFormat')]}],
  relationships:[{id:'wedding-calendar',source:{tableId:'bookings',fieldId:'weddingDate'},target:{calendarId:CAL}}],
  calendars:[{id:CAL,label:'Wedding calendar',range:{from:{type:'date',value:dates[0]||today},to:{type:'date',value:dates.at(-1)||today}},fragments:['year','quarter','month','week','day','dayOfWeek']}],
 };
}
const formFor=items=>p=>p.createDefaults({dataMappingItems:items});
export const VENDOR_WIDGETS=[
 {id:'still-to-pay',label:'Still to pay',comp:StillToPay,defaultSize:{xSpan:8,ySpan:20},minSize:{xSpan:5,ySpan:10},
  dataMapping:{couple:{type:'field',supportedRoles:['category']},due:{type:'field',supportedRoles:['numeric']}},form:formFor([{key:'couple',label:'Couple'},{key:'due',label:'Balance due'}]),
  ai:{label:'Still to pay scoreboard',description:'Couples whose balance is unpaid, largest first.'}},
 {id:'date-calendar',label:'Wedding calendar',comp:DateCalendar,defaultSize:{xSpan:10,ySpan:22},minSize:{xSpan:6,ySpan:14},
  dataMapping:{date:{type:'field',supportedRoles:['temporal','category']},status:{type:'field',supportedRoles:['category']}},form:formFor([{key:'date',label:'Wedding date'},{key:'status',label:'Status'}]),
  ai:{label:'Wedding calendar',description:'Month grid of wedding days: paid in full, or still open.'}},
];
const at=(xTrack,yTrack,xSpan,ySpan)=>({xTrack,yTrack,xSpan,ySpan});
const title=text=>({title:{enabled:true,text}});
const sum=id=>({id,aggregation:'sum'});
const kpi=(text,value)=>({type:'value',dataMapping:{value:[value]},format:title(text)});
export const VENDOR_REPORT={selectedPageId:'overview',pages:[{id:'overview',name:'Bookings',
 widgets:{
  'kpi-bookings':kpi('Bookings',{id:'bookings.id',aggregation:'countd'}),
  'kpi-deposits':kpi('Deposits received',sum('bookings.deposit')),
  'kpi-due':kpi('Balances to collect',sum('bookings.balanceDue')),
  'kpi-paid':kpi('Balances paid',sum('bookings.paidInFull')),
  status:{type:'list-filter',dataMapping:{value:[{id:'bookings.statusLabel'}]},format:title('Status')},
  grid:{type:'grid',dataMapping:{cols:[{id:'bookings.couple'},{id:'bookings.item'},{id:'bookings.weddingDate'},{id:'bookings.statusLabel'},sum('bookings.total'),sum('bookings.deposit'),sum('bookings.balanceDue')]},
   sort:[{field:{id:'bookings.weddingDate'},direction:'asc'}],format:title('All bookings')},
  'by-month':{type:'column-chart-stacked',dataMapping:{categoryKey:[{id:'calendar::month'}],valueKey:[sum('bookings.deposit'),sum('bookings.paidInFull'),sum('bookings.balanceDue')]},format:title('Money in, by wedding month')},
  'still-to-pay':{type:'still-to-pay',dataMapping:{couple:[{id:'bookings.couple'}],due:[sum('bookings.balanceDue')]},format:title('Still to pay')},
  calendar:{type:'date-calendar',dataMapping:{date:[{id:'bookings.weddingDate'}],status:[{id:'bookings.status'}]},format:title('Wedding calendar')},
 },
 widgetLayout:{
  'kpi-bookings':at(0,0,6,7),'kpi-deposits':at(6,0,6,7),'kpi-due':at(12,0,6,7),'kpi-paid':at(18,0,6,7),
  status:at(0,7,4,22),grid:at(4,7,13,22),'still-to-pay':at(17,7,7,22),
  'by-month':at(0,29,14,22),calendar:at(14,29,10,22)
 }}]};

export const VENDOR_ASSISTANT_PROMPT=`You are the Bookings assistant on a fictional demo wedding vendor's workspace in Wedding Studio.
Couples pay a 20% deposit through PayPal (sandbox) when they book; the vendor collects the balance with a PayPal invoice. Couples marked "(example)" are example bookings.
- To answer who still owes a balance, call unpaid_balances.
- To write a reminder, call draft_reminder with the booking id; reminders are friendly heads-ups, never demands. The vendor sends it.
- To add, change or explain charts, grids and filters, delegate to the built-in agents with delegate_to (the lead agent plans multi-widget changes; the widget agent configures one widget).
Answer in short sentences. Money is S$.`;
export function buildVendorAi({getToken,getRows,draftReminder}){
 const adapter=studioAdapter(getToken,'/api/vendor/studio-llm');
 return ({api})=>createAiHarness(api,({tools,builtIn})=>{
  const own=[
   tool('unpaid_balances','List couples whose balance is still unpaid, largest first.',{type:'object',properties:{},additionalProperties:false},
    async()=>{const due=getRows().filter(r=>r.balanceDue>0).sort((a,b)=>b.balanceDue-a.balanceDue);
     return {text:due.length?due.map(r=>`${r.couple} (${r.id}): ${sgd(r.balanceDue)} due, ${r.statusLabel.toLowerCase()}, wedding ${r.weddingDate||'date to confirm'}`).join('\n'):'Every balance is paid.',data:{count:due.length}}}),
   tool('draft_reminder','Draft a friendly reminder for one unpaid balance. Returns the draft; the vendor reviews and sends it.',
    {type:'object',properties:{bookingId:{type:'string',description:'The booking id from unpaid_balances'}},required:['bookingId'],additionalProperties:false},
    async({bookingId})=>{const text=await draftReminder(bookingId);return {text:'Draft reminder (not sent): '+text,data:{bookingId,text}}})
  ];
  const bookings=directLlmRunner({id:'bookings',name:'Bookings assistant',description:'Answers questions about bookings and PayPal payments, drafts reminders, and asks the dashboard agents to build widgets.',
   instructions:()=>VENDOR_ASSISTANT_PROMPT,
   tools:()=>[...own,tools.studio.viewReport(),tools.studio.viewSchema(),tools.studio.executeQuery(),tools.delegateTo(['lead','widget','page','data'])],
   maxTurns:8,adapter});
  const builtIns=Object.values(builtIn).map(def=>directLlmRunner({...def,adapter}));
  return {agents:[bookings,...builtIns],primary:'bookings',promptStarters:[
   {label:'Who still owes a balance?',prompt:'Who still owes a balance, and how much in total?'},
   {label:'Bookings by item',prompt:'Add a bar chart of booking totals by item.'},
   {label:'Draft a reminder',prompt:'Draft a friendly reminder for the largest unpaid balance.'}]};
 });
}

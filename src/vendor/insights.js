// AG Studio set-up for a vendor's Insights page: data, opening report and the agents.
// Reuses the custom widgets and the server-side model adapter from the hotel dashboard.
import {createAiHarness,directLlmRunner} from 'ag-studio';
import StillToPay from '../hotel/widgets/StillToPay.jsx';
import DateCalendar from '../hotel/widgets/DateCalendar.jsx';
import TodoList from './TodoList.jsx';
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
   f('total','Booking total','integerFormat'),f('moneyIn','Money in','integerFormat'),f('toInvoice','To invoice','integerFormat'),f('overdueDue','Overdue','integerFormat'),f('deposit','Deposit paid','integerFormat'),f('balance','Balance','integerFormat'),f('balanceDue','Balance due','integerFormat'),f('paidInFull','Balance paid','integerFormat'),
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
 {id:'todo-list',label:'To do',comp:TodoList,defaultSize:{xSpan:10,ySpan:22},minSize:{xSpan:6,ySpan:12},
  dataMapping:{id:{type:'field',supportedRoles:['category']},couple:{type:'field',supportedRoles:['category']},status:{type:'field',supportedRoles:['category']},due:{type:'field',supportedRoles:['numeric']},date:{type:'field',supportedRoles:['temporal','category']}},
  form:formFor([{key:'id',label:'Booking'},{key:'couple',label:'Couple'},{key:'status',label:'Status'},{key:'due',label:'Balance due'},{key:'date',label:'Wedding date'}]),
  ai:{label:'To do list',description:'Next actions: open new bookings, send balance invoices, send reminders for overdue balances, weddings coming up.'}},
 {id:'date-calendar',label:'Wedding calendar',comp:DateCalendar,defaultSize:{xSpan:10,ySpan:22},minSize:{xSpan:6,ySpan:14},
  dataMapping:{date:{type:'field',supportedRoles:['temporal','category']},status:{type:'field',supportedRoles:['category']}},form:formFor([{key:'date',label:'Wedding date'},{key:'status',label:'Status'}]),
  ai:{label:'Wedding calendar',description:'Month grid of wedding days: paid in full, or still open.'}},
];
const at=(xTrack,yTrack,xSpan,ySpan)=>({xTrack,yTrack,xSpan,ySpan});
const title=text=>({title:{enabled:true,text}});
const sum=id=>({id,aggregation:'sum'});
const kpi=(text,value)=>({type:'value',dataMapping:{value:[value]},format:title(text)});
// Month-focused: pick a wedding month on the left and every number follows. No all-bookings grid here
// (that's the Bookings page); instead what to do next, who hasn't paid, and where the money comes from.
export const VENDOR_REPORT={selectedPageId:'month',pages:[{id:'month',name:'This month',
 widgets:{
  month:{type:'list-filter',dataMapping:{value:[{id:'bookings.weddingMonth'}]},format:title('Wedding month')},
  'kpi-weddings':kpi('Weddings',{id:'bookings.id',aggregation:'countd'}),
  'kpi-in':kpi('Money in, S$',sum('bookings.moneyIn')),
  'kpi-due':kpi('Due, S$',sum('bookings.balanceDue')),
  'kpi-invoice':kpi('To invoice, S$',sum('bookings.toInvoice')),
  'kpi-overdue':kpi('Overdue, S$',sum('bookings.overdueDue')),
  todo:{type:'todo-list',dataMapping:{id:[{id:'bookings.id'}],couple:[{id:'bookings.couple'}],status:[{id:'bookings.status'}],due:[sum('bookings.balanceDue')],date:[{id:'bookings.weddingDate'}]},format:title('To do')},
  'still-to-pay':{type:'still-to-pay',dataMapping:{couple:[{id:'bookings.couple'}],due:[sum('bookings.balanceDue')]},format:title('Who hasn’t paid')},
  status:{type:'list-filter',dataMapping:{value:[{id:'bookings.statusLabel'}]},format:title('Status')},
  'by-status':{type:'donut-chart',dataMapping:{categoryKey:[{id:'bookings.statusLabel'}],valueKey:[{id:'bookings.id',aggregation:'countd'}]},format:title('Bookings by status')},
  'by-month':{type:'column-chart-stacked',dataMapping:{categoryKey:[{id:'calendar::month'}],valueKey:[sum('bookings.moneyIn'),sum('bookings.balanceDue')]},format:title('Money in and still due, by month')},
  'by-item':{type:'bar-chart-grouped',dataMapping:{categoryKey:[{id:'bookings.item'}],valueKey:[sum('bookings.total')]},format:title('Revenue by item')},
  calendar:{type:'date-calendar',dataMapping:{date:[{id:'bookings.weddingDate'}],status:[{id:'bookings.status'}]},format:title('Wedding calendar')},
 },
 widgetLayout:{
  month:at(0,0,4,29),
  'kpi-weddings':at(4,0,4,7),'kpi-in':at(8,0,4,7),'kpi-due':at(12,0,4,7),'kpi-invoice':at(16,0,4,7),'kpi-overdue':at(20,0,4,7),
  todo:at(4,7,11,22),'still-to-pay':at(15,7,9,22),
  status:at(0,29,4,22),'by-status':at(4,29,6,22),'by-month':at(10,29,8,22),'by-item':at(18,29,6,22),
  calendar:at(0,51,10,22)
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

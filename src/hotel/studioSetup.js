// AG Studio set-up for the Banquet Sales dashboard: data sources, theme, the opening report and
// the custom widgets (ballroom preview, date calendar, still-to-pay scoreboard).
import {studioTheme} from 'ag-studio';
import BallroomPreview from './widgets/BallroomPreview.jsx';
import DateCalendar from './widgets/DateCalendar.jsx';
import StillToPay from './widgets/StillToPay.jsx';

const CAL='calendar';
const f=(id,name,format,hide)=>({id,name,format,...(hide&&{hide})});
export function buildStudioData(rows){
 const dates=rows.flatMap(r=>[r.weddingDate,r.enquiryDate]).filter(Boolean).sort();
 const today=new Date().toISOString().slice(0,10);
 return {
  description:'Wedding banquet bookings for a fictional demo hotel. Deposits are 30% of the banquet total (incl. 10% service charge and 9% GST) and are paid with PayPal invoices in SGD. Rows whose couple ends in "(example)" are example bookings.',
  sources:[{id:'bookings',name:'Bookings',description:'One row per wedding enquiry: pipeline status and PayPal deposit amounts.',data:rows,fields:[
   f('id','Enquiry ID','textFormat',true),f('couple','Couple','textFormat'),f('status','Status','textFormat'),f('tables','Tables','integerFormat'),f('guests','Guests','integerFormat'),
   f('weddingDate','Wedding date','dateFormat'),f('enquiryDate','Enquiry date','dateFormat'),f('weddingMonth','Wedding month','textFormat'),
   f('banquetTotal','Banquet total','currencyFormat'),f('depositInvoiced','Deposit invoiced','currencyFormat'),f('depositPaid','Deposit paid','currencyFormat'),f('depositDue','Deposit due','currencyFormat'),
   f('reminders','Reminders sent','integerFormat'),f('isExample','Example booking','booleanFormat')]}],
  relationships:[{id:'wedding-calendar',source:{tableId:'bookings',fieldId:'weddingDate'},target:{calendarId:CAL}}],
  calendars:[{id:CAL,label:'Wedding calendar',range:{from:{type:'date',value:dates[0]||today},to:{type:'date',value:dates.at(-1)||today}},fragments:['year','quarter','month','week','day','dayOfWeek']}],
  expressions:[{id:'collectionRate',name:'Deposits collected',description:'Deposit paid / deposit invoiced.',format:'percentageFormat',isMeasure:true,
   expression:{operator:'divide',inputs:[{id:'bookings.depositPaid',aggregation:'sum'},{id:'bookings.depositInvoiced',aggregation:'sum'}]}}]
 };
}

// The site's look: white, Outfit text, Cormorant Garamond titles, the rosewood accent.
const UI='"Outfit", ui-sans-serif, system-ui, sans-serif',SERIF='"Cormorant Garamond", Georgia, serif';
const line=color=>({width:1,color});
export const studioThemeWedding=studioTheme.withParams({
 fontFamily:UI,fontSize:14,textColor:'#1d1a16',foregroundColor:'#1d1a16',subtleTextColor:'#8a8375',backgroundColor:'#ffffff',borderColor:'rgba(29,26,22,.12)',accentColor:'#8e3b46',iconColor:'#4a443c',rowHoverColor:'#f6e9e8',
 studioWrapperBorder:false,studioWrapperBorderRadius:0,studioWrapperSpacing:0,studioWrapperBackgroundColor:'#fbfaf8',
 studioCanvasBorder:false,studioCanvasBorderRadius:0,studioCanvasShadow:false,studioCanvasBackgroundColor:'#fbfaf8',studioCanvasPadding:20,studioCanvasRowHeight:18,studioCanvasFontFamily:UI,
 studioWidgetBackgroundColor:'#ffffff',studioWidgetBorder:line('rgba(29,26,22,.10)'),studioWidgetBorderRadius:14,studioWidgetPadding:12,
 studioWidgetTitleFontFamily:SERIF,studioWidgetTitleFontSize:20,studioWidgetTitleFontWeight:600,studioWidgetTitleTextColor:'#1d1a16',
 studioWidgetSubtitleFontFamily:UI,studioWidgetSubtitleFontSize:13,studioWidgetSubtitleTextColor:'#8a8375',
 gridFontFamily:UI,gridFontSize:14,gridHeaderBackgroundColor:'#ffffff',gridHeaderTextColor:'#8a8375',gridHeaderFontWeight:500,gridRowHeight:40,gridRowBorder:line('rgba(29,26,22,.06)'),gridWrapperBorder:false,
 chartFontFamily:UI,chartTextColor:'#1d1a16',chartSubtleTextColor:'#8a8375',chartAxisLineColor:'rgba(29,26,22,.15)',chartGridLineColor:'rgba(29,26,22,.06)',
 ...Object.fromEntries(['#8e3b46','#c6a77a','#6b8f71','#4a6c8c','#d6adb1','#a6b2a0','#555866','#e0c9a6','#7d5a50','#b9a58d'].flatMap((c,i)=>[[`chartPaletteFills${i+1}Color`,c],[`chartPaletteStrokes${i+1}Color`,c]]))
});

// Custom widgets: each reads its rows through the widget API, so cross-filters apply to them too.
const formFor=(items)=>p=>p.createDefaults({dataMappingItems:items});
export const CUSTOM_WIDGETS=[
 {id:'still-to-pay',label:'Still to pay',comp:StillToPay,defaultSize:{xSpan:8,ySpan:20},minSize:{xSpan:5,ySpan:10},
  dataMapping:{couple:{type:'field',supportedRoles:['category']},due:{type:'field',supportedRoles:['numeric']}},form:formFor([{key:'couple',label:'Couple'},{key:'due',label:'Deposit due'}]),
  ai:{label:'Still to pay scoreboard',description:'A friendly scoreboard of couples whose PayPal deposit is unpaid, largest first.'}},
 {id:'date-calendar',label:'Date calendar',comp:DateCalendar,defaultSize:{xSpan:10,ySpan:22},minSize:{xSpan:6,ySpan:14},
  dataMapping:{date:{type:'field',supportedRoles:['temporal','category']},status:{type:'field',supportedRoles:['category']}},form:formFor([{key:'date',label:'Wedding date'},{key:'status',label:'Status'}]),
  ai:{label:'Ballroom date calendar',description:'Month grid of booked (paid), held (invoiced or quoted) and open dates, weekends marked.'}},
 {id:'ballroom-preview',label:'Ballroom preview',comp:BallroomPreview,defaultSize:{xSpan:6,ySpan:22},minSize:{xSpan:5,ySpan:14},
  dataMapping:{couple:{type:'field',supportedRoles:['category']},tables:{type:'field',supportedRoles:['numeric']}},form:formFor([{key:'couple',label:'Couple'},{key:'tables',label:'Tables'}]),
  ai:{label:'Ballroom preview',description:'The selected booking drawn as a ballroom floor plan with its tables.'}}
];

const at=(xTrack,yTrack,xSpan,ySpan)=>({xTrack,yTrack,xSpan,ySpan});
const title=text=>({title:{enabled:true,text}});
const sum=id=>({id,aggregation:'sum'});
const kpi=(text,value)=>({type:'value',dataMapping:{value:[value]},format:title(text)});
export const OPENING_REPORT={selectedPageId:'pipeline',pages:[{id:'pipeline',name:'Wedding pipeline',
 widgets:{
  'kpi-enquiries':kpi('Enquiries',{id:'bookings.id',aggregation:'countd'}),
  'kpi-invoiced':kpi('Deposits invoiced',sum('bookings.depositInvoiced')),
  'kpi-paid':kpi('Paid with PayPal',sum('bookings.depositPaid')),
  'kpi-due':kpi('Still to collect',sum('bookings.depositDue')),
  status:{type:'list-filter',dataMapping:{value:[{id:'bookings.status'}]},format:title('Status')},
  pipeline:{type:'grid',dataMapping:{cols:[{id:'bookings.couple'},{id:'bookings.weddingDate'},{id:'bookings.status'},sum('bookings.tables'),sum('bookings.banquetTotal'),sum('bookings.depositPaid'),sum('bookings.depositDue')]},
   sort:[{field:{id:'bookings.weddingDate'},direction:'asc'}],format:title('Enquiry pipeline')},
  'deposits-by-month':{type:'column-chart-stacked',dataMapping:{categoryKey:[{id:'calendar::month'}],valueKey:[sum('bookings.depositPaid'),sum('bookings.depositDue')]},format:title('PayPal deposits by wedding month')},
  'still-to-pay':{type:'still-to-pay',dataMapping:{couple:[{id:'bookings.couple'}],due:[sum('bookings.depositDue')]},format:title('Still to pay')},
  calendar:{type:'date-calendar',dataMapping:{date:[{id:'bookings.weddingDate'}],status:[{id:'bookings.status'}]},format:title('Ballroom dates')},
  ballroom:{type:'ballroom-preview',dataMapping:{couple:[{id:'bookings.couple'}],tables:[{id:'bookings.tables',aggregation:'max'}]},format:title('Ballroom preview')}
 },
 widgetLayout:{
  'kpi-enquiries':at(0,0,6,7),'kpi-invoiced':at(6,0,6,7),'kpi-paid':at(12,0,6,7),'kpi-due':at(18,0,6,7),
  status:at(0,7,4,22),pipeline:at(4,7,13,22),'still-to-pay':at(17,7,7,22),
  'deposits-by-month':at(0,29,9,22),calendar:at(9,29,9,22),ballroom:at(18,29,6,22)
 }}]};

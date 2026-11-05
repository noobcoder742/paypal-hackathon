// The couple's agent tools. Every amount comes from src/data and server/pricing.js.
import {tool} from 'ai';
import {z} from 'zod';
import {CATALOG,STYLES,findItem} from '../../src/data/catalog.js';
import {VENUES,findVenue} from '../../src/data/venues.js';
import {vendorPlanTotals,banquetQuote,UnknownItemError,round2} from '../pricing.js';
import {createDepositOrder} from '../paypalApi.js';
const Lines=z.array(z.object({id:z.string(),qty:z.number().int().min(1).max(60)})).max(20);
const venueSummary=(v,tables)=>{let estimate=null;try{estimate=banquetQuote(v,tables).total}catch{}
 return {id:v.id,name:v.name,area:v.area,pricePerTable:v.banquet.pricePerTable,minTables:v.banquet.minTables,maxTables:v.banquet.maxTables,has3D:v.spaces.some(s=>s.studio),banquetEstimate:estimate}};
/** What the 3D room should show for these items. */
export function studioPatchFor(tables,lines){
 const items=lines.map(l=>findItem(l.id)).filter(Boolean),has=id=>items.some(i=>i.id===id),show={};
 if(items.some(i=>i.inventoryType==='arch'))show.arch=true;
 if(items.some(i=>i.inventoryType==='flowers'))show.decor=true;
 if(items.some(i=>i.inventoryType==='screen'))show.screen=true;
 const patch={tables};
 const flowers=has('floral-greenery')?'green':has('floral-roses')?'pink':has('floral-white')?'white':null;if(flowers)patch.flowers=flowers;
 if(has('light-ambient')||has('light-canopy'))patch.lighting='warm';
 if(Object.keys(show).length)patch.show=show;
 return patch;
}
function budgetCheck({venueId,tables,lines,budget}){
 const v=findVenue(venueId),problems=[];if(!v)return {ok:false,problems:['Unknown venue '+venueId]};
 let banquet=null,vendors={vendorTotal:0,lines:[]};
 try{banquet=banquetQuote(v,tables)}catch(e){problems.push(`${v.name} takes ${v.banquet.minTables}-${v.banquet.maxTables} tables, not ${tables} tables.`)}
 try{vendors=vendorPlanTotals(lines)}catch(e){if(e instanceof UnknownItemError)return {ok:false,problems:['Unknown item '+e.id+'. Use ids from search_vendors.']};problems.push(e.message)}
 const grandTotal=round2((banquet?.total||0)+vendors.vendorTotal);
 if(budget!=null&&banquet&&grandTotal>budget)problems.push(`This plan is S$${grandTotal.toLocaleString('en-SG')}, over the budget of S$${budget.toLocaleString('en-SG')} by S$${round2(grandTotal-budget).toLocaleString('en-SG')}.`);
 return {ok:!problems.length,banquetTotal:banquet?.total??null,vendorTotal:vendors.vendorTotal,grandTotal,remaining:budget!=null?round2(budget-grandTotal):null,problems};
}
export function coupleTools({store,planId}){
 return {
  search_venues:tool({description:'Find demo venues that can host the given number of banquet tables (10 guests each).',
   parameters:z.object({tables:z.number().int().min(1).max(200),area:z.string().optional()}),
   execute:async({tables,area})=>{const fit=VENUES.filter(v=>v.banquet&&tables>=v.banquet.minTables&&tables<=v.banquet.maxTables&&(!area||(v.area+' '+v.name).toLowerCase().includes(area.toLowerCase())));
    return {venues:fit.map(v=>venueSummary(v,tables)),note:fit.length?undefined:'No venue fits '+tables+' tables'+(area?' in '+area:'')}}}),
  search_vendors:tool({description:'Search the vendor catalogue. Returns item ids and prices to use in plans.',
   parameters:z.object({category:z.string().optional(),style:z.enum(STYLES).optional(),maxPrice:z.number().optional()}),
   execute:async({category,style,maxPrice})=>({items:CATALOG.filter(i=>i.price!=null&&(!category||i.category.toLowerCase().includes(category.toLowerCase()))&&(!style||i.style.includes(style))&&(maxPrice==null||i.price<=maxPrice)).map(({id,category,name,vendor,price,unit,style})=>({id,category,name,vendor,price,unit,style}))})}),
  check_budget:tool({description:'Check a plan against the venue capacity and the budget (S$, including the venue ++).',
   parameters:z.object({venueId:z.string(),tables:z.number().int(),lines:Lines,budget:z.number().optional()}),
   execute:async a=>budgetCheck(a)}),
  place_in_ballroom:tool({description:'Save the plan and show the chosen items in the 3D ballroom.',
   parameters:z.object({venueId:z.string(),tables:z.number().int(),lines:Lines,budget:z.number().optional()}),
   execute:async({venueId,tables,lines,budget})=>{
    for(const l of lines)if(!findItem(l.id))return {error:'unknown_item',id:l.id};
    const check=budgetCheck({venueId,tables,lines,budget});if(check.problems.some(p=>/tables|Unknown/.test(p)))return {error:'invalid_plan',problems:check.problems};
    const totals=vendorPlanTotals(lines),plan={planId,venueId,tables,budget:budget??null,lines,totals,studioPatch:studioPatchFor(tables,lines),savedAt:Date.now()};
    await store.set('plan:'+planId,plan);
    return {venueId,venueName:findVenue(venueId).name,studioPatch:plan.studioPatch,totals,banquetTotal:check.banquetTotal,grandTotal:check.grandTotal,remaining:check.remaining}}}),
  create_deposit_order:tool({description:'Create the PayPal sandbox order for 20% deposits on every vendor item in the saved plan. The couple approves it in PayPal; nothing is charged before that.',
   // One optional field: Gemini (the fallback model) rejects a tool with no parameters. The plan always comes from the session.
   parameters:z.object({note:z.string().max(200).optional().describe('Optional note for the couple; leave empty.')}),
   execute:async()=>{const plan=await store.get('plan:'+planId);if(!plan)return {error:'no_plan',message:'Place the plan in the ballroom first.'};
    let totals;try{totals=vendorPlanTotals(plan.lines)}catch(e){return {error:'invalid_plan',message:e.message}}
    const order=await createDepositOrder({planId,totals});
    await store.set('order:'+order.id,{planId,depositTotal:totals.depositTotal,lines:totals.lines,status:'created'});
    return {orderId:order.id,depositTotal:totals.depositTotal,commissionTotal:totals.commissionTotal,lines:totals.lines}}}),
  send_enquiry:tool({description:'Send the saved plan to the venue as a qualified enquiry.',
   parameters:z.object({coupleName:z.string().min(1).max(80),email:z.string().email(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),
   execute:async({coupleName,email,date})=>{const plan=await store.get('plan:'+planId);if(!plan)return {error:'no_plan'};
    const id='enq-'+planId.slice(-8)+'-'+Date.now().toString(36);
    await store.set('enquiry:'+id,{id,planId,venueId:plan.venueId,tables:plan.tables,budget:plan.budget,date,coupleName,email,items:plan.lines,status:'new',createdAt:Date.now()});
    return {enquiryId:id,venueName:findVenue(plan.venueId).name}}})
 };
}

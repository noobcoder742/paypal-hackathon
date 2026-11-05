// All money in the demo is computed here, never by a model (spec: "Amounts are
// enforced in code, not in the prompt"). Currency is SGD.
import {findItem} from '../src/data/catalog.js';
export const DEPOSIT_RATE=.2,COMMISSION_RATE=.1,SERVICE_RATE=.1,GST_RATE=.09,BANQUET_DEPOSIT_RATE=.3,MAX_QTY=60;
export class UnknownItemError extends Error{constructor(id){super('unknown item '+id);this.id=id}}
export const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function lineDeposit(item,qty){
 if(!Number.isInteger(qty)||qty<1||qty>MAX_QTY)throw new RangeError(`quantity must be 1-${MAX_QTY}`);
 if(item.price==null)throw new RangeError(item.id+' is priced on request');
 const total=round2(item.price*qty);return {total,deposit:round2(total*DEPOSIT_RATE),commission:round2(total*COMMISSION_RATE)};
}
export function vendorPlanTotals(lines){
 const out=lines.map(({id,qty})=>{const item=findItem(id);if(!item)throw new UnknownItemError(id);const d=lineDeposit(item,qty);
  return {id,name:item.name,vendor:item.vendor,qty,unitPrice:item.price,...d}});
 const sum=k=>round2(out.reduce((n,l)=>n+l[k],0));
 return {lines:out,vendorTotal:sum('total'),depositTotal:sum('deposit'),commissionTotal:sum('commission')};
}
export function banquetQuote(venue,tables){
 const b=venue?.banquet;if(!b)throw new RangeError('venue has no banquet pricing');
 if(!Number.isInteger(tables)||tables<b.minTables||tables>b.maxTables)throw new RangeError(`tables must be ${b.minTables}-${b.maxTables}`);
 const subtotal=round2(tables*b.pricePerTable),serviceCharge=round2(subtotal*SERVICE_RATE),gst=round2((subtotal+serviceCharge)*GST_RATE),total=round2(subtotal+serviceCharge+gst);
 return {subtotal,serviceCharge,gst,total,deposit:round2(total*BANQUET_DEPOSIT_RATE)};
}

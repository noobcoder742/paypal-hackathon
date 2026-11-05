// Captures a deposit order after the couple approved it in PayPal.
// Idempotent, and checked against the amount stored for that order (not the latest plan).
import {round2} from './pricing.js';
export async function captureOrder({orderId,store,paypalFetch}){
 if(!/^[A-Z0-9-]{3,40}$/i.test(orderId||''))return {error:'unknown_order'};
 const key='order:'+orderId,order=await store.get(key);if(!order)return {error:'unknown_order'};
 if(order.status==='captured')return {status:'COMPLETED',depositTotal:order.depositTotal,lines:order.lines,captureId:order.captureId};
 let res;try{res=await paypalFetch(`/v2/checkout/orders/${orderId}/capture`,{method:'POST',headers:{'PayPal-Request-Id':'capture-'+orderId},body:'{}'})}
 catch(e){await store.set(key,{...order,status:'capture_failed',error:e.message});return {status:'FAILED',reason:e.message}}
 const cap=res?.purchase_units?.[0]?.payments?.captures?.[0],amount=cap?round2(parseFloat(cap.amount.value)):null;
 if(res?.status!=='COMPLETED'||cap?.amount?.currency_code!=='SGD'||amount!==order.depositTotal){await store.set(key,{...order,status:'mismatch',captured:cap?.amount||null});return {status:'FAILED',reason:'amount_mismatch'}}
 await store.set(key,{...order,status:'captured',captureId:cap.id,capturedAt:Date.now()});
 return {status:'COMPLETED',depositTotal:order.depositTotal,lines:order.lines,captureId:cap.id};
}

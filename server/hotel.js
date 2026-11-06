// The hotel side: demo login, the PayPal invoice for the banquet deposit, reminders, invoice status.
// Amounts come from the venue data and server/pricing.js only; quote text never sets an amount.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {findVenue} from '../src/data/venues.js';
import {banquetQuote} from './pricing.js';
import {runPayPalTool} from './paypal.js';
const TOKEN_TTL=12*3600;

export async function login({store,password}){
 const expected=(process.env.HOTEL_DEMO_PASSWORD||'').trim();
 if(!expected||typeof password!=='string')return null;
 const a=Buffer.from(password.trim()),b=Buffer.from(expected);   // stray spaces from copy-paste or autofill
 if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 const token=randomBytes(32).toString('hex');
 await store.set('hotel-token:'+token,{at:Date.now()},{ttlSeconds:TOKEN_TTL});
 return token;
}
export async function requireHotel(request,store){
 const m=(request.headers.get('authorization')||'').match(/^Bearer ([a-f0-9]{64})$/);
 if(!m)return false;
 return !!(await store.get('hotel-token:'+m[1]));
}
export function quoteFor(enquiry){
 const v=findVenue(enquiry.venueId);
 return {venueName:v.name,pricePerTable:v.banquet.pricePerTable,...banquetQuote(v,enquiry.tables)};
}
const invoiceIdOf=r=>r?.id||String(r?.href||'').split('/').pop();

export async function approveEnquiry({store,enquiryId}){
 const enquiry=await store.get('enquiry:'+enquiryId);
 if(!enquiry)return {error:'unknown_enquiry'};
 const existing=await store.get('invoice:'+enquiryId);
 if(existing)return existing;
 const q=quoteFor(enquiry);
 const names=String(enquiry.coupleName||'Couple').split(' ');
 const created=await runPayPalTool('create_invoice',{
  currency_code:'SGD',
  note:`Deposit to hold ${q.venueName} for ${enquiry.date}. Fictional demo venue, PayPal sandbox.`,
  invoicer_business_name:q.venueName,
  primary_recipients:[{billing_info:{email_address:enquiry.email,name:{given_name:names[0],surname:names.slice(1).join(' ')||'-'}}}],
  items:[{name:`Banquet deposit (30%) — ${enquiry.date}, ${enquiry.tables} tables`,quantity:'1',
   unit_amount:{currency_code:'SGD',value:q.deposit.toFixed(2)},
   description:`Banquet S$${q.total.toLocaleString('en-SG')} incl. 10% service and 9% GST`}]
 });
 const invoiceId=invoiceIdOf(created);
 if(!invoiceId)return {error:'invoice_failed'};
 const sent=await runPayPalTool('send_invoice',{invoice_id:invoiceId,send_to_recipient:true});
 const rec={enquiryId,invoiceId,amount:q.deposit,total:q.total,status:'SENT',payLink:sent?.href||null,sentAt:Date.now()};
 await store.set('invoice:'+enquiryId,rec);
 await store.set('enquiry:'+enquiryId,{...enquiry,status:'invoiced'});
 return rec;
}
export const draftNudgeCheck=text=>typeof text==='string'&&text.trim().length>0&&text.length<=400?{ok:true}:{ok:false,error:'Reminders are 1-400 characters.'};
export async function sendNudge({store,enquiryId,text}){
 const c=draftNudgeCheck(text);
 if(!c.ok)return {error:c.error};
 const inv=await store.get('invoice:'+enquiryId);
 if(!inv)return {error:'no_invoice'};
 await runPayPalTool('send_invoice_reminder',{invoice_id:inv.invoiceId,subject:'A friendly reminder about your wedding date',note:text});
 const rec={...inv,lastReminderAt:Date.now(),reminders:(inv.reminders||0)+1};
 await store.set('invoice:'+enquiryId,rec);
 return rec;
}
export async function invoiceStatus({store,enquiryId}){
 const inv=await store.get('invoice:'+enquiryId);
 if(!inv)return {status:'NONE'};
 if(inv.status!=='PAID'){
  try{
   const r=await runPayPalTool('get_invoice',{invoice_id:inv.invoiceId});
   const status=r?.status||inv.status,payLink=r?.detail?.metadata?.recipient_view_url||inv.payLink;
   if(status!==inv.status||payLink!==inv.payLink){
    Object.assign(inv,{status,payLink});await store.set('invoice:'+enquiryId,inv);
    if(status==='PAID'){const e=await store.get('enquiry:'+enquiryId);if(e)await store.set('enquiry:'+enquiryId,{...e,status:'paid'})}
   }
  }catch{}
 }
 return {status:inv.status,amount:inv.amount,payLink:inv.payLink};
}

// The vendor side: company-email sign-in, bookings created when a couple's PayPal deposit is
// captured, the balance invoice (PayPal Agent Toolkit), reminders and payment status.
// Amounts come from the order's server-computed lines only.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {companyForEmail,vendorByName,vendorById} from '../src/data/vendors.js';
import {round2} from './pricing.js';
import {runPayPalTool} from './paypal.js';

const TOKEN_TTL=12*3600,OVERDUE_DAYS=14;
const demoPassword=()=>(process.env.DEMO_PASSWORD||process.env.HOTEL_DEMO_PASSWORD||'').trim();

/** {token, vendor} or {error: 'invalid_email'|'venue_coming_soon'|'unknown_company'|'wrong_password'|'not_configured'} */
export async function vendorLogin({store,email,password}){
 const c=companyForEmail(email);
 if(c.kind==='invalid')return {error:'invalid_email'};
 if(c.kind==='venue')return {error:'venue_coming_soon'};
 if(c.kind==='unknown')return {error:'unknown_company'};
 const expected=demoPassword();if(!expected)return {error:'not_configured'};
 const a=Buffer.from(String(password||'').trim()),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))return {error:'wrong_password'};
 const token=randomBytes(32).toString('hex');
 await store.set('vendor-token:'+token,{vendorId:c.vendor.id,email:String(email).trim().toLowerCase(),at:Date.now()},{ttlSeconds:TOKEN_TTL});
 return {token,vendor:c.vendor};
}
/** The signed-in vendor's id, or null. */
export async function requireVendor(request,store){
 const m=(request.headers.get('authorization')||'').match(/^Bearer ([a-f0-9]{64})$/);
 if(!m)return null;
 const s=await store.get('vendor-token:'+m[1]);
 return s&&vendorById(s.vendorId)?s.vendorId:null;
}

const key=(vendorId,id)=>`vbooking:${vendorId}:${id}`;
/** After a deposit order is captured: one booking per order line, filed under that line's vendor. Idempotent. */
export async function recordBookings({store,orderId,planId=null,lines=[],capture}){
 const plan=planId?await store.get('plan:'+planId):null;
 const payer=capture?.payer||{},name=[payer.name?.given_name,payer.name?.surname].filter(Boolean).join(' ')||'Couple';
 const email=payer.email_address||null;
 for(const [i,l] of lines.entries()){
  const v=vendorByName(l.vendor);if(!v)continue;   // e.g. hotel catering: not a vendor workspace
  const id=`${orderId}-${i+1}`;
  if(await store.get(key(v.id,id)))continue;
  const total=round2(l.total),deposit=round2(l.deposit);
  await store.set(key(v.id,id),{id,vendorId:v.id,orderId,itemId:l.id,itemName:l.name,qty:l.qty,total,deposit,balance:round2(total-deposit),
   couple:name,email,weddingDate:null,planId,venueId:plan?.venueId||null,tables:plan?.tables||null,planLines:(plan?.lines||[]).map(x=>({id:x.id,qty:x.qty})),createdAt:Date.now(),seen:false,invoice:null,events:[{type:'deposit',at:Date.now(),amount:deposit}]});
 }
}
export async function listBookings({store,vendorId}){
 const list=(await store.list(`vbooking:${vendorId}:`)).map(x=>x.value).sort((a,b)=>b.createdAt-a.createdAt);
 // the wedding date arrives with the couple's enquiry to the venue (same plan)
 if(list.some(b=>!b.weddingDate&&b.planId)){
  const dates=new Map((await store.list('enquiry:')).map(e=>[e.value.planId,e.value.date]));
  for(const b of list)if(!b.weddingDate&&dates.get(b.planId))b.weddingDate=dates.get(b.planId);
 }
 return list;
}
async function getOwn(store,vendorId,bookingId){
 if(!/^[A-Za-z0-9-]{3,80}$/.test(String(bookingId||'')))return null;
 return store.get(key(vendorId,bookingId));
}
export async function markSeen({store,vendorId,bookingId}){
 const b=await getOwn(store,vendorId,bookingId);if(!b)return {error:'unknown_booking'};
 if(!b.seen){b.seen=true;await store.set(key(vendorId,bookingId),b)}
 return {booking:b};
}
/** Status for colour coding. 'new' until the vendor opens it. */
export function bookingStatus(b,now=Date.now()){
 if(b.invoice?.status==='PAID')return 'paid_in_full';
 if(!b.seen)return 'new';
 if(b.invoice){return now-b.invoice.sentAt>OVERDUE_DAYS*864e5?'overdue':'balance_invoiced'}
 return 'deposit_paid';
}
const invoiceIdOf=r=>r?.id||String(r?.href||'').split('/').pop();
/** Sends the balance (total − deposit) as a PayPal invoice to the couple. Sending again returns the same invoice. */
export async function sendBalanceInvoice({store,vendorId,bookingId}){
 const b=await getOwn(store,vendorId,bookingId);if(!b)return {error:'unknown_booking'};
 if(b.invoice)return {booking:b,invoice:b.invoice};
 if(!b.email)return {error:'no_couple_email'};
 const v=vendorById(vendorId),names=String(b.couple).split(' ');
 const created=await runPayPalTool('create_invoice',{
  currency_code:'SGD',invoicer_business_name:v.name,
  note:`Balance for your wedding booking with ${v.name}. Your 20% deposit of S$${b.deposit.toLocaleString('en-SG')} is already paid. Fictional demo vendor, PayPal sandbox.`,
  primary_recipients:[{billing_info:{email_address:b.email,name:{given_name:names[0],surname:names.slice(1).join(' ')||'-'}}}],
  items:[{name:`${b.itemName} — balance (80%)`,quantity:'1',unit_amount:{currency_code:'SGD',value:b.balance.toFixed(2)},
   description:`Total S$${b.total.toLocaleString('en-SG')}, deposit paid S$${b.deposit.toLocaleString('en-SG')}`}]});
 const id=invoiceIdOf(created);if(!id)return {error:'invoice_failed'};
 const sent=await runPayPalTool('send_invoice',{invoice_id:id,send_to_recipient:true});
 b.seen=true;b.invoice={id,status:'SENT',amount:b.balance,payLink:sent?.href||null,sentAt:Date.now(),reminders:0};
 b.events=[...(b.events||[]),{type:'invoice',at:Date.now(),amount:b.balance}];
 await store.set(key(vendorId,bookingId),b);
 return {booking:b,invoice:b.invoice};
}
export const reminderCheck=text=>typeof text==='string'&&text.trim().length>0&&text.length<=400;
export async function sendBalanceReminder({store,vendorId,bookingId,text}){
 if(!reminderCheck(text))return {error:'Reminders are 1-400 characters.'};
 const b=await getOwn(store,vendorId,bookingId);if(!b)return {error:'unknown_booking'};
 if(!b.invoice)return {error:'no_invoice'};
 await runPayPalTool('send_invoice_reminder',{invoice_id:b.invoice.id,subject:'A friendly reminder about your wedding booking',note:text});
 b.invoice={...b.invoice,reminders:(b.invoice.reminders||0)+1,lastReminderAt:Date.now()};
 b.events=[...(b.events||[]),{type:'reminder',at:Date.now()}];
 await store.set(key(vendorId,bookingId),b);
 return {booking:b};
}
/** Asks PayPal whether the balance invoice is paid. */
export async function refreshBooking({store,vendorId,bookingId}){
 const b=await getOwn(store,vendorId,bookingId);if(!b)return {error:'unknown_booking'};
 if(b.invoice&&b.invoice.status!=='PAID'){
  const r=await runPayPalTool('get_invoice',{invoice_id:b.invoice.id});
  const status=r?.status||b.invoice.status;
  if(status!==b.invoice.status){b.invoice={...b.invoice,status,payLink:r?.detail?.metadata?.recipient_view_url||b.invoice.payLink};
   if(status==='PAID')b.events=[...(b.events||[]),{type:'paid',at:Date.now(),amount:b.invoice.amount}];
   await store.set(key(vendorId,bookingId),b)}
 }
 return {booking:b};
}

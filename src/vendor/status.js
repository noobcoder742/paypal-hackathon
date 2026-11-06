// Booking statuses (one colour each, always shown with a text label), example bookings for the
// demo, and the rows the Insights dashboard reads.
import {CATALOG} from '../data/catalog.js';

export const STATUSES=[
 {key:'new',label:'New',hint:'Not opened yet'},
 {key:'deposit_paid',label:'Deposit paid',hint:'20% in through PayPal'},
 {key:'balance_invoiced',label:'Balance invoiced',hint:'PayPal invoice sent'},
 {key:'overdue',label:'Overdue',hint:'Invoice unpaid after 14 days'},
 {key:'paid_in_full',label:'Paid in full',hint:'All settled'},
];
export const statusMeta=key=>STATUSES.find(s=>s.key===key)||STATUSES[1];
export const isPaidInFull=b=>b.status==='paid_in_full';
export const balanceDue=b=>isPaidInFull(b)?0:b.balance;

const COUPLES=['Rachel & Ben','Siti & Amir','Clara & Ethan','Joanne & Kelvin','Nadia & Farhan','Wen Hui & Daryl','Priya & Arjun','Hui Min & Jason'];
const PLAN=['new','deposit_paid','deposit_paid','balance_invoiced','overdue','balance_invoiced','paid_in_full','paid_in_full'];
/** Eight labelled example bookings for this vendor, built from its own catalogue items. */
export function exampleBookings(vendor,now=Date.now()){
 const items=CATALOG.filter(i=>i.vendor===vendor?.name&&i.price!=null);
 if(!items.length)return [];
 return COUPLES.map((c,i)=>{
  const item=items[i%items.length],qty=item.unit==='table'||item.unit==='arrangement'?[24,30,18,26,34,22,28,30][i]:1;
  const total=Math.round(item.price*qty*100)/100,deposit=Math.round(total*20)/100,balance=Math.round((total-deposit)*100)/100;
  const status=PLAN[i],day=new Date(Date.UTC(2027,1+i,6+i*3));
  const created=now-(i===0?2:i*6+3)*864e5;
  const invoice=['balance_invoiced','overdue','paid_in_full'].includes(status)?{id:'EXAMPLE',status:status==='paid_in_full'?'PAID':'SENT',amount:balance,sentAt:created+864e5*(status==='overdue'?1:3),reminders:status==='overdue'?1:0}:null;
  const events=[{type:'deposit',at:created,amount:deposit},...(invoice?[{type:'invoice',at:invoice.sentAt,amount:balance}]:[]),...(status==='overdue'?[{type:'reminder',at:invoice.sentAt+12*864e5}]:[]),...(status==='paid_in_full'?[{type:'paid',at:invoice.sentAt+5*864e5,amount:balance}]:[])];
  return {id:`example-${vendor.id}-${i+1}`,isExample:true,couple:c+' (example)',email:null,itemId:item.id,itemName:item.name,qty,total,deposit,balance,
   weddingDate:day.toISOString().slice(0,10),createdAt:created,seen:status!=='new',status,invoice,events};
 });
}
/** One row per booking for AG Studio (fields documented in insights.js). */
export function studioRows(bookings){
 return bookings.map(b=>({id:b.id,couple:b.couple,item:b.itemName,status:b.status,statusLabel:statusMeta(b.status).label,
  weddingDate:b.weddingDate||null,weddingMonth:b.weddingDate?b.weddingDate.slice(0,7):'Date to confirm',
  total:b.total,deposit:b.deposit,balance:b.balance,balanceDue:balanceDue(b),paidInFull:isPaidInFull(b)?b.balance:0,
  reminders:b.invoice?.reminders||0,isExample:!!b.isExample}));
}
export const sgd=n=>'S$'+Number(n||0).toLocaleString('en-SG',{minimumFractionDigits:0,maximumFractionDigits:2});

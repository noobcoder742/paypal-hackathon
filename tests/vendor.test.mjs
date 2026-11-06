import test from 'node:test';import assert from 'node:assert/strict';
import {getStore,resetMemoryStore} from '../server/store.js';
import {setPayPalToolkitFactory} from '../server/paypal.js';
import {vendorLogin,requireVendor,recordBookings,listBookings,markSeen,sendBalanceInvoice,sendBalanceReminder,refreshBooking,bookingStatus} from '../server/vendor.js';
import {companyForEmail} from '../src/data/vendors.js';

const PW='hackathondemo2026';
const withPw=async fn=>{const s=process.env.HOTEL_DEMO_PASSWORD;process.env.HOTEL_DEMO_PASSWORD=PW;delete process.env.DEMO_PASSWORD;try{await fn()}finally{process.env.HOTEL_DEMO_PASSWORD=s}};
const req=token=>new Request('http://x/api/vendor/bookings',{headers:{authorization:'Bearer '+token}});
function fakeToolkit(){const calls=[];setPayPalToolkitFactory(()=>({getTools:()=>({
 create_invoice:{execute:async a=>{calls.push(['create',a]);return {href:'https://api/v2/invoicing/invoices/INV2-'+calls.length}}},
 send_invoice:{execute:async a=>{calls.push(['send',a]);return {href:'https://pay/INV'}}},
 send_invoice_reminder:{execute:async a=>{calls.push(['remind',a]);return {}}},
 get_invoice:{execute:async a=>{calls.push(['get',a]);return {status:'PAID'}}}})}));return calls}

test('company email routes to the vendor, venues are coming soon, unknown companies are refused',async()=>{await withPw(async()=>{
 resetMemoryStore();const store=getStore();
 assert.equal(companyForEmail('Anna@PetalAndStem.sg ').vendor.id,'petal-stem');
 const ok=await vendorLogin({store,email:'anna@petalandstem.sg',password:` ${PW} `});
 assert.equal(ok.vendor.id,'petal-stem');assert.match(ok.token,/^[a-f0-9]{64}$/);
 assert.equal(await requireVendor(req(ok.token),store),'petal-stem');
 assert.equal((await vendorLogin({store,email:'sales@orchardgrand.sg',password:PW})).error,'venue_coming_soon');
 assert.equal((await vendorLogin({store,email:'me@gmail.com',password:PW})).error,'unknown_company');
 assert.equal((await vendorLogin({store,email:'anna@petalandstem.sg',password:'nope'})).error,'wrong_password');
 assert.equal(await requireVendor(req('f'.repeat(64)),store),null);
})});

const capture={payer:{name:{given_name:'Mei',surname:'Tan'},email_address:'mei@example.com'}};
const lines=[{id:'floral-arch',name:'Ceremony floral arch',vendor:'Petal & Stem Floral Studio (demo)',qty:1,unitPrice:980,total:980,deposit:196,commission:98},
 {id:'music-jazz',name:'Jazz band',vendor:'Blue Note Collective (demo)',qty:1,unitPrice:1320,total:1320,deposit:264,commission:132}];

test('a captured deposit order creates one booking per vendor, with server-computed balances',async()=>{
 resetMemoryStore();const store=getStore();
 await recordBookings({store,orderId:'ORDER-1',lines,capture});
 await recordBookings({store,orderId:'ORDER-1',lines,capture});   // idempotent
 const mine=await listBookings({store,vendorId:'petal-stem'});
 assert.equal(mine.length,1);const b=mine[0];
 assert.deepEqual([b.couple,b.email,b.total,b.deposit,b.balance,b.seen],['Mei Tan','mei@example.com',980,196,784,false]);
 assert.equal(bookingStatus(b),'new');
 assert.equal((await listBookings({store,vendorId:'blue-note'}))[0].balance,1056);
});

test('balance invoice goes to the couple for exactly the balance; reminders and payment update the status; vendors stay in their lane',async()=>{
 resetMemoryStore();const store=getStore();const calls=fakeToolkit();
 await recordBookings({store,orderId:'ORDER-2',lines,capture});
 const [b]=await listBookings({store,vendorId:'petal-stem'});
 assert.equal((await sendBalanceInvoice({store,vendorId:'blue-note',bookingId:b.id})).error,'unknown_booking','another vendor cannot invoice it');
 await markSeen({store,vendorId:'petal-stem',bookingId:b.id});
 assert.equal(bookingStatus((await listBookings({store,vendorId:'petal-stem'}))[0]),'deposit_paid');
 const inv=await sendBalanceInvoice({store,vendorId:'petal-stem',bookingId:b.id});
 const create=calls.find(c=>c[0]==='create')[1];
 assert.equal(create.primary_recipients[0].billing_info.email_address,'mei@example.com');
 assert.equal(create.items[0].unit_amount.value,'784.00');assert.equal(create.currency_code,'SGD');
 assert.equal(inv.invoice.status,'SENT');
 assert.equal((await sendBalanceInvoice({store,vendorId:'petal-stem',bookingId:b.id})).invoice.id,inv.invoice.id,'sending twice does not create a second invoice');
 let cur=(await listBookings({store,vendorId:'petal-stem'}))[0];assert.equal(bookingStatus(cur),'balance_invoiced');
 assert.equal(bookingStatus(cur,cur.invoice.sentAt+15*864e5),'overdue');
 assert.equal((await sendBalanceReminder({store,vendorId:'petal-stem',bookingId:b.id,text:''})).error,'Reminders are 1-400 characters.');
 await sendBalanceReminder({store,vendorId:'petal-stem',bookingId:b.id,text:'A gentle heads-up about the balance.'});
 assert.ok(calls.some(c=>c[0]==='remind'));
 await refreshBooking({store,vendorId:'petal-stem',bookingId:b.id});
 cur=(await listBookings({store,vendorId:'petal-stem'}))[0];assert.equal(bookingStatus(cur),'paid_in_full');
});
import {captureOrder} from '../server/capture.js';
test('capturing a couple\'s PayPal deposit order files the bookings with each vendor',async()=>{
 resetMemoryStore();const store=getStore();
 await store.set('order:ORDER-9',{planId:'p',depositTotal:460,lines,status:'created'});
 const paypalFetch=async()=>({status:'COMPLETED',payer:capture.payer,purchase_units:[{payments:{captures:[{id:'CAP-1',amount:{currency_code:'SGD',value:'460.00'}}]}}]});
 const r=await captureOrder({orderId:'ORDER-9',store,paypalFetch});assert.equal(r.status,'COMPLETED');
 assert.equal((await listBookings({store,vendorId:'blue-note'}))[0].couple,'Mei Tan');
});

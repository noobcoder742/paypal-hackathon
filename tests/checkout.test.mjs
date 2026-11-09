import test from 'node:test';import assert from 'node:assert/strict';
import {quoteCart,createCheckout,cleanCart,CheckoutError} from '../server/checkout.js';
import {captureOrder} from '../server/capture.js';
import {getStore,resetMemoryStore} from '../server/store.js';
import {ensemblePrice} from '../src/studio/decor/ensembles.js';

test('the cart is priced on the server: listing prices, band line-ups, 20% deposits',()=>{
 const t=quoteCart({lines:[{id:'floral-arch',qty:1},{id:'music-strings',qty:1,lineup:{violin:4,cello:2}}]});
 const band=t.lines.find(l=>l.id==='music-strings');
 assert.equal(band.unitPrice,ensemblePrice('classical',{violin:4,cello:2}));
 assert.deepEqual(band.lineup,{violin:4,cello:2});
 assert.equal(t.depositTotal,Math.round(t.vendorTotal*20)/100);
 assert.equal(t.dueToday,t.depositTotal);assert.equal(t.discount,0);
});
test('a promo code takes a percentage off today\'s deposits; unknown codes are refused',()=>{
 const t=quoteCart({lines:[{id:'floral-arch',qty:1}],promo:' paypaldemo '});
 assert.equal(t.promo.code,'PAYPALDEMO');assert.equal(t.discount,Math.round(t.depositTotal*10)/100);assert.equal(t.dueToday,Math.round((t.depositTotal-t.discount)*100)/100);
 assert.throws(()=>quoteCart({lines:[{id:'floral-arch',qty:1}],promo:'FREEWEDDING'}),e=>e instanceof CheckoutError&&e.code==='bad_promo');
});
test('the browser cannot send prices, unknown items, quote-only items, bad quantities or duplicates',()=>{
 assert.deepEqual(cleanCart([{id:'floral-arch',qty:2,price:1}]),[{id:'floral-arch',qty:2}]);
 const code=f=>{try{f();return 'ok'}catch(e){return e.code}};
 assert.equal(code(()=>cleanCart([])),'empty_cart');
 assert.equal(code(()=>cleanCart([{id:'nope',qty:1}])),'unknown_item');
 assert.equal(code(()=>cleanCart([{id:'catering-banquet',qty:1}])),'quote_only');
 assert.equal(code(()=>cleanCart([{id:'floral-arch',qty:0}])),'bad_qty');
 assert.equal(code(()=>cleanCart([{id:'floral-arch',qty:1.5}])),'bad_qty');
 assert.equal(code(()=>cleanCart([{id:'floral-arch',qty:1},{id:'floral-arch',qty:1}])),'bad_cart');
});
test('checkout saves the plan and an order for the discounted amount, which capture then checks',async()=>{
 resetMemoryStore();const store=getStore();let sent;
 const r=await createCheckout({store,planId:'plan-cart-0001',lines:[{id:'floral-arch',qty:1},{id:'floral-greenery',qty:16}],promo:'PAYPALDEMO',venueId:'orchard-grand',tables:16,
  create:async({planId,totals})=>{sent={planId,totals};return {id:'ORDER-CART'}}});
 assert.equal(r.orderId,'ORDER-CART');assert.equal(sent.totals.dueToday,r.totals.dueToday);
 const order=await store.get('order:ORDER-CART'),plan=await store.get('plan:plan-cart-0001');
 assert.equal(order.depositTotal,r.totals.dueToday);assert.equal(order.promo.code,'PAYPALDEMO');
 assert.deepEqual([plan.venueId,plan.tables,plan.lines.length],['orchard-grand',16,2]);
 const paid=v=>async()=>({status:'COMPLETED',purchase_units:[{payments:{captures:[{id:'CAP',amount:{currency_code:'SGD',value:v}}]}}]});
 assert.equal((await captureOrder({orderId:'ORDER-CART',store,paypalFetch:paid(r.totals.depositTotal.toFixed(2))})).status,'FAILED','full price is not what was approved');
 await store.set('order:ORDER-CART',{...order,status:'created'});
 assert.equal((await captureOrder({orderId:'ORDER-CART',store,paypalFetch:paid(r.totals.dueToday.toFixed(2))})).status,'COMPLETED');
});
test('an AI plan keeps its venue and table count when the couple pays from the cart',async()=>{
 resetMemoryStore();const store=getStore();
 await store.set('plan:plan-ai-00000001',{planId:'plan-ai-00000001',venueId:'orchard-grand',tables:18,lines:[{id:'floral-arch',qty:1}]});
 await createCheckout({store,planId:'plan-ai-00000001',lines:[{id:'floral-arch',qty:1},{id:'light-canopy',qty:1}],create:async()=>({id:'ORDER-AI'})});
 const plan=await store.get('plan:plan-ai-00000001');assert.deepEqual([plan.venueId,plan.tables,plan.lines.length],['orchard-grand',18,2]);
});
test('Make payment: the order carries PayPal return and cancel links back to this site, and the approval link comes back',async()=>{
 resetMemoryStore();let sent;
 const r=await createCheckout({store:getStore(),planId:'plan-cart-0002',lines:[{id:'floral-arch',qty:1}],origin:'https://wedding-studio-gray.vercel.app',
  create:async args=>{sent=args;return {id:'ORDER-R',links:[{rel:'self',href:'https://api/x'},{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-R'}]}}});
 assert.equal(sent.returnUrl,'https://wedding-studio-gray.vercel.app/?checkout=return');
 assert.equal(sent.cancelUrl,'https://wedding-studio-gray.vercel.app/?checkout=cancel');
 assert.equal(r.approveUrl,'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-R');
});

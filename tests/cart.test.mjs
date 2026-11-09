import test from 'node:test';import assert from 'node:assert/strict';
import {cartItems,cartCount,orderLines,mergeLines,setQty,removeItem,markPaid,defaultQty,previewTotals} from '../src/components/cart/cart.js';
import {findItem} from '../src/data/catalog.js';
import {quoteCart} from '../server/checkout.js';

const saved=()=>[findItem('floral-greenery'),findItem('floral-arch'),{...findItem('music-strings'),lineup:{violin:3,cello:1}},findItem('catering-banquet')];

test('centrepieces default to one per table; other items to one',()=>{
 assert.equal(defaultQty(findItem('floral-greenery'),16),16);assert.equal(defaultQty(findItem('floral-arch'),16),1);
 assert.deepEqual(cartItems(saved(),16).map(i=>i.qty),[16,1,1,1]);
});
test('the browser sends ids, quantities and band line-ups only; quote-only items stay out of the order',()=>{
 const lines=orderLines(cartItems(saved(),16));
 assert.deepEqual(lines,[{id:'floral-greenery',qty:16},{id:'floral-arch',qty:1},{id:'music-strings',qty:1,lineup:{violin:3,cello:1}}]);
 assert.ok(lines.every(l=>!('price' in l)));
});
test('the instant preview matches what the server will charge',()=>{
 const items=cartItems(saved(),16),p=previewTotals(items),s=quoteCart({lines:orderLines(items)});
 assert.equal(p.vendorTotal,s.vendorTotal);assert.equal(p.depositTotal,s.depositTotal);
});
test('+/−, delete, items from the AI planner, and paid items leaving the cart',()=>{
 let s=saved();
 s=setQty(s,'floral-arch',3);assert.equal(s.find(i=>i.id==='floral-arch').qty,3);
 s=setQty(s,'floral-arch',0);assert.equal(s.find(i=>i.id==='floral-arch').qty,1,'never below one');
 s=removeItem(s,'catering-banquet');assert.equal(cartCount(s),3);
 s=mergeLines(s,[{id:'floral-greenery',qty:18},{id:'light-canopy',qty:1},{id:'nope',qty:1}]);
 assert.equal(s.find(i=>i.id==='floral-greenery').qty,18,'AI quantities update existing items');assert.equal(cartCount(s),4);
 s=markPaid(s,['floral-greenery','light-canopy'],{orderId:'CAP-1'});
 assert.equal(cartCount(s),2,'paid items leave the cart');assert.equal(s.length,4,'and stay in the planner');
});

import test from 'node:test';import assert from 'node:assert/strict';
import {coupleTools} from '../server/agent/coupleTools.js';
import {setPayPalFetch} from '../server/paypalApi.js';
import {getStore,resetMemoryStore} from '../server/store.js';
const VENUE='orchard-grand';
function fakePayPal(){const calls=[];setPayPalFetch(async(path,init)=>{calls.push({path,init,body:init?.body?JSON.parse(init.body):null});return {id:'ORDER-'+calls.length,status:'CREATED'}});return calls}
const run=(tools,name,args)=>tools[name].execute(args,{toolCallId:'t',messages:[]});
test('over budget: no plan can work, and it says why',async()=>{
 resetMemoryStore();const t=coupleTools({store:getStore(),planId:'plan-a1b2c3d4'});
 const r=await run(t,'check_budget',{venueId:VENUE,tables:30,lines:[{id:'floral-arch',qty:1}],budget:5000});
 assert.equal(r.ok,false);assert.ok(r.problems.some(p=>/budget/i.test(p)),JSON.stringify(r.problems));
});
test('over capacity: 45 tables in a 38-table room is refused',async()=>{
 resetMemoryStore();const t=coupleTools({store:getStore(),planId:'plan-a1b2c3d4'});
 const r=await run(t,'check_budget',{venueId:VENUE,tables:45,lines:[],budget:200000});
 assert.equal(r.ok,false);assert.ok(r.problems.some(p=>/tables/i.test(p)));
});
test('deposit order: server-computed SGD amounts, one line per vendor item',async()=>{
 resetMemoryStore();const calls=fakePayPal();const store=getStore();const t=coupleTools({store,planId:'plan-a1b2c3d4'});
 await run(t,'place_in_ballroom',{venueId:VENUE,tables:30,lines:[{id:'floral-arch',qty:1},{id:'music-strings',qty:1}]});
 const r=await run(t,'create_deposit_order',{});
 assert.equal(r.depositTotal,366);assert.equal(calls.length,1);
 const pu=calls[0].body.purchase_units[0];assert.equal(pu.amount.currency_code,'SGD');assert.equal(pu.amount.value,'366.00');
 assert.deepEqual(pu.items.map(i=>i.unit_amount.value),['196.00','170.00']);
 const stored=await store.get('order:'+r.orderId);assert.equal(stored.depositTotal,366);assert.equal(stored.planId,'plan-a1b2c3d4');
});
test('unknown item: rejected, and no order is created',async()=>{
 resetMemoryStore();const calls=fakePayPal();const t=coupleTools({store:getStore(),planId:'plan-a1b2c3d4'});
 const p=await run(t,'place_in_ballroom',{venueId:VENUE,tables:30,lines:[{id:'gold-throne',qty:1}]});
 assert.deepEqual(p,{error:'unknown_item',id:'gold-throne'});
 const r=await run(t,'create_deposit_order',{});assert.ok(r.error);assert.equal(calls.length,0);
});
test('placing items returns a studio patch derived from the items',async()=>{
 resetMemoryStore();const t=coupleTools({store:getStore(),planId:'plan-a1b2c3d4'});
 const r=await run(t,'place_in_ballroom',{venueId:VENUE,tables:30,lines:[{id:'floral-arch',qty:1},{id:'floral-greenery',qty:30},{id:'light-canopy',qty:1}]});
 assert.deepEqual(r.studioPatch,{tables:30,flowers:'green',lighting:'warm',show:{arch:true,decor:true}});
});

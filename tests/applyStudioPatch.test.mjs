import test from 'node:test';import assert from 'node:assert/strict';
import {applyStudioPatch,ROOM} from '../src/explorer/agent/applyStudioPatch.js';
const base=()=>({tables:Array.from({length:20},(_,i)=>({id:i+1,x:0,z:0,chairs:10,gap:.22,rotation:0,title:i===0?'Family':undefined})),theme:'ivory',flowers:'white',lighting:'bright',inventory:['table','flowers','stage'],showDecor:true,showArch:false,showScreen:false,showStage:true});
test('30 tables: unique ids, inside the room, existing titles kept',()=>{
 const l=applyStudioPatch(base(),{tables:30});
 assert.equal(l.tables.length,30);assert.equal(new Set(l.tables.map(t=>t.id)).size,30);
 for(const t of l.tables){assert.ok(t.x>ROOM.minX&&t.x<ROOM.maxX&&t.z>ROOM.minZ&&t.z<ROOM.maxZ,JSON.stringify(t))}
 assert.equal(l.tables[0].title,'Family');
});
test('fewer tables keeps the first ones',()=>{const l=applyStudioPatch(base(),{tables:12});assert.deepEqual(l.tables.map(t=>t.id),[1,2,3,4,5,6,7,8,9,10,11,12])});
test('an arch, screen and decor are added to the room',()=>{
 const l=applyStudioPatch(base(),{show:{arch:true,screen:true,decor:true}});
 assert.ok(l.inventory.includes('arch')&&l.inventory.includes('screen'));assert.equal(l.showArch,true);assert.equal(l.showScreen,true);assert.equal(l.showDecor,true);
});
test('flowers, lighting and theme are applied; unknown values ignored',()=>{
 const l=applyStudioPatch(base(),{flowers:'green',lighting:'warm',theme:'sage'});assert.equal(l.flowers,'green');assert.equal(l.lighting,'warm');assert.equal(l.theme,'sage');
 const m=applyStudioPatch(base(),{flowers:'purple',theme:'neon',lighting:'disco'});assert.equal(m.flowers,'white');assert.equal(m.theme,'ivory');assert.equal(m.lighting,'bright');
});
test('the input layout is not modified',()=>{const b=base();applyStudioPatch(b,{tables:30,show:{arch:true}});assert.equal(b.tables.length,20);assert.equal(b.showArch,false)});
test('the agent can place decor from its plan (hedges, carpet runner)',()=>{
 const l=applyStudioPatch(base(),{place:['hedge','carpet','spaceship']});
 assert.ok((l.decor||[]).some(x=>x.type==='hedge'));assert.ok(l.carpet.tiles.length>0);
});
test('the agent\'s plan places its band, by genre',()=>{
 const l=applyStudioPatch(base(),{place:[{type:'ensemble',genre:'jazz'}]});
 const band=(l.decor||[]).find(x=>x.type==='ensemble');assert.equal(band?.genre,'jazz');
});
import {tableGrid,AISLE_HALF} from '../src/explorer/agent/applyStudioPatch.js';
test('table grid: up to 16 tables keep the centre aisle clear; tables never crowd (3.2 m apart) up to the room maximum of 24',()=>{
 const gap=g=>Math.min(...g.flatMap((a,i)=>g.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
 for(const n of [2,7,12,16]){const g=tableGrid(n);assert.equal(g.length,n);assert.ok(g.every(p=>Math.abs(p.z)>AISLE_HALF),n+' tables leave the aisle');if(n>1)assert.ok(gap(g)>=3.2,n+' tables spaced')}
 for(const n of [20,24]){const g=tableGrid(n);assert.equal(g.length,n);assert.ok(gap(g)>=3.19,n+' tables spaced');for(const p of g)assert.ok(p.x>ROOM.minX&&p.x<ROOM.maxX&&p.z>ROOM.minZ&&p.z<ROOM.maxZ)}
});

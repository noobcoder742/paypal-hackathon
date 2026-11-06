// Suggested floor plan for a booking: the room, tables either side of a centre aisle, and
// where each booked item goes. Items from the signed-in vendor are marked `mine`; other
// vendors' items stay grey. Metres, x along the room (stage at the left), z across it.
import {findItem} from '../data/catalog.js';

export const ROOM={w:31.4,d:22.6};
const X0=-ROOM.w/2,Z0=-ROOM.d/2;
export const STAGE={x:X0+.3,z:-5.1,w:3.4,d:10.2};            // against the left wall
const AISLE={x1:-10.6,x2:ROOM.w/2-.4,z1:-1.2,z2:1.2};           // centre aisle to the entrance
const ENTRANCE={x:ROOM.w/2,z:0};

/** Tables in two blocks either side of the aisle, clear of the stage and dance floor. */
export function planTables(n){
 const out=[],per=[Math.ceil(n/2),Math.floor(n/2)],x1=-6.6,x2=ROOM.w/2-1.6;
 per.forEach((count,side)=>{
  if(!count)return;
  const zA=side?2.6:Z0+1.4,zB=side?ROOM.d/2-1.4:-2.6,rows=Math.max(1,Math.round(Math.sqrt(count*(zB-zA)/(x2-x1)))),cols=Math.ceil(count/rows);
  for(let i=0;i<count;i++){const c=i%cols,r=Math.floor(i/cols);
   out.push({x:+(x1+(x2-x1)*(cols===1?.5:c/(cols-1))).toFixed(2),z:+(zA+(zB-zA)*(rows===1?.5:r/(rows-1))).toFixed(2)})}
 });
 return out;
}
// Where an item goes, by what it is.
function spotFor(item){
 const t=item.inventoryType,id=item.id;
 if(t==='flowers')return {kind:'centrepieces',label:item.name};
 if(t==='arch')return {kind:'zone',label:'Floral arch',x:-11.6,z:0,w:1,d:4.4};
 if(t==='hedge')return {kind:'zone',label:'Hedges',x:X0+4.2,z:-5.1,w:.6,d:10.2,row:true};
 if(t==='flowerStand')return {kind:'aisle-dots',label:'Aisle flower stands',offset:1.6,step:4};
 if(t==='lantern')return {kind:'aisle-dots',label:'Aisle lanterns',offset:1.25,step:4,start:-5};
 if(t==='carpet')return {kind:'zone',label:'Aisle carpet',x:AISLE.x1,z:AISLE.z1,w:AISLE.x2-AISLE.x1,d:AISLE.z2-AISLE.z1};
 if(t==='flowerWall')return {kind:'zone',label:'Flower wall',x:ROOM.w/2-.6,z:-8.5,w:.4,d:2.6};
 if(t==='ensemble')return {kind:'zone',label:item.genre==='classical'?'String ensemble':'Band',x:X0+.4,z:Z0+.4,w:4.6,d:4};
 if(t==='screen'||id==='av-led')return {kind:'zone',label:'LED screen',x:X0+.1,z:-3,w:.3,d:6};
 if(id==='light-canopy')return {kind:'zone',label:'Fairy-light canopy',x:-10.8,z:-4.6,w:4,d:9.2,soft:true};
 if(id==='light-ambient')return {kind:'perimeter',label:'Ambient uplights'};
 if(id==='light-stage')return {kind:'zone',label:'Stage spotlights',x:X0+3.9,z:-6,w:.5,d:12};
 if(id==='fun-photobooth')return {kind:'zone',label:'Photo booth',x:ROOM.w/2-3.6,z:Z0+.4,w:3.2,d:2.6};
 if(id==='dessert-table'||id==='catering-dessert')return {kind:'zone',label:'Dessert table',x:ROOM.w/2-3.6,z:ROOM.d/2-1.8,w:3.2,d:1.4};
 if(id==='catering-banquet')return {kind:'zone',label:'Banquet service',x:-6.6,z:Z0+.2,w:4,d:.8};
 if(id==='send-off-bubbles')return {kind:'entrance',label:'Bubble send-off at the doors'};
 if(item.category==='Chauffeur & Transport')return {kind:'entrance',label:'Arrival at the entrance'};
 return {kind:'entrance',label:item.name};
}

/**
 * @param {{tables:number, lines:{id,qty}[], vendorName:string}} p
 * @returns {{tables:{x,z,flowers:null|'mine'|'other'}[], zones:{label,x,z,w,d,mine,soft?}[], dots:{x,z,mine,label}[], perimeter:null|'mine'|'other', entrance:{label,mine}[], mine:string[], others:string[]}}
 */
export function suggestedPlan({tables=20,lines=[],vendorName}){
 const out={tables:planTables(Math.max(1,Math.min(80,tables||20))).map(t=>({...t,flowers:null})),zones:[],dots:[],perimeter:null,entrance:[],mine:[],others:[],aisle:AISLE,stage:STAGE,entranceAt:ENTRANCE};
 for(const l of lines){
  const item=findItem(l.id);if(!item)continue;
  const mine=item.vendor===vendorName,s=spotFor(item),label=item.name;
  (mine?out.mine:out.others).push(label);
  if(s.kind==='centrepieces'){for(const t of out.tables)if(t.flowers!=='mine')t.flowers=mine?'mine':'other'}
  else if(s.kind==='zone')out.zones.push({...s,mine});
  else if(s.kind==='aisle-dots'){for(let x=s.start??-7;x<=AISLE.x2-1;x+=s.step)for(const z of [-s.offset,s.offset])out.dots.push({x,z,mine,label:s.label})}
  else if(s.kind==='perimeter')out.perimeter=mine?'mine':(out.perimeter||'other');
  else out.entrance.push({label:s.label,mine});
 }
 return out;
}

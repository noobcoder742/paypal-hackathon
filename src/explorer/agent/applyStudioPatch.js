import {placeForListing,LISTING_DECOR} from '../../studio/decor/decor.js';
// Applies the planning agent's room changes to a saved ballroom layout (pure).
// patch: {tables?, theme?, flowers?, lighting?, show?:{arch?,decor?,stage?,screen?}}
import {palette} from '../../studio/palette.js';
/** The ballroom floor available for banquet tables (metres, studio coordinates; the stage is at the head wall, x≈-7). */
/** A plan from the "Plan with AI" panel waits under this key until the layout is next opened. */
export const pendingPatchKey=storageKey=>'wedding-agent-patch:'+storageKey;
export const ROOM={minX:-5.2,maxX:7.9,minZ:-9.6,maxZ:9.6};
const FLOWERS=['white','pink','green'],LIGHTING=['warm','bright'];
/** Half the width of the centre aisle the couple walks down (entrance at +x to the stage at -x). */
export const AISLE_HALF=1.4;
/**
 * n tables on an even grid across the room. Up to 16 tables keep the centre aisle clear
 * (two blocks either side); more than that need the whole floor, so the aisle closes.
 */
export function tableGrid(n){
 const w=ROOM.maxX-ROOM.minX,out=[];
 const cols=Math.max(1,Math.min(4,n)),aisle=n<=16;
 if(aisle){
  const sides=[Math.ceil(n/2),Math.floor(n/2)],d=ROOM.maxZ-AISLE_HALF;
  sides.forEach((count,k)=>{
   const c=Math.min(cols,count)||1,rows=Math.ceil(count/c),sx=w/c,sz=d/rows,sign=k?1:-1;
   for(let i=0;i<count;i++)out.push({x:+(ROOM.minX+sx*(i%c+.5)).toFixed(2),z:+(sign*(AISLE_HALF+sz*(Math.floor(i/c)+.5))).toFixed(2)});
  });
  return out;
 }
 const rows=Math.ceil(n/cols),sx=w/cols,sz=(ROOM.maxZ-ROOM.minZ)/rows;
 for(let i=0;i<n;i++)out.push({x:+(ROOM.minX+sx*(i%cols+.5)).toFixed(2),z:+(ROOM.minZ+sz*(Math.floor(i/cols)+.5)).toFixed(2)});
 return out;
}

export function applyStudioPatch(layout,patch={}){
 const l=structuredClone(layout);
 if(Number.isInteger(patch.tables)&&patch.tables>0&&patch.tables!==l.tables.length){
  if(patch.tables<l.tables.length)l.tables=l.tables.slice(0,patch.tables);
  else{const grid=tableGrid(patch.tables);let next=Math.max(0,...l.tables.map(t=>t.id))+1;
   l.tables=grid.map((p,i)=>({...(l.tables[i]||{id:next++,chairs:10,gap:.22,rotation:0}),x:p.x,z:p.z}))}
  if(!l.inventory.includes('table'))l.inventory=[...l.inventory,'table'];
 }
 if(patch.theme&&palette[patch.theme])l.theme=patch.theme;
 if(FLOWERS.includes(patch.flowers))l.flowers=patch.flowers;
 if(LIGHTING.includes(patch.lighting))l.lighting=patch.lighting;
 const map={arch:['arch','showArch'],decor:['flowers','showDecor'],stage:['stage','showStage'],screen:['screen','showScreen']};
 for(const [k,on] of Object.entries(patch.show||{})){const m=map[k];if(!m||!on)continue;if(!l.inventory.includes(m[0]))l.inventory=[...l.inventory,m[0]];l[m[1]]=true}
 let out=l;for(const t of patch.place||[]){const type=typeof t==='string'?t:t?.type;if(LISTING_DECOR.has(type))out=placeForListing(out,type,typeof t==='object'?t:{})}   // every vendor item in the plan: decor, music, lighting, booth, desserts, cars
 return out;
}

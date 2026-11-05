// Applies the planning agent's room changes to a saved ballroom layout (pure).
// patch: {tables?, theme?, flowers?, lighting?, show?:{arch?,decor?,stage?,screen?}}
import {palette} from '../../studio/palette.js';
/** The ballroom floor available for banquet tables (metres, studio coordinates; the stage is at x≈-14). */
/** A plan from the "Plan with AI" panel waits under this key until the layout is next opened. */
export const pendingPatchKey=storageKey=>'wedding-agent-patch:'+storageKey;
export const ROOM={minX:-10.2,maxX:14.2,minZ:-9.6,maxZ:9.6};
const FLOWERS=['white','pink','green'],LIGHTING=['warm','bright'];
/** n tables on an even grid, rows across the room. */
export function tableGrid(n){
 const w=ROOM.maxX-ROOM.minX,d=ROOM.maxZ-ROOM.minZ;let cols=Math.max(1,Math.round(Math.sqrt(n*w/d)));const rows=Math.ceil(n/cols);cols=Math.ceil(n/rows);
 const sx=w/cols,sz=d/rows,out=[];
 for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);out.push({x:+(ROOM.minX+sx*(c+.5)).toFixed(2),z:+(ROOM.minZ+sz*(r+.5)).toFixed(2)})}
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
 return l;
}

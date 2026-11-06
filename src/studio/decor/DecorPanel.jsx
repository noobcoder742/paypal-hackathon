// Sidebar controls for decor: add items, lay carpet, and edit the selected item.
import React from 'react';
import {Plus,Trash2,Copy,Brush,MousePointer2,RotateCw} from 'lucide-react';
import {DECOR_TYPES,CARPET_COLOURS,addDecor,removeDecor,updateDecor,hedgeRowForStage} from './decor.js';

const ADDABLE=[['arch','/thumbs/arch.png'],['flowerWall',null],['hedge',null],['flowerStand',null],['lantern',null]];
// Real-life photos for each item, like a marketplace listing (free Unsplash photos).
export const DECOR_PHOTOS={
 arch:'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=320&q=70',
 flowerWall:'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=320&q=70',
 hedge:'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=320&q=70',
 flowerStand:'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=320&q=70',
 lantern:'https://images.unsplash.com/photo-1525772764200-be829a350797?auto=format&fit=crop&w=320&q=70',
 carpet:'https://images.unsplash.com/photo-1460978812857-470ed1c77af0?auto=format&fit=crop&w=320&q=70',
};

export function DecorPanel({data,setData,setSelected,tool,setTool}){
 const count=t=>(data.decor||[]).filter(x=>x.type===t).length;
 const add=type=>{let id;setData(s=>{const n=addDecor(s,type,type==='arch'||type==='flowerWall'?{}:{x:-6+Math.random()*2,z:-2+Math.random()*4});id=n.decor[n.decor.length-1].id;return n});setTimeout(()=>id&&setSelected({type:'decor',id}),0);setTool('select')};
 const lineStage=()=>setData(s=>hedgeRowForStage(s.stage).reduce((acc,at)=>addDecor(acc,'hedge',at),s));
 const tiles=data.carpet?.tiles?.length||0;
 return <div className="decor-panel">
  <h3 className="decor-h">Decor <small>drag items in the room to move them</small></h3>
  {ADDABLE.map(([type])=><button key={type} type="button" className="inventory-item decor-item" onClick={()=>add(type)}>
   <span className="inventory-thumb"><img src={DECOR_PHOTOS[type]} alt="" loading="lazy"/></span>
   <span>{DECOR_TYPES[type].label}{count(type)>0&&<small className="decor-count"> · {count(type)} placed</small>}</span><strong><Plus size={13}/> Add</strong>
  </button>)}
  <button type="button" className="decor-line" onClick={lineStage}>Line the stage with hedges</button>
  <h3 className="decor-h">Aisle carpet <small>{tiles?`${tiles} m² laid`:'1 m tiles'}</small></h3>
  <div className="decor-carpet">
   <span className="inventory-thumb"><img src={DECOR_PHOTOS.carpet} alt="" loading="lazy"/></span>
   <div>
    <div className="decor-swatches">{Object.entries(CARPET_COLOURS).map(([k,c])=><button key={k} type="button" title={k} aria-label={k+' carpet'} className={(data.carpet?.color||'red')===k?'on':''} style={{background:c}} onClick={()=>setData(s=>({...s,carpet:{...(s.carpet||{tiles:[]}),color:k}}))}/>)}</div>
    <button type="button" className={'decor-tool'+(tool==='carpet'?' on':'')} onClick={()=>setTool(tool==='carpet'?'select':'carpet')}>{tool==='carpet'?<><MousePointer2 size={14}/> Done laying carpet</>:<><Brush size={14}/> Lay carpet</>}</button>
    {tiles>0&&<button type="button" className="remove-type" onClick={()=>setData(s=>({...s,carpet:{...s.carpet,tiles:[]}}))}>Clear carpet</button>}
   </div>
  </div>
  {tool==='carpet'&&<p className="muted">Drag across the floor to lay carpet, tile by tile. Start on carpet to remove it.</p>}
 </div>;
}

export function DecorInspector({data,setData,selected,setSelected}){
 const item=(data.decor||[]).find(x=>x.id===selected?.id);if(!item)return null;
 const deg=Math.round((item.rotation||0)*180/Math.PI);
 return <details className="settings-accordion studio-group selected-group" open><summary><MousePointer2 size={16}/> Selected item</summary><div className="settings-accordion-body">
  <p className="selected-name">{DECOR_TYPES[item.type].label}</p>
  <label>Rotation <b>{((deg%360)+360)%360}°</b></label>
  <input type="range" min="0" max="6.28" step="0.05" value={((item.rotation||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)} onChange={e=>setData(s=>updateDecor(s,item.id,{rotation:Number(e.target.value)}))}/>
  <div className="buttonrow">
   <button type="button" onClick={()=>setData(s=>updateDecor(s,item.id,{rotation:(item.rotation||0)+Math.PI/2}))}><RotateCw size={15}/> Turn 90°</button>
   <button type="button" onClick={()=>{let id;setData(s=>{const n=addDecor(s,item.type,{x:item.x+.8,z:item.z+.8,rotation:item.rotation});id=n.decor[n.decor.length-1].id;return n});setTimeout(()=>id&&setSelected({type:'decor',id}),0)}}><Copy size={15}/> Duplicate</button>
  </div>
  <p className="muted">Drag it in the room to move it. Flowers follow the arrangement colour in Style.</p>
  <button className="danger" type="button" onClick={()=>{setData(s=>removeDecor(s,item.id));setSelected(null)}}><Trash2 size={15}/> Remove</button>
 </div></details>;
}

// Sidebar for vendor items in the studio. Vendor items (decor, carpet, live music)
// come from the marketplace; this lists what's placed, lays carpet, and edits the
// selected item.
import React from 'react';
import {Trash2,Copy,Brush,MousePointer2,RotateCw,Store,ArrowRight} from 'lucide-react';
import {DECOR_TYPES,CARPET_COLOURS,addDecor,removeDecor,updateDecor,removeDecorType} from './decor.js';
import {GENRES,lineupText} from './ensembles.js';
import {LineupPicker} from '../../components/marketplace/LineupPicker.jsx';

// Real-life photos for each item, like a marketplace listing (free Unsplash photos).
// @placeholder DECOR_PHOTOS: hedge and carpet photos are close matches, not the exact item; swap for vendor photos.
export const DECOR_PHOTOS={
 arch:'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=320&q=70',
 flowerWall:'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=320&q=70',
 hedge:'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=320&q=70',
 flowerStand:'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=320&q=70',
 lantern:'https://images.unsplash.com/photo-1525772764200-be829a350797?auto=format&fit=crop&w=320&q=70',
 carpet:'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=320&q=70',
 classical:'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=320&q=70',
 jazz:'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=320&q=70',
 pop:'https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=320&q=70',
};

/** What vendors have put in the room, and the carpet controls once a runner is booked. */
export function VendorItems({data,setData,setSelected,tool,setTool,onOpenMarketplace}){
 const decor=data.decor||[];
 const groups=[];
 for(const it of decor){
  const key=it.type==='ensemble'?'band-'+it.genre:it.type;
  let g=groups.find(x=>x.key===key);
  if(!g){g={key,type:it.type,items:[],label:it.type==='ensemble'?GENRES[it.genre]?.label:DECOR_TYPES[it.type].label,photo:DECOR_PHOTOS[it.type==='ensemble'?it.genre:it.type]};groups.push(g)}
  g.items.push(it);
 }
 const hasCarpet=(data.inventory||[]).includes('carpet')||(data.carpet?.tiles?.length>0);
 const tiles=data.carpet?.tiles?.length||0;
 return <div className="decor-panel">
  <h3 className="decor-h">From vendors <small>booked on the marketplace</small></h3>
  {!groups.length&&!hasCarpet&&<p className="muted">Florals, carpet, hedges, lanterns and live music come from vendors. Add them from the marketplace and they appear in the room, ready to drag.</p>}
  {groups.map(g=><div key={g.key} className="inventory-item added vendor-row">
   <span className="inventory-thumb"><img src={g.photo} alt="" loading="lazy"/></span>
   <button type="button" className="vendor-row-main" onClick={()=>setSelected({type:'decor',id:g.items[0].id})}>
    <span>{g.label}</span><small>{g.type==='ensemble'?lineupText(g.items[0].genre,g.items[0].lineup):g.items.length>1?`${g.items.length} placed`:'Placed · drag to move'}</small>
   </button>
   <button type="button" className="remove-type" onClick={()=>{setData(s=>g.type==='ensemble'?{...s,decor:s.decor.filter(x=>!(x.type==='ensemble'&&x.genre===g.items[0].genre))}:removeDecorType(s,g.type));setSelected(null)}}>Remove</button>
  </div>)}
  {hasCarpet&&<div className="decor-carpet">
   <span className="inventory-thumb"><img src={DECOR_PHOTOS.carpet} alt="" loading="lazy"/></span>
   <div>
    <div className="decor-carpet-title">Aisle carpet <small>{tiles?`${tiles} m² laid`:'1 m tiles'}</small></div>
    <div className="decor-swatches">{Object.entries(CARPET_COLOURS).map(([k,c])=><button key={k} type="button" title={k} aria-label={k+' carpet'} className={(data.carpet?.color||'red')===k?'on':''} style={{background:c}} onClick={()=>setData(s=>({...s,carpet:{...(s.carpet||{tiles:[]}),color:k}}))}/>)}</div>
    <button type="button" className={'decor-tool'+(tool==='carpet'?' on':'')} onClick={()=>setTool(tool==='carpet'?'select':'carpet')}>{tool==='carpet'?<><MousePointer2 size={14}/> Done laying carpet</>:<><Brush size={14}/> Lay carpet</>}</button>
    {tiles>0&&<button type="button" className="remove-type" onClick={()=>setData(s=>({...s,carpet:{...s.carpet,tiles:[]}}))}>Clear carpet</button>}
    {tool==='carpet'&&<p className="muted">Drag across the floor to lay carpet, tile by tile. Start on carpet to remove it.</p>}
   </div>
  </div>}
  <button type="button" className="decor-market" onClick={onOpenMarketplace}><Store size={15}/> Add from the marketplace <ArrowRight size={14}/></button>
 </div>;
}

export function DecorInspector({data,setData,selected,setSelected,onBandLineup}){
 const item=(data.decor||[]).find(x=>x.id===selected?.id);if(!item)return null;
 const deg=Math.round((item.rotation||0)*180/Math.PI);
 const label=item.type==='ensemble'?GENRES[item.genre]?.label:DECOR_TYPES[item.type].label;
 return <details className="settings-accordion studio-group selected-group" open><summary><MousePointer2 size={16}/> Selected item</summary><div className="settings-accordion-body">
  <p className="selected-name">{label}</p>
  {item.type==='ensemble'&&<LineupPicker compact genre={item.genre} lineup={item.lineup} onChange={l=>onBandLineup?onBandLineup(item,l):setData(s=>updateDecor(s,item.id,{lineup:l}))}/>}
  <label>Rotation <b>{((deg%360)+360)%360}°</b></label>
  <input type="range" min="0" max="6.28" step="0.05" value={((item.rotation||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)} onChange={e=>setData(s=>updateDecor(s,item.id,{rotation:Number(e.target.value)}))}/>
  <div className="buttonrow">
   <button type="button" onClick={()=>setData(s=>updateDecor(s,item.id,{rotation:(item.rotation||0)+Math.PI/2}))}><RotateCw size={15}/> Turn 90°</button>
   {item.type!=='ensemble'&&<button type="button" onClick={()=>{let id;setData(s=>{const n=addDecor(s,item.type,{x:item.x+.8,z:item.z+.8,rotation:item.rotation});id=n.decor[n.decor.length-1].id;return n});setTimeout(()=>id&&setSelected({type:'decor',id}),0)}}><Copy size={15}/> Duplicate</button>}
  </div>
  <p className="muted">{item.type==='ensemble'?'Drag the band to move everyone together. The line-up and price update your marketplace booking.':'Drag it in the room to move it. Flowers follow the arrangement colour in Style.'}</p>
  <button className="danger" type="button" onClick={()=>{setData(s=>removeDecor(s,item.id));setSelected(null)}}><Trash2 size={15}/> Remove</button>
 </div></details>;
}

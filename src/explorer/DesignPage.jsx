// Design page: map-first venue selection, then the 3D ballroom studio with up
// to three drafts per space and a side-by-side comparison.
//
// First visit opens the venue map. Afterwards Design reopens the last draft,
// with a link back to the map to choose another venue.
import React,{useEffect,useState,useCallback} from 'react';
import {ArrowLeft,ArrowUpRight,Plus,Columns2,X,Trash2,Map as MapIcon} from 'lucide-react';
import VenueExplorer from './VenueExplorer.jsx';
import {VENUES,findVenue,findSpace} from '../data/venues.js';

const KEY='wedding-design-v1';
const BASE_STORAGE={'orchard-grand/grand-ballroom':'wedding-room-v1'};
export const MAX_DRAFTS_PER_VENUE=2;
const LETTERS=['A','B','C'];
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}};
const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
const storageFor=(studio,letter)=>{const base=BASE_STORAGE[studio]||('wedding-room:'+studio);return letter==='A'?base:base+':draft-'+letter};
const savedLayout=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};

function captureThumbnail(){
 const src=document.querySelector('.viewer canvas');if(!src)return null;
 try{const w=360,h=Math.round(src.height/src.width*w)||200,c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(src,0,0,w,h);return c.toDataURL('image/jpeg',.72)}catch{return null}
}
const emptyDrafts={list:['A'],active:'A',thumbs:{},savedAt:{}};
/** Drafts with a saved layout, per venue (shown on the map under the hotel name). */
export function savedDraftCounts(state=read()){
 const out={};
 for(const v of VENUES){let n=0;for(const sp of v.spaces){const d=state.drafts?.[sp.studio]||emptyDrafts;n+=d.list.filter(l=>savedLayout(storageFor(sp.studio,l))).length}if(n)out[v.id]=n}
 return out;
}
function summarise(layout){
 if(!layout)return null;
 const tables=layout.tables||[];
 return {tables:tables.length,seats:tables.reduce((s,t)=>s+(t.chairs||0),0),theme:layout.theme,lighting:layout.lighting==='warm'?'Warm evening':'Bright daylight',flowers:layout.flowers,items:(layout.inventory||[]).length};
}

export default function DesignPage({Studio,planner,onPlannerChange,onNavigate,initialMode}){
 const [state,setState]=useState(read);
 const [mode,setMode]=useState(()=>read().venueId?'studio':'map');
 const [comparing,setComparing]=useState(false);
 useEffect(()=>write(state),[state]);
 const venue=findVenue(state.venueId),space=findSpace(state.venueId,state.spaceId);
 const spaceKey=space?.studio;
 const drafts=(spaceKey&&state.drafts?.[spaceKey])||{list:['A'],active:'A',thumbs:{},savedAt:{}};
 const patchDrafts=useCallback(fn=>setState(s=>{const cur=(s.drafts?.[spaceKey])||{list:['A'],active:'A',thumbs:{},savedAt:{}};return {...s,drafts:{...(s.drafts||{}),[spaceKey]:fn(cur)}}}),[spaceKey]);

 // drafts across every space of this hotel count towards its limit of 2
 const venueDraftTotal=venue?venue.spaces.reduce((n,sp)=>n+((state.drafts?.[sp.studio]||emptyDrafts).list.length),0):0;
 const canAddDraft=venueDraftTotal<MAX_DRAFTS_PER_VENUE;
 const openSpace=(venueId,spaceId)=>{setState(s=>({...s,venueId,spaceId}));setMode('studio');window.scrollTo?.(0,0)};
 const newDraft=()=>{if(!canAddDraft)return;const letter=LETTERS.find(l=>!drafts.list.includes(l));
  // Start the new draft from the current draft's last saved layout.
  const from=savedLayout(storageFor(spaceKey,drafts.active));if(from)localStorage.setItem(storageFor(spaceKey,letter),JSON.stringify(from));
  patchDrafts(d=>({...d,list:[...d.list,letter],active:letter,thumbs:{...d.thumbs,[letter]:d.thumbs[d.active]},savedAt:{...d.savedAt,[letter]:Date.now()}}))};
 const removeDraft=letter=>{if(letter==='A'||!drafts.list.includes(letter))return;try{localStorage.removeItem(storageFor(spaceKey,letter))}catch{}
  patchDrafts(d=>({...d,list:d.list.filter(l=>l!==letter),active:d.active===letter?'A':d.active}))};
 const onSaved=()=>requestAnimationFrame(()=>{const thumb=captureThumbnail();patchDrafts(d=>({...d,thumbs:{...d.thumbs,[d.active]:thumb||d.thumbs[d.active]},savedAt:{...d.savedAt,[d.active]:Date.now()}}))});

 if(mode==='map'||!venue||!space)return <VenueExplorer initialVenueId={state.venueId} onOpenSpace={openSpace} draftCounts={savedDraftCounts(state)}/>;

 const header=<div className="draft-bar">
  <button type="button" className="draft-back" onClick={()=>setMode('map')}><span className="draft-back-ic"><MapIcon size={15}/></span><span><b>Hotel selections on the map</b><small>Currently designing at {venue.name}</small></span><ArrowUpRight size={15} className="draft-back-arrow"/></button>
  <div className="draft-chips" role="tablist" aria-label="Drafts">
   {drafts.list.map(l=><button type="button" role="tab" aria-selected={drafts.active===l} key={l} className={drafts.active===l?'on':''} onClick={()=>patchDrafts(d=>({...d,active:l}))}>Draft {l}</button>)}
   {canAddDraft?<button type="button" className="draft-new" onClick={newDraft}><Plus size={13}/> New draft</button>:<span className="draft-max">{MAX_DRAFTS_PER_VENUE} of {MAX_DRAFTS_PER_VENUE} drafts for this hotel</span>}
   {drafts.list.length>1&&<button type="button" className="draft-compare" onClick={()=>setComparing(true)}><Columns2 size={13}/> Compare</button>}
  </div>
  <p className="draft-hint">Switching drafts keeps only saved changes.</p>
 </div>;

 return <>
  <Studio onMapVenue={id=>{setState(s=>({...s,venueId:id,spaceId:id===s.venueId?s.spaceId:null}));setMode('map')}} key={storageFor(spaceKey,drafts.active)} storageKey={storageFor(spaceKey,drafts.active)} headerExtras={header} onSaved={onSaved} onNavigate={onNavigate} planner={planner} onPlannerChange={onPlannerChange} initialMode={initialMode}/>
  {comparing&&<div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Compare drafts" onClick={e=>{if(e.target===e.currentTarget)setComparing(false)}}>
   <div className="compare-sheet">
    <div className="compare-head"><div><span className="label">{venue.name} · {space.name}</span><h2>Compare drafts</h2></div><button type="button" aria-label="Close" onClick={()=>setComparing(false)}><X size={20}/></button></div>
    <div className="compare-grid" style={{gridTemplateColumns:`repeat(${drafts.list.length},minmax(0,1fr))`}}>
     {drafts.list.map(l=>{const sum=summarise(savedLayout(storageFor(spaceKey,l)));return <article key={l} className={drafts.active===l?'current':''}>
      <div className="compare-thumb" style={drafts.thumbs[l]?{backgroundImage:`url(${drafts.thumbs[l]})`}:undefined}>{!drafts.thumbs[l]&&<span>Save this draft to capture a preview</span>}</div>
      <h3>Draft {l}{drafts.active===l&&<small> · open now</small>}</h3>
      {sum?<dl><dt>Tables</dt><dd>{sum.tables}</dd><dt>Guest seats</dt><dd>{sum.seats}</dd><dt>Lighting</dt><dd>{sum.lighting}</dd><dt>Linen</dt><dd>{sum.theme}</dd><dt>Flowers</dt><dd>{sum.flowers||'None'}</dd><dt>Items in room</dt><dd>{sum.items}</dd></dl>:<p className="label">Not saved yet.</p>}
      <div className="compare-actions"><button type="button" onClick={()=>{patchDrafts(d=>({...d,active:l}));setComparing(false)}}>Open</button>{l!=='A'&&<button type="button" className="danger-link" onClick={()=>removeDraft(l)}><Trash2 size={13}/> Delete</button>}</div>
     </article>})}
    </div>
   </div>
  </div>}
 </>;
}

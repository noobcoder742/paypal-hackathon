// Choose instruments and how many of each, for a music listing (one genre per listing).
import React from 'react';
import {Minus,Plus} from 'lucide-react';
import {GENRES,cleanLineup,ensemblePrice,lineupSize,MAX_MUSICIANS} from '../../studio/decor/ensembles.js';

export function LineupPicker({genre,lineup,onChange,compact=false}){
 const g=GENRES[genre],l=cleanLineup(genre,lineup),total=lineupSize(l);
 const set=(k,n)=>{const next={...l,[k]:n};if(!n)next[k]=0;onChange(cleanLineup(genre,next))};
 return <div className={'lineup'+(compact?' compact':'')}>
  <div className="lineup-head"><span>Choose your {g.label.toLowerCase()}</span><small>{g.pose==='seated'?'Classical players perform seated':'Players and singers perform standing'}</small></div>
  {Object.entries(g.instruments).map(([k,spec])=>{const n=l[k]||0;return <div className="lineup-row" key={k}>
   <span>{spec.label}<small>S${spec.fee} each</small></span>
   <div className="lineup-step"><button type="button" aria-label={'Fewer '+spec.label} disabled={!n||(total===1&&n===1)} onClick={()=>set(k,n-1)}><Minus size={13}/></button><b aria-live="polite">{n}</b><button type="button" aria-label={'More '+spec.label} disabled={n>=spec.max||total>=MAX_MUSICIANS} onClick={()=>set(k,n+1)}><Plus size={13}/></button></div>
  </div>})}
  <div className="lineup-total"><span>{total} musician{total===1?'':'s'} · base fee S${g.base}</span><b>S${ensemblePrice(genre,l).toLocaleString('en-SG')}</b></div>
 </div>;
}

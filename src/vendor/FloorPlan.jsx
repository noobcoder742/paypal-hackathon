// Suggested floor plan for one booking, as an SVG. The vendor's own items are highlighted;
// other vendors' items are drawn in grey so the vendor sees what else is in the room.
import React,{useMemo} from 'react';
import {suggestedPlan,ROOM} from './floorPlan.js';

const S=26;                                       // px per metre
const X=x=>(x+ROOM.w/2)*S,Z=z=>(z+ROOM.d/2)*S;
export default function FloorPlan({booking,vendorName}){
 const p=useMemo(()=>suggestedPlan({tables:booking.tables||20,lines:booking.planLines?.length?booking.planLines:[{id:booking.itemId,qty:booking.qty}],vendorName}),[booking,vendorName]);
 const W=ROOM.w*S,H=ROOM.d*S;
 return <figure className="vs-plan">
  <svg viewBox={`-8 -8 ${W+16} ${H+40}`} role="img" aria-label={`Suggested floor plan: ${p.mine.join(', ')||'your items'} highlighted`}>
   <rect x="0" y="0" width={W} height={H} rx="10" className="fp-room"/>
   {p.perimeter&&Array.from({length:22},(_,i)=>{const t=i/22,onTop=i%2===0;return <circle key={i} cx={X(-ROOM.w/2+1+t*(ROOM.w-2))} cy={onTop?Z(-ROOM.d/2+.35):Z(ROOM.d/2-.35)} r="4" className={p.perimeter==='mine'?'fp-mine':'fp-other'}/>})}
   <rect x={X(p.aisle.x1)} y={Z(p.aisle.z1)} width={(p.aisle.x2-p.aisle.x1)*S} height={(p.aisle.z2-p.aisle.z1)*S} className="fp-aisle"/>
   <rect x={X(p.stage.x)} y={Z(p.stage.z)} width={p.stage.w*S} height={p.stage.d*S} rx="4" className="fp-stage"/>
   <text x={X(p.stage.x+p.stage.w/2)} y={Z(0)} className="fp-label" textAnchor="middle" transform={`rotate(-90 ${X(p.stage.x+p.stage.w/2)} ${Z(0)})`}>STAGE</text>
   <rect x={X(-10.4)} y={Z(-4.2)} width={3.4*S} height={8.4*S} rx="6" className="fp-dance"/>
   <text x={X(-8.7)} y={Z(0)+4} className="fp-label" textAnchor="middle">DANCE FLOOR</text>
   {p.zones.map((z,i)=><g key={i} className={z.mine?'fp-mine':'fp-other'}><rect x={X(z.x)} y={Z(z.z)} width={Math.max(6,z.w*S)} height={Math.max(6,z.d*S)} rx="5" className={z.soft?'soft':''}/>
    <text x={X(z.x+z.w/2)} y={Z(z.z)-6} textAnchor="middle" className="fp-zone-label">{z.label}</text></g>)}
   {p.tables.map((t,i)=><g key={i}><circle cx={X(t.x)} cy={Z(t.z)} r={0.9*S} className="fp-table"/>
    {t.flowers&&<circle cx={X(t.x)} cy={Z(t.z)} r={0.32*S} className={t.flowers==='mine'?'fp-mine':'fp-other'}/>}</g>)}
   {p.dots.map((d,i)=><circle key={i} cx={X(d.x)} cy={Z(d.z)} r="5" className={d.mine?'fp-mine':'fp-other'}/>)}
   <path d={`M ${W} ${Z(-1.4)} L ${W} ${Z(1.4)}`} className="fp-door"/>
   <text x={W-6} y={Z(-1.8)} textAnchor="end" className="fp-label">ENTRANCE</text>
   {p.entrance.map((e,i)=><text key={i} x={W-6} y={H+18+i*14} textAnchor="end" className={'fp-entrance '+(e.mine?'mine':'')}>{e.mine?'● ':'○ '}{e.label}</text>)}
  </svg>
  <figcaption className="vs-plan-key">
   <span className="k-mine"><i/>Your items{p.mine.length?`: ${[...new Set(p.mine)].join(', ')}`:''}</span>
   {p.others.length>0&&<span className="k-other"><i/>Other vendors: {[...new Set(p.others)].join(', ')}</span>}
   <span className="vs-muted">Suggested layout from the couple’s plan, not a venue-approved drawing.</span>
  </figcaption>
 </figure>;
}

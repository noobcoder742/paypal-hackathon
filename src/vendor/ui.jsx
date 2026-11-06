// Small shared pieces for the vendor workspace.
import React from 'react';
import {statusMeta} from './status.js';
export {CountUp} from '../components/ui/motion.jsx';
export function StatusPill({status,compact=false}){
 const m=statusMeta(status);
 return <span className={'vs-pill vs-'+m.key+(compact?' compact':'')} title={m.hint}><i aria-hidden="true"/>{m.label}</span>;
}
/** Staggered entrance for the first few rows only (long staggers feel slow). */
export const stagger=i=>({style:{'--i':Math.min(i,8)},className:'vs-rise'});
export const dateText=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'}):'Date to confirm';
export const ago=t=>{const s=(Date.now()-t)/1000;if(s<90)return 'just now';const m=s/60;if(m<60)return Math.round(m)+' min ago';const h=m/60;if(h<36)return Math.round(h)+' h ago';return Math.round(h/24)+' days ago'};

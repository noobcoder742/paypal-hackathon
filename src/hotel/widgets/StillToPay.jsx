// "Still to pay": a friendly scoreboard of unpaid PayPal deposits, not a collections report.
import React from 'react';
import {useWidgetRows} from './useWidgetRows.js';
export default function StillToPay(params){
 const rows=useWidgetRows(params,['couple','due']).filter(r=>Number(r.due)>0).sort((a,b)=>b.due-a.due).slice(0,8);
 const max=Math.max(1,...rows.map(r=>r.due));
 if(!rows.length)return <div className="w-empty">Every deposit is in. Lovely.</div>;
 return <ol className="w-score">{rows.map((r,i)=><li key={r.couple+i}>
  <span className="w-score-rank">{i+1}</span>
  <span className="w-score-name">{String(r.couple)}</span>
  <span className="w-score-bar" aria-hidden="true"><i style={{width:Math.max(6,r.due/max*100)+'%'}}/></span>
  <b>S${Math.round(r.due).toLocaleString('en-SG')}</b>
 </li>)}</ol>;
}

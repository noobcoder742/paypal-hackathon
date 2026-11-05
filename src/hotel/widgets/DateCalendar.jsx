// Ballroom date calendar: one month at a time; booked (deposit paid), held (quoted or invoiced), open.
import React,{useMemo,useState} from 'react';
import {useWidgetRows} from './useWidgetRows.js';
const iso=d=>d.toISOString().slice(0,10);
// the data engine returns dates as Date objects (or ISO strings / timestamps)
const dayOf=v=>{if(v==null||v==='')return '';const d=v instanceof Date?v:new Date(v);return isNaN(d)?'':iso(d)};
export default function DateCalendar(params){
 const rows=useWidgetRows(params,['date','status']);
 const byDate=useMemo(()=>{const m=new Map();for(const r of rows){const d=dayOf(r.date);if(!d)continue;const s=r.status==='paid'?'booked':'held';if(m.get(d)!=='booked')m.set(d,s)}return m},[rows]);
 const first=[...byDate.keys()].sort()[0];
 const [month,setMonth]=useState(null);
 const start=new Date((month||first||iso(new Date())).slice(0,7)+'-01T00:00:00Z');
 const days=[],lead=(start.getUTCDay()+6)%7;
 for(let i=0;i<lead;i++)days.push(null);
 for(let d=new Date(start);d.getUTCMonth()===start.getUTCMonth();d.setUTCDate(d.getUTCDate()+1))days.push(new Date(d));
 const shift=n=>{const d=new Date(start);d.setUTCMonth(d.getUTCMonth()+n);setMonth(iso(d))};
 return <div className="w-cal">
  <div className="w-cal-head"><button type="button" aria-label="Previous month" onClick={()=>shift(-1)}>‹</button><b>{start.toLocaleDateString('en-SG',{month:'long',year:'numeric',timeZone:'UTC'})}</b><button type="button" aria-label="Next month" onClick={()=>shift(1)}>›</button></div>
  <div className="w-cal-grid">{['M','T','W','T','F','S','S'].map((d,i)=><span key={'h'+i} className="w-cal-dow">{d}</span>)}
   {days.map((d,i)=>{if(!d)return <span key={i}/>;const s=byDate.get(iso(d)),we=d.getUTCDay()===0||d.getUTCDay()===6;
    return <span key={i} className={'w-cal-day'+(s?' '+s:'')+(we?' weekend':'')} title={s?(s==='booked'?'Booked: deposit paid':'Held: quote or invoice sent'):'Open'}>{d.getUTCDate()}</span>})}</div>
  <div className="w-cal-key"><span className="booked">Booked</span><span className="held">Held</span><span>Open</span></div>
 </div>;
}

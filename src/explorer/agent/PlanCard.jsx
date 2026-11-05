// The plan the agent placed in the ballroom: venue estimate, each vendor item, totals.
import React,{useState} from 'react';
const sgd=n=>n==null?'—':'S$'+Number(n).toLocaleString('en-SG',{minimumFractionDigits:0,maximumFractionDigits:2});
export default function PlanCard({plan,paid,disabled,onSecure,onEnquire}){
 const [form,setForm]=useState(null);const t=plan.totals||{lines:[]};
 return <section className="plan-card" aria-label="Your plan">
  <h3>{plan.venueName}</h3>
  <dl className="plan-sum"><div><dt>Venue estimate (incl. ++)</dt><dd>{sgd(plan.banquetTotal)}</dd></div><div><dt>Vendors</dt><dd>{sgd(t.vendorTotal)}</dd></div><div><dt>All-in</dt><dd>{sgd(plan.grandTotal)}</dd></div>{plan.remaining!=null&&<div><dt>Left in budget</dt><dd>{sgd(plan.remaining)}</dd></div>}</dl>
  <ul className="plan-lines">{t.lines.map(l=><li key={l.id}><span>{l.name}<small>{l.vendor} · {l.qty} × {sgd(l.unitPrice)}</small></span><b>{sgd(l.total)}</b></li>)}</ul>
  <p className="plan-dep">Deposits today: <b>{sgd(t.depositTotal)}</b> (20% of each vendor item){paid?.status==='COMPLETED'&&<em> · Paid with PayPal</em>}</p>
  <div className="plan-actions">
   <button type="button" className="primary" disabled={disabled||paid?.status==='COMPLETED'} onClick={onSecure}>Secure these vendors</button>
   <button type="button" disabled={disabled} onClick={()=>setForm(f=>f?null:{name:'',email:'',date:''})}>Send enquiry to the venue</button>
  </div>
  {form&&<form className="plan-enquiry" onSubmit={e=>{e.preventDefault();onEnquire(form);setForm(null)}}>
   <label htmlFor="enq-name">Your names</label><input id="enq-name" required maxLength={80} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <label htmlFor="enq-email">Email (your PayPal sandbox email)</label><input id="enq-email" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
   <label htmlFor="enq-date">Wedding date</label><input id="enq-date" type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
   <button type="submit" className="primary">Send enquiry</button>
  </form>}
 </section>;
}

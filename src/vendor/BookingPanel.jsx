// One booking, opened from any list: amounts, PayPal timeline and the next action.
import React,{useState} from 'react';
import {X,Send,Sparkles,RefreshCw,Check,ExternalLink} from 'lucide-react';
import {bookingAction} from './api.js';
import {StatusPill,dateText,ago} from './ui.jsx';
import {sgd} from './status.js';
import {celebrate} from './Confetti.jsx';

const EVENT={deposit:'Deposit paid through PayPal',invoice:'Balance invoice sent with PayPal',reminder:'Friendly reminder sent',paid:'Balance paid in full'};
export default function BookingPanel({booking:b,onClose,onChanged,inline=false}){
 const [busy,setBusy]=useState(''),[draft,setDraft]=useState(null),[err,setErr]=useState('');
 const act=async(action,extra)=>{setBusy(action);setErr('');
  try{const r=await bookingAction(b.id,action,extra);if(action==='refresh'&&r.booking.status==='paid_in_full'&&b.status!=='paid_in_full')celebrate(r.booking.balance,`balance paid by ${b.couple}`);if(action==='draft-reminder')setDraft(r.text);else{onChanged(r.booking);if(action==='send-reminder')setDraft(null)}}
  catch(e){setErr(e.code===503?'The AI assistant is unavailable right now. You can write the reminder yourself.':e.message==='no_couple_email'?'PayPal didn’t share this couple’s email, so an invoice can’t be sent.':'That didn’t work: '+e.message)}
  finally{setBusy('')}};
 const canAct=!b.isExample;
 const Tag=inline?'section':'aside';
 return <Tag className={inline?'vs-card vs-pay':'vs-panel'} role={inline?undefined:'dialog'} aria-label={'Payment for '+b.couple}>
  {inline?<h2 className="vs-pay-title">Payment</h2>:<header><div><span className="vs-eyebrow">{b.itemName}{b.qty>1?` × ${b.qty}`:''}</span><h2>{b.couple}</h2><p className="vs-muted">{dateText(b.weddingDate)}{b.email?` · ${b.email}`:''}</p></div><button type="button" className="vs-icon" aria-label="Close" onClick={onClose}><X size={18}/></button></header>}
  {!inline&&<StatusPill status={b.status}/>}
  <dl className="vs-money">
   <div><dt>Booking total</dt><dd>{sgd(b.total)}</dd></div>
   <div><dt>Deposit paid</dt><dd className="ok">{sgd(b.deposit)}</dd></div>
   <div><dt>{b.status==='paid_in_full'?'Balance paid':'Balance due'}</dt><dd className={b.status==='paid_in_full'?'ok':b.status==='overdue'?'bad':''}>{sgd(b.balance)}</dd></div>
  </dl>
  <section><h3>PayPal timeline</h3><ol className="vs-timeline">{(b.events||[]).map((e,i)=><li key={i} className={'t-'+e.type}><i aria-hidden="true"/><span>{EVENT[e.type]}{e.amount?` · ${sgd(e.amount)}`:''}</span><time>{ago(e.at)}</time></li>)}</ol></section>
  <section className="vs-next"><h3>Next step</h3>
   {!canAct&&<p className="vs-muted">This is an example booking, so its PayPal actions are switched off. Real bookings appear here when couples pay their deposit.</p>}
   {canAct&&(b.status==='new'||b.status==='deposit_paid')&&<><p className="vs-muted">Send the remaining 80% as a PayPal invoice to {b.email||'the couple'}. They can pay by card or PayPal.</p>
    <button type="button" className="vs-primary" disabled={!!busy} onClick={()=>act('invoice')}><Send size={15}/> {busy==='invoice'?'Sending…':'Send balance invoice · '+sgd(b.balance)}</button></>}
   {canAct&&(b.status==='balance_invoiced'||b.status==='overdue')&&<>
    {b.invoice?.payLink&&<a className="vs-link" href={b.invoice.payLink} target="_blank" rel="noreferrer">View the PayPal invoice <ExternalLink size={13}/></a>}
    {draft===null?<button type="button" className="vs-secondary" disabled={!!busy} onClick={()=>act('draft-reminder')}><Sparkles size={15}/> {busy==='draft-reminder'?'Writing…':'Draft a friendly reminder with AI'}</button>
     :<div className="vs-draft"><label htmlFor="vs-draft">Reminder (edit before sending)</label><textarea id="vs-draft" rows={4} maxLength={400} value={draft} onChange={e=>setDraft(e.target.value)}/>
      <div className="vs-row"><button type="button" className="vs-primary" disabled={!!busy||!draft.trim()} onClick={()=>act('send-reminder',{text:draft})}><Send size={15}/> {busy==='send-reminder'?'Sending…':'Send with PayPal'}</button><button type="button" className="vs-ghost" onClick={()=>setDraft(null)}>Cancel</button></div></div>}
    <button type="button" className="vs-ghost" disabled={!!busy} onClick={()=>act('refresh')}><RefreshCw size={14}/> {busy==='refresh'?'Checking…':'Check payment'}</button></>}
   {b.status==='paid_in_full'&&<p className="vs-done"><Check size={16}/> All settled. Lovely.</p>}
   {err&&<p className="vs-alert" role="alert"><span>{err}</span></p>}
  </section>
 </Tag>;
}

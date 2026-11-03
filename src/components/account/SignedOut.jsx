// Signed-out experience: the sign-in dialog, teaser screens for Design and
// Planner (a glimpse of each feature without the real tools), and a gentle
// sign-in bar. Every key action invites the visitor to sign in.
import React,{useEffect,useRef,useState} from 'react';
import {X,ArrowRight,Map as MapIcon,Armchair,Layers3,ClipboardList,Users,Wallet,CalendarDays,Sparkles,Check,Lock} from 'lucide-react';
import {signIn} from '../../data/auth.js';
import {Reveal} from '../ui/motion.jsx';

export function SignInDialog({open,reason,onClose,onSignedIn}){
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),input=useRef(null);
 useEffect(()=>{if(open){setError('');setTimeout(()=>input.current?.focus(),50)}},[open]);
 useEffect(()=>{if(!open)return;const esc=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[open,onClose]);
 if(!open)return null;
 const submit=e=>{e.preventDefault();if(!/^\S+@\S+\.\S+$/.test(email)){setError('Enter a valid email address.');return}const s=signIn({email,name});onSignedIn?.(s)};
 return <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="signin-title" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="signin-card">
   <button type="button" className="signin-close" aria-label="Close" onClick={onClose}><X size={18}/></button>
   <div className="signin-art" aria-hidden="true"/>
   <div className="signin-body">
    <span className="acct-kicker">Wedding Studio</span>
    <h2 id="signin-title">{reason||<>Sign in to start <em>planning</em>.</>}</h2>
    <p>Free to use. Save your venue designs, drafts, guest list and favourites in one place.</p>
    <div className="signin-providers"><button type="button" disabled title="Coming soon">Continue with Google <small>soon</small></button><button type="button" disabled title="Coming soon">Continue with Apple <small>soon</small></button></div>
    <div className="signin-or"><span>or with email</span></div>
    <form onSubmit={submit}>
     <label>Email<input ref={input} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
     <label>Your name <small>optional</small><input value={name} autoComplete="name" onChange={e=>setName(e.target.value)} placeholder="e.g. Alicia"/></label>
     {error&&<p className="signin-error" role="alert">{error}</p>}
     <button type="submit" className="btn-ink signin-submit">Continue <ArrowRight size={16}/></button>
    </form>
    <p className="signin-fine"><Lock size={12}/> Prototype: your session is kept in this browser only.</p>
   </div>
  </div>
 </div>;
}

/** Bottom invitation shown on public pages; dismissible for the session. */
export function SignInBar({onSignIn}){
 const [hidden,setHidden]=useState(()=>{try{return sessionStorage.getItem('signin-bar-hidden')==='1'}catch{return false}});
 if(hidden)return null;
 return <div className="signin-bar" role="region" aria-label="Sign in">
  <span><Sparkles size={15}/> Design your venue in 3D and keep every plan in one place.</span>
  <button className="btn-ink" onClick={onSignIn}>Sign in free <ArrowRight size={15}/></button>
  <button className="signin-bar-x" aria-label="Dismiss" onClick={()=>{setHidden(true);try{sessionStorage.setItem('signin-bar-hidden','1')}catch{}}}><X size={15}/></button>
 </div>;
}

const TEASERS={
 studio:{kicker:'Design',title:<>See your venue <em>before</em> you book.</>,lede:'Explore partner hotels, churches and gardens on a 3D map of Singapore, then step inside the ballroom to arrange tables, lighting and florals.',
  cta:'Sign in to start designing',image:'/venues/orchard-grand/grand-ballroom.jpg',
  points:[[MapIcon,'A 3D map of Singapore','Search venues and fly to them, with nearest MRT, parking and capacity at a glance.'],[Layers3,'Design in 3D','Tables, chairs, stage, florals and lighting in the real room dimensions.'],[Armchair,'See it from their seat','Preview the view from any guest\'s chair, and compare up to two drafts per hotel.']]},
 plan:{kicker:'Planner',title:<>Every detail, <em>in its place</em>.</>,lede:'A checklist that keeps you on track, a guest list sorted by side of the family, a budget that adds itself up, and a wedding-day check-in.',
  cta:'Sign in to start planning',image:'/venues/orchard-grand/grand-ballroom.jpg',
  points:[[ClipboardList,'Checklist by phase','From venue and date to the run sheet.'],[Users,'Guests by side','Hers, His and both, with RSVPs, diets and seats you assign in 3D.'],[Wallet,'Budget that adds up','Payments and saved vendor items against your total.'],[CalendarDays,'Wedding-day check-in','Tick guests in as they arrive, NFC tap-in coming soon.']]},
 dashboard:{kicker:'My Wedding',title:<>Your day, <em>at a glance</em>.</>,lede:'A countdown, your venue and drafts, guest responses and budget, all on one calm page that becomes your home once you sign in.',
  cta:'Sign in to see My Wedding',image:'/venues/orchard-grand/grand-ballroom.jpg',
  points:[[CalendarDays,'Countdown','Days to go and what to do next.'],[MapIcon,'Venue & drafts','Jump back into your latest design.'],[Users,'Guests & budget','Responses and spending in one view.']]}
};
/** A glimpse of a members-only page, with the real tools behind sign-in. */
export function Teaser({page,onSignIn,go}){
 const t=TEASERS[page]||TEASERS.plan;
 return <main className="teaser">
  <section className="teaser-hero">
   <div className="teaser-copy"><span className="acct-kicker">{t.kicker}</span><h1>{t.title}</h1><p>{t.lede}</p>
    <div className="teaser-actions"><button className="btn-ink" onClick={onSignIn}>{t.cta} <ArrowRight size={16}/></button><button className="btn-line" onClick={()=>go('market')}>Browse the marketplace</button></div>
    <ul className="teaser-proof"><li><Check size={14}/> Free to start</li><li><Check size={14}/> Singapore venues and vendors</li><li><Check size={14}/> Works on any device</li></ul></div>
   <div className="teaser-glimpse" aria-hidden="true">
    <div className="teaser-img" style={{backgroundImage:`url(${t.image})`}}/>
    <div className="teaser-lock"><Lock size={16}/> Sign in to open</div>
    {page==='plan'&&<div className="teaser-float"><b>12</b> of 30 tasks · <b>86</b> guests attending</div>}
    {page==='studio'&&<div className="teaser-float"><b>20</b> tables · <b>200</b> seats · Draft A</div>}
    {page==='dashboard'&&<div className="teaser-float"><b>142</b> days to go</div>}
   </div>
  </section>
  <section className="teaser-points">{t.points.map(([Icon,h,d],i)=><Reveal key={h} index={i} className="teaser-point"><span><Icon size={18}/></span><h3>{h}</h3><p>{d}</p></Reveal>)}</section>
  <section className="teaser-end"><h2>Ready when you are.</h2><button className="btn-ink" onClick={onSignIn}>Sign in free <ArrowRight size={16}/></button></section>
 </main>;
}

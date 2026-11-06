// Business sign-in: the company email decides which workspace opens.
import React,{useState} from 'react';
import {ArrowRight,ArrowLeft,Building2,Store} from 'lucide-react';
import {signIn} from './api.js';
import {VENDORS} from '../data/vendors.js';

const MESSAGES={
 venue_coming_soon:{title:'Venue workspaces are coming soon',text:'Hotels and venues will get their own workspace next. For now, vendor companies can sign in.'},
 unknown_company:{title:'We couldn’t find your company',text:'Use your company email address. This demo knows the vendors listed below.'},
 wrong_password:{title:'That password is not right',text:'Judges: the demo password is in the Devpost testing instructions.'},
 invalid_email:{title:'Check your email address',text:'It should look like name@yourcompany.sg.'},
 not_configured:{title:'Sign-in isn’t set up yet',text:'The demo password hasn’t been configured on this server.'},
 rate_limited:{title:'Too many attempts',text:'Wait a few minutes and try again.'},
};
export default function SignIn({onSignedIn,onBack}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(null);
 const submit=async e=>{e.preventDefault();setBusy(true);setMsg(null);
  try{const r=await signIn(email,password);if(r.token)onSignedIn(r);else setMsg(MESSAGES[r.error]||{title:'Something went wrong',text:'Please try again.'})}
  catch{setMsg({title:'Can’t reach the server',text:'Check your connection and try again.'})}finally{setBusy(false)}};
 return <main className="vs-signin">
  <section className="vs-signin-art" aria-hidden="true"><div className="vs-signin-quote"><span>For vendors</span><p>Every booking, deposit and balance, <em>in one calm place</em>.</p></div></section>
  <section className="vs-signin-form">
   <button type="button" className="vs-link-back" onClick={onBack}><ArrowLeft size={15}/> Wedding Studio</button>
   <form onSubmit={submit} className="vs-card vs-rise">
    <span className="vs-eyebrow"><Store size={14}/> Business account</span>
    <h1>Sign in to your workspace</h1>
    <p className="vs-muted">Use your company email. We’ll open your company’s workspace.</p>
    <label htmlFor="vs-email">Company email</label>
    <input id="vs-email" type="email" autoComplete="username" placeholder="you@yourcompany.sg" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <label htmlFor="vs-pw">Password</label>
    <input id="vs-pw" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/>
    {msg&&<div className={'vs-alert'+(msg===MESSAGES.venue_coming_soon?' info':'')} role="alert">{msg===MESSAGES.venue_coming_soon&&<Building2 size={16}/>}<div><b>{msg.title}</b><span>{msg.text}</span></div></div>}
    <button type="submit" className="vs-primary" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={16}/></button>
    <details className="vs-demo"><summary>Demo companies</summary><ul>{VENDORS.slice(0,6).map(v=><li key={v.id}><button type="button" onClick={()=>setEmail('hello@'+v.domain)}>{v.name.replace(' (demo)','')}<code>hello@{v.domain}</code></button></li>)}</ul></details>
   </form>
  </section>
 </main>;
}

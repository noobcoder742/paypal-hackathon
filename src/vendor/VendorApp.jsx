// Business side of Wedding Studio: company sign-in, then the vendor's own full-screen workspace
// with a left sidebar of pages.
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LayoutGrid,Users,CreditCard,CalendarDays,BarChart3,Sparkles,LogOut,ArrowLeft,RefreshCw} from 'lucide-react';
import SignIn from './SignIn.jsx';
import BookingPanel from './BookingPanel.jsx';
import {Overview,Bookings,Payments,Calendar} from './pages.jsx';
import {getSession,setSession,api,bookingAction} from './api.js';
import {exampleBookings} from './status.js';
import useSlidingIndicator from '../components/ui/useSlidingIndicator.js';
import './vendor.css';
const Insights=lazy(()=>import('./Insights.jsx'));

const NAV=[{group:'Workspace',items:[['overview','Overview',LayoutGrid],['bookings','Bookings',Users],['payments','Payments',CreditCard],['calendar','Calendar',CalendarDays]]},
 {group:'Insights',items:[['insights','Dashboard',BarChart3],['ask','Ask AI',Sparkles]]}];

function Workspace({session,onSignOut,onExit}){
 const [page,setPage]=useState('overview'),[filter,setFilter]=useState('all'),[real,setReal]=useState(null),[openId,setOpenId]=useState(null),[err,setErr]=useState('');
 const load=useCallback(async()=>{try{const j=await api('/api/vendor/bookings');setReal(j.bookings);setErr('')}catch(e){if(e.code===401)onSignOut();else{setErr('Couldn’t load bookings.');setReal(r=>r||[])}}},[onSignOut]);
 useEffect(()=>{load()},[load]);
 const examples=useMemo(()=>exampleBookings(session.vendor),[session.vendor]);
 const bookings=useMemo(()=>[...(real||[]),...examples],[real,examples]);
 const open=b=>{setOpenId(b.id);if(b.status==='new'&&!b.isExample)bookingAction(b.id,'seen').then(r=>setReal(list=>list.map(x=>x.id===b.id?r.booking:x))).catch(()=>{})};
 const opened=bookings.find(b=>b.id===openId)||null;
 const go=(p,f)=>{setPage(p);if(f)setFilter(f)};
 const navRef=useRef(null);useSlidingIndicator(navRef,[page]);
 const newCount=bookings.filter(b=>b.status==='new').length;
 const initials=session.vendor.name.replace(' (demo)','').split(/[\s&]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('');
 return <div className="vs-shell">
  <aside className="vs-side">
   <button type="button" className="vs-brand" onClick={onExit}><span>W</span>Wedding Studio</button>
   <div className="vs-company"><span className="vs-avatar">{initials}</span><div><b>{session.vendor.name.replace(' (demo)','')}</b><small>{session.vendor.category} · demo vendor</small></div></div>
   <nav ref={navRef} className="vs-nav" aria-label="Workspace">
    <span className="slide-ind" aria-hidden="true"/>
    {NAV.map(g=><React.Fragment key={g.group}><span className="vs-nav-group">{g.group}</span>
     {g.items.map(([id,label,Icon])=><button key={id} type="button" className={page===id?'on':''} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}>
      <Icon size={16}/><span>{label}</span>{id==='bookings'&&newCount>0&&<em className="vs-badge">{newCount}</em>}{page===id&&<i className="vs-active-dot" aria-hidden="true"/>}</button>)}</React.Fragment>)}
   </nav>
   <div className="vs-side-foot">
    <button type="button" onClick={load}><RefreshCw size={15}/> Refresh</button>
    <button type="button" onClick={onExit}><ArrowLeft size={15}/> Couple site</button>
    <button type="button" onClick={onSignOut}><LogOut size={15}/> Sign out</button>
    <p>Fictional demo vendor · PayPal sandbox</p>
   </div>
  </aside>
  <main className={'vs-main'+(page==='insights'||page==='ask'?' full':'')} key={page==='ask'?'insights':page}>
   {err&&<p className="vs-alert" role="alert"><span>{err}</span></p>}
   {real===null?<div className="vs-page"><div className="vs-skeleton"/><div className="vs-skeleton"/></div>
    :page==='overview'?<Overview vendor={session.vendor} bookings={bookings} open={open} go={go}/>
    :page==='bookings'?<Bookings bookings={bookings} open={open} filter={filter} setFilter={setFilter}/>
    :page==='payments'?<Payments bookings={bookings} open={open}/>
    :page==='calendar'?<Calendar bookings={bookings} open={open}/>
    :<Suspense fallback={<div className="vs-page"><p className="vs-muted">Loading the dashboard…</p></div>}><Insights vendor={session.vendor} bookings={bookings} askAi={page==='ask'}/></Suspense>}
  </main>
  {opened&&<><div className="vs-scrim" onClick={()=>setOpenId(null)}/><BookingPanel key={opened.id} booking={opened} onClose={()=>setOpenId(null)} onChanged={b=>setReal(list=>list.map(x=>x.id===b.id?b:x))}/></>}
 </div>;
}

export default function VendorApp({onExit}){
 const [session,setS]=useState(getSession);
 const signOut=useCallback(()=>{setSession(null);setS(null)},[]);
 useEffect(()=>{document.body.classList.add('vs-body');return()=>document.body.classList.remove('vs-body')},[]);
 return session?<Workspace session={session} onSignOut={signOut} onExit={onExit}/>:<SignIn onSignedIn={setS} onBack={onExit}/>;
}

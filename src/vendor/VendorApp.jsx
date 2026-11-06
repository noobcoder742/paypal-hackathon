// Business side of Wedding Studio: company sign-in, then the vendor's own full-screen workspace
// with a left sidebar of pages.
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LayoutGrid,Users,CreditCard,CalendarDays,BarChart3,Sparkles,LogOut,ArrowLeft,RefreshCw} from 'lucide-react';
import SignIn from './SignIn.jsx';
import BookingPage from './BookingPage.jsx';
import TaskPage from './TaskPage.jsx';
import Confetti,{celebrate} from './Confetti.jsx';
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
 // confetti when money has come in since the last visit (deposits and paid balances on real bookings)
 useEffect(()=>{if(!real)return;const k='vs-money-in-'+session.vendor.id;
  const total=real.reduce((s,b)=>s+b.deposit+(b.status==='paid_in_full'?b.balance:0),0);
  let before=null;try{before=JSON.parse(localStorage.getItem(k))}catch{}
  if(total>0&&(before==null||total>before))setTimeout(()=>celebrate(total-(before||0),before==null?'came in through PayPal':'came in since your last visit'),600);
  try{localStorage.setItem(k,JSON.stringify(total))}catch{}},[real,session.vendor.id]);
 const examples=useMemo(()=>exampleBookings(session.vendor),[session.vendor]);
 const bookings=useMemo(()=>[...(real||[]),...examples],[real,examples]);
 const [from,setFrom]=useState('overview');
 // a booking opens as its own page (not in the sidebar); Back returns to where it was opened from
 const open=b=>{const cur=pageRef.current;setOpenId(b.id);setFrom(p=>cur==='booking'||cur==='task'?p:cur);setPage('booking');document.querySelector('.vs-main')?.scrollTo?.(0,0);
  if(b.status==='new'&&!b.isExample)bookingAction(b.id,'seen').then(r=>setReal(list=>list.map(x=>x.id===b.id?r.booking:x))).catch(()=>{})};
 const opened=bookings.find(b=>b.id===openId)||null;
 const openRef=useRef(open);openRef.current=open;const listRef=useRef(bookings);listRef.current=bookings;
 const [task,setTask]=useState(null);const pageRef=useRef(page);pageRef.current=page;
 useEffect(()=>{const on=e=>{const {id,task:t}=typeof e.detail==='string'?{id:e.detail}:e.detail;const b=listRef.current.find(x=>x.id===id);if(!b)return;
  if(!t||t==='open')openRef.current(b);else{const cur=pageRef.current;setOpenId(b.id);setTask(t);setFrom(p=>cur==='booking'||cur==='task'?p:cur);setPage('task')}};window.addEventListener('vs-open-booking',on);return()=>window.removeEventListener('vs-open-booking',on)},[]);
 const go=(p,f)=>{setPage(p);if(f)setFilter(f)};
 const FROM={overview:'Overview',bookings:'Bookings',payments:'Payments',calendar:'Calendar',insights:'Dashboard',ask:'Dashboard'};
 const navRef=useRef(null);useSlidingIndicator(navRef,[page,from]);
 const newCount=bookings.filter(b=>b.status==='new').length;
 const initials=session.vendor.name.replace(' (demo)','').split(/[\s&]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('');
 return <div className="vs-shell">
  <aside className="vs-side">
   <button type="button" className="vs-brand" onClick={onExit}><span>W</span>Wedding Studio</button>
   <div className="vs-company"><span className="vs-avatar">{initials}</span><div><b>{session.vendor.name.replace(' (demo)','')}</b><small>{session.vendor.category} · demo vendor</small></div></div>
   <nav ref={navRef} className="vs-nav" aria-label="Workspace">
    <span className="slide-ind" aria-hidden="true"/>
    {NAV.map(g=><React.Fragment key={g.group}><span className="vs-nav-group">{g.group}</span>
     {g.items.map(([id,label,Icon])=><button key={id} type="button" className={(page===id||((page==='booking'||page==='task')&&from===id))?'on':''} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}>
      <Icon size={16}/><span>{label}</span>{id==='bookings'&&newCount>0&&<em className="vs-badge">{newCount}</em>}{(page===id||((page==='booking'||page==='task')&&from===id))&&<i className="vs-active-dot" aria-hidden="true"/>}</button>)}</React.Fragment>)}
   </nav>
   <div className="vs-side-foot">
    <button type="button" onClick={load}><RefreshCw size={15}/> Refresh</button>
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
    :page==='task'?(opened&&task?<TaskPage task={task} booking={opened} vendor={session.vendor} onBack={()=>setPage(from)} goBooking={()=>setPage('booking')} onChanged={b=>setReal(list=>list.map(x=>x.id===b.id?b:x))}/>:null)
    :page==='booking'?(opened?<BookingPage booking={opened} vendor={session.vendor} backLabel={FROM[from]||'Back'} onBack={()=>setPage(from)} onChanged={b=>setReal(list=>list.map(x=>x.id===b.id?b:x))}/>:<div className="vs-page"><p className="vs-muted">That booking isn’t here any more.</p></div>)
    :<Suspense fallback={<div className="vs-page"><p className="vs-muted">Loading the dashboard…</p></div>}><Insights vendor={session.vendor} bookings={bookings} askAi={page==='ask'}/></Suspense>}
  </main>
  <Confetti/>
 </div>;
}

export default function VendorApp({onExit}){
 const [session,setS]=useState(getSession);
 const signOut=useCallback(()=>{setSession(null);setS(null)},[]);
 useEffect(()=>{document.body.classList.add('vs-body');return()=>document.body.classList.remove('vs-body')},[]);
 return session?<Workspace session={session} onSignOut={signOut} onExit={onExit}/>:<SignIn onSignedIn={setS} onBack={onExit}/>;
}

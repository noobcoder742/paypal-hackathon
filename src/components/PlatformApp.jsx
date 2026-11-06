import React,{useState,useEffect,useRef,Suspense,lazy} from 'react';
import {PHOTOS} from '../data/photos.js';
const HotelDashboard=lazy(()=>import('../hotel/HotelDashboard.jsx'));
import useSlidingIndicator from './ui/useSlidingIndicator.js';
import {Flower2,ArrowRight,ArrowUpRight,Check,CalendarDays,Users,Wallet,ClipboardList,Store,Building2,Heart,Settings,LogOut,UserRound,ChevronDown,Menu,Plus,Trash2,Search,Mail,Download,Save,Clock,MapPin} from 'lucide-react';
import Marketplace from './marketplace/Marketplace.jsx';
import DesignPage from '../explorer/DesignPage.jsx';
import {prefetchCity} from '../explorer/stream/cityStream.js';
import {MapStage,requestMapWarm} from '../explorer/MapHost.jsx';
const warmMap=()=>{prefetchCity();requestMapWarm()};
import {demoListings} from './marketplace/Marketplace.jsx';
import PlannerPage from './planner/PlannerPage.jsx';
import {dietLabel} from './planner/GuestsSection.jsx';
import {MyWeddingPage,ProfilePage,SettingsPage} from './account/AccountPages.jsx';
import {applyGlobalSettings} from '../data/settings.js';
import {useAuth,signOut} from '../data/auth.js';
import {SignInDialog,SignInBar,Teaser} from './account/SignedOut.jsx';
/** @prototype STORAGE: Browser localStorage only. No account sync, encryption, server validation or multi-user collaboration. */
const KEY='wedding-platform-planner-v1';
/** @placeholder CHECKLIST_SEED: Example planning tasks; replace with configurable templates and due-date rules. */
const seedTasks=[
 {id:'venue',title:'Shortlist and confirm a venue',group:'Venue & date',done:false},
 {id:'date',title:'Choose your wedding date',group:'Venue & date',done:false},
 {id:'guests',title:'Draft your guest list',group:'Guests & invitations',done:false},
 {id:'invite',title:'Prepare digital invitations',group:'Guests & invitations',done:false},
 {id:'seating',title:'Arrange guest seating',group:'Guests & invitations',done:false},
 {id:'floral',title:'Choose floral arrangements',group:'Vendors & styling',done:false},
 {id:'music',title:'Confirm music and entertainment',group:'Vendors & styling',done:false},
 {id:'deposit',title:'Review vendor payment milestones',group:'Budget & logistics',done:false},
 {id:'run',title:'Prepare wedding-day run sheet',group:'Budget & logistics',done:false}
];
/** @placeholder PROJECT_SEED: Initial wedding budget and data are illustrative, not user-entered or vendor-verified. */
const initial={profile:{},couple:'Your wedding',date:'',budget:35000,tasks:seedTasks,guests:[],vendors:[],payments:[],savedItems:[],favourites:[],inventoryQuantities:{},checkins:[],weddingNotes:''};
function load(){try{const value=JSON.parse(localStorage.getItem(KEY));if(!value)return initial;
 // venues are now chosen on the map, not saved from the marketplace
 const strip=list=>(list||[]).filter(x=>x.category!=='Venues');
 return {...initial,...value,savedItems:strip(value.savedItems),favourites:strip(value.favourites)}}catch{return initial}}
/** @placeholder HOME_COPY: Steps describe the intended flow; enquiries and vendor placement are still prototype features. */
const homeSteps=[
 ['Pick a venue','Every 3D-ready venue loads with its floor plan, ceiling and fixed AV.'],
 ['Add vendors','Save florists, lighting and music from the marketplace to your wedding.'],
 ['Walk through','Switch to a guest\'s seat, change the lighting and compare layouts.'],
 ['Enquire','Send your selections to each vendor with quantities already filled in.']
];
const vendorCategories=[...new Set(demoListings.map(x=>x.category))];
const money=n=>'S$'+Number(n||0).toLocaleString('en-SG');
function IconButton({children,onClick,...props}){return <button type="button" onClick={onClick} {...props}>{children}</button>}
export default function PlatformApp({Studio}){
 const navRef=useRef(null);
 const [marketCategory,setMarketCategory]=useState(null),[vendorTab,setVendorTab]=useState('inventory'),[page,setPage]=useState(()=>{try{if(window.location.hash==='#venues')return 'hotel';return localStorage.getItem('wedding-session-v1')?'dashboard':'home'}catch{return 'home'}}),[studioStartMode,setStudioStartMode]=useState('design'),[planner,setPlanner]=useState(load),[planTab,setPlanTab]=useState('tasks'),[menu,setMenu]=useState(false),[mobile,setMobile]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(planner))},[planner]);
 const session=useAuth();const sessionRef=useRef(session);sessionRef.current=session;
 // Sign-in: members-only pages show a teaser when signed out; saving actions
 // ask to sign in first and then carry on.
 const [signin,setSignin]=useState(null);const pendingAfterSignIn=useRef(null);
 const askSignIn=(reason,after)=>{pendingAfterSignIn.current=after||null;setSignin({reason})};
 const onSignedIn=s=>{sessionRef.current=s;setSignin(null);setPlanner(prev=>({...prev,profile:{...(prev.profile||{}),email:s.email,name:prev.profile?.name||s.name}}));const after=pendingAfterSignIn.current;pendingAfterSignIn.current=null;if(after)after();else{setPage('dashboard');window.scrollTo?.(0,0)}setNotice('Welcome'+(s.name?', '+s.name:'')+'. Your plans now save to your account.');setTimeout(()=>setNotice(''),2600)};
 const membersOnly=['studio','plan','dashboard','profile','settings'];
 useSlidingIndicator(navRef,[page,!!session]);
 useEffect(()=>applyGlobalSettings(),[]);
 const patch=changes=>setPlanner(prev=>({...prev,...changes}));
 const completed=planner.tasks.filter(t=>t.done).length,percent=Math.round(100*completed/Math.max(1,planner.tasks.length));
 const nav=[['market','Marketplace'],['studio','Design'],['plan','Planner']];
 const openPlan=tab=>{setPlanTab(tab);go('plan')};
 // Seat assignment from the guest list: open the seating studio with the guest
 // ready, then come back to the list once their seat is confirmed.
 const [assignGuestId,setAssignGuestId]=useState(null);
 const startAssign=id=>{setAssignGuestId(id);setStudioStartMode('seating');setPage('studio');setMenu(false);window.scrollTo?.(0,0)};
 const finishAssign=result=>{setAssignGuestId(null);if(result){setNotice(`${result.guest.name||'Guest'} seated at Table ${result.tableId} · Seat ${result.seatNumber}`);setTimeout(()=>setNotice(''),2800)}setPlanTab('guests');setPage('plan');window.scrollTo?.(0,0)};
 const go=(next,options={})=>{if(next==='home'&&sessionRef.current)next='dashboard';if(!sessionRef.current&&(next==='profile'||next==='settings')){askSignIn('Sign in to see your profile.',()=>go(next));return}if(next==='studio'){setStudioStartMode('design');requestMapWarm()}if(next==='market')setMarketCategory(options.category||null);try{const h=next==='hotel'?'#venues':'';if(window.location.hash!==h)history.replaceState(null,'',window.location.pathname+window.location.search+h)}catch{}setPage(next);setMenu(false);window.scrollTo?.(0,0)};
 // @integration MARKETPLACE_SAVES: Save only to local planner; no vendor reservation or stock allocation.
 const addItem=item=>{if(!sessionRef.current){askSignIn(<>Sign in to save <em>{item.name}</em>.</>,()=>addItem(item));return}const existing=planner.savedItems.find(x=>x.id===item.id);if(existing&&!item.lineup)return;patch({savedItems:existing?planner.savedItems.map(x=>x.id===item.id?item:x):[...planner.savedItems,item]});setNotice(item.name+(existing?' line-up updated':' saved to your wedding'));setTimeout(()=>setNotice(''),2400)};
 // @prototype FAVOURITES: Category-based order is stored locally; venue listings are excluded.
 const toggleFavourite=item=>!sessionRef.current?askSignIn(<>Sign in to keep your <em>favourites</em>.</>,()=>toggleFavourite(item)):setPlanner(prev=>({...prev,favourites:prev.favourites.some(x=>x.id===item.id)?prev.favourites.filter(x=>x.id!==item.id):[...prev.favourites,item]}));
 const moveFavourite=(category,id,direction)=>setPlanner(prev=>{const all=[...prev.favourites];const indices=all.map((x,i)=>x.category===category?i:-1).filter(i=>i>=0);const index=indices.findIndex(i=>all[i].id===id);const other=index+direction;if(other<0||other>=indices.length)return prev;[all[indices[index]],all[indices[other]]]=[all[indices[other]],all[indices[index]]];return {...prev,favourites:all}});
 const addGuest=(side='')=>patch({guests:[...planner.guests,{id:'g'+Date.now(),name:'',side,diets:[],group:'',email:'',rsvp:'Pending',diet:'',tableId:'',seatId:'',checkedIn:false,gift:''}]});
 const updateGuest=(id,changes)=>patch({guests:planner.guests.map(g=>g.id===id?{...g,...changes}:g)});
 const updateTask=(id,done)=>patch({tasks:planner.tasks.map(t=>t.id===id?{...t,done}:t)});
 // @prototype CSV_EXPORT: Local browser download. No secure sharing, invitation delivery, or server-side retention policy.
 const exportGuests=()=>{const rows=[['Name','Side','Group','Email','RSVP','Diet','Table','Seat','Checked in'],...planner.guests.map(g=>[g.name,{hers:'Hers',his:'His',both:'Both sides'}[g.side]||'',g.group,g.email,g.rsvp,dietLabel(g),g.tableId,g.seatId,g.checkedIn?'Yes':'No'])];const csv=rows.map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='wedding-guests.csv';a.click();URL.revokeObjectURL(a.href)};
 return <div className={"platform-root "+(page==='home'?'platform-home':'platform-interior')}>
 <nav className="platform-nav"><button className="platform-logo" onClick={()=>go('home')}><span>W</span><strong>Wedding Studio</strong></button>{page==='hotel'?<div className="platform-links-centered nav-workspace"><span>Venue workspace</span></div>:<div className="platform-links platform-links-centered nav-pill" ref={navRef}><span className="slide-ind" aria-hidden="true"/>{nav.map(([key,label])=><button key={key} onPointerEnter={key==='studio'?warmMap:undefined} onPointerDown={key==='studio'?warmMap:undefined} onFocus={key==='studio'?warmMap:undefined} onClick={()=>go(key)} className={page===key?'active':''}>{label}</button>)}</div>}<div className="platform-nav-right">{page==='hotel'?<button className="nav-audience" onClick={()=>go('home')}>For couples</button>:<button className="nav-audience" onClick={()=>go('hotel')}>For venues</button>}{!session&&page!=='hotel'&&<div className="nav-auth"><button className="nav-signin" onClick={()=>askSignIn()}>Sign in</button><button className="nav-start" onClick={()=>askSignIn(<>Create your free <em>wedding space</em>.</>)}>Get started</button></div>}{session&&<div className="account-menu"><button aria-label="Account" aria-expanded={menu} className="account-trigger" onClick={()=>setMenu(!menu)}><UserRound size={18}/><ChevronDown size={13}/></button>{menu&&<div className="account-popover">{[['dashboard','My wedding',Heart],['profile','Profile',UserRound],['settings','Settings',Settings]].map(([id,label,Icon])=><button key={id} onClick={()=>go(id)}><Icon size={16}/>{label}</button>)}<div className="account-who">{session?.name||'Signed in'}<small>{session?.email}</small></div><button onClick={()=>{setMenu(false);signOut();setPage('home');window.scrollTo?.(0,0)}}><LogOut size={16}/>Log out</button></div>}</div>}<button className="mobile-nav-toggle" onClick={()=>setMobile(!mobile)} aria-label="Toggle navigation"><Menu size={20}/></button></div></nav>
 {mobile&&<div className="mobile-nav">{nav.map(([id,label])=><button key={id} onClick={()=>{go(id);setMobile(false)}}>{label}</button>)}<button onClick={()=>{go(page==='hotel'?'home':'hotel');setMobile(false)}}>{page==='hotel'?'For couples':'For venues'}</button></div>}
 {/* @placeholder HOME_VIDEO: Supply your own licensed MP4 at public/media/wedding-hero.mp4. No video file is bundled; CSS poster remains visible until supplied. */}
 {page==='home'&&<main className="landing landing-video-home">
  <div className="landing-video-layer" aria-hidden="true"><video autoPlay muted loop playsInline preload="metadata"><source src="/media/wedding-hero.mp4" type="video/mp4"/></video><div className="landing-video-fallback"/><div className="landing-video-shade"/></div>
  <div className="landing-video-content"><div className="landing-kicker">A MORE BEAUTIFUL WAY TO PLAN</div><h1><span className="rise-line"><span>Imagine it.</span></span><span className="rise-line"><span><em>Make it yours.</em></span></span></h1><p>Explore beautiful venues, design every detail, and plan your celebration in one place.</p><div className="landing-actions"><button className="landing-primary" onClick={()=>go('studio')}>Find your venue <ArrowRight size={17}/></button><button className="landing-link" onClick={()=>go('market')}>Browse vendors</button><button className="landing-link" onClick={()=>session?go('dashboard'):askSignIn(<>Sign in to start <em>planning</em>.</>,()=>go('plan'))}>Start planning</button></div><button className="landing-venue-line" onClick={()=>go('hotel')}>Run a wedding venue? <span>Open Banquet Sales <ArrowRight size={14}/></span></button></div>
  <span className="landing-photo-credit">Photo: <a href="https://commons.wikimedia.org/w/index.php?curid=36268069" target="_blank" rel="noreferrer">Millennium77</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, cropped and toned</span>
  <div className="landing-video-footnote">YOUR WEDDING, YOUR VISION <span>DISCOVER · DESIGN · PLAN</span></div>
 </main>}
 {page==='home'&&<div className="home-sections">
  <section className="home-doors" aria-label="Choose your account">
   <div className="home-door couples">
    <span className="page-eyebrow">FOR COUPLES</span>
    <h2>Plan your <em>wedding</em></h2>
    <ul><li>Tell the AI planner your tables, budget and style. It sets up the real ballroom in 3D.</li><li>Secure vendors with a 20% deposit through PayPal, approved by you.</li><li>Guest list, seating, budget and venue invoices in one planner.</li></ul>
    <div className="home-door-actions">{session?<button className="door-primary" onClick={()=>go('dashboard')}>Open my wedding <ArrowRight size={16}/></button>:<><button className="door-primary" onClick={()=>askSignIn(<>Create your free <em>wedding space</em>.</>,()=>go('dashboard'))}>Create a couple account <ArrowRight size={16}/></button><button className="door-link" onClick={()=>askSignIn(undefined,()=>go('dashboard'))}>Sign in</button></>}</div>
   </div>
   <div className="home-door venues">
    <span className="page-eyebrow">FOR VENUES</span>
    <h2>Run your <em>banquet sales</em></h2>
    <ul><li>Enquiries arrive with the date, tables and budget already worked out.</li><li>AI drafts the quote. You approve, and a PayPal deposit invoice goes out.</li><li>See who still owes a deposit, your ballroom calendar and the floor plan.</li></ul>
    <div className="home-door-actions"><button className="door-primary" onClick={()=>go('hotel')}>Venue sign-in <ArrowRight size={16}/></button><span className="door-note">Demo hotel · password in the README</span></div>
   </div>
  </section>
  <section className="home-section">
   <div className="home-section-head"><h2>How it <em>works</em></h2><span className="page-eyebrow">FOUR STEPS, ONE ROOM</span></div>
   <div className="home-steps"><span className="home-thread" aria-hidden="true"/>{homeSteps.map(([title,text],i)=><div className="home-step" key={title}><span className="home-dot" aria-hidden="true"/><span className="home-step-n">Step {i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>
  </section>
  {/* @placeholder HOME_VENUES: Only the Grand Ballroom has a 3D model. The other two cards are example listings. */}
  <section className="home-section">
   <div className="home-section-head"><h2>Venues ready <em>in 3D</em></h2><button className="home-link" onClick={()=>go('studio')}>Explore the venue map <ArrowRight size={15}/></button></div>
   <div className="home-venues">
    <button className="home-venue-feature" onClick={()=>go('studio')}><span className="home-venue-photo" style={{backgroundImage:'url(/venues/ballroom-render.jpg)'}}/><span className="home-venue-caption"><span className="home-flag">3D ready</span><h3>Grand Ballroom</h3><p>The Orchard Grand · Orchard · up to 380 guests · unofficial reconstruction</p></span></button>
    <div className="home-venue-list">
     <article><span className="home-venue-thumb garden" style={{backgroundImage:`url(${PHOTOS.garden})`}}/><div><span className="home-flag muted">3D coming</span><h3>Garden pavilion</h3><p>Example listing · outdoor · 150 guests</p></div></article>
     <article><span className="home-venue-thumb chapel" style={{backgroundImage:`url(${PHOTOS.chapel})`}}/><div><span className="home-flag muted">3D coming</span><h3>Heritage chapel</h3><p>Example listing · ceremony · 120 guests</p></div></article>
     <article><span className="home-venue-thumb map" style={{backgroundImage:"url(/map-snapshot.webp)"}}/><div><span className="home-flag">New</span><h3>Search the map</h3><p>Find venues across Singapore in 3D, then step inside.</p></div></article>
    </div>
   </div>
  </section>
  <section className="home-section">
   <div className="home-section-head"><h2>The vendor <em>edit</em></h2><span className="home-note">Every listing can be placed in your venue before you enquire.</span></div>
   <nav className="home-index" aria-label="Vendor categories">{vendorCategories.map((category,i)=>{const count=demoListings.filter(x=>x.category===category).length;return <button key={category} onClick={()=>go('market',{category})}><span className="home-index-n">{String(i+1).padStart(2,'0')}</span><span className="home-index-t">{category}</span><span className="home-index-c">{count} listing{count===1?'':'s'}</span><ArrowRight size={18}/></button>})}</nav>
  </section>
 </div>}
 {/* @legacy VENUES_PAGE: Older direct venue preview route. Venue discovery now belongs in Marketplace. */}
 {page==='venues'&&<main className="platform-page"><div className="page-eyebrow">VENUE COLLECTION</div><h1>Find your perfect setting.</h1><p className="page-lede">Explore a venue and design your celebration in 3D. More Singapore venues will be added as models are verified.</p><div className="venue-preview-card"><div className="venue-art"><span>THE ORCHARD GRAND</span><div className="venue-arch"/></div><div className="venue-preview-info"><small>SINGAPORE · ORCHARD</small><h2>Grand Ballroom</h2><p>Interactive concept model. Architectural fixtures and placement remain estimates.</p><button onClick={()=>go('studio')}>Enter 3D studio <ArrowRight size={16}/></button></div></div></main>}
 {page==='studio'&&!session&&<Teaser page="studio" go={go} onSignIn={()=>askSignIn(<>Sign in to start <em>designing</em>.</>,()=>go('studio'))}/>}
 {page==='studio'&&session&&<div className="embedded-studio"><DesignPage Studio={Studio} onNavigate={go} planner={planner} onPlannerChange={setPlanner} initialMode={studioStartMode} assignGuestId={assignGuestId} onAssignDone={finishAssign}/></div>}
 {page==='market'&&<Marketplace key={marketCategory||'all'} initialCategory={marketCategory} onBack={()=>go('home')} onAdd={addItem} added={planner.savedItems.map(x=>x.id)} savedItems={planner.savedItems} favourites={planner.favourites.map(x=>x.id)} onToggleFavourite={toggleFavourite} onStartDesign={()=>go('studio')} onPlan={()=>{setPlanTab('vendors');go('plan')}}/>}
 {page==='dashboard'&&!session&&<Teaser page="dashboard" go={go} onSignIn={()=>askSignIn()}/>}
 {page==='dashboard'&&session&&<MyWeddingPage planner={planner} go={go} openPlan={openPlan} percent={percent} completed={completed}/>}
 {/* @prototype PLANNER: RSVP, guest check-in, vendor payments and notes are local workflows, not production integrations. */}
 {page==='plan'&&!session&&<Teaser page="plan" go={go} onSignIn={()=>askSignIn(<>Sign in to start <em>planning</em>.</>,()=>go('plan'))}/>}
 {page==='plan'&&session&&<PlannerPage planner={planner} patch={patch} planTab={planTab} setPlanTab={setPlanTab} completed={completed} percent={percent} exportGuests={exportGuests} addGuest={addGuest} updateGuest={updateGuest} updateTask={updateTask} toggleFavourite={toggleFavourite} moveFavourite={moveFavourite} vendorTab={vendorTab} setVendorTab={setVendorTab} go={go} openSeating={()=>{setStudioStartMode('seating');setPage('studio')}} onAssign={startAssign}/>}
 {page==='profile'&&session&&<ProfilePage planner={planner} patch={patch} go={go} signedInEmail={session.email}/>}
 {/* @integration AUTH: Profile dropdown Log out is intentionally disabled until account authentication exists. */}
 {page==='settings'&&session&&<SettingsPage planner={planner} resetPlanner={()=>{setPlanner(initial);localStorage.removeItem(KEY)}} notify={t=>{setNotice(t);setTimeout(()=>setNotice(''),2400)}}/>}
 {notice&&<div className="platform-toast">{notice}</div>}
 {page==='hotel'&&<Suspense fallback={<main className="platform-page"><p>Loading the venue dashboard…</p></main>}><HotelDashboard/></Suspense>}
 <MapStage enabled={!!session}/>
 <footer className="platform-footer"><span>Wedding Studio · Unofficial concept · <button type="button" className="footer-link" onClick={()=>go('hotel')}>For venues (demo)</button></span><span>Designed for meaningful celebrations</span></footer>
  <SignInDialog open={!!signin} reason={signin?.reason} onClose={()=>{setSignin(null);pendingAfterSignIn.current=null}} onSignedIn={onSignedIn}/>
 {!session&&['home','market','studio','plan','dashboard'].includes(page)&&<SignInBar onSignIn={()=>askSignIn()}/>}
</div>;
}

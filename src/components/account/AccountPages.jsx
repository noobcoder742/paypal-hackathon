// Account area: My Wedding (overview), Profile and Settings.
import React,{useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,CalendarDays,Users,Wallet,Sparkles,MapPin,Download,Trash2,ShieldCheck,Bell,Globe2,Box,UserRound,Lock,Info,Check} from 'lucide-react';
import {CountUp,Ring,Reveal} from '../ui/motion.jsx';
import {useSettings,SETTINGS_KEY} from '../../data/settings.js';
import {VENUES,findVenue,findSpace} from '../../data/venues.js';
import {savedDraftCounts} from '../../explorer/DesignPage.jsx';

const money=n=>'S$'+Math.round(Number(n||0)).toLocaleString('en-SG');
const daysUntil=date=>{if(!date)return null;const d=new Date(date+'T00:00:00+08:00'),now=new Date();return Math.ceil((d-now)/86400000)};
const readDesign=()=>{try{return JSON.parse(localStorage.getItem('wedding-design-v1'))||{}}catch{return {}}};

/* ---------- My Wedding ---------- */
export function MyWeddingPage({planner,go,openPlan,percent,completed}){
 const days=daysUntil(planner.date),design=useMemo(readDesign,[]),venue=findVenue(design.venueId),space=findSpace(design.venueId,design.spaceId);
 const drafts=savedDraftCounts(design),draftTotal=Object.values(drafts).reduce((a,b)=>a+b,0);
 const thumb=space?design.drafts?.[space.studio]?.thumbs?.[design.drafts?.[space.studio]?.active||'A']:null;
 const paid=planner.payments.filter(p=>p.paid).reduce((s,p)=>s+Number(p.amount||0),0),planned=planner.payments.reduce((s,p)=>s+Number(p.amount||0),0)+planner.savedItems.reduce((s,i)=>s+(i.price||0)*(planner.inventoryQuantities?.[i.id]||1),0);
 const attending=planner.guests.filter(g=>g.rsvp==='Attending').length,pending=planner.guests.filter(g=>g.rsvp==='Pending').length,declined=planner.guests.filter(g=>g.rsvp==='Declined').length;
 const next=planner.tasks.filter(t=>!t.done).slice(0,4);
 return <main className="acct-page wed">
  <section className="wed-hero">
   <div className="wed-hero-photo" style={{backgroundImage:`url(${thumb||'/venues/orchard-grand/grand-ballroom.jpg'})`}} aria-hidden="true"/>
   <div className="wed-hero-copy">
    <span className="acct-kicker">My wedding</span>
    {days!=null&&days>=0?<h1><span className="wed-days"><CountUp value={days}/></span> {days===1?'day':'days'} to go.</h1>:days!=null?<h1>Congratulations on your <em>wedding</em>.</h1>:<h1>Your day, <em>beautifully</em> planned.</h1>}
    <p>{planner.date?new Date(planner.date+'T00:00:00').toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Set your wedding date in your profile to start the countdown.'}{venue?` · ${venue.name}`:''}</p>
    <div className="wed-hero-actions"><button className="btn-ink" onClick={()=>openPlan('tasks')}>Continue planning <ArrowRight size={16}/></button>{!planner.date&&<button className="btn-line" onClick={()=>go('profile')}>Add wedding date</button>}</div>
   </div>
  </section>

  <section className="wed-grid">
   <Reveal index={0} className="wed-card wed-progress" onClick={()=>openPlan('tasks')} role="button" tabIndex={0}>
    <Ring value={percent/100} label={`${percent}% of planning tasks done`}><strong><CountUp value={percent}/>%</strong><small>planned</small></Ring>
    <div><h2>Planning progress</h2><p>{completed} of {planner.tasks.length} tasks complete</p><span className="wed-link">Open checklist <ArrowRight size={14}/></span></div>
   </Reveal>
   <Reveal index={1} className="wed-card wed-venue" onClick={()=>go('studio')} role="button" tabIndex={0}>
    <div className="wed-venue-img" style={thumb?{backgroundImage:`url(${thumb})`}:undefined}>{!thumb&&<MapPin size={22}/>}</div>
    <div><span className="acct-kicker">Venue & design</span><h2>{venue?venue.name:'Choose your venue'}</h2><p>{venue?`${space?.name||''} · ${draftTotal} saved draft${draftTotal===1?'':'s'}`:'Explore partner venues on the 3D map.'}</p><span className="wed-link">{venue?'Open your design':'Open the map'} <ArrowUpRight size={14}/></span></div>
   </Reveal>
   <Reveal index={2} className="wed-card wed-guests" onClick={()=>openPlan('guests')} role="button" tabIndex={0}>
    <span className="acct-kicker">Guests</span><h2><CountUp value={planner.guests.length}/> <small>invited</small></h2>
    <div className="wed-bars" aria-label={`${attending} attending, ${pending} pending, ${declined} declined`}>
     {[['Attending',attending,'att'],['Pending',pending,'pen'],['Declined',declined,'dec']].map(([l,n,c])=><div key={l}><span>{l}</span><i><b className={c} style={{width:(planner.guests.length?n/planner.guests.length*100:0)+'%'}}/></i><em>{n}</em></div>)}
    </div>
   </Reveal>
   <Reveal index={3} className="wed-card wed-budget" onClick={()=>openPlan('budget')} role="button" tabIndex={0}>
    <span className="acct-kicker">Budget</span><h2><CountUp value={planner.budget} format={money}/></h2>
    <div className="wed-meter"><i style={{width:Math.min(100,planned/Math.max(1,planner.budget)*100)+'%'}}/><b style={{width:Math.min(100,paid/Math.max(1,planner.budget)*100)+'%'}}/></div>
    <p><span className="wdot paid"/>Paid {money(paid)} <span className="wdot plan"/>Planned {money(planned)}</p>
   </Reveal>
  </section>

  <section className="wed-lower">
   <Reveal className="wed-next">
    <div className="acct-row"><h2>Up next</h2><button className="text-link" onClick={()=>openPlan('tasks')}>View all</button></div>
    {next.map((t,i)=><button className="wed-task" key={t.id} onClick={()=>openPlan('tasks')} style={{'--ri':i}}><span className="wed-task-dot"/><span>{t.title}<small>{t.group}</small></span><ArrowRight size={15}/></button>)}
    {!next.length&&<p className="acct-muted">Every task is done. Enjoy the day.</p>}
   </Reveal>
   <Reveal className="wed-saved" index={1}>
    <div className="acct-row"><h2>Saved for your room</h2><button className="text-link" onClick={()=>go('market')}>Marketplace</button></div>
    <div className="wed-saved-strip">{planner.savedItems.slice(0,6).map(item=><div key={item.id} className="wed-saved-item"><div style={{backgroundImage:`url(${item.photo})`}}/><span>{item.name}</span></div>)}
     {!planner.savedItems.length&&<p className="acct-muted">Add florals, lighting or music from the marketplace and they appear here and in your 3D room.</p>}</div>
   </Reveal>
  </section>
 </main>;
}

/* ---------- Profile ---------- */
// Options chosen to reflect weddings in Singapore; every question is optional.
const RELIGIONS=['Buddhist','Christian (Protestant)','Catholic','Muslim','Hindu','Taoist','Sikh','No religion','Interfaith / mixed','Other','Prefer not to say'];
const OPTIONS={
 role:['Bride','Groom','Partner','Parent or family','Wedding planner','Other'],
 ceremony:['Religious ceremony','Civil solemnisation (ROM)','Religious and civil','Customary or tea ceremony','Not decided'],
 guestRange:['Under 100','100–200','200–300','300–500','500+'],
 budgetRange:['Under S$20k','S$20k–40k','S$40k–70k','S$70k–100k','S$100k+','Prefer not to say'],
 style:['Classic','Modern','Garden','Rustic','Glamorous','Minimalist','Cultural / traditional'],
 venueType:['Hotel ballroom','Church or place of worship','Outdoor / garden','Restaurant','Unique venue','Not sure yet'],
 area:['Central','East','West','North','North-East','Anywhere'],
 residency:['Singapore citizen','Permanent resident','Foreigner living in Singapore','Overseas couple'],
 stage:['Just engaged','Looking for a venue','Venue booked','Choosing vendors','Final details'],
 heardFrom:['Friend or family','Instagram','TikTok','Google search','Wedding show','Venue recommended us','Other']
};
const FIELDS=[
 ['About you',[['name','Your name','text'],['email','Sign-in email','email'],['age','Age','number'],['role','Your role','role'],['residency','Residency','residency']]],
 ['Your wedding',[['date','Wedding date','date'],['religion','Religion','religion'],['ceremony','Ceremony','ceremony'],['guestRange','Guest count','guestRange'],['budgetRange','Total budget','budgetRange']]],
 ['Your taste',[['style','Wedding style','style',true],['venueType','Venue type','venueType',true],['area','Preferred area','area',true]]],
 ['Where you are',[['stage','Planning stage','stage'],['heardFrom','How you found us','heardFrom']]]
];
export function ProfilePage({planner,patch,go}){
 const profile=planner.profile||{},set=(k,v)=>k==='date'?patch({date:v}):patch({profile:{...profile,[k]:v}});
 const val=k=>k==='date'?planner.date:profile[k];
 const all=FIELDS.flatMap(([,f])=>f),filled=all.filter(([k])=>{const v=val(k);return Array.isArray(v)?v.length:v!==undefined&&v!==''}).length;
 const toggle=(k,o)=>{const cur=Array.isArray(profile[k])?profile[k]:[];set(k,cur.includes(o)?cur.filter(x=>x!==o):[...cur,o])};
 return <main className="acct-page prof">
  <div className="acct-head">
   <div><span className="acct-kicker">Profile</span><h1>Tell us about <em>your</em> day.</h1><p>Every question is optional. Your answers tailor the checklist, venues and vendors we suggest.</p></div>
   <Ring value={filled/all.length} size={112} label={`Profile ${Math.round(filled/all.length*100)}% complete`}><strong>{Math.round(filled/all.length*100)}%</strong><small>complete</small></Ring>
  </div>
  {FIELDS.map(([title,fields],si)=><Reveal key={title} index={si} as="section" className="prof-sec">
   <h2><span>{String(si+1).padStart(2,'0')}</span>{title}</h2>
   <div className="prof-fields">{fields.map(([k,label,type,multi])=>{
    if(type==='religion')return <label key={k} className="prof-field"><span>{label}</span><select value={val(k)||''} onChange={e=>set(k,e.target.value)}><option value="">Select</option>{RELIGIONS.map(o=><option key={o}>{o}</option>)}</select></label>;
    if(OPTIONS[type])return multi
     ?<div key={k} className="prof-field wide"><span>{label} <small>choose any</small></span><div className="prof-chips">{OPTIONS[type].map(o=>{const on=(profile[k]||[]).includes(o);return <button type="button" key={o} className={on?'on':''} aria-pressed={on} onClick={()=>toggle(k,o)}>{on&&<Check size={13}/>}{o}</button>})}</div></div>
     :<div key={k} className="prof-field wide"><span>{label}</span><div className="prof-chips">{OPTIONS[type].map(o=><button type="button" key={o} className={val(k)===o?'on':''} aria-pressed={val(k)===o} onClick={()=>set(k,val(k)===o?'':o)}>{o}</button>)}</div></div>;
    return <label key={k} className="prof-field"><span>{label}{k==='email'&&<small> locks to your account after sign-in</small>}</span><input type={type} value={val(k)||''} min={type==='number'?18:undefined} max={type==='number'?100:undefined} placeholder={k==='email'?'you@example.com':''} onChange={e=>set(k,type==='number'?(e.target.value?Math.max(0,Number(e.target.value)):''):e.target.value)}/></label>;
   })}</div>
  </Reveal>)}
  <p className="acct-note"><ShieldCheck size={15}/> Stored on this device only for now. Answers are used for anonymised analytics only if you allow it in <button className="text-link" onClick={()=>go('settings')}>Settings</button>.</p>
 </main>;
}

/* ---------- Settings ---------- */
function Toggle({checked,onChange,label,hint}){
 return <div className="set-row"><div><strong>{label}</strong>{hint&&<small>{hint}</small>}</div><button type="button" role="switch" aria-checked={checked} aria-label={label} className={'switch'+(checked?' on':'')} onClick={()=>onChange(!checked)}><i/></button></div>;
}
function Choice({value,options,onChange,label,hint}){
 return <div className="set-row"><div><strong>{label}</strong>{hint&&<small>{hint}</small>}</div><div className="seg-mini" role="radiogroup" aria-label={label}>{options.map(([v,l])=><button type="button" key={v} role="radio" aria-checked={value===v} className={value===v?'on':''} onClick={()=>onChange(v)}>{l}</button>)}</div></div>;
}
export function SettingsPage({planner,resetPlanner,notify}){
 const [s,save]=useSettings(),[tab,setTab]=useState('account');
 const exportData=()=>{const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^wedding/.test(k))data[k]=localStorage.getItem(k)}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='wedding-studio-data.json';a.click();URL.revokeObjectURL(a.href)};
 const clearDesigns=()=>{if(!confirm('Delete every saved 3D design and draft on this device?'))return;Object.keys(localStorage).filter(k=>/^wedding-(room|design)/.test(k)).forEach(k=>localStorage.removeItem(k));notify('Designs and drafts cleared')};
 const tabs=[['account','Account',UserRound],['notifications','Notifications',Bell],['regional','Language & region',Globe2],['studio','3D & motion',Box],['privacy','Privacy & data',Lock],['about','About',Info]];
 return <main className="acct-page sets">
  <div className="acct-head"><div><span className="acct-kicker">Settings</span><h1>Make it <em>yours</em>.</h1><p>Changes save automatically on this device.</p></div></div>
  <div className="sets-layout">
   <nav className="sets-nav" aria-label="Settings sections">{tabs.map(([id,l,Icon])=><button key={id} className={tab===id?'on':''} aria-current={tab===id} onClick={()=>setTab(id)}><Icon size={16}/>{l}</button>)}</nav>
   <div className="sets-panel" key={tab}>
    {tab==='account'&&<section><h2>Account</h2>
     <div className="set-row"><div><strong>Signed in as</strong><small>{planner.profile?.email||'Not signed in. Accounts arrive with the backend.'}</small></div><button className="btn-line" disabled>Sign in</button></div>
     <div className="set-row"><div><strong>Password and sign-in methods</strong><small>Email link, Google and Apple sign-in are planned.</small></div><span className="soon">Coming soon</span></div>
     <div className="set-row"><div><strong>Invite your partner or planner</strong><small>Plan together with shared access to drafts and guests.</small></div><span className="soon">Coming soon</span></div>
     <div className="set-row warn"><div><strong>Delete account</strong><small>Removes your account and data from our servers once accounts exist.</small></div><span className="soon">Coming soon</span></div>
    </section>}
    {tab==='notifications'&&<section><h2>Notifications</h2>
     <Toggle label="Task reminders" hint="Email when checklist items are coming due" checked={s.emailTaskReminders} onChange={v=>save({emailTaskReminders:v})}/>
     <Toggle label="Vendor replies" hint="When a vendor answers your enquiry" checked={s.emailVendorReplies} onChange={v=>save({emailVendorReplies:v})}/>
     <Toggle label="RSVP updates" hint="When guests accept or decline" checked={s.emailRsvpUpdates} onChange={v=>save({emailRsvpUpdates:v})}/>
     <Toggle label="Weekly summary" hint="A Sunday recap of progress and what's next" checked={s.weeklySummary} onChange={v=>save({weeklySummary:v})}/>
     <p className="acct-muted">Emails start once sign-in is available.</p>
    </section>}
    {tab==='regional'&&<section><h2>Language & region</h2>
     <Choice label="Currency" value={s.currency} options={[['SGD','S$ SGD'],['MYR','RM MYR'],['USD','US$ USD']]} onChange={v=>save({currency:v})}/>
     <Choice label="Date format" value={s.dateFormat} options={[['d MMM yyyy','2 Nov 2026'],['dd/MM/yyyy','02/11/2026']]} onChange={v=>save({dateFormat:v})}/>
     <Choice label="Language" hint="Chinese, Malay and Tamil are planned" value={s.language} options={[['en','English']]} onChange={v=>save({language:v})}/>
     <div className="set-row"><div><strong>Time zone</strong><small>Used for countdowns and reminders</small></div><span>Singapore (GMT+8)</span></div>
    </section>}
    {tab==='studio'&&<section><h2>3D & motion</h2>
     <Choice label="Map quality" hint="Lower it if the map feels slow on this device" value={s.mapQuality} options={[['high','High'],['balanced','Balanced'],['saver','Battery saver']]} onChange={v=>save({mapQuality:v})}/>
     <p className="acct-muted">High shows sunset shadows and neighbourhood detail. Balanced keeps detail without shadows. Battery saver shows the plain map.</p>
     <Toggle label="Reduce motion" hint="Turns off animated transitions across the site" checked={s.reduceMotion} onChange={v=>save({reduceMotion:v})}/>
    </section>}
    {tab==='privacy'&&<section><h2>Privacy & data</h2>
     <Toggle label="Share anonymised usage and profile data" hint="Helps us understand what couples need (PDPA consent). Off by default." checked={s.analyticsConsent} onChange={v=>save({analyticsConsent:v})}/>
     <Toggle label="Personalised suggestions" hint="Use your profile to suggest venues and vendors" checked={s.personalisedRecommendations} onChange={v=>save({personalisedRecommendations:v})}/>
     <Toggle label="News and offers by email" checked={s.marketingEmails} onChange={v=>save({marketingEmails:v})}/>
     <div className="set-row"><div><strong>Download your data</strong><small>Everything saved on this device, as a JSON file</small></div><button className="btn-line" onClick={exportData}><Download size={14}/> Download</button></div>
     <div className="set-row"><div><strong>Clear 3D designs and drafts</strong><small>Removes saved ballroom layouts on this device</small></div><button className="btn-line" onClick={clearDesigns}><Trash2 size={14}/> Clear</button></div>
     <div className="set-row warn"><div><strong>Clear all planning data</strong><small>Checklist, guests, budget, profile and saved items on this device</small></div><button className="btn-line warn" onClick={()=>{if(confirm('Clear all locally saved planning data?')){resetPlanner();notify('Planning data cleared')}}}><Trash2 size={14}/> Clear</button></div>
    </section>}
    {tab==='about'&&<section><h2>About</h2>
     <div className="set-row"><div><strong>Wedding Studio</strong><small>Prototype · data stays in this browser</small></div><span>v0.4</span></div>
     <div className="set-row"><div><strong>Map data</strong><small>© OpenStreetMap contributors (ODbL)</small></div></div>
     <div className="set-row"><div><strong>Terms and privacy policy</strong><small>Published before launch</small></div><span className="soon">Coming soon</span></div>
    </section>}
   </div>
  </div>
 </main>;
}
export {VENUES,SETTINGS_KEY};

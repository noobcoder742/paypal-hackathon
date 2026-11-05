// The venue map kept ready in the background (spec: docs/superpowers/specs/2026-11-05-city-phase-2-design.md, B1).
//
// MapStage is rendered once by the app. It creates the map (one 3D view for
// the whole visit) in a hidden container as soon as the app has loaded, with
// drawing paused. MapSlot, rendered by the Design page, moves that same element
// into place and resumes drawing, so opening Design has no setup at all.
// On phones with 4 GB of memory or less the map waits for the first hover,
// tap or focus of Design (requestMapWarm). While parked it is laid out at the
// viewport's size, so moving it into place keeps its last drawn picture. If the tab stays hidden for more
// than 5 minutes while the map is parked, it is released and rebuilt on demand.
import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import VenueExplorer from './VenueExplorer.jsx';
import {mapHostMetrics as metrics} from './mapHostMetrics.js';

const RELEASE_AFTER_MS=5*60*1000;
const store={props:{},slot:null,warmAsked:false,released:false};
let snap={...store};const listeners=new Set();
const notify=()=>{snap={...store};listeners.forEach(f=>f())};
const subscribe=f=>{listeners.add(f);return()=>listeners.delete(f)};

/** Ask for the map to be prepared now (a hover, tap or focus of Design). */
export function requestMapWarm(){if(!store.warmAsked||store.released){store.warmAsked=true;store.released=false;notify()}}

let hostEl=null,parkEl=null;
function host(){
 if(!hostEl){hostEl=document.createElement('div');hostEl.className='map-host'}
 if(!parkEl){parkEl=document.createElement('div');parkEl.className='map-park';parkEl.setAttribute('aria-hidden','true');
  Object.assign(parkEl.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',visibility:'hidden',pointerEvents:'none',zIndex:'-1',overflow:'hidden'});document.body.appendChild(parkEl)}
 return hostEl;
}
const park=()=>{const h=host();if(h.parentNode!==parkEl)parkEl.appendChild(h)};

/** Where the map shows on the Design page. Props go to the shared VenueExplorer. */
export function MapSlot({onOpenSpace,initialVenueId=null,draftCounts={}}){
 const ref=useRef(null),open=useRef(onOpenSpace);open.current=onOpenSpace;
 const counts=JSON.stringify(draftCounts);
 useLayoutEffect(()=>{store.props={onOpenSpace:(...a)=>open.current?.(...a),initialVenueId,draftCounts:JSON.parse(counts)};notify()},[initialVenueId,counts]);
 useLayoutEffect(()=>{const h=host();ref.current.appendChild(h);store.slot=ref.current;store.released=false;const m=metrics();m.activatedAt=performance.now();m.framesSinceActive=0;m.framesDrawnAtActivation=m.framesDrawn;notify();
  return()=>{park();store.slot=null;metrics().activatedAt=null;notify()}},[]);
 return <div ref={ref} className="map-slot"/>;
}

/** Rendered once by the app; enabled when someone is signed in. */
export function MapStage({enabled}){
 const s=useSyncExternalStore(subscribe,()=>snap);
 const [loaded,setLoaded]=useState(()=>document.readyState==='complete');
 useEffect(()=>{if(loaded)return;const f=()=>setLoaded(true);window.addEventListener('load',f);return()=>window.removeEventListener('load',f)},[loaded]);
 // release the parked map if the tab stays hidden for a long time
 useEffect(()=>{let t=null;const f=()=>{clearTimeout(t);if(document.hidden)t=setTimeout(()=>{if(!store.slot){store.released=true;notify()}},RELEASE_AFTER_MS)};
  document.addEventListener('visibilitychange',f);return()=>{clearTimeout(t);document.removeEventListener('visibilitychange',f)}},[]);
 const lowMemory=(navigator.deviceMemory||8)<=4;
 const on=!!enabled&&(!!s.slot||(loaded&&!s.released&&(!lowMemory||s.warmAsked)));
 useEffect(()=>{metrics().warm=on},[on]);
 if(!on)return null;
 const h=host();if(!s.slot&&!h.parentNode)park();
 return createPortal(<VenueExplorer {...s.props} active={!!s.slot}/>,h);
}

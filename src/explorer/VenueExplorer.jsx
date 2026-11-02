// Map-first Design page: a free 3D map of Singapore (OpenStreetMap tiles from
// scripts/fetch-sg-map.mjs), venue search and filters, fly-to, a floating venue
// card, and a highlighted ballroom inside a translucent building before
// diving into the 3D studio.
import React,{useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {Search,X,ArrowRight,MapPin} from 'lucide-react';
import {VENUES,VENUE_CATEGORIES} from '../data/venues.js';
import {project,pointInPolygon} from './geo.js';

const INDEX_URL='/data/sg/index.json',TILE_URL=k=>`/data/sg/tiles/${k}.json`;
const LEGACY_URL='/data/orchard-grand-surroundings.json';
const BG='#fbfaf8';

/* ---------- venue anchors in map metres ---------- */
const VENUE_GEO=Object.fromEntries(VENUES.map(v=>[v.id,{points:v.points.map(([la,lo])=>project(la,lo))}]));
VENUES.forEach(v=>{const p=VENUE_GEO[v.id].points;VENUE_GEO[v.id].x=p.reduce((s,q)=>s+q[0],0)/p.length;VENUE_GEO[v.id].z=p.reduce((s,q)=>s+q[1],0)/p.length});

/* ---------- tile loading ---------- */
let indexRequest=null;
function loadIndex(){
 return indexRequest||(indexRequest=fetch(INDEX_URL).then(r=>r.ok?r.json():null).catch(()=>null).then(async idx=>{
  if(idx?.tiles)return idx;
  // Fallback until the Singapore tiles exist: the 700 m Orchard Grand dataset as one tile.
  const legacy=await fetch(LEGACY_URL).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!legacy?.buildings)return null;
  const [ox,oz]=project(legacy.anchor.lat,legacy.anchor.lon);
  const shift=poly=>poly.flatMap(([x,z])=>[x+ox,z+oz]);
  return {legacy:true,tileSize:1e9,tiles:{legacy:[legacy.buildings.length,0]},data:{legacy:{
   b:legacy.buildings.map(b=>[b.h,b.minH||0,b.colour||'',b.name||'',0,shift(b.poly)]),
   r:legacy.roads.filter(r=>r.w>=4).map(r=>[r.w,shift(r.pts)]),g:(legacy.green||[]).map(shift),w:(legacy.water||[]).map(shift)}}};
 }));
}
const tileCache=new Map();
function loadTile(index,key){
 if(index.legacy)return Promise.resolve(index.data[key]);
 if(!tileCache.has(key))tileCache.set(key,fetch(TILE_URL(key)).then(r=>r.ok?r.json():null).catch(()=>null));
 return tileCache.get(key);
}

/* ---------- geometry ---------- */
const PALE=['#ece9e3','#e4e0d8','#e9e6e1','#dfdcd6','#f0ede7'],WHITE=new THREE.Color('#ffffff');
function shapeOf(flat){const pts=[];for(let i=0;i<flat.length;i+=2)pts.push(new THREE.Vector2(flat[i],-flat[i+1]));if(THREE.ShapeUtils.isClockWise(pts))pts.reverse();return new THREE.Shape(pts)}
function buildTile(data){
 const ctxP=[],ctxC=[],venueParts={};
 data.b.forEach(([h,minH,col,,isPart,flat],i)=>{
  const owner=VENUES.find(v=>VENUE_GEO[v.id].points.some(([x,z])=>pointInPolygon(x,z,flat)));
  let g;try{g=new THREE.ExtrudeGeometry(shapeOf(flat),{depth:Math.max(2,h-minH),bevelEnabled:false})}catch{return}
  g.rotateX(-Math.PI/2);g.translate(0,minH,0);
  if(owner){(venueParts[owner.id]=venueParts[owner.id]||[]).push(g);return}
  const c=new THREE.Color(col||PALE[i%PALE.length]);if(col)c.lerp(WHITE,.6);
  const a=g.attributes.position.array;
  for(let k=0;k<a.length;k+=3){ctxP.push(a[k],a[k+1],a[k+2]);ctxC.push(c.r,c.g,c.b)}
  g.dispose();
 });
 const ctx=new THREE.BufferGeometry();ctx.setAttribute('position',new THREE.Float32BufferAttribute(ctxP,3));ctx.setAttribute('color',new THREE.Float32BufferAttribute(ctxC,3));ctx.computeVertexNormals();
 const roads=[];data.r.forEach(([w,f])=>{const h=w/2;for(let i=0;i+3<f.length;i+=2){const x1=f[i],z1=f[i+1],x2=f[i+2],z2=f[i+3];let dx=x2-x1,dz=z2-z1;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const ax=-dz*h,az=dx*h;roads.push(x1+ax,.25,z1+az,x2-ax,.25,z2-az,x2+ax,.25,z2+az,x1+ax,.25,z1+az,x1-ax,.25,z1-az,x2-ax,.25,z2-az)}});
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(roads,3));rg.computeVertexNormals();
 const flat=(polys,y)=>{const P=[];polys.forEach(f=>{try{const s=new THREE.ShapeGeometry(shapeOf(f)).toNonIndexed();s.rotateX(-Math.PI/2);const a=s.attributes.position.array;for(let k=0;k<a.length;k+=3)P.push(a[k],y,a[k+2]);s.dispose()}catch{}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g};
 return {ctx,roads:rg,green:flat(data.g||[],.15),water:flat(data.w||[],.1),venueParts};
}
const MATS={
 ctx:new THREE.MeshLambertMaterial({vertexColors:true}),
 road:new THREE.MeshBasicMaterial({color:'#e6e1d8',side:THREE.DoubleSide}),
 green:new THREE.MeshBasicMaterial({color:'#e2ead8'}),
 water:new THREE.MeshBasicMaterial({color:'#d9e6ec'}),
 edge:new THREE.LineBasicMaterial({color:'#8e3b46',transparent:true,opacity:.35})
};

function Tile({tileKey,index,focus,onVenueBounds}){
 const [built,setBuilt]=useState(null);
 useEffect(()=>{let live=true;loadTile(index,tileKey).then(d=>{if(live&&d)setBuilt(buildTile(d))});return()=>{live=false}},[tileKey,index]);
 useEffect(()=>()=>{if(built){built.ctx.dispose();built.roads.dispose();built.green.dispose();built.water.dispose();Object.values(built.venueParts).flat().forEach(g=>g.dispose())}},[built]);
 useEffect(()=>{if(!built)return;Object.entries(built.venueParts).forEach(([id,parts])=>{const box=new THREE.Box3();parts.forEach(g=>{g.computeBoundingBox();box.union(g.boundingBox)});onVenueBounds(id,box)})},[built,onVenueBounds]);
 if(!built)return null;
 return <group>
  <mesh geometry={built.green} material={MATS.green} raycast={()=>null}/>
  <mesh geometry={built.water} material={MATS.water} raycast={()=>null}/>
  <mesh geometry={built.roads} material={MATS.road} raycast={()=>null}/>
  <mesh geometry={built.ctx} material={MATS.ctx} raycast={()=>null}/>
  {Object.entries(built.venueParts).map(([id,parts])=><VenueBuilding key={id} id={id} parts={parts} focus={focus}/>)}
 </group>;
}
function VenueBuilding({id,parts,focus}){
 const mat=useMemo(()=>new THREE.MeshLambertMaterial({color:VENUES.find(v=>v.id===id)?.status==='3d'?'#f6e7e3':'#efe9df',transparent:true}),[id]);
 const edges=useMemo(()=>parts.map(g=>new THREE.EdgesGeometry(g,30)),[parts]);
 useEffect(()=>()=>{mat.dispose();edges.forEach(e=>e.dispose())},[mat,edges]);
 const ghost=focus.venueId===id&&!!focus.spaceId;
 mat.opacity=ghost?.1:1;mat.depthWrite=!ghost;
 return <group>{parts.map((g,i)=><mesh key={i} geometry={g} material={mat} raycast={()=>null}/>)}{edges.map((e,i)=><lineSegments key={'e'+i} geometry={e} material={MATS.edge}/>)}</group>;
}

/* ---------- camera ---------- */
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function MapCamera({rigRef}){
 const {camera,gl,scene}=useThree();
 const rig=rigRef.current;
 useFrame(()=>{
  const {cur,goal}=rig;
  if(rig.fly){const p=Math.min(1,(performance.now()-rig.fly.t0)/rig.fly.dur),k=ease(p);for(const key in rig.fly.to)cur[key]=rig.fly.from[key]+(rig.fly.to[key]-rig.fly.from[key])*k;Object.assign(goal,cur);if(p>=1){rig.fly=null;rig.onArrive?.();rig.onArrive=null}}
  else for(const key in goal)cur[key]+=(goal[key]-cur[key])*.12;
  camera.position.set(cur.tx+cur.r*Math.sin(cur.phi)*Math.sin(cur.theta),cur.r*Math.cos(cur.phi),cur.tz+cur.r*Math.sin(cur.phi)*Math.cos(cur.theta));
  camera.lookAt(cur.tx,0,cur.tz);
  camera.near=Math.max(1,cur.r*.01);camera.far=cur.r*12+2000;camera.updateProjectionMatrix();
  scene.fog.near=cur.r*1.6;scene.fog.far=cur.r*4.8;
 });
 useEffect(()=>{
  const el=gl.domElement;let drag=null;const pointers=new Map();let pinch=0;
  const down=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});el.setPointerCapture(e.pointerId);rig.fly=null;if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);drag=null;return}drag={x:e.clientX,y:e.clientY,rot:e.button===2||e.shiftKey}};
  const move=e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)zoom(pinch/d);pinch=d;return}
   if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;const g=rig.goal;
   if(drag.rot){g.theta-=dx*.005;g.phi=Math.min(1.3,Math.max(.12,g.phi-dy*.004))}
   else{const s=g.r*.0016,ct=Math.cos(rig.cur.theta),st=Math.sin(rig.cur.theta);g.tx+=(-dx*ct-dy*st)*s;g.tz+=(dx*st-dy*ct)*s}};
  const up=e=>{pointers.delete(e.pointerId);if(!pointers.size){drag=null;pinch=0}};
  const zoom=f=>{rig.goal.r=Math.min(14000,Math.max(70,rig.goal.r*f))};
  const wheel=e=>{e.preventDefault();rig.fly=null;zoom(1+Math.max(-120,Math.min(120,e.deltaY))*.0012)};
  const keys=e=>{const t=e.target;if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;const d={arrowup:[0,1],w:[0,1],arrowdown:[0,-1],s:[0,-1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[e.key.toLowerCase()];
   if(e.key==='+'||e.key==='='){zoom(.85);return}if(e.key==='-'){zoom(1.18);return}if(!d)return;e.preventDefault();const g=rig.goal,s=g.r*.08,ct=Math.cos(rig.cur.theta),st=Math.sin(rig.cur.theta);g.tx+=(d[0]*ct-d[1]*st)*s;g.tz+=(-d[0]*st-d[1]*ct)*s};
  const ctx=e=>e.preventDefault();
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('contextmenu',ctx);window.addEventListener('keydown',keys);
  return()=>{el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);el.removeEventListener('contextmenu',ctx);window.removeEventListener('keydown',keys)};
 },[gl,rig]);
 return null;
}

/* ---------- tiles around the camera target ---------- */
function TileField({index,rigRef,focus,onVenueBounds}){
 const [keys,setKeys]=useState([]);
 const last=useRef('');
 useFrame(()=>{
  if(!index)return;
  if(index.legacy){if(last.current!=='legacy'){last.current='legacy';setKeys(['legacy'])}return}
  const {cur}=rigRef.current,T=index.tileSize,R=Math.min(7000,Math.max(1600,cur.r*1.6));
  const cx=Math.floor(cur.tx/T),cz=Math.floor(cur.tz/T),n=Math.ceil(R/T);
  const sig=cx+','+cz+','+n;if(sig===last.current)return;last.current=sig;
  const list=[];for(let i=cx-n;i<=cx+n;i++)for(let j=cz-n;j<=cz+n;j++){const k=i+'_'+j;if(index.tiles[k])list.push([k,Math.hypot(i-cx,j-cz)])}
  list.sort((a,b)=>a[1]-b[1]);setKeys(list.slice(0,180).map(x=>x[0]));
 });
 return <>{keys.map(k=><Tile key={k} tileKey={k} index={index} focus={focus} onVenueBounds={onVenueBounds}/>)}</>;
}

function SpaceHighlight({venueId,space}){
 const ref=useRef();
 useFrame(({clock})=>{if(ref.current)ref.current.material.opacity=.32+.14*Math.sin(clock.elapsedTime*2.4)});
 if(!space?.box)return null;
 const g=VENUE_GEO[venueId],b=space.box;
 return <group position={[g.points[0][0]+b.x,b.y,g.points[0][1]+b.z]}>
  <mesh ref={ref} raycast={()=>null}><boxGeometry args={[b.width,b.height,b.depth]}/><meshBasicMaterial color="#8e3b46" transparent opacity={.4} depthTest={false} depthWrite={false}/></mesh>
  <lineSegments raycast={()=>null}><edgesGeometry args={[new THREE.BoxGeometry(b.width,b.height,b.depth)]}/><lineBasicMaterial color="#8e3b46" depthTest={false}/></lineSegments>
 </group>;
}

function Pins({focus,heights,onSelect,filter}){
 return <>{VENUES.filter(v=>filter==='all'||v.category===filter).map(v=>{const g=VENUE_GEO[v.id],h=(heights[v.id]||60)+8;const dim=focus.venueId&&focus.venueId!==v.id;
  return <Html key={v.id} position={[g.x,h,g.z]} center zIndexRange={[20,0]} style={{pointerEvents:'none'}}>
   <button type="button" className={'map-pin'+(v.status==='3d'?' ready':'')+(dim?' dim':'')} onClick={()=>onSelect(v.id)} style={{pointerEvents:'auto'}}>
    <span className="map-pin-label">{v.name}{v.status==='3d'&&<em>3D</em>}</span><span className="map-pin-stem"/>
   </button>
  </Html>})}</>;
}

export default function VenueExplorer({onOpenSpace,initialVenueId=null}){
 const [index,setIndex]=useState(null),[status,setStatus]=useState('loading');
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[resultsOpen,setResultsOpen]=useState(false);
 const [focus,setFocus]=useState({venueId:null,spaceId:null});
 const [heights,setHeights]=useState({});
 const [diving,setDiving]=useState(false);
 const start=VENUE_GEO['orchard-grand'];
 const rigRef=useRef({cur:{tx:start.x+200,tz:start.z-150,r:2600,theta:.6,phi:.8},goal:{tx:start.x+200,tz:start.z-150,r:1900,theta:.6,phi:.8},fly:null});
 useEffect(()=>{loadIndex().then(i=>{setIndex(i);setStatus(i?(i.legacy?'partial':'ready'):'missing')})},[]);
 const flyTo=useCallback((to,dur=1600,onArrive)=>{const r=rigRef.current;r.fly={from:{...r.cur},to:{...r.cur,...to},t0:performance.now(),dur};r.onArrive=onArrive},[]);
 const onVenueBounds=useCallback((id,box)=>setHeights(h=>h[id]>=box.max.y?h:{...h,[id]:box.max.y}),[]);
 const venue=VENUES.find(v=>v.id===focus.venueId),space=venue?.spaces.find(s=>s.id===focus.spaceId);
 const select=useCallback(id=>{const g=VENUE_GEO[id];setFocus({venueId:id,spaceId:null});setResultsOpen(false);setQuery(VENUES.find(v=>v.id===id).name);flyTo({tx:g.x,tz:g.z,r:420,phi:.95,theta:rigRef.current.cur.theta+.35})},[flyTo]);
 useEffect(()=>{if(initialVenueId&&VENUE_GEO[initialVenueId])setTimeout(()=>select(initialVenueId),300)},[initialVenueId,select]);
 const pickSpace=s=>{const g=VENUE_GEO[venue.id];setFocus(f=>({...f,spaceId:s.id}));flyTo({tx:g.points[0][0]+s.box.x,tz:g.points[0][1]+s.box.z,r:230,phi:.5,theta:rigRef.current.cur.theta+.25})};
 const openSpace=()=>{if(!space)return;const g=VENUE_GEO[venue.id];setDiving(true);flyTo({tx:g.points[0][0]+space.box.x,tz:g.points[0][1]+space.box.z,r:45,phi:.9},1100,()=>onOpenSpace(venue.id,space.id))};
 const close=()=>{setFocus({venueId:null,spaceId:null});flyTo({r:1900,phi:.8})};
 const results=VENUES.filter(v=>(filter==='all'||v.category===filter)&&v.name.toLowerCase().includes(query.toLowerCase()));
 const counts=Object.fromEntries(VENUE_CATEGORIES.map(c=>[c.id,c.id==='all'?VENUES.length:VENUES.filter(v=>v.category===c.id).length]));
 return <div className="explorer">
  <Canvas className="explorer-canvas" camera={{fov:38,near:1,far:20000,position:[0,2000,2000]}} dpr={[1,1.75]} gl={{antialias:true,powerPreference:'high-performance'}} onCreated={({scene,gl})=>{scene.fog=new THREE.Fog(BG,2000,8000);gl.setClearColor(BG)}}>
   <hemisphereLight args={['#ffffff','#d8cfbf',1.9]}/>
   <directionalLight position={[-3000,6000,2500]} intensity={1.6}/>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.05,0]} raycast={()=>null}><planeGeometry args={[80000,80000]}/><meshBasicMaterial color="#f4f1ec"/></mesh>
   <MapCamera rigRef={rigRef}/>
   {index&&<TileField index={index} rigRef={rigRef} focus={focus} onVenueBounds={onVenueBounds}/>}
   {venue&&space&&<SpaceHighlight venueId={venue.id} space={space}/>}
   <Pins focus={focus} heights={heights} onSelect={select} filter={filter}/>
  </Canvas>

  <div className="finder">
   <label className="finder-box"><Search size={16}/><input value={query} placeholder="Search venues, e.g. Orchard Grand" onFocus={()=>setResultsOpen(true)} onChange={e=>{setQuery(e.target.value);setResultsOpen(true)}} aria-label="Search venues"/>{query&&<button type="button" className="finder-clear" aria-label="Clear search" onClick={()=>{setQuery('');setResultsOpen(true)}}><X size={15}/></button>}</label>
   <div className={'finder-results'+(resultsOpen?' open':'')}><div>
    {results.length?results.map(v=><button type="button" key={v.id} onClick={()=>select(v.id)}><span className="finder-ic"><MapPin size={16}/></span><span>{v.name}<small>{v.area}</small></span><span className="finder-tag">{v.status==='3d'?'3D ready':'Example'}</span></button>)
     :<p className="finder-empty">No venues match yet. More partners are on the way.</p>}
   </div></div>
   <div className="finder-filters">{VENUE_CATEGORIES.map(c=><button type="button" key={c.id} className={filter===c.id?'on':''} onClick={()=>{setFilter(c.id);setResultsOpen(true)}}>{c.label} <b>{counts[c.id]}</b></button>)}</div>
  </div>

  <aside className={'venue-card'+(venue?' open':'')} aria-live="polite" aria-hidden={!venue}>
   {venue&&<>
    <button type="button" className="venue-card-close" aria-label="Close" onClick={close}><X size={18}/></button>
    <span className="venue-card-kicker">{venue.status==='3d'?'3D ready':'Example listing'}</span>
    <h2>{venue.name}</h2><div className="venue-card-area">{venue.area}</div>
    <div className="venue-card-facts">{venue.facts.map(([k,v])=><div key={k}><span>{k}</span>{v}</div>)}</div>
    <div className="venue-card-rooms-title"><h3>Ballrooms &amp; spaces</h3>{venue.spaces.length>0&&<span>{venue.spaces.length} in 3D</span>}</div>
    {venue.spaces.length?venue.spaces.map(s=><button type="button" key={s.id} className={'venue-room'+(focus.spaceId===s.id?' on':'')} onClick={()=>pickSpace(s)}><span className="venue-room-photo" style={{backgroundImage:`url(${s.image})`}}/><span><b>{s.name}</b><small>{s.summary}</small></span></button>)
     :<p className="venue-card-empty">3D spaces appear here once the venue shares its floor plans.</p>}
    {venue.spaces.length>0&&<button type="button" className={'venue-go'+(space?' ready':'')} disabled={!space} onClick={openSpace}>{space?'Design this ballroom':'Tap a ballroom to preview it'} <ArrowRight size={16}/></button>}
    <p className="venue-card-note">{venue.note}</p>
   </>}
  </aside>

  <div className="explorer-legend">{status==='missing'?'Map data not available yet':status==='partial'?'Showing the Orchard Grand area · Singapore tiles still loading':'Drag to move · right-drag to rotate · scroll to zoom'} · map © OpenStreetMap contributors</div>
  {diving&&<div className="explorer-dive" aria-hidden="true"/>}
 </div>;
}

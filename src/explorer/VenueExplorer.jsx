// Map-first Design page: a free 3D map of Singapore (OpenStreetMap tiles from
// scripts/fetch-sg-map.mjs), venue search and filters, fly-to, a floating venue
// card, and a highlighted ballroom inside a translucent building before
// diving into the 3D studio.
import React,{useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {Search,X,ArrowRight,MapPin} from 'lucide-react';
import {findClearView} from './viewFinder.js';
import {makeBuildingMaterial} from './look/buildingMaterial.js';
import {buildingLook} from './look/palette.js';
import {sunDirection} from './look/sun.js';
import {useSettings} from '../data/settings.js';
import {EveningLight,SKY} from './look/EveningLight.jsx';
import {HOTEL_LOOKS,landmarkLook} from './look/hotels.js';
import HotelDetails from './look/HotelDetails.jsx';
import NearbyDetails from './look/NearbyDetails.jsx';
import {VENUES,VENUE_CATEGORIES} from '../data/venues.js';
import {project,pointInPolygon} from './geo.js';
import {matchVenue} from './venueMatch.js';
import {CityStream,loadLatest,getCityStream,baseReady} from './stream/cityStream.js';

const INDEX_URL='/data/sg/index.json',TILE_URL=k=>`/data/sg/tiles/${k}.json`;
const LEGACY_URL='/data/orchard-grand-surroundings.json';
const BG=SKY.horizon;
// 6:20pm sun over Singapore on today's date (see look/sun.js)
const SUN=sunDirection(1.3521,103.8198);

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

// Tiles are built one per frame so panning into new areas doesn't stall.
const buildQueue=[];let building=false;
function queueBuild(job){buildQueue.push(job);if(!building){building=true;requestAnimationFrame(runQueue)}}
function runQueue(){const job=buildQueue.shift();if(job)job();if(buildQueue.length)requestAnimationFrame(runQueue);else building=false}
// Large parks, forests and water bodies (scripts/fetch-sg-map.mjs puts them in areas.json).
let areasRequest=null;
// waits for the base layer so it doesn't compete for bandwidth on first load
const loadAreas=()=>areasRequest||(areasRequest=Promise.race([baseReady,new Promise(r=>setTimeout(r,4000))]).then(()=>fetch('/data/sg/areas.json')).then(r=>r.ok?r.json():null).catch(()=>null));

/* ---------- which buildings belong to a venue ---------- */
// A venue's map point may land on one piece of a building that OSM splits
// into parts (podium, tower...), or just outside its footprint. A venue owns:
// every building containing one of its points (or the nearest one within
// 40 m), plus every other part of the same building (shared id, 7th field).
const ownerCache=new Map();
function venueOwnership(index,id){
 if(!ownerCache.has(id))ownerCache.set(id,(async()=>{
  const g=VENUE_GEO[id],buildings=await buildingsAround(index,g.x,g.z,250);
  return matchVenue(buildings,g.points,g,VENUES.find(v=>v.id===id).name);
 })());
 return ownerCache.get(id);
}
// Ownership tests for the venues close enough to have buildings in a tile.
async function ownersNear(index,tileKey){
 let near=VENUES;
 if(!index.legacy){const [ix,iz]=tileKey.split('_').map(Number),T=index.tileSize,cx=(ix+.5)*T,cz=(iz+.5)*T;near=VENUES.filter(v=>Math.abs(VENUE_GEO[v.id].x-cx)<T*1.6&&Math.abs(VENUE_GEO[v.id].z-cz)<T*1.6)}
 return Promise.all(near.map(async v=>({id:v.id,test:await venueOwnership(index,v.id)})));
}

/* ---------- unblocked camera angle ---------- */
// Loads the tiles around a point and returns their building rows.
async function buildingsAround(index,x,z,radius){
 if(!index)return [];
 if(index.legacy)return index.data.legacy.b;
 const T=index.tileSize,keys=[];
 for(let ix=Math.floor((x-radius)/T);ix<=Math.floor((x+radius)/T);ix++)for(let iz=Math.floor((z-radius)/T);iz<=Math.floor((z+radius)/T);iz++){const k=ix+'_'+iz;if(index.tiles[k])keys.push(k)}
 const tiles=await Promise.all(keys.map(k=>loadTile(index,k)));
 return tiles.flatMap(t=>t?.b||[]);
}
// Camera angle that sees the venue (or one of its spaces) without a
// neighbouring building in the way. Falls back to the current angle.
async function clearViewFor(index,venueId,{r,theta,space,phis}){
 const g=VENUE_GEO[venueId];
 try{
  // streamed city: neighbours from the always-loaded base, the venue from its shipped rows (no downloads)
  const st=getCityStream(),rows=st?.meta.venueRows?.[venueId],boxes=st?.boxesAround(g.x,g.z,Math.min(r,700));
  let buildings,own;
  if(boxes&&rows){const inVenue=([,,,,,f])=>{let x=0,z=0;for(let i=0;i<8;i+=2){x+=f[i];z+=f[i+1]}x/=4;z/=4;return rows.some(rw=>pointInPolygon(x,z,rw[5]))};
   const set=new Set(rows);buildings=[...boxes.filter(b=>!inVenue(b)),...rows];own=row=>set.has(row)}
  else{buildings=await buildingsAround(index,g.x,g.z,Math.min(r,700));own=await venueOwnership(index,venueId)}
  let target,samples;
  if(space){
   const b=space.box,cx=g.points[0][0]+b.x,cz=g.points[0][1]+b.z,y=b.y,hw=b.width/2,hd=b.depth/2;
   target={x:cx,z:cz};samples=[[cx,y,cz],[cx-hw,y,cz-hd],[cx+hw,y,cz-hd],[cx-hw,y,cz+hd],[cx+hw,y,cz+hd]];
  }else{
   // points through the middle and near the top of each part of the venue
   const mine=buildings.filter(own);target={x:g.x,z:g.z};
   // (centre plus up to 6 corners pulled slightly inwards, so the whole
   // building is in view rather than just its middle)
   samples=mine.length?mine.slice(0,10).flatMap(([h,minH,,,,f])=>{let x=0,z=0;const n=f.length/2;for(let i=0;i<f.length;i+=2){x+=f[i];z+=f[i+1]}x/=n;z/=n;const mid=minH+(h-minH)*.5,out=[[x,mid,z],[x,h*.95,z]];
    for(let k=0;k<Math.min(6,n);k++){const i=Math.floor(k*n/Math.min(6,n))*2;out.push([x+(f[i]-x)*.8,mid,z+(f[i+1]-z)*.8])}return out})
    :g.points.map(([x,z])=>[x,15,z]);
  }
  return {...findClearView({buildings,target,samples,r,theta,skip:own,phis}),tx:target.x,tz:target.z};
 }catch{return null}
}

/* ---------- geometry ---------- */
function shapeOf(flat){const pts=[];for(let i=0;i<flat.length;i+=2)pts.push(new THREE.Vector2(flat[i],-flat[i+1]));if(THREE.ShapeUtils.isClockWise(pts))pts.reverse();return new THREE.Shape(pts)}
// Collects extruded buildings into one geometry with per-vertex wall/roof
// colours and facade style for the facade shader.
function makeBucket(){return {P:[],C:[],R:[],S:[]}}
function addBuilding(bucket,row,hotel){
 const [h,minH,,,,flat]=row;
 let g;try{g=new THREE.ExtrudeGeometry(shapeOf(flat),{depth:Math.max(2,h-minH),bevelEnabled:false})}catch{return false}
 g.rotateX(-Math.PI/2);g.translate(0,minH,0);
 let {wall,roof,kind,floor,seed}=buildingLook(row);const a=g.attributes.position.array;
 // listed hotels and Orchard landmarks use their own facade (look/hotels.js)
 hotel=hotel||landmarkLook(row[3]);
 if(hotel){wall=hotel.wall?new THREE.Color(hotel.wall):wall;roof=hotel.roof?new THREE.Color(hotel.roof):roof;kind=hotel.kind??kind;floor=hotel.storey||floor}
 for(let k=0;k<a.length;k+=3){bucket.P.push(a[k],a[k+1],a[k+2]);bucket.C.push(wall.r,wall.g,wall.b);bucket.R.push(roof.r,roof.g,roof.b);bucket.S.push(kind,floor,seed)}
 g.dispose();return true;
}
function bucketGeometry({P,C,R,S}){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
 g.setAttribute('aRoof',new THREE.Float32BufferAttribute(R,3));g.setAttribute('aStyle',new THREE.Float32BufferAttribute(S,3));
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function buildTile(data,owners){
 const ctxB=makeBucket(),venueB={},venueRows={};
 data.b.forEach(row=>{
  const owner=owners.find(o=>o.test(row));
  if(owner){const b=venueB[owner.id]=venueB[owner.id]||makeBucket();if(addBuilding(b,row,HOTEL_LOOKS[owner.id]))(venueRows[owner.id]=venueRows[owner.id]||[]).push(row);return}
  addBuilding(ctxB,row);
 });
 const ctx=bucketGeometry(ctxB);
 const venueParts=Object.fromEntries(Object.entries(venueB).map(([id,b])=>[id,[bucketGeometry(b)]]));
 const roads=[];data.r.forEach(([w,f])=>{const h=w/2;for(let i=0;i+3<f.length;i+=2){const x1=f[i],z1=f[i+1],x2=f[i+2],z2=f[i+3];let dx=x2-x1,dz=z2-z1;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const ax=-dz*h,az=dx*h;roads.push(x1+ax,.25,z1+az,x2-ax,.25,z2-az,x2+ax,.25,z2+az,x1+ax,.25,z1+az,x1-ax,.25,z1-az,x2-ax,.25,z2-az)}});
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(roads,3));rg.computeVertexNormals();
 // pale paved footpaths beside main roads (Orchard Road's wide promenades)
 const walk=[];data.r.forEach(([w,f])=>{if(w<8)return;const h=w/2+(w>=10?4.5:2.5);for(let i=0;i+3<f.length;i+=2){const x1=f[i],z1=f[i+1],x2=f[i+2],z2=f[i+3];let dx=x2-x1,dz=z2-z1;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const ax=-dz*h,az=dx*h;walk.push(x1+ax,.2,z1+az,x2-ax,.2,z2-az,x2+ax,.2,z2+az,x1+ax,.2,z1+az,x1-ax,.2,z1-az,x2-ax,.2,z2-az)}});
 const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(walk,3));wg.computeVertexNormals();
 const flat=(polys,y)=>{const P=[];polys.forEach(f=>{try{const s=new THREE.ShapeGeometry(shapeOf(f)).toNonIndexed();s.rotateX(-Math.PI/2);const a=s.attributes.position.array;for(let k=0;k<a.length;k+=3)P.push(a[k],y,a[k+2]);s.dispose()}catch{}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g};
 return {ctx,roads:rg,walk:wg,green:flat(data.g||[],.15),water:flat(data.w||[],.1),venueParts,venueRows};
}
const MATS={
 ctx:makeBuildingMaterial({sunDir:SUN}),
 walk:new THREE.MeshStandardMaterial({flatShading:true,color:'#cfc6b6',roughness:.95,side:THREE.DoubleSide,depthWrite:false}),
 road:new THREE.MeshStandardMaterial({flatShading:true,color:'#a5a29c',roughness:.95,side:THREE.DoubleSide,depthWrite:false}),
 green:new THREE.MeshStandardMaterial({flatShading:true,color:'#8fa476',roughness:1,side:THREE.DoubleSide,depthWrite:false}),
 water:new THREE.MeshStandardMaterial({flatShading:true,color:'#7f9fae',roughness:.25,metalness:.1,side:THREE.DoubleSide,depthWrite:false}),
 edge:new THREE.LineBasicMaterial({color:'#8e3b46',transparent:true,opacity:.35})
};

function Tile({tileKey,index,focus,onVenueBounds,onVenueRows,venueOnly=false,onBuilt}){
 const [built,setBuilt]=useState(null);
 useEffect(()=>{let live=true;loadTile(index,tileKey).then(async d=>{if(!d)return;const owners=await ownersNear(index,tileKey);if(live)queueBuild(()=>{if(live)setBuilt(buildTile(d,owners))})});return()=>{live=false}},[tileKey,index]);
 useEffect(()=>()=>{if(built){built.ctx.dispose();built.roads.dispose();built.walk.dispose();built.green.dispose();built.water.dispose();Object.values(built.venueParts).flat().forEach(g=>g.dispose())}},[built]);
 useEffect(()=>{if(!built)return;Object.entries(built.venueParts).forEach(([id,parts])=>{const box=new THREE.Box3();parts.forEach(g=>{g.computeBoundingBox();box.union(g.boundingBox)});onVenueBounds(id,box)});Object.entries(built.venueRows).forEach(([id,rows])=>onVenueRows(id,rows))},[built,onVenueBounds,onVenueRows]);
 useEffect(()=>{if(built)onBuilt?.()},[built,onBuilt]);
 if(!built)return null;
 // streamed city: the cell's context, roads and parks come from the pre-built file; only the venue's own buildings are drawn here
 if(venueOnly)return <group>{Object.entries(built.venueParts).map(([id,parts])=><VenueBuilding key={id} id={id} parts={parts} focus={focus}/>)}</group>;
 return <group>
  {/* Flat layers don't write depth and draw in a fixed order (ground, green,
      water, roads), so overlapping parks/forests/reservoirs can't z-fight and
      flicker; buildings still hide them correctly. */}
  <mesh geometry={built.green} material={MATS.green} raycast={()=>null} receiveShadow renderOrder={-3}/>
  <mesh geometry={built.water} material={MATS.water} raycast={()=>null} receiveShadow renderOrder={-2}/>
  <mesh geometry={built.walk} material={MATS.walk} raycast={()=>null} receiveShadow renderOrder={-1.5}/>
  <mesh geometry={built.roads} material={MATS.road} raycast={()=>null} receiveShadow renderOrder={-1}/>
  <mesh geometry={built.ctx} material={MATS.ctx} raycast={()=>null} castShadow receiveShadow/>
  {Object.entries(built.venueParts).map(([id,parts])=><VenueBuilding key={id} id={id} parts={parts} focus={focus}/>)}
 </group>;
}
function VenueBuilding({id,parts,focus}){
 const mat=useMemo(()=>makeBuildingMaterial({sunDir:SUN,transparent:true,lit:.08}),[]);
 const focused=focus.venueId===id,ghost=focused&&!!focus.spaceId;
 const edges=useMemo(()=>focused?parts.map(g=>new THREE.EdgesGeometry(g,30)):[],[parts,focused]);
 useEffect(()=>()=>mat.dispose(),[mat]);
 useEffect(()=>()=>edges.forEach(e=>e.dispose()),[edges]);
 const u=mat.userData.uniforms;u.uTint.value.set('#c98a8f');u.uTintAmt.value=focused&&!ghost?.16:0;
 mat.opacity=ghost?.12:1;mat.depthWrite=!ghost;
 return <group>{parts.map((g,i)=><mesh key={i} geometry={g} material={mat} raycast={()=>null} castShadow={!ghost} receiveShadow/>)}{edges.map((e,i)=><lineSegments key={'e'+i} geometry={e} material={MATS.edge}/>)}</group>;
}

/* ---------- camera ---------- */
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function MapCamera({rigRef}){
 const {camera,gl,scene}=useThree();
 const rig=rigRef.current;
 useFrame(()=>{
  const {cur,goal}=rig;
  // the descent waits (up to 0.6 s) until the destination shows full detail
  if(rig.fly?.waitFor){const f=rig.fly,el=(performance.now()-f.t0)/f.dur;if(el>.82&&(f.held||0)<600&&!f.waitFor()){const step=Math.min(50,performance.now()-(f.lastT||performance.now()));f.t0+=step;f.held=(f.held||0)+step}f.lastT=performance.now()}
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
function TileField({index,rigRef,focus,onVenueBounds,onVenueRows}){
 const [keys,setKeys]=useState([]);
 const last=useRef('');
 useFrame(()=>{
  if(!index)return;
  if(index.legacy){if(last.current!=='legacy'){last.current='legacy';setKeys(['legacy'])}return}
  const {cur}=rigRef.current,T=index.tileSize,R=Math.min(7000,Math.max(1600,cur.r*1.6));
  const cx=Math.floor(cur.tx/T),cz=Math.floor(cur.tz/T),n=Math.ceil(R/T);
  const sig=cx+','+cz+','+n;if(sig===last.current)return;last.current=sig;
  const list=[];for(let i=cx-n;i<=cx+n;i++)for(let j=cz-n;j<=cz+n;j++){const k=i+'_'+j;if(index.tiles[k])list.push([k,Math.hypot(i-cx,j-cz)])}
  list.sort((a,b)=>a[1]-b[1]);const want=list.slice(0,180).map(x=>x[0]);
  // keep tiles that are still fairly close, so panning back and forth doesn't
  // drop and rebuild them (that reads as flicker at the edges of the view)
  setKeys(prev=>{const keep=prev.filter(k=>{if(want.includes(k))return false;const [i,j]=k.split('_').map(Number);return Math.hypot(i-cx,j-cz)<=n+2});return [...want,...keep].slice(0,240)});
 });
 return <>{keys.map(k=><Tile key={k} tileKey={k} index={index} focus={focus} onVenueBounds={onVenueBounds} onVenueRows={onVenueRows}/>)}</>;
}

function AreaLayer(){
 const [geo,setGeo]=useState(null);
 useEffect(()=>{let live=true;loadAreas().then(a=>{if(!a||!live)return;
  const flat=(polys,y)=>{const P=[];polys.forEach(f=>{try{const s=new THREE.ShapeGeometry(shapeOf(f)).toNonIndexed();s.rotateX(-Math.PI/2);const p=s.attributes.position.array;for(let k=0;k<p.length;k+=3)P.push(p[k],y,p[k+2]);s.dispose()}catch{}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g};
  setGeo({g:flat(a.g||[],.12),w:flat(a.w||[],.08)})});return()=>{live=false}},[]);
 useEffect(()=>()=>{geo?.g.dispose();geo?.w.dispose()},[geo]);
 if(!geo)return null;
 return <><mesh geometry={geo.g} material={MATS.green} raycast={()=>null} receiveShadow renderOrder={-3}/><mesh geometry={geo.w} material={MATS.water} raycast={()=>null} receiveShadow renderOrder={-2}/></>;
}

// Orchard district (Tanglin to Dhoby Ghaut): richer detail for the whole area
// around the listed hotels, built once and hidden when zoomed far out.
const ORCHARD=(()=>{const [x,z]=project(1.3045,103.8318);return {x,z,radius:900}})();
// Extra detail layers still read the older JSON tiles; start them only once
// the camera is still and the city around it shows full detail, so they never
// compete with what the couple is looking at.
function whenSettled(rigRef){return new Promise(res=>{const t0=performance.now();const tick=()=>{const st=getCityStream(),{cur}=rigRef.current;
 if(!rigRef.current.fly&&(!st||st.readyAround(cur.tx,cur.tz,400)||performance.now()-t0>8000))res();else setTimeout(tick,250)};setTimeout(tick,400)})}
function OrchardDetails({index,rigRef}){
 const [tiles,setTiles]=useState(null),group=useRef();
 useEffect(()=>{if(!index||index.legacy)return;let live=true;whenSettled(rigRef).then(()=>{if(!live)return;const T=index.tileSize,keys=[];
  for(let ix=Math.floor((ORCHARD.x-1500)/T);ix<=Math.floor((ORCHARD.x+1500)/T);ix++)for(let iz=Math.floor((ORCHARD.z-800)/T);iz<=Math.floor((ORCHARD.z+800)/T);iz++)if(index.tiles[ix+'_'+iz])keys.push(ix+'_'+iz);
  Promise.all([Promise.all(keys.map(k=>loadTile(index,k))),Promise.all(VENUES.map(v=>venueOwnership(index,v.id)))]).then(([t,tests])=>{if(live)setTiles({list:t.filter(Boolean),skip:row=>tests.some(test=>test(row))})})});return()=>{live=false}},[index,rigRef]);
 useFrame(()=>{if(!group.current)return;const {cur}=rigRef.current;group.current.visible=cur.r<3200&&Math.hypot(cur.tx-ORCHARD.x,cur.tz-ORCHARD.z)<4000});
 return tiles?<NearbyDetails tiles={tiles.list} cx={ORCHARD.x} cz={ORCHARD.z} skip={tiles.skip} radius={ORCHARD.radius} orchard groupRef={group}/>:null;
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

function Pins({focus,heights,onSelect,filter,draftCounts={}}){
 return <>{VENUES.filter(v=>filter==='all'||v.category===filter).map(v=>{const g=VENUE_GEO[v.id],h=(heights[v.id]||60)+8;const dim=focus.venueId&&focus.venueId!==v.id;
  return <Html key={v.id} position={[g.x,h,g.z]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}>
   <button type="button" className={'map-pin'+(v.status==='3d'?' ready':'')+(dim?' dim':'')} onClick={()=>onSelect(v.id)} onPointerEnter={()=>getCityStream()?.boost(g.x,g.z)} style={{pointerEvents:'auto'}}>
    <span className="map-pin-label">{v.name}{v.status==='3d'&&<em>3D</em>}</span>
    {draftCounts[v.id]>0&&<span className="map-pin-drafts">{draftCounts[v.id]} draft{draftCounts[v.id]>1?'s':''}</span>}
    <span className="map-pin-stem"/>
   </button>
  </Html>})}</>;
}

/**
 * The city as drawn on the venue map: ground, large parks/water, tiles with
 * the venue buildings, listed-hotel details, the Orchard district layer and
 * extra detail around a focused venue. Used by the venue map and by the
 * studio's Map view so both always show the same thing.
 * rigRef.current.cur = {tx,tz,r} in map coordinates drives tile loading.
 */
/* ---------- pre-built, streamed city (scripts/build-city-3d.mjs) ---------- */
function StreamedCity({meta,index,rigRef,focus,onVenueBounds,onVenueRows}){
 const stream=useMemo(()=>new CityStream(meta,{sun:SUN,mats:{roads:MATS.road,walk:MATS.walk,green:MATS.green,water:MATS.water}}),[meta]);
 useEffect(()=>()=>stream.dispose(),[stream]);
 // the listed venues' own buildings ship with the city as source rows: build them here, at once
 const venueGeo=useMemo(()=>Object.entries(meta.venueRows||{}).map(([id,rows])=>{const b=makeBucket();rows.forEach(row=>addBuilding(b,row,HOTEL_LOOKS[id]));return [id,bucketGeometry(b),rows]}),[meta]);
 useEffect(()=>{Object.keys(meta.cells).forEach(k=>stream.markVenueReady(k));
  for(const [id,geo,rows] of venueGeo){onVenueRows(id,rows);onVenueBounds(id,geo.boundingBox)}
  return()=>venueGeo.forEach(([,geo])=>geo.dispose())},[venueGeo,stream,meta,onVenueRows,onVenueBounds]);
 useFrame((_,dt)=>{const {cur}=rigRef.current;stream.update({x:cur.tx,z:cur.tz},cur.r,Math.min(dt,.1))});
 // older builds without venueRows fall back to drawing venues from the JSON tiles
 const legacyVenueCells=useMemo(()=>meta.venueRows?[]:Object.entries(meta.cells).filter(([,c])=>c[2]?.length).map(([k])=>k),[meta]);
 return <><primitive object={stream.group}/>
  {venueGeo.map(([id,geo])=><VenueBuilding key={id} id={id} parts={[geo]} focus={focus}/>)}
  {legacyVenueCells.map(k=><Tile key={k} tileKey={k} index={index} focus={focus} onVenueBounds={onVenueBounds} onVenueRows={onVenueRows} venueOnly/>)}</>;
}

export function CityLayers({index,rigRef,focus,details=true,onVenueBounds=()=>{}}){
 const [meta,setMeta]=useState(undefined);
 useEffect(()=>{let live=true;loadLatest().then(m=>{if(live)setMeta(m||null)});return()=>{live=false}},[]);
 const [venueRows,setVenueRows]=useState({});
 const onVenueRows=useCallback((id,rows)=>setVenueRows(v=>{const cur=v[id]||[];const add=rows.filter(r=>!cur.includes(r));return add.length?{...v,[id]:[...cur,...add]}:v}),[]);
 const [nearby,setNearby]=useState(null);
 useEffect(()=>{if(!index||!focus.venueId){setNearby(null);return}let live=true;const g=VENUE_GEO[focus.venueId];
  (async()=>{await whenSettled(rigRef);if(!live)return;const T=index.tileSize,keys=[];if(index.legacy)keys.push('legacy');else for(let ix=Math.floor((g.x-400)/T);ix<=Math.floor((g.x+400)/T);ix++)for(let iz=Math.floor((g.z-400)/T);iz<=Math.floor((g.z+400)/T);iz++)if(index.tiles[ix+'_'+iz])keys.push(ix+'_'+iz);
   const tiles=(await Promise.all(keys.map(k=>loadTile(index,k)))).filter(Boolean);const skip=await venueOwnership(index,focus.venueId);if(live)setNearby({tiles,x:g.x,z:g.z,skip})})();
  return()=>{live=false}},[index,focus.venueId]);
 return <>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.05,0]} raycast={()=>null} receiveShadow renderOrder={-4}><planeGeometry args={[80000,80000]}/><meshStandardMaterial color="#ddd6c8" roughness={1} depthWrite={false}/></mesh>
  {index?.areas&&<AreaLayer/>}
  {index&&meta&&!index.legacy&&<StreamedCity meta={meta} index={index} rigRef={rigRef} focus={focus} onVenueBounds={onVenueBounds} onVenueRows={onVenueRows}/>}
  {index&&meta===null&&<TileField index={index} rigRef={rigRef} focus={focus} onVenueBounds={onVenueBounds} onVenueRows={onVenueRows}/>}
  {details&&Object.entries(venueRows).map(([id,rows])=>!(focus.venueId===id&&focus.spaceId)&&<HotelDetails key={id} rows={rows} look={HOTEL_LOOKS[id]}/>)}
  {details&&<OrchardDetails index={index} rigRef={rigRef}/>}
  {details&&nearby&&Math.hypot(nearby.x-ORCHARD.x,nearby.z-ORCHARD.z)>ORCHARD.radius*1.4&&<NearbyDetails tiles={nearby.tiles} cx={nearby.x} cz={nearby.z} skip={nearby.skip}/>}
 </>;
}
export {loadIndex,VENUE_GEO,Pins,SUN};

export default function VenueExplorer({onOpenSpace,initialVenueId=null,draftCounts={}}){
 // timing marks for the map speed test (scripts/perf/map-performance.mjs)
 useEffect(()=>{window.__mapMarks={...(window.__mapMarks||{}),mounted:performance.now()}},[]);
 const [index,setIndex]=useState(null),[status,setStatus]=useState('loading');
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[resultsOpen,setResultsOpen]=useState(false);
 const [focus,setFocus]=useState({venueId:null,spaceId:null});
 const [heights,setHeights]=useState({});
 const [diving,setDiving]=useState(false);
 // Settings › 3D & motion › Map quality: high = shadows + details, balanced = details, saver = plain
 const [{mapQuality}]=useSettings();
 const shadows=mapQuality==='high',details=mapQuality!=='saver';
 const start=VENUE_GEO['orchard-grand'];
 const rigRef=useRef({cur:{tx:start.x+200,tz:start.z-150,r:2600,theta:.6,phi:.8},goal:{tx:start.x+200,tz:start.z-150,r:1900,theta:.6,phi:.8},fly:null});
 // dev-only handle for automated visual tests
 useEffect(()=>{if(import.meta.env.DEV)window.__mapRig=rigRef.current},[]);
 useEffect(()=>{loadIndex().then(i=>{setIndex(i);setStatus(i?(i.legacy?'partial':'ready'):'missing')})},[]);
 const flyTo=useCallback((to,dur=1600,onArrive)=>{const r=rigRef.current;const st=getCityStream();
  // start loading the destination now; the descent holds until it's ready
  if(st&&to.tx!=null){st.boost(to.tx,to.tz)}
  r.fly={from:{...r.cur},to:{...r.cur,...to},t0:performance.now(),dur,waitFor:st&&to.tx!=null?()=>st.readyAround(to.tx,to.tz,Math.min(600,(to.r||400)*1.2)):null};r.onArrive=onArrive;
  if(window.__cityMetrics&&to.tx!=null)window.__cityMetrics.lastFly={start:performance.now(),tx:to.tx,tz:to.tz}},[]);
 // hovering a venue starts loading its area before it's even selected
 const prefetch=useCallback(id=>{const g=VENUE_GEO[id];getCityStream()?.boost(g.x,g.z)},[]);
 const onVenueBounds=useCallback((id,box)=>setHeights(h=>h[id]>=box.max.y?h:{...h,[id]:box.max.y}),[]);

 const venue=VENUES.find(v=>v.id===focus.venueId),space=venue?.spaces.find(s=>s.id===focus.spaceId);
 const indexRef=useRef(null);indexRef.current=index;
 const select=useCallback(async id=>{const g=VENUE_GEO[id];setFocus({venueId:id,spaceId:null});setResultsOpen(false);setQuery(VENUES.find(v=>v.id===id).name);
  const theta=rigRef.current.cur.theta+.35,view=await clearViewFor(indexRef.current,id,{r:420,theta});
  flyTo({tx:g.x,tz:g.z,r:420,phi:view?.phi??.95,theta:view?.theta??theta})},[flyTo]);
 useEffect(()=>{if(initialVenueId&&VENUE_GEO[initialVenueId])setTimeout(()=>select(initialVenueId),300)},[initialVenueId,select]);
 const pickSpace=async s=>{const g=VENUE_GEO[venue.id];setFocus(f=>({...f,spaceId:s.id}));
  // the hotel turns translucent, so only neighbouring buildings can block the ballroom
  const theta=rigRef.current.cur.theta+.25,view=await clearViewFor(index,venue.id,{r:230,theta,space:s,phis:[.55,.42,.3,.18]});
  flyTo({tx:g.points[0][0]+s.box.x,tz:g.points[0][1]+s.box.z,r:230,phi:view?.phi??.5,theta:view?.theta??theta})};
 const openSpace=()=>{if(!space)return;const g=VENUE_GEO[venue.id];setDiving(true);flyTo({tx:g.points[0][0]+space.box.x,tz:g.points[0][1]+space.box.z,r:45,phi:.9},1100,()=>onOpenSpace(venue.id,space.id))};
 const close=()=>{setFocus({venueId:null,spaceId:null});flyTo({r:1900,phi:.8})};
 const results=VENUES.filter(v=>(filter==='all'||v.category===filter)&&v.name.toLowerCase().includes(query.toLowerCase()));
 const counts=Object.fromEntries(VENUE_CATEGORIES.map(c=>[c.id,c.id==='all'?VENUES.length:VENUES.filter(v=>v.category===c.id).length]));
 return <div className="explorer">
  <Canvas key={mapQuality} className="explorer-canvas" camera={{fov:38,near:1,far:20000,position:[0,2000,2000]}} dpr={mapQuality==='saver'?1:[1,1.75]} shadows={shadows} gl={{antialias:true,powerPreference:'high-performance'}} onCreated={({scene,gl})=>{window.__mapMarks={...(window.__mapMarks||{}),canvas:performance.now()};scene.fog=new THREE.Fog(BG,2000,8000);gl.setClearColor(BG)}}>
   <EveningLight sun={SUN} rigRef={rigRef}/>
   <MapCamera rigRef={rigRef}/>
   <CityLayers index={index} rigRef={rigRef} focus={focus} details={details} onVenueBounds={onVenueBounds}/>
   {venue&&space&&<SpaceHighlight venueId={venue.id} space={space}/>}
   <Pins focus={focus} heights={heights} onSelect={select} filter={filter} draftCounts={draftCounts}/>
  </Canvas>

  <div className="finder">
   <label className="finder-box"><Search size={16}/><input value={query} placeholder="Search venues, e.g. Orchard Grand" onFocus={()=>setResultsOpen(true)} onChange={e=>{setQuery(e.target.value);setResultsOpen(true)}} aria-label="Search venues"/>{query&&<button type="button" className="finder-clear" aria-label="Clear search" onClick={()=>{setQuery('');setResultsOpen(true)}}><X size={15}/></button>}</label>
   <div className={'finder-results'+(resultsOpen?' open':'')}><div>
    {results.length?results.map(v=><button type="button" key={v.id} onClick={()=>select(v.id)} onPointerEnter={()=>prefetch(v.id)} onFocus={()=>prefetch(v.id)}><span className="finder-ic"><MapPin size={16}/></span><span>{v.name}<small>{v.area}</small></span><span className="finder-tag">{v.status==='3d'?'3D ready':'Example'}</span></button>)
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

// Streams the pre-built city (spec: docs/superpowers/specs/2026-11-04-city-streaming-design.md).
//
// - The base layer (every building as a simple block) loads first and is
//   never evicted, so the island is always visible.
// - Full-detail cells load by priority (distance from the camera target,
//   boosted for what the couple is about to look at), at most 6 downloads at
//   a time; downloaded files join the scene in 4 ms slices between frames.
// - A per-cell mask cross-dissolves base and detail over 0.3 s.
// - Cells far from the camera stay in memory but show the base instead;
//   only when a memory budget is exceeded are the farthest cells dropped.
import * as THREE from 'three';
import {parseCellGlb} from './glb.js';
import {makeBuildingMaterial} from '../look/buildingMaterial.js';


const ROOT='/data/sg3d/';
const MAX_FETCH=6,FADE_S=.3,MAX_WAITING=12;   // downloads wait while 12 files are queued for the GPU
// the venue map and the studio's map view may each hold a stream; the newest one is current
const live=[];let current=null;
export const getCityStream=()=>current;

let pointerRequest=null,latestRequest=null,baseRequest=null,liteRequest=null;
const unpack=async buf=>{const h=new Uint8Array(buf,0,2);if(h[0]===0x1f&&h[1]===0x8b)return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return buf};
// latest.json: a tiny pointer to the current build
const loadPointer=()=>pointerRequest||(pointerRequest=fetch(ROOT+'latest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null));
/** The city metadata (grid, cells, venues), or null if there is no pre-built city. */
export function loadLatest(){return latestRequest||(latestRequest=loadPointer().then(async l=>{
 if(!l)return null;const dir=ROOT+l.version+'/';
 if(l.meta&&typeof l.meta==='object')return {...l.meta,dir};          // older builds
 const m=await fetch(ROOT+(l.meta||l.tileset)).then(r=>r.ok?r.json():null);
 return m?{...(m.extras||m),dir}:null}).catch(()=>null))}
/** The base layer bytes (unpacked), fetched once and shared; starts in parallel with the metadata. */
function fetchBase(){return baseRequest||(baseRequest=loadPointer().then(l=>{if(!l)throw new Error('no city');return fetch(ROOT+(l.base||l.version+'/base.bin.gz'))})
 .then(r=>{if(!r.ok)throw new Error('base '+r.status);return r.arrayBuffer()}).then(unpack).catch(e=>{baseRequest=null;throw e}))}
/** The lite base (the biggest 20,000 buildings), decoded to the same 24-byte rows as the full base; null if the build has none. */
function fetchLite(){return liteRequest||(liteRequest=loadPointer().then(l=>l?.lite?fetch(ROOT+l.lite):null)
 .then(r=>r&&r.ok?r.arrayBuffer():null).then(b=>b&&unpack(b)).then(b=>b&&decodeLite(new Uint8Array(b))).catch(()=>null))}
/** Undo the lite file's packing: byte planes (column by column) back to rows, then the delta-coded x/z. */
export function decodeLite(planes,stride=24){
 const n=planes.length/stride,out=new Uint8Array(planes.length);
 for(let b=0;b<stride;b++){const o=b*n;for(let i=0;i<n;i++)out[i*stride+b]=planes[o+i]}
 const dv=new DataView(out.buffer);let px=0,pz=0;
 for(let i=0;i<n;i++){const o=i*stride;px=(px+dv.getInt16(o,true))<<16>>16;pz=(pz+dv.getInt16(o+2,true))<<16>>16;dv.setInt16(o,px,true);dv.setInt16(o+2,pz,true)}
 return out.buffer;
}
/** Start downloading the map early (skipped on data saver / slow connections). Safe to call repeatedly. */
export function prefetchCity(){const c=navigator.connection;if(c&&(c.saveData||/2g|3g/.test(c.effectiveType||'')))return;fetchLite();fetchBase().catch(()=>{});loadLatest()}
let baseReadyResolve;export const baseReady=new Promise(r=>{baseReadyResolve=r});

/** Whether a cell or district should be downloaded now. near: inside the range where it is never
 *  evicted. fill: the island is filling in the background (not while parked, not over budget).
 *  A file evicted for memory is only fetched again once it is near, so eviction can't loop. */
export function isDue(c,{near,fill,now}){
 if(c&&c.state==='failed')return c.tries<3&&now>c.retryAt&&(near||fill);
 if(c&&c.state==='evicted')return near;
 if(c&&c.state!=='idle')return false;
 return near||fill;
}
function memoryBudget(){const gb=navigator.deviceMemory||8;return (gb<=4?120:400)*1e6}

export class CityStream{
 /** onChange(kind): called when something new can be seen ('base', 'cell' or 'district'), for a view that draws on demand. */
 constructor(meta,{sun,mats,onChange=null}){
  this.onChange=onChange;
  this.meta=meta;this.mats=mats;this.group=new THREE.Group();this.group.name='city-stream';
  const {grid}=meta;
  this.mask=new Uint8Array(grid.w*grid.h);this.fade=new Float32Array(grid.w*grid.h);
  this.maskTex=new THREE.DataTexture(this.mask,grid.w,grid.h,THREE.RedFormat,THREE.UnsignedByteType);this.maskTex.needsUpdate=true;
  // middle level: 2 km districts with their own mask
  const D=meta.districts;
  if(D){this.midMaskData=new Uint8Array(D.grid.w*D.grid.h);this.midFade=new Float32Array(D.grid.w*D.grid.h);
   this.midTex=new THREE.DataTexture(this.midMaskData,D.grid.w,D.grid.h,THREE.RedFormat,THREE.UnsignedByteType);this.midTex.needsUpdate=true}
  const mid=D?{texture:this.midTex,grid:D.grid,size:D.size}:null;
  const maskOpt=mode=>({mode,texture:this.maskTex,grid,tileSize:meta.tileSize,mid});
  this.cellMat=makeBuildingMaterial({sunDir:sun,packed:true,mask:maskOpt('cell')});
  this.baseMat=makeBuildingMaterial({sunDir:sun,packed:true,mask:maskOpt('base')});
  this.midMat=D?makeBuildingMaterial({sunDir:sun,packed:true,mask:maskOpt('mid')}):null;
  this.districts=new Map();   // key -> {state, group, bytes, tries}
  this.cells=new Map();   // key -> {state, group, bytes, tries, venues}
  this.boosts=[];this.fetching=0;this.readyQueue=[];this.usedBytes=0;this.lastPlan=0;this.venueReady=new Set();
  this.metrics=window.__cityMetrics={started:performance.now(),baseFetchedMs:null,baseLoadedMs:null,baseReadyMs:null,cellsLoaded:0,cellsShown:0,baseEvictions:0,cellsEvicted:0,baseLiteMs:null,shadersReadyMs:null,landLoaded:false,districtsLoaded:0,districtsShown:0,districtsEvicted:0,frames:[]};
  live.push(this);window.__cityStream=this;current=this;
  // resolves when the island first stands in the scene (lite base, or the full base if there is none)
  this.firstIsland=new Promise(r=>{this._firstIsland=r});
  this.baseReady=this.loadBase();
 }
 dispose(){this.group.traverse(o=>{if(o.geometry)o.geometry.dispose()});this.disposed=true;clearTimeout(this._kick);clearTimeout(this._pump);this.cellMat.dispose();this.baseMat.dispose();this.midMat?.dispose();this.maskTex.dispose();this.midTex?.dispose();const i=live.indexOf(this);if(i>=0)live.splice(i,1);if(current===this){current=live[live.length-1]||null;window.__cityStream=current;if(current)window.__cityMetrics=current.metrics}}

 // ---------- base layer ----------
 async loadBase(){
  // step 1: the lite base (biggest buildings) as soon as it arrives; step 2: the full base replaces it
  const full=fetchBase();
  const lite=await Promise.race([fetchLite(),full.then(()=>null,()=>null)]);
  if(lite&&!this.base){this.installBase(lite,true);this.metrics.baseLiteMs=Math.round(performance.now()-this.metrics.started)}
  const buf=await full;return this.installBase(buf,false);
 }
 installBase(buf,isLite){
  const since=()=>Math.round(performance.now()-this.metrics.started);if(!isLite)this.metrics.baseFetchedMs=since();
  const S=this.meta.base.stride||24,n=buf.byteLength/S,u8=new Uint8Array(buf),i16=new Int16Array(buf),u16=new Uint16Array(buf);
  // one shared box; every building's position, size and colours are read on the GPU from the file as is
  const box=new THREE.BoxGeometry(1,1,1);box.translate(0,.5,0);
  const g=new THREE.InstancedBufferGeometry();g.index=box.index;g.setAttribute('position',box.getAttribute('position'));g.instanceCount=n;
  const b8=new THREE.InstancedInterleavedBuffer(u8,S),b16=new THREE.InstancedInterleavedBuffer(u16,S/2),bi16=new THREE.InstancedInterleavedBuffer(i16,S/2);
  g.setAttribute('aPos',new THREE.InterleavedBufferAttribute(bi16,2,0,false));
  g.setAttribute('aSize',new THREE.InterleavedBufferAttribute(b16,4,2,false));
  g.setAttribute('aAng',new THREE.InterleavedBufferAttribute(b8,1,12,false));
  g.setAttribute('aStyle',new THREE.InterleavedBufferAttribute(b8,3,13,false));
  g.setAttribute('color',new THREE.InterleavedBufferAttribute(b8,3,16,true));
  g.setAttribute('aRoof',new THREE.InterleavedBufferAttribute(b8,3,19,true));
  g.setAttribute('aCell',new THREE.InterleavedBufferAttribute(b16,1,11,false));
  // the full base swaps in under the same mesh: the same blocks, more of them
  if(this.base){const old=this.base.geometry;this.base.geometry=g;old.dispose()}
  else{const mesh=new THREE.Mesh(g,this.baseMat);mesh.name='city-base';mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.raycast=()=>null;this.group.add(mesh);this.base=mesh}
  this.baseData={i16,u16,u8,n,S};const mesh=this.base;this._firstIsland?.();this.onChange?.('base');
  if(isLite){this.whenDrawn();return mesh}
  // baseLoadedMs: downloaded, unpacked and in the scene; baseReadyMs: first frame drawn with it
  this.metrics.baseLoadedMs=since();
  this.whenDrawn();
  return mesh;
 }
 /** baseReadyMs: the first frame drawn with the island (lite or full); cells start loading then. */
 whenDrawn(){if(this.baseDone)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(this.metrics.baseReadyMs==null)this.metrics.baseReadyMs=Math.round(performance.now()-this.metrics.started);this.baseDone=true;baseReadyResolve()}))}

 // ---------- always-loaded extras: land, main roads, large parks and water ----------
 /** Loads meta.land, meta.roads and meta.areas (each optional); they are never evicted. */
 loadExtras(){return this.extras||(this.extras=(async()=>{
  const {dir}=this.meta,out={};
  const flat=async(m,y)=>{if(!m)return null;const r=await fetch(dir+m.uri);if(!r.ok)return null;const a=new Int16Array(await unpack(await r.arrayBuffer())),u=m.unit||1,n=a.length/2,p=new Float32Array(n*3);
   for(let i=0;i<n;i++){p[i*3]=a[i*2]*u;p[i*3+1]=y;p[i*3+2]=a[i*2+1]*u}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const nm=new Float32Array(n*3);for(let i=0;i<n;i++)nm[i*3+1]=1;g.setAttribute('normal',new THREE.BufferAttribute(nm,3));g.computeBoundingSphere();return g};
  const [land,roads,areas]=await Promise.all([flat(this.meta.land,0).catch(()=>null),flat(this.meta.roads,.22).catch(()=>null),
   this.meta.areas?fetch(dir+this.meta.areas.uri).then(r=>r.ok?r.json():null).catch(()=>null):null]);
  if(land){out.land=land;this.metrics.landLoaded=true}if(roads)out.roads=roads;if(areas)out.areas=areas;
  return out})())}

 /** Buildings near (x,z) from the always-loaded base, as tile-style rows
  *  [height, minHeight, '', '', 0, footprint corners], for line-of-sight checks. */
 boxesAround(x,z,r){
  const d=this.baseData;if(!d)return null;const {i16,u16,u8,n,S}=d,h16=S/2,out=[];
  for(let i=0;i<n;i++){const cx=i16[i*h16],cz=i16[i*h16+1];if(Math.abs(cx-x)>r||Math.abs(cz-z)>r)continue;
   const w=u16[i*h16+2]/8,dd=u16[i*h16+3]/8,h=u16[i*h16+4]/10,mh=u16[i*h16+5]/10,a=u8[i*S+12]/255*Math.PI,c=Math.cos(a),s=Math.sin(a);
   const f=[];for(const [u,v] of [[-w,-dd],[w,-dd],[w,dd],[-w,dd]])f.push(cx+u*c-v*s,cz+u*s+v*c);out.push([h,mh,'','',0,f])}
  return out;
 }

 // ---------- intent ----------
 /** Load the area around (x,z) first, e.g. a hovered venue or the fly-to destination. */
 boost(x,z,ms=8000){this.boosts.push({x,z,until:performance.now()+ms});this.lastPlan=0}
 cellsAround(x,z,r){const T=this.meta.tileSize,out=[];for(let ix=Math.floor((x-r)/T);ix<=Math.floor((x+r)/T);ix++)for(let iz=Math.floor((z-r)/T);iz<=Math.floor((z+r)/T);iz++){const k=ix+'_'+iz;if(this.meta.cells[k])out.push(k)}return out}
 /** True when every cell within r of (x,z) shows full detail. */
 readyAround(x,z,r=500){return this.cellsAround(x,z,r).every(k=>{const g=this.meta.grid,[ix,iz]=k.split('_').map(Number);return this.fade[(ix-g.ix0)+(iz-g.iz0)*g.w]>.98})}
 markVenueReady(key){this.venueReady.add(key)}
 districtsAround(x,z,r){const D=this.meta.districts;if(!D)return [];const S=D.size,out=[];for(let dx=Math.floor((x-r)/S);dx<=Math.floor((x+r)/S);dx++)for(let dz=Math.floor((z-r)/S);dz<=Math.floor((z+r)/S);dz++){const k=dx+'_'+dz;if(D.cells[k])out.push(k)}return out}
 /** True when every district within r of (x,z) shows the middle level (or finer detail covers it). */
 midReadyAround(x,z,r=2000){const D=this.meta.districts;if(!D)return false;return this.districtsAround(x,z,r).every(k=>{const [dx,dz]=k.split('_').map(Number);return this.midFade[(dx-D.grid.dx0)+(dz-D.grid.dz0)*D.grid.w]>.98||this.cellsCover(dx,dz)})}
 /** True when every district within r of (x,z) is downloaded and in the scene (or full detail covers it). */
 midLoadedAround(x,z,r=2000){if(!this.meta.districts)return false;return this.districtsAround(x,z,r).every(k=>this.districts.get(k)?.state==='ready'||this.cellsCover(...k.split('_').map(Number)))}
 /** True when full detail shows in all of a district's cells. */
 cellsCover(dx,dz){const D=this.meta.districts,per=D.size/this.meta.tileSize,g=this.meta.grid;for(let ix=dx*per;ix<(dx+1)*per;ix++)for(let iz=dz*per;iz<(dz+1)*per;iz++){if(!this.meta.cells[ix+'_'+iz])continue;const i=(ix-g.ix0)+(iz-g.iz0)*g.w;if(!(this.fade[i]>.98))return false}return true}

 // ---------- per frame ----------
 /** dt: real seconds since the last frame (not capped: the dissolve is 0.3 s of wall-clock time on any device). */
 update(target,r,dt,{detailScale=1,midScale=1}={}){
  const now=performance.now(),T=this.meta.tileSize,{grid}=this.meta;
  // the studio shifts the whole city so the ballroom sits at the origin; cells find their square in map coordinates
  this.group.getWorldPosition(this._wp||(this._wp=new THREE.Vector3()));for(const m of [this.cellMat,this.baseMat,this.midMat])m?.userData.uniforms.uShift.value.set(this._wp.x,this._wp.z);
  this.boosts=this.boosts.filter(b=>b.until>now);
  const showR=Math.max(1600,r*1.4)*detailScale,midR=Math.max(7000,r*4)*midScale;this.radii={showR,midR};
  this.lastArgs=[{x:target.x,z:target.z},showR,midR];
  if(this.baseDone&&now-this.lastPlan>250){this.lastPlan=now;this.plan(target,showR,midR)}
  // mask targets and dissolve
  let changed=false,shown=0;
  for(const [key,c] of this.cells){
   const [ix,iz]=key.split('_').map(Number),idx=(ix-grid.ix0)+(iz-grid.iz0)*grid.w;
   const d=Math.hypot((ix+.5)*T-target.x,(iz+.5)*T-target.z);
   const venuesOk=!c.venues.length||this.venueReady.has(key);
   const want=c.state==='ready'&&venuesOk&&(d<showR||this.isBoosted(ix,iz))?1:0;
   const f=this.fade[idx],nf=want?Math.min(1,f+dt/FADE_S):Math.max(0,f-dt/FADE_S);
   if(nf!==f){this.fade[idx]=nf;const v=Math.round(nf*255);if(this.mask[idx]!==v){this.mask[idx]=v;changed=true}}
   if(c.group)c.group.visible=nf>0;
   if(nf>.98)shown++;
  }
  if(changed)this.maskTex.needsUpdate=true;
  this.metrics.cellsShown=shown;let fading=changed;
  // middle level: districts within midR; each one gives way, cell by cell, to full detail in the shader
  const D=this.meta.districts;
  if(D){let mc=false,ms=0;
   for(const [key,c] of this.districts){
    const [dx,dz]=key.split('_').map(Number),idx=(dx-D.grid.dx0)+(dz-D.grid.dz0)*D.grid.w;
    const d=Math.hypot((dx+.5)*D.size-target.x,(dz+.5)*D.size-target.z);
    const want=c.state==='ready'&&d<midR?1:0;
    const f=this.midFade[idx],nf=want?Math.min(1,f+dt/FADE_S):Math.max(0,f-dt/FADE_S);
    if(nf!==f){this.midFade[idx]=nf;const v=Math.round(nf*255);if(this.midMaskData[idx]!==v){this.midMaskData[idx]=v;mc=true}}
    // not drawn at all once full detail covers the whole district
    if(c.group)c.group.visible=nf>0&&!this.cellsCover(dx,dz);
    if(nf>.98)ms++;
   }
   if(mc)this.midTex.needsUpdate=true;this.metrics.districtsShown=ms;fading=fading||mc}
  this.fading=fading;
  if(this.metrics.frames.length<600)this.metrics.frames.push(Math.round(dt*1000));
 }
 isBoosted(ix,iz){const T=this.meta.tileSize;return this.boosts.some(b=>Math.abs((ix+.5)*T-b.x)<T*1.1&&Math.abs((iz+.5)*T-b.z)<T*1.1)}

 plan(target,showR,midR=Infinity){
  const T=this.meta.tileSize,keys=Object.keys(this.meta.cells);
  const pr=k=>{const [ix,iz]=k.split('_').map(Number),x=(ix+.5)*T,z=(iz+.5)*T;let d=Math.hypot(x-target.x,z-target.z);for(const b of this.boosts)d=Math.min(d,Math.hypot(x-b.x,z-b.z)-4000);return d};
  // background fill of the whole island unless the connection is slow or data saver is on
  const conn=navigator.connection,slow=conn&&(conn.saveData||/2g|3g/.test(conn.effectiveType||''));
  const limit=slow?showR*1.3:Infinity;
  // background fill: not while the map is parked behind another page, and never past the memory budget
  const budget=memoryBudget(),now=performance.now(),fill=this.fillIsland!==false&&this.usedBytes<budget*.85;
  const todo=keys.filter(k=>pr(k)<limit&&isDue(this.cells.get(k),{near:pr(k)<showR*1.5,fill,now})).sort((a,b)=>pr(a)-pr(b));
  // order: nearby full detail, then districts in view, then the rest of the island (districts before far cells)
  const D=this.meta.districts,dpr=k=>{const [dx,dz]=k.split('_').map(Number),x=(dx+.5)*D.size,z=(dz+.5)*D.size;let d=Math.hypot(x-target.x,z-target.z);for(const b of this.boosts)d=Math.min(d,Math.hypot(x-b.x,z-b.z));return d};
  const dlimit=slow?midR*1.3:Infinity;
  const dtodo=D?Object.keys(D.cells).filter(k=>dpr(k)<dlimit&&isDue(this.districts.get(k),{near:dpr(k)<midR*1.2,fill,now})&&!this.cellsCover(...k.split('_').map(Number))).sort((a,b)=>dpr(a)-dpr(b)):[];
  // (when zoomed far out, the districts in view come before the outer ring of full detail, so the view is covered first)
  const nearR=Math.min(showR,2500);
  const queue=[...todo.filter(k=>pr(k)<nearR).map(k=>['c',k]),...dtodo.filter(k=>dpr(k)<midR).map(k=>['m',k]),...todo.filter(k=>pr(k)>=nearR&&pr(k)<showR).map(k=>['c',k]),...dtodo.filter(k=>dpr(k)>=midR).map(k=>['m',k]),...todo.filter(k=>pr(k)>=showR).map(k=>['c',k])];
  for(const [t,k] of queue){if(this.fetching>=MAX_FETCH||this.fetching+this.readyQueue.length>=MAX_WAITING)break;if(t==='c')this.fetch(k);else this.fetchDistrict(k)}
  // hand downloaded files to the GPU nearest first, in the same order
  const near=k=>k.startsWith('m:')?dpr(k.slice(2)):pr(k);
  this.readyQueue.sort((a,b)=>near(a)-near(b));
  // memory budget: drop the farthest cells first (the base keeps covering them)
  // districts go first (the base still covers them), farthest first, never ones in view
  if(this.usedBytes>budget&&D){const loaded=[...this.districts].filter(([,c])=>c.state==='ready').sort((a,b)=>dpr(b[0])-dpr(a[0]));
   for(const [k,c] of loaded){if(this.usedBytes<=budget*.9)break;if(dpr(k)<midR*1.2)break;this.evictDistrict(k,c)}}
  if(this.usedBytes>budget){const loaded=[...this.cells].filter(([,c])=>c.state==='ready').sort((a,b)=>pr(b[0])-pr(a[0]));
   for(const [k,c] of loaded){if(this.usedBytes<=budget*.9)break;if(pr(k)<showR*1.5)break;this.evict(k,c)}}
 }
 fetch(key){
  const meta=this.meta.cells[key],c=this.cells.get(key)||{state:'idle',tries:0,venues:meta[2]||[]};
  c.state='loading';this.cells.set(key,c);this.fetching++;
  fetch(this.meta.dir+'t/'+key+'.glb').then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})
   .then(buf=>{c.buffer=buf;this.readyQueue.push(key);this.pump()})
   .catch(()=>{c.state='failed';c.tries++;c.retryAt=performance.now()+1000*c.tries*c.tries})
   .finally(()=>{this.fetching--;this.kick()});
 }
 install(key){
  const c=this.cells.get(key);if(!c?.buffer)return;
  let meshes;try{meshes=parseCellGlb(c.buffer)}catch{c.state='failed';c.tries=9;c.buffer=null;return}
  const g=new THREE.Group();g.name='cell-'+key;g.visible=false;
  for(const [name,m] of Object.entries(meshes)){
   const mat=name==='buildings'?this.cellMat:this.mats[name];if(!mat)continue;
   const mesh=new THREE.Mesh(m.geometry,mat);mesh.position.set(...m.translation);mesh.scale.setScalar(m.scale);mesh.raycast=()=>null;
   mesh.receiveShadow=true;if(name==='buildings')mesh.castShadow=true;else mesh.renderOrder=name==='green'?-3:name==='water'?-2:name==='walk'?-1.5:-1;
   g.add(mesh);
  }
  c.bytes=c.buffer.byteLength;c.buffer=null;c.group=g;c.state='ready';this.usedBytes+=c.bytes;this.group.add(g);this.metrics.cellsLoaded++;
 }
 /** One tiny mesh per material that cells and districts will use, so the
  *  renderer can compile their shaders before any of them arrive. */
 warmUp(){const g=new THREE.Group();g.name='city-warm';const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([0,-9e3,0,1,-9e3,0,0,-9e3,1],3));geo.setAttribute('color',new THREE.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));
  geo.setAttribute('aRoof',new THREE.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));geo.setAttribute('aStyle',new THREE.Float32BufferAttribute([0,0,0,0,0,0,0,0,0],3));
  for(const m of [this.cellMat,this.midMat,...Object.values(this.mats)])if(m){const mesh=new THREE.Mesh(geo,m);mesh.frustumCulled=false;if(m===this.cellMat||m===this.midMat)mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh)}
  this.group.add(g);return ()=>{this.group.remove(g);geo.dispose()}}
 /** Hand downloaded files to the scene off the frame loop: at most 4 ms of work, then a 5 ms gap,
  *  so loading keeps pace on any frame rate and never stalls a frame for long. */
 pump(){if(this._pump||this.disposed)return;this._pump=setTimeout(()=>{this._pump=null;const t0=performance.now();
  let seen=null;
  while(this.readyQueue.length&&performance.now()-t0<4){const k=this.readyQueue.shift();if(k.startsWith('m:'))this.installDistrict(k.slice(2));else this.install(k);if(this.inView(k))seen=seen==='cell'||!k.startsWith('m:')?'cell':'district'}
  if(seen)this.onChange?.(seen);
  this.kick();if(this.readyQueue.length)this.pump()},5)}
 /** Whether a newly installed file would be shown from the current view (so it is worth a redraw). */
 inView(k){const a=this.lastArgs;if(!a)return true;const [t,showR,midR]=a,D=this.meta.districts;
  if(k.startsWith('m:')){const [dx,dz]=k.slice(2).split('_').map(Number);return Math.hypot((dx+.5)*D.size-t.x,(dz+.5)*D.size-t.z)<midR}
  const [ix,iz]=k.split('_').map(Number),T=this.meta.tileSize;return Math.hypot((ix+.5)*T-t.x,(iz+.5)*T-t.z)<showR||this.isBoosted(ix,iz)}
 /** Plan again as soon as a download slot frees up, so loading never waits for the next frame. */
 kick(){if(this._kick||!this.lastArgs||!this.baseDone)return;this._kick=setTimeout(()=>{this._kick=null;this.plan(...this.lastArgs)},0)}
 fetchDistrict(key){
  const c=this.districts.get(key)||{state:'idle',tries:0};c.state='loading';this.districts.set(key,c);this.fetching++;
  fetch(this.meta.dir+'m/'+key+'.glb').then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})
   .then(buf=>{c.buffer=buf;this.readyQueue.push('m:'+key);this.pump()})
   .catch(()=>{c.state='failed';c.tries++;c.retryAt=performance.now()+1000*c.tries*c.tries})
   .finally(()=>{this.fetching--;this.kick()});
 }
 installDistrict(key){
  const c=this.districts.get(key);if(!c?.buffer)return;
  let meshes;try{meshes=parseCellGlb(c.buffer)}catch{c.state='failed';c.tries=9;c.buffer=null;return}
  const g=new THREE.Group();g.name='district-'+key;g.visible=false;
  for(const [name,m] of Object.entries(meshes)){
   const mat=name==='buildings'?this.midMat:this.mats[name];if(!mat)continue;
   const mesh=new THREE.Mesh(m.geometry,mat);mesh.position.set(...m.translation);mesh.scale.setScalar(m.scale);mesh.raycast=()=>null;
   mesh.receiveShadow=true;if(name==='buildings')mesh.castShadow=true;else mesh.renderOrder=name==='green'?-3.2:name==='water'?-2.2:-1.2;
   g.add(mesh);
  }
  c.bytes=c.buffer.byteLength;c.buffer=null;c.group=g;c.state='ready';this.usedBytes+=c.bytes;this.group.add(g);this.metrics.districtsLoaded++;
 }
 evictDistrict(key,c){this.group.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());c.group=null;c.state='evicted';this.usedBytes-=c.bytes||0;this.metrics.districtsEvicted++;
  const D=this.meta.districts,[dx,dz]=key.split('_').map(Number),idx=(dx-D.grid.dx0)+(dz-D.grid.dz0)*D.grid.w;this.midFade[idx]=0;this.midMaskData[idx]=0;this.midTex.needsUpdate=true}
 evict(key,c){this.group.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());c.group=null;c.state='evicted';this.usedBytes-=c.bytes||0;this.metrics.cellsEvicted++;
  const g=this.meta.grid,[ix,iz]=key.split('_').map(Number),idx=(ix-g.ix0)+(iz-g.iz0)*g.w;this.fade[idx]=0;this.mask[idx]=0;this.maskTex.needsUpdate=true}
}

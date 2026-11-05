// Streams the pre-built city (spec: docs/superpowers/specs/2026-11-04-city-streaming-design.md).
//
// - The base layer (every building as a simple block) loads first and is
//   never evicted, so the island is always visible.
// - Full-detail cells load by priority (distance from the camera target,
//   boosted for what the couple is about to look at), at most 6 downloads at
//   a time and at most 3 cells handed to the GPU per frame.
// - A per-cell mask cross-dissolves base and detail over 0.3 s.
// - Cells far from the camera stay in memory but show the base instead;
//   only when a memory budget is exceeded are the farthest cells dropped.
import * as THREE from 'three';
import {parseCellGlb} from './glb.js';
import {makeBuildingMaterial} from '../look/buildingMaterial.js';

const ROOT='/data/sg3d/';
const MAX_FETCH=6,MAX_BUILD_PER_FRAME=3,FADE_S=.3;
let current=null;
export const getCityStream=()=>current;

let latestRequest=null,baseRequest=null;
export function loadLatest(){return latestRequest||(latestRequest=fetch(ROOT+'latest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(async l=>{
 if(!l)return null;
 if(l.meta)return {...l.meta,dir:ROOT+l.version+'/'};
 const ts=await fetch(ROOT+l.tileset).then(r=>r.ok?r.json():null);return ts?{...ts.extras,dir:ROOT+l.version+'/'}:null}).catch(()=>null))}
/** The base layer bytes (unpacked), fetched once and shared. */
function fetchBase(meta){return baseRequest||(baseRequest=fetch(meta.dir+meta.base.uri).then(r=>{if(!r.ok)throw new Error('base '+r.status);return r.arrayBuffer()}).then(async buf=>{
 const h=new Uint8Array(buf,0,2);if(h[0]===0x1f&&h[1]===0x8b)return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return buf}).catch(e=>{baseRequest=null;throw e}))}
/** Start downloading the map while the person is elsewhere in the app (skipped on data saver / slow connections). */
export function prefetchCity(){const c=navigator.connection;if(c&&(c.saveData||/2g|3g/.test(c.effectiveType||'')))return;loadLatest().then(m=>{if(m)fetchBase(m).catch(()=>{})})}
let baseReadyResolve;export const baseReady=new Promise(r=>{baseReadyResolve=r});

function memoryBudget(){const gb=navigator.deviceMemory||8;return (gb<=4?120:400)*1e6}

export class CityStream{
 constructor(meta,{sun,mats}){
  this.meta=meta;this.mats=mats;this.group=new THREE.Group();this.group.name='city-stream';
  const {grid}=meta;
  this.mask=new Uint8Array(grid.w*grid.h);this.fade=new Float32Array(grid.w*grid.h);
  this.maskTex=new THREE.DataTexture(this.mask,grid.w,grid.h,THREE.RedFormat,THREE.UnsignedByteType);this.maskTex.needsUpdate=true;
  const maskOpt=mode=>({mode,texture:this.maskTex,grid,tileSize:meta.tileSize});
  this.cellMat=makeBuildingMaterial({sunDir:sun,packed:true,mask:maskOpt('cell')});
  this.baseMat=makeBuildingMaterial({sunDir:sun,packed:true,mask:maskOpt('base')});
  this.cells=new Map();   // key -> {state, group, bytes, tries, venues}
  this.boosts=[];this.fetching=0;this.readyQueue=[];this.usedBytes=0;this.lastPlan=0;this.venueReady=new Set();
  this.metrics=window.__cityMetrics={started:performance.now(),baseFetchedMs:null,baseLoadedMs:null,baseReadyMs:null,cellsLoaded:0,cellsShown:0,baseEvictions:0,cellsEvicted:0,frames:[]};
  window.__cityStream=this;current=this;
  this.baseReady=this.loadBase();
 }
 dispose(){this.group.traverse(o=>{if(o.geometry)o.geometry.dispose()});this.cellMat.dispose();this.baseMat.dispose();this.maskTex.dispose();if(current===this)current=null}

 // ---------- base layer ----------
 async loadBase(){
  const {base,dir}=this.meta;
  const buf=await fetchBase(this.meta);
  const since=()=>Math.round(performance.now()-this.metrics.started);this.metrics.baseFetchedMs=since();
  const n=base.count,S=base.stride,u8=new Uint8Array(buf),i16=new Int16Array(buf),u16=new Uint16Array(buf);
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
  const mesh=new THREE.Mesh(g,this.baseMat);mesh.name='city-base';mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.raycast=()=>null;
  this.group.add(mesh);this.base=mesh;this.baseData={i16,u16,u8,n,S};
  // baseLoadedMs: downloaded, unpacked and in the scene; baseReadyMs: first frame drawn with it
  this.metrics.baseLoadedMs=since();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(this.metrics.baseReadyMs==null)this.metrics.baseReadyMs=Math.round(performance.now()-this.metrics.started);this.baseDone=true;baseReadyResolve()}));
  return mesh;
 }

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

 // ---------- per frame ----------
 /** dt: real seconds since the last frame (not capped: the dissolve is 0.3 s of wall-clock time on any device). */
 update(target,r,dt){
  const now=performance.now(),T=this.meta.tileSize,{grid}=this.meta;
  // the studio shifts the whole city so the ballroom sits at the origin; cells find their square in map coordinates
  this.group.getWorldPosition(this._wp||(this._wp=new THREE.Vector3()));this.cellMat.userData.uniforms.uShift.value.set(this._wp.x,this._wp.z);
  this.boosts=this.boosts.filter(b=>b.until>now);
  const showR=Math.max(1600,r*1.4);
  if(this.baseDone&&now-this.lastPlan>250){this.lastPlan=now;this.plan(target,showR)}
  // hand ready cells to the GPU, a few per frame
  for(let i=0;i<MAX_BUILD_PER_FRAME&&this.readyQueue.length;i++)this.install(this.readyQueue.shift());
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
  this.metrics.cellsShown=shown;
  if(this.metrics.frames.length<600)this.metrics.frames.push(Math.round(dt*1000));
 }
 isBoosted(ix,iz){const T=this.meta.tileSize;return this.boosts.some(b=>Math.abs((ix+.5)*T-b.x)<T*1.1&&Math.abs((iz+.5)*T-b.z)<T*1.1)}

 plan(target,showR){
  const T=this.meta.tileSize,keys=Object.keys(this.meta.cells);
  const pr=k=>{const [ix,iz]=k.split('_').map(Number),x=(ix+.5)*T,z=(iz+.5)*T;let d=Math.hypot(x-target.x,z-target.z);for(const b of this.boosts)d=Math.min(d,Math.hypot(x-b.x,z-b.z)-4000);return d};
  // background fill of the whole island unless the connection is slow or data saver is on
  const conn=navigator.connection,slow=conn&&(conn.saveData||/2g|3g/.test(conn.effectiveType||''));
  const limit=slow?showR*1.3:Infinity;
  const todo=keys.filter(k=>{const c=this.cells.get(k);return (!c||c.state==='idle'||(c.state==='failed'&&c.tries<3&&performance.now()>c.retryAt))&&pr(k)<limit}).sort((a,b)=>pr(a)-pr(b));
  for(const k of todo){if(this.fetching>=MAX_FETCH)break;this.fetch(k)}
  // memory budget: drop the farthest cells first (the base keeps covering them)
  const budget=memoryBudget();
  if(this.usedBytes>budget){const loaded=[...this.cells].filter(([,c])=>c.state==='ready').sort((a,b)=>pr(b[0])-pr(a[0]));
   for(const [k,c] of loaded){if(this.usedBytes<=budget*.9)break;if(pr(k)<showR*1.5)break;this.evict(k,c)}}
 }
 fetch(key){
  const meta=this.meta.cells[key],c=this.cells.get(key)||{state:'idle',tries:0,venues:meta[2]||[]};
  c.state='loading';this.cells.set(key,c);this.fetching++;
  fetch(this.meta.dir+'t/'+key+'.glb').then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})
   .then(buf=>{c.buffer=buf;this.readyQueue.push(key)})
   .catch(()=>{c.state='failed';c.tries++;c.retryAt=performance.now()+1000*c.tries*c.tries})
   .finally(()=>{this.fetching--});
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
 evict(key,c){this.group.remove(c.group);c.group.traverse(o=>o.geometry?.dispose());c.group=null;c.state='idle';this.usedBytes-=c.bytes||0;this.metrics.cellsEvicted++;
  const g=this.meta.grid,[ix,iz]=key.split('_').map(Number),idx=(ix-g.ix0)+(iz-g.iz0)*g.w;this.fade[idx]=0;this.mask[idx]=0;this.maskTex.needsUpdate=true}
}

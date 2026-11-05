#!/usr/bin/env node
// Builds the web-ready Singapore city from the OpenStreetMap tiles in
// public/data/sg (spec: docs/superpowers/specs/2026-11-04-city-streaming-design.md).
//
// Output: public/data/sg3d/<version>/
//   base.bin      the whole island as one oriented box per building (24 bytes
//                 each), always kept in memory by the browser so the map never
//                 goes blank
//   t/<ix>_<iz>.glb  full detail for each 1 km cell: glTF 2.0 binary with
//                 KHR_mesh_quantization (Int16 positions, packed colours),
//                 buildings with shared vertices + roads, footpaths, parks, water
//   tileset.json  3D Tiles 1.1 tileset listing the cells, plus extras the
//                 website uses (grid, base file, sizes, venues per cell)
// and public/data/sg3d/latest.json pointing at the current version.
//
// Buildings that belong to a listed venue are left out of the cell files and
// shipped as source rows (extras.venueRows, a few KB) so the website can draw,
// highlight and make them see-through without the old JSON tiles.
//
// Usage: node scripts/build-city-3d.mjs [--if-missing]
// Later sources (Blender glTF per district, Tripo rooms) plug in here.
import {readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {VENUES} from '../src/data/venues.js';
import {project,pointInPolygon} from '../src/explorer/geo.js';
import {matchVenue} from '../src/explorer/venueMatch.js';
import {buildingLook} from '../src/explorer/look/palette.js';
import {HOTEL_LOOKS,landmarkLook} from '../src/explorer/look/hotels.js';

// OSM colour tags with values THREE can't parse fall back quietly (palette.js); hide its warnings
const warn=console.warn;console.warn=(...a)=>{if(typeof a[0]==='string'&&a[0].startsWith('THREE.Color'))return;warn(...a)};
const SRC='public/data/sg',OUT='public/data/sg3d';
const BUILDER_VERSION=3;
const Q=.05;                        // metres per quantized position unit (Int16 → ±1.6 km around a cell centre)
const BASE_STRIDE=24;
const BUDGET={baseRaw:4.5e6,baseGzip:3e6,cell:2e6};

const index=JSON.parse(await readFile(`${SRC}/index.json`,'utf8'));
const version=createHash('sha1').update(String(index.generated)+':'+BUILDER_VERSION+':'+JSON.stringify(VENUES.map(v=>[v.id,v.points]))).digest('hex').slice(0,10);
if(process.argv.includes('--if-missing')&&existsSync(`${OUT}/latest.json`)){
 try{const cur=JSON.parse(await readFile(`${OUT}/latest.json`,'utf8'));if(cur.version===version&&existsSync(`${OUT}/${version}/tileset.json`)&&existsSync(`${OUT}/${version}/meta.json`)){console.log('city 3D build is up to date:',version);process.exit(0)}}catch{}
}
const T=index.tileSize;
const t0=Date.now();

// ---------- load all source cells ----------
const cells=new Map();
for(const key of Object.keys(index.tiles)){cells.set(key,JSON.parse(await readFile(`${SRC}/tiles/${key}.json`,'utf8')))}
const keys=[...cells.keys()],ixs=keys.map(k=>+k.split('_')[0]),izs=keys.map(k=>+k.split('_')[1]);
const grid={ix0:Math.min(...ixs),iz0:Math.min(...izs),w:Math.max(...ixs)-Math.min(...ixs)+1,h:Math.max(...izs)-Math.min(...izs)+1};
const cellIndex=key=>{const [ix,iz]=key.split('_').map(Number);return (ix-grid.ix0)+(iz-grid.iz0)*grid.w};

// ---------- venue ownership (same rules as the website) ----------
const venueOf=new Map();   // row -> venue id
for(const v of VENUES){
 const pts=v.points.map(([la,lo])=>project(la,lo)),cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
 const around=[];for(let ix=Math.floor((cx-250)/T);ix<=Math.floor((cx+250)/T);ix++)for(let iz=Math.floor((cz-250)/T);iz<=Math.floor((cz+250)/T);iz++){const c=cells.get(ix+'_'+iz);if(c)around.push(...c.b)}
 const test=matchVenue(around,pts,{x:cx,z:cz},v.name);
 // a venue's parts may sit in further cells (shared building id), so scan neighbours generously
 for(let ix=Math.floor((cx-1500)/T);ix<=Math.floor((cx+1500)/T);ix++)for(let iz=Math.floor((cz-1500)/T);iz<=Math.floor((cz+1500)/T);iz++){const c=cells.get(ix+'_'+iz);if(c)for(const row of c.b)if(!venueOf.has(row)&&test(row))venueOf.set(row,v.id)}
}

// ---------- helpers ----------
function signedArea(f){let a=0;for(let i=0,j=f.length-2;i<f.length;j=i,i+=2)a+=(f[j]*f[i+1]-f[i]*f[j+1]);return a/2}
function clean(f){const out=[];for(let i=0;i<f.length;i+=2){const x=f[i],z=f[i+1],n=out.length;if(n&&Math.abs(out[n-2]-x)<.01&&Math.abs(out[n-1]-z)<.01)continue;out.push(x,z)}
 if(out.length>=4&&Math.abs(out[0]-out[out.length-2])<.01&&Math.abs(out[1]-out[out.length-1])<.01)out.splice(-2,2);return out}
const u8=v=>Math.max(0,Math.min(255,Math.round(v)));
function lookOf(row){
 let {wall,roof,kind,floor,seed}=buildingLook(row);
 const hotel=HOTEL_LOOKS[venueOf.get(row)]||landmarkLook(row[3]);
 if(hotel){if(hotel.wall)wall=new THREE.Color(hotel.wall);if(hotel.roof)roof=new THREE.Color(hotel.roof);kind=hotel.kind??kind;floor=hotel.storey||floor}
 return {wall,roof,kind,floor,seed};
}

// ---------- GLB writer (glTF 2.0 + KHR_mesh_quantization) ----------
function glb(meshes,translation){
 const views=[],accessors=[],gltfMeshes=[],chunks=[];let offset=0;
 const pushView=(bytes,stride,target)=>{const pad=(4-(offset%4))%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad}views.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength,...(stride?{byteStride:stride}:{}),target});chunks.push(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength));offset+=bytes.byteLength;return views.length-1};
 for(const m of meshes){
  const n=m.pos.length/4;if(!n)continue;
  const attrs={};
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<m.pos.length;i+=4)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],m.pos[i+k]);mx[k]=Math.max(mx[k],m.pos[i+k])}
  attrs.POSITION=accessors.push({bufferView:pushView(m.pos,8,34962),componentType:5122,count:n,type:'VEC3',min:mn,max:mx})-1;
  for(const [name,arr] of Object.entries(m.attrs||{}))attrs[name]=accessors.push({bufferView:pushView(arr,4,34962),componentType:5121,normalized:name!=='_STYLE',count:n,type:'VEC4'})-1;
  const idx=n>65535?Uint32Array.from(m.idx):Uint16Array.from(m.idx);
  const indices=accessors.push({bufferView:pushView(idx,0,34963),componentType:idx instanceof Uint32Array?5125:5123,count:idx.length,type:'SCALAR'})-1;
  gltfMeshes.push({name:m.name,primitives:[{attributes:attrs,indices,mode:4}]});
 }
 const json={asset:{version:'2.0',generator:'wedding-studio build-city-3d'},extensionsUsed:['KHR_mesh_quantization'],extensionsRequired:['KHR_mesh_quantization'],
  scene:0,scenes:[{nodes:gltfMeshes.map((_,i)=>i)}],nodes:gltfMeshes.map((m,i)=>({mesh:i,name:m.name,translation,scale:[Q,Q,Q]})),meshes:gltfMeshes,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
 let jsonBytes=Buffer.from(JSON.stringify(json));const jpad=(4-jsonBytes.length%4)%4;jsonBytes=Buffer.concat([jsonBytes,Buffer.alloc(jpad,0x20)]);
 const bin=Buffer.concat(chunks.map(c=>Buffer.from(c.buffer,c.byteOffset,c.byteLength)));const bpad=(4-bin.length%4)%4;const binP=Buffer.concat([bin,Buffer.alloc(bpad)]);
 const total=12+8+jsonBytes.length+8+binP.length,head=Buffer.alloc(12);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(total,8);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonBytes.length,0);jh.writeUInt32LE(0x4E4F534A,4);const bh=Buffer.alloc(8);bh.writeUInt32LE(binP.length,0);bh.writeUInt32LE(0x004E4942,4);
 return Buffer.concat([head,jh,jsonBytes,bh,binP]);
}

// ---------- per-cell full-detail meshes ----------
function buildCell(key,data){
 const [ix,iz]=key.split('_').map(Number),ox=(ix+.5)*T,oz=(iz+.5)*T;
 const qx=x=>Math.round((x-ox)/Q),qy=y=>Math.round(y/Q),qz=z=>Math.round((z-oz)/Q);
 const B={pos:[],idx:[],col:[],roof:[],style:[]};let venues=new Set(),count=0,maxH=0;
 for(const row of data.b){
  if(venueOf.has(row)){venues.add(venueOf.get(row));continue}
  const [h,minH]=row,f=clean(row[5]);const n=f.length/2;if(n<3)continue;
  const ccw=signedArea(f)>0,base=B.pos.length/4,top=Math.max(h,minH+2);
  const {wall,roof,kind,floor,seed}=lookOf(row);
  for(const y of [minH,top])for(let i=0;i<n;i++){B.pos.push(qx(f[i*2]),qy(y),qz(f[i*2+1]),0);B.col.push(u8(wall.r*255),u8(wall.g*255),u8(wall.b*255),255);B.roof.push(u8(roof.r*255),u8(roof.g*255),u8(roof.b*255),255);B.style.push(kind,u8(floor*20),u8(seed*255),0)}
  // walls: outward-facing quads sharing the two rings
  for(let i=0;i<n;i++){const j=(i+1)%n,a=base+i,b=base+j,c=base+n+j,d=base+n+i;if(ccw)B.idx.push(a,c,b,a,d,c);else B.idx.push(a,b,c,a,c,d)}
  // roof: triangulated top ring, facing up
  const contour=[];for(let i=0;i<n;i++)contour.push(new THREE.Vector2(f[i*2],f[i*2+1]));
  let tris;try{tris=THREE.ShapeUtils.triangulateShape(contour,[])}catch{tris=[]}
  for(const [a,b,c] of tris){const ax=f[a*2],az=f[a*2+1],bx=f[b*2],bz=f[b*2+1],cx=f[c*2],cz=f[c*2+1];const up=(bz-az)*(cx-ax)-(bx-ax)*(cz-az)>0;
   if(up)B.idx.push(base+n+a,base+n+b,base+n+c);else B.idx.push(base+n+a,base+n+c,base+n+b)}
  count++;maxH=Math.max(maxH,h);
 }
 // flat layers
 const flat=(name,y)=>({name,pos:[],idx:[],y});
 const roads=flat('roads',.25),walk=flat('walk',.2),green=flat('green',.15),water=flat('water',.1);
 const strip=(L,f,half)=>{for(let i=0;i+3<f.length;i+=2){const x1=f[i],z1=f[i+1],x2=f[i+2],z2=f[i+3];let dx=x2-x1,dz=z2-z1;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const ax=-dz*half,az=dx*half,b=L.pos.length/4;
  L.pos.push(qx(x1+ax),qy(L.y),qz(z1+az),0,qx(x2+ax),qy(L.y),qz(z2+az),0,qx(x2-ax),qy(L.y),qz(z2-az),0,qx(x1-ax),qy(L.y),qz(z1-az),0);
  // face up (+y): order depends on the strip direction
  L.idx.push(b,b+2,b+1,b,b+3,b+2)}};
 for(const [w,f] of data.r){strip(roads,f,w/2);if(w>=8)strip(walk,f,w/2+(w>=10?4.5:2.5))}
 const poly=(L,f0)=>{const f=clean(f0),n=f.length/2;if(n<3)return;const b=L.pos.length/4;for(let i=0;i<n;i++)L.pos.push(qx(f[i*2]),qy(L.y),qz(f[i*2+1]),0);
  const c=[];for(let i=0;i<n;i++)c.push(new THREE.Vector2(f[i*2],f[i*2+1]));let tris;try{tris=THREE.ShapeUtils.triangulateShape(c,[])}catch{tris=[]}
  for(const [a,bb,cc] of tris){const ax=f[a*2],az=f[a*2+1],bx=f[bb*2],bz=f[bb*2+1],cx=f[cc*2],cz=f[cc*2+1];const up=(bz-az)*(cx-ax)-(bx-ax)*(cz-az)>0;if(up)L.idx.push(b+a,b+bb,b+cc);else L.idx.push(b+a,b+cc,b+bb)}};
 for(const f of data.g||[])poly(green,f);for(const f of data.w||[])poly(water,f);
 const meshes=[{name:'buildings',pos:Int16Array.from(B.pos),idx:B.idx,attrs:{COLOR_0:Uint8Array.from(B.col),_ROOF:Uint8Array.from(B.roof),_STYLE:Uint8Array.from(B.style)}},
  ...[roads,walk,green,water].map(L=>({name:L.name,pos:Int16Array.from(L.pos),idx:L.idx}))];
 return {bytes:glb(meshes,[ox,0,oz]),count,maxH,venues:[...venues]};
}

// ---------- base layer: one oriented box per building ----------
function baseRecord(view,o,row,cell){
 const [h,minH]=row,f=clean(row[5]),n=f.length/2;if(n<3)return false;
 // orientation from the longest edge, extents in that frame
 let best=0,ang=0;for(let i=0;i<n;i++){const j=(i+1)%n,dx=f[j*2]-f[i*2],dz=f[j*2+1]-f[i*2+1],l=dx*dx+dz*dz;if(l>best){best=l;ang=Math.atan2(dz,dx)}}
 ang=((ang%Math.PI)+Math.PI)%Math.PI;const c=Math.cos(ang),s=Math.sin(ang);
 let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;for(let i=0;i<n;i++){const x=f[i*2],z=f[i*2+1],u=x*c+z*s,v=-x*s+z*c;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v)}
 const uc=(u0+u1)/2,vc=(v0+v1)/2,cx=uc*c-vc*s,cz=uc*s+vc*c;
 const {wall,roof,kind,floor,seed}=lookOf(row);
 view.setInt16(o,Math.round(cx),true);view.setInt16(o+2,Math.round(cz),true);
 view.setUint16(o+4,Math.min(65535,Math.round((u1-u0)*4)),true);view.setUint16(o+6,Math.min(65535,Math.round((v1-v0)*4)),true);
 view.setUint16(o+8,Math.min(65535,Math.round(Math.max(h,minH+2)*10)),true);view.setUint16(o+10,Math.min(65535,Math.round(minH*10)),true);
 view.setUint8(o+12,u8(ang/Math.PI*255));view.setUint8(o+13,kind);view.setUint8(o+14,u8(floor*20));view.setUint8(o+15,u8(seed*255));
 view.setUint8(o+16,u8(wall.r*255));view.setUint8(o+17,u8(wall.g*255));view.setUint8(o+18,u8(wall.b*255));
 view.setUint8(o+19,u8(roof.r*255));view.setUint8(o+20,u8(roof.g*255));view.setUint8(o+21,u8(roof.b*255));
 view.setUint16(o+22,cell,true);return true;
}

// ---------- write ----------
const dir=`${OUT}/${version}`;
await rm(OUT,{recursive:true,force:true});await mkdir(`${dir}/t`,{recursive:true});
let total=0;for(const c of cells.values())total+=c.b.length;
const baseBuf=new ArrayBuffer(total*BASE_STRIDE),view=new DataView(baseBuf);let baseCount=0;
const cellMeta={},children=[];let cellBytes=0,biggest=['',0],failures=[];
for(const [key,data] of cells){
 const ci=cellIndex(key);for(const row of data.b)if(baseRecord(view,baseCount*BASE_STRIDE,row,ci))baseCount++;
 const {bytes,count,maxH,venues}=buildCell(key,data);
 await writeFile(`${dir}/t/${key}.glb`,bytes);cellBytes+=bytes.length;if(bytes.length>biggest[1])biggest=[key,bytes.length];
 if(bytes.length>BUDGET.cell)failures.push(`cell ${key} is ${(bytes.length/1e6).toFixed(2)} MB (budget ${BUDGET.cell/1e6} MB)`);
 const [ix,iz]=key.split('_').map(Number);
 cellMeta[key]=[bytes.length,Math.round(maxH),venues,count];
 children.push({boundingVolume:{box:[(ix+.5)*T,Math.max(1,maxH)/2,(iz+.5)*T,T/2,0,0,0,Math.max(1,maxH)/2,0,0,0,T/2]},geometricError:0,content:{uri:`t/${key}.glb`}});
}
const base=Buffer.from(baseBuf,0,baseCount*BASE_STRIDE);
// shipped pre-compressed so it's small on any host; the browser unpacks it (DecompressionStream)
const baseGzBuf=gzipSync(base,{level:9});await writeFile(`${dir}/base.bin.gz`,baseGzBuf);
const baseGz=baseGzBuf.length;
if(base.length>BUDGET.baseRaw)failures.push(`base.bin is ${(base.length/1e6).toFixed(2)} MB raw (budget ${BUDGET.baseRaw/1e6} MB)`);
if(baseGz>BUDGET.baseGzip)failures.push(`base.bin is ${(baseGz/1e6).toFixed(2)} MB gzipped (budget ${BUDGET.baseGzip/1e6} MB)`);
const tileset={asset:{version:'1.1',generator:'wedding-studio build-city-3d'},geometricError:4000,
 root:{boundingVolume:{box:[(grid.ix0+grid.w/2)*T,150,(grid.iz0+grid.h/2)*T,grid.w*T/2,0,0,0,150,0,0,0,grid.h*T/2]},geometricError:1000,refine:'REPLACE',children},
 extras:{venueRows:Object.fromEntries(VENUES.map(v=>[v.id,[...venueOf].filter(([,id])=>id===v.id).map(([row])=>row)]).filter(([,r])=>r.length)),version,builder:BUILDER_VERSION,source:index.source,sourceGenerated:index.generated,localFrame:'metres from origin: x east, y up, z south',origin:index.origin,
  tileSize:T,quantization:Q,grid,base:{uri:'base.bin.gz',encoding:'gzip',count:baseCount,stride:BASE_STRIDE,bytes:base.length,gzipBytes:baseGz},cells:cellMeta}};
await writeFile(`${dir}/tileset.json`,JSON.stringify(tileset));
// latest.json is a tiny pointer, so the base layer and meta.json (what the
// website needs from the tileset) can download in parallel straight after it
await writeFile(`${dir}/meta.json`,JSON.stringify(tileset.extras));
await writeFile(`${OUT}/latest.json`,JSON.stringify({version,tileset:`${version}/tileset.json`,meta:`${version}/meta.json`,base:`${version}/base.bin.gz`}));
console.log(`city 3D ${version}: ${baseCount} buildings in base (${(base.length/1e6).toFixed(2)} MB raw, ${(baseGz/1e6).toFixed(2)} MB gzip); ${cells.size} cells, ${(cellBytes/1e6).toFixed(1)} MB total, largest ${biggest[0]} ${(biggest[1]/1e6).toFixed(2)} MB; venue buildings ${venueOf.size}; ${((Date.now()-t0)/1000).toFixed(1)} s`);
if(failures.length){console.error('Size budget exceeded:\n - '+failures.join('\n - '));process.exit(1)}

#!/usr/bin/env node
// Builds a free, tiled 3D map of Singapore from OpenStreetMap for the venue
// explorer: public/data/sg/index.json + public/data/sg/tiles/<ix>_<iz>.json
//
// Free: public Overpass API, no key. Data (c) OpenStreetMap contributors, ODbL.
// Run on GitHub Actions (.github/workflows/fetch-sg-map.yml) or locally:
//   node scripts/fetch-sg-map.mjs
//
// Coordinates are metres on a local plane around SG_ORIGIN: x east, z south.
// The equirectangular projection error across Singapore (~50 km) is < 0.1 %.
import {writeFile,mkdir,rm} from 'node:fs/promises';

const OUT='public/data/sg';
export const SG_ORIGIN={lat:1.3521,lon:103.8198};
const BBOX={s:1.205,w:103.59,n:1.475,e:104.045};
const CHUNK=Number(process.env.CHUNK||.05);           // degrees per Overpass request
const TILE=1000;                                       // metres per tile
const FLOOR=3.4;                                       // metres per storey when only levels are known
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];

const cosLat=Math.cos(SG_ORIGIN.lat*Math.PI/180);
const project=(lat,lon)=>[Math.round((lon-SG_ORIGIN.lon)*111320*cosLat),Math.round(-(lat-SG_ORIGIN.lat)*110540)];

async function overpass(query){
 let last;
 for(let round=0;round<3;round++)for(const url of ENDPOINTS){
  try{
   const res=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'wedding-studio-prototype/1.0 (github actions)'},body:'data='+encodeURIComponent(query)});
   if(res.ok)return await res.json();
   last=new Error(url+' HTTP '+res.status);
  }catch(e){last=e}
  await new Promise(r=>setTimeout(r,4000*(round+1)));
 }
 throw last;
}

const metres=v=>{if(v==null)return NaN;const s=String(v),n=parseFloat(s.replace(',','.'));return /ft|'/.test(s)?n*.3048:n};
const MATERIAL={glass:'#8fa3b1',brick:'#a8644f',concrete:'#c4beb3',plaster:'#e6dfd1',stone:'#cbbfa8',metal:'#a9adb1',wood:'#9b7653'};
const ROAD_W={motorway:16,trunk:14,primary:12,secondary:10,tertiary:8,unclassified:6,residential:6,service:4,living_street:5,pedestrian:4};

// Douglas-Peucker in metres; keeps footprints faithful while trimming noise points.
function simplify(pts,tol=.6){
 if(pts.length<5)return pts;
 const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;
 const stack=[[0,pts.length-1]];
 while(stack.length){const [a,b]=stack.pop();let best=-1,dist=0;const [ax,az]=pts[a],[bx,bz]=pts[b],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dx*(az-pts[i][1])-(ax-pts[i][0])*dz)/len;if(d>dist){dist=d;best=i}}
  if(dist>tol){keep[best]=1;stack.push([a,best],[best,b])}}
 return pts.filter((_,i)=>keep[i]);
}
function stitch(members){
 const parts=members.filter(m=>m.role!=='inner'&&m.geometry).map(m=>m.geometry.map(p=>[p.lat,p.lon]));const rings=[];
 while(parts.length){let cur=parts.shift(),changed=true;
  while(changed&&!(cur[0][0]===cur.at(-1)[0]&&cur[0][1]===cur.at(-1)[1])){changed=false;
   for(let i=0;i<parts.length;i++){const p=parts[i],end=cur.at(-1);
    if(p[0][0]===end[0]&&p[0][1]===end[1]){cur=cur.concat(p.slice(1));parts.splice(i,1);changed=true;break}
    if(p.at(-1)[0]===end[0]&&p.at(-1)[1]===end[1]){cur=cur.concat(p.slice(0,-1).reverse());parts.splice(i,1);changed=true;break}}}
  rings.push(cur)}
 return rings;
}
const area=poly=>{let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j][0]+poly[i][0])*(poly[j][1]-poly[i][1]);return Math.abs(a/2)};
const centroid=poly=>poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
const tileOf=([x,z])=>Math.floor(x/TILE)+'_'+Math.floor(z/TILE);

const tiles=new Map(),seen=new Set();
const tile=k=>{if(!tiles.has(k))tiles.set(k,{b:[],r:[],g:[],w:[]});return tiles.get(k)};
const stats={buildings:0,withHeight:0,withLevels:0,estimated:0,parts:0,roads:0,green:0,water:0,tooSmall:0};

const chunks=[];
for(let s=BBOX.s;s<BBOX.n;s+=CHUNK)for(let w=BBOX.w;w<BBOX.e;w+=CHUNK)chunks.push([s,w,Math.min(BBOX.n,s+CHUNK),Math.min(BBOX.e,w+CHUNK)]);
console.log(`fetching ${chunks.length} chunks`);
for(const [i,[s,w,n,e]] of chunks.entries()){
 const bb=`${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
 const data=await overpass(`[out:json][timeout:180];(
  way["building"](${bb});relation["building"](${bb});way["building:part"](${bb});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|pedestrian)$"](${bb});
  way["leisure"~"^(park|garden|golf_course|pitch|nature_reserve)$"](${bb});way["landuse"~"^(grass|forest|recreation_ground|village_green|cemetery)$"](${bb});
  way["natural"~"^(wood|scrub|water|wetland)$"](${bb});way["water"](${bb});relation["natural"="water"](${bb});
 );out body geom;`);
 for(const el of data.elements){
  const key=el.type+el.id;if(seen.has(key))continue;seen.add(key);
  const t=el.tags||{};
  if(t.highway&&el.geometry){
   if(t.area==='yes')continue;
   const pts=simplify(el.geometry.map(p=>project(p.lat,p.lon)),1);
   // split the polyline wherever it crosses into another tile
   let run=[pts[0]],cur=tileOf(pts[0]);
   for(let k=1;k<pts.length;k++){const mid=[(pts[k-1][0]+pts[k][0])/2,(pts[k-1][1]+pts[k][1])/2],tk=tileOf(mid);
    if(tk!==cur){if(run.length>1)tile(cur).r.push([ROAD_W[t.highway]||5,run.flat()]);run=[pts[k-1]];cur=tk}run.push(pts[k])}
   if(run.length>1)tile(cur).r.push([ROAD_W[t.highway]||5,run.flat()]);
   stats.roads++;continue;
  }
  const rings=el.type==='relation'?stitch(el.members||[]):el.geometry?[el.geometry.map(p=>[p.lat,p.lon])]:[];
  for(const ring of rings){
   if(ring.length<4)continue;
   let poly=simplify(ring.map(([la,lo])=>project(la,lo)));
   if(poly.length<4)continue;
   if(t.building||t['building:part']){
    const a=area(poly);if(a<6){stats.tooSmall++;continue}
    const levels=metres(t['building:levels']),minLevel=metres(t['building:min_level']);
    let h=metres(t.height),src='height';
    if(isNaN(h)&&!isNaN(levels)){h=levels*FLOOR+1.5;src='levels'}
    // No height data: estimate from building type and footprint so that large
    // footprints are not all flattened to one default height.
    if(isNaN(h)){src='estimate';const type=t.building||t['building:part'];
     h=type==='house'||type==='detached'||type==='terrace'||type==='bungalow'?8:type==='apartments'||type==='residential'?(a>500?45:15):type==='roof'||type==='shed'||type==='garage'||type==='carport'?4:type==='industrial'||type==='warehouse'?12:a>3000?20:a>800?14:10}
    let minH=metres(t.min_height);if(isNaN(minH))minH=!isNaN(minLevel)?minLevel*FLOOR:0;
    if(t.building==='roof'&&!t.min_height)minH=Math.max(minH,h-1.5);
    const colour=t['building:colour']||t.colour||MATERIAL[(t['building:material']||'').toLowerCase()]||'';
    tile(tileOf(centroid(poly))).b.push([+h.toFixed(1),+minH.toFixed(1),colour,t.name||'',t['building:part']?1:0,poly.flat()]);
    stats.buildings++;stats[src==='height'?'withHeight':src==='levels'?'withLevels':'estimated']++;if(t['building:part'])stats.parts++;
   }else{
    const water=t.natural==='water'||t.water||t.natural==='wetland';
    tile(tileOf(centroid(poly)))[water?'w':'g'].push(poly.flat());stats[water?'water':'green']++;
   }
  }
 }
 console.log(`chunk ${i+1}/${chunks.length}: ${data.elements.length} elements, ${stats.buildings} buildings so far`);
 await new Promise(r=>setTimeout(r,1500));
}

await rm(OUT,{recursive:true,force:true});
await mkdir(OUT+'/tiles',{recursive:true});
const index={source:'OpenStreetMap contributors (ODbL) via Overpass API',generated:new Date().toISOString(),origin:SG_ORIGIN,tileSize:TILE,stats,tiles:{}};
let bytes=0;
for(const [k,v] of tiles){const s=JSON.stringify(v);bytes+=s.length;await writeFile(`${OUT}/tiles/${k}.json`,s);index.tiles[k]=[v.b.length,Math.round(Math.max(0,...v.b.map(b=>b[0])))]}
await writeFile(`${OUT}/index.json`,JSON.stringify(index));
console.log(`wrote ${tiles.size} tiles, ${(bytes/1e6).toFixed(1)} MB`,stats);

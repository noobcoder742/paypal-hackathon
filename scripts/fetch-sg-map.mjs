#!/usr/bin/env node
// Builds a free, tiled 3D map of Singapore from OpenStreetMap for the venue
// explorer: public/data/sg/index.json + public/data/sg/tiles/<ix>_<iz>.json
//
// Free: the Geofabrik OpenStreetMap extract (no key, no rate limit), cut to
// Singapore and exported to GeoJSON lines by osmium (see the workflow).
// Data (c) OpenStreetMap contributors, ODbL. Run on GitHub Actions
// (.github/workflows/fetch-sg-map.yml) or locally after the osmium steps:
//   node scripts/fetch-sg-map.mjs sg.geojsonseq
//
// Coordinates are metres on a local plane around SG_ORIGIN: x east, z south.
// The equirectangular projection error across Singapore (~50 km) is < 0.1 %.
import {writeFile,mkdir,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';

const OUT='public/data/sg';
export const SG_ORIGIN={lat:1.3521,lon:103.8198};
const BBOX={s:1.205,w:103.59,n:1.475,e:104.045};
const INPUT=process.argv[2]||'sg.geojsonseq';
const TILE=1000;                                       // metres per tile
const FLOOR=3.4;                                       // metres per storey when only levels are known

const cosLat=Math.cos(SG_ORIGIN.lat*Math.PI/180);
const project=(lat,lon)=>[Math.round((lon-SG_ORIGIN.lon)*111320*cosLat),Math.round(-(lat-SG_ORIGIN.lat)*110540)];

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
// Rings are closed (first point = last), which Douglas-Peucker cannot split on,
// so cut the ring at its farthest vertex and simplify both halves.
function simplifyRing(ring,tol=.6){
 const pts=ring.slice();const a=pts[0],z=pts.at(-1);if(a[0]===z[0]&&a[1]===z[1])pts.pop();
 if(pts.length<4)return pts;
 let far=1,d=0;pts.forEach((p,i)=>{const q=Math.hypot(p[0]-pts[0][0],p[1]-pts[0][1]);if(q>d){d=q;far=i}});
 const one=simplify(pts.slice(0,far+1),tol),two=simplify([...pts.slice(far),pts[0]],tol);
 return [...one,...two.slice(1,-1)];
}
const area=poly=>{let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j][0]+poly[i][0])*(poly[j][1]-poly[i][1]);return Math.abs(a/2)};
const centroid=poly=>poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
const tileOf=([x,z])=>Math.floor(x/TILE)+'_'+Math.floor(z/TILE);

const tiles=new Map(),seen=new Set();
const tile=k=>{if(!tiles.has(k))tiles.set(k,{b:[],r:[],g:[],w:[]});return tiles.get(k)};
const stats={buildings:0,withHeight:0,withLevels:0,estimated:0,parts:0,roads:0,green:0,water:0,tooSmall:0};

const HW=/^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|pedestrian)$/;
const inBox=([lon,lat])=>lat>=BBOX.s&&lat<=BBOX.n&&lon>=BBOX.w&&lon<=BBOX.e;
// GeoJSON [lon,lat] -> internal [lat,lon]
const ll=c=>c.map(([lo,la])=>({lat:la,lon:lo}));
const rl=input=>createInterface({input:createReadStream(input),crlfDelay:Infinity});
let lines=0;
for await (const line of rl(INPUT)){
 const raw=line.replace(/^\x1e/,'').trim();if(!raw)continue;if(++lines%200000===0)console.log(`${lines} features, ${stats.buildings} buildings`);
 let f;try{f=JSON.parse(raw)}catch{continue}
 const g=f.geometry;if(!g)continue;
 const t=f.properties||{};
 let el;
 if(g.type==='LineString')el={geometry:ll(g.coordinates)};
 else if(g.type==='Polygon')el={rings:[g.coordinates[0]]};
 else if(g.type==='MultiPolygon')el={rings:g.coordinates.map(p=>p[0])};
 else continue;
 if(t.highway&&!HW.test(t.highway))continue;
 // osmium writes every way as a line too, so a highway area would be a duplicate.
 if(t.highway&&!el.geometry)continue;
 const first=el.geometry?[el.geometry[0].lon,el.geometry[0].lat]:el.rings[0][0];if(!inBox(first))continue;
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
  const greenOrWater=/^(park|garden|golf_course|pitch|nature_reserve)$/.test(t.leisure)||/^(grass|forest|recreation_ground|village_green|cemetery)$/.test(t.landuse)||/^(wood|scrub|water|wetland)$/.test(t.natural)||!!t.water;
  if(!t.building&&!t['building:part']&&!greenOrWater)continue;
  const rings=(el.rings||[]).map(r=>r.map(([lo,la])=>[la,lo]));
  for(const ring of rings){
   if(ring.length<4)continue;
   const poly=simplifyRing(ring.map(([la,lo])=>project(la,lo)));
   if(poly.length<3)continue;
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

// Simple 3D Buildings rule: when an outline contains building:parts, the parts
// carry the shape and heights and the outline itself is not drawn. Without
// this a 290 m tower would also show a lower box from its outline.
{
 const inside=(x,z,p)=>{let c=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],zi=p[i+1],xj=p[j],zj=p[j+1];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))c=!c}return c};
 const ctr=p=>{let x=0,z=0;for(let i=0;i<p.length;i+=2){x+=p[i];z+=p[i+1]}return [x*2/p.length,z*2/p.length]};
 const partsByTile=new Map();
 for(const [k,v] of tiles)partsByTile.set(k,v.b.filter(b=>b[4]).map(b=>[...ctr(b[5]),b]));
 let dropped=0;
 for(const [k,v] of tiles){const [ix,iz]=k.split('_').map(Number);
  v.b=v.b.filter(b=>{if(b[4])return true;const p=b[5];let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<p.length;i+=2){x0=Math.min(x0,p[i]);x1=Math.max(x1,p[i]);z0=Math.min(z0,p[i+1]);z1=Math.max(z1,p[i+1])}
   let has=false;
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const [x,z,part] of partsByTile.get((ix+dx)+'_'+(iz+dz))||[])
    // parts keep the outline's name so landmarks stay searchable
    if(x>=x0&&x<=x1&&z>=z0&&z<=z1&&inside(x,z,p)){has=true;if(!part[3])part[3]=b[3]}
   if(has)dropped++;return !has})}
 stats.outlinesReplacedByParts=dropped;
}
await rm(OUT,{recursive:true,force:true});
await mkdir(OUT+'/tiles',{recursive:true});
const index={source:'OpenStreetMap contributors (ODbL) via Geofabrik extract + osmium',generated:new Date().toISOString(),origin:SG_ORIGIN,tileSize:TILE,stats,tiles:{}};
let bytes=0;
for(const [k,v] of tiles){const s=JSON.stringify(v);bytes+=s.length;await writeFile(`${OUT}/tiles/${k}.json`,s);index.tiles[k]=[v.b.length,Math.round(Math.max(0,...v.b.map(b=>b[0])))]}
await writeFile(`${OUT}/index.json`,JSON.stringify(index));
console.log(`wrote ${tiles.size} tiles, ${(bytes/1e6).toFixed(1)} MB`,stats);

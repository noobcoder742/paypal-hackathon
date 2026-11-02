#!/usr/bin/env node
// Downloads free OpenStreetMap data (buildings, roads, parks, water, trees)
// around The Orchard Grand and writes a compact, pre-projected JSON
// file for the 3D studio: public/data/orchard-grand-surroundings.json
//
// Free: uses the public Overpass API (no key). Data (c) OpenStreetMap
// contributors, ODbL. Keep the attribution visible wherever this is shown.
//
// Run locally:   node scripts/fetch-osm-surroundings.mjs
// In CI:         .github/workflows/fetch-city.yml runs it on push.
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

const OUT='public/data/orchard-grand-surroundings.json';
// Approximate The Orchard Grand (29 Tanglin Road). Refined below by
// searching OSM for the hotel itself.
let LAT=1.30486,LON=103.82465;
const RADIUS=Number(process.env.RADIUS||700); // metres
const ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.private.coffee/api/interpreter'
];

async function overpass(query){
 let lastError;
 for(const url of ENDPOINTS){
  for(let attempt=0;attempt<3;attempt++){
   try{
    const res=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'wedding-studio-prototype/1.0'},body:'data='+encodeURIComponent(query)});
    if(res.ok)return await res.json();
    lastError=new Error(url+' HTTP '+res.status);
   }catch(e){lastError=e}
   await new Promise(r=>setTimeout(r,2000*2**attempt));
  }
 }
 throw lastError;
}

// 1) Find the hotel to anchor the ballroom.
const hotel=await overpass(`[out:json][timeout:60];nwr["name"~"St\\.? ?Regis",i](around:1500,${LAT},${LON});out center tags;`);
const anchor=hotel.elements.find(e=>e.tags?.tourism==='hotel'||e.tags?.building)||hotel.elements[0];
if(anchor){const c=anchor.center||anchor;if(c.lat&&c.lon){LAT=c.lat;LON=c.lon}}
console.log('anchor',anchor?.tags?.name||'(default)',LAT,LON);

// 2) Everything around it.
const data=await overpass(`[out:json][timeout:180];(
 way["building"](around:${RADIUS},${LAT},${LON});
 relation["building"](around:${RADIUS},${LAT},${LON});
 way["building:part"](around:${RADIUS},${LAT},${LON});
 way["highway"](around:${RADIUS},${LAT},${LON});
 way["leisure"~"park|garden|pitch"](around:${RADIUS},${LAT},${LON});
 way["landuse"~"grass|forest|recreation_ground|village_green"](around:${RADIUS},${LAT},${LON});
 way["natural"~"wood|scrub|water"](around:${RADIUS},${LAT},${LON});
 way["water"](around:${RADIUS},${LAT},${LON});
 node["natural"="tree"](around:${RADIUS},${LAT},${LON});
);out body geom;`);

const cosLat=Math.cos(LAT*Math.PI/180);
const project=(lat,lon)=>[+(((lon-LON)*111320*cosLat)).toFixed(1),+((-(lat-LAT)*110540)).toFixed(1)]; // x east, z south
const metres=v=>{if(v==null)return NaN;const n=parseFloat(String(v).replace(',','.'));return /ft|'/.test(String(v))?n*.3048:n};
const MATERIAL_COLOURS={glass:'#8fa3b1',brick:'#a8644f',concrete:'#c4beb3',plaster:'#e6dfd1',stone:'#cbbfa8',metal:'#a9adb1',wood:'#9b7653'};
function colour(tags){
 const c=tags['building:colour']||tags['colour'];
 if(c)return c;
 const m=MATERIAL_COLOURS[(tags['building:material']||tags['building:facade:material']||'').toLowerCase()];
 return m||null;
}
function ring(geometry){return geometry.map(p=>project(p.lat,p.lon))}
function stitch(members){ // join outer ways of a multipolygon into closed rings
 const parts=members.filter(m=>m.role!=='inner'&&m.geometry).map(m=>m.geometry.map(p=>[p.lat,p.lon]));
 const rings=[];
 while(parts.length){
  let cur=parts.shift();
  let changed=true;
  while(changed&&!(cur[0][0]===cur.at(-1)[0]&&cur[0][1]===cur.at(-1)[1])){
   changed=false;
   for(let i=0;i<parts.length;i++){
    const p=parts[i],end=cur.at(-1);
    if(p[0][0]===end[0]&&p[0][1]===end[1]){cur=cur.concat(p.slice(1));parts.splice(i,1);changed=true;break}
    if(p.at(-1)[0]===end[0]&&p.at(-1)[1]===end[1]){cur=cur.concat(p.slice(0,-1).reverse());parts.splice(i,1);changed=true;break}
   }
  }
  rings.push(cur.map(([la,lo])=>project(la,lo)));
 }
 return rings;
}
function inside(pt,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,zi]=poly[i],[xj,zj]=poly[j];if(((zi>pt[1])!==(zj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-zi)/(zj-zi)+xi))c=!c}return c}
const centroid=poly=>poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);

const buildings=[],parts=[],roads=[],green=[],water=[],trees=[];
const ROAD_WIDTH={motorway:16,trunk:14,primary:12,secondary:10,tertiary:8,unclassified:6,residential:6,service:4,living_street:5,pedestrian:4,footway:2,path:1.5,cycleway:2,steps:2};
for(const e of data.elements){
 const t=e.tags||{};
 if(e.type==='node'&&t.natural==='tree'){trees.push(project(e.lat,e.lon));continue}
 const polys=e.type==='relation'?stitch(e.members||[]):e.geometry?[ring(e.geometry)]:[];
 if(t.highway&&e.type==='way'){
  if(t.area==='yes')continue;
  roads.push({type:t.highway,w:ROAD_WIDTH[t.highway]||5,name:t.name||undefined,pts:ring(e.geometry)});
  continue;
 }
 if(t.building||t['building:part']){
  const levels=metres(t['building:levels']),minLevel=metres(t['building:min_level']);
  let h=metres(t.height);if(isNaN(h))h=!isNaN(levels)?levels*3.4+1.5:(t.building==='house'||t.building==='residential'?8:12);
  let minH=metres(t.min_height);if(isNaN(minH))minH=!isNaN(minLevel)?minLevel*3.4:0;
  for(const poly of polys){if(poly.length<4)continue;
   const item={h:+h.toFixed(1),minH:+minH.toFixed(1),colour:colour(t)||undefined,roof:t['roof:colour']||undefined,name:t.name||undefined,type:t.building||t['building:part'],poly};
   (t['building:part']?parts:buildings).push(item);
  }
  continue;
 }
 const isWater=t.natural==='water'||t.water;
 for(const poly of polys){if(poly.length>=4)(isWater?water:green).push(poly)}
}
// Prefer detailed building:parts over the plain outline that contains them.
const partCentres=parts.map(p=>centroid(p.poly));
const outlines=buildings.filter(b=>!partCentres.some(c=>inside(c,b.poly)));
const all=[...outlines,...parts];
// Every part of the hotel that contains the ballroom (podium and tower) is
// flagged so the studio can draw it as translucent glass.
for(const b of all)if(inside([0,0],b.poly))b.host=true;

const out={
 source:'OpenStreetMap contributors (ODbL) via Overpass API',
 generated:new Date().toISOString(),
 anchor:{lat:LAT,lon:LON,name:anchor?.tags?.name||'The Orchard Grand (approx.)'},
 radius:RADIUS,buildings:all,roads,green,water,trees:trees.slice(0,4000)
};
await mkdir(dirname(OUT),{recursive:true});
await writeFile(OUT,JSON.stringify(out));
console.log(`wrote ${OUT}: ${all.length} buildings, ${roads.length} roads, ${green.length} green areas, ${water.length} water, ${out.trees.length} trees`);

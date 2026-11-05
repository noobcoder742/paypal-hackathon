#!/usr/bin/env node
// Land polygons for the map from the coastline in the Singapore OpenStreetMap
// extract (no other download). Usage: node scripts/coast-to-land.mjs sg.geojsonseq land.geojson
import {createReadStream} from 'node:fs';import {writeFile} from 'node:fs/promises';import {createInterface} from 'node:readline';
import {landFromCoastlines} from './lib/coast-land.mjs';
const [IN='sg.geojsonseq',OUT='land.geojson']=process.argv.slice(2);
const BBOX={s:1.205,w:103.59,n:1.475,e:104.045};
const ccw=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return a<0?[...r].reverse():r};
const lines=[];
for await(const raw of createInterface({input:createReadStream(IN),crlfDelay:Infinity})){
 const s=raw.replace(/^\x1e/,'');if(!s.includes('coastline'))continue;let f;try{f=JSON.parse(s)}catch{continue}
 if(f.properties?.natural!=='coastline'||!f.geometry)continue;const g=f.geometry;
 if(g.type==='LineString')lines.push(g.coordinates);
 else if(g.type==='MultiLineString')lines.push(...g.coordinates);
 // a closed coastline exported as an area: land is inside, so its outline runs counter-clockwise
 else if(g.type==='Polygon')lines.push(ccw(g.coordinates[0]));
 else if(g.type==='MultiPolygon')for(const p of g.coordinates)lines.push(ccw(p[0]));
}
if(!lines.length){console.error('no natural=coastline lines in',IN);process.exit(1)}
const t0=Date.now(),rings=landFromCoastlines(lines,BBOX,{res:10,tol:7});
await writeFile(OUT,JSON.stringify({type:'FeatureCollection',source:'OpenStreetMap coastline (ODbL), traced at 10 m',features:rings.map(r=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...r,r[0]]]}}))}));
console.log(`land: ${lines.length} coastline lines -> ${rings.length} polygons, ${rings.reduce((n,r)=>n+r.length,0)} points, ${((Date.now()-t0)/1000).toFixed(1)} s`);

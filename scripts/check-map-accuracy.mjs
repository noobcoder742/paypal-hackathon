#!/usr/bin/env node
// Accuracy report for the Singapore map tiles (public/data/sg).
//  1. Projection: compares great-circle distances with distances on our flat
//     map across Singapore, so building sizes and gaps keep true scale.
//  2. Heights: compares OSM heights of well-known towers with their published
//     heights (reference values from public building records).
//  3. Coverage: how many buildings have a measured height vs an estimate.
// Writes docs/map-accuracy.md. Run: node scripts/check-map-accuracy.mjs
import {readFile,writeFile,readdir} from 'node:fs/promises';

const DIR='public/data/sg';
const index=JSON.parse(await readFile(`${DIR}/index.json`,'utf8'));
const O=index.origin,cosLat=Math.cos(O.lat*Math.PI/180);
const project=(lat,lon)=>[(lon-O.lon)*111320*cosLat,-(lat-O.lat)*110540];
const haversine=(a,b)=>{const R=6371008.8,r=Math.PI/180,dLat=(b[0]-a[0])*r,dLon=(b[1]-a[1])*r;const h=Math.sin(dLat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))};

// 1) projection error over random pairs inside Singapore
let worst=0,sum=0,n=0;
for(let i=0;i<4000;i++){const a=[1.21+Math.random()*.25,103.6+Math.random()*.43],b=[a[0]+(Math.random()-.5)*.05,a[1]+(Math.random()-.5)*.05];
 const d=haversine(a,b);if(d<50)continue;const [x1,z1]=project(...a),[x2,z2]=project(...b);const e=Math.abs(Math.hypot(x2-x1,z2-z1)-d)/d;worst=Math.max(worst,e);sum+=e;n++}

// 2) landmark heights (metres, published architectural/roof heights)
const LANDMARKS=[
 [/guoco tower/i,'Guoco Tower',290],
 [/^one raffles place/i,'One Raffles Place (Tower 1)',280],
 [/^uob plaza (1|one)/i,'UOB Plaza One',280],
 [/^republic plaza/i,'Republic Plaza',280],
 [/capitaspring/i,'CapitaSpring',280],
 [/ocean financial cent/i,'Ocean Financial Centre',245],
 [/orchard residences/i,'Orchard Residences (ION)',218],
 [/marina bay sands.*(tower|hotel)/i,'Marina Bay Sands hotel tower',194],
 [/pinnacle@duxton/i,'The Pinnacle@Duxton',156]
];
const found=new Map();
for(const f of await readdir(`${DIR}/tiles`)){
 const t=JSON.parse(await readFile(`${DIR}/tiles/${f}`,'utf8'));
 for(const b of t.b){const name=b[3];if(!name)continue;for(const [re,label] of LANDMARKS)if(re.test(name)){const cur=found.get(label);if(!cur||b[0]>cur.h)found.set(label,{h:b[0],name})}}
}
const rows=LANDMARKS.map(([,label,ref])=>{const f=found.get(label);if(!f)return `| ${label} | ${ref} m | not named in OSM | – |`;const diff=(f.h-ref)/ref*100;return `| ${label} | ${ref} m | ${f.h} m | ${diff>=0?'+':''}${diff.toFixed(1)} % |`});
const matched=LANDMARKS.map(([,l,ref])=>{const f=found.get(l);return f?Math.abs(f.h-ref)/ref:null}).filter(x=>x!=null);

// 3) coverage
const s=index.stats,total=s.buildings||1;
const report=`# Map accuracy report

Generated ${new Date().toISOString()} from tiles built ${index.generated}.

## 1. Horizontal scale (projection)
Footprints and positions come from OpenStreetMap, which is traced from aerial imagery and survey data.
Our flat-map projection was checked against great-circle distances for ${n} random point pairs across Singapore:

- mean scale error: **${(sum/n*100).toFixed(3)} %**
- worst case: **${(worst*100).toFixed(3)} %** (about ${(worst*100).toFixed(2)} m per 100 m)

Building sizes and the distances between buildings therefore keep their true relative scale.

## 2. Heights of well-known towers
| Building | Published height | Our map | Difference |
| --- | --- | --- | --- |
${rows.join('\n')}

Matched ${matched.length} of ${LANDMARKS.length} landmarks; mean absolute difference **${matched.length?(matched.reduce((a,b)=>a+b,0)/matched.length*100).toFixed(1):'–'} %**.

## 3. Height coverage
- ${total.toLocaleString()} buildings in total
- ${(s.withHeight/total*100).toFixed(1)} % have a measured height tag
- ${(s.withLevels/total*100).toFixed(1)} % have a storey count (height = storeys × 3.4 m + 1.5 m)
- ${(s.estimated/total*100).toFixed(1)} % have no height data and use an estimate from building type and footprint

The estimated buildings are the main source of error: their footprints are accurate but their heights are approximations.
Low-rise houses and shophouses are usually close; mid-rise blocks without tags can be off by several storeys.

## How to spot-check against Google Earth yourself
Open Google Earth, find the building, and use the Measure tool (ruler) to compare a footprint edge or the gap between two towers with the same buildings in our map.
Heights can be compared by counting storeys on the 3D view. Report any wrong building and its address; the fix is a height or storey tag in OpenStreetMap (free, and it improves the map for everyone), then re-run the map Action.
`;
await writeFile('docs/map-accuracy.md',report);
console.log(report);

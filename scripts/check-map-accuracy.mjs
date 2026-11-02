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
// Vincenty inverse formula on the WGS84 ellipsoid (same Earth model as GPS and
// Google Earth), accurate to well under a millimetre at these distances.
function geodesic([lat1,lon1],[lat2,lon2]){
 const a=6378137,f=1/298.257223563,b=a*(1-f),r=Math.PI/180;
 const L=(lon2-lon1)*r,U1=Math.atan((1-f)*Math.tan(lat1*r)),U2=Math.atan((1-f)*Math.tan(lat2*r));
 const sU1=Math.sin(U1),cU1=Math.cos(U1),sU2=Math.sin(U2),cU2=Math.cos(U2);
 let l=L,lp,sS,cS,s,sA,c2A,c2M;
 do{const sl=Math.sin(l),cl=Math.cos(l);sS=Math.hypot(cU2*sl,cU1*sU2-sU1*cU2*cl);if(!sS)return 0;cS=sU1*sU2+cU1*cU2*cl;s=Math.atan2(sS,cS);sA=cU1*cU2*sl/sS;c2A=1-sA*sA;c2M=c2A?cS-2*sU1*sU2/c2A:0;
  const C=f/16*c2A*(4+f*(4-3*c2A));lp=l;l=L+(1-C)*f*sA*(s+C*sS*(c2M+C*cS*(-1+2*c2M*c2M)))}while(Math.abs(l-lp)>1e-12);
 const u2=c2A*(a*a-b*b)/(b*b),A=1+u2/16384*(4096+u2*(-768+u2*(320-175*u2))),B=u2/1024*(256+u2*(-128+u2*(74-47*u2)));
 const dS=B*sS*(c2M+B/4*(cS*(-1+2*c2M*c2M)-B/6*c2M*(-3+4*sS*sS)*(-3+4*c2M*c2M)));
 return b*A*(s-dS);
}

// 1) projection error over random pairs inside Singapore
let worst=0,sum=0,n=0;
for(let i=0;i<4000;i++){const a=[1.21+Math.random()*.25,103.6+Math.random()*.43],b=[a[0]+(Math.random()-.5)*.05,a[1]+(Math.random()-.5)*.05];
 const d=geodesic(a,b);if(d<50)continue;const [x1,z1]=project(...a),[x2,z2]=project(...b);const e=Math.abs(Math.hypot(x2-x1,z2-z1)-d)/d;worst=Math.max(worst,e);sum+=e;n++}

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
// A tower in OSM is often a named outline plus unnamed building:parts that
// carry the real heights. The map draws every part, so the visible height is
// the tallest part whose centre lies inside the named outline.
const all=[];
for(const f of await readdir(`${DIR}/tiles`)){const t=JSON.parse(await readFile(`${DIR}/tiles/${f}`,'utf8'));for(const b of t.b)all.push(b)}
const centre=p=>{let x=0,z=0;for(let i=0;i<p.length;i+=2){x+=p[i];z+=p[i+1]}return [x/(p.length/2),z/(p.length/2)]};
const inside=(x,z,p)=>{let c=false;for(let i=0,j=p.length-2;i<p.length;j=i,i+=2){const xi=p[i],zi=p[i+1],xj=p[j],zj=p[j+1];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))c=!c}return c};
const bbox=p=>{let a=[1e9,1e9,-1e9,-1e9];for(let i=0;i<p.length;i+=2){a[0]=Math.min(a[0],p[i]);a[1]=Math.min(a[1],p[i+1]);a[2]=Math.max(a[2],p[i]);a[3]=Math.max(a[3],p[i+1])}return a};
const centres=all.map(b=>centre(b[5]));
const found=new Map();
for(const b of all){const name=b[3];if(!name)continue;for(const [re,label] of LANDMARKS)if(re.test(name)){
 const bb=bbox(b[5]);let h=b[0],parts=0;
 all.forEach((o,i)=>{const [x,z]=centres[i];if(x<bb[0]||x>bb[2]||z<bb[1]||z>bb[3]||o===b)return;if(inside(x,z,b[5])){parts++;h=Math.max(h,o[0])}});
 const cur=found.get(label);if(!cur||h>cur.h)found.set(label,{h,name,outline:b[0],parts})}}
const rows=LANDMARKS.map(([,label,ref])=>{const f=found.get(label);if(!f)return `| ${label} | ${ref} m | not named in OSM | – |`;const diff=(f.h-ref)/ref*100;return `| ${label} | ${ref} m | ${f.h} m${f.parts?` (tallest of ${f.parts} parts)`:''} | ${diff>=0?'+':''}${diff.toFixed(1)} % |`});
const matched=LANDMARKS.map(([,l,ref])=>{const f=found.get(l);return f?Math.abs(f.h-ref)/ref:null}).filter(x=>x!=null);

// 3) coverage
const s=index.stats,total=s.buildings||1;
const report=`# Map accuracy report

Generated ${new Date().toISOString()} from tiles built ${index.generated}.

## 1. Horizontal scale (projection)
Footprints and positions come from OpenStreetMap, which is traced from aerial imagery and survey data.
Our flat-map projection was checked against exact distances on the WGS84 Earth ellipsoid (the model GPS and Google Earth use) for ${n} random point pairs across Singapore:

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

// Extra detail around a selected venue (~350 m), so the neighbourhood holds
// up when zoomed in: roof parapets, rooftop plant rooms / AC units / water
// tanks, and trees along the main streets and in parks (Orchard and Tanglin
// roads are lined with mature rain trees).
import React,{useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {offset,ring,slab,rng,centroid,signedArea} from './geom.js';
import {pointInPolygon} from '../geo.js';

// Default radius around a selected venue; the Orchard district layer uses a larger one.
const DEFAULT_RADIUS=350;
const panel=new THREE.BoxGeometry(2,.12,1.15),pyramid=new THREE.ConeGeometry(1,1,4,1),cube=new THREE.BoxGeometry(1,1,1),crown=new THREE.IcosahedronGeometry(1,1),trunk=new THREE.CylinderGeometry(.18,.25,1,5);
const TREE=['#4b6a36','#55753c','#3f5d31','#62803f'].map(c=>new THREE.Color(c));

function build(tiles,cx,cz,skip,RADIUS,orchard){
 const parapets=[],roofBits=[],trees=[],podium=[],solar=[],crowns=[],glass=[];const near=orchard?(x,z)=>Math.abs(x-cx)<RADIUS*1.6&&Math.abs(z-cz)<RADIUS*.75:(x,z)=>Math.hypot(x-cx,z-cz)<RADIUS;
 for(const t of tiles){
  for(const row of t.b){const [h,minH,,,,f]=row;if(skip(row)||h-minH<3||f.length<6)continue;const [x,z]=centroid(f);if(!near(x,z))continue;
   const rand=rng((x*.013+z*.007)%1+.001);
   try{parapets.push(ring(f,h,.9))}catch{}
   // plant rooms, AC condensers and water tanks on flat roofs of mid/high-rise blocks
   if(h>12){const inner=offset(f,-2.2);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<f.length;i+=2){x0=Math.min(x0,f[i]);x1=Math.max(x1,f[i]);z0=Math.min(z0,f[i+1]);z1=Math.max(z1,f[i+1])}
    const n=Math.min(14,Math.floor((x1-x0)*(z1-z0)/90)+1);
    for(let k=0;k<n;k++){const px=x0+rand()*(x1-x0),pz=z0+rand()*(z1-z0);if(!pointInPolygon(px,pz,inner))continue;
     const big=rand()<.25,w=big?4+rand()*5:1.2+rand()*1.8,hh=big?2.6+rand()*1.4:1+rand()*.8;roofBits.push([px,h+hh/2,pz,w,hh,big?w*(.6+rand()*.6):w,rand()*.4])}}
   // Orchard mall podium roofs (seen from ION Orchard): a mix of roof gardens,
   // solar-panel arrays and plain car-park decks
   if(orchard&&(row[7]==='c'||row[7]==='')&&h>=8&&h<=45&&Math.abs(signedArea(f))>1500){const inner=offset(f,-1.5);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<f.length;i+=2){x0=Math.min(x0,f[i]);x1=Math.max(x1,f[i]);z0=Math.min(z0,f[i+1]);z1=Math.max(z1,f[i+1])}
    const pick=rand();
    if(pick<.45){const n=Math.min(220,Math.floor((x1-x0)*(z1-z0)/28));for(let k=0;k<n;k++){const px=x0+rand()*(x1-x0),pz=z0+rand()*(z1-z0);if((rand()<.6)&&pointInPolygon(px,pz,inner))podium.push([px,pz,h,1.2+rand()*2.2])}}
    else if(pick<.72&&solar.length<16000){for(let px=x0+2;px<x1-2;px+=2.15)for(let pz=z0+2;pz<z1-2;pz+=1.3)if(pointInPolygon(px,pz,inner)&&Math.floor((pz-z0)/1.3)%6!==5&&Math.floor((px-x0)/2.15)%10!==9)solar.push([px,h+.45,pz])}  // solid arrays with maintenance aisles
   }
   // Ngee Ann City: stepped crowns topped by glass pyramids on both towers
   if(orchard&&/ngee ann city|takashimaya/i.test(row[3]||'')&&h>60){
    let fx=f;for(let k=1;k<=3;k++){const shrunk=offset(fx,-2.2);try{crowns.push(slab(shrunk,h+(k-1)*2.8,2.8))}catch{}fx=shrunk}
    const [cx2,cz2]=centroid(fx);let rmax=0;for(let i=0;i<fx.length;i+=2)rmax=Math.max(rmax,Math.hypot(fx[i]-cx2,fx[i+1]-cz2));
    const e=Math.atan2(fx[3]-fx[1],fx[2]-fx[0]);glass.push([cx2,h+8.4,cz2,rmax*.85,rmax*.9,e]);
   }
  }
  // street trees along main roads
  for(const [w,f] of t.r){if(w<8)continue;for(let i=0;i+3<f.length;i+=2){const ax=f[i],az=f[i+1],bx=f[i+2],bz=f[i+3],len=Math.hypot(bx-ax,bz-az);if(len<1)continue;const dx=(bx-ax)/len,dz=(bz-az)/len;
   // Orchard Road and its side streets are lined with large rain trees
   const step=orchard?10:13,size=orchard&&w>=10?7.5:5;
   for(let d=6;d<len;d+=step)for(const side of [-1,1]){const x=ax+dx*d-dz*(w/2+2.8)*side,z=az+dz*d+dx*(w/2+2.8)*side;if(near(x,z))trees.push([x,z,size+((x*7+z*3)%3+3)%3*.6])}}}
  // park trees
  for(const f of t.g||[]){const [x,z]=centroid(f);if(!near(x,z))continue;const rand=rng((x*.011+z*.017)%1+.002);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<f.length;i+=2){x0=Math.min(x0,f[i]);x1=Math.max(x1,f[i]);z0=Math.min(z0,f[i+1]);z1=Math.max(z1,f[i+1])}
   const n=Math.min(160,Math.floor((x1-x0)*(z1-z0)/110));for(let k=0;k<n;k++){const px=x0+rand()*(x1-x0),pz=z0+rand()*(z1-z0);if(pointInPolygon(px,pz,f))trees.push([px,pz,4+rand()*4])}}
 }
 const p=parapets.length?mergeGeometries(parapets):null;parapets.forEach(g=>g.dispose());
 const c=crowns.length?mergeGeometries(crowns):null;crowns.forEach(g=>g.dispose());
 return {parapets:p,roofBits,trees:trees.slice(0,orchard?7000:2500),podium,solar,crowns:c,glass};
}

function useInstances(items,geometry,material,set){
 const mesh=useMemo(()=>{if(!items.length)return null;const m=new THREE.InstancedMesh(geometry,material,items.length),o=new THREE.Object3D();
  items.forEach((it,i)=>{set(o,it,i,m);o.updateMatrix();m.setMatrixAt(i,o.matrix)});m.castShadow=true;m.receiveShadow=true;m.raycast=()=>null;return m},[items,geometry,material,set]);
 useEffect(()=>()=>mesh?.dispose(),[mesh]);return mesh;
}
const setBit=(o,[x,y,z,w,h,d,r])=>{o.position.set(x,y,z);o.rotation.set(0,r,0);o.scale.set(w,h,d)};
const setCrown=(o,[x,z,s],i,m)=>{o.position.set(x,s*1.15,z);o.rotation.set(0,i,0);o.scale.set(s,s*.62,s);m.setColorAt(i,TREE[i%TREE.length])};
const setTrunk=(o,[x,z,s])=>{o.position.set(x,s*.45,z);o.rotation.set(0,0,0);o.scale.set(1,s*.9,1)};

const setSolar=(o,[x,y,z])=>{o.position.set(x,y,z);o.rotation.set(-.17,0,0);o.scale.set(1,1,1)};
const setGlass=(o,[x,y,z,r,h,rot])=>{o.position.set(x,y,z);o.rotation.set(0,Math.PI/4-rot,0);o.scale.set(r,h,r)};
const setPodium=(o,[x,z,h,s],i,m)=>{o.position.set(x,h+s*.45,z);o.rotation.set(0,i,0);o.scale.set(s,s*.7,s);m.setColorAt(i,TREE[(i+1)%TREE.length])};
export default function NearbyDetails({tiles,cx,cz,skip,radius=DEFAULT_RADIUS,orchard=false,groupRef}){
 const d=useMemo(()=>tiles?.length?build(tiles,cx,cz,skip,radius,orchard):null,[tiles,cx,cz,skip,radius,orchard]);
 const mats=useMemo(()=>({parapet:new THREE.MeshStandardMaterial({color:'#cfcac1',roughness:.9}),bit:new THREE.MeshStandardMaterial({color:'#bdbab3',roughness:.8}),
  crown:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,flatShading:true}),trunk:new THREE.MeshStandardMaterial({color:'#6b5a49',roughness:1}),
  solar:new THREE.MeshStandardMaterial({color:'#24324a',roughness:.25,metalness:.4}),glass:new THREE.MeshStandardMaterial({color:'#8fb5b0',roughness:.1,metalness:.3,transparent:true,opacity:.85}),maroon:new THREE.MeshStandardMaterial({color:'#6c3b34',roughness:.7})}),[]);
 useEffect(()=>()=>{d?.parapets?.dispose()},[d]);
 useEffect(()=>()=>Object.values(mats).forEach(m=>m.dispose()),[mats]);
 const bits=useInstances(d?.roofBits||[],cube,mats.bit,setBit);
 const crowns=useInstances(d?.trees||[],crown,mats.crown,setCrown);
 const trunks=useInstances(d?.trees||[],trunk,mats.trunk,setTrunk);
 const podium=useInstances(d?.podium||[],crown,mats.crown,setPodium);
 const solarMesh=useInstances(d?.solar||[],panel,mats.solar,setSolar);
 const glassMesh=useInstances(d?.glass||[],pyramid,mats.glass,setGlass);
 useEffect(()=>()=>{d?.crowns?.dispose()},[d]);
 if(!d)return null;
 return <group ref={groupRef}>{podium&&<primitive object={podium}/>}{solarMesh&&<primitive object={solarMesh}/>}{glassMesh&&<primitive object={glassMesh}/>}
  {d.crowns&&<mesh geometry={d.crowns} material={mats.maroon} castShadow receiveShadow raycast={()=>null}/>}
  {d.parapets&&<mesh geometry={d.parapets} material={mats.parapet} castShadow receiveShadow raycast={()=>null}/>}
  {bits&&<primitive object={bits}/>}{crowns&&<primitive object={crowns}/>}{trunks&&<primitive object={trunks}/>}
 </group>;
}

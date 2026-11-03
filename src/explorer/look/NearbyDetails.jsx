// Extra detail around a selected venue (~350 m), so the neighbourhood holds
// up when zoomed in: roof parapets, rooftop plant rooms / AC units / water
// tanks, and trees along the main streets and in parks (Orchard and Tanglin
// roads are lined with mature rain trees).
import React,{useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {offset,ring,rng,centroid} from './geom.js';
import {pointInPolygon} from '../geo.js';

const RADIUS=350;
const cube=new THREE.BoxGeometry(1,1,1),crown=new THREE.IcosahedronGeometry(1,1),trunk=new THREE.CylinderGeometry(.18,.25,1,5);
const TREE=['#4b6a36','#55753c','#3f5d31','#62803f'].map(c=>new THREE.Color(c));

function build(tiles,cx,cz,skip){
 const parapets=[],roofBits=[],trees=[];const near=(x,z)=>Math.hypot(x-cx,z-cz)<RADIUS;
 for(const t of tiles){
  for(const row of t.b){const [h,minH,,,,f]=row;if(skip(row)||h-minH<3||f.length<6)continue;const [x,z]=centroid(f);if(!near(x,z))continue;
   const rand=rng((x*.013+z*.007)%1+.001);
   try{parapets.push(ring(f,h,.9))}catch{}
   // plant rooms, AC condensers and water tanks on flat roofs of mid/high-rise blocks
   if(h>12){const inner=offset(f,-2.2);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<f.length;i+=2){x0=Math.min(x0,f[i]);x1=Math.max(x1,f[i]);z0=Math.min(z0,f[i+1]);z1=Math.max(z1,f[i+1])}
    const n=Math.min(14,Math.floor((x1-x0)*(z1-z0)/90)+1);
    for(let k=0;k<n;k++){const px=x0+rand()*(x1-x0),pz=z0+rand()*(z1-z0);if(!pointInPolygon(px,pz,inner))continue;
     const big=rand()<.25,w=big?4+rand()*5:1.2+rand()*1.8,hh=big?2.6+rand()*1.4:1+rand()*.8;roofBits.push([px,h+hh/2,pz,w,hh,big?w*(.6+rand()*.6):w,rand()*.4])}}
  }
  // street trees along main roads
  for(const [w,f] of t.r){if(w<8)continue;for(let i=0;i+3<f.length;i+=2){const ax=f[i],az=f[i+1],bx=f[i+2],bz=f[i+3],len=Math.hypot(bx-ax,bz-az);if(len<1)continue;const dx=(bx-ax)/len,dz=(bz-az)/len;
   for(let d=6;d<len;d+=13)for(const side of [-1,1]){const x=ax+dx*d-dz*(w/2+2.6)*side,z=az+dz*d+dx*(w/2+2.6)*side;if(near(x,z))trees.push([x,z,5+((x*7+z*3)%3+3)%3])}}}
  // park trees
  for(const f of t.g||[]){const [x,z]=centroid(f);if(!near(x,z))continue;const rand=rng((x*.011+z*.017)%1+.002);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(let i=0;i<f.length;i+=2){x0=Math.min(x0,f[i]);x1=Math.max(x1,f[i]);z0=Math.min(z0,f[i+1]);z1=Math.max(z1,f[i+1])}
   const n=Math.min(160,Math.floor((x1-x0)*(z1-z0)/110));for(let k=0;k<n;k++){const px=x0+rand()*(x1-x0),pz=z0+rand()*(z1-z0);if(pointInPolygon(px,pz,f))trees.push([px,pz,4+rand()*4])}}
 }
 const p=parapets.length?mergeGeometries(parapets):null;parapets.forEach(g=>g.dispose());
 return {parapets:p,roofBits,trees:trees.slice(0,2500)};
}

function useInstances(items,geometry,material,set){
 const mesh=useMemo(()=>{if(!items.length)return null;const m=new THREE.InstancedMesh(geometry,material,items.length),o=new THREE.Object3D();
  items.forEach((it,i)=>{set(o,it,i,m);o.updateMatrix();m.setMatrixAt(i,o.matrix)});m.castShadow=true;m.receiveShadow=true;m.raycast=()=>null;return m},[items,geometry,material,set]);
 useEffect(()=>()=>mesh?.dispose(),[mesh]);return mesh;
}
const setBit=(o,[x,y,z,w,h,d,r])=>{o.position.set(x,y,z);o.rotation.set(0,r,0);o.scale.set(w,h,d)};
const setCrown=(o,[x,z,s],i,m)=>{o.position.set(x,s*1.15,z);o.rotation.set(0,i,0);o.scale.set(s,s*.62,s);m.setColorAt(i,TREE[i%TREE.length])};
const setTrunk=(o,[x,z,s])=>{o.position.set(x,s*.45,z);o.rotation.set(0,0,0);o.scale.set(1,s*.9,1)};

export default function NearbyDetails({tiles,cx,cz,skip}){
 const d=useMemo(()=>tiles?.length?build(tiles,cx,cz,skip):null,[tiles,cx,cz,skip]);
 const mats=useMemo(()=>({parapet:new THREE.MeshStandardMaterial({color:'#cfcac1',roughness:.9}),bit:new THREE.MeshStandardMaterial({color:'#bdbab3',roughness:.8}),
  crown:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95,flatShading:true}),trunk:new THREE.MeshStandardMaterial({color:'#6b5a49',roughness:1})}),[]);
 useEffect(()=>()=>{d?.parapets?.dispose()},[d]);
 useEffect(()=>()=>Object.values(mats).forEach(m=>m.dispose()),[mats]);
 const bits=useInstances(d?.roofBits||[],cube,mats.bit,setBit);
 const crowns=useInstances(d?.trees||[],crown,mats.crown,setCrown);
 const trunks=useInstances(d?.trees||[],trunk,mats.trunk,setTrunk);
 if(!d)return null;
 return <group>
  {d.parapets&&<mesh geometry={d.parapets} material={mats.parapet} castShadow receiveShadow raycast={()=>null}/>}
  {bits&&<primitive object={bits}/>}{crowns&&<primitive object={crowns}/>}{trunks&&<primitive object={trunks}/>}
 </group>;
}

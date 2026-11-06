// Table centrepieces and the floral arch, built from floralGeometry (shared, cached geometry).
import React,{useMemo} from 'react';
import * as THREE from 'three';
import {assemble,bouquetItems,archItems,archPath} from './floralGeometry.js';

const cache=new Map();
const cached=(key,make)=>{if(!cache.has(key))cache.set(key,make());return cache.get(key)};
const petalMat=cached('petal',()=>new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.62,sheen:1,sheenRoughness:.45,sheenColor:new THREE.Color('#ffffff'),side:THREE.DoubleSide}));
const leafMat=cached('leaf',()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0,side:THREE.DoubleSide}));
const goldMat=cached('gold',()=>new THREE.MeshStandardMaterial({color:'#c9a96a',metalness:.85,roughness:.3}));
const vaseMat=cached('vase',()=>new THREE.MeshPhysicalMaterial({color:'#e9e4da',metalness:.1,roughness:.08,transmission:.6,thickness:.02,transparent:true,opacity:.85}));

function Arrangement({geo,castShadow=true}){
 return <>{geo.flowers&&<mesh geometry={geo.flowers} material={petalMat} castShadow={castShadow}/>}{geo.leaves&&<mesh geometry={geo.leaves} material={leafMat} castShadow={castShadow}/>}</>;
}
/** Table centrepiece: a glass vase with a domed bouquet, sitting on the table top. */
export function Centrepiece({variant='white'}){
 const geo=cached('bouquet-'+variant,()=>assemble(bouquetItems(variant)));
 return <group position={[0,.94,0]}>
  <mesh material={vaseMat} position={[0,.11,0]}><cylinderGeometry args={[.07,.09,.22,18,1,true]}/></mesh>
  <mesh material={goldMat} position={[0,.005,0]}><cylinderGeometry args={[.1,.1,.01,24]}/></mesh>
  <group position={[0,.2,0]}><Arrangement geo={geo} castShadow={false}/></group>
 </group>;
}
/** Floral arch: thin gold frame with an asymmetric floral cluster and greenery. */
export function FloralArch({variant='white',position=[0,0,4],rotation=0,width=4,postH=2.2}){
 const geo=cached(`arch-${variant}-${width}-${postH}`,()=>assemble(archItems(variant,41,width,postH),'mid'));
 const tube=useMemo(()=>{const pts=archPath(width,postH).map(p=>new THREE.Vector3(p.p[0],p.p[1],0));pts.push(new THREE.Vector3(width/2,0,0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,false,'catmullrom',.02),200,.025,10,false)},[width,postH]);
 return <group position={position} rotation={[0,rotation,0]}>
  <mesh geometry={tube} material={goldMat} castShadow/>
  {[-width/2,width/2].map(x=><mesh key={x} material={goldMat} position={[x,.02,0]} castShadow><cylinderGeometry args={[.12,.14,.04,20]}/></mesh>)}
  <Arrangement geo={geo}/>
 </group>;
}

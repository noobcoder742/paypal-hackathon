// Surrounding streets and buildings around the venue, built from free
// OpenStreetMap data (public/data/orchard-grand-surroundings.json, produced by
// scripts/fetch-osm-surroundings.mjs). Renders nothing if the file is missing.
//
// Draw calls stay low: all walls are one mesh, all roofs one mesh, all roads
// one mesh, trees are instanced. The building that contains the ballroom is
// drawn as translucent glass so the room stays visible inside it.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DATA_URL='/data/orchard-grand-surroundings.json';
const FLOOR=3.4; // metres per storey, matches the fetch script
const FACADE_PALETTE=['#e9e5dc','#ddd6c9','#cfd5d9','#e4dac8','#c3cbd0','#d8d2c6','#eee9e0'];

export function useCityData(){
 const [data,setData]=useState(null);
 useEffect(()=>{let live=true;fetch(DATA_URL).then(r=>r.ok?r.json():null).then(d=>{if(live&&d?.buildings)setData(d)}).catch(()=>{});return()=>{live=false}},[]);
 return data;
}

function hashColour(seed){let h=0;for(const c of seed)h=(h*31+c.charCodeAt(0))|0;return FACADE_PALETTE[Math.abs(h)%FACADE_PALETTE.length]}
function safeColour(value,fallback){try{const c=new THREE.Color();c.setStyle(value);return c}catch{return new THREE.Color(fallback)}}

// Window grid texture: one tile = one storey high, one bay wide. White areas
// take the building colour (vertex colours); windows are dark glass.
function facadeTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 g.fillStyle='#ffffff';g.fillRect(0,0,128,128);
 g.fillStyle='#4d5a66';g.fillRect(18,30,92,62);
 const grad=g.createLinearGradient(18,30,110,92);grad.addColorStop(0,'rgba(255,255,255,.28)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(18,30,92,62);
 g.fillStyle='#d7d7d7';g.fillRect(62,30,3,62);
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
 // UVs are in metres (WorldUVGenerator): one tile per 3.6 m bay and per storey.
 t.repeat.set(1/3.6,1/FLOOR);
 return t;
}

function shapeFrom(poly){
 const pts=poly.map(([x,z])=>new THREE.Vector2(x,-z));
 if(THREE.ShapeUtils.isClockWise(pts))pts.reverse();
 return new THREE.Shape(pts);
}
// Split an ExtrudeGeometry (group 0 = caps, group 1 = sides) into two plain geometries.
function splitGroups(geo,capColour,sideColour){
 const out=[[],[]];
 const pos=geo.attributes.position,uv=geo.attributes.uv;
 for(const grp of geo.groups){
  const P=[],U=[],C=[],colour=grp.materialIndex===0?capColour:sideColour;
  for(let i=grp.start;i<grp.start+grp.count;i++){P.push(pos.getX(i),pos.getY(i),pos.getZ(i));U.push(uv.getX(i),uv.getY(i));C.push(colour.r,colour.g,colour.b)}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
  out[grp.materialIndex===0?0:1].push(g);
 }
 return out;
}
function buildBuildings(buildings){
 const roofs=[],walls=[],host=[];
 for(const b of buildings){
  const depth=Math.max(2,b.h-(b.minH||0));
  let geo;
  try{geo=new THREE.ExtrudeGeometry(shapeFrom(b.poly),{depth,bevelEnabled:false})}catch{continue}
  geo.rotateX(-Math.PI/2);geo.translate(0,b.minH||0,0);
  if(b.host){host.push(geo);continue}
  const wallColour=safeColour(b.colour||hashColour(b.poly.length+':'+b.poly[0].join(',')),'#e6e1d8');
  const roofColour=b.roof?safeColour(b.roof,'#9a9a96'):wallColour.clone().multiplyScalar(.82);
  const [caps,sides]=splitGroups(geo,roofColour,wallColour);
  roofs.push(...caps);walls.push(...sides);geo.dispose();
 }
 const merge=list=>{if(!list.length)return null;const m=mergeGeometries(list);list.forEach(g=>g.dispose());m.computeVertexNormals();return m};
 const hostGeo=host.length?mergeGeometries(host.map(g=>{g.deleteAttribute('uv');return g})):null;
 hostGeo?.computeVertexNormals();
 return {roofs:merge(roofs),walls:merge(walls),host:hostGeo};
}
function buildRoads(roads){
 const P=[],idx=[];let base=0;
 for(const r of roads){
  const pts=r.pts,half=r.w/2,y=r.w>=5?.06:.08;
  if(pts.length<2)continue;
  for(let i=0;i<pts.length;i++){
   const [x,z]=pts[i],[ax,az]=pts[Math.max(0,i-1)],[bx,bz]=pts[Math.min(pts.length-1,i+1)];
   let dx=bx-ax,dz=bz-az;const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;
   P.push(x-dz*half,y,z+dx*half,x+dz*half,y,z-dx*half);
   if(i<pts.length-1){const k=base+i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}
  }
  base+=pts.length*2;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(idx);g.computeVertexNormals();
 return g;
}
function buildFlat(polys,y){
 const geos=[];
 for(const poly of polys){try{const g=new THREE.ShapeGeometry(shapeFrom(poly));g.rotateX(-Math.PI/2);g.translate(0,y,0);geos.push(g)}catch{}}
 if(!geos.length)return null;
 const m=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));geos.forEach(g=>g.dispose());return m;
}

const trunkGeo=new THREE.CylinderGeometry(.18,.25,3,6);trunkGeo.translate(0,1.5,0);
const canopyGeo=new THREE.IcosahedronGeometry(2.6,1);canopyGeo.scale(1,.8,1);canopyGeo.translate(0,4.6,0);
function Trees({points}){
 const trunks=useRef(),canopies=useRef();
 useEffect(()=>{
  const m=new THREE.Object3D(),c=new THREE.Color();
  points.forEach(([x,z],i)=>{const s=.75+((i*37)%10)/20;m.position.set(x,0,z);m.scale.setScalar(s);m.rotation.y=i;m.updateMatrix();trunks.current.setMatrixAt(i,m.matrix);canopies.current.setMatrixAt(i,m.matrix);canopies.current.setColorAt(i,c.setHSL(.27+((i*13)%10)/120,.38,.3+((i*7)%10)/80))});
  trunks.current.instanceMatrix.needsUpdate=true;canopies.current.instanceMatrix.needsUpdate=true;if(canopies.current.instanceColor)canopies.current.instanceColor.needsUpdate=true;
  trunks.current.computeBoundingSphere();canopies.current.computeBoundingSphere();
 },[points]);
 return <group>
  <instancedMesh ref={trunks} args={[trunkGeo,null,points.length]} raycast={()=>null}><meshStandardMaterial color="#5b4a3a" roughness={.9}/></instancedMesh>
  <instancedMesh ref={canopies} args={[canopyGeo,null,points.length]} raycast={()=>null} castShadow><meshStandardMaterial roughness={.85} flatShading/></instancedMesh>
 </group>;
}

// Shown only once the camera is far enough out that the room itself is small.
export function CityContext({data,showFrom=60}){
 const group=useRef();
 const geo=useMemo(()=>data?{...buildBuildings(data.buildings||[]),roads:buildRoads(data.roads||[]),green:buildFlat(data.green||[],.03),water:buildFlat(data.water||[],.025)}:null,[data]);
 const facade=useMemo(()=>facadeTexture(),[]);
 useEffect(()=>()=>{if(geo)Object.values(geo).forEach(g=>g?.dispose?.());facade.dispose()},[geo,facade]);
 useFrame(({camera})=>{if(group.current)group.current.visible=camera.position.length()>showFrom});
 if(!geo)return null;
 const radius=(data.radius||700)+200;
 return <group ref={group} visible={false}>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,0]} receiveShadow raycast={()=>null}><circleGeometry args={[radius,64]}/><meshStandardMaterial color="#c9c5bb" roughness={1}/></mesh>
  {geo.green&&<mesh geometry={geo.green} raycast={()=>null} receiveShadow><meshStandardMaterial color="#86a272" roughness={1}/></mesh>}
  {geo.water&&<mesh geometry={geo.water} raycast={()=>null}><meshStandardMaterial color="#6f94a8" roughness={.15} metalness={.1}/></mesh>}
  <mesh geometry={geo.roads} raycast={()=>null} receiveShadow><meshStandardMaterial color="#5d5f62" roughness={.95}/></mesh>
  {geo.walls&&<mesh geometry={geo.walls} raycast={()=>null} castShadow receiveShadow><meshStandardMaterial map={facade} vertexColors roughness={.7} metalness={.05}/></mesh>}
  {geo.roofs&&<mesh geometry={geo.roofs} raycast={()=>null} receiveShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh>}
  {geo.host&&<mesh geometry={geo.host} raycast={()=>null}><meshPhysicalMaterial color="#cfe0ea" transparent opacity={.16} roughness={.08} metalness={.2} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
  {data.trees?.length>0&&<Trees points={data.trees}/>}
 </group>;
}

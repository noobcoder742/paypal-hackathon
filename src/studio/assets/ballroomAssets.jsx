// Procedural, photo-guided banquet assets for the Grand Ballroom.
// Built entirely in three.js (no paid generation APIs, no downloaded models).
// Conventions follow the three-best-practices / r3f-best-practices skills:
//  - geometries and materials are created once and shared (memory-reuse-objects)
//  - repeated parts use InstancedMesh (geometry-instanced-mesh, draw-call-optimization)
//  - reflections come from a PMREM-filtered RoomEnvironment generated locally,
//    so metals, mirrors, crystal and satin get believable shine without HDR downloads.
import React,{useMemo,useEffect,useLayoutEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merge parts into one smooth-shaded geometry: keep only position + uv,
// weld duplicate vertices, then recompute normals.
function mergeSmooth(parts){
 const clean=parts.map(g=>{const n=(g.index?g.toNonIndexed():g.clone());for(const k of Object.keys(n.attributes))if(k!=='position'&&k!=='uv')n.deleteAttribute(k);if(!n.attributes.uv)n.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));return n});
 const merged=mergeVertices(mergeGeometries(clean),1e-4);
 merged.computeVertexNormals();
 return merged;
}

/* ---------- environment (free reflections) ---------- */
export function StudioEnvironment({intensity=1}){
 const {gl,scene}=useThree();
 useEffect(()=>{
  const pmrem=new THREE.PMREMGenerator(gl);
  const room=new RoomEnvironment();
  const target=pmrem.fromScene(room,.04);
  scene.environment=target.texture;
  scene.environmentIntensity=intensity;
  room.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()});
  return()=>{scene.environment=null;target.dispose();pmrem.dispose()};
 },[gl,scene]);
 useEffect(()=>{scene.environmentIntensity=intensity},[scene,intensity]);
 return null;
}

/* ---------- shared materials ---------- */
const materialCache=new Map();
function cached(key,make){if(!materialCache.has(key))materialCache.set(key,make());return materialCache.get(key)}
const lighten=(hex,amount)=>'#'+new THREE.Color(hex).lerp(new THREE.Color('#ffffff'),amount).getHexString();
// Satin banquet linen: soft base with a bright grazing sheen.
export const satinMaterial=color=>cached('satin'+color,()=>new THREE.MeshPhysicalMaterial({color,roughness:.62,sheen:1,sheenRoughness:.32,sheenColor:new THREE.Color(lighten(color,.55)),side:THREE.DoubleSide,envMapIntensity:.55}));
// Stretch chair covers: matte fabric with a weaker sheen.
export const coverMaterial=color=>cached('cover'+color,()=>new THREE.MeshPhysicalMaterial({color,roughness:.82,sheen:.7,sheenRoughness:.5,sheenColor:new THREE.Color(lighten(color,.4)),envMapIntensity:.4}));
export const sashMaterial=color=>cached('sash'+color,()=>new THREE.MeshPhysicalMaterial({color,roughness:.38,sheen:1,sheenRoughness:.22,sheenColor:new THREE.Color(lighten(color,.6)),side:THREE.DoubleSide,envMapIntensity:.8}));
const porcelain=()=>cached('porcelain',()=>new THREE.MeshPhysicalMaterial({color:'#fbf8f2',roughness:.18,clearcoat:.8,clearcoatRoughness:.1}));
const charger=()=>cached('charger',()=>new THREE.MeshStandardMaterial({color:'#bfa27a',metalness:.85,roughness:.32}));
const glassTop=()=>cached('lazysusan',()=>new THREE.MeshPhysicalMaterial({color:'#f6f2ea',roughness:.05,metalness:0,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.4}));
const leafMaterial=warm=>cached('leaf'+warm,()=>new THREE.MeshPhysicalMaterial({color:'#efebe4',metalness:.9,roughness:.2,emissive:warm?'#ffd9a0':'#fff3e2',emissiveIntensity:warm?.32:.14,side:THREE.DoubleSide,envMapIntensity:1.6}));
const crystalMaterial=warm=>cached('crystal'+warm,()=>new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.02,clearcoat:1,clearcoatRoughness:0,ior:2,reflectivity:1,emissive:warm?'#ffe2b0':'#fff7ea',emissiveIntensity:warm?.9:.45,envMapIntensity:2.4}));
const brushedNickel=()=>cached('nickel',()=>new THREE.MeshStandardMaterial({color:'#d9d6d0',metalness:1,roughness:.28}));
export const coveGlowMaterial=warm=>cached('cove'+warm,()=>new THREE.MeshStandardMaterial({color:warm?'#ffd9a3':'#fff4e3',emissive:warm?'#ffc275':'#fff0d8',emissiveIntensity:warm?1.6:.9,roughness:.6}));
export const pilasterGlowMaterial=warm=>cached('pilaster'+warm,()=>new THREE.MeshStandardMaterial({color:'#f3d9a8',emissive:warm?'#ffb862':'#ffe2b2',emissiveIntensity:warm?1.4:.75,roughness:.5}));
export const antiqueMirrorMaterial=()=>cached('mirror',()=>new THREE.MeshStandardMaterial({color:'#b9ad9c',metalness:1,roughness:.12,envMapIntensity:1.5}));

/* ---------- satin floor-length tablecloth ---------- */
// One draped surface: rounded table edge, irregular gravity folds that deepen
// toward the floor, and a slightly flared, rippled hem.
let clothGeometry=null;
export function getClothGeometry(){
 if(clothGeometry)return clothGeometry;
 const segments=160,rings=30,top=.815,edge=.92,verts=[],uv=[],index=[];
 const fold=a=>.05*Math.sin(a*13+.6)+.022*Math.sin(a*29+2.1)+.014*Math.sin(a*7+4)+.008*Math.sin(a*53);
 for(let j=0;j<=rings;j++){
  const t=j/rings;
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2;
   let r,y;
   if(t<.12){ // roll over the table edge
    const k=t/.12,ang=k*Math.PI/2;r=edge-.035+Math.sin(ang)*.035;y=top-.035+Math.cos(ang)*.035;
   }else{
    const d=(t-.12)/.88,ease=d*d*(3-2*d);
    r=edge+fold(a)*ease+.075*d*d*d+.006*Math.sin(a*90)*d;
    y=top-.035-d*(top-.045)+.018*Math.sin(a*13+.6)*d*d*d*d;
   }
   verts.push(Math.cos(a)*r,y,Math.sin(a)*r);uv.push(i/segments*6,t*2);
   if(j<rings&&i<segments){const k=j*(segments+1)+i;index.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2)}
  }
 }
 const drape=new THREE.BufferGeometry();
 drape.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 drape.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 drape.setIndex(index);
 const topDisc=new THREE.CircleGeometry(edge-.034,96);topDisc.rotateX(-Math.PI/2);topDisc.translate(0,top,0);
 clothGeometry=mergeSmooth([drape,topDisc]);
 return clothGeometry;
}

/* ---------- place settings + lazy susan (instanced per table) ---------- */
const plateGeo=new THREE.CylinderGeometry(.13,.1,.018,28);
const chargerGeo=new THREE.CylinderGeometry(.165,.165,.008,32);
const susanGeo=new THREE.CylinderGeometry(.46,.46,.02,48);
export function PlaceSettings({count}){
 const plates=useRef(),chargers=useRef();
 useLayoutEffect(()=>{
  const m=new THREE.Object3D();
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count;
   m.position.set(Math.sin(a)*.68,.832,Math.cos(a)*.68);m.updateMatrix();chargers.current.setMatrixAt(i,m.matrix);
   m.position.y=.846;m.updateMatrix();plates.current.setMatrixAt(i,m.matrix);
  }
  plates.current.instanceMatrix.needsUpdate=true;chargers.current.instanceMatrix.needsUpdate=true;
 },[count]);
 return <group>
  <instancedMesh ref={chargers} args={[chargerGeo,charger(),count]} raycast={()=>null}/>
  <instancedMesh ref={plates} args={[plateGeo,porcelain(),count]} raycast={()=>null} castShadow/>
  <mesh geometry={susanGeo} material={glassTop()} position={[0,.835,0]} raycast={()=>null}/>
 </group>;
}

/* ---------- covered banquet chair ---------- */
// Fitted cover (rounded seat + slightly curved back) and a box-pleated skirt to the floor.
// Front of the chair faces local -Z; the back (and sash) sits at +Z.
let chairGeometries=null;
function pleatedSkirt(){
 const w=.54,d=.54,topY=.47,bottomY=.015,cols=160,rows=6,verts=[],uv=[],index=[];
 const perimeter=2*(w+d);
 const pointAt=s=>{ // walk the rectangle perimeter
  let u=s*perimeter;
  if(u<w)return[-w/2+u,-d/2,0,-1];u-=w;
  if(u<d)return[w/2,-d/2+u,1,0];u-=d;
  if(u<w)return[w/2-u,d/2,0,1];u-=w;
  return[-w/2,d/2-u,-1,0];
 };
 for(let j=0;j<=rows;j++){
  const t=j/rows;
  for(let i=0;i<=cols;i++){
   const s=i/cols,[x,z,nx,nz]=pointAt(s);
   const pleat=.012*Math.abs(Math.sin(s*Math.PI*28))*t+.025*t*t;
   verts.push(x+nx*pleat,topY-(topY-bottomY)*t,z+nz*pleat);uv.push(s*4,t);
   if(j<rows&&i<cols){const k=j*(cols+1)+i;index.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1)}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);
 return g.toNonIndexed();
}
function curvedBack(){
 const g=new RoundedBoxGeometry(.5,.66,.09,4,.04);
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+x*x*.35-(y+.33)*.07);if(y>.2)p.setX(i,x*(1-(y-.2)*.25))}
 g.translate(0,.98,.25);
 return g;
}
function bow(){
 const loops=[-1,1].map(side=>{const t=new THREE.TorusGeometry(.065,.022,8,18);t.scale(1,.62,.5);t.rotateZ(side*.35);t.translate(side*.07,0,0);return t.toNonIndexed()});
 const knot=new THREE.SphereGeometry(.03,10,8);knot.scale(1,.9,.7);
 const tails=[-1,1].map(side=>{const t=new THREE.PlaneGeometry(.05,.34,1,6);const p=t.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setZ(i,Math.sin((y+.17)*9)*.012)}t.rotateZ(side*.12);t.translate(side*.04,-.19,0);return t.toNonIndexed()});
 const band=new THREE.BoxGeometry(.54,.05,.012);band.translate(0,0,-.012);
 const g=mergeSmooth([...loops,knot,...tails,band]);
 g.translate(0,.74,.352);
 return g;
}
export function getChairGeometries(){
 if(chairGeometries)return chairGeometries;
 const seat=new RoundedBoxGeometry(.54,.11,.54,4,.045);seat.translate(0,.47,0);
 const cover=mergeSmooth([seat,curvedBack(),pleatedSkirt()]);
 chairGeometries={cover,sash:bow()};
 return chairGeometries;
}

/* ---------- leaf-crystal chandelier ---------- */
// The ballroom chandeliers read as an open bouquet of silvered leaves with
// crystal drops underneath. One leaf mesh and one crystal mesh per chandelier.
let leafGeo=null,dropGeo=null;
function getLeafGeometry(){
 if(leafGeo)return leafGeo;
 const L=.62,shape=new THREE.Shape();
 shape.moveTo(0,0);
 const steps=14;
 for(let i=1;i<=steps;i++){const t=i/steps,w=Math.sin(t*Math.PI)*.075*(1-t*.35)+(i%2?.012:0)*Math.sin(t*Math.PI);shape.lineTo(w,t*L)}
 for(let i=steps-1;i>=0;i--){const t=i/steps,w=Math.sin(t*Math.PI)*.075*(1-t*.35)+(i%2?.012:0)*Math.sin(t*Math.PI);shape.lineTo(-w,t*L)}
 const g=new THREE.ShapeGeometry(shape,3);
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)/L;p.setZ(i,y*y*.2-Math.abs(x)*.25)} // curl outward, fold along midrib
 g.computeVertexNormals();
 return leafGeo=g;
}
function getDropGeometry(){if(!dropGeo){dropGeo=new THREE.OctahedronGeometry(.035,0);dropGeo.scale(1,1.9,1)}return dropGeo}
function rand(seed){const v=Math.sin(seed*91.17+7.31)*43758.5453;return v-Math.floor(v)}
const CHANDELIER_RINGS=[[10,.08,.15],[14,.22,.32],[18,.38,.52],[22,.55,.72],[26,.72,.92],[28,.88,1.12]];
const LEAF_COUNT=CHANDELIER_RINGS.reduce((s,r)=>s+r[0],0),DROP_COUNT=56;
export function LeafChandelier({x,z,y=6.15,warm=true,seed=1}){
 const leaves=useRef(),drops=useRef();
 useLayoutEffect(()=>{
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),qa=new THREE.Quaternion(),qt=new THREE.Quaternion(),qr=new THREE.Quaternion();
  const up=new THREE.Vector3(0,1,0),zAxis=new THREE.Vector3(0,0,1),pos=new THREE.Vector3(),scale=new THREE.Vector3();
  let n=0;
  CHANDELIER_RINGS.forEach(([count,radius,tilt],ring)=>{
   for(let i=0;i<count;i++){
    const r=rand(seed*1000+n),az=(i+ring*.5)/count*Math.PI*2+r*.2;
    qa.setFromAxisAngle(up,az);qt.setFromAxisAngle(zAxis,-(tilt+r*.18));qr.setFromAxisAngle(up,(r-.5)*.8);
    q.copy(qa).multiply(qt).multiply(qr);
    pos.set(radius,-.05-ring*.075+r*.06,0).applyQuaternion(qa);
    const s=.75+ring*.09+r*.2;scale.set(s,s,s);
    m.compose(pos,q,scale);leaves.current.setMatrixAt(n++,m);
   }
  });
  for(let i=0;i<DROP_COUNT;i++){
   const r=rand(seed*77+i),az=i*2.399,rad=Math.sqrt(i/DROP_COUNT)*.95;
   pos.set(Math.cos(az)*rad,-.12-r*.42-(1-rad)*.18,Math.sin(az)*rad);q.identity();scale.set(1,1,1);
   m.compose(pos,q,scale);drops.current.setMatrixAt(i,m);
  }
  leaves.current.instanceMatrix.needsUpdate=true;drops.current.instanceMatrix.needsUpdate=true;
  leaves.current.computeBoundingSphere();drops.current.computeBoundingSphere();
 },[seed]);
 return <group position={[x,y,z]}>
  <mesh position={[0,.98,0]} material={brushedNickel()}><cylinderGeometry args={[.025,.025,1.9,8]}/></mesh>
  <mesh position={[0,1.92,0]} material={brushedNickel()}><cylinderGeometry args={[.22,.16,.08,24]}/></mesh>
  <mesh position={[0,-.02,0]} material={brushedNickel()}><sphereGeometry args={[.12,16,12]}/></mesh>
  <instancedMesh ref={leaves} args={[getLeafGeometry(),leafMaterial(warm),LEAF_COUNT]} castShadow/>
  <instancedMesh ref={drops} args={[getDropGeometry(),crystalMaterial(warm),DROP_COUNT]}/>
  <pointLight intensity={warm?1.4:.6} color={warm?'#ffdcaa':'#fff6ea'} distance={7} decay={1.6}/>
 </group>;
}

/* ---------- lattice screen texture (dark bronze with gold fretwork) ---------- */
let latticeTextures=null;
export function getLatticeTextures(){
 if(latticeTextures)return latticeTextures;
 const size=512,c=document.createElement('canvas');c.width=c.height=size;
 const g=c.getContext('2d');
 g.fillStyle='#231d19';g.fillRect(0,0,size,size);
 g.strokeStyle='#b8955c';g.lineWidth=5;g.lineJoin='round';
 const cell=size/4;
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const cx=i*cell+cell/2,cy=j*cell+cell/2,r=cell*.42;
  g.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8;g[k?'lineTo':'moveTo'](cx+Math.cos(a)*r,cy+Math.sin(a)*r)}g.closePath();g.stroke();
  g.beginPath();g.moveTo(cx-r*.5,cy);g.lineTo(cx,cy-r*.5);g.lineTo(cx+r*.5,cy);g.lineTo(cx,cy+r*.5);g.closePath();g.stroke();
 }
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
 // Gold lines are metallic and smoother; the dark ground is satin lacquer.
 const rc=document.createElement('canvas');rc.width=rc.height=size;const rg=rc.getContext('2d');rg.drawImage(c,0,0);
 const img=rg.getImageData(0,0,size,size);
 for(let i=0;i<img.data.length;i+=4){const gold=img.data[i]>120;const v=gold?255:40;img.data[i]=img.data[i+1]=img.data[i+2]=v}
 rg.putImageData(img,0,0);
 const metal=new THREE.CanvasTexture(rc);metal.wrapS=metal.wrapT=THREE.RepeatWrapping;
 latticeTextures={map,metal};
 return latticeTextures;
}
export function latticeMaterial(repeatX,repeatY){
 return cached('lattice'+repeatX+'x'+repeatY,()=>{
  const {map,metal}=getLatticeTextures();
  const m=map.clone(),mm=metal.clone();m.repeat.set(repeatX,repeatY);mm.repeat.set(repeatX,repeatY);m.needsUpdate=mm.needsUpdate=true;
  return new THREE.MeshStandardMaterial({map:m,metalnessMap:mm,metalness:1,roughness:.42,envMapIntensity:1.2});
 });
}

// Draggable decor (arch, hedges, flower stands, lanterns, flower wall) and the carpet,
// which the couple lays by dragging across the floor with the carpet tool.
import React,{useMemo,useRef,useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBox} from '@react-three/drei';
import {FloralArch,Centrepiece} from '../florals/Florals.jsx';
import {Ensemble} from './Musicians.jsx';
import {ensembleFootprint} from './ensembles.js';
import {beginDrag,dragTo} from '../floorDrag.js';
import {assemble,hedgeItems,flowerWallItems} from '../florals/floralGeometry.js';
import {DECOR_TYPES,CARPET_COLOURS,ROOM_BOUNDS,TILE,tileAt,carpetLine,paintTiles,updateDecor} from './decor.js';

const cache=new Map();const cached=(k,f)=>{if(!cache.has(k))cache.set(k,f());return cache.get(k)};
const leafMat=cached('leaf',()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,side:THREE.DoubleSide}));
const petalMat=cached('petal',()=>new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.62,sheen:1,sheenRoughness:.45,side:THREE.DoubleSide}));
const goldMat=cached('gold',()=>new THREE.MeshStandardMaterial({color:'#c9a96a',metalness:.85,roughness:.3}));
const planterMat=cached('planter',()=>new THREE.MeshStandardMaterial({color:'#f1ede6',roughness:.7}));
const hedgeCoreMat=cached('hedgeCore',()=>new THREE.MeshStandardMaterial({color:'#3f5a37',roughness:.95}));

function Hedge(){
 const geo=cached('hedge',()=>assemble(hedgeItems()));
 return <group>
  <RoundedBox args={[1.2,.36,.5]} radius={.03} position={[0,.18,0]} material={planterMat} castShadow receiveShadow/>
  <group position={[0,.36,0]}>
   <RoundedBox args={[1.08,.52,.4]} radius={.12} position={[0,.27,0]} material={hedgeCoreMat}/>
   <mesh geometry={geo.leaves} material={leafMat}/>
  </group>
 </group>;
}
function FlowerStand({variant}){
 return <group>
  <mesh material={goldMat} position={[0,.01,0]} castShadow><cylinderGeometry args={[.2,.22,.02,24]}/></mesh>
  <mesh material={goldMat} position={[0,.5,0]} castShadow><cylinderGeometry args={[.018,.026,1,10]}/></mesh>
  <mesh material={goldMat} position={[0,1,0]}><cylinderGeometry args={[.13,.06,.06,20]}/></mesh>
  <group position={[0,.12,0]} scale={.85}><Centrepiece variant={variant}/></group>
 </group>;
}
function Lantern(){
 const flame=useMemo(()=>new THREE.MeshStandardMaterial({color:'#ffd9a0',emissive:'#ffb653',emissiveIntensity:2.2}),[]);
 const glass=useMemo(()=>new THREE.MeshPhysicalMaterial({color:'#ffffff',transmission:.9,roughness:.05,transparent:true,opacity:.25}),[]);
 const frame=useMemo(()=>new THREE.MeshStandardMaterial({color:'#2b2622',metalness:.6,roughness:.4}),[]);
 const h=.62,w=.26;
 return <group>
  <mesh material={frame} position={[0,.015,0]} castShadow><boxGeometry args={[w+.04,.03,w+.04]}/></mesh>
  {[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=><mesh key={a+','+b} material={frame} position={[a*w/2,h/2,b*w/2]} castShadow><boxGeometry args={[.018,h,.018]}/></mesh>)}
  <mesh material={frame} position={[0,h,0]} castShadow><coneGeometry args={[w*.78,.12,4,1]}/></mesh>
  <mesh material={frame} position={[0,h+.1,0]}><torusGeometry args={[.04,.008,6,16]}/></mesh>
  <mesh material={glass} position={[0,h/2,0]}><boxGeometry args={[w-.01,h-.04,w-.01]}/></mesh>
  <mesh position={[0,.12,0]}><cylinderGeometry args={[.045,.045,.18,16]}/><meshStandardMaterial color="#f6efe2" roughness={.8}/></mesh>
  <mesh material={flame} position={[0,.24,0]}><sphereGeometry args={[.016,10,8]}/></mesh>
 </group>;
}
function FlowerWall({variant}){
 const geo=cached('wall-'+variant,()=>assemble(flowerWallItems(variant)));
 return <group>
  <mesh position={[0,1.2,-.02]} castShadow receiveShadow><boxGeometry args={[2.5,2.5,.06]}/><meshStandardMaterial color="#efe9df" roughness={.9}/></mesh>
  <mesh material={goldMat} position={[0,.03,0]}><boxGeometry args={[2.6,.06,.4]}/></mesh>
  <group position={[0,.05,.02]}>{geo.flowers&&<mesh geometry={geo.flowers} material={petalMat} castShadow/>}{geo.leaves&&<mesh geometry={geo.leaves} material={leafMat}/>}</group>
 </group>;
}
const MODELS={arch:({variant})=><FloralArch variant={variant} position={[0,0,0]}/>,hedge:Hedge,flowerStand:FlowerStand,lantern:Lantern,flowerWall:FlowerWall,ensemble:({item})=><Ensemble genre={item.genre} lineup={item.lineup}/>};

/** One decor item, dragged across the floor like a table. */
function Draggable({item,selected,onSelect,update,onDragStart,onDragEnd,controlsRef,tool,variant}){
 const drag=useRef(false),plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),0),[]),hit=useMemo(()=>new THREE.Vector3(),[]);
 const [w,d]=item.type==='ensemble'?ensembleFootprint(item.genre,item.lineup):DECOR_TYPES[item.type].footprint;const Model=MODELS[item.type];
 return <group position={[item.x,0,item.z]} rotation={[0,item.rotation||0,0]}
  onPointerOver={e=>{e.stopPropagation();document.body.style.cursor=tool==='select'?'grab':'auto'}}
  onPointerOut={()=>{document.body.style.cursor='auto'}}
  onPointerDown={e=>{if(tool!=='select'||e.shiftKey)return;e.stopPropagation();onSelect({type:'decor',id:item.id});if(e.button!==0||!e.ray.intersectPlane(plane,hit))return;drag.current=beginDrag({itemX:item.x,itemZ:item.z,hitX:hit.x,hitZ:hit.z,screenX:e.clientX,screenY:e.clientY});onDragStart();if(controlsRef.current)controlsRef.current.enabled=false;e.target.setPointerCapture?.(e.pointerId)}}
  onPointerMove={e=>{if(!drag.current)return;e.stopPropagation();if(e.ray.intersectPlane(plane,hit)){const p=dragTo(drag.current,{hitX:hit.x,hitZ:hit.z,screenX:e.clientX,screenY:e.clientY});if(p)update(s=>updateDecor(s,item.id,p))}}}
  onPointerUp={e=>{if(!drag.current)return;drag.current=null;if(controlsRef.current)controlsRef.current.enabled=true;onDragEnd();if(e.target.hasPointerCapture?.(e.pointerId))e.target.releasePointerCapture(e.pointerId)}}>
  {/* an invisible footprint box makes thin items (arch, stands) easy to grab */}
  <mesh userData={{editable:'decor-'+item.id}} position={[0,.6,0]}><boxGeometry args={[w,1.2,Math.max(d,.5)]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  <Model variant={variant} item={item}/>
  {selected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><ringGeometry args={[Math.max(w,d)/2+.15,Math.max(w,d)/2+.24,48]}/><meshBasicMaterial color="#c9a96a"/></mesh>}
 </group>;
}

// Soft woven texture: fine noise, no gloss, so the carpet reads as fabric.
const fabricTexture=cached('fabric',()=>{
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const img=g.createImageData(128,128);
 for(let i=0;i<128*128;i++){const x=i%128,y=(i/128)|0;const weave=((x>>1)+(y>>1))%2?6:-6;const n=232+weave+(Math.random()*16-8);img.data.set([n,n,n,255],i*4)}
 g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.colorSpace=THREE.SRGBColorSpace;return t});
function CarpetTiles({carpet}){
 const ref=useRef();const tiles=carpet?.tiles||[];
 const mat=useMemo(()=>new THREE.MeshStandardMaterial({color:CARPET_COLOURS[carpet?.color]||CARPET_COLOURS.red,map:fabricTexture,roughness:1,metalness:0,envMapIntensity:0}),[carpet?.color]);
 const geo=useMemo(()=>new THREE.BoxGeometry(TILE,.01,TILE),[]);
 const m=useMemo(()=>new THREE.Matrix4(),[]);
 React.useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;tiles.forEach(([i,j],k)=>{m.makeTranslation((i+.5)*TILE,.022,(j+.5)*TILE)/* just above the ballroom carpet (y .015) */;mesh.setMatrixAt(k,m)});mesh.count=tiles.length;mesh.instanceMatrix.needsUpdate=true},[tiles,m]);
 return <instancedMesh key={Math.ceil((tiles.length+1)/200)} ref={ref} args={[geo,mat,Math.max(200,Math.ceil((tiles.length+1)/200)*200)]} frustumCulled={false} receiveShadow/>;
}
/** With the carpet tool, dragging across the floor lays tiles; starting on a tile removes them instead.
 * Listens on the window (capture phase), so tables and the camera controls never take the drag. */
function CarpetPainter({data,update,controlsRef,onDragStart,onDragEnd}){
 const {camera,gl}=useThree();const tilesRef=useRef(data.carpet?.tiles||[]);tilesRef.current=data.carpet?.tiles||[];
 // callbacks change every render; keep the latest in a ref so the listeners survive a drag
 const cb=useRef({});cb.current={update,controlsRef,onDragStart,onDragEnd};
 useEffect(()=>{
  const el=gl.domElement,floor=new THREE.Plane(new THREE.Vector3(0,1,0),0),ray=new THREE.Raycaster(),hit=new THREE.Vector3(),ndc=new THREE.Vector2();
  let st=null;
  const cellAt=e=>{const r=el.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(floor,hit)?tileAt(hit.x,hit.z):null};
  const down=e=>{if(e.target!==el||e.button!==0)return;const c=cellAt(e);if(!c)return;e.stopPropagation();e.preventDefault();
   const mode=tilesRef.current.some(t=>t[0]===c[0]&&t[1]===c[1])?'remove':'add';st={last:c,mode};const {update,controlsRef,onDragStart}=cb.current;onDragStart();if(controlsRef.current)controlsRef.current.enabled=false;update(s=>paintTiles(s,[c],mode))};
  const move=e=>{if(!st)return;e.stopPropagation();const c=cellAt(e);if(!c||(c[0]===st.last[0]&&c[1]===st.last[1]))return;const line=carpetLine(st.last,c);st.last=c;const mode=st.mode;cb.current.update(s=>paintTiles(s,line,mode))};
  const up=e=>{if(!st)return;e.stopPropagation();st=null;const {controlsRef,onDragEnd}=cb.current;if(controlsRef.current)controlsRef.current.enabled=true;onDragEnd()};
  window.addEventListener('pointerdown',down,true);window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);
  el.style.cursor='crosshair';
  return()=>{window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);el.style.cursor='';if(st){st=null;const {controlsRef,onDragEnd}=cb.current;if(controlsRef.current)controlsRef.current.enabled=true;onDragEnd()}};
 },[camera,gl]);
 return null;
}
/** Dev only: lets browser tests turn room coordinates into screen positions. */
function DevProbe(){const {camera,gl}=useThree();useEffect(()=>{if(!import.meta.env?.DEV)return;window.__studioToScreen=(x,y,z)=>{const v=new THREE.Vector3(x,y,z).project(camera),r=gl.domElement.getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]};return()=>{delete window.__studioToScreen}},[camera,gl]);return null}
export function DecorLayer({data,update,selected,setSelected,tool,controlsRef,onDragStart,onDragEnd}){
 return <group>
  <CarpetTiles carpet={data.carpet}/><DevProbe/>
  {tool==='carpet'&&<CarpetPainter data={data} update={update} controlsRef={controlsRef} onDragStart={onDragStart} onDragEnd={onDragEnd}/>}
  {(data.decor||[]).map(it=><Draggable key={it.id} item={it} selected={selected?.type==='decor'&&selected.id===it.id} onSelect={setSelected} update={update} onDragStart={onDragStart} onDragEnd={onDragEnd} controlsRef={controlsRef} tool={tool} variant={data.flowers}/>)}
 </group>;
}

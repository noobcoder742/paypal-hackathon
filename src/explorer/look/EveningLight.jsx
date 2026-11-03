// Lighting for the venue map at 6:20pm in Singapore: low, warm sunlight from
// its real direction (look/sun.js), a soft blue sky fill so shadows are never
// black, a dusk sky gradient and haze. The sun's shadow camera follows the
// point the map is looking at, sized to the zoom so nearby shadows stay crisp.
import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';

export const SKY={top:'#a9bcd3',mid:'#d9d3cf',horizon:'#efd9c3'};

function skyTexture(){
 const c=document.createElement('canvas');c.width=4;c.height=256;const g=c.getContext('2d');
 const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,SKY.top);grad.addColorStop(.6,SKY.mid);grad.addColorStop(1,SKY.horizon);
 g.fillStyle=grad;g.fillRect(0,0,4,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export function EveningLight({sun,rigRef}){
 const {scene}=useThree();
 const light=useRef(),target=useMemo(()=>new THREE.Object3D(),[]);
 const sunColour=useMemo(()=>{
  // the lower the sun, the more orange its light (6.5° in November, ~11° in June)
  const k=THREE.MathUtils.clamp((sun.elevation-3)/12,0,1);
  return new THREE.Color('#ff9a52').lerp(new THREE.Color('#ffd2a1'),k);
 },[sun.elevation]);
 useEffect(()=>{
  const tex=skyTexture(),prev=scene.background;scene.background=tex;
  scene.add(target);
  return()=>{scene.background=prev;tex.dispose();scene.remove(target)};
 },[scene,target]);
 useEffect(()=>{
  const l=light.current;if(!l)return;
  l.target=target;l.shadow.mapSize.set(2048,2048);l.shadow.bias=-.0004;l.shadow.normalBias=.8;
  l.shadow.camera.near=10;l.shadow.camera.far=9000;
 },[target]);
 useFrame(()=>{
  const l=light.current;if(!l)return;const {cur}=rigRef.current;
  const D=4000,half=THREE.MathUtils.clamp(cur.r*1.15,160,2600);
  target.position.set(cur.tx,0,cur.tz);
  l.position.set(cur.tx+sun.x*D,sun.y*D,cur.tz+sun.z*D);
  const cam=l.shadow.camera;
  if(cam.right!==half){cam.left=-half;cam.right=half;cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix()}
 });
 return <>
  <hemisphereLight args={['#b7c6e0','#cbb497',1.35]}/>
  <ambientLight intensity={.12} color="#ffeadb"/>
  <directionalLight ref={light} color={sunColour} intensity={5.2} castShadow/>
 </>;
}

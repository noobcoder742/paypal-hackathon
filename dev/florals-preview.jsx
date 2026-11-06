// Dev-only preview of the procedural florals (open /dev/florals.html?view=arch|bouquet&v=white|pink|green).
import React from 'react';import {createRoot} from 'react-dom/client';
import {Canvas} from '@react-three/fiber';import {OrbitControls} from '@react-three/drei';
import {Centrepiece,FloralArch} from '../src/studio/florals/Florals.jsx';
import {assemble} from '../src/studio/florals/floralGeometry.js';
import * as THREE from 'three';
import {Ensemble} from '../src/studio/decor/Musicians.jsx';
const q=new URLSearchParams(location.search),view=q.get('view')||'arch',v=q.get('v')||'white',thumb=q.has('thumb');
const genre=q.get('genre')||'classical',lineup=q.get('lineup')?JSON.parse(q.get('lineup')):undefined;
const cam=view==='band'?{position:[0,3.2,7.2],fov:42}:view==='arch'?{position:[1.2,2.2,6.2],fov:45}:view==='rose'?{position:[0,.3,.34],fov:35}:{position:[0,1.45,.95],fov:40};
const target=view==='band'?[0,.9,0]:view==='arch'?[0,2,0]:view==='rose'?[0,.1,0]:[0,1.18,0];
const roseGeo=assemble([{kind:'rose',position:[-.05,.1,0],dir:[0,1,.5],scale:1.6,color:'#f4efe6'},{kind:'rose',position:[.05,.1,0],dir:[0,1,.5],scale:1.6,color:'#e8b6bd'},{kind:'hydrangea',position:[0,.06,-.08],dir:[0,1,.3],scale:1.2,color:'#eef0e8'},{kind:'leaf',position:[0,.05,.03],dir:[.3,.2,1],scale:1.2,color:'#6d8a63'}],'hi');
const pm=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.62,sheen:1,sheenRoughness:.45,side:THREE.DoubleSide});
function App(){return <Canvas shadows dpr={1} camera={cam} gl={{preserveDrawingBuffer:true,alpha:true}} onCreated={()=>{window.__ready=true}}>
 {!thumb&&<color attach="background" args={['#ece6dc']}/>}
 <hemisphereLight args={['#fff8ef','#9d8f80',.9]}/><directionalLight position={[3,6,4]} intensity={2.2} castShadow shadow-mapSize={[2048,2048]}/>
 {!thumb&&<mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[20,20]}/><meshStandardMaterial color="#d8cfc2"/></mesh>}
 {view==='band'?<Ensemble genre={genre} lineup={lineup}/>:view==='rose'?<><mesh geometry={roseGeo.flowers} material={pm} castShadow/><mesh geometry={roseGeo.leaves} material={pm}/></>:view==='arch'?<FloralArch variant={v} position={[0,0,0]}/>:<>{!thumb&&<mesh position={[0,.47,0]} receiveShadow castShadow><cylinderGeometry args={[.9,.9,.94,48]}/><meshStandardMaterial color="#f5f1ea"/></mesh>}<Centrepiece variant={v}/></>}
 <OrbitControls target={target}/>
</Canvas>}
createRoot(document.getElementById('root')).render(<App/>);

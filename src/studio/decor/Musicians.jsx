// 3D musicians for the studio: jointed figures in concert dress playing their
// instruments, posed seated (classical) or standing (jazz, pop, double bass,
// singers), with a gentle playing motion. All geometry is procedural and shared.
import React,{useMemo,useRef} from 'react';
import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';
import {ensembleLayout,GENRES} from './ensembles.js';

const geo={},mat={};
const G=(k,f)=>geo[k]||(geo[k]=f());
const M=(k,f)=>mat[k]||(mat[k]=f());
const std=(color,roughness=.7,metalness=0)=>M(color+roughness+metalness,()=>new THREE.MeshStandardMaterial({color,roughness,metalness}));
const WOOD=()=>std('#7a3a1c',.38),DARKWOOD=()=>std('#3b1d10',.45),BLACK=()=>std('#151515',.5),GLOSS=()=>std('#0d0d0f',.18,.1),BRASS=()=>std('#c8a24a',.28,.9),CHROME=()=>std('#d8d8dc',.2,.95),WHITE=()=>std('#f4f1ea',.6);

// ---------- figure ----------
const SKIN=['#f1c9a8','#d9a47e','#a8724e','#6f4630','#e8b896'];
const HAIR=['#1d1612','#3a2618','#6b4a2b','#151515','#8a6a4a'];
function outfitFor(genre,i,instrument){
 const woman=i%2===1||instrument==='harp'||(instrument==='vocals'&&i%3!==2);
 if(genre==='classical')return {woman,top:woman?'#141416':'#111113',bottom:woman?'#141416':'#111113',shirt:'#f3f1ec',tie:!woman};
 if(genre==='jazz')return {woman,top:woman?(instrument==='vocals'?'#8e1f2a':'#1b1b1f'):['#1b1d24','#2a2321','#14161c'][i%3],bottom:woman?(instrument==='vocals'?'#8e1f2a':'#1b1b1f'):'#141418',shirt:'#ece8df',tie:!woman};
 return {woman,top:['#d9d2c6','#2d3e5c','#7a2433','#1a1a1a','#c8a45a'][i%5],bottom:['#1a1a1d','#30343c','#1d2433'][i%3],shirt:null,tie:false};
}
const capsule=(r,len)=>G('cap'+r+len,()=>new THREE.CapsuleGeometry(r,len,6,12));
const torsoGeo=woman=>G('torso'+woman,()=>{const pts=woman?[[.13,0],[.15,.06],[.13,.2],[.155,.36],[.16,.44],[.09,.52]]:[[.15,0],[.16,.08],[.165,.24],[.19,.4],[.19,.46],[.1,.53]];const g=new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),20);g.scale(1,1,.62);return g});
const gownGeo=(len,flare)=>G('gown'+len+flare,()=>{const g=new THREE.LatheGeometry([[.13,len],[.16,len*.8],[.22*flare,len*.35],[.3*flare,0],[.0,0]].map(([x,y])=>new THREE.Vector2(x,y)),24);g.scale(1,1,.8);return g});

/** Arm: a shoulder pivot with upper arm, elbow pivot, forearm and hand. Angles: [forward(-)/back, out, elbow]. */
function Arm({side,pose,colour,skin,armRef}){
 const sh=useRef(),el=useRef();
 if(armRef)armRef.current={sh,el,pose};
 return <group ref={sh} position={[side*.2,0,0]} rotation={[pose[0],0,side*pose[1]]}>
  <mesh geometry={capsule(.048,.22)} material={std(colour,.75)} position={[0,-.14,0]}/>
  <group ref={el} position={[0,-.29,0]} rotation={[pose[2],0,0]}>
   <mesh geometry={capsule(.04,.2)} material={std(colour,.75)} position={[0,-.13,0]}/>
   <mesh geometry={G('hand',()=>new THREE.SphereGeometry(.045,10,8))} material={std(skin,.6)} position={[0,-.28,0]} scale={[.8,1.1,.6]}/>
  </group>
 </group>;
}
/** A person, facing +z. seated: hips at seat height on a chair. */
function Figure({seated,outfit,skin,hair,armsPose,armRefs,stool=false}){
 const hipY=seated?(stool?.66:.5):.95,shoulderY=hipY+.47;
 const legM=std(outfit.bottom,.8),shoe=BLACK();
 return <group>
  {/* legs */}
  {seated?[-1,1].map(s=><group key={s}>
    <mesh geometry={capsule(.07,.34)} material={legM} position={[s*.1,hipY,.2]} rotation={[Math.PI/2,0,0]}/>
    <mesh geometry={capsule(.06,hipY-.12)} material={legM} position={[s*.1,(hipY-.04)/2,.42]}/>
    <mesh material={shoe} position={[s*.1,.03,.47]}><boxGeometry args={[.09,.06,.22]}/></mesh>
   </group>)
   :outfit.woman&&outfit.shirt!==null?<mesh geometry={gownGeo(hipY,1)} material={std(outfit.bottom,.65)}/>
   :[-1,1].map(s=><group key={s}><mesh geometry={capsule(.07,hipY-.16)} material={legM} position={[s*.1,hipY/2+.02,0]}/><mesh material={shoe} position={[s*.1,.03,.05]}><boxGeometry args={[.1,.06,.24]}/></mesh></group>)}
  {seated&&outfit.woman&&outfit.shirt!==null&&<mesh material={std(outfit.bottom,.65)} position={[0,hipY-.02,.22]}><boxGeometry args={[.36,.1,.5]}/></mesh>}
  {seated&&outfit.woman&&outfit.shirt!==null&&<mesh geometry={gownGeo(hipY-.05,1.1)} material={std(outfit.bottom,.65)} position={[0,0,.44]}/>}
  {/* torso */}
  <mesh geometry={torsoGeo(outfit.woman)} material={std(outfit.top,.72)} position={[0,hipY,0]}/>
  {outfit.shirt&&!outfit.woman&&<mesh material={std(outfit.shirt,.6)} position={[0,shoulderY-.14,.1]} rotation={[-.12,0,0]}><planeGeometry args={[.11,.24]}/></mesh>}
  {outfit.tie&&<mesh material={BLACK()} position={[0,shoulderY-.04,.115]}><boxGeometry args={[.09,.035,.02]}/></mesh>}
  {/* neck and head */}
  <mesh geometry={capsule(.045,.06)} material={std(skin,.6)} position={[0,shoulderY+.07,0]}/>
  <group position={[0,shoulderY+.21,0]}>
   <mesh geometry={G('head',()=>new THREE.SphereGeometry(.105,20,16))} material={std(skin,.55)} scale={[.92,1.12,1]}/>
   <mesh geometry={G('hair',()=>new THREE.SphereGeometry(.112,20,12,0,Math.PI*2,0,Math.PI*.55))} material={std(hair,.8)} position={[0,.02,-.012]} scale={[.95,1.12,1.04]}/>
   {outfit.woman&&<mesh geometry={capsule(.07,.16)} material={std(hair,.8)} position={[0,-.08,-.07]}/>}
  </group>
  {/* arms */}
  <group position={[0,shoulderY-.02,0]}>
   <Arm side={1} pose={armsPose.L} colour={outfit.woman&&!outfit.shirt?skin:outfit.top} skin={skin} armRef={armRefs?.L}/>
   <Arm side={-1} pose={armsPose.R} colour={outfit.woman&&!outfit.shirt?skin:outfit.top} skin={skin} armRef={armRefs?.R}/>
  </group>
 </group>;
}

// ---------- instruments ----------
/** Violin-family body outline (a figure-of-eight with waist), length L. */
const bodyGeo=(L,depth)=>G('vbody'+L,()=>{const w=L*.58,s=new THREE.Shape();
 s.moveTo(0,0);s.bezierCurveTo(w*.62,0,w*.62,L*.32,w*.36,L*.42);s.bezierCurveTo(w*.28,L*.5,w*.28,L*.55,w*.36,L*.6);s.bezierCurveTo(w*.56,L*.72,w*.5,L,0,L);
 s.bezierCurveTo(-w*.5,L,-w*.56,L*.72,-w*.36,L*.6);s.bezierCurveTo(-w*.28,L*.55,-w*.28,L*.5,-w*.36,L*.42);s.bezierCurveTo(-w*.62,L*.32,-w*.62,0,0,0);
 const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:depth*.25,bevelSize:L*.012,bevelSegments:2,curveSegments:10});g.translate(0,0,-depth/2);return g});
function StringInstrument({L,neck,bow=true}){
 const depth=L*.12;
 return <group>
  <mesh geometry={bodyGeo(L,depth)} material={WOOD()} castShadow/>
  <mesh material={BLACK()} position={[0,L+neck/2,depth*.35]}><boxGeometry args={[L*.07,neck,L*.05]}/></mesh>
  <mesh material={DARKWOOD()} position={[0,L+neck+L*.05,depth*.3]}><sphereGeometry args={[L*.045,10,8]}/></mesh>
  <mesh material={BLACK()} position={[0,L*.25,depth*.62]}><boxGeometry args={[L*.12,L*.03,L*.02]}/></mesh>
  {[-1,1].map(s=><mesh key={s} material={BLACK()} position={[s*L*.15,L*.45,depth*.6]}><boxGeometry args={[L*.015,L*.12,.004]}/></mesh>)}
 </group>;
}
const Bow=({len})=><group><mesh material={DARKWOOD()} position={[0,len/2,0]}><cylinderGeometry args={[.004,.005,len,6]}/></mesh><mesh material={WHITE()} position={[0,len/2,.012]}><boxGeometry args={[.006,len*.95,.003]}/></mesh></group>;
function GrandPiano(){
 const shape=G('pianoShape',()=>{const s=new THREE.Shape();s.moveTo(-.74,0);s.lineTo(.74,0);s.lineTo(.74,.55);s.bezierCurveTo(.74,1.2,.2,1.1,.05,1.5);s.bezierCurveTo(-.15,1.85,-.74,1.9,-.74,1.75);s.lineTo(-.74,0);return s});
 const body=G('pianoBody',()=>{const g=new THREE.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:1,curveSegments:20});g.rotateX(Math.PI/2);g.translate(0,1.0,0);return g});
 const lid=G('pianoLid',()=>{const g=new THREE.ExtrudeGeometry(shape,{depth:.02,bevelEnabled:false,curveSegments:20});g.rotateX(Math.PI/2);return g});
 const blackKeys=useMemo(()=>{const out=[];for(let i=0;i<52;i++){const k=i%7;if(k===2||k===6)continue;out.push(-.72+(i+.7)*.0277)}return out},[]);
 // keyboard faces -z (towards the pianist); the case extends to +z
 return <group>
  <mesh geometry={body} material={GLOSS()} castShadow position={[0,0,0]} rotation={[0,0,0]}/>
  <group position={[-.74,1.02,0]} rotation={[0,0,.5]}><mesh geometry={lid} material={GLOSS()} position={[.74,0,0]}/></group>
  {[[-.62,.12],[.62,.12],[-.2,1.55]].map(([x,z],i)=><mesh key={i} material={GLOSS()} position={[x,.37,z]}><cylinderGeometry args={[.045,.035,.74,10]}/></mesh>)}
  <mesh material={GLOSS()} position={[0,.76,-.12]}><boxGeometry args={[1.5,.1,.3]}/></mesh>
  <mesh material={WHITE()} position={[0,.82,-.17]}><boxGeometry args={[1.44,.025,.15]}/></mesh>
  {blackKeys.map((x,i)=><mesh key={i} material={BLACK()} position={[x,.84,-.14]}><boxGeometry args={[.014,.02,.09]}/></mesh>)}
  <mesh material={WHITE()} position={[0,1.0,-.03]} rotation={[-.25,0,0]}><boxGeometry args={[.5,.24,.01]}/></mesh>
 </group>;
}
function Harp(){
 const frame=G('harpFrame',()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,.05,0],[0,1.7,0],[.25,1.78,0],[.55,1.62,0],[.75,1.3,0],[.62,.35,0],[0,.08,0]].map(p=>new THREE.Vector3(...p)),true),80,.03,8,true));
 const strings=useMemo(()=>Array.from({length:22},(_,i)=>{const x=.04+i*.028;const top=1.7-x*.5;return {x,h:top-.12-x*.9}}),[]);
 return <group><mesh geometry={frame} material={std('#b98a3a',.35,.6)} castShadow/>{strings.map((s,i)=><mesh key={i} material={WHITE()} position={[s.x,.12+x0(s)+s.h/2,0]}><cylinderGeometry args={[.002,.002,s.h,4]}/></mesh>)}</group>;
}
const x0=s=>s.x*.9;
const Flute=()=><mesh material={CHROME()} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.011,.011,.66,10]}/></mesh>;
function Sax(){const tube=G('sax',()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,.5,0],[0,.2,.02],[0,-.12,.03],[.04,-.25,.06],[.12,-.22,.1],[.15,-.05,.13]].map(p=>new THREE.Vector3(...p))),40,.028,10,false));
 return <group><mesh geometry={tube} material={BRASS()}/><mesh material={BRASS()} position={[.15,0,.13]}><cylinderGeometry args={[.08,.03,.12,16,1,true]}/></mesh><mesh material={BLACK()} position={[0,.55,-.01]} rotation={[.5,0,0]}><cylinderGeometry args={[.008,.012,.1,8]}/></mesh></group>}
const Trumpet=()=><group rotation={[Math.PI/2,0,0]}><mesh material={BRASS()} position={[0,.2,0]}><cylinderGeometry args={[.012,.012,.42,8]}/></mesh><mesh material={BRASS()} position={[0,.45,0]}><cylinderGeometry args={[.06,.012,.12,16,1,true]}/></mesh><mesh material={BRASS()} position={[0,.2,-.05]}><boxGeometry args={[.05,.16,.05]}/></mesh></group>;
function Guitar({bass=false,colour='#9a1c22'}){
 const s=G('gtrShape',()=>{const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(.2,0,.22,.16,.13,.22);s.bezierCurveTo(.2,.3,.14,.42,.06,.4);s.lineTo(-.06,.4);s.bezierCurveTo(-.15,.42,-.2,.3,-.13,.22);s.bezierCurveTo(-.22,.16,-.2,0,0,0);return s});
 const body=G('gtrBody',()=>{const g=new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2,curveSegments:10});g.translate(0,0,-.022);return g});
 const neck=bass?.86:.62;
 return <group><mesh geometry={body} material={std(colour,.3,.1)} castShadow/><mesh material={DARKWOOD()} position={[0,.4+neck/2,.01]}><boxGeometry args={[bass?.05:.045,neck,.025]}/></mesh><mesh material={BLACK()} position={[0,.42+neck,.01]}><boxGeometry args={[.07,.14,.02]}/></mesh><mesh material={WHITE()} position={[0,.16,.03]}><boxGeometry args={[.1,.06,.005]}/></mesh></group>;
}
function Drums(){
 const shell=std('#5a1a20',.35,.2),head=WHITE();
 const Drum=({r,h,p,rot=[0,0,0]})=><group position={p} rotation={rot}><mesh material={shell}><cylinderGeometry args={[r,r,h,24]}/></mesh><mesh material={head} position={[0,h/2+.002,0]}><cylinderGeometry args={[r*.98,r*.98,.004,24]}/></mesh></group>;
 const Cym=({p,r=.2})=><group position={p}><mesh material={BRASS()}><cylinderGeometry args={[r,r*.1,.02,24]}/></mesh><mesh material={CHROME()} position={[0,-p[1]/2,0]}><cylinderGeometry args={[.01,.01,p[1],6]}/></mesh></group>;
 return <group>
  <Drum r={.28} h={.42} p={[0,.3,.18]} rot={[Math.PI/2,0,0]}/>
  <Drum r={.17} h={.14} p={[.32,.62,-.05]}/><Drum r={.12} h={.14} p={[-.13,.76,.12]} rot={[.3,0,0]}/><Drum r={.13} h={.15} p={[.15,.78,.14]} rot={[.3,0,0]}/><Drum r={.2} h={.4} p={[-.45,.38,-.05]}/>
  <Cym p={[.6,.98,.02]} r={.18}/><Cym p={[-.55,1.3,.3]} r={.24}/><Cym p={[.5,1.35,.35]} r={.22}/>
  <mesh material={BLACK()} position={[0,.25,-.45]}><cylinderGeometry args={[.18,.18,.06,16]}/></mesh>
 </group>;
}
const MicStand=({h=1.52})=><group><mesh material={BLACK()} position={[0,.01,0]}><cylinderGeometry args={[.15,.15,.02,16]}/></mesh><mesh material={CHROME()} position={[0,h/2,0]}><cylinderGeometry args={[.01,.01,h,6]}/></mesh><mesh material={BLACK()} position={[0,h+.04,-.03]} rotation={[.6,0,0]}><capsuleGeometry args={[.022,.08,4,8]}/></mesh></group>;
const Keyboard=()=><group><mesh material={BLACK()} position={[0,.92,0]}><boxGeometry args={[1.05,.06,.3]}/></mesh><mesh material={WHITE()} position={[0,.955,.04]}><boxGeometry args={[.98,.015,.14]}/></mesh>{[-1,1].map(s=><mesh key={s} material={CHROME()} position={[s*.32,.45,0]} rotation={[0,0,s*.4]}><boxGeometry args={[.03,1,.03]}/></mesh>)}</group>;
const Chair=({h=.46})=><group><mesh material={BLACK()} position={[0,h,0]}><boxGeometry args={[.44,.05,.42]}/></mesh><mesh material={BLACK()} position={[0,h+.25,-.2]}><boxGeometry args={[.42,.4,.04]}/></mesh>{[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=><mesh key={a+','+b} material={CHROME()} position={[a*.19,h/2,b*.18]}><cylinderGeometry args={[.012,.012,h,6]}/></mesh>)}</group>;
const MusicStand=()=><group position={[0,0,.72]}><mesh material={BLACK()} position={[0,.42,0]}><cylinderGeometry args={[.008,.008,.84,6]}/></mesh><mesh material={BLACK()} position={[0,.86,0]} rotation={[-.6,Math.PI,0]}><boxGeometry args={[.36,.25,.01]}/></mesh><mesh material={WHITE()} position={[0,.86,-.006]} rotation={[-.6,Math.PI,0]}><planeGeometry args={[.32,.22]}/></mesh></group>;

// Arm poses [forward/back, out, elbow] and the instrument placement for each part.
const PARTS={
 violin:{seated:true,L:[-1.35,.5,-1.1],R:[-.9,-.35,-1.3],bow:'R',stand:true,inst:<group position={[.1,.96,.18]} rotation={[-1.2,.5,1.35]}><StringInstrument L={.36} neck={.24}/></group>},
 viola:{seated:true,L:[-1.35,.5,-1.1],R:[-.9,-.35,-1.3],bow:'R',stand:true,inst:<group position={[.1,.94,.2]} rotation={[-1.2,.5,1.35]}><StringInstrument L={.41} neck={.27}/></group>},
 cello:{seated:true,L:[-.7,.35,-1.5],R:[-.75,-.45,-.7],bow:'R',stand:true,inst:<group position={[0,.08,.45]} rotation={[-.22,0,.08]}><StringInstrument L={.75} neck={.48}/><mesh material={CHROME()} position={[0,-.06,0]}><cylinderGeometry args={[.006,.006,.14,6]}/></mesh></group>},
 doubleBass:{seated:false,L:[-.9,.5,-1.4],R:[-.55,-.2,-.9],bow:'R',inst:<group position={[.28,.12,.32]} rotation={[-.15,-.3,.12]}><StringInstrument L={1.1} neck={.72}/></group>},
 flute:{seated:true,L:[-1.45,-.15,-1.65],R:[-1.25,-.8,-1.35],stand:true,inst:<group position={[-.25,1.17,.2]}><Flute/></group>},
 harp:{seated:true,L:[-1.05,.1,-.8],R:[-1.05,-.1,-.8],inst:<group position={[-.12,0,.42]} rotation={[0,-.5,-.12]}><Harp/></group>},
 piano:{seated:true,bench:true,L:[-1.0,-.12,-.75],R:[-1.0,.12,-.75],hands:true,inst:<group position={[0,0,.72]}><GrandPiano/></group>},
 drums:{seated:true,stool:true,L:[-.85,.2,-.9],R:[-.85,-.2,-.9],drum:true,inst:<group position={[0,0,.62]}><Drums/></group>},
 saxophone:{seated:false,L:[-.6,.05,-1.6],R:[-.55,-.05,-1.45],sway:true,inst:<group position={[0,.85,.2]}><Sax/></group>},
 trumpet:{seated:false,L:[-1.35,.12,-1.5],R:[-1.3,-.12,-1.5],sway:true,inst:<group position={[0,1.52,.25]}><Trumpet/></group>},
 vocals:{seated:false,L:[-.3,.25,-.5],R:[-.9,-.1,-1.2],sing:true,inst:<group position={[0,0,.42]}><MicStand/></group>},
 electricGuitar:{seated:false,L:[-.8,.6,-1.3],R:[-.45,-.25,-1.5],strum:true,inst:<group position={[-.1,.86,.17]} rotation={[0,0,-1.05]}><Guitar/></group>},
 bassGuitar:{seated:false,L:[-.8,.65,-1.2],R:[-.45,-.25,-1.5],strum:true,inst:<group position={[-.1,.84,.17]} rotation={[0,0,-1.1]}><Guitar bass colour="#1d1d22"/></group>},
 keyboard:{seated:false,L:[-.95,-.15,-.7],R:[-.95,.15,-.7],hands:true,inst:<group position={[0,0,.5]}><Keyboard/></group>},
};

function Musician({genre,instrument,index,armRefs}){
 const p=PARTS[instrument];const outfit=outfitFor(genre,index,instrument);
 const skin=SKIN[(index*3+1)%SKIN.length],hair=HAIR[(index*2)%HAIR.length];
 const singerMic=instrument==='vocals';
 return <group>
  {p.seated&&!p.bench&&<Chair h={p.stool?.62:.46}/>}
  {p.bench&&<mesh material={GLOSS()} position={[0,.46,.05]}><boxGeometry args={[.8,.06,.34]}/></mesh>}
  <Figure seated={p.seated} stool={p.stool} outfit={outfit} skin={skin} hair={hair} armsPose={{L:p.L,R:p.R}} armRefs={armRefs}/>
  {p.inst}
  {p.stand&&genre==='classical'&&<MusicStand/>}
  {singerMic&&null}
 </group>;
}
/** A whole band, as laid out by ensembleLayout, with a riser for the drums. */
export function Ensemble({genre='classical',lineup}){
 const spots=useMemo(()=>ensembleLayout(genre,lineup),[genre,JSON.stringify(lineup)]);
 const rigs=useRef([]);
 useFrame(({clock})=>{const t=clock.elapsedTime;
  rigs.current.forEach((rig,i)=>{if(!rig)return;const p=PARTS[rig.instrument],ph=i*1.7;
   const L=rig.L.current,R=rig.R.current;if(!L||!R||!L.sh.current||!R.sh.current)return;
   if(p.bow){R.sh.current.rotation.z=-(p.R[1]+Math.sin(t*2.2+ph)*.28);R.el.current.rotation.x=p.R[2]+Math.sin(t*2.2+ph)*.25}
   if(p.drum){L.sh.current.rotation.x=p.L[0]+Math.max(0,Math.sin(t*7+ph))*.35;R.sh.current.rotation.x=p.R[0]+Math.max(0,Math.sin(t*7+ph+Math.PI))*.35}
   if(p.strum){R.el.current.rotation.x=p.R[2]+Math.sin(t*6+ph)*.22}
   if(p.hands){L.el.current.rotation.x=p.L[2]+Math.sin(t*3+ph)*.08;R.el.current.rotation.x=p.R[2]+Math.sin(t*3.4+ph)*.08}
   if(p.sing){L.sh.current.rotation.x=p.L[0]-Math.max(0,Math.sin(t*.9+ph))*.6}
   if(rig.body.current&&(p.sway||p.sing||!p.seated))rig.body.current.rotation.z=Math.sin(t*1.1+ph)*.035;
  });
 });
 const hasDrums=spots.some(s=>s.instrument==='drums');
 return <group>
  {hasDrums&&<mesh material={BLACK()} position={[0,.15,-1.4]} receiveShadow castShadow><boxGeometry args={[2.2,.3,1.9]}/></mesh>}
  {spots.map((s,i)=>{
   const rig={instrument:s.instrument,L:{current:null},R:{current:null},body:React.createRef()};rigs.current[i]=rig;
   const lift=s.instrument==='drums'?.3:0;
   return <group key={i} position={[s.x,lift,s.z]} rotation={[0,s.rotation,0]}><group ref={rig.body}><Musician genre={genre} instrument={s.instrument} index={i} armRefs={{L:rig.L,R:rig.R}}/></group></group>;
  })}
 </group>;
}
export {GENRES};

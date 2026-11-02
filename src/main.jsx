import React, {useState,useMemo,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {Outlines,Text,Billboard} from '@react-three/drei';
import * as THREE from 'three';
import {Plus,Minus,RotateCcw,Save,Trash2,Eye,Move,Info,Undo2,Redo2,PackagePlus,Check,SlidersHorizontal,Box as BoxIcon,Store,Maximize2,MousePointer2,Ruler,ChevronDown,Armchair,Palette,Layers3,Sun,ShoppingBag} from 'lucide-react';
import './style.css';
import Marketplace from './components/marketplace/Marketplace.jsx';
import PlatformApp from './components/PlatformApp.jsx';
import {StudioEnvironment,satinMaterial,coverMaterial,sashMaterial,getClothGeometry,getChairGeometries,PlaceSettings,LeafChandelier,coveGlowMaterial,pilasterGlowMaterial,antiqueMirrorMaterial,latticeMaterial} from './studio/assets/ballroomAssets.jsx';
import {CityContext,useCityData} from './studio/city/CityContext.jsx';
import {grandBallroom as venue} from './venues/orchard-grand/grand-ballroom/config.js';

const {length:LENGTH,width:WIDTH,height:HEIGHT}=venue.dimensions;
/** Bundled OFL font for 3D labels; avoids troika's runtime CDN font lookup. */
const LABEL_FONT='/fonts/LiberationSans-Regular.ttf';
const palette={ivory:'#e6dfd2',champagne:'#b9a58d',sage:'#a6b2a0',rose:'#d6adb1',midnight:'#555866'};
const initialTables=Array.from({length:24},(_,i)=>({id:i+1,x:-12+(i%6)*4.65,z:-7.9+Math.floor(i/6)*5.15,chairs:10,gap:.22,rotation:0})).filter(t=>t.x!==-12);
const initialState={tables:initialTables,stage:{x:-13.9,z:0,width:10.2,depth:3.4,rotation:Math.PI/2},theme:'ivory',flowers:'white',lighting:'bright',showRoof:false,showDecor:true,showAv:true,inventory:['table','flowers','stage'],showStage:true,showScreen:false,showArch:false,showTableLabels:false,seatDietary:{}};
function load(){
 try{
  const v=JSON.parse(localStorage.getItem(venue.storageKey));
  if(!v||!Array.isArray(v.tables))return initialState;
  // @migration STAGE_PLACEMENT: The previous prototype default placed a
  // 4.2 x 7 m stage at x=12, away from the LED screen. Migrate only that
  // exact old default; never overwrite a stage the couple repositioned.
  const old=v.stage;
  const oldDefault=old&&old.x===12&&old.z===0&&old.width===4.2&&old.depth===7&&(old.rotation||0)===0;
  const previousStage=oldDefault||(
   old&&old.x===-14.05&&old.z===0&&old.width===7.2&&old.depth===2.5&&old.rotation===Math.PI/2
  );
  const stage=previousStage?{...initialState.stage}:v.stage||initialState.stage;
  // Only remove untouched default-position tables when upgrading the default
  // stage. Never delete a table that the couple has already moved.
  const tables=previousStage?v.tables.filter(t=>{
   const i=t.id-1;
   return !(i>=0&&i<24&&i%6===0&&
    Math.abs(t.x-(-12))<.001&&
    Math.abs(t.z-(-7.9+Math.floor(i/6)*5.15))<.001);
  }):v.tables;
  return {...initialState,...v,stage,tables};
 }catch{return initialState}
}
function carpetTexture(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#9b9796';ctx.fillRect(0,0,1024,1024);
 // Flowing, overlapping botanical ribbons inspired by the reference carpet.
 // Procedural approximation, not a scan of the hotel's proprietary pattern.
 const rng=(n)=>{const v=Math.sin(n*127.1+78.23)*43758.5453;return v-Math.floor(v)};
 for(let i=0;i<145;i++){
  const x=rng(i+1)*1200-100,y=rng(i+500)*1200-100;
  const shade=['#dedbd6','#e7dfd4','#66717c','#a38b86','#b6aa98','#8b9a8c'][i%6];
  ctx.strokeStyle=shade;ctx.globalAlpha=.42+(.22*rng(i+44));ctx.lineWidth=1.5+rng(i+88)*5;
  ctx.beginPath();ctx.moveTo(x-130,y+80);
  ctx.bezierCurveTo(x-65,y-90,x+80,y+100,x+160,y-55);ctx.stroke();
 }
 ctx.globalAlpha=.65;
 for(let i=0;i<34;i++){
  const x=rng(i+800)*1024,y=rng(i+900)*1024;
  ctx.strokeStyle=i%3===0?'#e8dfd1':'#5e5c61';ctx.lineWidth=1.8;
  for(let j=0;j<9;j++){ctx.beginPath();ctx.ellipse(x,y,30+j*7,15+j*6,.55,0,Math.PI*1.5);ctx.stroke()}
 }
 ctx.globalAlpha=1;
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(1.9,1.45);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 return texture;
}
// Lightweight procedural PBR surface variation. No external textures or subscriptions.
function FabricMaterial({color,roughness=.96}){
 return <meshStandardMaterial color={color} roughness={roughness} metalness={0}/>;
}
function VenueLighting({mode}){
 const warm=mode==='warm';
 return <>
  <ambientLight intensity={warm?.14:.26} color={warm?'#ffeddb':'#ffffff'}/>
  <hemisphereLight args={[warm?'#ffe7c4':'#f4f6ff','#70645b',warm?.3:.5]}/>
  <directionalLight castShadow position={[11,19,8]} intensity={warm?1.2:1.8}
   color={warm?'#ffe1bd':'#fff8f0'} shadow-mapSize={[1024,1024]}
   shadow-camera-left={-23} shadow-camera-right={23} shadow-camera-top={23} shadow-camera-bottom={-23}
   shadow-bias={-.00018} shadow-normalBias={.025} shadow-radius={3}/>
  <directionalLight position={[-12,10,-7]} intensity={warm?.35:.65} color={warm?'#ffd8aa':'#eaf1ff'}/>
 </>;
}
function Box({position,args,color,metalness=0,roughness=.8,highlight=false,...rest}){return <mesh position={position} castShadow receiveShadow {...rest}><boxGeometry args={args}/><meshStandardMaterial color={color} metalness={metalness} roughness={roughness}/>{highlight&&<Outlines thickness={.045} color="#ff8500"/>}</mesh>}
function Carpet(){const texture=useMemo(carpetTexture,[]);useEffect(()=>()=>texture.dispose(),[texture]);return <mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,0]} receiveShadow><planeGeometry args={[LENGTH,WIDTH]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>}
// Grand Ballroom architectural details are reconstructed from reference photography.
// Exact fixture positions, door openings and decorative dimensions remain provisional.
const CREAM='#e8dfd0', GOLD='#b89a68', TRIM='#d0bd9d';
function WallPanel({x,z,rotation=0,ornate=false,warm=true}){
 // Ornate bays are dark bronze lattice screens with gold fretwork; plain bays
 // are cream upholstered panels framed by softly lit pilaster strips.
 return <group position={[x,0,z]} rotation={[0,rotation,0]}>
  <Box position={[0,3.9,0]} args={[3.1,7.75,.12]} color="#d6c8b7"/>
  {ornate?<mesh position={[0,3.6,.09]} material={latticeMaterial(4,10)} receiveShadow><boxGeometry args={[2.62,6.2,.04]}/></mesh>
   :<><Box position={[0,3.7,.075]} args={[2.76,6.4,.035]} color={CREAM}/><Box position={[0,3.65,.105]} args={[2.52,6.1,.02]} color="#f4eee5" roughness={.95}/></>}
  {[-1.37,1.37].map(v=><Box key={v} position={[v,3.88,.17]} args={[.075,7.5,.12]} color={TRIM}/>)}
  {[-1.43,1.43].map(v=><mesh key={'glow'+v} position={[v,3.9,.2]} material={pilasterGlowMaterial(warm)}><boxGeometry args={[.035,6.6,.02]}/></mesh>)}
  {[.9,6.62].map(y=><Box key={y} position={[0,y,.17]} args={[2.8,.055,.12]} color={GOLD} metalness={.8} roughness={.3}/>)}
  <Box position={[0,7.1,.18]} args={[2.7,.95,.07]} color={ornate?'#8e7551':'#b7a68d'} metalness={ornate?.6:0} roughness={.4}/>
 </group>;
}
function ArchedMirror({x,z,rotation=0}){
 return <group position={[x,0,z]} rotation={[0,rotation,0]}>
  <mesh position={[0,3.75,.19]} material={antiqueMirrorMaterial()}><boxGeometry args={[2.25,5.5,.07]}/></mesh>
  <mesh position={[0,6.45,.19]} material={antiqueMirrorMaterial()}><sphereGeometry args={[1.13,24,12,0,Math.PI,0,Math.PI/2]}/></mesh>
  {[-1.19,1.19].map(v=><Box key={v} position={[v,3.9,.27]} args={[.09,5.55,.09]} color={GOLD} metalness={.65}/>)}
  <Box position={[0,1.02,.28]} args={[2.47,.09,.09]} color={GOLD}/>
 </group>;
}
function Walls({showRoof,warm=true}){
 return <group>
  <Box position={[0,HEIGHT-.12,0]} args={[LENGTH,.2,WIDTH]} color="#eee7db" visible={showRoof}/>
  {Array.from({length:10},(_,i)=><WallPanel key={'long-a'+i} x={-14.1+i*3.13} z={-WIDTH/2+.13} ornate={i%3===0} warm={warm}/>)}
  {Array.from({length:10},(_,i)=><WallPanel key={'long-b'+i} x={-14.1+i*3.13} z={WIDTH/2-.13} rotation={Math.PI} ornate={i%3===0} warm={warm}/>)}
  {Array.from({length:7},(_,i)=><WallPanel key={'short-a'+i} x={-LENGTH/2+.12} z={-9.3+i*3.1} rotation={Math.PI/2} ornate={i%2===0} warm={warm}/>)}
  {Array.from({length:7},(_,i)=><WallPanel key={'short-b'+i} x={LENGTH/2-.12} z={-9.3+i*3.1} rotation={-Math.PI/2} ornate={i%2===0} warm={warm}/>)}
  <ArchedMirror x={-LENGTH/2+.32} z={-7.5} rotation={Math.PI/2}/>
  <ArchedMirror x={-LENGTH/2+.32} z={7.5} rotation={Math.PI/2}/>
  <ArchedMirror x={LENGTH/2-.32} z={-7.5} rotation={-Math.PI/2}/>
  <ArchedMirror x={LENGTH/2-.32} z={7.5} rotation={-Math.PI/2}/>
  {[-WIDTH/2+.15,WIDTH/2-.15].map(z=><Box key={z} position={[0,7.95,z]} args={[LENGTH,.35,.4]} color="#e8e0d4"/>)}
  {[-LENGTH/2+.15,LENGTH/2-.15].map(x=><Box key={x} position={[x,7.95,0]} args={[.4,.35,WIDTH]} color="#e9e1d4"/>)}
 </group>;
}
function ExitDoor({x,z,rotation=0}){
 return <group position={[x,0,z]} rotation={[0,rotation,0]}>
  <Box position={[0,1.5,.11]} args={[2.05,3,.15]} color="#352b29"/>
  {[-.49,.49].map(a=><group key={a}><Box position={[a,1.45,.22]} args={[.93,2.78,.08]} color="#322a27"/><Box position={[a,1.1,.3]} args={[.67,.045,.08]} color="#b7ada0" metalness={.7}/></group>)}
  <Box position={[0,3.15,.2]} args={[.65,.23,.12]} color="#007f77"/>
  <Text font={LABEL_FONT} position={[0,3.15,.275]} fontSize={.13} color="white">EXIT</Text>
 </group>;
}
// Coffered ceiling: pale recessed panels with gold cove trim. The two special
// bays have a luminous mirrored lattice (NOT a dark ventilation grille).
// Layout is photograph-guided; spacing remains provisional.
function CeilingBay({x,z,skylight=false,warm=true}){
 const glow=warm?'#e7c18d':'#f5ede2';
 return <group position={[x,8.04,z]}>
  <Box position={[0,0,0]} args={[7.42,.12,7.02]} color="#e6ded4"/>
  <Box position={[0,-.065,0]} args={[6.76,.035,6.33]} color="#f4eee6"/>
  {/* Warm cove lighting around each coffer, as in the reference photos. */}
  {[-3.18,3.18].map(v=><mesh key={'x'+v} position={[v,-.095,0]} material={coveGlowMaterial(warm)}><boxGeometry args={[.12,.035,6.1]}/></mesh>)}
  {[-2.98,2.98].map(v=><mesh key={'z'+v} position={[0,-.095,v]} material={coveGlowMaterial(warm)}><boxGeometry args={[6.26,.035,.12]}/></mesh>)}
  {skylight&&<group>
   <Box position={[0,-.115,0]} args={[4.1,.025,3.75]} color="#d9d5d0" metalness={.25} roughness={.4}/>
   {Array.from({length:7},(_,i)=><Box key={'x'+i} position={[-1.83+i*.61,-.145,0]} args={[.045,.025,3.7]} color="#9d8c7e" metalness={.65} roughness={.22}/>)}
   {Array.from({length:7},(_,i)=><Box key={'z'+i} position={[0,-.145,-1.66+i*.55]} args={[4.03,.025,.045]} color="#a99a8b" metalness={.65} roughness={.22}/>)}
   {[-1.95,1.95].map(v=><Box key={'edge'+v} position={[v,-.15,0]} args={[.085,.03,3.75]} color="#fff7ec"/>)}
  </group>}
 </group>;
}
function CeilingDetails({showRoof,warm=true}){
 if(!showRoof)return null;
 return <group>
  <Box position={[0,8.22,0]} args={[LENGTH,.16,WIDTH]} color="#eee7dc"/>
  {Array.from({length:4},(_,i)=>Array.from({length:3},(_,j)=><CeilingBay key={i+'-'+j} x={-11.65+i*7.76} z={-7.2+j*7.2} skylight={(i===1||i===2)&&j===1} warm={warm}/>))}
 </group>;
}
function ChandelierSet({warm=true}){return <group>{[-10.2,-3.4,3.4,10.2].flatMap((x,i)=>[-5.2,5.2].map((z,j)=><LeafChandelier key={x+'-'+z} x={x} z={z} warm={warm} seed={i*2+j+1}/>))}</group>}
// Chair with a continuous fabric slipcover, a curved backrest and a split skirt.
// Front faces the centre of its associated banquet table.
const DIETARY_OPTIONS=[
 {id:'halal',label:'Halal'},
 {id:'vegetarian',label:'Vegetarian'},
 {id:'vegan',label:'Vegan'},
 {id:'gluten',label:'Gluten-free'},
 {id:'fish',label:'Fish allergy'},
 {id:'dairy',label:'Dairy allergy'},
 {id:'nuts',label:'Nut allergy'},
 {id:'other',label:'Other dietary need'}
];
function makeDietaryTexture(type){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const c=canvas.getContext('2d');c.clearRect(0,0,128,128);
 c.fillStyle='#ffffff';c.beginPath();c.arc(64,64,59,0,Math.PI*2);c.fill();
 c.strokeStyle='#162d4a';c.lineWidth=5;c.lineCap='round';c.lineJoin='round';
 const line=(...p)=>{c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.stroke()};
 if(type==='vegetarian'||type==='vegan'){
  c.beginPath();c.moveTo(37,94);c.bezierCurveTo(22,56,48,27,96,29);c.bezierCurveTo(105,71,74,104,37,94);c.stroke();
  line(36,94,87,39);line(55,73,47,50);line(69,59,89,61);
  if(type==='vegan')line(27,103,38,94);
 }else if(type==='fish'){
  c.beginPath();c.ellipse(62,63,28,17,0,0,Math.PI*2);c.stroke();
  line(34,63,20,46,20,80,34,63);c.beginPath();c.arc(78,58,2.5,0,Math.PI*2);c.fillStyle='#162d4a';c.fill();
  line(29,98,99,28);
 }else if(type==='dairy'){
  c.beginPath();c.moveTo(47,33);c.lineTo(81,33);c.lineTo(81,42);c.lineTo(89,53);c.lineTo(89,96);c.lineTo(39,96);c.lineTo(39,53);c.lineTo(47,42);c.closePath();c.stroke();
  line(39,63,89,63);line(25,103,103,25);
 }else if(type==='gluten'){
  line(64,28,64,101);for(let y=40;y<91;y+=16){line(64,y+7,47,y-3);line(64,y+7,81,y-3)}
  line(26,102,103,25);
 }else if(type==='nuts'){
  c.beginPath();c.ellipse(64,65,25,34,-.3,0,Math.PI*2);c.stroke();line(58,38,73,93);line(26,103,102,26);
 }else if(type==='halal'){
  c.beginPath();c.arc(63,62,29,-1.2,1.8);c.stroke();
  c.beginPath();c.arc(75,54,23,-1.2,1.8);c.stroke();
  line(86,29,89,38,99,39,91,45,92,55);
 }else{
  c.beginPath();c.arc(64,64,29,0,Math.PI*2);c.stroke();line(64,43,64,70);
  c.beginPath();c.arc(64,83,3,0,Math.PI*2);c.fillStyle='#162d4a';c.fill();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function DietaryBadge({type,index,total}){
 const texture=useMemo(()=>makeDietaryTexture(type),[type]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <Billboard position={[(index-(total-1)/2)*.31,1.64,.02]} follow>
  <mesh raycast={()=>null} renderOrder={40}><circleGeometry args={[.145,32]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false}/></mesh>
 </Billboard>;
}
const SASH_COLORS={'#e6dfd2':'#ecd2cd','#b9a58d':'#efe4d3','#a6b2a0':'#f1ece2','#d6adb1':'#f4e7e4','#555866':'#cbb48f'};
function Chair({x,z,angle,color,highlight=false,onSeatClick,seatSelected=false,seatingMode=false,dietaryTags=[]}){
 const [seatHovered,setSeatHovered]=useState(false);
 const active=seatingMode&&(seatHovered||seatSelected);
 const outlineColor=active?'#13A9A0':'#ff8500';
 const outlined=active||highlight;
 const materialColor=active?'#d4f2ea':color;
 // Photo-guided covered banquet chair: fitted stretch cover, box-pleated skirt and satin sash.
 const {cover,sash}=getChairGeometries();
 const chairMaterial=active?<meshPhysicalMaterial color={materialColor} roughness={.82} sheen={.7} emissive="#0a766f" emissiveIntensity={.15}/>:null;
 const edges=outlined?<Outlines thickness={active?.045:.032} color={outlineColor} screenspace={true}/>:null;
 return <group position={[x,0,z]} rotation={[0,angle,0]}
   onPointerOver={seatingMode?(e)=>{if(e.shiftKey)return;e.stopPropagation();setSeatHovered(true);document.body.style.cursor='pointer'}:undefined}
   onPointerOut={seatingMode?(e)=>{e.stopPropagation();setSeatHovered(false);document.body.style.cursor='auto'}:undefined}
   onClick={onSeatClick}>
  <mesh userData={{seatPart:true}} geometry={cover} material={active?undefined:coverMaterial(color)} castShadow receiveShadow>{chairMaterial}{edges}</mesh>
  <mesh userData={{seatPart:true}} geometry={sash} material={sashMaterial(SASH_COLORS[color]||'#e9cfc9')} castShadow/>
 {seatingMode&&dietaryTags.slice(0,3).map((type,i)=><DietaryBadge key={type} type={type} index={i} total={Math.min(dietaryTags.length,3)}/>)}
 </group>;
}
function Flowers({variant}){
 const color=variant==='pink'?'#dca7ae':variant==='green'?'#879c80':'#f3e9df';
 return <group position={[0,.94,0]}>
  <mesh><cylinderGeometry args={[.075,.12,.29,8]}/><meshStandardMaterial color="#bca58b" metalness={.32} roughness={.38}/></mesh>
  {Array.from({length:11},(_,i)=>{const a=i*Math.PI*2/11;return <group key={i} position={[Math.cos(a)*.21,.22+Math.sin(i*2)*.065,Math.sin(a)*.21]}>
   <mesh castShadow><icosahedronGeometry args={[.11,1]}/><meshStandardMaterial color={i%4===0?'#94a68a':color} roughness={.9}/></mesh>
  </group>})}
 </group>;
}
function DrapedCloth({color}){return <mesh userData={{moveHandle:true}} geometry={getClothGeometry()} material={satinMaterial(color)} castShadow receiveShadow/>}
function TableLabel({title}){
 const shape=useMemo(()=>{const w=2.15,h=.48,r=.15;const q=new THREE.Shape();q.moveTo(-w/2+r,-h/2);q.lineTo(w/2-r,-h/2);q.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);q.lineTo(w/2,h/2-r);q.quadraticCurveTo(w/2,h/2,w/2-r,h/2);q.lineTo(-w/2+r,h/2);q.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);q.lineTo(-w/2,-h/2+r);q.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return q},[]);
 return <Billboard position={[0,1.75,0]} follow><mesh raycast={()=>null}><shapeGeometry args={[shape]}/><meshBasicMaterial color="#fffaf2" transparent opacity={.83} depthWrite={false} side={THREE.DoubleSide}/></mesh><Text font={LABEL_FONT} raycast={()=>null} position={[0,0,.015]} fontSize={.19} color="#4c3a2b" maxWidth={1.93} anchorX="center" anchorY="middle" outlineWidth={0}>{title}</Text></Billboard>;
}
function Table({data,selected,highlight=false,onSelect,onMove,onDragStart,onDragEnd,theme,flowers,decor,controlsRef,tool,seatingMode=false,onSeatClick,seatSelection=null,showTableLabels=false,onTableSeatSelect,seatDietary={}}){const [hovered,setHovered]=useState(false);const group=useRef();const dragging=useRef(false);const plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),0),[]);const hit=useMemo(()=>new THREE.Vector3(),[]);const fabric=palette[theme]||palette.ivory;return <group ref={group} position={[data.x,0,data.z]} rotation={[0,data.rotation||0,0]} onPointerOver={e=>{e.stopPropagation();setHovered(true);document.body.style.cursor='pointer'}} onPointerOut={e=>{e.stopPropagation();setHovered(false);document.body.style.cursor='auto'}} onClick={seatingMode?(e)=>{if(e.shiftKey||e.button!==0)return;const isChair=e.object?.userData?.seatPart;if(isChair)return;e.stopPropagation();onTableSeatSelect?.(data.id)}:undefined} onPointerDown={e=>{if(e.shiftKey || seatingMode || !e.object.userData.moveHandle)return;e.stopPropagation();onSelect({type:'table',id:data.id});if(e.button===0 && tool==='select'){dragging.current=true;onDragStart();if(controlsRef.current)controlsRef.current.enabled=false;e.target.setPointerCapture(e.pointerId)}}} onPointerMove={e=>{if(!dragging.current)return;e.stopPropagation();if(e.ray.intersectPlane(plane,hit)){onMove(data.id,Math.max(-14.2,Math.min(14.2,hit.x)),Math.max(-9.8,Math.min(9.8,hit.z)))}}} onPointerUp={e=>{dragging.current=false;if(controlsRef.current)controlsRef.current.enabled=true;onDragEnd();if(e.target.hasPointerCapture(e.pointerId))e.target.releasePointerCapture(e.pointerId)}}><mesh userData={{moveHandle:true,editable:'table-'+data.id}} position={[0,.72,0]} castShadow receiveShadow><cylinderGeometry args={[.89,.89,.12,40]}/><meshStandardMaterial color={fabric} roughness={.9}/></mesh><mesh position={[0,.42,0]}><cylinderGeometry args={[.12,.25,.65,12]}/><meshStandardMaterial color="#8b8279"/></mesh><DrapedCloth color={fabric}/><PlaceSettings count={data.chairs}/>{Array.from({length:data.chairs},(_,i)=>{const a=i*Math.PI*2/data.chairs;return <Chair key={i} x={Math.sin(a)*(1.16+(data.gap??.22))} z={Math.cos(a)*(1.16+(data.gap??.22))} angle={a} color={fabric} highlight={!seatingMode&&(highlight||selected)} seatSelected={seatingMode&&seatSelection?.tableId===data.id&&seatSelection?.seatNumber===i+1} seatingMode={seatingMode} dietaryTags={seatDietary[String(data.id)+':'+String(i+1)]||[]} onSeatClick={seatingMode?(e)=>{if(e.shiftKey)return;e.stopPropagation();onSeatClick?.(data.id,i+1)}:undefined}/>})}{decor&&<Flowers variant={flowers}/>} {showTableLabels&&<TableLabel title={data.title?.trim()||`Table ${data.id}`}/>} {(!seatingMode&&(selected||hovered))&&<mesh raycast={()=>null} position={[0,.04,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.42+(data.gap??.22),1.48+(data.gap??.22),64]}/><meshBasicMaterial color="#ff8800" side={THREE.DoubleSide}/></mesh>}</group>}
function Stage({data,selected,highlight=false,onSelect,onMove,onDragStart,onDragEnd,controlsRef,tool}){
 const [hovered,setHovered]=useState(false);
 const drag=useRef(false),plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),0),[]),hit=useMemo(()=>new THREE.Vector3(),[]);
 return <group position={[data.x,0,data.z]} rotation={[0,data.rotation||0,0]}
  onPointerOver={e=>{e.stopPropagation();setHovered(true);document.body.style.cursor='pointer'}}
  onPointerOut={e=>{e.stopPropagation();setHovered(false);document.body.style.cursor='auto'}}
  onPointerDown={e=>{if(e.shiftKey||!e.object.userData.moveHandle)return;e.stopPropagation();onSelect({type:'stage'});if(e.button!==0||tool!=='select')return;drag.current=true;onDragStart();if(controlsRef.current)controlsRef.current.enabled=false;e.target.setPointerCapture(e.pointerId)}}
  onPointerMove={e=>{if(!drag.current)return;e.stopPropagation();if(e.ray.intersectPlane(plane,hit))onMove(Math.max(-14.2,Math.min(14.2,hit.x)),Math.max(-9,Math.min(9,hit.z)))}}
  onPointerUp={e=>{drag.current=false;if(controlsRef.current)controlsRef.current.enabled=true;onDragEnd();if(e.target.hasPointerCapture(e.pointerId))e.target.releasePointerCapture(e.pointerId)}}>
  <mesh userData={{moveHandle:true,editable:'stage'}} position={[0,.2,0]} castShadow receiveShadow>
   <boxGeometry args={[data.width,.4,data.depth]}/><meshStandardMaterial color="#343333" roughness={.82}/>
  </mesh>
  <Box position={[0,.415,0]} args={[data.width,.03,data.depth]} color="#b9aa96" highlight={highlight||selected}/>
  {[-data.width/2+.1,data.width/2-.1].map(v=><Box key={v} position={[v,.22,0]} args={[.045,.4,data.depth]} color="#95816d"/>)}
  {(selected||hovered)&&<mesh raycast={()=>null} position={[0,.012,0]} rotation={[-Math.PI/2,0,0]}>
   <planeGeometry args={[data.width+.35,data.depth+.35]}/><meshBasicMaterial color="#ff8800" transparent opacity={.2} depthWrite={false}/>
  </mesh>}
 </group>;
}
function AV(){return <group>{[-9.6,0,9.6].map(x=><group key={x}><Box position={[x,6.9,0]} args={[1.3,.2,1.3]} color="#28292b"/><Box position={[x,6.55,0]} args={[1.8,.16,1.5]} color="#44464a"/></group>)}</group>}
// Camera controller (same feel as the redesign mockup), no OrbitControls.
// Orbit views (dollhouse, plan): left-drag orbits around a target on the floor,
// right-drag or Shift+left-drag pans that target, wheel or pinch zooms.
// Guest views (walk, seat perspective): the camera stays at eye height;
// dragging looks around and the wheel walks forward or back.
// Every change sets a goal; the camera eases toward it each frame.
const ORBIT_PRESETS={
 dollhouse:{theta:.78,phi:.92,r:44,target:[0,0,0]},
 plan:{theta:0,phi:.001,r:46,target:[0,0,0]}
};
// maxR and panRadius grow when surrounding-city data is available (see CityContext).
const ORBIT_LIMITS={minR:6,maxR:110,minPhi:.001,maxPhi:1.5,panRadius:0};
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function CameraRig({view,controlsRef,seatFocus}){
 const {camera,gl,scene}=useThree();
 const rig=useRef(null);
 if(!rig.current)rig.current={
  mode:'orbit',
  cur:{theta:0,phi:1,r:60,target:new THREE.Vector3()},
  goal:{theta:0,phi:1,r:60,target:new THREE.Vector3()},
  eye:new THREE.Vector3(),eyeGoal:new THREE.Vector3(),
  yaw:0,pitch:0,yawGoal:0,pitchGoal:0
 };
 const enterOrbit=preset=>{
  const r=rig.current,cur=r.cur,goal=r.goal;
  goal.target.set(...preset.target);goal.theta=preset.theta;goal.phi=preset.phi;goal.r=preset.r;
  // Start from wherever the camera is now so the switch is a smooth move.
  const offset=camera.position.clone().sub(goal.target);
  cur.target.copy(goal.target);cur.r=Math.max(.01,offset.length());
  cur.phi=Math.acos(THREE.MathUtils.clamp(offset.y/cur.r,-1,1));cur.theta=Math.atan2(offset.x,offset.z);
  goal.theta=cur.theta+wrapAngle(goal.theta-cur.theta);
  r.mode='orbit';
 };
 const enterEye=(x,y,z,lookX,lookY,lookZ)=>{
  const r=rig.current;
  if(r.mode!=='eye'){
   r.eye.copy(camera.position);
   const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
   r.yaw=e.y;r.pitch=e.x;
  }
  r.eyeGoal.set(x,y,z);
  const dx=lookX-x,dy=lookY-y,dz=lookZ-z;
  const yaw=Math.atan2(-dx,-dz);
  r.yawGoal=r.yaw+wrapAngle(yaw-r.yaw);
  r.pitchGoal=Math.atan2(dy,Math.hypot(dx,dz));
  r.mode='eye';
 };
 useEffect(()=>{
  if(view==='walk')enterEye(-10,1.65,5,0,1.6,0);
  else enterOrbit(ORBIT_PRESETS[view]||ORBIT_PRESETS.dollhouse);
  controlsRef.current.enabled=true;
 },[view,camera,controlsRef]);
 useEffect(()=>{if(!seatFocus)return;enterEye(seatFocus.x,1.2,seatFocus.z,seatFocus.lookX??-LENGTH/2,1.1,seatFocus.lookZ??0)},[seatFocus,camera]);
 useFrame((_,dt)=>{
  const r=rig.current,k=1-Math.exp(-Math.min(dt,.1)*9);
  if(r.mode==='orbit'){
   const c=r.cur,g=r.goal;
   c.theta+=(g.theta-c.theta)*k;c.phi+=(g.phi-c.phi)*k;c.r+=(g.r-c.r)*k;c.target.lerp(g.target,k);
   camera.position.set(c.target.x+c.r*Math.sin(c.phi)*Math.sin(c.theta),c.target.y+c.r*Math.cos(c.phi),c.target.z+c.r*Math.sin(c.phi)*Math.cos(c.theta));
   camera.up.set(0,1,0);camera.lookAt(c.target);
   const near=THREE.MathUtils.clamp(c.r*.004,.1,4),far=Math.max(200,c.r*10);
   if(Math.abs(camera.near-near)>.01||camera.far!==far){camera.near=near;camera.far=far;camera.updateProjectionMatrix()}
  }else{
   r.eye.lerp(r.eyeGoal,k);r.yaw+=(r.yawGoal-r.yaw)*k;r.pitch+=(r.pitchGoal-r.pitch)*k;
   camera.position.copy(r.eye);camera.rotation.set(r.pitch,r.yaw,0,'YXZ');
   if(camera.near!==.1||camera.far!==1500){camera.near=.1;camera.far=1500;camera.updateProjectionMatrix()}
  }
  camera.updateMatrixWorld();
 });
 useEffect(()=>{
  const el=gl.domElement,r=rig.current;
  const pointers=new Map();
  const drag={mode:null,pinch:0};
  const right=new THREE.Vector3(),forward=new THREE.Vector3();
  const clampTarget=t=>{const R=ORBIT_LIMITS.panRadius;if(R){const d=Math.hypot(t.x,t.z);if(d>R){t.x*=R/d;t.z*=R/d}return}t.x=THREE.MathUtils.clamp(t.x,-LENGTH/2,LENGTH/2);t.z=THREE.MathUtils.clamp(t.z,-WIDTH/2,WIDTH/2)};
  const clampEye=v=>{v.x=THREE.MathUtils.clamp(v.x,-LENGTH/2+.6,LENGTH/2-.6);v.z=THREE.MathUtils.clamp(v.z,-WIDTH/2+.6,WIDTH/2-.6)};
  const zoom=factor=>{
   if(r.mode==='orbit')r.goal.r=THREE.MathUtils.clamp(r.goal.r*factor,ORBIT_LIMITS.minR,ORBIT_LIMITS.maxR);
   else{forward.set(-Math.sin(r.yawGoal),0,-Math.cos(r.yawGoal));r.eyeGoal.addScaledVector(forward,(1-factor)*12);clampEye(r.eyeGoal)}
  };
  const pinchDistance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
  const onDown=e=>{
   if(!controlsRef.current.enabled||e.defaultPrevented)return;
   if(e.button===0&&!e.shiftKey){
    // Leave pointer-downs on movable tabletops or the stage deck to furniture dragging.
    const rect=el.getBoundingClientRect();
    const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const caster=new THREE.Raycaster();caster.setFromCamera(pointer,camera);
    const hits=caster.intersectObjects(scene.children,true);
    if(hits.length&&hits[0].object.userData.moveHandle)return;
   }
   if(e.button!==0&&e.button!==2)return;
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   el.setPointerCapture(e.pointerId);
   if(pointers.size===2){drag.mode='pinch';drag.pinch=pinchDistance();return}
   drag.mode=r.mode==='eye'?'look':(e.button===2||e.shiftKey)?'pan':'orbit';
  };
  const onMove=e=>{
   const p=pointers.get(e.pointerId);
   if(!p||!controlsRef.current.enabled)return;
   const dx=e.clientX-p.x,dy=e.clientY-p.y;
   p.x=e.clientX;p.y=e.clientY;
   if(drag.mode==='pinch'&&pointers.size===2){const d=pinchDistance();if(drag.pinch)zoom(drag.pinch/d);drag.pinch=d;return}
   if(drag.mode==='orbit'){
    r.goal.theta-=dx*.006;
    r.goal.phi=THREE.MathUtils.clamp(r.goal.phi-dy*.005,ORBIT_LIMITS.minPhi,ORBIT_LIMITS.maxPhi);
   }else if(drag.mode==='pan'){
    const scale=r.goal.r*.0016;
    right.set(Math.cos(r.cur.theta),0,-Math.sin(r.cur.theta));
    forward.set(-Math.sin(r.cur.theta),0,-Math.cos(r.cur.theta));
    r.goal.target.addScaledVector(right,-dx*scale).addScaledVector(forward,dy*scale);
    clampTarget(r.goal.target);
   }else if(drag.mode==='look'){
    r.yawGoal-=dx*.004;
    r.pitchGoal=THREE.MathUtils.clamp(r.pitchGoal-dy*.004,-1.2,1.2);
   }
  };
  const end=e=>{
   if(!pointers.has(e.pointerId))return;
   pointers.delete(e.pointerId);
   if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
   if(pointers.size===1){drag.mode=r.mode==='eye'?'look':'orbit';drag.pinch=0}
   if(!pointers.size)drag.mode=null;
  };
  const wheel=e=>{
   if(!controlsRef.current.enabled)return;
   e.preventDefault();
   zoom(1+THREE.MathUtils.clamp(e.deltaY,-120,120)*.0012);
  };
  const context=e=>e.preventDefault();
  el.addEventListener('pointerdown',onDown);
  el.addEventListener('pointermove',onMove);
  el.addEventListener('pointerup',end);
  el.addEventListener('pointercancel',end);
  el.addEventListener('wheel',wheel,{passive:false});
  el.addEventListener('contextmenu',context);
  return()=>{
   el.removeEventListener('pointerdown',onDown);
   el.removeEventListener('pointermove',onMove);
   el.removeEventListener('pointerup',end);
   el.removeEventListener('pointercancel',end);
   el.removeEventListener('wheel',wheel);
   el.removeEventListener('contextmenu',context);
  };
 },[camera,gl,scene,controlsRef]);
 return null;
}
function CitySurroundings(){
 // Free OpenStreetMap context; unlocks zooming out to the surrounding streets.
 const city=useCityData();
 useEffect(()=>{if(!city)return;ORBIT_LIMITS.maxR=Math.max(400,(city.radius||700)*1.4);ORBIT_LIMITS.panRadius=city.radius||700;return()=>{ORBIT_LIMITS.maxR=110;ORBIT_LIMITS.panRadius=0}},[city]);
 return <CityContext data={city}/>;
}
function Room({data,update,selected,setSelected,view,onDragStart,onDragEnd,tool,seatingMode=false,onSeatClick,seatFocus,seatSelection,onClearSeat,onTableSeatSelect,seatDietary}){const controlsRef=useRef({enabled:true});const [hovered,setHovered]=useState(null);const moveTable=(id,x,z)=>update(s=>({...s,tables:s.tables.map(t=>t.id===id?{...t,x,z}:t)}));const moveStage=(x,z)=>update(s=>({...s,stage:{...s.stage,x,z}}));return <Canvas onPointerMove={e=>{const object=e.intersections?.find(hit=>hit.object.userData?.editable)?.object;setHovered(object?.userData?.editable||null)}} shadows camera={{position:[36,31,37],fov:46,near:.1,far:1500}} onPointerMissed={()=>{setSelected(null);setHovered(null);if(seatingMode)onClearSeat?.()}} gl={{antialias:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.15,outputColorSpace:THREE.SRGBColorSpace}} dpr={[1,1.35]}><color attach="background" args={['#10151b']}/><fog attach="fog" args={['#10151b',65,125]}/><VenueLighting mode={data.lighting}/><group><Box position={[0,-.22,0]} args={[LENGTH+.7,.4,WIDTH+.7]} color="#8a8379"/><Carpet/><CitySurroundings/><StudioEnvironment intensity={data.lighting==='warm'?.28:.42}/><Walls showRoof={data.showRoof} warm={data.lighting==='warm'}/><CeilingDetails showRoof={data.showRoof} warm={data.lighting==='warm'}/><ChandelierSet warm={data.lighting==='warm'}/><ExitDoor x={-8.5} z={-WIDTH/2+.22}/><ExitDoor x={6.4} z={-WIDTH/2+.22}/><ExitDoor x={-7} z={WIDTH/2-.22} rotation={Math.PI}/><ExitDoor x={7.5} z={WIDTH/2-.22} rotation={Math.PI}/><ExitDoor x={LENGTH/2-.22} z={5.2} rotation={-Math.PI/2}/>{data.showAv&&<AV/>}{data.tables.map(t=><Table key={t.id} highlight={hovered==='table-'+t.id} controlsRef={controlsRef} tool={tool} seatingMode={seatingMode} onSeatClick={onSeatClick} onTableSeatSelect={onTableSeatSelect} seatDietary={seatDietary} seatSelection={seatSelection} showTableLabels={data.showTableLabels} onDragStart={onDragStart} onDragEnd={onDragEnd} data={t} selected={selected?.type==='table'&&selected.id===t.id} onSelect={setSelected} onMove={moveTable} theme={data.theme} flowers={data.flowers} decor={data.showDecor}/>)}{data.showStage&&<Stage highlight={hovered==='stage'} controlsRef={controlsRef} tool={tool} onDragStart={onDragStart} onDragEnd={onDragEnd} data={data.stage} selected={selected?.type==='stage'} onSelect={setSelected} onMove={moveStage}/>} <Box position={[-LENGTH/2+.45,3.8,0]} args={[.15,5.29,9.6]} color="#171719"/> {data.showArch&&<group position={[0,0,4]}><Box position={[-2,2,0]} args={[.2,4,.2]} color="#b99b64"/><Box position={[2,2,0]} args={[.2,4,.2]} color="#b99b64"/><Box position={[0,4,0]} args={[4.2,.2,.2]} color="#b99b64"/></group>}</group><CameraRig view={view} controlsRef={controlsRef} seatFocus={seatFocus}/></Canvas>}
function App({onNavigate=()=>{},planner,onPlannerChange,initialMode='design'}){const [tool,setTool]=useState('select');const [data,setRawData]=useState(load);const history=useRef([]);const future=useRef([]);const current=useRef(data);current.current=data;const draggingHistory=useRef(null);const [revision,setRevision]=useState(0);const setData=(action)=>{setRawData(prev=>{const next=typeof action==='function'?action(prev):action;if(JSON.stringify(next)===JSON.stringify(prev))return prev;if(!draggingHistory.current){history.current.push(structuredClone(prev));if(history.current.length>80)history.current.shift();future.current=[];setRevision(v=>v+1)}return next})};const dragStart=()=>{draggingHistory.current=structuredClone(current.current)};const dragEnd=()=>{if(draggingHistory.current){if(JSON.stringify(draggingHistory.current)!==JSON.stringify(current.current)){history.current.push(draggingHistory.current);if(history.current.length>80)history.current.shift();future.current=[];setRevision(v=>v+1)}draggingHistory.current=null}};const undo=()=>{if(!history.current.length)return;future.current.push(structuredClone(current.current));setRawData(history.current.pop());setSelected(null);setRevision(v=>v+1)};const redo=()=>{if(!future.current.length)return;history.current.push(structuredClone(current.current));setRawData(future.current.pop());setSelected(null);setRevision(v=>v+1)};useEffect(()=>{const handler=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[]);const [screen,setScreen]=useState('studio');const [marketItems,setMarketItems]=useState([]);const [sideTab,setSideTab]=useState('main');const [view,setView]=useState('dollhouse');const [studioMode,setStudioMode]=useState(initialMode);const [seatSelection,setSeatSelection]=useState(null);const [seatingTable,setSeatingTable]=useState(null);const seatDietary=data.seatDietary||{};const setSeatDietary=updater=>setData(prev=>({...prev,seatDietary:typeof updater==='function'?updater(prev.seatDietary||{}):updater}));const [seatFocus,setSeatFocus]=useState(null);const [selected,setSelected]=useState(null);const [message,setMessage]=useState('');const count=data.tables.reduce((s,t)=>s+t.chairs,0);const removeType=(id)=>setData(prev=>({...prev,inventory:prev.inventory.filter(x=>x!==id),tables:id==='table'?[]:prev.tables,showDecor:id==='flowers'?false:prev.showDecor,showStage:id==='stage'?false:prev.showStage,showScreen:id==='screen'?false:prev.showScreen,showArch:id==='arch'?false:prev.showArch}));const patch=(k,v)=>setData(s=>({...s,[k]:v}));const addTable=()=>{const id=Math.max(0,...data.tables.map(t=>t.id))+1;setData(s=>({...s,tables:[...s.tables,{id,x:0,z:0,chairs:10,gap:.22,rotation:0}]}));setSelected({type:'table',id})};const applyTableSettingsToAll=()=>{if(!selectedTable)return;setData(prev=>({...prev,tables:prev.tables.map(t=>({...t,chairs:selectedTable.chairs,gap:selectedTable.gap??.22}))}))};const selectedTable=selected?.type==='table'?data.tables.find(t=>t.id===selected.id):null;const changeSelected=(field,val)=>{if(selectedTable)setData(s=>({...s,tables:s.tables.map(t=>t.id===selectedTable.id?{...t,[field]:val}:t)}));else if(selected?.type==='stage')setData(s=>({...s,stage:{...s.stage,[field]:val}}))};const addMarketplaceItem=(item)=>{if(marketItems.some(x=>x.id===item.id))return;setMarketItems(prev=>[...prev,item]);onPlannerChange?.(prev=>({...prev,savedItems:prev.savedItems.some(x=>x.id===item.id)?prev.savedItems:[...prev.savedItems,item]}));if(item.inventoryType){setData(prev=>({...prev,inventory:prev.inventory.includes(item.inventoryType)?prev.inventory:[...prev.inventory,item.inventoryType],showDecor:item.inventoryType==='flowers'?true:prev.showDecor,showArch:item.inventoryType==='arch'?true:prev.showArch}));}};const save=()=>{localStorage.setItem(venue.storageKey,JSON.stringify(data));setMessage('Saved in this browser.');setTimeout(()=>setMessage(''),2500)};return <div className="app">{screen==='marketplace'?<Marketplace onBack={()=>setScreen('studio')} onAdd={addMarketplaceItem} added={marketItems.map(x=>x.id)}/>:<div className="body"><main className="viewer"><div className="canvas-wrap"><div className="views floating-views">{[['dollhouse','3D dollhouse'],['plan','Floor plan'],['walk','Guest view']].map(([k,t])=><button key={k} className={view===k?'active':''} onClick={()=>setView(k)}>{t}</button>)}</div><div className="floating-tools"><button title="Select and drag furniture" className={tool==='select'?'active':''} onClick={()=>setTool('select')}><MousePointer2 size={17}/></button><button title="Measure tool (coming next)" disabled><Ruler size={17}/></button></div><Room data={data} update={setData} onDragStart={dragStart} onDragEnd={dragEnd} selected={selected} setSelected={setSelected} view={view} tool={tool} seatingMode={studioMode==='seating'} seatFocus={seatFocus} seatSelection={seatSelection} onClearSeat={()=>{setSeatSelection(null);setSeatingTable(null)}} onTableSeatSelect={(tableId)=>{setSeatingTable(tableId);setSeatSelection(null);setSelected(null)}} seatDietary={seatDietary} onSeatClick={(tableId,seatNumber)=>{setSeatingTable(tableId);setSeatSelection({tableId,seatNumber});setSelected(null)}}/><div className="hint"><Move size={15}/> Drag furniture · Drag to orbit (or look around in Guest view) · Right-drag to pan · Scroll to zoom</div><button type="button" className="viewer-fullscreen" title="Fullscreen ballroom" onClick={e=>{const element=e.currentTarget.closest('.canvas-wrap');if(!document.fullscreenElement)element?.requestFullscreen?.();else document.exitFullscreen?.()}}><Maximize2 size={16}/></button><div className="legend"><span className="dot"/> {selected?selected.type==='stage'?'Stage selected':`Table ${selected.id} selected`:'Select furniture to edit'}</div></div><div className="bottom-note"><Info size={15}/> Dimensions are published; fixture positions and appearance are estimated from photos. Not a hotel-approved event plan.</div></main><aside className={"sidebar "+(studioMode==='seating'?'sidebar-seating':'sidebar-design')}><div className="studio-sidebar-heading"><div className="studio-mode-indicator">{studioMode==='seating'?'SEATING PLAN':'DESIGN STUDIO'}</div><h1>{venue.roomName}</h1><div className="studio-quick-actions"><button type="button" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" onClick={undo} disabled={!history.current.length}><Undo2 size={17}/></button><button type="button" title="Redo" aria-label="Redo" onClick={redo} disabled={!future.current.length}><Redo2 size={17}/></button><button type="button" className="studio-save-action" onClick={save}><Save size={15}/> Save</button></div></div>{studioMode==='seating'&&<div className="seat-editor"><h3>Guest seating</h3><p>Click a table to edit its name and notes, or a chair to assign a guest and dietary requirements.</p>{seatingTable!==null&&<><strong>Table {seatingTable}{seatSelection?' · Seat '+seatSelection.seatNumber:''}</strong><label htmlFor="seating-table-title">Table title</label><input id="seating-table-title" className="table-title-input" maxLength={45} placeholder="e.g. Office friends" value={data.tables.find(t=>t.id===seatingTable)?.title||''} onChange={e=>setData(prev=>({...prev,tables:prev.tables.map(t=>t.id===seatingTable?{...t,title:e.target.value}:t)}))}/><label htmlFor="seating-table-notes">Table notes</label><textarea id="seating-table-notes" rows={2} className="table-title-input" placeholder="Family group, accessibility needs, special arrangements..." value={data.tables.find(t=>t.id===seatingTable)?.notes||''} onChange={e=>setData(prev=>({...prev,tables:prev.tables.map(t=>t.id===seatingTable?{...t,notes:e.target.value}:t)}))}/><div className="seating-table-summary">{data.tables.find(t=>t.id===seatingTable)?.chairs||0} seats · {(planner?.guests||[]).filter(g=>g.tableId===String(seatingTable)&&g.seatId).length} assigned</div></>}{seatSelection&&<><h4>Seat {seatSelection.seatNumber}</h4><label>Assigned guest</label><select value={planner?.guests?.find(g=>g.tableId===String(seatSelection.tableId)&&g.seatId===String(seatSelection.seatNumber))?.id||''} onChange={e=>{const id=e.target.value;onPlannerChange?.(prev=>({...prev,guests:prev.guests.map(g=>{if(g.tableId===String(seatSelection.tableId)&&g.seatId===String(seatSelection.seatNumber))return {...g,tableId:'',seatId:''};if(g.id===id)return {...g,tableId:String(seatSelection.tableId),seatId:String(seatSelection.seatNumber)};return g})}))}}><option value="">Unassigned</option>{(planner?.guests||[]).filter(g=>!g.seatId||(g.tableId===String(seatSelection.tableId)&&g.seatId===String(seatSelection.seatNumber))).map(g=><option value={g.id} key={g.id}>{g.name||'Unnamed guest'}</option>)}</select><label>Dietary preferences & allergies</label><div className="dietary-options">{DIETARY_OPTIONS.map(option=>{const key=String(seatSelection.tableId)+':'+String(seatSelection.seatNumber);const tags=seatDietary[key]||[];return <label key={option.id}><input type="checkbox" checked={tags.includes(option.id)} onChange={e=>setSeatDietary(prev=>({...prev,[key]:e.target.checked?[...tags,option.id]:tags.filter(x=>x!==option.id)}))}/>{option.label}</label>})}</div><p className="muted">Navy-on-white icons appear above the chair. Verify allergies directly with guests and caterers.</p><button onClick={()=>{const t=data.tables.find(t=>t.id===seatSelection.tableId);if(!t)return;const a=(seatSelection.seatNumber-1)*Math.PI*2/t.chairs+(t.rotation||0);const radius=1.16+(t.gap??.22);setSeatFocus({x:t.x+Math.sin(a)*radius,z:t.z+Math.cos(a)*radius,lookX:t.x,lookZ:t.z});setView('walk')}}>Experience this seat</button><button onClick={()=>{setSeatFocus(null);setView('dollhouse')}}>Return to room</button></>}</div>}<div className="side-tabs"><button className={sideTab==='main'?'active':''} onClick={()=>setSideTab('main')}><SlidersHorizontal size={15}/> Main</button><button className={sideTab==='inventory'?'active':''} onClick={()=>setSideTab('inventory')}><BoxIcon size={15}/> Inventory</button></div>{sideTab==='inventory'?<div className="inventory-list">{[{id:'table',name:'Banquet tables',icon:'◉'},{id:'flowers',name:'Table flowers',icon:'✿'},{id:'stage',name:'Wedding stage',icon:'▰'},{id:'screen',name:'LED screen',icon:'▣'},{id:'arch',name:'Floral arch',icon:'⌒'}].map(item=>{const has=data.inventory.includes(item.id);return <button key={item.id} className={'inventory-item '+(has?'added':'')} disabled={has} onClick={()=>setData(s=>({...s,inventory:[...s.inventory,item.id],showStage:item.id==='stage'?true:s.showStage,showScreen:item.id==='screen'?true:s.showScreen,showArch:item.id==='arch'?true:s.showArch,showDecor:item.id==='flowers'?true:s.showDecor}))}><span className="inventory-thumb"><img src={`/thumbs/${item.id}.png`} alt={item.name}/></span><span>{item.name}</span><strong>{has?'ADDED':'+ Add'}</strong></button>})}<button className="marketplace-pill" onClick={()=>setScreen('marketplace')}><Store size={17}/> Marketplace <span>→</span></button></div>:<><details className="settings-accordion studio-group"><summary><Sun size={16}/> Venue environment</summary><div className="settings-accordion-body"><label className="toggle"><input type="checkbox" checked={data.showRoof} onChange={e=>patch('showRoof',e.target.checked)}/> Show ceiling slab</label><label className="toggle"><input type="checkbox" checked={data.showAv} onChange={e=>patch('showAv',e.target.checked)}/> Show suspended AV equipment</label></div></details>
{data.inventory.includes('table')&&<details className="settings-accordion studio-group" open><summary><Armchair size={16}/> Banquet tables</summary><div className="settings-accordion-body"><div className="stat-row"><div><small>TABLES</small><b>{data.tables.length}</b></div><div><small>GUEST SEATS</small><b>{count}</b></div><div><small>CAPACITY</small><b>{venue.publishedCapacity}</b></div></div>{count>venue.publishedCapacity&&<div className="warning">Exceeds the venue's published banquet capacity.</div>}<div className="buttonrow"><button onClick={addTable}><Plus size={15}/> Add table</button><button onClick={()=>setData(s=>({...s,tables:s.tables.slice(0,-1)}))} disabled={!data.tables.length}><Minus size={15}/> Remove last</button></div><p className="muted">Select a table in the ballroom to adjust its chairs and spacing.</p><div className="table-planning-controls"><button className="seating-plan-button" onClick={()=>{setStudioMode(studioMode==='seating'?'design':'seating');setSeatSelection(null);setSeatFocus(null);if(studioMode==='seating')setView('dollhouse')}}>{studioMode==='seating'?'← Return to design':'Seating Plan →'}</button><label className="toggle"><input type="checkbox" checked={!!data.showTableLabels} onChange={e=>patch('showTableLabels',e.target.checked)}/> Show table titles</label><p className="muted">Table titles appear above the tables when enabled. Select a table to name it.</p></div><button className="remove-type" onClick={()=>removeType('table')}>Remove tables from inventory</button></div></details>}
<details className="settings-accordion studio-group" open><summary><MousePointer2 size={16}/> Selected item</summary><div className="settings-accordion-body">{selectedTable?<><div className="selected-table-heading"><p className="selected-name">Table #{selectedTable.id}</p><button type="button" className="apply-all" onClick={applyTableSettingsToAll}>Apply to all</button></div><label>Table title</label><input className="table-title-input" type="text" maxLength={45} placeholder={`Table ${selectedTable.id} · e.g. Office friends`} value={selectedTable.title||''} onChange={e=>changeSelected('title',e.target.value)}/><p className="muted">Optional. Visible above the table when Show table titles is enabled.</p><label>Chairs around table <b>{selectedTable.chairs}</b></label><input type="range" min="4" max="12" value={selectedTable.chairs} onChange={e=>changeSelected('chairs',Number(e.target.value))}/><label>Chair-to-table gap <b>{((selectedTable.gap??.22)*100).toFixed(0)} cm</b></label><input type="range" min="0" max=".8" step=".02" value={selectedTable.gap??.22} onChange={e=>changeSelected('gap',Number(e.target.value))}/><button className="danger" onClick={()=>{setData(s=>({...s,tables:s.tables.filter(t=>t.id!==selectedTable.id)}));setSelected(null)}}><Trash2 size={15}/> Delete selected table</button></>:selected?.type==='stage'?<><p className="selected-name">Wedding stage</p><label>Stage width <b>{data.stage.width.toFixed(1)} m</b></label><input type="range" min="2" max="10" step=".2" value={data.stage.width} onChange={e=>changeSelected('width',Number(e.target.value))}/><label>Stage depth <b>{data.stage.depth.toFixed(1)} m</b></label><input type="range" min="2" max="10" step=".2" value={data.stage.depth} onChange={e=>changeSelected('depth',Number(e.target.value))}/></>:<p className="muted">Click a table or stage to customize it.</p>}</div></details>
{data.inventory.includes('stage')&&<details className="settings-accordion studio-group"><summary><Layers3 size={16}/> Wedding stage</summary><div className="settings-accordion-body"><label className="toggle"><input type="checkbox" checked={data.showStage} onChange={e=>patch('showStage',e.target.checked)}/> Show stage</label><button className="remove-type" onClick={()=>removeType('stage')}>Remove from inventory</button></div></details>}
{data.inventory.includes('screen')&&<details className="settings-accordion studio-group"><summary><Layers3 size={16}/> LED screen</summary><div className="settings-accordion-body"><label className="toggle"><input type="checkbox" checked={data.showScreen} onChange={e=>patch('showScreen',e.target.checked)}/> Show screen</label><button className="remove-type" onClick={()=>removeType('screen')}>Remove from inventory</button></div></details>}
{data.inventory.includes('arch')&&<details className="settings-accordion studio-group"><summary><Layers3 size={16}/> Floral arch</summary><div className="settings-accordion-body"><label className="toggle"><input type="checkbox" checked={data.showArch} onChange={e=>patch('showArch',e.target.checked)}/> Show arch</label><button className="remove-type" onClick={()=>removeType('arch')}>Remove from inventory</button></div></details>}
<details className="settings-accordion studio-group" open><summary><Palette size={16}/> Wedding styling</summary><div className="settings-accordion-body"><label>Lighting</label><div className="choice-row"><button className={'choice warm '+(data.lighting==='warm'?'selected':'')} onClick={()=>patch('lighting','warm')}>Warm evening</button><button className={'choice bright '+(data.lighting==='bright'?'selected':'')} onClick={()=>patch('lighting','bright')}>Bright daylight</button></div><label>Tablecloth and chair colour</label><div className="swatches">{Object.entries(palette).map(([k,c])=><button title={k} key={k} onClick={()=>patch('theme',k)} className={data.theme===k?'chosen':''} style={{background:c}}/>)}</div>{data.inventory.includes('flowers')&&<><label>Floral arrangement <button className="remove-type" onClick={()=>removeType('flowers')}>Remove</button></label><div className="choice-row">{[['white','Ivory','#eee8da'],['pink','Blush','#d9a5b1'],['green','Greenery','#8ea589']].map(([key,label,color])=><button key={key} className={'choice '+(data.flowers===key?'selected':'')} style={{background:color}} onClick={()=>patch('flowers',key)}>{label}</button>)}</div></>}</div></details>
<details className="settings-accordion studio-group"><summary><ShoppingBag size={16}/> Marketplace selections {marketItems.length>0?'('+marketItems.length+')':''}</summary><div className="settings-accordion-body">{marketItems.length?marketItems.map(item=><div className="market-selected" key={item.id}><span>{item.name}<small>{item.price===null?'Quote required':`From S$${item.price}`}</small></span><button onClick={()=>setMarketItems(prev=>prev.filter(x=>x.id!==item.id))}>Remove</button></div>):<p className="muted">No marketplace items selected yet.</p>}<button className="marketplace-link" onClick={()=>{setSideTab('inventory');setScreen('marketplace')}}>Browse marketplace →</button></div></details>
<section className="studio-reset"><button className="reset" onClick={()=>{if(confirm('Reset all your changes?')){setData(initialState);setSelected(null)}}}><RotateCcw size={15}/> Reset layout</button></section><div className="disclaimer">Prototype limitations: no collision or emergency egress certification; furniture can overlap. Exit locations, chandelier placement and materials are provisional. Do not use for actual booking or safety decisions.</div></>}</aside></div>}{message&&<div className="toast">{message}</div>}</div>}

createRoot(document.getElementById('root')).render(<PlatformApp Studio={App}/>);

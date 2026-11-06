// Procedural flowers for the 3D studio: roses, hydrangeas, buds and leaves built from
// curved petal and leaf surfaces, then merged into one flower geometry and one leaf
// geometry per arrangement (vertex colours), so 30 tables can share a single bouquet.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

/** A grid surface: x across (-1..1 scaled by width(t)), y along (0..length), z from shape(s,t). */
function surface({U=4,V=6,length,width,shape,shade}){
 const pos=[],col=[],idx=[];
 for(let v=0;v<=V;v++){const t=v/V,hw=width(t);
  for(let u=0;u<=U;u++){const s=u/U*2-1;pos.push(s*hw,t*length,shape(s,t,hw));const c=shade(s,t);col.push(c,c,c)}}
 for(let v=0;v<V;v++)for(let u=0;u<U;u++){const a=v*(U+1)+u,b=a+1,c=a+U+1,d=c+1;idx.push(a,c,b,b,c,d)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
/** One rose petal; the concave (inner) face points to +z. */
// Detail levels: lo for the 30 table bouquets, mid for the arch, hi for close-ups.
export const DETAIL={lo:{U:3,V:4,petals:12,florets:20,fU:1,fV:1,lU:2,lV:3},mid:{U:3,V:5,petals:15,florets:24,fU:1,fV:2,lU:2,lV:4},hi:{U:6,V:8,petals:22,florets:42,fU:2,fV:3,lU:6,lV:8}};
function petal(L,W,cup,curl,d=DETAIL.hi){
 return surface({U:d.U,V:d.V,length:L,
  width:t=>W*Math.pow(Math.max(0,1-Math.pow(Math.abs(t-.58)/(t>.58?.42:.58),2.4)),.5),   // rounded tip
  shape:(s,t,hw)=>cup*s*s*hw-curl*t*t*t*L,
  shade:(s,t)=>.78+.22*Math.min(1,t*1.6)-.05*Math.abs(s)});
}
const place=(g,{tilt=0,yaw=0,r=0,y=0,roll=0})=>{const m=new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeTranslation(0,y,-r)).multiply(new THREE.Matrix4().makeRotationX(-tilt)).multiply(new THREE.Matrix4().makeRotationZ(roll));g.applyMatrix4(m);return g};

/** A rose head ~7 cm across, opening along +y. */
export function roseGeometry(seed=1,open=1,d=DETAIL.hi){
 const R=rng(seed),parts=[];const n=d.petals;
 for(let i=0;i<n;i++){const k=i/(n-1);
  const L=.022+.03*k,W=.012+.017*k,tilt=(.1+.95*k*k)*(.75+.25*open),yaw=i*2.39996+R()*.25,r=.002+.012*k;
  parts.push(place(petal(L,W,.55+.3*(1-k),k>.6?.35*open:.05,d),{tilt,yaw,r,y:-.006*k,roll:(R()-.5)*.2}));
 }
 const bud=new THREE.SphereGeometry(.007,6,4);const c=new Float32Array(bud.attributes.position.count*3).fill(.7);bud.setAttribute('color',new THREE.BufferAttribute(c,3));bud.translate(0,.012,0);
 bud.deleteAttribute('uv');parts.push(bud);
 return mergeGeometries(parts);
}
/** A hydrangea head: about 40 four-petal florets on a dome, ~9 cm across. */
export function hydrangeaGeometry(seed=2,d=DETAIL.hi){
 const R=rng(seed),parts=[],n=d.florets;
 for(let i=0;i<n;i++){
  const y=1-(i/(n-1))*.75,rad=Math.sqrt(1-y*y),phi=i*2.39996;
  const nrm=new THREE.Vector3(Math.cos(phi)*rad,y,Math.sin(phi)*rad).normalize();
  for(let p=0;p<4;p++){
   const g=surface({U:d.fU,V:d.fV,length:.011*(42/n)**.5,width:t=>.0075*(42/n)**.5*Math.sin(Math.PI*(.15+.8*t)),shape:(s,t)=>.003*t*t,shade:(s,t)=>.86+.14*t});
   g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2+.25)).applyMatrix4(new THREE.Matrix4().makeRotationY(p*Math.PI/2+R()*.4));
   const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),nrm);
   g.applyMatrix4(new THREE.Matrix4().compose(nrm.clone().multiplyScalar(.04),q,new THREE.Vector3(1,1,1)));
   parts.push(g);
  }
 }
 return mergeGeometries(parts);
}
/** A leaf ~9 cm long along +y, folded along the midrib and bent back. */
export function leafGeometry(seed=3,len=.09,narrow=1,d=DETAIL.hi){
 const bend=.7+.6*rng(seed)();
 const g=surface({U:d.lU,V:d.lV,length:len,width:t=>len*.24*narrow*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),.85),
  shape:(s,t,hw)=>.45*Math.abs(s)*hw-.35*t*t*len*bend,
  shade:(s,t)=>.72+.28*Math.abs(s)-.12*t});
 return g;
}
/** A small closed bud on a stem tip (spray roses, filler). */
export function budGeometry(seed=4,d=DETAIL.hi){const parts=[];for(let i=0;i<5;i++)parts.push(place(petal(.016,.009,.9,0,d),{tilt:.15,yaw:i*1.25,r:.002}));return mergeGeometries(parts)}

const TEMPLATES={};
function template(kind,variant,detail){
 const key=kind+variant+detail;if(TEMPLATES[key])return TEMPLATES[key];
 const d=DETAIL[detail]||DETAIL.lo;
 const make={rose:()=>roseGeometry(7+variant,1,d),roseHalf:()=>roseGeometry(11+variant,.55,d),hydrangea:()=>hydrangeaGeometry(5+variant,d),leaf:()=>leafGeometry(3+variant,.09,1,d),eucalyptus:()=>leafGeometry(9+variant,.05,1.7,d),bud:()=>budGeometry(4+variant,d)}[kind];
 return TEMPLATES[key]=make();
}
/**
 * Merge many flower placements into {flowers, leaves} geometries.
 * item: {kind, position:[x,y,z], dir:[x,y,z] (the way the head faces), scale, color:'#rrggbb', spin}
 */
export function assemble(items,detail='lo'){
 const flowers=[],leaves=[];const up=new THREE.Vector3(0,1,0);
 for(const it of items){
  const g=template(it.kind,it.variant||0,detail).clone();
  const dir=new THREE.Vector3(...it.dir).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(up,dir).multiply(new THREE.Quaternion().setFromAxisAngle(up,it.spin||0));
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...it.position),q,new THREE.Vector3(it.scale,it.scale,it.scale)));
  const c=new THREE.Color(it.color),col=g.attributes.color;
  for(let i=0;i<col.count;i++)col.setXYZ(i,col.getX(i)*c.r,col.getY(i)*c.g,col.getZ(i)*c.b);
  (it.kind==='leaf'||it.kind==='eucalyptus'?leaves:flowers).push(g);
 }
 const out={flowers:flowers.length?mergeGeometries(flowers):null,leaves:leaves.length?mergeGeometries(leaves):null};
 return out;
}

export const FLORAL_PALETTES={
 white:{rose:['#f4efe6','#efe6d8','#f8f4ee'],hydrangea:['#eef0e8','#f3f1ea'],accent:'#e9d9c4',leaf:['#55704c','#6d8a63','#7f9a86']},
 pink:{rose:['#e8b6bd','#f1cfd2','#d99aa5'],hydrangea:['#f2dde0','#ecd2d8'],accent:'#f6ece6',leaf:['#55704c','#6d8a63','#86a08c']},
 green:{rose:['#f4efe6','#eef0e4'],hydrangea:['#dfe8cf','#e9eedd'],accent:'#cfdcbf',leaf:['#4d6a46','#6a8a5e','#8aa58f','#5f7d57']},
};
const pick=(R,arr)=>arr[Math.floor(R()*arr.length)%arr.length];

/** Domed table bouquet sitting on a vase rim at y=0, ~50 cm across. */
export function bouquetItems(variant='white',seed=21){
 const P=FLORAL_PALETTES[variant]||FLORAL_PALETTES.white,R=rng(seed),items=[];
 const N=38;
 for(let i=0;i<N;i++){
  const y=1-(i/(N-1))*.86,rad=Math.sqrt(1-y*y),phi=i*2.39996;
  const dir=[Math.cos(phi)*rad,y*.9+.1,Math.sin(phi)*rad];
  const pos=[dir[0]*.2,.05+y*.13,dir[2]*.2];
  const roll=R();const greenWeight=variant==='green'?.45:.12;
  if(roll<greenWeight){items.push({kind:'eucalyptus',position:pos,dir,scale:1.2,color:pick(R,P.leaf),spin:R()*6})}
  else if(roll<.55)items.push({kind:R()<.7?'rose':'roseHalf',variant:i%3,position:pos,dir,scale:1.35+R()*.35,color:pick(R,P.rose),spin:R()*6});
  else if(roll<.8)items.push({kind:'hydrangea',variant:i%2,position:pos,dir,scale:.85+R()*.25,color:pick(R,P.hydrangea),spin:R()*6});
  else items.push({kind:'bud',variant:i%2,position:pos.map((v,k)=>k===1?v+.02:v*1.08),dir,scale:1.1,color:P.accent,spin:R()*6});
 }
 for(let i=0;i<22;i++){const a=i*2.39996,droop=.5+R()*.9;const dir=[Math.cos(a),-droop,Math.sin(a)];
  items.push({kind:R()<.4?'leaf':'eucalyptus',variant:i%3,position:[Math.cos(a)*.16,.01+R()*.03,Math.sin(a)*.16],dir,scale:.85+R()*.45,color:pick(R,P.leaf),spin:R()*6})}
 return items;
}

/** Points along the arch frame (posts plus a semicircular top), with the frame's outward normal. */
export function archPath(width=4,postH=2.2){
 const r=width/2,pts=[];
 const seg=(a,b,n)=>{for(let i=0;i<n;i++){const t=i/n;pts.push({p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],n:[Math.sign(a[0]),0]})}};
 seg([-r,0],[-r,postH],22);
 for(let i=0;i<=48;i++){const th=Math.PI-i/48*Math.PI;pts.push({p:[Math.cos(th)*r,postH+Math.sin(th)*r],n:[Math.cos(th),Math.sin(th)]})}
 seg([r,postH],[r,0],22);
 return pts;
}
/** Asymmetric floral arch: a full cluster over the top-left, a smaller one low on the right, greenery between. */
export function archItems(variant='white',seed=41,width=4,postH=2.2){
 const P=FLORAL_PALETTES[variant]||FLORAL_PALETTES.white,R=rng(seed),items=[],path=archPath(width,postH);
 const total=path.length;
 path.forEach((pt,i)=>{
  const u=i/(total-1);                          // 0 bottom-left … 1 bottom-right
  const main=Math.exp(-Math.pow((u-.33)/.13,2)),side=Math.exp(-Math.pow((u-.9)/.06,2)),green=.35+.5*Math.exp(-Math.pow((u-.55)/.25,2));
  const density=main*12+side*8;
  const count=Math.round(density+(R()<green?3:1));
  for(let k=0;k<count;k++){
   const around=R()*Math.PI*2,spread=.08+.26*(main+side*.7)*Math.sqrt(R());
   const nx=pt.n[0],ny=pt.n[1];
   // offset within the plane perpendicular to the frame: outward (nx,ny) and depth z
   const out=Math.cos(around)*spread,depth=Math.sin(around)*spread*1.4;
   const pos=[pt.p[0]+nx*out,pt.p[1]+ny*out,depth];
   const dir=[nx*Math.cos(around)*.8+(R()-.5)*.4,ny*Math.cos(around)*.8+(R()-.5)*.4+.15,Math.sin(around)];
   const flowerChance=(main+side)>.25?.62:.08;
   const roll=R();
   if(roll<flowerChance*.55)items.push({kind:R()<.65?'rose':'roseHalf',variant:k%3,position:pos,dir,scale:2.6+R()*1.1,color:pick(R,P.rose),spin:R()*6});
   else if(roll<flowerChance*.85)items.push({kind:'hydrangea',variant:k%2,position:pos,dir,scale:2.5+R()*.8,color:pick(R,P.hydrangea),spin:R()*6});
   else if(roll<flowerChance)items.push({kind:'bud',variant:k%2,position:pos,dir,scale:2.6,color:P.accent,spin:R()*6});
   else items.push({kind:R()<.55?'leaf':'eucalyptus',variant:k%3,position:pos,dir:[dir[0],dir[1]-.3,dir[2]],scale:2.2+R()*1.6,color:pick(R,P.leaf),spin:R()*6});
  }
 });
 // floor arrangements at both posts
 for(const [x,size] of [[-width/2,1],[width/2,.75]])for(let k=0;k<Math.round(48*size);k++){
  const a=R()*Math.PI*2,rr=R()*.45*size,h=R()*.5*size;
  const pos=[x+Math.cos(a)*rr,.05+h,Math.sin(a)*rr*1.2],dir=[Math.cos(a),.7,Math.sin(a)];
  const roll=R();
  if(roll<.4)items.push({kind:'rose',variant:k%3,position:pos,dir,scale:2.6+R()*.9,color:pick(R,P.rose),spin:R()*6});
  else if(roll<.62)items.push({kind:'hydrangea',variant:k%2,position:pos,dir,scale:2.6,color:pick(R,P.hydrangea),spin:R()*6});
  else items.push({kind:R()<.5?'leaf':'eucalyptus',variant:k%3,position:pos,dir:[dir[0],.2,dir[2]],scale:2+R(),color:pick(R,P.leaf),spin:R()*6});
 }
 return items;
}

// Small geometry helpers for building details (footprints are flat arrays
// [x0,z0,x1,z1,...] in map metres: x east, z south).
import * as THREE from 'three';

export function signedArea(f){let a=0;for(let i=0,j=f.length-2;i<f.length;j=i,i+=2)a+=(f[j]*f[i+1]-f[i]*f[j+1]);return a/2}
export function centroid(f){let x=0,z=0;const n=f.length/2;for(let i=0;i<f.length;i+=2){x+=f[i];z+=f[i+1]}return [x/n,z/n]}

/** Edges with length and outward unit normal. */
export function edges(f){
 const out=[],ccw=signedArea(f)>0,n=f.length/2;
 for(let i=0;i<n;i++){const ax=f[i*2],az=f[i*2+1],bx=f[((i+1)%n)*2],bz=f[((i+1)%n)*2+1],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.3)continue;
  const nx=ccw?dz/len:-dz/len,nz=ccw?-dx/len:dx/len;out.push({ax,az,bx,bz,len,dx:dx/len,dz:dz/len,nx,nz})}
 return out;
}

/** Footprint pushed outwards by d metres (mitre joins, clamped). */
export function offset(f,d){
 const n=f.length/2,ccw=signedArea(f)>0,out=[];
 for(let i=0;i<n;i++){
  const p=(i-1+n)%n,q=(i+1)%n,x=f[i*2],z=f[i*2+1];
  let ax=x-f[p*2],az=z-f[p*2+1],bx=f[q*2]-x,bz=f[q*2+1]-z;const la=Math.hypot(ax,az)||1,lb=Math.hypot(bx,bz)||1;ax/=la;az/=la;bx/=lb;bz/=lb;
  const s=ccw?1:-1;let nx=s*(az+bz),nz=-s*(ax+bx);const l=Math.hypot(nx,nz)||1;nx/=l;nz/=l;
  const cos=Math.max(.35,nx*s*az+nz*-s*ax);
  out.push(x+nx*d/cos,z+nz*d/cos);
 }
 return out;
}

export function shape(f){const pts=[];for(let i=0;i<f.length;i+=2)pts.push(new THREE.Vector2(f[i],-f[i+1]));if(THREE.ShapeUtils.isClockWise(pts))pts.reverse();return new THREE.Shape(pts)}

/** Solid slab of a footprint between y and y+t. */
export function slab(f,y,t){
 const g=new THREE.ExtrudeGeometry(shape(f),{depth:t,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);g.deleteAttribute('uv');return g;
}

/** Deterministic random numbers. */
export function rng(seed){let s=Math.floor(seed*1e6)||1;return()=>{s=(s*16807)%2147483647;return s/2147483647}}

/** Ring (e.g. roof parapet): footprint minus the footprint shrunk by w. */
export function ring(f,y,t,w=.35){
 const s=shape(f),inner=offset(f,-w),pts=[];for(let i=0;i<inner.length;i+=2)pts.push(new THREE.Vector2(inner[i],-inner[i+1]));
 if(!THREE.ShapeUtils.isClockWise(pts))pts.reverse();s.holes.push(new THREE.Path(pts));
 const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);g.deleteAttribute('uv');return g;
}

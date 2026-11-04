// Building surface shader: a standard (physically lit) material extended with
// procedural facades, so every building on the map gets floors and windows
// without textures or extra geometry.
//
// Per-vertex inputs (built in VenueExplorer buildTile):
//  color   wall colour            aRoof   roof colour
//  aStyle  (facade kind, storey height, per-building seed) – see palette.js
//
// Windows are drawn in world space along each wall, fade out with distance
// (no shimmering when zoomed out) and a few are lit warm, as at 6:20pm.
import * as THREE from 'three';

// Options for the pre-built city (scripts/build-city-3d.mjs):
//  packed  attributes come as Uint8 (aStyle = kind, storey×20, seed×255) and
//          there are no stored normals; normals come from screen derivatives
//  mask    {mode:'cell'|'base', texture, grid, tileSize}: a per-cell mask
//          texture cross-dissolves the always-loaded base blocks with the
//          full-detail cells (value 1 = full detail shown in that cell)
export function makeBuildingMaterial({sunDir,lit=.035,transparent=false,packed=false,mask=null}={}){
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0,transparent,flatShading:packed});
 const uniforms={
  uSun:{value:new THREE.Vector3(sunDir?.x??-.9,sunDir?.y??.12,sunDir?.z??.3).normalize()},
  uLit:{value:lit},
  uDetailFar:{value:1400},
  uTint:{value:new THREE.Color('#ffffff')},uTintAmt:{value:0},
  uMask:{value:mask?.texture||null},uGrid:{value:new THREE.Vector4(mask?.grid.ix0||0,mask?.grid.iz0||0,mask?.grid.w||1,mask?.grid.h||1)},uTile:{value:mask?.tileSize||1000},uShift:{value:new THREE.Vector2()}
 };
 const MODE=mask?(mask.mode==='base'?2:1):0;
 mat.userData.uniforms=uniforms;
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>',`#include <common>
attribute vec3 aRoof;attribute vec3 aStyle;
varying vec3 vRoof;varying vec3 vStyle;varying vec3 vWPos;varying vec3 vWNormal;varying float vMask;
uniform sampler2D uMask;uniform vec4 uGrid;uniform float uTile;uniform vec2 uShift;
${MODE===2?'attribute float aCell;attribute vec2 aPos;attribute vec4 aSize;attribute float aAng;':''}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
${MODE===2?`// base block placed on the GPU straight from the file: centre, size (0.25 m), height and base (0.1 m), angle
{vec3 p=position;float w=max(aSize.x/4.,.5),d=max(aSize.y/4.,.5),h=aSize.z/10.,mh=aSize.w/10.;
 p.x*=w;p.z*=d;p.y=mh+p.y*max(h-mh,.5);float a=aAng/255.*PI,c=cos(a),s=sin(a);
 transformed=vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c)+vec3(aPos.x,0.,aPos.y);}`:''}
vRoof=aRoof;vStyle=${packed?'vec3(aStyle.x,aStyle.y/20.,aStyle.z/255.)':'aStyle'};
#ifdef USE_INSTANCING
vWPos=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
#else
vWPos=(modelMatrix*vec4(transformed,1.)).xyz;
#endif
vWNormal=normalize(mat3(modelMatrix)*objectNormal);
vMask=1.;
${MODE===1?`{ivec2 c=ivec2(floor((modelMatrix[3].x-uShift.x)/uTile)-uGrid.x,floor((modelMatrix[3].z-uShift.y)/uTile)-uGrid.y);vMask=texelFetch(uMask,c,0).r;}`:''}
${MODE===2?`{float w=uGrid.z;ivec2 c=ivec2(mod(aCell,w),floor(aCell/w));vMask=1.-texelFetch(uMask,c,0).r;}`:''}`)
   .replace('#include <fog_vertex>',`#include <fog_vertex>
${MODE===2?'if(vMask<.004)gl_Position=vec4(2.,2.,2.,1.);  // hidden where full detail is shown':''}`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
uniform vec3 uSun;uniform float uLit;uniform float uDetailFar;uniform vec3 uTint;uniform float uTintAmt;
varying vec3 vRoof;varying vec3 vStyle;varying vec3 vWPos;varying vec3 vWNormal;
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// Anti-aliased box: 1 inside [a,b] of a repeating cell, softened by pixel footprint.
float band(float x,float a,float b,float w){return smoothstep(a-w,a+w,x)-smoothstep(b-w,b+w,x);}
float facadeLit=0.;float facadeGlass=0.;varying float vMask;`)
   .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
// dissolve between base blocks and full detail (screen-space dither, no popping)
if(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>vMask)discard;`)
   .replace('#include <color_fragment>',`#include <color_fragment>
{
 vec3 n=${packed?'normalize(cross(dFdx(vWPos),dFdy(vWPos)));if(dot(n,cameraPosition-vWPos)<0.)n=-n':'normalize(vWNormal)'};
 if(n.y>.5){ diffuseColor.rgb=vRoof; }
 else if(abs(n.y)<.5){
  float kind=vStyle.x,storey=max(2.5,vStyle.y),seed=vStyle.z;
  vec2 t=normalize(vec2(-n.z,n.x));
  float u=dot(vWPos.xz,t),y=vWPos.y;
  float dist=length(vWPos-cameraPosition);
  float detail=1.-smoothstep(uDetailFar*.45,uDetailFar,dist);
  float cellW=kind<.5?3.2:kind<1.5?1.6:kind<2.5?4.2:kind<3.5?9.:kind<4.5?3.:1.5;
  vec2 cell=vec2(u/cellW,y/storey);vec2 f=fract(cell);
  float wu=fwidth(cell.x)*1.2,wv=fwidth(cell.y)*1.2;
  float win=0.;
  if(kind<.5){ win=band(f.x,.22,.78,wu)*band(f.y,.32,.82,wv); }
  else if(kind<1.5){ win=(1.-band(f.x,-.03,.03,wu)-band(f.x,.97,1.03,wu))*(1.-band(f.y,-.06,.14,wv)); }
  else if(kind<2.5){ win=band(f.x,.3,.7,wu)*band(f.y,.3,.78,wv); }
  else if(kind>3.5&&kind<4.5){
   // Orchard-style mall podium: glass shopfronts at street level, mostly blank
   // stone above with large panel joints and the odd big glass atrium panel
   float shop=band(y,.6,5.4,fwidth(y))*(1.-band(f.x,-.02,.02,wu));
   vec2 big=floor(vec2(u/9.,y/(storey*2.)));float atrium=step(.78,hash2(big+seed*13.1))*step(6.,y);
   float joints=max(band(fract(u/1.5),-.02,.02,fwidth(u/1.5)),band(fract(y/1.5),-.02,.02,fwidth(y/1.5)));
   diffuseColor.rgb*=1.-.05*joints*detail;
   win=max(shop,atrium*(1.-band(fract(u/1.5),-.04,.04,fwidth(u/1.5))));
  }
  else if(kind>4.5){ win=band(f.y,.30,.96,wv)*(1.-band(f.x,-.04,.04,wu)); }  // office ribbon windows
  if(kind<3.5||kind>4.5)win*=step(1.2,y);  // no windows at the ground slab (malls have shopfronts there)
  win*=detail;
  // glass reflects the evening sky: warm on walls facing the sun, cool blue-grey otherwise
  float facing=clamp(dot(normalize(vec3(n.x,0.,n.z)),normalize(vec3(uSun.x,0.,uSun.z))),0.,1.);
  vec3 glass=mix(vec3(.52,.60,.68),vec3(.95,.74,.55),facing*.8);
  float glassAmt=kind>.5&&kind<1.5?.85:.7;
  diffuseColor.rgb=mix(diffuseColor.rgb,glass,win*glassAmt);
  // faint floor lines on plain walls so storeys read even without windows
  diffuseColor.rgb*=1.-.06*band(f.y,-.02,.02,wv)*detail*step(kind,2.5);
  float r=hash2(floor(cell)+seed*91.7);
  facadeLit=win*step(1.-uLit*(kind>1.5?.6:1.),r)*(1.-facing*.6);
  // shopfronts are lit by 6:20pm
  if(kind>3.5&&kind<4.5)facadeLit=max(facadeLit,win*(1.-step(5.6,y))*.75);
  facadeGlass=win;
 }
 diffuseColor.rgb=mix(diffuseColor.rgb,uTint,uTintAmt);
}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.18,facadeGlass);`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
totalEmissiveRadiance+=vec3(1.,.72,.42)*facadeLit*.45;`);
 };
 mat.customProgramCacheKey=()=>'building-facade-v3'+(transparent?'-t':'')+(packed?'-p':'')+'-m'+MODE;
 return mat;
}

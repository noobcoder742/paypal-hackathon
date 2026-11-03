// Picks a camera angle with a clear line of sight to a venue or ballroom.
//
// Uses the same tile data as the map (footprints + heights), so it works
// before anything is drawn. For each candidate direction around the target it
// casts rays from a few points on the venue towards the camera and counts how
// many pass through a neighbouring building. The clearest direction wins; ties
// go to the direction closest to the current view so the camera turns as
// little as possible. If every side is blocked (dense downtown) it tilts the
// camera towards a top-down view until the venue is visible.
import {pointInPolygon} from './geo.js';

const THETAS=24;                       // directions tried around the target
const PHIS=[.95,.8,.62,.45,.3];        // tilt from vertical, most cinematic first
const STEP=3;                          // metres between ray samples

function prepare(buildings,skip){
 const list=[];let maxH=0;
 for(const b of buildings){
  const [h,minH,, ,,flat]=b;if(skip(b))continue;
  let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
  for(let i=0;i<flat.length;i+=2){x0=Math.min(x0,flat[i]);x1=Math.max(x1,flat[i]);z0=Math.min(z0,flat[i+1]);z1=Math.max(z1,flat[i+1])}
  list.push({h,minH,flat,x0,z0,x1,z1});maxH=Math.max(maxH,h);
 }
 return {list,maxH};
}

// True if the straight line from the sample point to the camera hits a building.
function blocked({list,maxH},[sx,sy,sz],[cx,cy,cz]){
 if(sy>=maxH)return false;
 const dx=cx-sx,dy=cy-sy,dz=cz-sz,horiz=Math.hypot(dx,dz);
 if(dy<=0||horiz<1)return false;
 // only the part of the ray below the tallest building can be blocked
 const reach=Math.min(horiz,(maxH-sy)/dy*horiz);
 const ux=dx/horiz,uz=dz/horiz,slope=dy/horiz;
 const ex=sx+ux*reach,ez=sz+uz*reach;
 const bx0=Math.min(sx,ex),bx1=Math.max(sx,ex),bz0=Math.min(sz,ez),bz1=Math.max(sz,ez);
 const near=list.filter(b=>b.x1>=bx0&&b.x0<=bx1&&b.z1>=bz0&&b.z0<=bz1);
 if(!near.length)return false;
 for(let d=STEP;d<=reach;d+=STEP){
  const x=sx+ux*d,z=sz+uz*d,y=sy+slope*d;
  for(const b of near)if(y<b.h&&y>=b.minH&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&pointInPolygon(x,z,b.flat))return true;
 }
 return false;
}

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

/**
 * @param buildings  tile building rows around the target
 * @param target     {x,z} ground point the camera looks at
 * @param samples    [[x,y,z]...] points on the venue that should be visible
 * @param r          camera distance
 * @param theta      current camera direction (preferred)
 * @param skip       building row -> true for the venue's own buildings
 * @returns {theta,phi}
 */
export function findClearView({buildings,target,samples,r,theta,skip,phis=PHIS}){
 const scene=prepare(buildings,skip);
 let best=null;
 for(const phi of phis){
  for(let i=0;i<THETAS;i++){
   const t=theta+wrap(i*2*Math.PI/THETAS);
   const cam=[target.x+r*Math.sin(phi)*Math.sin(t),r*Math.cos(phi),target.z+r*Math.sin(phi)*Math.cos(t)];
   const hits=samples.reduce((n,s)=>n+(blocked(scene,s,cam)?1:0),0);
   const turn=Math.abs(wrap(t-theta));
   if(!best||hits<best.hits||(hits===best.hits&&turn<best.turn))best={hits,turn,theta:theta+wrap(t-theta),phi};
  }
  if(best.hits===0)break;    // clear view found at the most cinematic tilt
 }
 return {theta:best.theta,phi:best.phi};
}

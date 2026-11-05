// Land polygons from OpenStreetMap coastline lines (natural=coastline keeps land
// on its left), without any outside download:
//  1. draw the coastlines into a grid (res metres per cell);
//  2. split the rest of the grid into connected areas; each coastline segment
//     votes "sea" for the area on its right and "land" for the area on its left,
//     so one coastline drawn the wrong way round can't flip the map;
//  3. trace the land outline along cell edges and simplify it (tol metres).
// Out-of-box counts as sea, so land running off the edge (Johor, Batam) is
// closed along the box edge. Returns counter-clockwise outer rings [[lon,lat],...].
export function landFromCoastlines(lines,bbox,{res=10,tol=7,minArea=200}={}){
 const lat0=(bbox.s+bbox.n)/2,kx=111320*Math.cos(lat0*Math.PI/180),ky=110540;
 const W=Math.ceil((bbox.e-bbox.w)*kx/res),H=Math.ceil((bbox.n-bbox.s)*ky/res),N=W*H;
 const gx=lon=>(lon-bbox.w)*kx/res,gy=lat=>(lat-bbox.s)*ky/res;
 const bar=new Uint8Array(N),inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
 const votes=[];   // [cell, +1 sea | -1 land]
 for(const line of lines){
  for(let i=1;i<line.length;i++){
   const ax=gx(line[i-1][0]),ay=gy(line[i-1][1]),bx=gx(line[i][0]),by=gy(line[i][1]),dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(!len)continue;
   const steps=Math.ceil(len*2)+1;
   for(let k=0;k<=steps;k++){const x=Math.floor(ax+dx*k/steps),y=Math.floor(ay+dy*k/steps);if(inb(x,y))bar[x+y*W]=1}
   // right of the direction of travel is sea
   const nx=dy/len,ny=-dx/len;
   for(let t=.5;t<len;t+=1){const px=ax+dx*t/len,py=ay+dy*t/len;
    for(const [sx,v] of [[1.6,1],[-1.6,-1]]){const x=Math.floor(px+nx*sx),y=Math.floor(py+ny*sx);if(inb(x,y))votes.push(x+y*W,v)}}
  }
 }
 // connected areas of non-coast cells (4-connected)
 const lab=new Int32Array(N).fill(-1),q=new Int32Array(N);let nc=0;
 for(let i=0;i<N;i++){if(bar[i]||lab[i]>=0)continue;let h=0,t=0;q[t++]=i;lab[i]=nc;
  while(h<t){const c=q[h++],x=c%W,y=(c-x)/W;
   if(x>0&&!bar[c-1]&&lab[c-1]<0){lab[c-1]=nc;q[t++]=c-1}if(x<W-1&&!bar[c+1]&&lab[c+1]<0){lab[c+1]=nc;q[t++]=c+1}
   if(y>0&&!bar[c-W]&&lab[c-W]<0){lab[c-W]=nc;q[t++]=c-W}if(y<H-1&&!bar[c+W]&&lab[c+W]<0){lab[c+W]=nc;q[t++]=c+W}}
  nc++}
 const tally=new Float64Array(nc);for(let i=0;i<votes.length;i+=2){const c=votes[i];if(!bar[c])tally[lab[c]]+=votes[i+1]}
 // land: coast cells, and areas that more coastline puts on its left than on its right (no votes: sea)
 const land=new Uint8Array(N);for(let i=0;i<N;i++)land[i]=bar[i]||tally[lab[i]]<0?1:0;
 const L=(x,y)=>inb(x,y)&&land[x+y*W]===1;
 // directed cell edges with land on the left; vertices on a (W+1)×(H+1) lattice
 const V=W+1,out=new Map(),add=(a,b)=>{const o=out.get(a);if(o)o.push(b);else out.set(a,[b])};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!land[x+y*W])continue;
  if(!L(x,y-1))add(x+y*V,x+1+y*V);
  if(!L(x+1,y))add(x+1+y*V,x+1+(y+1)*V);
  if(!L(x,y+1))add(x+1+(y+1)*V,x+(y+1)*V);
  if(!L(x-1,y))add(x+(y+1)*V,x+y*V)}
 const rings=[];
 for(const [start] of out){
  while(out.get(start)?.length){
   const ring=[];let prev=-1,v=start;
   for(;;){const o=out.get(v);if(!o||!o.length)break;let pick=0;
    if(o.length>1&&prev>=0){// at a corner where two land cells touch diagonally, turn left
     const ix=v%V-prev%V,iy=Math.floor(v/V)-Math.floor(prev/V);pick=o.findIndex(n=>ix*(Math.floor(n/V)-Math.floor(v/V))-iy*(n%V-v%V)>0);if(pick<0)pick=0}
    const n=o.splice(pick,1)[0];ring.push(v);prev=v;v=n;if(v===start)break}
   if(ring.length<4)continue;
   const pts=ring.map(id=>[id%V,Math.floor(id/V)]);
   const simple=simplifyClosed(pts,tol/res);
   const a=areaOf(simple)*res*res;if(a<minArea||simple.length<3)continue;   // clockwise = enclosed sea: dropped
   rings.push(simple.map(([x,y])=>[bbox.w+x*res/kx,bbox.s+y*res/ky]));
  }
 }
 return rings;
}
function areaOf(p){let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=(p[j][0]*p[i][1]-p[i][0]*p[j][1]);return a/2}
// Douglas-Peucker on a closed ring (iterative, so long coastlines don't overflow the stack)
function simplifyClosed(p,tol){
 const n=p.length;let far=0,fd=-1;for(let i=1;i<n;i++){const d=(p[i][0]-p[0][0])**2+(p[i][1]-p[0][1])**2;if(d>fd){fd=d;far=i}}
 const keep=new Uint8Array(n);keep[0]=keep[far]=1;
 const seg=(a,b)=>{const st=[[a,b]];while(st.length){const [i,j]=st.pop(),A=p[i],B=p[j%n],dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy)||1;let m=-1,md=tol;
  for(let k=i+1;k<j;k++){const P=p[k%n],d=Math.abs(dx*(A[1]-P[1])-dy*(A[0]-P[0]))/l;if(d>md){md=d;m=k}}
  if(m>=0){keep[m%n]=1;st.push([i,m],[m,j])}}};
 seg(0,far);seg(far,n);
 return p.filter((_,i)=>keep[i]);
}
/** True when (lon,lat) is inside any ring. */
export function pointInRings(rings,lon,lat){return rings.some(r=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)c=!c}return c})}

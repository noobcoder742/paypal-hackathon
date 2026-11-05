import test from 'node:test';import assert from 'node:assert/strict';
import {landFromCoastlines,pointInRings} from '../scripts/lib/coast-land.mjs';
// a 0.1° box; OSM coastlines keep land on the left
const BBOX={w:103.9,s:1.3,e:104.0,n:1.4};
// island: counter-clockwise square (land on the left)
const island=[[103.92,1.32],[103.95,1.32],[103.95,1.35],[103.92,1.35],[103.92,1.32]];
// mainland to the north, running west to east across the whole box (land on the left = north)
const mainland=[[103.89,1.38],[103.93,1.379],[103.97,1.381],[104.01,1.38]];
test('island and mainland are land, the strait between them is sea',()=>{
 const rings=landFromCoastlines([island,mainland],BBOX,{res:10,tol:5});
 assert.ok(pointInRings(rings,103.935,1.335),'island centre');
 assert.ok(pointInRings(rings,103.95,1.39),'mainland');
 assert.ok(!pointInRings(rings,103.935,1.365),'strait');
 assert.ok(!pointInRings(rings,103.98,1.31),'open sea');
});
test('a coastline drawn the wrong way round is outvoted by the rest',()=>{
 // a small island drawn the wrong way: its few votes must not turn the whole sea into land
 const flipped=[[103.92,1.32],[103.92,1.33],[103.93,1.33],[103.93,1.32],[103.92,1.32]];
 const rings=landFromCoastlines([flipped,mainland],BBOX,{res:10,tol:5});
 assert.ok(!pointInRings(rings,103.98,1.31),'open sea stays sea');
 assert.ok(pointInRings(rings,103.95,1.39),'mainland stays land');
});
test('outline is simplified (no 10 m staircase)',()=>{
 const rings=landFromCoastlines([island],BBOX,{res:10,tol:5});
 const pts=rings.reduce((n,r)=>n+r.length,0);
 assert.ok(pts<40,'got '+pts+' points');
});

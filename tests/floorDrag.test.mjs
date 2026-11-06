import test from 'node:test';import assert from 'node:assert/strict';
import {beginDrag,dragTo} from '../src/studio/floorDrag.js';

test('grabbing near the edge keeps the offset: the item does not jump to the pointer',()=>{
 const s=beginDrag({itemX:2,itemZ:3,hitX:2.9,hitZ:3.4,screenX:100,screenY:100});
 assert.equal(dragTo(s,{hitX:2.9,hitZ:3.4,screenX:100,screenY:100}),null,'no movement yet');
 const p=dragTo(s,{hitX:4.9,hitZ:3.4,screenX:140,screenY:100});
 assert.deepEqual([+p.x.toFixed(3),+p.z.toFixed(3)],[4,3],'moves by the pointer delta, not to the pointer');
});
test('a click (or a 3 px wobble) never moves the item',()=>{
 const s=beginDrag({itemX:0,itemZ:0,hitX:.8,hitZ:-.6,screenX:50,screenY:50});
 assert.equal(dragTo(s,{hitX:.81,hitZ:-.6,screenX:52,screenY:51}),null);
 assert.equal(s.moved,false);
});
test('once past the threshold, small moves follow exactly',()=>{
 const s=beginDrag({itemX:0,itemZ:0,hitX:0,hitZ:0,screenX:0,screenY:0});
 dragTo(s,{hitX:1,hitZ:0,screenX:10,screenY:0});assert.equal(s.moved,true);
 const p=dragTo(s,{hitX:1.02,hitZ:0,screenX:11,screenY:0});assert.ok(Math.abs(p.x-1.02)<1e-9);
});

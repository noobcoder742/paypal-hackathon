import test from 'node:test';import assert from 'node:assert/strict';
import {assemble,bouquetItems,archItems} from '../src/studio/florals/floralGeometry.js';
const tris=g=>g?(g.index?g.index.count:g.attributes.position.count)/3:0;
// 30 tables share one bouquet; keep the studio fast on ordinary laptops.
test('table bouquet stays under 9,000 triangles and the arch under 160,000',()=>{
 for(const v of ['white','pink','green']){
  const b=assemble(bouquetItems(v));assert.ok(b.flowers&&b.leaves,'bouquet has flowers and leaves');
  assert.ok(tris(b.flowers)+tris(b.leaves)<9000,`${v} bouquet: ${tris(b.flowers)+tris(b.leaves)}`);
  const a=assemble(archItems(v),'mid');assert.ok(tris(a.flowers)+tris(a.leaves)<160000,`${v} arch: ${tris(a.flowers)+tris(a.leaves)}`);
 }
});
test('the same seed builds the same arrangement (no layout jumping between renders)',()=>{
 assert.deepEqual(bouquetItems('pink',21),bouquetItems('pink',21));
 assert.notDeepEqual(bouquetItems('pink',21),bouquetItems('pink',22));
});

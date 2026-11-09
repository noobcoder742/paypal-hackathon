import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedPlan, planTables, ROOM } from '../src/vendor/floorPlan.js';

test('tables fill both sides of the aisle, inside the room, clear of the aisle', () => {
  for (const n of [1, 15, 30, 38]) {
    const t = planTables(n);
    assert.equal(t.length, n);
    for (const p of t) {
      assert.ok(Math.abs(p.x) < ROOM.w / 2 && Math.abs(p.z) < ROOM.d / 2, JSON.stringify(p));
      assert.ok(Math.abs(p.z) > 1.5, 'not in the aisle');
    }
  }
});
test("only the signed-in vendor's items are highlighted; other vendors' items stay grey", () => {
  const lines = [
    { id: 'floral-greenery', qty: 30 },
    { id: 'floral-arch', qty: 1 },
    { id: 'music-jazz', qty: 1 },
    { id: 'light-canopy', qty: 1 },
    { id: 'car-classic', qty: 1 },
  ];
  const fern = suggestedPlan({ tables: 30, lines, vendorName: 'Fern & Foliage (demo)' });
  assert.ok(
    fern.tables.every(t => t.flowers === 'mine'),
    'greenery centrepiece on every table is mine'
  );
  assert.ok(
    fern.zones.every(z => !z.mine),
    'arch, band and canopy belong to others'
  );
  assert.deepEqual(fern.mine, ['Garden greenery centrepiece']);
  const band = suggestedPlan({ tables: 30, lines, vendorName: 'Blue Note Collective (demo)' });
  assert.deepEqual(
    band.zones.filter(z => z.mine).map(z => z.label),
    ['Band']
  );
  assert.ok(band.tables.every(t => t.flowers === 'other'));
  assert.ok(
    band.entrance.some(e => /entrance/.test(e.label)),
    'the car waits at the entrance'
  );
});

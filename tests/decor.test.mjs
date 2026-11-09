import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECOR_TYPES,
  addDecor,
  updateDecor,
  removeDecor,
  migrateDecor,
  tileAt,
  paintTiles,
  carpetLine,
  hedgeRowForStage,
  ROOM_BOUNDS,
} from '../src/studio/decor/decor.js';

const base = () => ({
  tables: [],
  stage: { x: -13.9, z: 0, width: 10.2, depth: 3.4, rotation: Math.PI / 2 },
  inventory: ['table'],
  showArch: false,
  decor: [],
  carpet: { color: 'red', tiles: [] },
});

test('add, move, rotate and remove a decor item; ids are unique', () => {
  let d = addDecor(base(), 'arch');
  d = addDecor(d, 'lantern', { x: 2, z: 3 });
  assert.equal(d.decor.length, 2);
  assert.notEqual(d.decor[0].id, d.decor[1].id);
  assert.deepEqual([d.decor[1].x, d.decor[1].z], [2, 3]);
  const id = d.decor[1].id;
  d = updateDecor(d, id, { x: 99, z: -99, rotation: 1 });
  const it = d.decor.find(x => x.id === id);
  assert.ok(it.x <= ROOM_BOUNDS.maxX && it.z >= ROOM_BOUNDS.minZ, 'moves are clamped inside the room');
  assert.equal(it.rotation, 1);
  d = removeDecor(d, id);
  assert.equal(d.decor.length, 1);
  assert.ok(d.inventory.includes('arch'), 'adding an item records it in the inventory');
});
test('unknown decor types are refused', () => {
  assert.throws(() => addDecor(base(), 'spaceship'));
});
test('every decor type has a label and a footprint', () => {
  for (const [k, t] of Object.entries(DECOR_TYPES)) {
    assert.ok(t.label, k);
    assert.ok(t.footprint[0] > 0 && t.footprint[1] > 0, k);
  }
});

test('old saves: a shown arch becomes a draggable decor arch, once', () => {
  const old = { ...base(), showArch: true, inventory: ['table', 'arch'] };
  delete old.decor;
  delete old.carpet;
  const m = migrateDecor(old);
  assert.equal(m.decor.filter(x => x.type === 'arch').length, 1);
  assert.equal(m.showArch, false);
  assert.deepEqual(m.carpet, { color: 'red', tiles: [] });
  assert.equal(migrateDecor(m).decor.length, 1, 'running it again changes nothing');
  const hidden = migrateDecor({ ...base(), showArch: false, decor: undefined });
  assert.equal(hidden.decor.length, 0);
});

test('carpet tiles snap to a 1 m grid; painting adds, painting over removes', () => {
  assert.deepEqual(tileAt(2.7, -0.2), [2, -1]);
  let d = paintTiles(
    base(),
    [
      [0, 0],
      [1, 0],
      [1, 0],
    ],
    'add'
  );
  assert.deepEqual(
    d.carpet.tiles,
    [
      [0, 0],
      [1, 0],
    ],
    'no duplicates'
  );
  d = paintTiles(d, [[1, 0]], 'remove');
  assert.deepEqual(d.carpet.tiles, [[0, 0]]);
  d = paintTiles(d, [[999, 0]], 'add');
  assert.deepEqual(d.carpet.tiles, [[0, 0]], 'tiles outside the room are ignored');
});
test('a fast drag still lays a continuous runner (no gaps between samples)', () => {
  const line = carpetLine([0, 0], [5, 0]);
  assert.deepEqual(line, [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);
  const diag = carpetLine([0, 0], [3, 2]);
  for (let i = 1; i < diag.length; i++) {
    const [a, b] = [diag[i - 1], diag[i]];
    assert.ok(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1, '4-connected steps');
  }
});
test('"line the stage" places hedges along the stage front, inside the room', () => {
  const st = base().stage;
  const row = hedgeRowForStage(st);
  assert.ok(row.length >= 4);
  for (const h of row) {
    assert.ok(h.x > st.x, 'in front of the stage, towards the guests');
    assert.ok(Math.abs(h.z) <= st.width / 2 + 0.1);
  }
});

import { placeForListing, LISTING_DECOR } from '../src/studio/decor/decor.js';
test('a marketplace listing places its item sensibly: hedges at the stage, stands and lanterns along the aisle, a runner to the stage', () => {
  let d = placeForListing(base(), 'hedge');
  assert.ok(d.decor.filter(x => x.type === 'hedge').length >= 4);
  d = placeForListing(base(), 'flowerStand');
  const st = d.decor.filter(x => x.type === 'flowerStand');
  assert.ok(st.length >= 6);
  assert.ok(
    st.every(s => Math.abs(Math.abs(s.z) - 1.6) < 0.01),
    'both sides of a 2 m aisle'
  );
  d = placeForListing(base(), 'lantern');
  assert.ok(d.decor.filter(x => x.type === 'lantern').length >= 8);
  d = placeForListing(base(), 'carpet');
  assert.ok(d.carpet.tiles.length >= 24, 'stage front to the entrance, 2 tiles wide');
  assert.ok(
    d.carpet.tiles.every(([, j]) => j === -1 || j === 0),
    'a 2 m runner on the centre line'
  );
  d = placeForListing(placeForListing(base(), 'arch'), 'arch');
  assert.equal(d.decor.filter(x => x.type === 'arch').length, 1, 'one arch, not one per click');
  assert.throws(() => placeForListing(base(), 'nope'));
  assert.deepEqual([...LISTING_DECOR].sort(), [
    'arch',
    'bubbles',
    'buffet',
    'canopy',
    'car',
    'carpet',
    'dessertTable',
    'ensemble',
    'flowerStand',
    'flowerWall',
    'hedge',
    'lantern',
    'photoBooth',
    'spotlight',
    'uplight',
  ]);
});
import { placeSavedListings } from '../src/studio/decor/decor.js';
test('saved marketplace decor is placed once when the studio opens; removing it later sticks', () => {
  const saved = [
    { id: 'decor-hedges', inventoryType: 'hedge' },
    { id: 'music-strings', inventoryType: null },
    { id: 'decor-red-carpet', inventoryType: 'carpet' },
  ];
  let d = placeSavedListings(base(), saved);
  assert.ok(d.decor.some(x => x.type === 'hedge'));
  assert.ok(d.carpet.tiles.length > 0);
  assert.deepEqual(d.placedListings.sort(), ['decor-hedges', 'decor-red-carpet']);
  d = { ...d, carpet: { ...d.carpet, tiles: [] } };
  assert.equal(placeSavedListings(d, saved), d, 'nothing new: same object, no extra undo step');
});
test('a music listing places one band per genre, with the chosen line-up; changing the line-up updates it', () => {
  const classical = {
    id: 'music-strings',
    inventoryType: 'ensemble',
    genre: 'classical',
    lineup: { violin: 3, cello: 1 },
  };
  let d = placeSavedListings(base(), [classical]);
  let bands = d.decor.filter(x => x.type === 'ensemble');
  assert.equal(bands.length, 1);
  assert.deepEqual([bands[0].genre, bands[0].lineup], ['classical', { violin: 3, cello: 1 }]);
  const moved = updateDecor(d, bands[0].id, { x: 4, z: -5 });
  d = placeSavedListings(moved, [{ ...classical, lineup: { violin: 4, viola: 1, cello: 1, piano: 1 } }]);
  bands = d.decor.filter(x => x.type === 'ensemble');
  assert.equal(bands.length, 1, 'still one classical group');
  assert.deepEqual(bands[0].lineup, { violin: 4, viola: 1, cello: 1, piano: 1 });
  assert.deepEqual([bands[0].x, bands[0].z], [4, -5], 'keeps where the couple dragged it');
  d = placeSavedListings(d, [
    { ...classical, lineup: { violin: 4, viola: 1, cello: 1, piano: 1 } },
    { id: 'music-pop', inventoryType: 'ensemble', genre: 'pop' },
  ]);
  assert.deepEqual(
    d.decor
      .filter(x => x.type === 'ensemble')
      .map(x => x.genre)
      .sort(),
    ['classical', 'pop']
  );
});

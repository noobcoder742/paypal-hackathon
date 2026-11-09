import test from 'node:test';
import assert from 'node:assert/strict';
import { coupleTools } from '../server/agent/coupleTools.js';
import { setPayPalFetch } from '../server/paypalApi.js';
import { getStore, resetMemoryStore } from '../server/store.js';
const VENUE = 'orchard-grand';
function fakePayPal() {
  const calls = [];
  setPayPalFetch(async (path, init) => {
    calls.push({ path, init, body: init?.body ? JSON.parse(init.body) : null });
    return { id: 'ORDER-' + calls.length, status: 'CREATED' };
  });
  return calls;
}
const run = (tools, name, args) => tools[name].execute(args, { toolCallId: 't', messages: [] });
test('over budget: no plan can work, and it says why', async () => {
  resetMemoryStore();
  const t = coupleTools({ store: getStore(), planId: 'plan-a1b2c3d4' });
  const r = await run(t, 'check_budget', {
    venueId: VENUE,
    tables: 20,
    lines: [{ id: 'floral-arch', qty: 1 }],
    budget: 5000,
  });
  assert.equal(r.ok, false);
  assert.ok(
    r.problems.some(p => /budget/i.test(p)),
    JSON.stringify(r.problems)
  );
});
test('over capacity: 30 tables in a 24-table room is refused', async () => {
  resetMemoryStore();
  const t = coupleTools({ store: getStore(), planId: 'plan-a1b2c3d4' });
  const r = await run(t, 'check_budget', { venueId: VENUE, tables: 30, lines: [], budget: 200000 });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some(p => /tables/i.test(p)));
});
test("securing the vendors opens the cart with the plan's items; PayPal is only called from the payment page", async () => {
  resetMemoryStore();
  const calls = fakePayPal();
  const store = getStore();
  const t = coupleTools({ store, planId: 'plan-a1b2c3d4' });
  await run(t, 'place_in_ballroom', {
    venueId: VENUE,
    tables: 20,
    lines: [
      { id: 'floral-arch', qty: 1 },
      { id: 'music-strings', qty: 1 },
    ],
  });
  const r = await run(t, 'open_checkout', {});
  assert.equal(r.checkout, true);
  assert.equal(r.planId, 'plan-a1b2c3d4');
  assert.equal(r.depositTotal, 404);
  assert.deepEqual(
    r.lines.map(l => [l.id, l.qty]),
    [
      ['floral-arch', 1],
      ['music-strings', 1],
    ]
  );
  assert.equal(calls.length, 0);
  const { orderId } = await createCheckout({ store, planId: 'plan-a1b2c3d4', lines: r.lines });
  const pu = calls[0].body.purchase_units[0];
  assert.equal(pu.amount.currency_code, 'SGD');
  assert.equal(pu.amount.value, '404.00');
  assert.deepEqual(
    pu.items.map(i => i.unit_amount.value),
    ['196.00', '208.00']
  );
  const stored = await store.get('order:' + orderId);
  assert.equal(stored.depositTotal, 404);
  assert.equal(stored.planId, 'plan-a1b2c3d4');
  assert.equal((await store.get('plan:plan-a1b2c3d4')).venueId, VENUE, 'the AI plan keeps its venue');
});
test('unknown item: rejected, and no order is created', async () => {
  resetMemoryStore();
  const calls = fakePayPal();
  const t = coupleTools({ store: getStore(), planId: 'plan-a1b2c3d4' });
  const p = await run(t, 'place_in_ballroom', {
    venueId: VENUE,
    tables: 20,
    lines: [{ id: 'gold-throne', qty: 1 }],
  });
  assert.deepEqual(p, { error: 'unknown_item', id: 'gold-throne' });
  const r = await run(t, 'open_checkout', {});
  assert.ok(r.error);
  assert.equal(calls.length, 0);
});
test('placing items returns a studio patch derived from the items', async () => {
  resetMemoryStore();
  const t = coupleTools({ store: getStore(), planId: 'plan-a1b2c3d4' });
  const r = await run(t, 'place_in_ballroom', {
    venueId: VENUE,
    tables: 20,
    lines: [
      { id: 'floral-arch', qty: 1 },
      { id: 'floral-greenery', qty: 20 },
      { id: 'light-canopy', qty: 1 },
    ],
  });
  assert.deepEqual(r.studioPatch, {
    tables: 20,
    flowers: 'green',
    lighting: 'warm',
    show: { arch: true, decor: true },
    place: [{ type: 'canopy', id: 'light-canopy' }],
  });
});
import { studioPatchFor } from '../server/agent/coupleTools.js';
import { createCheckout } from '../server/checkout.js';
test('a plan with music asks the studio to place that band', () => {
  const p = studioPatchFor(20, [
    { id: 'music-strings', qty: 1 },
    { id: 'decor-red-carpet', qty: 1 },
  ]);
  assert.deepEqual(p.place, [
    { type: 'ensemble', id: 'music-strings', genre: 'classical' },
    { type: 'carpet', id: 'decor-red-carpet' },
  ]);
});
import { applyStudioPatch } from '../src/explorer/agent/applyStudioPatch.js';
import { CATALOG } from '../src/data/catalog.js';
test('every vendor item the AI suggests shows up in the 3D room', () => {
  const vendorItems = CATALOG.filter(i => !['table', 'stage'].includes(i.inventoryType));
  for (const i of vendorItems) assert.ok(i.inventoryType, i.id + ' has a 3D model');
  const lines = vendorItems.map(i => ({ id: i.id, qty: i.inventoryType === 'flowers' ? 16 : 1 }));
  const base = {
    tables: [],
    inventory: ['table'],
    decor: [],
    carpet: { color: 'red', tiles: [] },
    stage: { x: -6.95, z: 0, width: 7.2, depth: 2.6, rotation: Math.PI / 2 },
  };
  const room = applyStudioPatch(base, studioPatchFor(16, lines));
  const placed = new Set(room.decor.map(d => d.type));
  for (const i of vendorItems) {
    const t = i.inventoryType;
    if (t === 'flowers') assert.ok(room.showDecor, 'centrepieces on the tables');
    else if (t === 'screen') assert.ok(room.showScreen, 'LED screen');
    else if (t === 'arch') assert.ok(room.showArch || placed.has('arch'), 'arch');
    else if (t === 'carpet') assert.ok(room.carpet.tiles.length > 0, 'aisle carpet');
    else assert.ok(placed.has(t), i.id + ' → ' + t + ' placed');
  }
  assert.equal(room.decor.filter(d => d.type === 'car').length, 2, 'both wedding cars, each its own booking');
  assert.ok(
    room.decor.filter(d => d.type === 'car').every(c => c.x >= 10),
    'cars wait outside the entrance'
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { captureOrder } from '../server/capture.js';
import { getStore, resetMemoryStore } from '../server/store.js';
const captured = value => ({
  id: 'ORDER-1',
  status: 'COMPLETED',
  purchase_units: [
    {
      payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'SGD', value } }] },
    },
  ],
});
async function seed() {
  resetMemoryStore();
  const store = getStore();
  await store.set('order:ORDER-1', {
    planId: 'plan-a1b2c3d4',
    depositTotal: 366,
    lines: [{ id: 'floral-arch' }],
    status: 'created',
  });
  return store;
}
test('captures after approval and records it', async () => {
  const store = await seed();
  const calls = [];
  const r = await captureOrder({
    orderId: 'ORDER-1',
    store,
    paypalFetch: async (p, i) => {
      calls.push({ p, i });
      return captured('366.00');
    },
  });
  assert.equal(r.status, 'COMPLETED');
  assert.equal(r.depositTotal, 366);
  assert.equal((await store.get('order:ORDER-1')).status, 'captured');
  assert.equal(calls[0].p, '/v2/checkout/orders/ORDER-1/capture');
  assert.equal(calls[0].i.headers['PayPal-Request-Id'], 'capture-ORDER-1');
});
test('a second capture (double click, retry) does not call PayPal again', async () => {
  const store = await seed();
  let n = 0;
  const f = async () => {
    n++;
    return captured('366.00');
  };
  await captureOrder({ orderId: 'ORDER-1', store, paypalFetch: f });
  const r = await captureOrder({ orderId: 'ORDER-1', store, paypalFetch: f });
  assert.equal(n, 1);
  assert.equal(r.status, 'COMPLETED');
});
test('a plan changed after the order still checks against that order', async () => {
  const store = await seed();
  await store.set('plan:plan-a1b2c3d4', { totals: { depositTotal: 999 } });
  const r = await captureOrder({ orderId: 'ORDER-1', store, paypalFetch: async () => captured('366.00') });
  assert.equal(r.status, 'COMPLETED');
});
test('a different captured amount is flagged', async () => {
  const store = await seed();
  const r = await captureOrder({ orderId: 'ORDER-1', store, paypalFetch: async () => captured('1.00') });
  assert.equal(r.status, 'FAILED');
  assert.equal((await store.get('order:ORDER-1')).status, 'mismatch');
});
test('unknown orders are refused', async () => {
  const store = await seed();
  assert.deepEqual(
    await captureOrder({
      orderId: 'NOPE',
      store,
      paypalFetch: async () => {
        throw new Error('no');
      },
    }),
    { error: 'unknown_order' }
  );
});

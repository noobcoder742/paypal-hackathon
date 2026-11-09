import test from 'node:test';
import assert from 'node:assert/strict';
import { vendorPlanTotals, banquetQuote, lineDeposit, UnknownItemError } from '../server/pricing.js';
test('vendor line: 20% deposit, 10% commission', () => {
  const p = vendorPlanTotals([{ id: 'floral-arch', qty: 1 }]);
  assert.equal(p.lines[0].total, 980);
  assert.equal(p.lines[0].deposit, 196);
  assert.equal(p.lines[0].commission, 98);
  assert.equal(p.depositTotal, 196);
  assert.equal(p.vendorTotal, 980);
});
test('banquet quote: ++ is 10% service then 9% GST, 30% deposit', () => {
  assert.deepEqual(banquetQuote({ banquet: { pricePerTable: 2288, minTables: 15, maxTables: 38 } }, 30), {
    subtotal: 68640,
    serviceCharge: 6864,
    gst: 6795.36,
    total: 82299.36,
    deposit: 24689.81,
  });
});
test('unknown item and bad quantities are rejected', () => {
  assert.throws(() => vendorPlanTotals([{ id: 'gold-throne', qty: 1 }]), UnknownItemError);
  assert.throws(() => vendorPlanTotals([{ id: 'floral-arch', qty: 0 }]), RangeError);
  assert.throws(() => vendorPlanTotals([{ id: 'floral-arch', qty: 61 }]), RangeError);
});
test('tables outside the room are rejected', () => {
  assert.throws(
    () => banquetQuote({ banquet: { pricePerTable: 2288, minTables: 15, maxTables: 38 } }, 45),
    RangeError
  );
});
test('items priced on request cannot be deposited', () => {
  assert.throws(() => lineDeposit({ id: 'catering-banquet', price: null }, 1), RangeError);
});

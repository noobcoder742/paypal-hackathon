import test from 'node:test';
import assert from 'node:assert/strict';
import { toRows, stillToPay, EXAMPLE_BOOKINGS } from '../src/hotel/dashboardData.js';
const enquiries = [
  {
    id: 'enq-a',
    venueId: 'orchard-grand',
    tables: 30,
    date: '2027-06-12',
    coupleName: 'Mei & Daniel',
    status: 'new',
    createdAt: Date.parse('2026-11-06'),
  },
  {
    id: 'enq-b',
    venueId: 'orchard-grand',
    tables: 20,
    date: '2027-03-20',
    coupleName: 'Aisha & Ravi',
    status: 'invoiced',
    createdAt: Date.parse('2026-11-07'),
    invoice: { amount: 16459.87, status: 'SENT' },
    quote: { total: 54866.24 },
  },
  {
    id: 'enq-c',
    venueId: 'orchard-grand',
    tables: 25,
    date: '2027-09-04',
    coupleName: 'Jun & Wei',
    status: 'paid',
    createdAt: Date.parse('2026-11-08'),
    invoice: { amount: 20574.84, status: 'PAID' },
  },
];
test('one row per enquiry with a status and the deposit due', () => {
  const rows = toRows(enquiries);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map(r => r.status),
    ['new', 'invoiced', 'paid']
  );
  assert.equal(rows[1].depositInvoiced, 16459.87);
  assert.equal(rows[1].depositDue, 16459.87);
  assert.equal(rows[2].depositPaid, 20574.84);
  assert.equal(rows[2].depositDue, 0);
  assert.equal(rows[0].weddingMonth, '2027-06');
  assert.equal(rows[0].isExample, false);
});
test('still to pay: unpaid invoices only, largest first', () => {
  const due = stillToPay(
    toRows([
      ...enquiries,
      { ...enquiries[1], id: 'enq-d', coupleName: 'Zoe & Sam', invoice: { amount: 30000, status: 'SENT' } },
    ])
  );
  assert.deepEqual(
    due.map(r => r.couple),
    ['Zoe & Sam', 'Aisha & Ravi']
  );
});
test('example bookings are labelled as examples', () => {
  const rows = toRows(EXAMPLE_BOOKINGS);
  assert.ok(rows.length >= 8);
  assert.ok(rows.every(r => r.isExample && r.couple.endsWith('(example)')));
});

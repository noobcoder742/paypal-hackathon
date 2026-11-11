import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_TASKS,
  migrateTasks,
  completeTasksFor,
  addToBudget,
  markDepositsPaid,
  paidSoFar,
  itemStage,
} from '../src/components/planner/progress.js';
import { findItem } from '../src/data/catalog.js';

test('the checklist is grouped by category, and vendor tasks are split by what is booked', () => {
  assert.deepEqual([...new Set(SEED_TASKS.map(t => t.group))], ['Venue', 'Guests', 'Vendors', 'Logistics']);
  assert.ok(SEED_TASKS.find(t => t.id === 'florals').categories.includes('Floral Arrangements'));
});
test('older checklists keep what was ticked and any custom tasks', () => {
  const old = [
    { id: 'venue', done: true },
    { id: 'floral', done: false },
    { id: 'guests', done: true },
    { id: 'task123', title: 'Cake tasting', group: 'Custom tasks', done: false },
  ];
  const t = migrateTasks(old);
  assert.equal(t.find(x => x.id === 'venue-enquiry').done, true);
  assert.equal(t.find(x => x.id === 'guests').done, true);
  assert.equal(t.find(x => x.id === 'florals').done, false);
  assert.ok(t.some(x => x.id === 'task123'));
  assert.equal(migrateTasks(t), t, 'already migrated lists are left alone');
});
test('paying for florals and music ticks those tasks and "pay deposits", nothing else', () => {
  const { tasks, ids } = completeTasksFor(SEED_TASKS, [findItem('floral-arch'), findItem('music-strings')]);
  assert.deepEqual(ids.sort(), ['deposits', 'florals', 'music']);
  assert.equal(tasks.filter(t => t.done).length, 3);
  assert.deepEqual(completeTasksFor(tasks, [findItem('floral-white')]).ids, [], 'already done stays done');
});
test('budget: "To pay" until the deposit is paid, then 20% counts as paid; added once', () => {
  const arch = findItem('floral-arch');
  let p = addToBudget([], arch, 980);
  p = addToBudget(p, arch, 980);
  assert.equal(p.length, 1);
  assert.equal(p[0].status, 'todo');
  assert.equal(paidSoFar(p[0]), 0);
  p = markDepositsPaid(p, [
    { item: arch, total: 980 },
    { item: findItem('light-canopy'), total: 1450 },
  ]);
  assert.deepEqual(
    p.map(x => [x.itemId, x.status, paidSoFar(x)]),
    [
      ['floral-arch', 'deposit', 196],
      ['light-canopy', 'deposit', 290],
    ]
  );
});
test('each saved item shows its stage', () => {
  assert.equal(itemStage(findItem('catering-banquet')), 'enquiry');
  assert.equal(itemStage(findItem('floral-arch')), 'cart');
  assert.equal(itemStage(findItem('music-strings')), 'cart');
  assert.equal(itemStage({ ...findItem('floral-arch'), paid: { at: 1 } }), 'paid');
});

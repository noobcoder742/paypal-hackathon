import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityController, QUALITY_STEPS } from '../src/explorer/stream/quality.js';
const run = (q, from, to, dt, moving = true) => {
  let t = from,
    lv;
  for (; t < to; t += dt) lv = q.sample(dt, moving, t);
  return { t, lv };
};
test('slow frames while moving step quality down within 2.5 s', () => {
  const q = new QualityController({ targetMs: 33 });
  let t = 0,
    when = null;
  for (; t < 3000; t += 50) {
    const lv = q.sample(50, true, t);
    if (lv >= 1 && when == null) when = t;
  }
  assert.ok(when != null && when <= 2500, 'stepped at ' + when);
  assert.equal(QUALITY_STEPS[0], 'dpr');
  assert.equal(q.settings.dpr, 1);
});
test('headroom raises quality one step, only after 5 s', () => {
  const q = new QualityController({ targetMs: 33 });
  run(q, 0, 3000, 50);
  const lv = q.level;
  assert.ok(lv >= 1);
  let t = 3000,
    changedAt = null;
  for (; t < 9000; t += 10) {
    const l = q.sample(10, true, t);
    if (l !== lv && changedAt == null) changedAt = t;
  }
  assert.ok(changedAt != null && changedAt - 3000 >= 5000, 'raised after ' + (changedAt - 3000) + ' ms');
  assert.equal(q.level, lv - 1);
});
test('samples while still never change the level', () => {
  const q = new QualityController({ targetMs: 16.7 });
  run(q, 0, 6000, 80, false);
  assert.equal(q.level, 0);
});
test('Settings cap holds the level', () => {
  const q = new QualityController({ targetMs: 33, cap: 5 });
  run(q, 0, 9000, 8);
  assert.equal(q.level, 5);
  assert.deepEqual(q.settings, { dpr: 1, shadows: false, detailScale: 0.6, midScale: 0.6, extras: false });
});

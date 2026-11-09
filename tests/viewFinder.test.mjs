import test from 'node:test';
import assert from 'node:assert/strict';
import { venueView, fitDistance, BIRDS_EYE } from '../src/explorer/viewFinder.js';
const box = (x, z, w, d, h) => [
  h,
  0,
  '',
  '',
  0,
  [x - w / 2, z - d / 2, x + w / 2, z - d / 2, x + w / 2, z + d / 2, x - w / 2, z + d / 2],
];
test("tilt stays bird's-eye even when every side is blocked", () => {
  const hotel = box(0, 0, 30, 30, 40),
    ring = [];
  for (let a = 0; a < 24; a++)
    ring.push(box(Math.sin((a / 24) * 6.283) * 60, Math.cos((a / 24) * 6.283) * 60, 25, 25, 200));
  const v = venueView({
    buildings: [hotel, ...ring],
    own: b => b === hotel,
    target: { x: 0, z: 0 },
    samples: [
      [0, 20, 0],
      [0, 38, 0],
    ],
    theta: 0,
    r0: 300,
  });
  assert.ok(v.phi >= BIRDS_EYE.min && v.phi <= BIRDS_EYE.max, 'phi ' + v.phi);
  assert.ok(v.r > 300 && v.r <= 750, 'r ' + v.r);
});
test('picks an unblocked side when one exists', () => {
  const hotel = box(0, 0, 30, 30, 40),
    wall = box(0, 60, 200, 20, 150);
  const v = venueView({
    buildings: [hotel, wall],
    own: b => b === hotel,
    target: { x: 0, z: 0 },
    samples: [[0, 20, 0]],
    theta: 0,
    r0: 300,
  });
  assert.equal(v.hits, 0);
  assert.ok(Math.cos(v.theta) < 0.5, 'theta ' + v.theta);
});
test('fitDistance grows with building size', () => {
  assert.ok(fitDistance({ box: { w: 80, d: 60, h: 120 } }) > fitDistance({ box: { w: 30, d: 30, h: 40 } }));
});

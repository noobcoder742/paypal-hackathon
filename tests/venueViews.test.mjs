// The bird's-eye rule for every listed venue (CLAUDE.md; spec "Rule: opening a hotel"):
// the view clearViewFor picks has a 40-65 deg tilt, nothing blocking it (or is the
// farthest step out), and the whole hotel inside the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  venueView,
  fitDistance,
  venueFraming,
  withoutVenueBlocks,
  BIRDS_EYE,
} from '../src/explorer/viewFinder.js';
const ROOT = 'public/data/sg3d/',
  l = JSON.parse(readFileSync(ROOT + 'latest.json', 'utf8'));
const meta = JSON.parse(readFileSync(ROOT + l.meta, 'utf8')),
  base = gunzipSync(readFileSync(ROOT + l.base));
const S = 24,
  n = base.length / S,
  dv = new DataView(base.buffer, base.byteOffset, base.length);
// the same blocks CityStream.boxesAround returns
function boxesAround(x, z, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = i * S,
      cx = dv.getInt16(o, true),
      cz = dv.getInt16(o + 2, true);
    if (Math.abs(cx - x) > r || Math.abs(cz - z) > r) continue;
    const w = dv.getUint16(o + 4, true) / 8,
      d = dv.getUint16(o + 6, true) / 8,
      h = dv.getUint16(o + 8, true) / 10,
      mh = dv.getUint16(o + 10, true) / 10,
      a = (base[o + 12] / 255) * Math.PI,
      c = Math.cos(a),
      s = Math.sin(a);
    const f = [];
    for (const [u, v] of [
      [-w, -d],
      [w, -d],
      [w, d],
      [-w, d],
    ])
      f.push(cx + u * c - v * s, cz + u * s + v * c);
    out.push([h, mh, '', '', 0, f]);
  }
  return out;
}
// project a world point through the map camera (38 deg fov) and return NDC
function project([x, y, z], { tx, tz, r, phi, theta }, aspect) {
  const cam = [
    tx + r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
    tz + r * Math.sin(phi) * Math.cos(theta),
  ];
  const f = norm([tx - cam[0], -cam[1], tz - cam[2]]),
    rt = norm(cross(f, [0, 1, 0])),
    up = cross(rt, f),
    p = [x - cam[0], y - cam[1], z - cam[2]];
  const cz = dot(p, f),
    t = Math.tan((38 * Math.PI) / 360);
  return [dot(p, rt) / (cz * t * aspect), dot(p, up) / (cz * t)];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm = a => {
    const m = Math.hypot(...a);
    return a.map(v => v / m);
  };
const ASPECT = 1.6;
for (const [id, rows] of Object.entries(meta.venueRows || {})) {
  test(`bird's-eye view: ${id}`, () => {
    const { target, box, samples } = venueFraming(rows),
      r0 = fitDistance({ box, aspect: ASPECT }),
      reach = Math.min(1800, r0 * 2.5);
    const buildings = [...withoutVenueBlocks(boxesAround(target.x, target.z, reach), rows), ...rows],
      set = new Set(rows);
    const v = venueView({ buildings, own: r => set.has(r), target, samples, theta: 0.95, r0 });
    assert.ok(
      v.phi >= BIRDS_EYE.min && v.phi <= BIRDS_EYE.max,
      `tilt ${((v.phi * 180) / Math.PI).toFixed(0)} deg`
    );
    // a clear view must exist (the 2.5x fallback is for a truly boxed-in venue, not the listed hotels)
    assert.equal(v.hits, 0, `${v.hits} blocked lines of sight at r ${v.r.toFixed(0)} (r0 ${r0.toFixed(0)})`);
    const cam = { tx: target.x, tz: target.z, r: v.r, phi: v.phi, theta: v.theta };
    for (const sx of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5])
        for (const y of [0, box.h]) {
          const [px, py] = project([target.x + sx * box.w, y, target.z + sz * box.d], cam, ASPECT);
          assert.ok(
            Math.abs(px) <= 1 && Math.abs(py) <= 1,
            `corner off screen at ndc ${px.toFixed(2)},${py.toFixed(2)}`
          );
        }
  });
}

// Phase 2 build outputs (scripts/build-city-3d.mjs): budgets and coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
execFileSync('node', ['scripts/build-city-3d.mjs', '--if-missing'], { cwd: ROOT, stdio: 'ignore' });
const latest = JSON.parse(readFileSync(ROOT + 'public/data/sg3d/latest.json')),
  dir = ROOT + 'public/data/sg3d/' + latest.version + '/';
const meta = JSON.parse(readFileSync(dir + 'meta.json'));
const size = uri => statSync(dir + uri).size;
test('lite base has the 20,000 biggest buildings within 250 KB', () => {
  assert.equal(meta.baseLite.count, 20000);
  assert.ok(size(meta.baseLite.uri) <= 2.5e5);
});
test('base roads plus areas within 1.2 MB', () => {
  assert.ok(size(meta.roads.uri) + size(meta.areas.uri) <= 1.2e6);
});
test('land within 400 KB when land polygons exist', () => {
  if (!existsSync(ROOT + 'public/data/sg/land.json')) return;
  assert.ok(meta.land);
  assert.ok(size(meta.land.uri) <= 4e5);
});
test('districts cover every cell with buildings, within budgets', () => {
  const D = meta.districts,
    per = D.size / meta.tileSize;
  let total = 0;
  for (const [k, c] of Object.entries(meta.cells)) {
    if (!c[3]) continue;
    const [ix, iz] = k.split('_').map(Number);
    const dk = Math.floor(ix / per) + '_' + Math.floor(iz / per);
    assert.ok(D.cells[dk], 'district for ' + k);
  }
  for (const [dk, [, , gz]] of Object.entries(D.cells)) {
    assert.ok(gz <= 6e5, dk + ' ' + gz);
    total += gz;
  }
  assert.ok(total <= 5e7, 'total ' + total);
});

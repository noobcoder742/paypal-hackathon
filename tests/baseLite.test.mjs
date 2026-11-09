import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeLite } from '../src/explorer/stream/cityStream.js';
const ROOT = 'public/data/sg3d/',
  l = JSON.parse(readFileSync(ROOT + 'latest.json', 'utf8'));
test('lite base decodes to rows of the full base', () => {
  const lite = new Uint8Array(decodeLite(new Uint8Array(gunzipSync(readFileSync(ROOT + l.lite))))),
    full = gunzipSync(readFileSync(ROOT + l.base));
  const S = 24,
    rows = new Set();
  for (let i = 0; i < full.length; i += S) rows.add(full.subarray(i, i + S).toString('hex'));
  assert.equal(lite.length / S, 20000);
  for (let i = 0; i < lite.length; i += S * 97)
    assert.ok(rows.has(Buffer.from(lite.subarray(i, i + S)).toString('hex')), 'row ' + i / S);
});

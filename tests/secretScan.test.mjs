import test from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets } from '../scripts/secret-scan.mjs';
test('finds an Anthropic-style key', () => {
  assert.equal(findSecrets('key=sk-' + 'ant-api03-abcdefghijklmnop').length, 1);
});
test('variable names alone are fine', () => {
  assert.equal(findSecrets('ANTHROPIC_API_KEY=\nPAYPAL_CLIENT_SECRET=').length, 0);
});
test('finds a Google key and a private key', () => {
  assert.equal(findSecrets('AI' + 'zaSyA1234567890abcdefghijklmnopqrstuv').length, 1);
  assert.equal(findSecrets('-----BEGIN RSA ' + 'PRIVATE KEY-----').length, 1);
});
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
test('at most 12 API functions (Vercel Hobby plan limit)', () => {
  const walk = d =>
    readdirSync(d).flatMap(f => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
    });
  const n = walk('api').length;
  assert.ok(n <= 12, `${n} functions in api/`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../server/store.js';
import { checkDailyBudget, LIVE_RUNS_PER_DAY } from '../server/ratelimit.js';
test('live AI runs stop at the daily ceiling across all visitors', async () => {
  resetMemoryStore();
  for (let i = 0; i < LIVE_RUNS_PER_DAY; i++) assert.equal(await checkDailyBudget(), true);
  assert.equal(await checkDailyBudget(), false);
});

// 5 agent runs per visitor per hour (protects the Anthropic spending cap).
// Counted in quarter units: a full run costs 4, an answer replayed from the cache costs 1.
import { getStore } from './store.js';
export const RUNS_PER_HOUR = 5;
const UNITS = RUNS_PER_HOUR * 4;
/** weight: 1 for a model run, .25 for a cached answer. */
export async function checkRate(ip, { weight = 1 } = {}) {
  const by = Math.max(1, Math.round(weight * 4)),
    hour = Math.floor(Date.now() / 3600e3);
  const { n, expiresIn } = await getStore().incr(`rate:${ip}:${hour}`, { ttlSeconds: 3600, by });
  return {
    ok: n <= UNITS,
    remaining: Math.max(0, Math.floor((UNITS - n) / 4)),
    resetSeconds: Math.max(1, expiresIn),
  };
}

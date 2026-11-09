// Shared number formatting and memoisation, used by the browser and the server.

/** Round to cents without floating-point drift (1.005 → 1.01). */
export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

const SGD = (n, min, max) =>
  'S$' + Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: min, maximumFractionDigits: max });
/** S$1,234.5 — cents only when there are any. */
export const sgd = n => SGD(n, 0, 2);
/** S$1,235 — whole dollars, for estimates and budgets. */
export const sgdWhole = n => SGD(Math.round(Number(n) || 0), 0, 0);
/** S$1,234.50 — always two decimals, for amounts being paid. */
export const sgdCents = n => SGD(n, 2, 2);

/** A get-or-create cache, e.g. for three.js materials and geometries shared by every instance. */
export function createCache() {
  const store = new Map();
  return (key, make) => {
    if (!store.has(key)) store.set(key, make());
    return store.get(key);
  };
}

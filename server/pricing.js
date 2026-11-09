// All money in the demo is computed here, never by a model (spec: "Amounts are
// enforced in code, not in the prompt"). Currency is SGD.
import { findItem } from '../src/data/catalog.js';
import { GENRES, cleanLineup, ensemblePrice } from '../src/studio/decor/ensembles.js';
import { round2 } from '../src/lib/format.js';
export { round2 };
export const DEPOSIT_RATE = 0.2,
  COMMISSION_RATE = 0.1,
  SERVICE_RATE = 0.1,
  GST_RATE = 0.09,
  BANQUET_DEPOSIT_RATE = 0.3,
  MAX_QTY = 60;
export class UnknownItemError extends Error {
  constructor(id) {
    super('unknown item ' + id);
    this.id = id;
  }
}
export function lineDeposit(item, qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY)
    throw new RangeError(`quantity must be 1-${MAX_QTY}`);
  if (item.price == null) throw new RangeError(item.id + ' is priced on request');
  const total = round2(item.price * qty);
  return { total, deposit: round2(total * DEPOSIT_RATE), commission: round2(total * COMMISSION_RATE) };
}
/** A band's price follows its line-up (base fee + a fee per musician); everything else is the listing price. */
export function unitPriceFor(item, lineup) {
  if (item.inventoryType === 'ensemble' && GENRES[item.genre])
    return ensemblePrice(item.genre, lineup || GENRES[item.genre].default);
  return item.price;
}
export function vendorPlanTotals(lines) {
  const out = lines.map(({ id, qty, lineup }) => {
    const item = findItem(id);
    if (!item) throw new UnknownItemError(id);
    const band = item.inventoryType === 'ensemble' && GENRES[item.genre],
      unitPrice = unitPriceFor(item, lineup),
      d = lineDeposit({ ...item, price: unitPrice }, qty);
    return {
      id,
      name: item.name,
      vendor: item.vendor,
      qty,
      unitPrice,
      ...(band ? { lineup: cleanLineup(item.genre, lineup || GENRES[item.genre].default) } : {}),
      ...d,
    };
  });
  const sum = k => round2(out.reduce((n, l) => n + l[k], 0));
  return {
    lines: out,
    vendorTotal: sum('total'),
    depositTotal: sum('deposit'),
    commissionTotal: sum('commission'),
  };
}
/** Demo promo codes: a percentage off today's deposits. Checked on the server only. */
export const PROMO_CODES = {
  PAYPALDEMO: { percent: 10, label: '10% off deposits (demo code)' },
  WEDDING5: { percent: 5, label: '5% off deposits' },
};
export function applyPromo(totals, code) {
  const key = String(code || '')
    .trim()
    .toUpperCase();
  if (!key) return { ...totals, discount: 0, promo: null, dueToday: totals.depositTotal };
  const p = PROMO_CODES[key];
  if (!p) throw new RangeError('unknown promo code');
  const discount = round2((totals.depositTotal * p.percent) / 100);
  return {
    ...totals,
    discount,
    promo: { code: key, label: p.label, percent: p.percent },
    dueToday: round2(totals.depositTotal - discount),
  };
}
export function banquetQuote(venue, tables) {
  const b = venue?.banquet;
  if (!b) throw new RangeError('venue has no banquet pricing');
  if (!Number.isInteger(tables) || tables < b.minTables || tables > b.maxTables)
    throw new RangeError(`tables must be ${b.minTables}-${b.maxTables}`);
  const subtotal = round2(tables * b.pricePerTable),
    serviceCharge = round2(subtotal * SERVICE_RATE),
    gst = round2((subtotal + serviceCharge) * GST_RATE),
    total = round2(subtotal + serviceCharge + gst);
  return { subtotal, serviceCharge, gst, total, deposit: round2(total * BANQUET_DEPOSIT_RATE) };
}

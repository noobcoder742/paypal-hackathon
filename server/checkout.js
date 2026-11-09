// The cart's checkout: price the couple's items (server-side only), apply a promo code, and
// create the PayPal order for today's 20% deposits. The saved plan lets capture tell each
// vendor about its booking. Every payment, including "secure these vendors" from the AI
// planner, goes through here.
import { vendorPlanTotals, applyPromo, UnknownItemError, MAX_QTY } from './pricing.js';
import { findItem } from '../src/data/catalog.js';
import { findVenue } from '../src/data/venues.js';
import { createDepositOrder, approvalLink } from './paypalApi.js';

export class CheckoutError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}
const PLAN_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Validate the cart sent by the browser: known, priced items with whole quantities. */
export function cleanCart(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new CheckoutError('empty_cart', 'Your cart is empty.');
  if (lines.length > 30) throw new CheckoutError('bad_cart', 'Too many items.');
  const seen = new Set();
  return lines.map(l => {
    const item = findItem(l?.id);
    if (!item) throw new CheckoutError('unknown_item', 'An item in your cart is no longer available.');
    if (item.price == null && item.inventoryType !== 'ensemble')
      throw new CheckoutError('quote_only', `${item.name} is priced by quote, so it can't be paid here.`);
    const qty = Number(l.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY)
      throw new CheckoutError('bad_qty', `Quantity for ${item.name} must be 1–${MAX_QTY}.`);
    if (seen.has(item.id)) throw new CheckoutError('bad_cart', 'Each item appears once.');
    seen.add(item.id);
    return {
      id: item.id,
      qty,
      ...(item.inventoryType === 'ensemble' && l.lineup && typeof l.lineup === 'object'
        ? { lineup: l.lineup }
        : {}),
    };
  });
}

/** Totals for the cart and promo code, exactly as PayPal will be asked to charge. */
export function quoteCart({ lines, promo }) {
  try {
    return applyPromo(vendorPlanTotals(cleanCart(lines)), promo);
  } catch (e) {
    if (e instanceof CheckoutError) throw e;
    if (e instanceof UnknownItemError) throw new CheckoutError('unknown_item');
    if (/promo/.test(e.message)) throw new CheckoutError('bad_promo', 'That promo code isn’t valid.');
    throw new CheckoutError('bad_cart', e.message);
  }
}

/**
 * Create the PayPal order for the cart; remembers the plan and the amount due for capture.
 * origin is this site (checked by the caller): PayPal sends the couple back to its cart page.
 */
export async function createCheckout({
  store,
  planId,
  lines,
  promo,
  venueId,
  tables,
  origin,
  create = createDepositOrder,
}) {
  if (!PLAN_ID.test(planId || '')) throw new CheckoutError('bad_request');
  const totals = quoteCart({ lines, promo });
  const prev = (await store.get('plan:' + planId)) || {};
  const venue = findVenue(venueId) ? venueId : prev.venueId || null;
  const t = Number.isInteger(tables) && tables > 0 && tables <= 80 ? tables : prev.tables || null;
  await store.set('plan:' + planId, {
    ...prev,
    planId,
    venueId: venue,
    tables: t,
    lines: totals.lines.map(l => ({ id: l.id, qty: l.qty, ...(l.lineup ? { lineup: l.lineup } : {}) })),
    totals,
    savedAt: Date.now(),
  });
  const back = origin ? new URL('/', origin) : null;
  const order = await create({
    planId,
    totals,
    ...(back ? { returnUrl: back.href + '?checkout=return', cancelUrl: back.href + '?checkout=cancel' } : {}),
  });
  await store.set('order:' + order.id, {
    planId,
    depositTotal: totals.dueToday,
    depositBeforeDiscount: totals.depositTotal,
    discount: totals.discount,
    promo: totals.promo,
    lines: totals.lines,
    status: 'created',
  });
  return { orderId: order.id, approveUrl: approvalLink(order), totals };
}

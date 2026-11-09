// The cart is the couple's saved vendor items (planner.savedItems) that are not paid yet.
// Quantities live on each saved item; prices shown here are previews, the server prices the order.
import { findItem } from '../../data/catalog.js';
import { GENRES, cleanLineup, ensemblePrice, lineupText } from '../../studio/decor/ensembles.js';
import { round2 } from '../../lib/format.js';

export const DEPOSIT_RATE = 0.2,
  MAX_QTY = 60;

/** One centrepiece per guest table; everything else is booked once. */
export const defaultQty = (item, tables = 16) =>
  item.unit === 'arrangement' ? Math.max(1, Math.min(MAX_QTY, tables || 16)) : 1;
export const isBand = item => item.inventoryType === 'ensemble' && !!GENRES[item.genre];
export const payable = item => isBand(item) || item.price != null;
export const unitPrice = item =>
  isBand(item) ? ensemblePrice(item.genre, item.lineup || GENRES[item.genre].default) : item.price;

/** Unpaid saved items, each with a quantity. */
export function cartItems(savedItems = [], tables) {
  return savedItems
    .filter(i => i && !i.paid)
    .map(i => ({ ...findItem(i.id), ...i, qty: i.qty ?? defaultQty(i, tables) }));
}
export const cartCount = (savedItems, tables) => cartItems(savedItems, tables).length;

/** Smaller grey spec line under an item's name. */
export function specLine(item) {
  const parts = [item.vendor?.replace(' (demo)', '')];
  if (isBand(item))
    parts.push(lineupText(item.genre, cleanLineup(item.genre, item.lineup || GENRES[item.genre].default)));
  if (payable(item))
    parts.push(
      `S$${unitPrice(item).toLocaleString('en-SG')} ${item.unit === 'arrangement' ? 'per table' : 'per ' + item.unit}`
    );
  else parts.push('Priced by quote from the hotel');
  return parts.filter(Boolean).join(' · ');
}

/** What the browser sends: ids, quantities and band line-ups only, never prices. */
export const orderLines = items =>
  items
    .filter(payable)
    .map(i => ({ id: i.id, qty: i.qty, ...(isBand(i) && i.lineup ? { lineup: i.lineup } : {}) }));

/** Instant preview while the server quote loads. */
export function previewTotals(items) {
  const lines = items.filter(payable).map(i => ({ id: i.id, total: round2(unitPrice(i) * i.qty) }));
  const vendorTotal = round2(lines.reduce((s, l) => s + l.total, 0)),
    depositTotal = round2(lines.reduce((s, l) => s + round2(l.total * DEPOSIT_RATE), 0));
  return { vendorTotal, depositTotal, discount: 0, dueToday: depositTotal, promo: null };
}

/** Saved items after a cart change: quantity, removal, or items arriving from the AI planner. */
export const setQty = (saved, id, qty) =>
  saved.map(i => (i.id === id ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i));
export const removeItem = (saved, id) => saved.filter(i => i.id !== id);
export function mergeLines(saved, lines) {
  let out = [...saved];
  for (const l of lines) {
    const item = findItem(l.id);
    if (!item) continue;
    const at = out.findIndex(i => i.id === l.id && !i.paid);
    const next = {
      ...item,
      ...(at >= 0 ? out[at] : {}),
      qty: l.qty,
      ...(l.lineup ? { lineup: l.lineup } : {}),
    };
    if (at >= 0) out[at] = next;
    else out.push(next);
  }
  return out;
}
/** After PayPal: the paid items leave the cart but stay in the planner as booked. */
export const markPaid = (saved, ids, receipt) =>
  saved.map(i => (ids.includes(i.id) && !i.paid ? { ...i, paid: receipt } : i));

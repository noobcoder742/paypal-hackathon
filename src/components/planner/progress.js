// How a purchase moves the couple's plan forward: which checklist tasks it completes, how it
// shows on the budget, and each saved item's progress (enquiry → in cart → deposit paid).
import { round2 } from '../../lib/format.js';

/** The checklist, by category. `categories` links a task to marketplace categories: paying for one ticks it. */
export const SEED_TASKS = [
  { id: 'venue-enquiry', title: 'Enquire with the hotel', group: 'Venue', venue: true },
  { id: 'date', title: 'Choose the date', group: 'Venue' },
  { id: 'guests', title: 'Guest list', group: 'Guests' },
  { id: 'invite', title: 'Send invitations', group: 'Guests' },
  { id: 'seating', title: 'Seating plan', group: 'Guests' },
  { id: 'florals', title: 'Book florals', group: 'Vendors', categories: ['Floral Arrangements'] },
  { id: 'decor', title: 'Book ceremony décor', group: 'Vendors', categories: ['Ceremony & Decor'] },
  { id: 'music', title: 'Book music', group: 'Vendors', categories: ['Music & Entertainment'] },
  { id: 'lighting', title: 'Book lighting', group: 'Vendors', categories: ['Lighting & Production'] },
  { id: 'car', title: 'Book the wedding car', group: 'Vendors', categories: ['Chauffeur & Transport'] },
  { id: 'deposits', title: 'Pay vendor deposits', group: 'Logistics', anyPurchase: true },
  { id: 'run', title: 'Wedding-day run sheet', group: 'Logistics' },
].map(t => ({ ...t, done: false }));

/** Older plans used a shorter checklist: keep custom tasks and anything already ticked. */
const RENAMED = { venue: 'venue-enquiry', floral: 'florals', deposit: 'deposits' };
export function migrateTasks(tasks = []) {
  if (tasks.some(t => t.id === 'venue-enquiry')) return tasks;
  const done = new Set(tasks.filter(t => t.done).map(t => RENAMED[t.id] || t.id));
  const custom = tasks.filter(t => String(t.id).startsWith('task'));
  return [...SEED_TASKS.map(t => ({ ...t, done: done.has(t.id) })), ...custom];
}

/** Tick the tasks these paid items complete. Returns the new list and the ids that changed. */
export function completeTasksFor(tasks, paidItems) {
  const cats = new Set(paidItems.map(i => i.category));
  const hits = t =>
    !t.done && ((t.anyPurchase && paidItems.length > 0) || (t.categories || []).some(c => cats.has(c)));
  const ids = tasks.filter(hits).map(t => t.id);
  return { tasks: tasks.map(t => (ids.includes(t.id) ? { ...t, done: true } : t)), ids };
}

/** A budget line for a cart item: the full price, "To pay" until its deposit is paid. */
export const budgetLine = (item, total) => ({
  id: 'item-' + item.id,
  itemId: item.id,
  name: item.name,
  amount: round2(total),
  deposit: round2(total * 0.2),
  status: 'todo',
  paid: false,
});
export const inBudget = (payments, itemId) => payments.some(p => p.itemId === itemId);
export const addToBudget = (payments, item, total) =>
  inBudget(payments, item.id) ? payments : [...payments, budgetLine(item, total)];

/** After payment: each paid item's budget line becomes "Paid 20% deposit" (added if missing). */
export function markDepositsPaid(payments, paid) {
  let out = [...payments];
  for (const { item, total } of paid) {
    if (!inBudget(out, item.id)) out.push(budgetLine(item, total));
    out = out.map(p => (p.itemId === item.id ? { ...p, status: 'deposit' } : p));
  }
  return out;
}
/** What a budget line has actually paid so far. */
export const paidSoFar = p =>
  p.paid ? Number(p.amount || 0) : p.status === 'deposit' ? Number(p.deposit || 0) : 0;

/** Where a saved item stands. */
export function itemStage(item) {
  if (item.paid) return 'paid';
  const band = item.inventoryType === 'ensemble';
  return item.price == null && !band ? 'enquiry' : 'cart';
}
export const STAGES = [
  ['enquiry', 'Enquiry'],
  ['cart', 'In cart'],
  ['paid', 'Deposit paid'],
];

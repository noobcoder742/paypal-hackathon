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

/** Where a saved item stands: enquiry until the deposit is paid, fully paid once the vendor's balance is. */
export const itemStage = item => (item.fullyPaid ? 'paid' : item.paid ? 'deposit' : 'enquiry');
export const STAGES = [
  ['enquiry', 'Enquiry'],
  ['deposit', 'Deposit paid'],
  ['paid', 'Fully paid'],
];

/* Adding tasks and sections anywhere in the checklist (a section is the tasks sharing a group name). */
const newId = () => 'task' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** A new task right after `afterId`, or first in `group` when no task is given. */
export function insertTask(tasks, { afterId, group }) {
  const at = afterId ? tasks.findIndex(t => t.id === afterId) : tasks.findIndex(t => t.group === group);
  const g = afterId ? tasks[at]?.group : group;
  const task = { id: newId(), title: 'New task', group: g || 'My tasks', done: false };
  const i = at < 0 ? tasks.length : afterId ? at + 1 : at;
  return { tasks: [...tasks.slice(0, i), task, ...tasks.slice(i)], id: task.id };
}
/** A new section (with one task to fill in) right after the section `group`. */
export function insertSection(tasks, group) {
  const names = new Set(tasks.map(t => t.group));
  let name = 'New section',
    n = 2;
  while (names.has(name)) name = 'New section ' + n++;
  const last = tasks.map(t => t.group).lastIndexOf(group);
  const task = { id: newId(), title: 'New task', group: name, done: false };
  const i = last < 0 ? tasks.length : last + 1;
  return { tasks: [...tasks.slice(0, i), task, ...tasks.slice(i)], id: task.id };
}
export const renameSection = (tasks, from, to) =>
  tasks.map(t => (t.group === from ? { ...t, group: to } : t));

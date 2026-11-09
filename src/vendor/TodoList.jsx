// AG Studio custom widget: what the vendor should do next, from the (filtered) bookings.
// Clicking an item opens that booking's page in the workspace.
import React from 'react';
import { useWidgetRows } from '../hotel/widgets/useWidgetRows.js';
import { sgdWhole } from '../lib/format.js';

const dayOf = v => {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? null : d;
};
export default function TodoList(params) {
  const rows = useWidgetRows(params, ['id', 'couple', 'status', 'due', 'date']);
  const now = Date.now(),
    items = [];
  for (const r of rows) {
    const d = dayOf(r.date),
      days = d ? Math.round((d - now) / 864e5) : null;
    if (r.status === 'new')
      items.push({
        rank: 0,
        tone: 'new',
        task: 'open',
        id: r.id,
        text: `Open the new booking from ${r.couple}`,
      });
    else if (r.status === 'overdue')
      items.push({
        rank: 1,
        tone: 'overdue',
        task: 'reminder',
        id: r.id,
        text: `Send ${r.couple} a friendly reminder (${sgdWhole(r.due)} overdue)`,
      });
    else if (r.status === 'deposit_paid')
      items.push({
        rank: 2,
        tone: 'deposit_paid',
        task: 'invoice',
        id: r.id,
        text: `Send ${r.couple} the balance invoice (${sgdWhole(r.due)})`,
      });
    if (days != null && days >= 0 && days <= 45 && r.status !== 'paid_in_full')
      items.push({
        rank: 3,
        tone: 'balance_invoiced',
        task: 'prep',
        id: r.id,
        text: `${r.couple}'s wedding is in ${days} days: balance not settled`,
      });
  }
  items.sort((a, b) => a.rank - b.rank);
  if (!items.length) return <div className="w-empty">Nothing to do. Every booking is in hand.</div>;
  return (
    <ol className="w-todo">
      {items.slice(0, 9).map((t, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('vs-open-booking', { detail: { id: String(t.id), task: t.task } })
              )
            }
          >
            <i className={'t-' + t.tone} aria-hidden="true" />
            <span>
              {t.text}
              <small>
                {
                  {
                    open: 'Takes a minute',
                    reminder: 'About 2 minutes',
                    invoice: 'About 1 minute',
                    prep: 'About 5 minutes',
                  }[t.task]
                }
              </small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        </li>
      ))}
    </ol>
  );
}

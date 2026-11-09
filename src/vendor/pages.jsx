// The workspace pages: Overview, Bookings, Payments and Calendar.
import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { STATUSES, sgd, balanceDue, statusMeta } from './status.js';
import { StatusPill, CountUp, stagger, dateText, ago } from './ui.jsx';

export function Overview({ vendor, bookings, open, go }) {
  const fresh = bookings.filter(b => b.status === 'new');
  const kpis = [
    { label: 'New bookings', value: fresh.length, tone: 'new', fmt: v => Math.round(v) },
    {
      label: 'Deposits received',
      value: bookings.reduce((s, b) => s + b.deposit, 0),
      tone: 'deposit_paid',
      fmt: v => sgd(Math.round(v)),
    },
    {
      label: 'Balances to collect',
      value: bookings.reduce((s, b) => s + balanceDue(b), 0),
      tone: 'balance_invoiced',
      fmt: v => sgd(Math.round(v)),
    },
    {
      label: 'Paid in full',
      value: bookings.filter(b => b.status === 'paid_in_full').length,
      tone: 'paid_in_full',
      fmt: v => Math.round(v),
    },
  ];
  const next = bookings
    .filter(b => b.weddingDate)
    .sort((a, b) => a.weddingDate.localeCompare(b.weddingDate))
    .slice(0, 4);
  const overdue = bookings.filter(b => b.status === 'overdue');
  const hour = new Date().getHours();
  return (
    <div className="vs-page">
      <header className="vs-page-head vs-rise">
        <div>
          <h1>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</h1>
          <p className="vs-muted">
            {vendor.name.replace(' (demo)', '')} ·{' '}
            {fresh.length
              ? `${fresh.length} new booking${fresh.length === 1 ? '' : 's'} waiting`
              : 'You’re all caught up'}
          </p>
        </div>
      </header>
      <section className="vs-kpis">
        {kpis.map((k, i) => (
          <div key={k.label} {...stagger(i)} className={'vs-kpi vs-rise k-' + k.tone}>
            <span>
              <i aria-hidden="true" />
              {k.label}
            </span>
            <b>
              <CountUp value={k.value} format={k.fmt} />
            </b>
          </div>
        ))}
      </section>
      <div className="vs-cols">
        <section className="vs-card vs-rise" style={{ '--i': 2 }}>
          <div className="vs-card-head">
            <h2>New bookings</h2>
            <button type="button" className="vs-chip-link" onClick={() => go('bookings', 'new')}>
              See all <ArrowUpRight size={13} />
            </button>
          </div>
          {fresh.length ? (
            <ul className="vs-list">
              {fresh.map((b, i) => (
                <li key={b.id} {...stagger(i)}>
                  <button type="button" className="vs-row-btn is-new" onClick={() => open(b)}>
                    <span className="vs-new-dot" aria-hidden="true" />
                    <span className="vs-row-main">
                      <b>{b.couple}</b>
                      <small>
                        {b.itemName} · {dateText(b.weddingDate)}
                      </small>
                    </span>
                    <span className="vs-row-amt">
                      {sgd(b.deposit)} <small>deposit</small>
                    </span>
                    <StatusPill status={b.status} compact />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vs-empty">
              No new bookings. When a couple pays their deposit through PayPal, it appears here.
            </p>
          )}
          {overdue.length > 0 && (
            <div className="vs-callout bad">
              <b>
                {overdue.length} overdue balance{overdue.length === 1 ? '' : 's'}
              </b>
              <span>A friendly reminder usually does it.</span>
              <button type="button" className="vs-chip-link" onClick={() => go('bookings', 'overdue')}>
                Review <ArrowUpRight size={13} />
              </button>
            </div>
          )}
        </section>
        <section className="vs-card vs-rise" style={{ '--i': 3 }}>
          <div className="vs-card-head">
            <h2>Next weddings</h2>
            <button type="button" className="vs-chip-link" onClick={() => go('calendar')}>
              Calendar <ArrowUpRight size={13} />
            </button>
          </div>
          <ul className="vs-list">
            {next.map((b, i) => (
              <li key={b.id} {...stagger(i)}>
                <button type="button" className="vs-row-btn" onClick={() => open(b)}>
                  <span className="vs-date">
                    <b>{new Date(b.weddingDate + 'T00:00:00').getDate()}</b>
                    <small>
                      {new Date(b.weddingDate + 'T00:00:00').toLocaleDateString('en-SG', { month: 'short' })}
                    </small>
                  </span>
                  <span className="vs-row-main">
                    <b>{b.couple}</b>
                    <small>{b.itemName}</small>
                  </span>
                  <StatusPill status={b.status} compact />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function Bookings({ bookings, open, filter, setFilter }) {
  const [q, setQ] = useState('');
  const counts = Object.fromEntries(
    STATUSES.map(s => [s.key, bookings.filter(b => b.status === s.key).length])
  );
  const shown = bookings.filter(
    b =>
      (filter === 'all' || b.status === filter) &&
      (!q || (b.couple + ' ' + b.itemName).toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="vs-page">
      <header className="vs-page-head vs-rise">
        <div>
          <h1>Bookings</h1>
          <p className="vs-muted">Every couple who has booked you, and where their payment is.</p>
        </div>
        <input
          className="vs-search"
          type="search"
          placeholder="Search couples or items"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search bookings"
        />
      </header>
      <div className="vs-chips" role="tablist" aria-label="Filter by status">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'on' : ''}
          onClick={() => setFilter('all')}
        >
          All <span>{bookings.length}</span>
        </button>
        {STATUSES.map(s => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={filter === s.key}
            className={'c-' + s.key + (filter === s.key ? ' on' : '')}
            onClick={() => setFilter(s.key)}
          >
            <i aria-hidden="true" />
            {s.label} <span>{counts[s.key]}</span>
          </button>
        ))}
      </div>
      <div className="vs-table-wrap vs-rise" style={{ '--i': 1 }}>
        <table className="vs-table">
          <thead>
            <tr>
              <th>Couple</th>
              <th>Wedding</th>
              <th>Item</th>
              <th className="num">Total</th>
              <th className="num">Deposit</th>
              <th className="num">Balance</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b, i) => (
              <tr
                key={b.id}
                {...stagger(i)}
                className={'vs-rise' + (b.status === 'new' ? ' is-new' : '')}
                tabIndex={0}
                onClick={() => open(b)}
                onKeyDown={e => {
                  if (e.key === 'Enter') open(b);
                }}
              >
                <td>
                  <span className="vs-couple">
                    {b.status === 'new' && <span className="vs-new-dot" aria-label="New" />}
                    <b>{b.couple}</b>
                  </span>
                </td>
                <td>{dateText(b.weddingDate)}</td>
                <td>
                  {b.itemName}
                  {b.qty > 1 ? ` × ${b.qty}` : ''}
                </td>
                <td className="num">{sgd(b.total)}</td>
                <td className="num ok">{sgd(b.deposit)}</td>
                <td className={'num' + (b.status === 'overdue' ? ' bad' : '')}>{sgd(balanceDue(b))}</td>
                <td>
                  {b.status === 'paid_in_full' ? (
                    <span className="vs-paid">
                      <Check size={14} /> Paid
                    </span>
                  ) : (
                    <span className="vs-unpaid">Deposit only</span>
                  )}
                </td>
                <td>
                  <StatusPill status={b.status} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="vs-empty">No bookings match.</p>}
      </div>
    </div>
  );
}

const EVENT = {
  deposit: ['Deposit received', 'deposit_paid'],
  invoice: ['Balance invoice sent', 'balance_invoiced'],
  reminder: ['Reminder sent', 'overdue'],
  paid: ['Balance paid', 'paid_in_full'],
};
export function Payments({ bookings, open }) {
  const events = useMemo(
    () => bookings.flatMap(b => (b.events || []).map(e => ({ ...e, b }))).sort((a, b) => b.at - a.at),
    [bookings]
  );
  const inSum = events
    .filter(e => e.type === 'deposit' || e.type === 'paid')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const due = bookings.reduce((s, b) => s + balanceDue(b), 0);
  return (
    <div className="vs-page">
      <header className="vs-page-head vs-rise">
        <div>
          <h1>Payments</h1>
          <p className="vs-muted">
            Everything that moved through PayPal, newest first. Sandbox: test money only.
          </p>
        </div>
      </header>
      <section className="vs-kpis two">
        <div className="vs-kpi vs-rise k-paid_in_full">
          <span>
            <i />
            Received through PayPal
          </span>
          <b>
            <CountUp value={inSum} format={v => sgd(Math.round(v))} />
          </b>
        </div>
        <div className="vs-kpi vs-rise k-balance_invoiced" style={{ '--i': 1 }}>
          <span>
            <i />
            Still to collect
          </span>
          <b>
            <CountUp value={due} format={v => sgd(Math.round(v))} />
          </b>
        </div>
      </section>
      <section className="vs-card vs-rise" style={{ '--i': 2 }}>
        <ol className="vs-feed">
          {events.map((e, i) => (
            <li key={i} {...stagger(i)}>
              <button type="button" className="vs-row-btn" onClick={() => open(e.b)}>
                <span className={'vs-dot d-' + EVENT[e.type][1]} aria-hidden="true" />
                <span className="vs-row-main">
                  <b>{EVENT[e.type][0]}</b>
                  <small>
                    {e.b.couple} · {e.b.itemName}
                  </small>
                </span>
                {e.amount ? <span className="vs-row-amt">{sgd(e.amount)}</span> : <span />}
                <time className="vs-muted">{ago(e.at)}</time>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function Calendar({ bookings, open }) {
  const dated = bookings.filter(b => b.weddingDate);
  const first = dated.map(b => b.weddingDate).sort()[0] || new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(first.slice(0, 7));
  const start = new Date(month + '-01T00:00:00');
  const lead = (start.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < lead; i++) days.push(null);
  for (let d = new Date(start); d.getMonth() === start.getMonth(); d.setDate(d.getDate() + 1))
    days.push(new Date(d));
  const iso = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const shift = n => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };
  return (
    <div className="vs-page">
      <header className="vs-page-head vs-rise">
        <div>
          <h1>Calendar</h1>
          <p className="vs-muted">Wedding days, coloured by payment status.</p>
        </div>
        <div className="vs-month">
          <button type="button" className="vs-icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <b>{start.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</b>
          <button type="button" className="vs-icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>
      <div className="vs-legend">
        {STATUSES.map(s => (
          <span key={s.key} className={'l-' + s.key}>
            <i />
            {s.label}
          </span>
        ))}
      </div>
      <div className="vs-cal vs-rise" style={{ '--i': 1 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <span key={d} className="vs-cal-dow">
            {d}
          </span>
        ))}
        {days.map((d, i) => {
          if (!d) return <span key={i} className="vs-cal-blank" />;
          const list = dated.filter(b => b.weddingDate === iso(d));
          return (
            <div
              key={i}
              className={
                'vs-cal-day' +
                (list.length ? ' has' : '') +
                (d.getDay() === 0 || d.getDay() === 6 ? ' we' : '')
              }
            >
              <span className="n">{d.getDate()}</span>
              {list.map(b => (
                <button
                  type="button"
                  key={b.id}
                  className={'vs-cal-ev e-' + b.status}
                  onClick={() => open(b)}
                  title={statusMeta(b.status).label}
                >
                  {b.couple.replace(' (example)', '')}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

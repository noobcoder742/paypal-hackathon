// Wedding planner: checklist, guests & RSVP, seating, budget, vendors and the
// wedding day. Same data and functions as before, restructured as an
// editorial page with a photo header, live summary figures, sliding section
// tabs and animated progress.
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Plus,
  Trash2,
  ClipboardList,
  Users,
  Wallet,
  Store,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import useSlidingIndicator from '../ui/useSlidingIndicator.js';
import GuestsSection from './GuestsSection.jsx';
import { CountUp, Ring, Reveal } from '../ui/motion.jsx';

export const PLANNER_SECTIONS = [
  { id: 'tasks', label: 'Checklist', icon: ClipboardList },
  { id: 'guests', label: 'Guests & RSVP', icon: Users },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'day', label: 'Wedding day', icon: CalendarDays },
];

import DepositInvoices from './DepositInvoices.jsx';
import { sgdWhole } from '../../lib/format.js';
import { celebrate } from '../../vendor/Confetti.jsx';
import { cartItems, unitPrice, payable } from '../cart/cart.js';
import {
  markDepositsPaid,
  paidSoFar,
  itemStage,
  STAGES,
  insertTask,
  insertSection,
  renameSection,
} from './progress.js';
import './progress.css';

/**
 * After a purchase the planner shows the progress, one step at a time: the budget lines turn
 * "Paid 20% deposit", then the completed tasks strike through, then confetti.
 */
function useProgressShow(planner, patch, setPlanTab) {
  const [show, setShow] = useState(null);
  const timers = useRef([]);
  // timers live until the show ends or the planner closes (clearing the celebration must not cut it short)
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const c = planner.celebration;
    if (!c || timers.current.length) return;
    const at = (ms, f) => timers.current.push(setTimeout(f, ms));
    const items = c.paid
      .map(p => ({ item: planner.savedItems.find(i => i.id === p.itemId), total: p.total }))
      .filter(p => p.item);
    setShow({
      banner: true,
      step: 'budget',
      items: new Set(c.paid.map(p => p.itemId)),
      tasks: new Set(c.tasks),
      count: c.tasks.length,
    });
    // bring the part that changes into view (the sticky top bar is ~90 px tall)
    const reveal = selector => {
      const el = document.querySelector(selector);
      if (el)
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
    };
    setPlanTab('budget');
    at(3000, () => setShow(s => s && { ...s, banner: false }));
    at(250, () => reveal('.plan2-budget'));
    at(1000, () => patch({ payments: markDepositsPaid(planner.payments, items) }));
    at(3300, () => {
      setPlanTab('tasks');
      setShow(s => s && { ...s, step: 'tasks' });
    });
    at(3450, () => reveal('.plan2-task.just-done'));
    at(5000, () => {
      celebrate(0, '');
      patch({ celebration: null });
    });
    at(7400, () => {
      setShow(null);
      timers.current = [];
    });
  }, [planner.celebration]); // eslint-disable-line react-hooks/exhaustive-deps
  return show;
}
/** (+) at the end of a checklist row: pops out "Add a task" and "Add a section". */
function AddMenu({ onTask, onSection }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const pick = f => e => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    f();
  };
  return (
    <span className={'plan2-addmenu' + (open ? ' open' : '')} ref={ref}>
      {open && (
        <span className="plan2-addopts" role="menu">
          <button type="button" role="menuitem" onClick={pick(onTask)}>
            Add a task
          </button>
          <button type="button" role="menuitem" onClick={pick(onSection)}>
            Add a section
          </button>
        </span>
      )}
      <button
        type="button"
        className="plan2-plus"
        aria-label="Add a task or section here"
        aria-expanded={open}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(o => !o);
        }}
      >
        <Plus size={14} />
      </button>
    </span>
  );
}

export default function PlannerPage(p) {
  const {
    planner,
    patch,
    planTab,
    setPlanTab,
    completed,
    percent,
    exportGuests,
    addGuest,
    updateGuest,
    updateTask,
    toggleFavourite,
    moveFavourite,
    vendorTab,
    setVendorTab,
    go,
    openSeating,
    onAssign,
  } = p;
  // the Seating tab moved into Guests (Assign → / Seating plan); keep old links working
  const tab = planTab === 'seating' ? 'guests' : planTab;
  const tabsRef = useRef(null);
  const [nfcAsked, setNfcAsked] = useState(false);
  useSlidingIndicator(tabsRef, [tab]);
  const attending = planner.guests.filter(g => g.rsvp === 'Attending').length;
  const show = useProgressShow(planner, patch, setPlanTab);
  const [focusId, setFocusId] = useState(null);
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[data-task="${focusId}"]`);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId, planner.tasks]);
  const addTask = where => {
    const r = insertTask(planner.tasks, where);
    patch({ tasks: r.tasks });
    setFocusId(r.id);
  };
  const addSection = group => {
    const r = insertSection(planner.tasks, group);
    patch({ tasks: r.tasks });
    setFocusId(r.id);
  };
  const paid = planner.payments.reduce((s, x) => s + paidSoFar(x), 0);
  const scheduled = planner.payments.reduce((s, x) => s + Number(x.amount || 0), 0);
  // cart items not yet on the budget still count against it
  const itemsCost = cartItems(planner.savedItems)
    .filter(i => payable(i) && !planner.payments.some(p => p.itemId === i.id))
    .reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const booked = planner.savedItems.filter(i => i.paid).length;
  const groups = [...new Set(planner.tasks.map(t => t.group))];
  const stats = [
    [
      'tasks',
      'Checklist',
      <>
        <CountUp value={percent} />%
      </>,
      `${completed} of ${planner.tasks.length} done`,
    ],
    ['guests', 'Guests', <CountUp value={planner.guests.length} />, `${attending} attending`],
    ['budget', 'Budget', <CountUp value={planner.budget} format={sgdWhole} />, `${sgdWhole(paid)} paid`],
    ['vendors', 'Vendors', <CountUp value={planner.savedItems.length} />, `${booked} booked`],
  ];
  return (
    <main className="plan2">
      <div className="plan2-hero">
        <div className="plan2-hero-img" aria-hidden="true" />
        <div className="plan2-hero-copy">
          <span className="acct-kicker">Planner</span>
          <h1>
            Every detail, <em>in its place</em>.
          </h1>
        </div>
      </div>
      <DepositInvoices />
      <div className="plan2-stats">
        {stats.map(([id, l, v, s], i) => (
          <Reveal
            as="button"
            index={i}
            key={id}
            className={'plan2-stat' + (tab === id ? ' on' : '')}
            onClick={() => setPlanTab(id)}
          >
            <span>{l}</span>
            <strong>{v}</strong>
            <small>{s}</small>
          </Reveal>
        ))}
      </div>

      <nav className="plan2-tabs" ref={tabsRef} aria-label="Planner sections">
        <span className="slide-ind" aria-hidden="true" />
        {PLANNER_SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id}
            onClick={() => setPlanTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {show?.banner && show.count > 0 && (
        <div className="plan2-congrats" role="status">
          Congrats! {show.count} task{show.count === 1 ? '' : 's'} completed!
        </div>
      )}
      <div className="plan2-body" key={tab}>
        {tab === 'tasks' && (
          <>
            <div className="plan2-head">
              <div>
                <h2>Checklist</h2>
                <p>
                  {completed} of {planner.tasks.length} done
                </p>
              </div>
              <Ring value={percent / 100} size={96} stroke={5} label={`${percent}% complete`}>
                <strong>{percent}%</strong>
              </Ring>
            </div>
            <ol className="plan2-timeline">
              {groups.map((group, gi) => {
                const list = planner.tasks.filter(t => t.group === group),
                  done = list.filter(t => t.done).length;
                return (
                  <Reveal
                    as="li"
                    index={gi}
                    key={group}
                    className={'plan2-phase' + (done === list.length ? ' complete' : '')}
                  >
                    <div className="plan2-phase-head">
                      <span className="plan2-node">
                        {done === list.length ? <Check size={13} /> : gi + 1}
                      </span>
                      <input
                        className="plan2-phase-title"
                        value={group}
                        aria-label="Section name"
                        onChange={e => patch({ tasks: renameSection(planner.tasks, group, e.target.value) })}
                        onBlur={e =>
                          !e.target.value.trim() &&
                          patch({ tasks: renameSection(planner.tasks, group, 'Untitled section') })
                        }
                      />
                      <small>
                        {done}/{list.length}
                      </small>
                      <AddMenu onTask={() => addTask({ group })} onSection={() => addSection(group)} />
                    </div>
                    {list.map(t => (
                      <label
                        key={t.id}
                        className={
                          'plan2-task' +
                          (t.done ? ' done' : '') +
                          (show?.step === 'tasks' && show.tasks.has(t.id) ? ' just-done' : '')
                        }
                      >
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={e => updateTask(t.id, e.target.checked)}
                        />
                        <span className="plan2-check" aria-hidden="true">
                          <Check size={12} />
                        </span>
                        <input
                          className="plan2-task-title"
                          data-task={t.id}
                          value={t.title}
                          aria-label="Task name"
                          onChange={e =>
                            patch({
                              tasks: planner.tasks.map(x =>
                                x.id === t.id ? { ...x, title: e.target.value } : x
                              ),
                            })
                          }
                        />
                        <AddMenu
                          onTask={() => addTask({ afterId: t.id })}
                          onSection={() => addSection(t.group)}
                        />
                      </label>
                    ))}
                  </Reveal>
                );
              })}
            </ol>
            {!planner.tasks.length && (
              <button className="plan2-add" onClick={() => addSection('')}>
                <Plus size={15} /> Add a section
              </button>
            )}
          </>
        )}

        {tab === 'guests' && (
          <GuestsSection
            guests={planner.guests}
            patch={patch}
            addGuest={addGuest}
            updateGuest={updateGuest}
            exportGuests={exportGuests}
            onAssign={onAssign}
            openSeating={openSeating}
          />
        )}

        {tab === 'budget' && (
          <>
            <div className="plan2-head">
              <div>
                <h2>Budget</h2>
              </div>
            </div>
            <div className="plan2-budget">
              <label className="plan2-budget-total">
                <span>Total budget (SGD)</span>
                <input
                  type="number"
                  min="0"
                  value={planner.budget}
                  onChange={e => patch({ budget: Number(e.target.value) })}
                />
              </label>
              <div className="plan2-budget-bar" aria-label="Budget use">
                <i
                  className="paid"
                  style={{ width: Math.min(100, (paid / Math.max(1, planner.budget)) * 100) + '%' }}
                />
                <i
                  className="sched"
                  style={{
                    width:
                      Math.min(100, (Math.max(0, scheduled - paid) / Math.max(1, planner.budget)) * 100) +
                      '%',
                  }}
                />
                <i
                  className="items"
                  style={{ width: Math.min(100, (itemsCost / Math.max(1, planner.budget)) * 100) + '%' }}
                />
              </div>
              <div className="plan2-legend">
                <span>
                  <b className="paid" />
                  Paid {sgdWhole(paid)}
                </span>
                <span>
                  <b className="sched" />
                  Scheduled {sgdWhole(Math.max(0, scheduled - paid))}
                </span>
                <span>
                  <b className="items" />
                  In cart {sgdWhole(itemsCost)}
                </span>
                <span className="rest">Remaining {sgdWhole(planner.budget - scheduled - itemsCost)}</span>
              </div>
            </div>
            <div className="plan2-head small">
              <h3>Payments</h3>
              <button
                className="plan2-add"
                onClick={() =>
                  patch({
                    payments: [
                      ...planner.payments,
                      { id: Date.now(), name: 'New payment', amount: 0, paid: false },
                    ],
                  })
                }
              >
                <Plus size={15} /> Add payment
              </button>
            </div>
            {planner.payments.map(x => (
              <div
                className={
                  'plan2-pay' +
                  (x.paid ? ' paid' : '') +
                  (x.itemId ? ' item status-' + x.status : '') +
                  (show?.items.has(x.itemId) ? ' just-paid' : '')
                }
                key={x.id}
              >
                <input
                  value={x.name}
                  aria-label="Payment name"
                  onChange={e =>
                    patch({
                      payments: planner.payments.map(y =>
                        y.id === x.id ? { ...y, name: e.target.value } : y
                      ),
                    })
                  }
                />
                <input
                  type="number"
                  aria-label="Amount"
                  value={x.amount}
                  onChange={e =>
                    patch({
                      payments: planner.payments.map(y =>
                        y.id === x.id ? { ...y, amount: Number(e.target.value) } : y
                      ),
                    })
                  }
                />
                {x.itemId && !x.paid ? (
                  <span className="plan2-pay-status" key={x.status}>
                    {x.status === 'deposit' ? 'Paid 20% deposit' : 'To pay'}
                  </span>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={!!x.paid}
                      onChange={e =>
                        patch({
                          payments: planner.payments.map(y =>
                            y.id === x.id ? { ...y, paid: e.target.checked } : y
                          ),
                        })
                      }
                    />{' '}
                    Paid
                  </label>
                )}
                <button
                  aria-label="Remove payment"
                  onClick={() => patch({ payments: planner.payments.filter(y => y.id !== x.id) })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!planner.payments.length && (
              <p className="acct-muted">Add items from your cart, or add a payment.</p>
            )}
          </>
        )}

        {tab === 'vendors' && (
          <>
            <div className="plan2-head">
              <div>
                <h2>Vendors</h2>
              </div>
              <button className="btn-ink" onClick={() => go('market')}>
                Browse marketplace <ArrowRight size={15} />
              </button>
            </div>
            <div className="vendor-tabs plan2-subtabs" role="tablist" aria-label="Saved items">
              <button
                role="tab"
                aria-selected={vendorTab === 'inventory'}
                className={vendorTab === 'inventory' ? 'active' : ''}
                onClick={() => setVendorTab('inventory')}
              >
                My Cart <span>{planner.savedItems.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={vendorTab === 'favourites'}
                className={vendorTab === 'favourites' ? 'active' : ''}
                onClick={() => setVendorTab('favourites')}
              >
                Favourites <span>{planner.favourites.length}</span>
              </button>
            </div>
            {vendorTab === 'inventory' ? (
              <div className="plan2-items">
                {planner.savedItems.map((item, i) => (
                  <Reveal index={i} className="plan2-item" key={item.id}>
                    <div className="plan2-item-img" style={{ backgroundImage: `url(${item.photo})` }} />
                    <span className="plan2-item-name">
                      {item.name}
                      <small>{item.vendor?.replace(' (demo)', '')}</small>
                    </span>
                    <ol className={'plan2-stages at-' + itemStage(item)} aria-label="Progress">
                      {STAGES.map(([k, label]) => (
                        <li key={k} className={k === itemStage(item) ? 'now' : ''}>
                          {label}
                        </li>
                      ))}
                    </ol>
                    <button
                      className="text-link"
                      onClick={() => patch({ savedItems: planner.savedItems.filter(x => x.id !== item.id) })}
                    >
                      Remove
                    </button>
                  </Reveal>
                ))}
                {!planner.savedItems.length && (
                  <div className="plan2-empty">
                    <Sparkles size={22} />
                    <strong>Nothing here yet</strong>
                    <span>Add vendors from the marketplace.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="vendor-favourites">
                {[...new Set(planner.favourites.map(x => x.category))].map(category => (
                  <section className="favourite-category" key={category}>
                    <div className="between">
                      <h3>{category}</h3>
                      <small>Rank your preferences</small>
                    </div>
                    {planner.favourites
                      .filter(x => x.category === category)
                      .map((item, i, group) => (
                        <div className="favourite-line" key={item.id}>
                          <span className="favourite-rank">{i + 1}</span>
                          <span className="favourite-name">
                            {item.name}
                            <small>
                              {item.vendor} ·{' '}
                              {item.price == null ? 'Quote required' : sgdWhole(item.price) + ' estimated'}
                            </small>
                          </span>
                          <div className="favourite-actions">
                            <button
                              title="Move up"
                              aria-label={'Move ' + item.name + ' up'}
                              disabled={i === 0}
                              onClick={() => moveFavourite(category, item.id, -1)}
                            >
                              ↑
                            </button>
                            <button
                              title="Move down"
                              aria-label={'Move ' + item.name + ' down'}
                              disabled={i === group.length - 1}
                              onClick={() => moveFavourite(category, item.id, 1)}
                            >
                              ↓
                            </button>
                            <button
                              title="Remove favourite"
                              aria-label={'Remove ' + item.name + ' from favourites'}
                              onClick={() => toggleFavourite(item)}
                            >
                              ★
                            </button>
                          </div>
                        </div>
                      ))}
                  </section>
                ))}
                {!planner.favourites.length && (
                  <div className="plan2-empty">
                    <Sparkles size={22} />
                    <strong>No favourites yet</strong>
                    <span>Star products in the marketplace to compare them here.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'day' && (
          <>
            <div className="plan2-head">
              <div>
                <h2>Wedding day</h2>
                <p>
                  Check guests in as they arrive and keep the run sheet in one place. QR check-in comes with
                  sign-in.
                </p>
              </div>
              <Ring
                value={planner.guests.filter(g => g.checkedIn).length / Math.max(1, attending)}
                size={96}
                stroke={5}
                label="Guests checked in"
              >
                <strong>{planner.guests.filter(g => g.checkedIn).length}</strong>
                <small>of {attending}</small>
              </Ring>
            </div>
            <div className="plan2-checkin">
              {planner.guests
                .filter(g => g.rsvp === 'Attending')
                .map(g => (
                  <label key={g.id} className={'plan2-task' + (g.checkedIn ? ' done' : '')}>
                    <input
                      type="checkbox"
                      checked={g.checkedIn}
                      onChange={e => updateGuest(g.id, { checkedIn: e.target.checked })}
                    />
                    <span className="plan2-check" aria-hidden="true">
                      <Check size={12} />
                    </span>
                    <span>
                      {g.name || 'Unnamed guest'}
                      <small>{g.tableId ? ` · ${g.tableId}` : ''}</small>
                    </span>
                  </label>
                ))}
              {!attending && <p className="acct-muted">Guests marked Attending appear here on the day.</p>}
            </div>
            <aside className="nfc-promo">
              <div className="nfc-visual" aria-hidden="true">
                <span className="nfc-card">
                  <i />
                  <b>WS</b>
                </span>
                <span className="nfc-waves">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="nfc-stand" />
              </div>
              <div>
                <span className="acct-kicker">Coming soon · NFC check-in kit</span>
                <h3>Guests tap in. You stay present.</h3>
                <p>
                  A table-top stand and tap cards for your reception desk. Guests tap their invitation card or
                  phone; they're checked in here instantly, with their table and seat shown on screen. No
                  lists, no queue.
                </p>
                <ul>
                  <li>Works with this guest list and your seating plan</li>
                  <li>Live arrivals for your coordinator</li>
                  <li>Branded to your wedding</li>
                </ul>
                {nfcAsked ? (
                  <p className="nfc-thanks">
                    <Check size={15} /> Thanks, we'll let you know when the kit is available.
                  </p>
                ) : (
                  <button className="btn-ink" onClick={() => setNfcAsked(true)}>
                    Notify me <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </aside>
            <label className="plan2-notes">
              <span>Run sheet & coordination notes</span>
              <textarea
                rows="7"
                value={planner.weddingNotes}
                onChange={e => patch({ weddingNotes: e.target.value })}
                placeholder="Timeline, vendor arrivals, hotel instructions..."
              />
            </label>
          </>
        )}
      </div>
    </main>
  );
}

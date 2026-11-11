// Cart and payment page: every vendor deposit is paid here, whether the items came from the
// marketplace, the 3D studio or the AI planner. Quantities, a promo code, and PayPal.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Check,
  Tag,
  X,
  ArrowRight,
  ShieldCheck,
  Lock,
  Wallet,
} from 'lucide-react';
import { celebrate } from '../../vendor/Confetti.jsx';
import { completeTasksFor, addToBudget, inBudget } from '../planner/progress.js';
import {
  cartItems,
  specLine,
  payable,
  unitPrice,
  orderLines,
  previewTotals,
  setQty,
  removeItem,
  markPaid,
  MAX_QTY,
} from './cart.js';
import './cart.css';
import { sgdCents } from '../../lib/format.js';

const post = body =>
  fetch('/api/paypal/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async r => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
const read = (k, f) => {
  try {
    return f(JSON.parse(localStorage.getItem(k)));
  } catch {
    return null;
  }
};
/** The venue chosen on the Design page and the table count in the studio, for the vendors' booking pages. */
const context = () => ({
  venueId: read('wedding-design-v1', v => v?.venueId) || undefined,
  tables: read('wedding-room-v2', v => v?.tables?.length) || undefined,
});
const thumb = url => (url || '').replace(/w=\d+/, 'w=240');

export default function CartPage({ planner, patch, go }) {
  const { tables } = useMemo(context, []);
  const items = cartItems(planner.savedItems, tables);
  const lines = orderLines(items);
  const [code, setCode] = useState(''),
    [promo, setPromo] = useState(null),
    [promoError, setPromoError] = useState('');
  const [quote, setQuote] = useState(null),
    [error, setError] = useState(''),
    [paid, setPaid] = useState(null),
    [paying, setPaying] = useState(false);
  const key = JSON.stringify([lines, promo]);
  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    let live = true;
    post({ action: 'quote', lines, promo })
      .then(r => {
        if (!live) return;
        if (r.totals) {
          setQuote(r.totals);
          setError('');
        } else if (r.error === 'bad_promo') {
          setPromo(null);
        } else setError(r.message || '');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = quote || previewTotals(items);
  const update = saved => patch({ savedItems: saved });
  const applyPromo = async e => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setPromoError('');
    const r = await post({ action: 'quote', lines, promo: c });
    if (r.totals) {
      setPromo(c.toUpperCase());
      setQuote(r.totals);
      setCode('');
    } else setPromoError(r.message || 'That promo code isn’t valid.');
  };
  const planId = () => {
    let id = planner.checkoutPlanId;
    if (!id) {
      id = 'plan-' + (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
      patch({ checkoutPlanId: id });
    }
    return id;
  };
  // Make payment: the server creates the order, then PayPal's own page asks the couple to approve it
  const makePayment = async () => {
    setError('');
    setPaying(true);
    const r = await post({ action: 'create', planId: planId(), lines, promo, ...context() }).catch(
      () => ({})
    );
    if (!r.approveUrl) {
      setPaying(false);
      setError(r.message || 'PayPal couldn’t create the order. Nothing was charged; please try again.');
      return;
    }
    window.location.assign(r.approveUrl);
  };
  // Paid: the items are booked, their checklist tasks tick, and the planner plays the progress
  // (budget lines turn "Paid 20% deposit", the tasks strike through) the next time it opens.
  const onPaid = r => {
    const lines = r.lines || [],
      ids = lines.map(l => l.id);
    const paidItems = planner.savedItems.filter(i => ids.includes(i.id));
    const done = completeTasksFor(planner.tasks, paidItems);
    setPaid({ amount: r.depositTotal, items: lines, tasks: done.ids.length });
    patch({
      savedItems: markPaid(planner.savedItems, ids, {
        captureId: r.captureId,
        at: Date.now(),
        amount: r.depositTotal,
      }),
      tasks: done.tasks,
      celebration: { tasks: done.ids, paid: lines.map(l => ({ itemId: l.id, total: l.total })) },
      checkoutPlanId: null,
    });
    setTimeout(() => celebrate(r.depositTotal, 'paid with PayPal'), 300);
  };
  // back from PayPal: ?checkout=return&token=<order id>, or ?checkout=cancel
  useEffect(() => {
    const q = new URLSearchParams(window.location.search),
      state = q.get('checkout'),
      orderId = q.get('token');
    if (!state) return;
    history.replaceState(null, '', window.location.pathname + '#cart');
    if (state === 'cancel') {
      setError('Payment cancelled. Nothing was charged.');
      return;
    }
    if (!orderId) return;
    setPaying(true);
    post({ action: 'capture', orderId })
      .then(r => {
        if (r.status === 'COMPLETED') onPaid(r);
        else setError('PayPal couldn’t complete this payment. Nothing was charged; please try again.');
      })
      .catch(() => setError('We couldn’t reach PayPal. Nothing was charged; please try again.'))
      .finally(() => setPaying(false));
  }, []);

  if (paid)
    return (
      <main className="platform-page cart-page">
        <section className="cart-done">
          <span className="cart-done-icon">
            <Check size={28} />
          </span>
          <h1>
            Your vendors are <em>booked</em>
          </h1>
          <p>{sgdCents(paid.amount)} in deposits paid with PayPal.</p>
          {paid.tasks > 0 && (
            <p className="cart-congrats">
              Congrats! {paid.tasks} task{paid.tasks === 1 ? '' : 's'} completed!
            </p>
          )}
          <ul>
            {paid.items.map(i => (
              <li key={i.id}>
                <Check size={15} /> {i.name}
                <small>{i.vendor?.replace(' (demo)', '')}</small>
              </li>
            ))}
          </ul>
          <div className="cart-done-actions">
            <button className="cart-primary" onClick={() => go('plan')}>
              Update my plan <ArrowRight size={16} />
            </button>
            <button className="cart-link" onClick={() => go('market')}>
              Keep browsing
            </button>
          </div>
        </section>
      </main>
    );

  return (
    <main className="platform-page cart-page">
      <div className="cart-head">
        <span className="page-eyebrow">YOUR CART</span>
        <h1>
          Ready to <em>book</em>
        </h1>
        <p>20% deposits today. Vendors invoice the rest later.</p>
      </div>
      {!items.length ? (
        <section className="cart-empty">
          <span>
            <ShoppingBag size={26} />
          </span>
          <h2>Your cart is empty</h2>
          <p>
            Add florals, music, lighting and more from the marketplace or the 3D studio, or ask the AI planner
            to put a plan together.
          </p>
          <button className="cart-primary" onClick={() => go('market')}>
            Browse vendors <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <div className="cart-grid">
          <section className="cart-list" aria-label="Items in your cart">
            {items.map(i => {
              const ok = payable(i),
                line = ok ? unitPrice(i) * i.qty : 0;
              return (
                <article className="cart-row" key={i.id}>
                  <img src={thumb(i.photo)} alt="" loading="lazy" />
                  <div className="cart-info">
                    <h3>{i.name}</h3>
                    <p className="cart-spec">{specLine(i)}</p>
                    {ok && (
                      <button
                        type="button"
                        className={'cart-budget' + (inBudget(planner.payments, i.id) ? ' on' : '')}
                        disabled={inBudget(planner.payments, i.id)}
                        onClick={() => patch({ payments: addToBudget(planner.payments, i, line) })}
                      >
                        {inBudget(planner.payments, i.id) ? <Check size={13} /> : <Wallet size={13} />}
                        {inBudget(planner.payments, i.id) ? 'In budget' : 'Add to budget'}
                      </button>
                    )}
                  </div>
                  {ok ? (
                    <div className="cart-qty" role="group" aria-label={'Quantity of ' + i.name}>
                      <button
                        type="button"
                        aria-label="One fewer"
                        disabled={i.qty <= 1}
                        onClick={() => update(setQty(planner.savedItems, i.id, i.qty - 1))}
                      >
                        <Minus size={14} />
                      </button>
                      <span key={i.qty} className="cart-qty-n">
                        {i.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="One more"
                        disabled={i.qty >= MAX_QTY}
                        onClick={() => update(setQty(planner.savedItems, i.id, i.qty + 1))}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="cart-qty quote">Quote</div>
                  )}
                  <div className="cart-price">
                    {ok ? (
                      <>
                        <b>{sgdCents(line)}</b>
                        <small>{sgdCents(line * 0.2)} deposit</small>
                      </>
                    ) : (
                      <small>On request</small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cart-del"
                    aria-label={'Remove ' + i.name}
                    onClick={() => update(removeItem(planner.savedItems, i.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </section>
          <aside className="cart-summary">
            <h2>Summary</h2>
            <dl>
              <div>
                <dt>Vendor total</dt>
                <dd>{sgdCents(totals.vendorTotal)}</dd>
              </div>
              <div>
                <dt>Deposits (20%)</dt>
                <dd>{sgdCents(totals.depositTotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="cart-discount">
                  <dt>Promo {totals.promo?.code}</dt>
                  <dd>−{sgdCents(totals.discount)}</dd>
                </div>
              )}
              <div className="cart-due">
                <dt>Due today</dt>
                <dd>{sgdCents(totals.dueToday)}</dd>
              </div>
              <div className="cart-later">
                <dt>Balance, invoiced later by vendors</dt>
                <dd>{sgdCents(totals.vendorTotal - totals.depositTotal)}</dd>
              </div>
            </dl>
            <div className="cart-section">
              <h3>Promo code</h3>
              {promo ? (
                <div className="cart-chip">
                  <Tag size={14} /> {promo} <small>{totals.promo?.label}</small>
                  <button type="button" aria-label="Remove promo code" onClick={() => setPromo(null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <form className="cart-promo" onSubmit={applyPromo}>
                  <input
                    value={code}
                    onChange={e => {
                      setCode(e.target.value);
                      setPromoError('');
                    }}
                    placeholder="Enter a code"
                    aria-label="Promo code"
                    maxLength={24}
                  />
                  <button type="submit" disabled={!code.trim()}>
                    Apply
                  </button>
                </form>
              )}
              {promoError ? (
                <p className="cart-error">{promoError}</p>
              ) : (
                !promo && <p className="cart-muted">Demo code: PAYPALDEMO for 10% off deposits.</p>
              )}
            </div>
            <div className="cart-section">
              <h3>Payment method</h3>
              <label className="cart-method on">
                <input type="radio" name="method" defaultChecked />
                <span className="cart-pp" aria-hidden="true">
                  P
                </span>
                <span>
                  <b>PayPal</b>
                  <small>PayPal balance, bank or card through PayPal</small>
                </span>
              </label>
            </div>
            {error && (
              <p className="cart-error" role="alert">
                {error}
              </p>
            )}
            <div className="cart-pay">
              {lines.length ? (
                <button type="button" className="cart-make-payment" disabled={paying} onClick={makePayment}>
                  {paying ? (
                    <>
                      <span className="cart-spinner" aria-hidden="true" /> Opening PayPal…
                    </>
                  ) : (
                    <>
                      <Lock size={15} /> Make payment · {sgdCents(totals.dueToday)}
                    </>
                  )}
                </button>
              ) : (
                <p className="cart-muted">Nothing here can be paid online yet.</p>
              )}
            </div>
            <p className="cart-trust">
              <ShieldCheck size={14} /> You approve on PayPal. Sandbox: no real money.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}

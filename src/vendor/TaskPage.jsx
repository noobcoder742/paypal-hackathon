// A page that helps the vendor finish one to-do: a friendly reminder (message, email or a call),
// the balance invoice, or getting ready for a wedding that's coming up.
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, Send, Mail, Phone, Check, FileText, ClipboardCheck, Clock } from 'lucide-react';
import { bookingAction } from './api.js';
import { StatusPill, dateText } from './ui.jsx';
import { sgd } from './status.js';
import { celebrate } from './Confetti.jsx';

const first = c => String(c).replace(' (example)', '');
const TEMPLATES = {
  warm: b =>
    `Hi ${first(b.couple)}! We're so excited for your wedding. Just a gentle heads-up that the balance of ${sgd(b.balance)} for your ${b.itemName.toLowerCase()} is open on PayPal whenever you're ready. Any questions at all, just reply here.`,
  brief: b =>
    `Hi ${first(b.couple)}, a quick reminder that ${sgd(b.balance)} is still open for your ${b.itemName.toLowerCase()}. You can pay it on PayPal any time. Thank you!`,
  formal: b =>
    `Dear ${first(b.couple)}, this is a courteous reminder that the balance of ${sgd(b.balance)} for your ${b.itemName.toLowerCase()} remains outstanding. The PayPal invoice can be settled at your convenience. With thanks.`,
};
const Encourage = ({ mins, text }) => (
  <p className="vs-encourage">
    <Clock size={13} /> Takes about {mins} minute{mins === 1 ? '' : 's'}. {text}
  </p>
);
function Done({ onBack, text }) {
  return (
    <div className="vs-task-done vs-rise">
      <Check size={20} />
      <div>
        <b>{text}</b>
        <span>Nicely done. That’s one less thing on your list.</span>
      </div>
      <button type="button" className="vs-secondary" onClick={onBack}>
        Back to the dashboard
      </button>
    </div>
  );
}

function Reminder({ b, onChanged, onBack }) {
  const [tone, setTone] = useState('warm'),
    [text, setText] = useState(() => TEMPLATES.warm(b)),
    [mode, setMode] = useState('message'),
    [busy, setBusy] = useState(''),
    [done, setDone] = useState(''),
    [err, setErr] = useState('');
  const pick = t => {
    setTone(t);
    setText(TEMPLATES[t](b));
  };
  const ai = async () => {
    setBusy('ai');
    setErr('');
    try {
      const r = await bookingAction(b.id, 'draft-reminder');
      setText(r.text);
      setTone('ai');
    } catch (e) {
      setErr(
        e.code === 503
          ? 'The AI writer is resting right now. The templates work just as well.'
          : 'Couldn’t draft it: ' + e.message
      );
    } finally {
      setBusy('');
    }
  };
  const viaPayPal = async () => {
    setBusy('send');
    setErr('');
    try {
      const r = await bookingAction(b.id, 'send-reminder', { text });
      onChanged(r.booking);
      setDone('Reminder sent with PayPal');
    } catch (e) {
      setErr('That didn’t send: ' + e.message);
    } finally {
      setBusy('');
    }
  };
  if (done) return <Done onBack={onBack} text={done} />;
  const subject = encodeURIComponent(`Your wedding booking: ${b.itemName}`);
  return (
    <>
      <div className="vs-seg" role="tablist" aria-label="How to remind them">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'message'}
          className={mode === 'message' ? 'on' : ''}
          onClick={() => setMode('message')}
        >
          <Mail size={15} /> Send a message
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'call'}
          className={mode === 'call' ? 'on' : ''}
          onClick={() => setMode('call')}
        >
          <Phone size={15} /> Give them a call
        </button>
      </div>
      {mode === 'message' ? (
        <section className="vs-card vs-task-card">
          <div className="vs-chips small">
            {[
              ['warm', 'Warm'],
              ['brief', 'Brief'],
              ['formal', 'Formal'],
            ].map(([k, l]) => (
              <button key={k} type="button" className={tone === k ? 'on' : ''} onClick={() => pick(k)}>
                {l}
              </button>
            ))}
            <button type="button" className={tone === 'ai' ? 'on' : ''} disabled={busy === 'ai'} onClick={ai}>
              <Sparkles size={13} /> {busy === 'ai' ? 'Writing…' : 'Write it with AI'}
            </button>
          </div>
          <label htmlFor="vs-msg" className="vs-sub">
            Your message
          </label>
          <textarea
            id="vs-msg"
            rows={5}
            maxLength={400}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <small className="vs-muted">{text.length}/400 · friendly heads-ups get paid fastest</small>
          <div className="vs-row wrap">
            <button
              type="button"
              className="vs-primary"
              disabled={b.isExample || !!busy || !text.trim()}
              onClick={viaPayPal}
            >
              <Send size={15} /> {busy === 'send' ? 'Sending…' : 'Send with PayPal'}
            </button>
            <a
              className={'vs-secondary' + (!b.email ? ' disabled' : '')}
              href={
                b.email ? `mailto:${b.email}?subject=${subject}&body=${encodeURIComponent(text)}` : undefined
              }
              aria-disabled={!b.email}
              onClick={() => b.email && setDone('Email opened in your mail app')}
            >
              <Mail size={15} /> Email instead
            </a>
          </div>
          {b.isExample && (
            <p className="vs-muted">
              Example booking: PayPal sending is switched off. On a real booking this goes out as a PayPal
              invoice reminder.
            </p>
          )}
        </section>
      ) : (
        <section className="vs-card vs-task-card">
          <h3 className="vs-sub">A 2-minute call script</h3>
          <ol className="vs-script">
            <li>
              “Hi {first(b.couple)}, it’s {'{your name}'} from your {b.itemName.toLowerCase()} team. Is now a
              good time?”
            </li>
            <li>
              Share something you’re looking forward to about their day
              {b.weddingDate ? ` on ${dateText(b.weddingDate)}` : ''}.
            </li>
            <li>“There’s {sgd(b.balance)} left on PayPal. Would it help if I resent the link?”</li>
            <li>Note any questions, then thank them.</li>
          </ol>
          <p className="vs-muted">
            {b.email
              ? `Their contact from PayPal: ${b.email}. Phone numbers appear here once couples add them.`
              : 'Example booking: no contact details.'}
          </p>
          <button type="button" className="vs-primary" onClick={() => setDone('Call logged')}>
            <Check size={15} /> I’ve called them
          </button>
        </section>
      )}
      {err && (
        <p className="vs-alert" role="alert">
          <span>{err}</span>
        </p>
      )}
    </>
  );
}

function Invoice({ b, vendor, onChanged, onBack }) {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [err, setErr] = useState('');
  const due = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);
  const send = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await bookingAction(b.id, 'invoice');
      onChanged(r.booking);
      setDone(true);
    } catch (e) {
      setErr(
        e.message === 'no_couple_email'
          ? 'PayPal didn’t share this couple’s email, so an invoice can’t be sent.'
          : 'That didn’t send: ' + e.message
      );
    } finally {
      setBusy(false);
    }
  };
  if (done) return <Done onBack={onBack} text={`Invoice for ${sgd(b.balance)} sent with PayPal`} />;
  return (
    <section className="vs-card vs-task-card">
      <div className="vs-invoice">
        <header>
          <div>
            <b>{vendor.name.replace(' (demo)', '')}</b>
            <small>Invoice preview · PayPal sandbox</small>
          </div>
          <FileText size={20} />
        </header>
        <div className="vs-inv-to">
          <span>Bill to</span>
          <b>{b.couple}</b>
          <small>{b.email || 'example contact'}</small>
        </div>
        <table>
          <tbody>
            <tr>
              <td>
                {b.itemName}
                {b.qty > 1 ? ` × ${b.qty}` : ''}
              </td>
              <td className="num">{sgd(b.total)}</td>
            </tr>
            <tr className="muted">
              <td>Deposit already paid (20%)</td>
              <td className="num">−{sgd(b.deposit)}</td>
            </tr>
            <tr className="total">
              <td>Balance due by {dateText(due)}</td>
              <td className="num">{sgd(b.balance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="vs-row wrap">
        <button type="button" className="vs-primary" disabled={b.isExample || busy} onClick={send}>
          <Send size={15} /> {busy ? 'Sending…' : `Send ${sgd(b.balance)} invoice with PayPal`}
        </button>
      </div>
      <p className="vs-muted">
        {b.isExample
          ? 'Example booking: sending is switched off.'
          : 'The couple can pay by card or PayPal. You’ll see it on your Payments page.'}
      </p>
      {err && (
        <p className="vs-alert" role="alert">
          <span>{err}</span>
        </p>
      )}
    </section>
  );
}

const PREP = [
  'Confirm your set-up time and loading access with the venue',
  'Share the floor plan with your team',
  'Check the final quantities against the booking',
  'Send the couple a short note to confirm the details',
  'Make sure the balance is settled',
];
function Prep({ b, goBooking }) {
  const key = 'vs-prep-' + b.id;
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  });
  const toggle = i =>
    setDone(d => {
      const n = d.includes(i) ? d.filter(x => x !== i) : [...d, i];
      try {
        localStorage.setItem(key, JSON.stringify(n));
      } catch {}
      if (n.length === PREP.length) celebrate(0);
      return n;
    });
  return (
    <section className="vs-card vs-task-card">
      <div className="vs-progress" aria-label={`${done.length} of ${PREP.length} done`}>
        <i style={{ width: (done.length / PREP.length) * 100 + '%' }} />
      </div>
      <ul className="vs-checks">
        {PREP.map((t, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
              <span>{t}</span>
            </label>
            {i === 1 && (
              <button type="button" className="vs-chip-link" onClick={goBooking}>
                Open the floor plan
              </button>
            )}
          </li>
        ))}
      </ul>
      {done.length === PREP.length && (
        <p className="vs-done">
          <Check size={16} /> All set. It’s going to be a beautiful day.
        </p>
      )}
    </section>
  );
}

export default function TaskPage({ task, booking: b, vendor, onBack, onChanged, goBooking }) {
  const head = {
    reminder: {
      icon: Mail,
      title: `Send ${first(b.couple)} a friendly reminder`,
      mins: 2,
      why: 'Most couples pay within a day of a kind nudge.',
    },
    invoice: {
      icon: FileText,
      title: `Send ${first(b.couple)} the balance invoice`,
      mins: 1,
      why: 'One tap, and PayPal does the rest.',
    },
    prep: {
      icon: ClipboardCheck,
      title: `Get ready for ${first(b.couple)}’s wedding`,
      mins: 5,
      why: 'Five quick checks and you’re set.',
    },
  }[task];
  const Icon = head.icon;
  return (
    <div className="vs-page vs-task">
      <button type="button" className="vs-link-back inline vs-rise" onClick={onBack}>
        <ArrowLeft size={15} /> Dashboard
      </button>
      <header className="vs-booking-head vs-rise">
        <div>
          <span className="vs-eyebrow">
            <Icon size={14} /> To do
          </span>
          <h1>{head.title}</h1>
          <p className="vs-muted">
            {b.itemName} · {dateText(b.weddingDate)} · {sgd(b.balance)} balance
          </p>
          <Encourage mins={head.mins} text={head.why} />
        </div>
        <StatusPill status={b.status} />
      </header>
      <div className="vs-task-body">
        {task === 'reminder' && <Reminder b={b} onChanged={onChanged} onBack={onBack} />}
        {task === 'invoice' && <Invoice b={b} vendor={vendor} onChanged={onChanged} onBack={onBack} />}
        {task === 'prep' && <Prep b={b} goBooking={goBooking} />}
        <button type="button" className="vs-ghost" onClick={goBooking}>
          See the full booking
        </button>
      </div>
    </div>
  );
}

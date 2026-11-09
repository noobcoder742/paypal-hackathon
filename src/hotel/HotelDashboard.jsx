// "For venues (demo)": the hotel's Banquet Sales dashboard (AG Studio) with the sales assistant.
// Enquiries arrive from couples' "Plan with AI" panel; the manager drafts a quote with the hotel agent,
// approves a PayPal invoice for the deposit, and sends friendly reminders.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgStudio, AgStudioProvider, createWidgets } from 'ag-studio-react';
import { AgStudioAiModule } from 'ag-studio';
import { toRows, EXAMPLE_BOOKINGS } from './dashboardData.js';
import { buildStudioData, studioThemeWedding, CUSTOM_WIDGETS, OPENING_REPORT } from './studioSetup.js';
import { buildAi } from './studioAgent.js';
import './hotel.css';
import { sgd } from '../lib/format.js';
const sgdOrDash = n => (n == null ? '—' : sgd(n));

const TOKEN_KEY = 'wedding-hotel-token';
const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};
const api = (path, { method = 'GET', body } = {}) =>
  fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
/** Text from an AI SDK data stream ("0:" parts). */
async function readStreamText(res, onText) {
  const reader = res.body.getReader(),
    dec = new TextDecoder();
  let buf = '',
    text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.startsWith('0:')) {
        try {
          text += JSON.parse(line.slice(2));
          onText(text);
        } catch {}
      }
    }
  }
  return text;
}

function Login({ onDone }) {
  const [pw, setPw] = useState(''),
    [err, setErr] = useState('');
  return (
    <form
      className="hotel-login"
      onSubmit={async e => {
        e.preventDefault();
        setErr('');
        const r = await fetch('/api/hotel/enquiries', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        });
        const j = await r.json().catch(() => ({}));
        if (j.token) {
          try {
            sessionStorage.setItem(TOKEN_KEY, j.token);
          } catch {}
          onDone();
        } else
          setErr(
            'That password is not right. Judges: the demo password is in the Devpost testing instructions.'
          );
      }}
    >
      <span className="hotel-kicker">Venue account</span>
      <h1>Banquet Sales</h1>
      <p>
        The hotel's view of Wedding Studio: enquiries from couples, quotes, and PayPal deposits. Fictional
        demo hotel.
      </p>
      <label htmlFor="hotel-pw">Demo password</label>
      <input
        id="hotel-pw"
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        autoComplete="current-password"
      />
      {err && (
        <p className="hotel-err" role="alert">
          {err}
        </p>
      )}
      <button type="submit">Sign in</button>
      <a className="hotel-alt" href="/">
        Planning a wedding? Go to the couple site
      </a>
    </form>
  );
}

function EnquiryPanel({ enquiry, onChanged }) {
  const [quote, setQuote] = useState(enquiry.quote?.text || ''),
    [busy, setBusy] = useState(null),
    [note, setNote] = useState(''),
    [reminder, setReminder] = useState(null);
  const inv = enquiry.invoice;
  const draftQuote = async () => {
    setBusy('quote');
    setNote('');
    const r = await api('/api/hotel/agent', { method: 'POST', body: { enquiryId: enquiry.id } });
    if (!r.ok) {
      setNote(
        r.status === 429
          ? 'The assistant has reached its hourly limit.'
          : 'The assistant is unavailable right now.'
      );
      setBusy(null);
      return;
    }
    await readStreamText(r, setQuote);
    setBusy(null);
    onChanged();
  };
  const approve = async () => {
    setBusy('approve');
    const r = await api('/api/hotel/approve', { method: 'POST', body: { enquiryId: enquiry.id } }).then(r =>
      r.json()
    );
    setBusy(null);
    setNote(
      r.error
        ? 'PayPal could not create the invoice: ' + (r.message || r.error)
        : 'Invoice sent with PayPal (sandbox).'
    );
    onChanged();
  };
  const draftReminder = async () => {
    setBusy('nudge');
    const r = await api('/api/hotel/nudge', {
      method: 'POST',
      body: { enquiryId: enquiry.id, action: 'draft' },
    }).then(r => r.json());
    setBusy(null);
    if (r.text) setReminder(r.text);
    else setNote('Could not draft a reminder right now.');
  };
  const sendReminder = async () => {
    setBusy('send');
    const r = await api('/api/hotel/nudge', {
      method: 'POST',
      body: { enquiryId: enquiry.id, action: 'send', text: reminder },
    }).then(r => r.json());
    setBusy(null);
    setReminder(null);
    setNote(r.error ? 'Not sent: ' + r.error : 'Reminder sent through PayPal.');
    onChanged();
  };
  const refresh = async () => {
    setBusy('status');
    await api('/api/hotel/invoice-status?enquiryId=' + encodeURIComponent(enquiry.id));
    setBusy(null);
    onChanged();
  };
  return (
    <section className="hotel-enq" aria-label={'Enquiry from ' + enquiry.coupleName}>
      <h3>{enquiry.coupleName}</h3>
      <p className="hotel-meta">
        {enquiry.date} · {enquiry.tables} tables · {enquiry.email}
        {enquiry.budget ? ` · budget ${sgdOrDash(enquiry.budget)}` : ''}
      </p>
      {quote && <p className="hotel-quote">{quote}</p>}
      <div className="hotel-actions">
        {!inv && (
          <button type="button" onClick={draftQuote} disabled={!!busy}>
            {busy === 'quote' ? 'Drafting…' : quote ? 'Redraft quote' : 'Draft quote with AI'}
          </button>
        )}
        {!inv && (
          <button type="button" className="primary" onClick={approve} disabled={!!busy}>
            {busy === 'approve' ? 'Sending…' : 'Approve and send PayPal invoice'}
          </button>
        )}
        {inv && (
          <span className={'hotel-pill ' + (inv.status === 'PAID' ? 'paid' : '')}>
            {inv.status === 'PAID'
              ? 'Deposit paid: date secured'
              : 'Invoice sent: ' + sgdOrDash(inv.amount) + ' due'}
          </span>
        )}
        {inv && inv.status !== 'PAID' && (
          <button type="button" onClick={refresh} disabled={!!busy}>
            Check payment
          </button>
        )}
        {inv && inv.status !== 'PAID' && !reminder && (
          <button type="button" onClick={draftReminder} disabled={!!busy}>
            {busy === 'nudge' ? 'Drafting…' : 'Draft a friendly reminder'}
          </button>
        )}
      </div>
      {reminder !== null && (
        <div className="hotel-reminder">
          <label htmlFor={'rem-' + enquiry.id}>Reminder (edit before sending)</label>
          <textarea
            id={'rem-' + enquiry.id}
            maxLength={400}
            rows={3}
            value={reminder}
            onChange={e => setReminder(e.target.value)}
          />
          <div className="hotel-actions">
            <button
              type="button"
              className="primary"
              onClick={sendReminder}
              disabled={!!busy || !reminder.trim()}
            >
              Send reminder with PayPal
            </button>
            <button type="button" onClick={() => setReminder(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {note && (
        <p className="hotel-note" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

export default function HotelDashboard() {
  const [authed, setAuthed] = useState(() => !!getToken()),
    [enquiries, setEnquiries] = useState(null),
    [error, setError] = useState(''),
    [mode, setMode] = useState('view');
  const load = useCallback(async () => {
    const r = await api('/api/hotel/enquiries');
    if (r.status === 401) {
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {}
      setAuthed(false);
      return;
    }
    const j = await r.json().catch(() => null);
    if (!j) {
      setError('Could not load enquiries.');
      return;
    }
    setEnquiries(j.enquiries);
  }, []);
  useEffect(() => {
    if (authed) load();
  }, [authed, load]);
  const rows = useMemo(() => toRows([...(enquiries || []), ...EXAMPLE_BOOKINGS]), [enquiries]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const data = useMemo(() => buildStudioData(rows), [rows]);
  const widgets = useMemo(() => createWidgets({ additionalTypes: CUSTOM_WIDGETS }), []);
  const ai = useMemo(
    () =>
      buildAi({
        getToken,
        getRows: () => rowsRef.current,
        draftReminder: async id => {
          const r = await api('/api/hotel/nudge', {
            method: 'POST',
            body: { enquiryId: id, action: 'draft' },
          }).then(r => r.json());
          if (!r.text) throw new Error('Only real enquiries with a sent PayPal invoice can get a reminder.');
          return r.text;
        },
      }),
    []
  );
  if (!authed)
    return (
      <main className="hotel-page">
        <Login onDone={() => setAuthed(true)} />
      </main>
    );
  return (
    <main className="hotel-page hotel-dash">
      <header className="hotel-head">
        <div>
          <span className="hotel-kicker">For venues · fictional demo hotel</span>
          <h1>Banquet Sales</h1>
        </div>
        <div className="hotel-head-actions">
          <button
            type="button"
            className={mode === 'edit' ? 'on' : ''}
            onClick={() => setMode(m => (m === 'edit' ? 'view' : 'edit'))}
          >
            {mode === 'edit' ? 'Done' : 'Ask the dashboard (AI)'}
          </button>
          <button type="button" onClick={load}>
            Refresh
          </button>
        </div>
      </header>
      {error && <p className="hotel-err">{error}</p>}
      <div className="hotel-body">
        <aside className="hotel-side">
          <h2>New enquiries</h2>
          {!enquiries ? (
            <p className="hotel-note">Loading…</p>
          ) : enquiries.length ? (
            enquiries.map(e => (
              <EnquiryPanel key={e.id + (e.invoice?.status || '')} enquiry={e} onChanged={load} />
            ))
          ) : (
            <p className="hotel-note">
              No enquiries yet. Send one from Design › Plan with AI › "Send enquiry to the venue".
            </p>
          )}
        </aside>
        <div className="hotel-studio">
          <AgStudioProvider
            licenseKey={import.meta.env.VITE_AG_STUDIO_LICENSE || undefined}
            modules={[AgStudioAiModule]}
          >
            <AgStudio
              style={{ height: '100%', width: '100%' }}
              theme={studioThemeWedding}
              data={data}
              widgets={widgets}
              ai={ai}
              initialState={OPENING_REPORT}
              mode={mode}
              panels={{ edit: { right: ['ai', 'edit'] }, view: { right: ['filters'] } }}
            />
          </AgStudioProvider>
        </div>
      </div>
    </main>
  );
}

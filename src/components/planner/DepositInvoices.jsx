// The couple's view of venue deposit invoices (PayPal sandbox), from enquiries sent with "Plan with AI".
import React, { useEffect, useState } from 'react';
import { sgd } from '../../lib/format.js';
export const ENQUIRIES_KEY = 'wedding-agent-enquiries';
export const readEnquiries = () => {
  try {
    return JSON.parse(localStorage.getItem(ENQUIRIES_KEY)) || [];
  } catch {
    return [];
  }
};
export function rememberEnquiry(e) {
  try {
    const list = readEnquiries().filter(x => x.enquiryId !== e.enquiryId);
    localStorage.setItem(ENQUIRIES_KEY, JSON.stringify([{ ...e, sentAt: Date.now() }, ...list].slice(0, 10)));
  } catch {}
}
export default function DepositInvoices() {
  const [list] = useState(readEnquiries),
    [status, setStatus] = useState({});
  useEffect(() => {
    let live = true;
    for (const e of list)
      fetch('/api/hotel/invoice-status?enquiryId=' + encodeURIComponent(e.enquiryId))
        .then(r => r.json())
        .then(s => {
          if (live) setStatus(m => ({ ...m, [e.enquiryId]: s }));
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [list]);
  if (!list.length) return null;
  return (
    <section className="plan2-deposits" aria-label="Venue deposit invoices">
      <h2>Venue deposits</h2>
      <ul>
        {list.map(e => {
          const s = status[e.enquiryId];
          return (
            <li key={e.enquiryId}>
              <span>
                <b>{e.venueName}</b>
                <small>Enquiry sent {new Date(e.sentAt).toLocaleDateString('en-SG')}</small>
              </span>
              {!s ? (
                <em>Checking…</em>
              ) : s.status === 'NONE' ? (
                <em>Waiting for the venue's quote</em>
              ) : s.status === 'PAID' ? (
                <em className="paid">Deposit paid: date secured</em>
              ) : (
                <span className="dep-due">
                  Deposit invoice: {sgd(s.amount)}
                  {s.payLink ? (
                    <a href={s.payLink} target="_blank" rel="noreferrer">
                      Pay with PayPal
                    </a>
                  ) : (
                    <small> (check your sandbox email)</small>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

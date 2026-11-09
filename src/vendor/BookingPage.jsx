// One customer, full page: the wedding, the venue, what's needed from this vendor, payment,
// and the suggested floor plan with this vendor's items highlighted.
import React from 'react';
import { ArrowLeft, CalendarDays, MapPin, Users, Mail, Package } from 'lucide-react';
import { findItem } from '../data/catalog.js';
import { findVenue } from '../data/venues.js';
import { lineupText } from '../studio/decor/ensembles.js';
import BookingPanel from './BookingPanel.jsx';
import FloorPlan from './FloorPlan.jsx';
import { StatusPill, dateText } from './ui.jsx';
import { sgd } from './status.js';

const daysTo = d =>
  d ? Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5) : null;
function needFor(item, qty, tables) {
  if (!item) return '';
  if (item.inventoryType === 'flowers') return `${qty} centrepieces, one on each guest table`;
  if (item.inventoryType === 'ensemble')
    return item.lineup ? lineupText(item.genre, item.lineup) : 'Default line-up for the session';
  if (item.unit === 'session') return 'One session on the day';
  if (item.unit === 'setup') return 'Set up before guests arrive';
  return `${qty} × ${item.unit || 'item'}`;
}
export default function BookingPage({ booking: b, vendor, onBack, backLabel, onChanged }) {
  const venue = findVenue(b.venueId),
    space = venue?.spaces?.[0];
  const mineLines = (b.planLines?.length ? b.planLines : [{ id: b.itemId, qty: b.qty }]).filter(
    l => findItem(l.id)?.vendor === vendor.name
  );
  const d = daysTo(b.weddingDate);
  return (
    <div className="vs-page vs-booking">
      <button type="button" className="vs-link-back inline vs-rise" onClick={onBack}>
        <ArrowLeft size={15} /> {backLabel}
      </button>
      <header className="vs-booking-head vs-rise">
        <div>
          <span className="vs-eyebrow">
            {b.isExample ? 'Example booking' : 'Booking'} · {b.id}
          </span>
          <h1>{b.couple}</h1>
          <p className="vs-muted">
            {b.itemName}
            {b.qty > 1 ? ` × ${b.qty}` : ''}
          </p>
        </div>
        <StatusPill status={b.status} />
      </header>
      <section className="vs-facts vs-rise" style={{ '--i': 1 }}>
        <div>
          <CalendarDays size={16} />
          <span>Wedding date</span>
          <b>{dateText(b.weddingDate)}</b>
          <small>
            {d == null
              ? 'The couple adds it when they enquire with the venue'
              : d >= 0
                ? `in ${d} days`
                : `${-d} days ago`}
          </small>
        </div>
        <div>
          <MapPin size={16} />
          <span>Venue</span>
          <b>{venue ? venue.name : 'Venue to confirm'}</b>
          <small>{venue ? [space?.name, venue.area].filter(Boolean).join(' · ') : 'Not chosen yet'}</small>
        </div>
        <div>
          <Users size={16} />
          <span>Guests</span>
          <b>{b.tables ? `${b.tables} tables` : 'To confirm'}</b>
          <small>{b.tables ? `about ${b.tables * 10} guests` : ''}</small>
        </div>
        <div>
          <Mail size={16} />
          <span>Couple</span>
          <b>{b.email || 'Through Wedding Studio'}</b>
          <small>{b.email ? 'from their PayPal payment' : 'example contact'}</small>
        </div>
      </section>
      <div className="vs-booking-grid">
        <section className="vs-card vs-rise" style={{ '--i': 2 }}>
          <div className="vs-card-head">
            <h2>
              <Package size={16} /> What’s needed from you
            </h2>
            <span className="vs-muted">{sgd(b.total)} total</span>
          </div>
          <ul className="vs-needs">
            {mineLines.map((l, i) => {
              const item = findItem(l.id);
              return (
                <li key={i}>
                  <b>{item?.name || l.id}</b>
                  <span>{needFor(item, l.qty, b.tables)}</span>
                </li>
              );
            })}
          </ul>
          <h3 className="vs-sub">Suggested floor plan</h3>
          <FloorPlan booking={b} vendorName={vendor.name} />
        </section>
        <BookingPanel inline booking={b} onChanged={onChanged} />
      </div>
    </div>
  );
}

// Guests & RSVP, grouped by side of the family: Hers (pink), His (blue) and
// Both sides (green, mutual friends), matching the table colours in the
// seating studio. Diets are a multi-select per guest (same ids as the
// studio's seat badges), and "Assign →" opens the seating studio with the
// guest ready to place.
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Download, Trash2, ArrowRight, ChevronDown, Check, Armchair, Users } from 'lucide-react';
import { CountUp } from '../ui/motion.jsx';

export const DIET_OPTIONS = [
  { id: 'none', label: 'No restrictions' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'gluten', label: 'Gluten-free' },
  { id: 'fish', label: 'Fish allergy' },
  { id: 'dairy', label: 'Dairy allergy' },
  { id: 'nuts', label: 'Nut allergy' },
  { id: 'other', label: 'Other (see notes)' },
];
export const SIDES = [
  { id: 'hers', label: 'Hers', hint: 'Her family and friends' },
  { id: 'his', label: 'His', hint: 'His family and friends' },
  { id: 'both', label: 'Both sides', hint: 'Mutual friends, colleagues and shared family' },
];
export const dietsOf = g => (Array.isArray(g.diets) ? g.diets : g.diet ? ['other'] : []);
export const dietLabel = g => {
  const d = dietsOf(g);
  return d.length ? d.map(id => DIET_OPTIONS.find(o => o.id === id)?.label || id).join(', ') : '';
};

function DietSelect({ value, onChange, label }) {
  const [open, setOpen] = useState(false),
    ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const toggle = id => {
    if (id === 'none') {
      onChange(value.includes('none') ? [] : ['none']);
      return;
    }
    const next = value.filter(x => x !== 'none');
    onChange(next.includes(id) ? next.filter(x => x !== id) : [...next, id]);
  };
  const text = value.length
    ? value.map(id => DIET_OPTIONS.find(o => o.id === id)?.label || id).join(', ')
    : 'Select';
  return (
    <div className="diet-select" ref={ref}>
      <button
        type="button"
        className={'diet-trigger' + (value.length ? ' set' : '')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(o => !o)}
      >
        <span>{text}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="diet-pop" role="listbox" aria-multiselectable="true">
          {DIET_OPTIONS.map(o => {
            const on = value.includes(o.id);
            return (
              <button
                type="button"
                role="option"
                aria-selected={on}
                key={o.id}
                className={on ? 'on' : ''}
                onClick={() => toggle(o.id)}
              >
                <span className="diet-box">{on && <Check size={12} />}</span>
                {o.label}
              </button>
            );
          })}
          <p>Choose all that apply. Confirm allergies with your caterer.</p>
        </div>
      )}
    </div>
  );
}

export default function GuestsSection({
  guests,
  patch,
  addGuest,
  updateGuest,
  exportGuests,
  onAssign,
  openSeating,
}) {
  const [filter, setFilter] = useState('all');
  const unsorted = guests.filter(g => !['hers', 'his', 'both'].includes(g.side));
  const sections = [
    ...SIDES,
    ...(unsorted.length ? [{ id: '', label: 'Not sorted yet', hint: 'Choose a side for these guests' }] : []),
  ].filter(s => filter === 'all' || s.id === filter);
  const sideOf = g => (['hers', 'his', 'both'].includes(g.side) ? g.side : '');
  return (
    <>
      <div className="plan2-head">
        <div>
          <h2>Guests & RSVP</h2>
          <p>Sorted by side of the family, with responses, diets and seats. Stored on this device for now.</p>
        </div>
        <div className="plan2-actions">
          <button className="btn-line" onClick={exportGuests}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn-line" onClick={openSeating}>
            <Armchair size={15} /> Seating plan
          </button>
        </div>
      </div>
      <div className="plan2-pills">
        {['Attending', 'Pending', 'Declined'].map(status => (
          <div key={status} className={'plan2-pill ' + status.toLowerCase()}>
            <strong>
              <CountUp value={guests.filter(g => g.rsvp === status).length} />
            </strong>
            <small>{status}</small>
          </div>
        ))}
      </div>
      <div className="side-filter" role="tablist" aria-label="Show guests">
        {[
          ['all', 'All', guests.length],
          ...SIDES.map(s => [s.id, s.label, guests.filter(g => g.side === s.id).length]),
        ].map(([id, l, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            className={'side-chip ' + id + (filter === id ? ' on' : '')}
            onClick={() => setFilter(id)}
          >
            <i />
            {l}
            <b>{n}</b>
          </button>
        ))}
      </div>
      {sections.map(sec => {
        const list = guests.filter(g => sideOf(g) === sec.id),
          att = list.filter(g => g.rsvp === 'Attending').length;
        return (
          <section key={sec.id || 'unsorted'} className={'guest-side ' + (sec.id || 'unsorted')}>
            <div className="guest-side-head">
              <span className="guest-side-dot" />
              <div>
                <h3>{sec.label}</h3>
                <small>{sec.hint}</small>
              </div>
              <span className="guest-side-count">
                {list.length} guest{list.length === 1 ? '' : 's'} · {att} attending
              </span>
              {sec.id && (
                <button className="plan2-add" onClick={() => addGuest(sec.id)}>
                  <Plus size={14} /> Add to {sec.label}
                </button>
              )}
            </div>
            {list.length ? (
              <div className="guest-table-scroll plan2-table">
                <table className="guest-table">
                  <thead>
                    <tr>
                      {['Guest name', 'Group', 'Email', 'RSVP', 'Dietary', 'Seat', 'Side', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(g => (
                      <tr key={g.id}>
                        <td>
                          <input
                            aria-label="Guest name"
                            value={g.name}
                            onChange={e => updateGuest(g.id, { name: e.target.value })}
                            placeholder="Full name"
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Guest group"
                            value={g.group}
                            onChange={e => updateGuest(g.id, { group: e.target.value })}
                            placeholder="Family / friends"
                          />
                        </td>
                        <td>
                          <input
                            type="email"
                            aria-label="Email"
                            value={g.email}
                            onChange={e => updateGuest(g.id, { email: e.target.value })}
                            placeholder="Email"
                          />
                        </td>
                        <td>
                          <select
                            className={'rsvp ' + g.rsvp.toLowerCase()}
                            value={g.rsvp}
                            onChange={e => updateGuest(g.id, { rsvp: e.target.value })}
                          >
                            {['Pending', 'Attending', 'Declined'].map(x => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <DietSelect
                            label={'Dietary needs for ' + (g.name || 'guest')}
                            value={dietsOf(g)}
                            onChange={diets =>
                              updateGuest(g.id, {
                                diets,
                                diet: diets.map(id => DIET_OPTIONS.find(o => o.id === id)?.label).join(', '),
                              })
                            }
                          />
                        </td>
                        <td>
                          {g.seatId ? (
                            <button
                              type="button"
                              className="seat-chip"
                              onClick={() => onAssign(g.id)}
                              title="Change seat"
                            >
                              T{g.tableId} · Seat {g.seatId}
                            </button>
                          ) : (
                            <button type="button" className="assign-btn" onClick={() => onAssign(g.id)}>
                              Assign <ArrowRight size={13} />
                            </button>
                          )}
                        </td>
                        <td>
                          <select
                            className="side-select"
                            aria-label="Side"
                            value={sideOf(g)}
                            onChange={e => updateGuest(g.id, { side: e.target.value })}
                          >
                            <option value="">Choose</option>
                            {SIDES.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            aria-label="Remove guest"
                            onClick={() => patch({ guests: guests.filter(x => x.id !== g.id) })}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="guest-side-empty">
                {sec.id ? (
                  <>
                    No guests on this side yet.{' '}
                    <button className="text-link" onClick={() => addGuest(sec.id)}>
                      Add the first one
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </section>
        );
      })}
      {!guests.length && (
        <div className="plan2-empty">
          <Users size={22} />
          <strong>Start your guest list</strong>
          <span>Add guests to Hers, His or Both sides, then assign their seats in the ballroom.</span>
        </div>
      )}
      <p className="acct-muted">
        Invitation sending and online RSVP links need a connected backend and are not active yet.
      </p>
    </>
  );
}

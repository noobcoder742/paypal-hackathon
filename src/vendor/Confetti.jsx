// A short confetti burst when money comes in. Fire it with celebrate(amount).
// Transform/opacity only; skipped entirely under reduced motion.
import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../components/ui/motion.jsx';

/** celebrate(amount, label) shows "+S$amount"; give a title instead for words, e.g. "Good progress!". */
export const celebrate = (amount, label = 'came in', title = '') =>
  window.dispatchEvent(new CustomEvent('vs-confetti', { detail: { amount, label, title } }));
const COLOURS = ['#f2a7bd', '#f6d28b', '#9fd3b5', '#a9c7f2', '#c9b3f0', '#f4b6a0'];
export default function Confetti() {
  const [burst, setBurst] = useState(null);
  useEffect(() => {
    let t;
    const on = e => {
      const pieces = prefersReducedMotion()
        ? []
        : Array.from({ length: 90 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            d: Math.random() * 0.5,
            s: 6 + Math.random() * 7,
            r: Math.random() * 360,
            c: COLOURS[i % COLOURS.length],
            dx: (Math.random() - 0.5) * 160,
            round: Math.random() < 0.35,
          }));
      setBurst({ pieces, ...e.detail, key: Date.now() });
      clearTimeout(t);
      t = setTimeout(() => setBurst(null), 3200);
    };
    window.addEventListener('vs-confetti', on);
    return () => {
      window.removeEventListener('vs-confetti', on);
      clearTimeout(t);
    };
  }, []);
  if (!burst) return null;
  return (
    <div className="vs-confetti" key={burst.key} aria-live="polite">
      {burst.pieces.map(p => (
        <i
          key={p.id}
          style={{
            left: p.x + '%',
            width: p.s,
            height: p.round ? p.s : p.s * 0.45,
            background: p.c,
            borderRadius: p.round ? '50%' : '2px',
            '--d': p.d + 's',
            '--r': p.r + 'deg',
            '--dx': p.dx + 'px',
          }}
        />
      ))}
      {(burst.amount > 0 || burst.title) && (
        <div className="vs-cheer">
          <b>{burst.title || `+S$${Math.round(burst.amount).toLocaleString('en-SG')}`}</b>
          {burst.label && <span>{burst.label}</span>}
        </div>
      )}
    </div>
  );
}

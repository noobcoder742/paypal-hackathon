// Small motion helpers shared by the planner and account pages.
// All of them respect "reduce motion" (system setting or Settings page).
import React, { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  document.documentElement.classList.contains('reduce-motion') ||
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Number that counts up to its value when it first appears. */
export function CountUp({ value, format = v => Math.round(v).toLocaleString('en-SG'), duration = 900 }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0),
    from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now(),
      a = from.current;
    let raf;
    const tick = t => {
      const p = Math.min(1, (t - start) / duration),
        k = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * k);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** Circular progress ring that draws itself. */
export function Ring({ value, size = 132, stroke = 6, children, label }) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    [p, setP] = useState(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-value"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, p)))}
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}

/** Fades and lifts its children in when scrolled into view (staggered by index). */
export function Reveal({ as: Tag = 'div', index = 0, className = '', children, ...rest }) {
  const ref = useRef(null),
    [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(el);
    // never leave content hidden if the observer doesn't fire (e.g. printing, odd layouts)
    const t = setTimeout(() => setSeen(true), 1600);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return (
    <Tag
      ref={ref}
      className={'reveal ' + (seen ? 'in ' : '') + className}
      style={{ '--ri': index }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

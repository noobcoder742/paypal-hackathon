// Coloured number tiles for the vendor dashboard (AG Studio custom widgets): they read the
// aggregated value through the widget API, so the month and status filters still apply.
import React from 'react';
import { useWidgetRows } from '../hotel/widgets/useWidgetRows.js';
import { CountUp } from '../components/ui/motion.jsx';

const NOTE = {
  weddings: 'weddings to make beautiful',
  in: 'received through PayPal',
  due: 'still to come in',
  invoice: 'ready to invoice',
  overdue: 'a reminder will help',
};
function Tile({ params, tone, money }) {
  const rows = useWidgetRows(params, ['value']);
  const v = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  return (
    <div className={'w-tone t-' + tone}>
      {tone === 'weddings' && (
        <span className="w-spark" aria-hidden="true">
          ✦
        </span>
      )}
      <b>
        <CountUp value={v} format={n => (money ? 'S$' : '') + Math.round(n).toLocaleString('en-SG')} />
      </b>
      <small>{NOTE[tone]}</small>
    </div>
  );
}
export const KpiWeddings = p => <Tile params={p} tone="weddings" />;
export const KpiIn = p => <Tile params={p} tone="in" money />;
export const KpiDue = p => <Tile params={p} tone="due" money />;
export const KpiInvoice = p => <Tile params={p} tone="invoice" money />;
export const KpiOverdue = p => <Tile params={p} tone="overdue" money />;

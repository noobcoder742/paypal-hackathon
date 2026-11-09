import { round2 } from '../lib/format.js';
// Rows for the hotel's Banquet Sales dashboard (pure; tested in tests/dashboardData.test.mjs).
// One row per enquiry: where it is in the pipeline and what deposit is invoiced, paid or due.
export function toRows(enquiries) {
  return enquiries.map(e => {
    const inv = e.invoice || null,
      paid = inv?.status === 'PAID' || e.status === 'paid';
    const status = paid ? 'paid' : inv ? 'invoiced' : e.quote ? 'quoted' : 'new';
    const invoiced = inv ? round2(inv.amount) : 0;
    return {
      id: e.id,
      couple: e.coupleName || 'Couple',
      venueId: e.venueId,
      tables: e.tables,
      guests: (e.tables || 0) * 10,
      weddingDate: e.date,
      weddingMonth: (e.date || '').slice(0, 7),
      enquiryDate: new Date(e.createdAt || Date.now()).toISOString().slice(0, 10),
      status,
      budget: e.budget ?? null,
      banquetTotal: e.quote?.total ?? inv?.total ?? null,
      depositInvoiced: invoiced,
      depositPaid: paid ? invoiced : 0,
      depositDue: paid ? 0 : invoiced,
      reminders: inv?.reminders || 0,
      isExample: !!e.isExample,
    };
  });
}
/** Who still owes a deposit, largest first. */
export const stillToPay = rows =>
  rows.filter(r => r.depositDue > 0).sort((a, b) => b.depositDue - a.depositDue);

// Example bookings so the dashboard has a season to show in the demo. Labelled as examples everywhere.
const ex = (id, couple, tables, date, created, stage) => {
  const total = round2(tables * 2288 * 1.1 * 1.09),
    dep = round2(total * 0.3);
  return {
    id: 'example-' + id,
    coupleName: couple + ' (example)',
    venueId: 'orchard-grand',
    tables,
    date,
    createdAt: Date.parse(created),
    isExample: true,
    status: stage,
    quote: stage === 'new' ? null : { total },
    invoice:
      stage === 'invoiced' || stage === 'paid'
        ? { amount: dep, total, status: stage === 'paid' ? 'PAID' : 'SENT' }
        : null,
  };
};
export const EXAMPLE_BOOKINGS = [
  ex('1', 'Grace & Marcus', 32, '2027-02-13', '2026-08-02', 'paid'),
  ex('2', 'Hui Min & Jason', 28, '2027-03-06', '2026-08-19', 'paid'),
  ex('3', 'Priya & Arjun', 36, '2027-04-17', '2026-09-01', 'paid'),
  ex('4', 'Rachel & Ben', 22, '2027-05-01', '2026-09-14', 'invoiced'),
  ex('5', 'Siti & Amir', 30, '2027-05-22', '2026-09-30', 'paid'),
  ex('6', 'Clara & Ethan', 18, '2027-06-05', '2026-10-08', 'invoiced'),
  ex('7', 'Joanne & Kelvin', 26, '2027-07-10', '2026-10-21', 'quoted'),
  ex('8', 'Nadia & Farhan', 34, '2027-08-21', '2026-10-29', 'new'),
  ex('9', 'Wen Hui & Daryl', 24, '2027-09-18', '2026-11-02', 'invoiced'),
  ex('10', 'Lily & Tom', 20, '2027-10-09', '2026-11-04', 'new'),
];

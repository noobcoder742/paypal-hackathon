// GET /api/hotel/invoice-status?enquiryId= — status from PayPal. Public (the couple's Planner uses it),
// and returns only {status, amount, payLink}.
import { getStore } from '../../server/store.js';
import { invoiceStatus } from '../../server/hotel.js';
import { json } from '../../server/http.js';
export async function GET(request) {
  const id = new URL(request.url).searchParams.get('enquiryId') || '';
  if (!/^enq-[A-Za-z0-9-]{4,60}$/.test(id)) return json({ error: 'bad_request' }, 400);
  return json(await invoiceStatus({ store: getStore(), enquiryId: id }));
}

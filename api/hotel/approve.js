// POST /api/hotel/approve {enquiryId} — the sales manager approves: create and send the PayPal invoice.
import { getStore } from '../../server/store.js';
import { requireHotel, approveEnquiry } from '../../server/hotel.js';
import { sameOrigin, json } from '../../server/http.js';
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const store = getStore();
  if (!(await requireHotel(request, store))) return json({ error: 'unauthorised' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    const r = await approveEnquiry({ store, enquiryId: String(body?.enquiryId || '') });
    return json(r, r.error ? 400 : 200);
  } catch (e) {
    return json({ error: 'paypal_error', message: e.message }, 502);
  }
}

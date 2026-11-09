import { agentErrorMessage } from '../../server/agentError.js';
// POST /api/hotel/agent {enquiryId, message?} — streams the hotel agent's quote draft.
import { getStore } from '../../server/store.js';
import { requireHotel } from '../../server/hotel.js';
import { streamHotelQuote } from '../../server/agent/hotelAgent.js';
import { checkRate } from '../../server/ratelimit.js';
import { sameOrigin, clientIp, json } from '../../server/http.js';
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
  const enquiry = await store.get('enquiry:' + String(body?.enquiryId || ''));
  if (!enquiry) return json({ error: 'unknown_enquiry' }, 404);
  const rate = await checkRate('hotel:' + clientIp(request));
  if (!rate.ok) return json({ error: 'rate_limited', resetSeconds: rate.resetSeconds }, 429);
  try {
    const result = await streamHotelQuote({ store, enquiry, message: body?.message });
    return result.toDataStreamResponse({ getErrorMessage: agentErrorMessage });
  } catch {
    return json({ error: 'no_model' }, 503);
  }
}

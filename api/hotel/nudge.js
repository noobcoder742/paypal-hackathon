// POST /api/hotel/nudge
//   {enquiryId, action:'draft'}       → {text}  the agent drafts a friendly reminder
//   {enquiryId, action:'send', text}  → sends it as a PayPal invoice reminder (after the manager approves)
import { getStore } from '../../server/store.js';
import { requireHotel, sendNudge, draftNudgeCheck } from '../../server/hotel.js';
import { draftReminder } from '../../server/agent/hotelAgent.js';
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
  const enquiryId = String(body?.enquiryId || '');
  if (body?.action === 'draft') {
    const [enquiry, invoice] = await Promise.all([
      store.get('enquiry:' + enquiryId),
      store.get('invoice:' + enquiryId),
    ]);
    if (!enquiry || !invoice) return json({ error: 'no_invoice' }, 404);
    try {
      return json({ text: await draftReminder({ enquiry, invoice }) });
    } catch {
      return json({ error: 'no_model' }, 503);
    }
  }
  if (body?.action === 'send') {
    if (!draftNudgeCheck(body.text).ok) return json({ error: 'Reminders are 1-400 characters.' }, 400);
    try {
      const r = await sendNudge({ store, enquiryId, text: body.text });
      return json(r, r.error ? 400 : 200);
    } catch (e) {
      return json({ error: 'paypal_error', message: e.message }, 502);
    }
  }
  return json({ error: 'bad_request' }, 400);
}

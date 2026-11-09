// POST /api/paypal/order — the cart's payment page.
//   {action:'quote', lines, promo}                    → totals (prices and promo checked on the server)
//   {action:'create', planId, lines, promo, venueId, tables} → PayPal order for today's deposits
//   {action:'capture', orderId}                       → after the couple approves in PayPal
import { captureOrder } from '../../server/capture.js';
import { quoteCart, createCheckout, CheckoutError } from '../../server/checkout.js';
import { paypalFetch } from '../../server/paypalApi.js';
import { getStore } from '../../server/store.js';
import { sameOrigin, clientIp, json } from '../../server/http.js';

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const store = getStore();
  try {
    if (body?.action === 'quote') return json({ totals: quoteCart(body) });
    if (body?.action === 'create') {
      const rate = await store.incr('rate:checkout:' + clientIp(request), { ttlSeconds: 3600 });
      if (rate.n > 30) return json({ error: 'rate_limited', resetSeconds: rate.expiresIn }, 429);
      const { planId, lines, promo, venueId, tables } = body;
      return json(
        await createCheckout({
          store,
          planId,
          lines,
          promo,
          venueId,
          tables,
          origin: request.headers.get('origin'),
        })
      );
    }
    const r = await captureOrder({ orderId: body?.orderId, store, paypalFetch });
    return json(r, r.error ? 404 : r.status === 'COMPLETED' ? 200 : 402);
  } catch (e) {
    if (e instanceof CheckoutError) return json({ error: e.code, message: e.message }, 400);
    console.error('[checkout]', e);
    return json(
      {
        error: 'paypal_unavailable',
        message: 'PayPal couldn’t create the order. Nothing was charged; please try again.',
      },
      502
    );
  }
}

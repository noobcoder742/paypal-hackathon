// GET /api/paypal/config — the public PayPal client ID (never the secret).
// GET /api/paypal/config?health=1 — which services are configured, yes/no only.
// GET /api/paypal/config?health=ai — one tiny test call to each AI model: ok, or the error type and message.
// GET /api/paypal/config?ping=1 — reads one row so the free database never pauses (daily GitHub Action).
import { json, clientIp } from '../../server/http.js';
import { health, aiCheck } from '../../server/health.js';
import { getStore } from '../../server/store.js';

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  if (q.get('health') === 'ai') {
    const rate = await getStore().incr('rate:aicheck:' + clientIp(request), { ttlSeconds: 3600 });
    if (rate.n > 5) return json({ error: 'rate_limited' }, 429);
    return json(await aiCheck());
  }
  if (q.has('health')) return json(health());
  if (q.has('ping')) {
    try {
      await getStore().get('keepalive');
      return json({ ok: true });
    } catch {
      return json({ ok: false }, 503);
    }
  }
  return json({ clientId: process.env.PAYPAL_CLIENT_ID || '', env: 'sandbox' });
}

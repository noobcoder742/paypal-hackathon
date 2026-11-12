// GET /api/paypal/config — the public PayPal client ID (never the secret).
// GET /api/paypal/config?health=1 — which services are configured, yes/no only.
// GET /api/paypal/config?ping=1 — reads one row so the free database never pauses (daily GitHub Action).
import { json } from '../../server/http.js';
import { health } from '../../server/health.js';
import { getStore } from '../../server/store.js';

export async function GET(request) {
  const q = new URL(request.url).searchParams;
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

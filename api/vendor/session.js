// POST /api/vendor/session {email,password} → {token, vendor}. Demo company accounts: the email's
// domain picks the vendor; venue domains are "coming soon".
import { getStore } from '../../server/store.js';
import { vendorLogin } from '../../server/vendor.js';
import { sameOrigin, json, clientIp } from '../../server/http.js';
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const store = getStore(),
    { n } = await store.incr(`vendor-login:${clientIp(request)}:${Math.floor(Date.now() / 600e3)}`, {
      ttlSeconds: 600,
    });
  if (n > 20) return json({ error: 'rate_limited' }, 429);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const r = await vendorLogin({ store, email: body?.email, password: body?.password });
  if (r.error)
    return json(
      { error: r.error },
      r.error === 'wrong_password' ? 401 : r.error === 'not_configured' ? 503 : 400
    );
  return json({
    token: r.token,
    vendor: { id: r.vendor.id, name: r.vendor.name, category: r.vendor.category },
  });
}

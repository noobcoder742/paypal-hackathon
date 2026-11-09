// Vendor session (this tab only) and API calls.
const KEY = 'vendor-session-v1';
export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export function setSession(s) {
  try {
    s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY);
  } catch {}
}
export const getToken = () => getSession()?.token || '';
export async function signIn(email, password) {
  const r = await fetch('/api/vendor/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.token) setSession(j);
  return j;
}
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    setSession(null);
    throw Object.assign(new Error('signed_out'), { code: 401 });
  }
  if (!r.ok)
    throw Object.assign(new Error(j.message || j.error || 'request_failed'), { code: r.status, body: j });
  return j;
}
export const bookingAction = (bookingId, action, extra = {}) =>
  api('/api/vendor/bookings', { method: 'POST', body: { bookingId, action, ...extra } });

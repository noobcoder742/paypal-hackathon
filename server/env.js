// Environment access for the server functions. Secrets only ever come from here.
export function env(name, { optional = false } = {}) {
  const v = process.env[name];
  if (!v && !optional) throw new Error('missing environment variable ' + name);
  return v || '';
}
/** The demo runs on the PayPal sandbox only. */
export function assertSandbox() {
  const e = process.env.PAYPAL_ENV;
  if (e && e !== 'sandbox') throw new Error('PAYPAL_ENV must be "sandbox" for this demo');
}
export const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';

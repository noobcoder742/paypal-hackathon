// PayPal Agent Toolkit (sandbox) for the hotel's agent: invoices only, never orders.
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { env, assertSandbox } from './env.js';
export const HOTEL_ACTIONS = {
  invoices: { create: true, send: true, get: true, list: true, sendReminder: true },
};
let factory = null;
/** Tests replace the toolkit. */
export function setPayPalToolkitFactory(fn) {
  factory = fn;
}
export function paypalToolkit(actions) {
  assertSandbox();
  if (factory) return factory(actions);
  return new PayPalAgentToolkit({
    clientId: env('PAYPAL_CLIENT_ID'),
    clientSecret: env('PAYPAL_CLIENT_SECRET'),
    configuration: { actions, context: { sandbox: true } },
  });
}
export const hotelPayPalTools = () => paypalToolkit(HOTEL_ACTIONS).getTools();
/** Run one toolkit tool directly: server code decides the arguments, not the model. */
export async function runPayPalTool(name, args) {
  const t = hotelPayPalTools()[name];
  if (!t) throw new Error('PayPal tool not enabled: ' + name);
  return t.execute(args, { toolCallId: 'server-' + name, messages: [] });
}

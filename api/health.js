// GET /api/health — which services are configured (yes/no only; never a key or value).
// Lets us check a deployment: shared storage, AI keys, PayPal sandbox, demo password.
import {redisConfig} from '../server/store.js';
import {json} from '../server/http.js';
export async function GET(){
 const has=k=>!!(process.env[k]&&String(process.env[k]).trim());
 return json({
  storage:redisConfig()?'shared (Upstash Redis)':'memory only: each function has its own data, so sign-ins and bookings do not carry over',
  ai:{claude:has('ANTHROPIC_API_KEY'),gemini:has('GOOGLE_GENERATIVE_AI_API_KEY')},
  paypal:{clientId:has('PAYPAL_CLIENT_ID'),secret:has('PAYPAL_CLIENT_SECRET'),browserClientId:has('VITE_PAYPAL_CLIENT_ID'),sandbox:(process.env.PAYPAL_ENV||'sandbox')==='sandbox'},
  demoPassword:has('DEMO_PASSWORD')||has('HOTEL_DEMO_PASSWORD'),
 });
}

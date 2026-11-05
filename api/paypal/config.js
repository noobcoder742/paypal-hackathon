// GET /api/paypal/config — the public client ID for the PayPal buttons (never the secret).
import {json} from '../../server/http.js';
export function GET(){return json({clientId:process.env.PAYPAL_CLIENT_ID||'',env:'sandbox'})}

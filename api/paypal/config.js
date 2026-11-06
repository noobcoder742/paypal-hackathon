// GET /api/paypal/config — the public client ID for the PayPal buttons (never the secret).
// GET /api/paypal/config?health=1 — which services are configured, yes/no only.
import {json} from '../../server/http.js';
import {health} from '../../server/health.js';
export function GET(request){
 if(new URL(request.url).searchParams.has('health'))return json(health());
 return json({clientId:process.env.PAYPAL_CLIENT_ID||'',env:'sandbox'});
}

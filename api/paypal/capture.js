// POST /api/paypal/capture {orderId} — after the couple approves in the PayPal button.
import {captureOrder} from '../../server/capture.js';
import {paypalFetch} from '../../server/paypalApi.js';
import {getStore} from '../../server/store.js';
import {sameOrigin,json} from '../../server/http.js';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'forbidden'},403);
 let body;try{body=await request.json()}catch{return json({error:'bad_request'},400)}
 const r=await captureOrder({orderId:body?.orderId,store:getStore(),paypalFetch});
 return json(r,r.error?404:r.status==='COMPLETED'?200:402);
}

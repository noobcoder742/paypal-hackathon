// Direct PayPal REST calls (sandbox only): OAuth token, deposit orders in SGD, capture.
// The Agent Toolkit is used for invoices (see server/paypal.js); its create_order only allows USD.
import {env,assertSandbox,PAYPAL_BASE} from './env.js';
let token=null,fetcher=null;
/** Tests replace the network call: fn(path, init) → parsed JSON. */
export function setPayPalFetch(fn){fetcher=fn}
async function accessToken(){
 if(token&&token.exp>Date.now()+60e3)return token.value;
 const auth=Buffer.from(env('PAYPAL_CLIENT_ID')+':'+env('PAYPAL_CLIENT_SECRET')).toString('base64');
 const r=await fetch(PAYPAL_BASE+'/v1/oauth2/token',{method:'POST',headers:{authorization:'Basic '+auth,'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 if(!r.ok)throw new Error('PayPal sign-in failed ('+r.status+')');
 const j=await r.json();token={value:j.access_token,exp:Date.now()+j.expires_in*1000};return token.value;
}
export async function paypalFetch(path,init={}){
 assertSandbox();
 if(fetcher)return fetcher(path,init);
 const r=await fetch(PAYPAL_BASE+path,{...init,headers:{'content-type':'application/json',authorization:'Bearer '+await accessToken(),...(init.headers||{})}});
 const body=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(body?.message||('PayPal error '+r.status));e.status=r.status;e.details=body?.details;throw e}
 return body;
}
const money=n=>n.toFixed(2);
/** One order, one line per vendor deposit. Amounts come from server/pricing.js only. */
export async function createDepositOrder({planId,totals}){
 const items=totals.lines.map(l=>({name:`${l.vendor} — ${l.name} (20% deposit)`.slice(0,127),quantity:'1',unit_amount:{currency_code:'SGD',value:money(l.deposit)},description:`${l.qty} × S$${l.unitPrice} · platform commission S$${money(l.commission)}`.slice(0,127)}));
 return paypalFetch('/v2/checkout/orders',{method:'POST',headers:{'PayPal-Request-Id':'order-'+planId+'-'+Math.round(totals.depositTotal*100)},
  body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:planId,description:'Wedding vendor deposits (Wedding Studio demo)',
   amount:{currency_code:'SGD',value:money(totals.depositTotal),breakdown:{item_total:{currency_code:'SGD',value:money(totals.depositTotal)}}},items}]})});
}

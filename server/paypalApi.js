// Direct PayPal REST calls (sandbox only): OAuth token, deposit orders in SGD, capture.
// The Agent Toolkit is used for invoices (see server/paypal.js); its create_order only allows USD.
import {createHash} from 'node:crypto';
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
/**
 * One order, one line per vendor deposit; the couple approves it on PayPal's page and comes
 * back to returnUrl (cancelUrl if they cancel). Returns PayPal's order with its approval link.
 */
export async function createDepositOrder({planId,totals,returnUrl,cancelUrl}){
 const items=totals.lines.map(l=>({name:`${l.vendor} — ${l.name} (20% deposit)`.slice(0,127),quantity:'1',unit_amount:{currency_code:'SGD',value:money(l.deposit)},description:`${l.qty} × S$${l.unitPrice} · platform commission S$${money(l.commission)}`.slice(0,127)}));
 const discount=totals.discount||0,due=totals.dueToday??totals.depositTotal;
 // same cart + same code = same order (safe to retry); any change makes a new one
 const fingerprint=createHash('sha256').update(JSON.stringify([totals.lines.map(l=>[l.id,l.qty,l.unitPrice]),totals.promo?.code||''])).digest('hex').slice(0,16);
 const breakdown={item_total:{currency_code:'SGD',value:money(totals.depositTotal)},...(discount?{discount:{currency_code:'SGD',value:money(discount)}}:{})};
 return paypalFetch('/v2/checkout/orders',{method:'POST',headers:{'PayPal-Request-Id':'order-'+planId+'-'+fingerprint},
  body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:planId,description:'Wedding vendor deposits (Wedding Studio demo)',
   amount:{currency_code:'SGD',value:money(due),breakdown},items}],
   ...(returnUrl?{payment_source:{paypal:{experience_context:{return_url:returnUrl,cancel_url:cancelUrl||returnUrl,user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',brand_name:'Wedding Studio (demo)'}}}}:{})})});
}
/** The link that sends the couple to PayPal to approve an order. */
export const approvalLink=order=>(order?.links||[]).find(l=>l.rel==='payer-action'||l.rel==='approve')?.href||null;

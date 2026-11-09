// PayPal sandbox buttons for the cart. The order is created on the server when the couple
// clicks (from the cart's current items and promo code), and captured after they approve.
import React,{useEffect,useState} from 'react';
import {PayPalScriptProvider,PayPalButtons} from '@paypal/react-paypal-js';

export default function PayPalCheckout({createOrder,onPaid,onError,disabled}){
 const [clientId,setClientId]=useState(import.meta.env.VITE_PAYPAL_CLIENT_ID||null);
 useEffect(()=>{if(clientId)return;fetch('/api/paypal/config').then(r=>r.json()).then(j=>setClientId(j.clientId||'')).catch(()=>setClientId(''))},[clientId]);
 if(clientId===null)return <p className="cart-muted">Loading PayPal…</p>;
 if(!clientId)return <p className="cart-muted">PayPal isn’t set up on this copy of the demo.</p>;
 return <PayPalScriptProvider options={{clientId,currency:'SGD',intent:'capture'}}>
  <PayPalButtons style={{layout:'vertical',shape:'pill',label:'pay',height:46,tagline:false}} disabled={disabled} forceReRender={[disabled]}
   createOrder={async()=>(await createOrder()).orderId}
   onApprove={async({orderID})=>{const r=await fetch('/api/paypal/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'capture',orderId:orderID})}).then(r=>r.json());
    if(r.status==='COMPLETED')onPaid?.(r);else onError?.('PayPal couldn’t complete this. Nothing was charged; please try again.')}}
   onCancel={()=>onError?.('Payment cancelled. Nothing was charged.')}
   onError={()=>onError?.('PayPal couldn’t complete this. Nothing was charged; please try again.')}/>
 </PayPalScriptProvider>;
}

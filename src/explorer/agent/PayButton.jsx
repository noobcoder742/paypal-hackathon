// PayPal sandbox button for the deposit order the agent created. The couple approves in PayPal;
// the server captures only after that, and checks the amount.
import React,{useEffect,useState} from 'react';
import {PayPalScriptProvider,PayPalButtons} from '@paypal/react-paypal-js';
export default function PayButton({orderId,total,onPaid}){
 const [clientId,setClientId]=useState(import.meta.env.VITE_PAYPAL_CLIENT_ID||null),[state,setState]=useState(null);
 useEffect(()=>{if(clientId)return;fetch('/api/paypal/config').then(r=>r.json()).then(j=>setClientId(j.clientId||'')).catch(()=>setClientId(''))},[clientId]);
 if(clientId===null)return <p className="agent-note">Loading PayPal…</p>;
 if(!clientId)return <p className="agent-note">PayPal isn't set up on this copy of the demo.</p>;
 if(state?.status==='COMPLETED')return <p className="agent-paid">Deposits paid with PayPal (sandbox): S${Number(state.depositTotal).toLocaleString('en-SG')}</p>;
 return <div className="agent-pay"><p>Approve S${Number(total).toLocaleString('en-SG')} in deposits with PayPal. Nothing is charged until you approve.</p>
  <PayPalScriptProvider options={{clientId,currency:'SGD',intent:'capture'}}>
   <PayPalButtons style={{layout:'horizontal',label:'pay',height:40,tagline:false}} createOrder={()=>Promise.resolve(orderId)}
    onApprove={async()=>{const r=await fetch('/api/paypal/capture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId})}).then(r=>r.json());setState(r);if(r.status==='COMPLETED')onPaid?.(r)}}
    onCancel={()=>setState({status:'CANCELLED'})} onError={()=>setState({status:'ERROR'})}/>
  </PayPalScriptProvider>
  {state?.status==='CANCELLED'&&<p className="agent-note">Cancelled. Nothing was charged.</p>}
  {(state?.status==='ERROR'||state?.status==='FAILED')&&<p className="agent-note">PayPal couldn't complete this. Nothing was charged; please try again.</p>}
 </div>;
}

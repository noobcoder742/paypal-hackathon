// GET  /api/vendor/bookings → {vendor, bookings} for the signed-in vendor only.
// POST /api/vendor/bookings {bookingId, action}
//   seen | invoice (PayPal balance invoice) | draft-reminder (AI) | send-reminder {text} | refresh (PayPal status)
import {getStore} from '../../server/store.js';
import {requireVendor,listBookings,markSeen,sendBalanceInvoice,sendBalanceReminder,refreshBooking,bookingStatus,reminderCheck} from '../../server/vendor.js';
import {draftVendorReminder} from '../../server/agent/vendorAgent.js';
import {vendorById} from '../../src/data/vendors.js';
import {sameOrigin,json} from '../../server/http.js';
const withStatus=b=>({...b,status:bookingStatus(b)});
export async function GET(request){
 const store=getStore(),vendorId=await requireVendor(request,store);if(!vendorId)return json({error:'unauthorised'},401);
 const v=vendorById(vendorId);
 return json({vendor:{id:v.id,name:v.name,category:v.category},bookings:(await listBookings({store,vendorId})).map(withStatus)});
}
export async function POST(request){
 if(!sameOrigin(request))return json({error:'forbidden'},403);
 const store=getStore(),vendorId=await requireVendor(request,store);if(!vendorId)return json({error:'unauthorised'},401);
 let body;try{body=await request.json()}catch{return json({error:'bad_request'},400)}
 const args={store,vendorId,bookingId:String(body?.bookingId||'')};
 try{
  let r;
  if(body?.action==='seen')r=await markSeen(args);
  else if(body?.action==='invoice')r=await sendBalanceInvoice(args);
  else if(body?.action==='refresh')r=await refreshBooking(args);
  else if(body?.action==='send-reminder'){if(!reminderCheck(body.text))return json({error:'Reminders are 1-400 characters.'},400);r=await sendBalanceReminder({...args,text:body.text})}
  else if(body?.action==='draft-reminder'){
   const own=(await listBookings({store,vendorId})).find(b=>b.id===args.bookingId);if(!own)return json({error:'unknown_booking'},404);
   try{return json({text:await draftVendorReminder({vendor:vendorById(vendorId),booking:own})})}catch{return json({error:'no_model'},503)}
  }else return json({error:'bad_request'},400);
  if(r.error)return json(r,r.error==='unknown_booking'?404:400);
  return json({booking:withStatus(r.booking)});
 }catch(e){return json({error:'paypal_error',message:String(e?.message||e).slice(0,200)},502)}
}

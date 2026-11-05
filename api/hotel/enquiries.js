// /api/hotel/enquiries
//   POST {password}      → {token}  (demo login; password from HOTEL_DEMO_PASSWORD)
//   GET  (Bearer token)  → {enquiries:[{...enquiry, quote, invoice}]}
import {getStore} from '../../server/store.js';
import {login,requireHotel} from '../../server/hotel.js';
import {sameOrigin,json} from '../../server/http.js';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'forbidden'},403);
 const store=getStore();let body;try{body=await request.json()}catch{return json({error:'bad_request'},400)}
 const token=await login({store,password:body?.password});
 return token?json({token}):json({error:'wrong_password'},401);
}
export async function GET(request){
 const store=getStore();if(!(await requireHotel(request,store)))return json({error:'unauthorised'},401);
 const rows=await store.list('enquiry:');
 const out=await Promise.all(rows.map(async({value:e})=>({...e,quote:await store.get('quote:'+e.id),invoice:await store.get('invoice:'+e.id)})));
 out.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 return json({enquiries:out});
}

// POST /api/hotel/studio-llm — one model turn for the AG Studio agents on the hotel dashboard.
// Hotel login required; 60 turns per hour per login (Studio's agents take several turns per question).
import {getStore} from '../../server/store.js';
import {requireHotel} from '../../server/hotel.js';
import {runStudioTurn} from '../../server/studioLlm.js';
import {sameOrigin,json} from '../../server/http.js';
export async function POST(request){
 if(!sameOrigin(request))return json({error:'forbidden'},403);
 const store=getStore();if(!(await requireHotel(request,store)))return json({error:'unauthorised'},401);
 const token=(request.headers.get('authorization')||'').slice(-16),hour=Math.floor(Date.now()/3600e3);
 const {n}=await store.incr(`studio-turns:${token}:${hour}`,{ttlSeconds:3600});
 if(n>60)return json({error:'rate_limited'},429);
 let body;try{body=await request.json()}catch{return json({error:'bad_request'},400)}
 if(!Array.isArray(body?.input)||JSON.stringify(body).length>400_000)return json({error:'bad_request'},400);
 try{return json(await runStudioTurn(body))}catch(e){return json({error:'model_error',message:String(e?.message||e).slice(0,200)},502)}
}

import test from 'node:test';import assert from 'node:assert/strict';
import {supabaseStore} from '../server/supabaseStore.js';

// A tiny fake of Supabase's REST API (PostgREST) over a Map, enough to check what the store sends.
function fakeSupabase(){
 const rows=new Map(),seen=[];
 const unlike=p=>p.replace(/\*$/,'').replace(/\\([\\%_])/g,'$1');
 const fetch=async(url,init={})=>{
  const u=new URL(url),q=u.searchParams,path=u.pathname.replace('/rest/v1','');seen.push({path,method:init.method||'GET',headers:init.headers});
  const live=r=>new Date(r.expires_at)>new Date(q.get('expires_at')?.slice(3)||0);
  const ok=body=>({ok:true,status:body===null?204:200,json:async()=>body,text:async()=>''});
  if(path==='/kv'&&(init.method||'GET')==='GET'){
   if(q.get('key').startsWith('eq.'))return ok([...rows.values()].filter(r=>r.key===q.get('key').slice(3)&&live(r)).map(r=>({value:r.value})));
   const pre=unlike(q.get('key').slice(5));return ok([...rows.values()].filter(r=>r.key.startsWith(pre)&&live(r)).map(r=>({key:r.key,value:r.value})));
  }
  if(path==='/kv'&&init.method==='POST'){const b=JSON.parse(init.body);rows.set(b.key,b);return ok(null)}
  if(path==='/rpc/kv_incr'){const {p_key,p_by,p_ttl}=JSON.parse(init.body),r=rows.get(p_key),alive=r&&new Date(r.expires_at)>new Date();
   const next=alive?{...r,value:r.value+p_by}:{key:p_key,value:p_by,expires_at:new Date(Date.now()+p_ttl*1000).toISOString()};rows.set(p_key,next);
   return ok([{n:next.value,expires_in:Math.ceil((new Date(next.expires_at)-Date.now())/1000)}])}
  return {ok:false,status:404,text:async()=>'no route',json:async()=>null};
 };
 return {fetch,rows,seen};
}
const make=fake=>supabaseStore({url:'https://abc.supabase.co/',key:'service-key',fetch:fake.fetch,ttlDefault:3600});

test('get / set / overwrite / expiry, with the service key on every request',async()=>{
 const fake=fakeSupabase(),s=make(fake);
 assert.equal(await s.get('nope'),null);
 await s.set('plan:1',{tables:30});assert.deepEqual(await s.get('plan:1'),{tables:30});
 await s.set('plan:1',{tables:32});assert.deepEqual(await s.get('plan:1'),{tables:32},'set replaces');
 await s.set('old',{x:1},{ttlSeconds:-5});assert.equal(await s.get('old'),null,'expired rows are invisible');
 assert.ok(fake.seen.every(r=>r.headers.apikey==='service-key'&&r.headers.authorization==='Bearer service-key'));
});
test('list by prefix returns only that prefix (an underscore in a key is not a wildcard)',async()=>{
 const fake=fakeSupabase(),s=make(fake);
 await s.set('vbooking:petal-stem:A',{id:'A'});await s.set('vbooking:petal-stem:B',{id:'B'});await s.set('vbooking:blue-note:C',{id:'C'});await s.set('a_b:1',1);await s.set('axb:1',2);
 assert.deepEqual((await s.list('vbooking:petal-stem:')).map(x=>x.value.id).sort(),['A','B']);
 assert.deepEqual((await s.list('a_b:')).map(x=>x.key),['a_b:1']);
});
test('incr counts within a window and reports the time left',async()=>{
 const fake=fakeSupabase(),s=make(fake);
 assert.equal((await s.incr('rate:ip:1',{ttlSeconds:3600})).n,1);
 const r=await s.incr('rate:ip:1',{ttlSeconds:3600,by:4});assert.equal(r.n,5);assert.ok(r.expiresIn>3500&&r.expiresIn<=3600);
});
test('a Supabase error surfaces instead of failing silently',async()=>{
 const s=supabaseStore({url:'https://abc.supabase.co',key:'k',fetch:async()=>({ok:false,status:401,text:async()=>'Invalid API key',json:async()=>null}),ttlDefault:60});
 await assert.rejects(s.get('x'),/Supabase 401: Invalid API key/);
});

// Store on Supabase (Postgres) through its REST API: the public.kv table and the kv_incr
// function from docs/supabase.sql. Server only, with the project's secret key (sb_secret_…)
// or a legacy service_role key.
const enc=encodeURIComponent;
// PostgREST "like" uses * as the wildcard; escape the SQL wildcards that could appear in a key.
const likePrefix=p=>p.replace(/[\\%_]/g,m=>'\\'+m)+'*';

export function supabaseStore({url,key,fetch:f=globalThis.fetch,ttlDefault}){
 const base=url.replace(/\/+$/,'')+'/rest/v1';
 // New secret keys (sb_secret_…) go in the apikey header only; legacy JWT keys also as a Bearer token.
 const headers={apikey:key,'content-type':'application/json',...(key.startsWith('sb_')?{}:{authorization:'Bearer '+key})};
 const call=async(path,init={})=>{
  const r=await f(base+path,{...init,headers:{...headers,...init.headers}});
  if(!r.ok)throw new Error(`Supabase ${r.status}: ${(await r.text().catch(()=>'')).slice(0,200)}`);
  return r.status===204?null:r.json().catch(()=>null);
 };
 const now=()=>new Date().toISOString();
 return {
  async get(k){const rows=await call(`/kv?select=value&key=eq.${enc(k)}&expires_at=gt.${enc(now())}`);return rows?.[0]?.value??null},
  async set(k,v,{ttlSeconds=ttlDefault}={}){
   await call('/kv?on_conflict=key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({key:k,value:v,expires_at:new Date(Date.now()+ttlSeconds*1000).toISOString()})});
  },
  async list(prefix){
   const rows=await call(`/kv?select=key,value&key=like.${enc(likePrefix(prefix))}&expires_at=gt.${enc(now())}&limit=1000`);
   return (rows||[]).filter(r=>r.key.startsWith(prefix)).map(r=>({key:r.key,value:r.value}));
  },
  async incr(k,{ttlSeconds,by=1}){
   const rows=await call('/rpc/kv_incr',{method:'POST',body:JSON.stringify({p_key:k,p_by:by,p_ttl:ttlSeconds})});
   const row=Array.isArray(rows)?rows[0]:rows;
   return {n:Number(row?.n),expiresIn:Number(row?.expires_in)};
  },
 };
}

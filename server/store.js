// Small key-value store: Upstash Redis on Vercel, an in-memory Map for tests and local work.
// Records expire after 30 days (demo data only).
export const TTL_SECONDS=30*24*3600;
let memory=new Map();
export function resetMemoryStore(){memory=new Map()}
let redis=null;
/** Upstash's own variable names, or the KV_REST_API_* names Vercel's Upstash integration adds. */
export function redisConfig(){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 return url&&token?{url,token}:null;
}
async function getRedis(){if(redis)return redis;const {Redis}=await import('@upstash/redis');redis=new Redis(redisConfig());return redis}
const useRedis=()=>!!redisConfig();
export function getStore(){
 if(!useRedis())return {
  async get(k){const e=memory.get(k);if(!e)return null;if(e.exp<Date.now()){memory.delete(k);return null}return structuredClone(e.v)},
  async set(k,v,{ttlSeconds=TTL_SECONDS}={}){memory.set(k,{v:structuredClone(v),exp:Date.now()+ttlSeconds*1000})},
  async list(prefix){const out=[];for(const [k,e] of memory)if(k.startsWith(prefix)&&e.exp>=Date.now())out.push({key:k,value:structuredClone(e.v)});return out},
  async incr(k,{ttlSeconds,by=1}){const e=memory.get(k);const n=(e&&e.exp>=Date.now()?e.v:0)+by;memory.set(k,{v:n,exp:e&&e.exp>=Date.now()?e.exp:Date.now()+ttlSeconds*1000});return {n,expiresIn:Math.ceil((memory.get(k).exp-Date.now())/1000)}}
 };
 return {
  async get(k){return (await getRedis()).get(k)},
  async set(k,v,{ttlSeconds=TTL_SECONDS}={}){await (await getRedis()).set(k,v,{ex:ttlSeconds})},
  async list(prefix){const r=await getRedis();const out=[];let cursor=0;do{const [c,keys]=await r.scan(cursor,{match:prefix+'*',count:100});cursor=Number(c);for(const k of keys)out.push({key:k,value:await r.get(k)})}while(cursor!==0);return out},
  async incr(k,{ttlSeconds,by=1}){const r=await getRedis();const n=await r.incrby(k,by);if(n===by)await r.expire(k,ttlSeconds);const ttl=await r.ttl(k);return {n,expiresIn:ttl}}
 };
}

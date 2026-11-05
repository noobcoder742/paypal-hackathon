// Repeated requests are answered from stored runs (founder: reproducible answers, fewer credits).
// Runs that touched PayPal or sent an enquiry are never stored.
import {createHash} from 'node:crypto';
export const UNCACHEABLE=new Set(['create_deposit_order','send_enquiry']);
const text=m=>typeof m.content==='string'?m.content:(m.content||[]).map(p=>p.text||'').join(' ');
export function normalise(s){
 return s.toLowerCase().replace(/(s?\$)\s*([\d,]+(?:\.\d+)?)\s*(k)?/g,(_,cur,num,k)=>{const v=parseFloat(num.replace(/,/g,''))*(k?1000:1);return 's$'+Math.round(v/1000)*1000})
  .replace(/\s+/g,' ').replace(/\s*([,.!?])\s*/g,'$1 ').trim();
}
export const cacheKey=messages=>createHash('sha256').update(messages.filter(m=>m.role==='user'||m.role==='assistant').map(m=>m.role+':'+normalise(text(m))).join('\n')).digest('hex');
export const getCachedRun=(store,key)=>store.get('cache:'+key);
export const saveRun=(store,key,run)=>store.set('cache:'+key,run);
export const replayStream=(body,headers={})=>new Response(body,{headers:{'content-type':'text/plain; charset=utf-8','x-vercel-ai-data-stream':'v1','x-cache':'hit',...headers}});

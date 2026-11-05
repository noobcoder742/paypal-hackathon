// Request helpers shared by the api/ functions.
export function sameOrigin(request){const o=request.headers.get('origin');if(!o)return false;try{const host=request.headers.get('x-forwarded-host')||request.headers.get('host')||new URL(request.url).host;return new URL(o).host===host}catch{return false}}
export const clientIp=request=>(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||'unknown';
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});

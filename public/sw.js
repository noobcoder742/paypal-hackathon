// Offline cache for the pre-built city (public/data/sg3d/<version>/...).
// Versioned files never change, so they are served from the cache first;
// a return visit downloads nothing until the map is rebuilt with a new version.
// latest.json and everything else always go to the network.
const CACHE='city-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 // drop old caches and stale city versions
 for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);
 await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin)return;
 const m=url.pathname.match(/^\/data\/sg3d\/([0-9a-f]{6,})\//);
 if(!m)return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const hit=await cache.match(e.request);if(hit)return hit;
  const res=await fetch(e.request);
  if(res.ok){
   cache.put(e.request,res.clone());
   // keep only the current version's files
   cache.keys().then(keys=>keys.forEach(k=>{const v=new URL(k.url).pathname.match(/^\/data\/sg3d\/([0-9a-f]{6,})\//);if(v&&v[1]!==m[1])cache.delete(k)}));
  }
  return res;
 })());
});

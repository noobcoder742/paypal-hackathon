#!/usr/bin/env node
// Collects freely licensed ballroom photos (CC0, public domain, CC BY, CC BY-SA)
// from Openverse as candidates for the landing-page hero, with licence and
// author for each. Run by .github/workflows/fetch-hero-candidates.yml, which
// commits the result to the separate `hero-candidates` branch (the build
// environment cannot reach photo sites).
import {mkdir,writeFile} from 'node:fs/promises';

const OUT=process.argv[2]||'hero-candidates';
const UA='WeddingStudioPrototype/1.0 (hero photo candidates; GitHub Actions)';
const QUERIES=['ballroom wedding reception','grand ballroom banquet','hotel ballroom wedding','wedding banquet hall chandeliers','ballroom gala dinner','luxury wedding reception hall','banquet hall','ballroom chandelier tables','wedding reception hall','gala dinner hall'];
const UNSPLASH=['ballroom wedding','wedding reception hall','banquet hall','luxury wedding reception','ballroom chandelier','gala dinner','wedding venue interior'];
const LICENSES='cc0,pdm,by,by-sa';
const MAX=40,MAX_UNSPLASH=40;

async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'user-agent':UA}});if(r.ok)return r;console.log('HTTP',r.status,url)}catch(e){console.log('error',e.message)}await new Promise(r=>setTimeout(r,2000*(i+1)))}return null}

await mkdir(OUT,{recursive:true});
const seen=new Set(),picked=[];
for(const q of QUERIES){
 const r=await get('https://api.openverse.org/v1/images/?'+new URLSearchParams({q,license:LICENSES,page_size:'20'}));
 if(!r)continue;
 for(const it of (await r.json()).results||[]){
  if(picked.length>=MAX)break;
  if(seen.has(it.id)||(it.width&&it.width<1400)||(it.width&&it.height&&it.width<it.height))continue;seen.add(it.id);
  picked.push(it);
 }
}
// Unsplash (Unsplash License: free commercial use). Skips paid Unsplash+ photos.
const uSeen=new Set(),uPicked=[];
for(const q of UNSPLASH){
 const r=await get('https://unsplash.com/napi/search/photos?'+new URLSearchParams({query:q,per_page:'30',orientation:'landscape'}));
 if(!r)continue;
 for(const p of (await r.json()).results||[]){
  if(uPicked.length>=MAX_UNSPLASH)break;
  if(uSeen.has(p.id)||p.premium||p.plus||p.width<2400)continue;uSeen.add(p.id);uPicked.push(p);
 }
}
const rows=[];
for(const [i,it] of picked.entries()){
 const n=String(i+1).padStart(2,'0');
 const img=await get(it.url);if(!img)continue;
 const buf=Buffer.from(await img.arrayBuffer());if(buf.length<60000)continue;
 const ext=(img.headers.get('content-type')||'').includes('png')?'png':'jpg';
 await writeFile(`${OUT}/${n}.${ext}`,buf);
 rows.push(`| ${n}.${ext} | ${(it.title||'').replace(/\|/g,'/')} | ${it.creator||'unknown'} | ${it.license} ${it.license_version||''} | ${it.width}×${it.height} | ${it.foreign_landing_url} |`);
}
for(const [i,p] of uPicked.entries()){
 const n='u'+String(i+1).padStart(2,'0');
 const img=await get(p.urls.raw+'&w=1920&q=72&fm=jpg&fit=max');if(!img)continue;
 await writeFile(`${OUT}/${n}.jpg`,Buffer.from(await img.arrayBuffer()));
 rows.push(`| ${n}.jpg | ${(p.alt_description||p.description||'').replace(/\|/g,'/')} | ${p.user?.name||'unknown'} | Unsplash License | ${p.width}×${p.height} | https://unsplash.com/photos/${p.id} |`);
}
await writeFile(`${OUT}/CANDIDATES.md`,`# Hero photo candidates (Openverse)\n\n| File | Title | Author | Licence | Size | Source |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`);
console.log(`saved ${rows.length} candidates`);

#!/usr/bin/env node
// Collects freely licensed ballroom photos (CC0, public domain, CC BY, CC BY-SA)
// from Openverse as candidates for the landing-page hero, with licence and
// author for each. Run by .github/workflows/fetch-hero-candidates.yml, which
// commits the result to the separate `hero-candidates` branch (the build
// environment cannot reach photo sites).
import {mkdir,writeFile} from 'node:fs/promises';

const OUT=process.argv[2]||'hero-candidates';
const UA='WeddingStudioPrototype/1.0 (hero photo candidates; GitHub Actions)';
const QUERIES=['ballroom wedding reception','grand ballroom banquet','hotel ballroom wedding','wedding banquet hall chandeliers','ballroom gala dinner','luxury wedding reception hall'];
const LICENSES='cc0,pdm,by,by-sa';
const MAX=36;

async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'user-agent':UA}});if(r.ok)return r;console.log('HTTP',r.status,url)}catch(e){console.log('error',e.message)}await new Promise(r=>setTimeout(r,2000*(i+1)))}return null}

await mkdir(OUT,{recursive:true});
const seen=new Set(),picked=[];
for(const q of QUERIES){
 const r=await get('https://api.openverse.org/v1/images/?'+new URLSearchParams({q,license:LICENSES,aspect_ratio:'wide',size:'large',page_size:'20'}));
 if(!r)continue;
 for(const it of (await r.json()).results||[]){
  if(picked.length>=MAX)break;
  if(seen.has(it.id)||(it.width&&it.width<1600))continue;seen.add(it.id);
  picked.push(it);
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
await writeFile(`${OUT}/CANDIDATES.md`,`# Hero photo candidates (Openverse)\n\n| File | Title | Author | Licence | Size | Source |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`);
console.log(`saved ${rows.length} candidates`);

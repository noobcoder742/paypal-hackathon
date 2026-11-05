#!/usr/bin/env node
// Collects freely licensed ballroom photos (CC0, public domain, CC BY, CC BY-SA)
// from Openverse as candidates for the landing-page hero, with licence and
// author for each. Run by .github/workflows/fetch-hero-candidates.yml, which
// commits the result to the separate `hero-candidates` branch (the build
// environment cannot reach photo sites).
import {mkdir,writeFile} from 'node:fs/promises';

const OUT=process.argv[2]||'hero-candidates';
const UA='WeddingStudioPrototype/1.0 (https://github.com/noobcoder742; hero photo candidates via GitHub Actions)';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const QUERIES=['ballroom wedding reception','grand ballroom banquet','hotel ballroom wedding','wedding banquet hall chandeliers','ballroom gala dinner','luxury wedding reception hall','banquet hall','ballroom chandelier tables','wedding reception hall','gala dinner hall','ballroom','wedding reception','banquet','gala dinner','hotel ballroom','wedding dinner tables'];
const LICENSES='cc0,pdm,by,by-sa';
const MAX=60;

async function get(url){for(let i=0;i<4;i++){try{const r=await fetch(url,{headers:{'user-agent':UA}});if(r.ok)return r;console.log('HTTP',r.status,url);if(r.status===404)return null;await wait(r.status===429?15000*(i+1):2000*(i+1))}catch(e){console.log('error',e.message);await wait(2000*(i+1))}}return null}

await mkdir(OUT,{recursive:true});
const seen=new Set(),picked=[];
for(const q of QUERIES)for(const page of ['1','2']){
 const r=await get('https://api.openverse.org/v1/images/?'+new URLSearchParams({q,license:LICENSES,page_size:'20',page}));
 if(!r)continue;
 for(const it of (await r.json()).results||[]){
  if(picked.length>=MAX)break;
  if(seen.has(it.id)||(it.width&&it.width<1400)||(it.width&&it.height&&it.width<it.height))continue;seen.add(it.id);
  picked.push(it);
 }
}
const rows=[];
for(const [i,it] of picked.entries()){
 const n=String(i+1).padStart(2,'0');
 await wait(1500);
 const img=await get(it.url);if(!img)continue;
 const buf=Buffer.from(await img.arrayBuffer());if(buf.length<60000)continue;
 const ext=(img.headers.get('content-type')||'').includes('png')?'png':'jpg';
 await writeFile(`${OUT}/${n}.${ext}`,buf);
 rows.push(`| ${n}.${ext} | ${(it.title||'').replace(/\|/g,'/')} | ${it.creator||'unknown'} | ${it.license} ${it.license_version||''} | ${it.width}×${it.height} | ${it.foreign_landing_url} |`);
}
await writeFile(`${OUT}/CANDIDATES.md`,`# Hero photo candidates (Openverse)\n\n| File | Title | Author | Licence | Size | Source |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`);
console.log(`saved ${rows.length} candidates`);

#!/usr/bin/env node
// Collects candidate photos for the site's image slots (My Wedding, Planner, venue
// cards, signed-out teasers). Unsplash search pages filtered to free photos (Unsplash
// License; paid Unsplash+ images live on another host and are skipped), plus
// Openverse (CC0 / CC BY / CC BY-SA). Run by .github/workflows/fetch-photos.yml,
// which commits the result to the separate `photo-candidates` branch.
import {mkdir,writeFile} from 'node:fs/promises';

const OUT=process.argv[2]||'photo-candidates';
const BROWSER='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const UA='WeddingStudioPrototype/1.0 (https://github.com/noobcoder742; photo candidates via GitHub Actions)';
const SLOTS={
 couple:['bride and groom','wedding couple','bride groom portrait'],
 hotel:['luxury hotel','hotel lobby','hotel exterior night'],
 garden:['garden wedding','outdoor wedding ceremony','garden pavilion'],
 chapel:['chapel wedding','church wedding','wedding aisle'],
 tables:['wedding reception table','wedding table setting','wedding flowers'],
 planning:['wedding planning','wedding invitation','wedding details'],
};
const PER_SLOT=8;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url,ua=UA){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'user-agent':ua,'accept-language':'en'}});if(r.ok)return r;console.log('HTTP',r.status,url);if(r.status===404||r.status===401)return null;await wait(r.status===429?15000*(i+1):2000*(i+1))}catch(e){console.log('error',e.message);await wait(2000*(i+1))}}return null}

const rows=[];
for(const [slot,queries] of Object.entries(SLOTS)){
 await mkdir(`${OUT}/${slot}`,{recursive:true});
 const ids=new Set();
 for(const q of queries){
  const r=await get(`https://unsplash.com/s/photos/${encodeURIComponent(q.replace(/ /g,'-'))}?license=free&orientation=landscape`,BROWSER);
  if(!r){continue}
  const html=await r.text();
  for(const m of html.matchAll(/https:\/\/images\.unsplash\.com\/(photo-[A-Za-z0-9-]+)/g))ids.add(m[1]);
  await wait(1500);
 }
 let n=0;
 for(const id of ids){
  if(n>=PER_SLOT)break;
  const img=await get(`https://images.unsplash.com/${id}?w=1600&q=78&fm=jpg&fit=max`,BROWSER);if(!img)continue;
  const buf=Buffer.from(await img.arrayBuffer());if(buf.length<40000)continue;
  n++;const file=`${slot}/u${String(n).padStart(2,'0')}.jpg`;await writeFile(`${OUT}/${file}`,buf);
  rows.push(`| ${file} | Unsplash | Unsplash License | https://images.unsplash.com/${id} |`);
  await wait(500);
 }
 console.log(slot,'unsplash',n,'of',ids.size);
 // Openverse as a second source
 const ov=await get('https://api.openverse.org/v1/images/?'+new URLSearchParams({q:queries[0],license:'cc0,pdm,by,by-sa',page_size:'12'}));
 let k=0;
 for(const it of ov?(await ov.json()).results||[]:[]){
  if(k>=4)break;if(it.width&&it.height&&(it.width<1200||it.width<it.height))continue;
  await wait(1500);const img=await get(it.url);if(!img)continue;
  const buf=Buffer.from(await img.arrayBuffer());if(buf.length<60000)continue;
  k++;const file=`${slot}/o${String(k).padStart(2,'0')}.jpg`;await writeFile(`${OUT}/${file}`,buf);
  rows.push(`| ${file} | ${(it.creator||'unknown').replace(/\|/g,'/')} | ${it.license} ${it.license_version||''} | ${it.foreign_landing_url} |`);
 }
}
await writeFile(`${OUT}/CANDIDATES.md`,`# Photo candidates\n\n| File | Author | Licence | Source |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`);
console.log('saved',rows.length);

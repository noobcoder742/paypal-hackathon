#!/usr/bin/env node
// "No buffering" check for the venue map (spec section 4).
// Opens the production build in headless Chromium on a simulated mid-range
// phone connection (~9 Mbps, 150 ms latency) with 4x CPU slowdown, and fails if:
//  - the whole island (lite or full base layer) isn't in the scene within 2.5 s of opening the map
//  - full detail isn't shown within 1 s of the camera landing after a fly-to
//  - the base layer was ever evicted
// Frame times, including the time to draw the first frame, are reported but
// not enforced: CI runners have no GPU, so drawing is software-emulated and
// far slower than any phone. What's enforced is that the whole island is
// downloaded, unpacked and in the scene (baseLoaded) within the limit.
// Usage: BASE_URL=http://localhost:4173 node scripts/perf/map-performance.mjs
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');

const BASE=process.env.BASE_URL||'http://localhost:4173';
const LIMITS={baseMs:2500,landingMs:1000,edgeMs:20000,visibleMs:300};
// island edges (map metres): the middle level must cover them after background fill
const EDGES=[['Tuas',-19000,3500],['Changi',18900,-900]];
// Shared CI machines vary a lot from run to run, so the map is opened RUNS
// times in fresh browsers and the median of each timing is judged.
const RUNS=Number(process.env.PERF_RUNS||3);
const [VW,VH]=(process.env.PERF_VIEWPORT||'900x500').split('x').map(Number);
async function runOnce(){
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
// A small window (VW×VH): CI draws in software (no GPU), and drawing cost grows
// with pixels. Loading work and every limit are unchanged by the window size.
// a 2 GB phone: no background map, so this is the cold start (the map starts when Design is touched)
const coldCtx=await browser.newContext({viewport:{width:VW,height:VH}});await coldCtx.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>2}));
const page=await coldCtx.newPage();
page.setDefaultTimeout(120000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(u=>!u.href.startsWith(BASE),r=>r.abort());
const cdp=await page.context().newCDPSession(page);
await page.goto(BASE+'/?perf');
await page.evaluate(()=>{localStorage.clear();localStorage.setItem('wedding-session-v1',JSON.stringify({email:'perf@test.sg',name:'Perf'}))});
// throttle from the very start (strict: the background map download is slow too),
// and open the map the moment the homepage is on screen
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:9e6/8,uploadThroughput:3e6/8});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.goto(BASE+'/?perf',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.nav-pill button:has-text("Design")');

// timings are taken in the page from the click event itself (the test's own clock also waits on a
// main thread that software GL keeps busy, which a real GPU never does)
const t0=Date.now();await page.evaluate(()=>{window.__mapMarks={clicked:performance.now()};document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.nav-pill button'))window.__mapMarks.clicked=performance.now()},{capture:true,once:true})});
await page.click('.nav-pill button:has-text("Design")');
// the island is in the scene at the first of its two steps (lite base, then the full base)
await page.waitForFunction(()=>window.__cityMetrics?.baseLiteMs!=null||window.__cityMetrics?.baseLoadedMs!=null,null,{timeout:60000});
await page.waitForFunction(()=>window.__cityMetrics?.baseLoadedMs!=null,null,{timeout:60000});
const sinceClick=await page.evaluate(()=>{const x=window.__cityMetrics,c=window.__mapMarks.clicked,at=v=>v==null?null:Math.max(0,Math.round(x.started+v-c));return {island:at(x.baseLiteMs??x.baseLoadedMs),full:at(x.baseLoadedMs)}});
const baseMs=sinceClick.island,fullBaseMs=sinceClick.full;
await page.waitForFunction(()=>window.__cityMetrics?.baseReadyMs!=null,null,{timeout:120000});
const firstFrameMs=Date.now()-t0;
await page.waitForTimeout(3000);

// fly to a venue and time detail after landing
const shadersBeforeFly=await page.evaluate(()=>window.__cityMetrics.shadersReadyMs);
await page.fill('.finder-box input','regis');await page.click('.finder-results button:has-text("Orchard Grand")');
await page.waitForFunction(()=>window.__cityMetrics?.lastFly,null,{timeout:30000});
await page.waitForFunction(()=>!window.__mapRig?.fly,null,{timeout:30000});
const landed=Date.now();
const shown=await page.waitForFunction(()=>{const s=window.__cityStream,f=window.__cityMetrics.lastFly;return s&&f&&s.readyAround(f.tx,f.tz,500)},null,{timeout:15000}).then(()=>true).catch(()=>false);
const landingMs=shown?Date.now()-landed:null;

// island edges: move the camera out to each and wait for the middle level
const edges={};
for(const [name,x,z] of EDGES){
 await page.evaluate(([x,z])=>{const r=window.__mapRig;r.fly=null;Object.assign(r.goal,{tx:x,tz:z,r:3000,phi:.95});Object.assign(r.cur,{tx:x,tz:z,r:3000,phi:.95});window.__mapWake?.()},[x,z]);
 const t=Date.now();
 edges[name]=await page.waitForFunction(([x,z])=>window.__cityStream?.midReadyAround(x,z,2000),[x,z],{timeout:LIMITS.edgeMs}).then(()=>Date.now()-t).catch(()=>null);
}
// no redraw when still: with nothing new arriving (offline) and no input, drawing stops
await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
await page.waitForTimeout(3000);
const f0=await page.evaluate(()=>window.__mapGl?.info.render.frame);await page.waitForTimeout(2000);
const idleFrames=f0==null?null:await page.evaluate(f0=>window.__mapGl.info.render.frame-f0,f0);
const landLoaded=await page.evaluate(()=>window.__cityMetrics.landLoaded===true||!window.__cityStream?.meta.land&&'no land in this build');

const m=await page.evaluate(()=>{const x=window.__cityMetrics,k=window.__mapMarks||{},rel=v=>v==null?null:Math.round(v-k.clicked);return {sinceClick:{mapMounted:rel(k.mounted),canvasCreated:rel(k.canvas),streamStarted:rel(x.started),baseInScene:rel(x.started+x.baseLoadedMs),firstFrame:rel(x.started+x.baseReadyMs)},baseFetchedMs:x.baseFetchedMs,baseLoadedMs:x.baseLoadedMs,baseReadyMs:x.baseReadyMs,cellsLoaded:x.cellsLoaded,cellsShown:x.cellsShown,baseEvictions:x.baseEvictions,cellsEvicted:x.cellsEvicted,frames:x.frames,baseLiteMs:x.baseLiteMs,districtsLoaded:x.districtsLoaded}});
await browser.close();
const frames=[...m.frames].sort((a,b)=>a-b),p95=frames[Math.floor(frames.length*.95)]||0;
 return {baseMs,fullBaseMs,firstFrameMs,landingMs,breakdownSinceClick:m.sinceClick,cellsLoaded:m.cellsLoaded,cellsShown:m.cellsShown,baseEvictions:m.baseEvictions,cellsEvicted:m.cellsEvicted,frameP95ms:p95,frames:frames.length,shadersBeforeFly,idleFrames,edges,landLoaded,baseLiteMs:m.baseLiteMs,districtsLoaded:m.districtsLoaded,errors};
}
// Map kept ready in the background (spec B1): with the map prepared, opening
// Design shows a drawn map within 300 ms, and switching pages never makes a second 3D view.
async function warmRun(){
 const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const out={};
 {const page=await browser.newPage({viewport:{width:VW,height:VH}});page.setDefaultTimeout(120000);await page.route(u=>!u.href.startsWith(BASE),r=>r.abort());
  await page.goto(BASE+'/?perf');await page.evaluate(()=>{localStorage.clear();localStorage.setItem('wedding-session-v1',JSON.stringify({email:'perf@test.sg',name:'Perf'}))});
  await page.goto(BASE+'/?perf',{waitUntil:'domcontentloaded'});
  out.warmed=await page.waitForFunction(()=>window.__mapHost?.warm===true&&window.__cityMetrics?.baseLoadedMs!=null,null,{timeout:60000}).then(()=>true).catch(()=>false);
  // a person clicks a few seconds after the page appears: wait until the parked map has stopped drawing
  await page.waitForFunction(()=>{const h=window.__mapHost,now=performance.now();if(h.lastCount!==h.framesDrawn){h.lastCount=h.framesDrawn;h.lastChange=now}return now-(h.lastChange||now)>2500},null,{timeout:60000,polling:250}).catch(()=>{});
  await page.evaluate(()=>document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.nav-pill button'))window.__designClick=performance.now()},{capture:true,once:true}));
  await page.click('.nav-pill button:has-text("Design")');
  out.visibleMs=await page.waitForFunction(()=>{const h=window.__mapHost,c=document.querySelector('.map-slot canvas'),t=window.__designClick;if(t==null||!h?.activatedAt||!c||!c.offsetWidth)return false;return (h.framesSinceActive>0||h.framesDrawnAtActivation>0)&&Math.max(1,performance.now()-t)},null,{timeout:10000,polling:10}).then(h=>h.jsonValue()).then(v=>Math.round(v)).catch(()=>null);
  // the picture really is on screen (not a blank canvas)
  const shot=await page.locator('.map-slot canvas').screenshot();out.pictureBytes=shot.length;
  for(let i=0;i<3;i++){await page.click('.nav-pill button:has-text("Marketplace")');await page.waitForTimeout(300);await page.click('.nav-pill button:has-text("Design")');await page.waitForTimeout(300)}
  out.contexts=await page.evaluate(()=>window.__mapHost?.contexts);await page.close()}
 // a phone with little memory: no background map until Design is hovered or tapped
 {const ctx=await browser.newContext({viewport:{width:VW,height:VH}});await ctx.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>2}));
  const page=await ctx.newPage();await page.route(u=>!u.href.startsWith(BASE),r=>r.abort());
  await page.goto(BASE+'/?perf');await page.evaluate(()=>{localStorage.setItem('wedding-session-v1',JSON.stringify({email:'perf@test.sg',name:'Perf'}))});
  await page.goto(BASE+'/?perf',{waitUntil:'load'});await page.waitForTimeout(2500);
  out.lowMemWarmBeforeHover=await page.evaluate(()=>!!window.__mapHost?.warm);
  await page.hover('.nav-pill button:has-text("Design")');
  out.lowMemWarmAfterHover=await page.waitForFunction(()=>window.__mapHost?.warm===true,null,{timeout:5000}).then(()=>true).catch(()=>false);await ctx.close()}
 await browser.close();return out;
}
const warm=await warmRun();console.log('background map:',JSON.stringify(warm));
const runs=[];for(let i=0;i<RUNS;i++){const r=await runOnce();runs.push(r);console.log(`run ${i+1}/${RUNS}: island ${r.baseMs} ms (full base ${r.fullBaseMs} ms; lite ${r.baseLiteMs} ms after start), edges ${JSON.stringify(r.edges)}, land ${r.landLoaded}, first frame ${r.firstFrameMs} ms, detail after landing ${r.landingMs??'never'} ms, frame p95 ${r.frameP95ms} ms`)}
const median=k=>{const v=runs.map(r=>r[k]==null?Infinity:r[k]).sort((a,b)=>a-b);const x=v[Math.floor(v.length/2)];return x===Infinity?null:x};
const baseMs=median('baseMs'),landingMs=median('landingMs'),firstFrameMs=median('firstFrameMs');
const errors=runs.flatMap(r=>r.errors),evictions=Math.max(...runs.map(r=>r.baseEvictions));
const report={median:{baseMs,firstFrameMs,landingMs,frameP95ms:median('frameP95ms')},warm,limits:LIMITS,viewport:`${VW}x${VH}`,runs};
const fails=[];
if(baseMs>LIMITS.baseMs)fails.push(`whole island loaded after ${baseMs} ms (median; limit ${LIMITS.baseMs})`);
if(landingMs==null||landingMs>LIMITS.landingMs)fails.push(`detail after landing ${landingMs??'never'} ms (median; limit ${LIMITS.landingMs})`);
if(evictions>0)fails.push('base layer was evicted');
for(const [name] of EDGES){const v=runs.map(r=>r.edges[name]);if(v.filter(x=>x==null).length>RUNS/2)fails.push(`middle level never covered ${name} within ${LIMITS.edgeMs} ms`)}
if(!warm.warmed)fails.push('the map was never prepared in the background');
if(warm.visibleMs==null||warm.visibleMs>LIMITS.visibleMs)fails.push(`prepared map took ${warm.visibleMs??'forever'} ms to show (limit ${LIMITS.visibleMs})`);
if(warm.pictureBytes<20000)fails.push(`the prepared map showed a blank canvas (${warm.pictureBytes} bytes)`);
if(warm.contexts!==1)fails.push(`switching pages made ${warm.contexts} 3D views (want 1)`);
if(warm.lowMemWarmBeforeHover||!warm.lowMemWarmAfterHover)fails.push('low-memory device: map should wait for a Design hover');
if(runs.some(r=>r.idleFrames==null||r.idleFrames>2))fails.push('map kept drawing while still: '+runs.map(r=>r.idleFrames).join(', ')+' frames in 2 s');
if(runs.some(r=>r.shadersBeforeFly==null))fails.push('graphics were not prepared before the fly-to');
if(runs.some(r=>r.landLoaded===false))fails.push('land polygons were not loaded');
if(errors.length)fails.push('page errors: '+errors.slice(0,3).join(' | '));
await writeFile('map-performance-report.json',JSON.stringify(report,null,1));
console.log(JSON.stringify(report.median),JSON.stringify(runs.map(r=>r.breakdownSinceClick)));
if(fails.length){console.error('FAILED:\n - '+fails.join('\n - '));process.exit(1)}
console.log('PASSED (frame times reported only: CI has no GPU)');

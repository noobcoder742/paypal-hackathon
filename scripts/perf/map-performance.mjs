#!/usr/bin/env node
// "No buffering" check for the venue map (spec section 4).
// Opens the production build in headless Chromium on a simulated mid-range
// phone connection (~9 Mbps, 150 ms latency) with 4x CPU slowdown, and fails if:
//  - the whole island (base layer) isn't visible within 2.5 s of opening the map
//  - full detail isn't shown within 1 s of the camera landing after a fly-to
//  - the base layer was ever evicted
// Frame times are reported but not enforced: CI runners have no GPU.
// Usage: BASE_URL=http://localhost:4173 node scripts/perf/map-performance.mjs
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');

const BASE=process.env.BASE_URL||'http://localhost:4173';
const LIMITS={baseMs:2500,landingMs:1000};
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(120000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(u=>!u.href.startsWith(BASE),r=>r.abort());
const cdp=await page.context().newCDPSession(page);
await page.goto(BASE+'/');
await page.evaluate(()=>{localStorage.clear();localStorage.setItem('wedding-session-v1',JSON.stringify({email:'perf@test.sg',name:'Perf'}))});
// throttle from the very start (strict: the background map download is slow too),
// and open the map the moment the homepage is on screen
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:9e6/8,uploadThroughput:3e6/8});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('.nav-pill button:has-text("Design")');

const t0=Date.now();
await page.click('.nav-pill button:has-text("Design")');
await page.waitForFunction(()=>window.__cityMetrics?.baseReadyMs!=null,null,{timeout:60000});
const baseMs=Date.now()-t0;
await page.waitForTimeout(3000);

// fly to a venue and time detail after landing
await page.fill('.finder-box input','regis');await page.click('.finder-results button:has-text("Orchard Grand")');
await page.waitForFunction(()=>window.__cityMetrics?.lastFly,null,{timeout:30000});
await page.waitForFunction(()=>!window.__mapRig?.fly,null,{timeout:30000});
const landed=Date.now();
const shown=await page.waitForFunction(()=>{const s=window.__cityStream,f=window.__cityMetrics.lastFly;return s&&f&&s.readyAround(f.tx,f.tz,500)},null,{timeout:15000}).then(()=>true).catch(()=>false);
const landingMs=shown?Date.now()-landed:null;

const m=await page.evaluate(()=>{const x=window.__cityMetrics;return {baseReadyMs:x.baseReadyMs,cellsLoaded:x.cellsLoaded,cellsShown:x.cellsShown,baseEvictions:x.baseEvictions,cellsEvicted:x.cellsEvicted,frames:x.frames}});
await browser.close();
const frames=[...m.frames].sort((a,b)=>a-b),p95=frames[Math.floor(frames.length*.95)]||0;
const report={baseMs,landingMs,limits:LIMITS,cellsLoaded:m.cellsLoaded,cellsShown:m.cellsShown,baseEvictions:m.baseEvictions,cellsEvicted:m.cellsEvicted,frameP95ms:p95,frames:frames.length,errors};
const fails=[];
if(baseMs>LIMITS.baseMs)fails.push(`whole island visible after ${baseMs} ms (limit ${LIMITS.baseMs})`);
if(landingMs==null||landingMs>LIMITS.landingMs)fails.push(`detail after landing ${landingMs??'never'} ms (limit ${LIMITS.landingMs})`);
if(m.baseEvictions>0)fails.push('base layer was evicted');
if(errors.length)fails.push('page errors: '+errors.slice(0,3).join(' | '));
await writeFile('map-performance-report.json',JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
if(fails.length){console.error('FAILED:\n - '+fails.join('\n - '));process.exit(1)}
console.log('PASSED (frame times reported only: CI has no GPU)');

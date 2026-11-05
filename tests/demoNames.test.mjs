// The demo uses fictional venues (hackathon rules: no third-party trademarks).
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';import {join} from 'node:path';
const REAL=/St\.? Regis|Tanglin House|Cuscaden Hall|Claymore Residence|Scotts Garden Hotel|Grand Ballroom/;
function files(dir){return readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?files(p):/\.(jsx?|json|css|html)$/.test(n)?[p]:[]})}
test('no real hotel or ballroom names in the app source',()=>{
 const hits=[...files('src'),'index.html'].filter(f=>REAL.test(readFileSync(f,'utf8')));
 assert.deepEqual(hits,[]);
});
test('venues are labelled as fictional demo venues',async()=>{
 const {VENUES}=await import('../src/data/venues.js');
 assert.ok(VENUES.every(v=>/fictional demo venue/i.test(v.note)),VENUES.map(v=>v.note).join(' | '));
});

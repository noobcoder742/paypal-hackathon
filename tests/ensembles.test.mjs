import test from 'node:test';import assert from 'node:assert/strict';
import {GENRES,cleanLineup,ensemblePrice,ensembleLayout,lineupSize,lineupText,MAX_MUSICIANS} from '../src/studio/decor/ensembles.js';
import {CATALOG} from '../src/data/catalog.js';

test('a line-up keeps only its genre\'s instruments, within limits',()=>{
 assert.deepEqual(cleanLineup('classical',{violin:3,cello:1,drums:2,electricGuitar:1}),{violin:3,cello:1});
 assert.deepEqual(cleanLineup('classical',{piano:3}),{piano:1},'one grand piano at most');
 assert.deepEqual(cleanLineup('jazz',{}),GENRES.jazz.default,'empty means the default band');
 assert.ok(lineupSize(cleanLineup('classical',{violin:8,viola:4,cello:4,doubleBass:2,flute:2,harp:1,piano:1}))<=MAX_MUSICIANS);
 assert.deepEqual(cleanLineup('pop',{vocals:-2,keyboard:'1'}),{keyboard:1});
});
test('price = base fee + a fee per musician; the listing price is the default line-up',()=>{
 assert.equal(ensemblePrice('classical',{violin:2,viola:1,cello:1}),300+180*2+180+200);
 assert.ok(ensemblePrice('classical',{violin:4,viola:1,cello:1})>ensemblePrice('classical',{violin:2,viola:1,cello:1}));
 for(const item of CATALOG.filter(i=>i.genre)){assert.equal(item.price,ensemblePrice(item.genre,GENRES[item.genre].default),item.id)}
 assert.deepEqual(CATALOG.filter(i=>i.genre).map(i=>i.genre).sort(),['classical','jazz','pop'],'one listing per genre');
});
test('the layout places exactly the chosen instruments, without two musicians on the same spot',()=>{
 for(const [genre,lineup] of [['classical',{violin:4,viola:2,cello:2,doubleBass:1,harp:1,piano:1}],['jazz',{vocals:2,saxophone:2,trumpet:1,doubleBass:1,piano:1,drums:1}],['pop',{vocals:3,electricGuitar:2,bassGuitar:1,keyboard:1,drums:1}]]){
  const pts=ensembleLayout(genre,lineup);
  const counts={};for(const p of pts)counts[p.instrument]=(counts[p.instrument]||0)+1;
  assert.deepEqual(counts,cleanLineup(genre,lineup),genre);
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const d=Math.hypot(pts[i].x-pts[j].x,pts[i].z-pts[j].z);assert.ok(d>.7,`${genre}: ${pts[i].instrument} and ${pts[j].instrument} ${d.toFixed(2)} m apart`)}
 }
 assert.match(lineupText('classical',{violin:2,cello:1}),/2 × violin, 1 × cello/);
});

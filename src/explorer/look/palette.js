// Building colours for the map.
//
// Two sources, never mixed on the same surface:
//  1. OpenStreetMap colour tags (building:colour / colour / material, and
//     roof:colour). When a building has one, it is used as is.
//  2. Otherwise a palette chosen by building type (tile row field 8, see
//     scripts/fetch-sg-map.mjs) with small per-building variation, based on
//     how these building types typically look in Singapore.
//
// Facade kinds drive the window pattern in buildingMaterial.js:
//  0 punched windows (flats, offices with windows), 1 glass curtain wall,
//  2 houses/shophouses (few, larger windows), 3 no windows (sheds, car parks).
import * as THREE from 'three';

const TYPES={
 d:{walls:['#ece5d6','#e7dccb','#dfe3dc','#e8ddd2','#e2e3e6','#efe7da'],roof:['#bdb6aa','#c4bdb2'],kind:0,floor:2.9}, // HDB: pale with pastel tints
 a:{walls:['#ebe7df','#e2ddd4','#d9dcdd','#e6e0d6'],roof:['#b8b3ab','#a9a7a3'],kind:0,floor:3.1},
 h:{walls:['#efe0c6','#e6cfb2','#f1e7d6','#dcc0a2','#e7d0c3','#e2d7bb'],roof:['#b0654a','#9f5a42','#a8705a','#8f6a5a'],kind:2,floor:3.6}, // houses & shophouses, clay tile roofs
 c:{walls:['#e3dfd8','#dad6cf','#e6e1d8'],roof:['#aeaaa3','#b6b1a9'],kind:0,floor:3.9},
 cTall:{walls:['#a9b5bd','#9eaab2','#b4bdc1','#c2c6c4','#93a1ab'],roof:['#8e969b','#9aa1a4'],kind:1,floor:3.9}, // glass towers
 i:{walls:['#d5d8da','#cdd2d5','#dcdad3'],roof:['#9aa6ae','#a3abb0','#b2b0aa'],kind:3,floor:6},
 p:{walls:['#ece3d4','#e5dccd','#efe8dc'],roof:['#b6aea2','#a99b8a'],kind:0,floor:3.8},
 r:{walls:['#f3eee4','#efe6d6'],roof:['#8d4f3b','#7d5a4a','#a2614a'],kind:2,floor:4.5},
 x:{walls:['#d3d0ca','#cbc8c2'],roof:['#a9a59d','#9c9891'],kind:3,floor:3},
 other:{walls:['#e6e1d8','#ded9d0','#e9e4db'],roof:['#b3aea6','#bab5ad'],kind:0,floor:3.3},
 otherLow:{walls:['#ece4d6','#e4dbcd'],roof:['#aa8e7c','#b3aca2'],kind:2,floor:3.4}
};
const cache=new Map(),MUTE=new THREE.Color('#cfc8bc');
const col=hex=>{if(!cache.has(hex)){const c=new THREE.Color();try{c.set(hex)}catch{c.set('#dddddd')}cache.set(hex,c)}return cache.get(hex)};
const pick=(arr,seed)=>arr[Math.floor(seed*arr.length)%arr.length];

/** Stable 0..1 number per building from its footprint. */
export function seedOf(flat){let h=2166136261;for(let i=0;i<Math.min(flat.length,8);i++){h^=Math.round(flat[i]*10);h=Math.imul(h,16777619)}return ((h>>>0)%10007)/10007}

/** {wall, roof, kind, floor, seed} for a tile building row. */
export function buildingLook(row){
 const [h,minH,wallTag,,isPart,flat,,type='',roofTag='']=row;
 const seed=seedOf(flat);
 let t=TYPES[type]||null;
 if(type==='c'&&h>=40)t=TYPES.cTall;
 if(!t)t=h>=45?(seed<.55?TYPES.cTall:TYPES.a):h<=12?TYPES.otherLow:TYPES.other;
 // Tagged colours are often plain names ("orange", "red"); soften them a little
 // towards weathered paint/stone so they keep their hue without looking cartoonish.
 const wall=wallTag?col(wallTag).clone().lerp(MUTE,.3):col(pick(t.walls,seed)).clone();
 const roof=roofTag?col(roofTag).clone().lerp(MUTE,.2):col(pick(t.roof,(seed*7.3)%1)).clone();
 // Parts sitting on top of others (crowns, upper tiers) and very low parts read as plain surfaces.
 const kind=(h-minH<3.5)?3:t.kind;
 return {wall,roof,kind,floor:t.floor,seed};
}

// Land polygons built from the OpenStreetMap coastline (fetch-sg-map Action).
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {project,pointInPolygon} from '../src/explorer/geo.js';
const land=JSON.parse(readFileSync(new URL('../public/data/sg/land.json',import.meta.url)));
const onLand=(lat,lon)=>{const [x,z]=project(lat,lon);return land.polys.some(p=>pointInPolygon(x,z,p))};
test('land points are inside the land polygons',()=>{
 for(const [n,la,lo] of [['Orchard Road',1.3048,103.8318],['Tuas',1.3200,103.6500],['Changi Airport',1.3644,103.9915]])assert.ok(onLand(la,lo),n);
});
test('sea points are outside',()=>{
 for(const [n,la,lo] of [['Strait of Johor',1.4400,103.7700],['Singapore Strait',1.2300,103.8500]])assert.ok(!onLand(la,lo),n);
});

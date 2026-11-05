// Land polygons built from the OpenStreetMap coastline (fetch-sg-map Action).
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {project,pointInPolygon} from '../src/explorer/geo.js';
const land=JSON.parse(readFileSync(new URL('../public/data/sg/land.json',import.meta.url)));
const onLand=(lat,lon)=>{const [x,z]=project(lat,lon);return land.polys.some(p=>pointInPolygon(x,z,p))};
test('land points are inside the land polygons',()=>{
 for(const [n,la,lo] of [['Orchard Road',1.3048,103.8318],['Tuas',1.3200,103.6500],['Changi Airport',1.3644,103.9915],['Woodlands waterfront',1.4360,103.7860],["St John's Island",1.2198,103.8484]])assert.ok(onLand(la,lo),n);
});
test('sea points are outside',()=>{
 for(const [n,la,lo] of [['Strait of Johor off Kranji',1.4520,103.7200],['Strait of Johor off Sembawang',1.4700,103.8300],['Singapore Strait east',1.2600,103.9500],['Singapore Strait off Marina South',1.2550,103.8700]])assert.ok(!onLand(la,lo),n);
});

// Which map buildings belong to a venue. Shared by the browser and the city
// build script (scripts/build-city-3d.mjs) so both agree exactly.
//
// A venue's map point may land on one piece of a building that OSM splits
// into parts (podium, tower...), or just outside its footprint. A venue owns:
// every building containing one of its points (or the nearest one within
// 40 m), buildings nearby carrying the venue's OSM name, and every other part
// of the same building (shared building id, 7th field of a tile row).
import { pointInPolygon } from './geo.js';

export function distToPoly(x, z, f) {
  let d = Infinity;
  for (let i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
    const ax = f[j],
      az = f[j + 1],
      bx = f[i],
      bz = f[i + 1],
      dx = bx - ax,
      dz = bz - az,
      l = dx * dx + dz * dz || 1,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l));
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return d;
}
export const normName = n =>
  (n || '')
    .toLowerCase()
    .replace(/\b(the|singapore|hotel)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * @param buildings tile rows around the venue (within ~250 m)
 * @param points    venue map points [[x,z],...]
 * @param centre    {x,z} venue centre
 * @param name      venue display name
 * @returns row => boolean
 */
export function matchVenue(buildings, points, centre, name) {
  const hits = new Set();
  for (const [px, pz] of points) {
    let found = buildings.filter(b => pointInPolygon(px, pz, b[5]));
    if (!found.length) {
      let best = null,
        bd = 40;
      for (const b of buildings) {
        const d = distToPoly(px, pz, b[5]);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) found = [best];
    }
    found.forEach(b => hits.add(b));
  }
  const key = normName(name);
  if (key.length >= 4)
    for (const b of buildings) {
      const n = normName(b[3]);
      if (
        n.length >= 4 &&
        (n.includes(key) || key.includes(n)) &&
        b[5].length &&
        distToPoly(centre.x, centre.z, b[5]) < 150
      )
        hits.add(b);
    }
  const groups = new Set([...hits].map(b => b[6]).filter(v => v != null));
  return b => hits.has(b) || (b[6] != null && groups.has(b[6]));
}

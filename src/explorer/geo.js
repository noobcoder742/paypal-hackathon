// Local metric plane used by the Singapore map tiles (must match
// scripts/fetch-sg-map.mjs). x = metres east, z = metres south of the origin.
export const SG_ORIGIN = { lat: 1.3521, lon: 103.8198 };
const COS = Math.cos((SG_ORIGIN.lat * Math.PI) / 180);
export function project(lat, lon) {
  return [(lon - SG_ORIGIN.lon) * 111320 * COS, -(lat - SG_ORIGIN.lat) * 110540];
}
export function pointInPolygon(x, z, flat) {
  let c = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i],
      zi = flat[i + 1],
      xj = flat[j],
      zj = flat[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

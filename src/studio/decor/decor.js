import { GENRES, cleanLineup } from './ensembles.js';
// Movable decor in the ballroom (arch, hedges, flower stands, lanterns, flower wall, live music,
// lighting, photo booth, dessert and buffet tables, bubble machines, wedding cars) and the carpet the couple lays tile by tile. Pure functions on the studio's saved
// layout, so undo/redo and saving keep working unchanged.

// Room interior, metres (16.8 m × 20.6 m), less a small wall margin.
export const ROOM_BOUNDS = { minX: -7.9, maxX: 7.9, minZ: -9.8, maxZ: 9.8 };
export const TILE = 1; // carpet tile: 1 m × 1 m, a thin layer on the floor

export const DECOR_TYPES = {
  arch: { label: 'Floral arch', footprint: [4.4, 1] },
  hedge: { label: 'Box hedge planter', footprint: [1.2, 0.5] },
  flowerStand: { label: 'Aisle flower stand', footprint: [0.5, 0.5] },
  lantern: { label: 'Floor lantern', footprint: [0.35, 0.35] },
  flowerWall: { label: 'Flower wall', footprint: [2.6, 0.4] },
  ensemble: { label: 'Live music', footprint: [4, 3] }, // real footprint from ensembleFootprint()
  uplight: { label: 'Ambient uplight', footprint: [0.4, 0.4] },
  spotlight: { label: 'Stage spotlight tower', footprint: [0.6, 0.6] },
  // the canopy hangs under the ceiling: grab it by its centre, high up, so it never blocks the tables
  canopy: { label: 'Fairy-light canopy', footprint: [11, 15], grab: { size: [1.2, 0.8, 1.2], y: 4.1 } },
  photoBooth: { label: 'Photo booth', footprint: [2.6, 2.2] },
  dessertTable: { label: 'Dessert table', footprint: [2.6, 0.9] },
  buffet: { label: 'Banquet service station', footprint: [2.6, 0.9] },
  bubbles: { label: 'Bubble machine', footprint: [0.45, 0.45] },
  // wedding cars wait outside the entrance doors, on the driveway
  car: { label: 'Wedding car', footprint: [2, 4.8], bounds: { minX: 10, maxX: 14, minZ: -9, maxZ: 9 } },
};
export const CARPET_COLOURS = { red: '#8f1f2a', white: '#f2efe8', ivory: '#e6dccb', blush: '#dcb7b3' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nextId = list => 1 + Math.max(0, ...list.map(x => x.id || 0));
const clampItem = it => {
  const b = DECOR_TYPES[it.type]?.bounds || ROOM_BOUNDS;
  return { ...it, x: clamp(it.x, b.minX, b.maxX), z: clamp(it.z, b.minZ, b.maxZ) };
};
// Default spots in the 16.8 × 20.6 m room, clear of the 16-table layout: the stage is at the head
// wall (-x), the entrance doors at +x (z ≈ ±5.5). The corners beside the stage are the free space.
const DEFAULT_SPOT = {
  arch: { x: -5, z: 0, rotation: Math.PI / 2 },
  flowerWall: { x: 7.6, z: 0, rotation: -Math.PI / 2 },
  ensemble: { x: -6.2, z: -7.4, rotation: Math.PI * 0.7 },
  canopy: { x: 1.3, z: 0 },
  photoBooth: { x: -6.4, z: 9.05, rotation: Math.PI }, // backdrop against the side wall
  dessertTable: { x: -7.85, z: 6.6, rotation: Math.PI / 2 }, // along the head wall, beside the stage
  buffet: { x: -6.8, z: -9.8, rotation: 0 }, // along the side wall, behind the band
  car: { x: 11.4, z: -5.5, rotation: 0 },
};
/** Facing for an item at (x,z) whose front (local -z) should point at (tx,tz). */
const aim = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

export function addDecor(data, type, at = {}) {
  if (!DECOR_TYPES[type]) throw new Error('unknown decor type ' + type);
  const decor = data.decor || [];
  const item = clampItem({ id: nextId(decor), type, x: 0, z: 0, rotation: 0, ...DEFAULT_SPOT[type], ...at });
  const inventory = data.inventory?.includes(type) ? data.inventory : [...(data.inventory || []), type];
  return { ...data, decor: [...decor, item], inventory };
}
export function updateDecor(data, id, changes) {
  return {
    ...data,
    decor: (data.decor || []).map(it => (it.id === id ? clampItem({ ...it, ...changes }) : it)),
  };
}
export function removeDecor(data, id) {
  return { ...data, decor: (data.decor || []).filter(it => it.id !== id) };
}
export function removeDecorType(data, type) {
  return {
    ...data,
    decor: (data.decor || []).filter(it => it.type !== type),
    inventory: (data.inventory || []).filter(x => x !== type),
  };
}

/** Saves from before decor existed: a shown arch becomes one draggable arch; carpet starts empty. */
export function migrateDecor(data) {
  let d = { ...data };
  if (!Array.isArray(d.decor)) d.decor = [];
  if (!d.carpet || !Array.isArray(d.carpet.tiles)) d.carpet = { color: 'red', tiles: [] };
  if (d.showArch) {
    if (!d.decor.some(x => x.type === 'arch')) d = addDecor(d, 'arch');
    d.showArch = false;
  }
  return d;
}

export const tileAt = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
const inRoom = ([i, j]) =>
  i * TILE >= ROOM_BOUNDS.minX - 0.5 &&
  (i + 1) * TILE <= ROOM_BOUNDS.maxX + 0.5 &&
  j * TILE >= ROOM_BOUNDS.minZ - 0.5 &&
  (j + 1) * TILE <= ROOM_BOUNDS.maxZ + 0.5;
/** Add or remove tiles ([i,j] grid cells). */
export function paintTiles(data, cells, mode = 'add') {
  const carpet = data.carpet || { color: 'red', tiles: [] };
  const key = ([i, j]) => i + ',' + j;
  const have = new Map(carpet.tiles.map(t => [key(t), t]));
  for (const c of cells) {
    if (!inRoom(c)) continue;
    if (mode === 'add') have.set(key(c), [c[0], c[1]]);
    else have.delete(key(c));
  }
  return { ...data, carpet: { ...carpet, tiles: [...have.values()] } };
}
/** Grid cells between two cells, 4-connected, so a quick drag leaves no gaps. */
export function carpetLine(a, b) {
  const out = [[a[0], a[1]]];
  let [x, y] = a;
  while (x !== b[0] || y !== b[1]) {
    const dx = b[0] - x,
      dy = b[1] - y;
    if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
    else y += Math.sign(dy);
    out.push([x, y]);
  }
  return out;
}
/** Hedge planters in a row along the front edge of the stage (the side facing the guests). */
export function hedgeRowForStage(stage) {
  const rot = stage.rotation || 0;
  const along = [Math.cos(rot), -Math.sin(rot)],
    front = [Math.sin(rot), Math.cos(rot)];
  // the stage's local depth axis points at the guests; pick the side facing the room centre
  const toCentre = -(stage.x * front[0] + stage.z * front[1]);
  const s = toCentre >= 0 ? 1 : -1;
  const n = Math.max(2, Math.floor(stage.width / 1.4));
  const gap = stage.width / n;
  const off = stage.depth / 2 + 0.45;
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = -stage.width / 2 + gap * (k + 0.5);
    if (Math.abs(t) < 0.8) continue; // keep the centre open for the steps and aisle
    out.push(
      clampItem({
        x: stage.x + along[0] * t + front[0] * off * s,
        z: stage.z + along[1] * t + front[1] * off * s,
        rotation: rot,
      })
    );
  }
  return out;
}

// What a marketplace listing (or the AI planner's plan) puts in the room.
export const LISTING_DECOR = new Set([
  'arch',
  'hedge',
  'flowerStand',
  'lantern',
  'flowerWall',
  'carpet',
  'ensemble',
  'uplight',
  'spotlight',
  'canopy',
  'photoBooth',
  'dessertTable',
  'buffet',
  'bubbles',
  'car',
]);
const AISLE_X = { from: -5, to: 8 }; // from the stage front to the far (entrance) wall
export function placeForListing(data, type, listing = {}) {
  if (!LISTING_DECOR.has(type)) throw new Error('no decor for ' + type);
  let d = migrateDecor(data);
  const has = t => (d.decor || []).some(x => x.type === t);
  if (type === 'ensemble') {
    // one group per genre: a new line-up updates the existing band in place
    const genre = GENRES[listing.genre] ? listing.genre : 'classical',
      lineup = cleanLineup(genre, listing.lineup);
    const band = (d.decor || []).find(x => x.type === 'ensemble' && x.genre === genre);
    if (band) return updateDecor(d, band.id, { lineup });
    const n = (d.decor || []).filter(x => x.type === 'ensemble').length;
    return addDecor(d, 'ensemble', {
      genre,
      lineup,
      listingId: listing.id,
      ...(n ? { x: -6.2, z: 7.4, rotation: Math.PI * 0.3 } : {}),
    });
  }
  if (type === 'arch' || type === 'flowerWall') return has(type) ? d : addDecor(d, type);
  if (type === 'hedge')
    return has('hedge')
      ? d
      : hedgeRowForStage(d.stage || { x: -6.95, z: 0, width: 7.2, depth: 2.6, rotation: Math.PI / 2 }).reduce(
          (acc, at) => addDecor(acc, 'hedge', at),
          d
        );
  if (type === 'flowerStand') {
    if (has(type)) return d;
    for (let x = -4; x <= 7; x += 3.5) for (const z of [-1.6, 1.6]) d = addDecor(d, 'flowerStand', { x, z });
    return d;
  }
  if (type === 'lantern') {
    if (has(type)) return d;
    for (let x = -3; x <= 7; x += 3.3) for (const z of [-1.25, 1.25]) d = addDecor(d, 'lantern', { x, z });
    return d;
  }
  if (type === 'uplight') {
    if (has(type)) return d; // washing the side walls and the entrance wall with warm light
    const spots = [
      ...[-2.5, 1, 4.5].flatMap(x => [
        { x, z: 9.95, rotation: Math.PI },
        { x, z: -9.95, rotation: 0 },
      ]),
      ...[2.6, 8.3].flatMap(z => [
        { x: 8.05, z, rotation: -Math.PI / 2 },
        { x: 8.05, z: -z, rotation: -Math.PI / 2 },
      ]),
    ];
    for (const at of spots) d = addDecor(d, 'uplight', at);
    return d;
  }
  if (type === 'spotlight') {
    if (has(type)) return d;
    const st = d.stage || { x: -6.95, z: 0 }; // a tower at each front corner of the stage, aimed at it
    for (const z of [-4.6, 4.6]) {
      const x = -5;
      d = addDecor(d, 'spotlight', { x, z, rotation: aim(x, z, st.x, st.z) });
    }
    return d;
  }
  if (type === 'bubbles') {
    if (has(type)) return d;
    for (const z of [-4.4, 4.4]) d = addDecor(d, 'bubbles', { x: 7.9, z });
    return d;
  } // beside the entrance doors
  if (type === 'car') {
    // one car per booking (a chauffeured car and a classic car can both come)
    if ((d.decor || []).some(x => x.type === 'car' && x.listingId === listing.id)) return d;
    const n = (d.decor || []).filter(x => x.type === 'car').length;
    return addDecor(d, 'car', {
      listingId: listing.id,
      model: /classic/.test(listing.id || '') ? 'classic' : 'sedan',
      ...(n ? { z: 5.5 } : {}),
    });
  }
  if (['canopy', 'photoBooth', 'dessertTable', 'buffet'].includes(type))
    return has(type) ? d : addDecor(d, type);
  // carpet: a 2 m runner down the centre aisle
  const cells = [];
  for (let i = AISLE_X.from; i < AISLE_X.to; i++) cells.push([i, -1], [i, 0]);
  return paintTiles(d, cells, 'add');
}
/** Place saved marketplace items (planner.savedItems) the first time the studio sees them. */
export function placeSavedListings(data, savedItems = []) {
  const done = new Set(data.placedListings || []);
  // a band's key includes its line-up, so choosing different instruments updates the room
  const key = i =>
    i.inventoryType === 'ensemble'
      ? i.id + ':' + JSON.stringify(cleanLineup(GENRES[i.genre] ? i.genre : 'classical', i.lineup))
      : i.id;
  const todo = savedItems.filter(i => i && LISTING_DECOR.has(i.inventoryType) && !done.has(key(i)));
  if (!todo.length) return data;
  let d = data;
  for (const i of todo) d = placeForListing(d, i.inventoryType, i);
  return { ...d, placedListings: [...done, ...todo.map(key)] };
}

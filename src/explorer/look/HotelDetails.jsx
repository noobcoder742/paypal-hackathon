// Architectural details for the listed hotels (config in hotels.js), built
// from the hotel's OpenStreetMap footprints and heights: floor slabs and
// balconies, vertical fins/louvres, sky terraces, planters with hanging
// plants, roof gardens and a glowing crown.
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { edges, offset, slab, rng, centroid } from './geom.js';
import { pointInPolygon } from '../geo.js';

const GREENS = ['#4f6b3a', '#5d7a42', '#6b8a4a', '#46603a', '#7a9656'].map(c => new THREE.Color(c));
const leaf = new THREE.IcosahedronGeometry(1, 0);
const box = new THREE.BoxGeometry(1, 1, 1);

function buildDetails(rows, look) {
  const slabGeoms = [],
    crownGeoms = [],
    recessGeoms = [],
    fins = [],
    podium = [],
    plants = [];
  const storey = look.storey || 3.4,
    tallest = rows.reduce((a, r) => (r[0] > a[0] ? r : a), rows[0]);
  const rand = rng(0.37 + rows.length * 0.013);
  for (const row of rows) {
    const [h, minH, , , , f] = row,
      span = h - minH;
    if (span < 2.5 || f.length < 6) continue;
    const es = edges(f);
    // floor slabs / balconies
    if (look.slabs) {
      let step = storey * look.slabs.every;
      const floors = Math.floor(span / step);
      if (floors * es.length > 900) step *= Math.ceil((floors * es.length) / 900);
      const ring = offset(f, look.slabs.depth);
      for (let y = minH + step; y < h - 1; y += step)
        try {
          slabGeoms.push(slab(ring, y - 0.12, 0.24));
        } catch {}
    }
    // sky terraces: a recessed, shaded band every N storeys with planting along its edge
    if (look.terraces && span > 30) {
      const every = storey * look.terraces.every;
      for (let y = minH + every; y < h - every * 0.5; y += every + look.terraces.height) {
        try {
          recessGeoms.push(slab(offset(f, 0.06), y, look.terraces.height));
        } catch {}
        for (const e of es) {
          const n = Math.floor(e.len / 1.6);
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n;
            plants.push([
              e.ax + e.dx * e.len * t + e.nx * 0.4,
              y + 0.6,
              e.az + e.dz * e.len * t + e.nz * 0.4,
              0.6 + rand() * 0.6,
            ]);
          }
          // vine-covered columns at the corners of each terrace
          plants.push([
            e.ax + e.nx * 0.3,
            y + look.terraces.height * 0.5,
            e.az + e.nz * 0.3,
            0.45,
            look.terraces.height * 0.55,
          ]);
        }
      }
    }
    // vertical fins / louvres
    if (look.fins && span > look.fins.minH) {
      const base = minH + (look.podiumFins ? look.podiumFins.height : 0),
        fh = h - base;
      for (const e of es) {
        const n = Math.floor(e.len / look.fins.spacing);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          fins.push([
            e.ax + e.dx * e.len * t + e.nx * look.fins.depth * 0.5,
            base + fh / 2,
            e.az + e.dz * e.len * t + e.nz * look.fins.depth * 0.5,
            Math.atan2(e.nx, e.nz),
            fh,
            look.fins.depth,
          ]);
        }
      }
      if (look.podiumFins)
        for (const e of es) {
          const n = Math.floor(e.len / 0.45);
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n;
            podium.push([
              e.ax + e.dx * e.len * t + e.nx * 0.2,
              minH + look.podiumFins.height / 2,
              e.az + e.dz * e.len * t + e.nz * 0.2,
              Math.atan2(e.nx, e.nz),
              look.podiumFins.height,
              0.4,
            ]);
          }
        }
    }
    // planters with hanging plants on floor edges
    if (look.green && (!look.green.maxH || minH < look.green.maxH)) {
      const step = storey * look.green.every,
        top = Math.min(h, look.green.maxH || h);
      for (let y = minH + step; y < top; y += step)
        for (const e of es) {
          const n = Math.floor(e.len / 1.4);
          for (let k = 0; k < n; k++)
            if (rand() < look.green.density) {
              const t = (k + rand() * 0.8) / n;
              plants.push([
                e.ax + e.dx * e.len * t + e.nx * ((look.slabs?.depth || 0.5) - 0.15),
                y - 0.25 - rand() * 0.5,
                e.az + e.dz * e.len * t + e.nz * ((look.slabs?.depth || 0.5) - 0.15),
                0.35 + rand() * 0.5,
                0.6 + rand() * 1.2,
              ]);
            }
        }
    }
    // roof gardens: planting scattered over each roof
    if (look.roofGarden) {
      let x0 = 1e9,
        z0 = 1e9,
        x1 = -1e9,
        z1 = -1e9;
      for (let i = 0; i < f.length; i += 2) {
        x0 = Math.min(x0, f[i]);
        x1 = Math.max(x1, f[i]);
        z0 = Math.min(z0, f[i + 1]);
        z1 = Math.max(z1, f[i + 1]);
      }
      const tries = Math.min(260, Math.floor(((x1 - x0) * (z1 - z0)) / 14));
      for (let k = 0; k < tries; k++) {
        const x = x0 + rand() * (x1 - x0),
          z = z0 + rand() * (z1 - z0);
        if (pointInPolygon(x, z, f) && rand() < 0.55) plants.push([x, h + 0.5, z, 0.6 + rand() * 1.1]);
      }
    }
  }
  if (look.crown && tallest)
    try {
      crownGeoms.push(slab(offset(tallest[5], 0.08), tallest[0] - 2.6, 1.8));
    } catch {}
  const merge = list => (list.length ? mergeGeometries(list) : null);
  const out = {
    slabs: merge(slabGeoms),
    recess: merge(recessGeoms),
    crown: merge(crownGeoms),
    fins,
    podium,
    plants,
  };
  [...slabGeoms, ...recessGeoms, ...crownGeoms].forEach(g => g.dispose());
  return out;
}

function Instanced({ items, geometry, material, kind }) {
  const mesh = useMemo(() => {
    if (!items.length) return null;
    const m = new THREE.InstancedMesh(geometry, material, items.length),
      o = new THREE.Object3D();
    items.forEach((it, i) => {
      if (kind === 'fin') {
        const [x, y, z, rot, h, d] = it;
        o.position.set(x, y, z);
        o.rotation.set(0, rot, 0);
        o.scale.set(0.12, h, d);
      } else {
        const [x, y, z, s, tall] = it;
        o.position.set(x, y, z);
        o.rotation.set(0, (i * 1.37) % 6.28, 0);
        o.scale.set(s, tall ? tall : s * 0.8, s);
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (kind === 'leaf') m.setColorAt(i, GREENS[i % GREENS.length]);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    m.raycast = () => null;
    return m;
  }, [items, geometry, material, kind]);
  useEffect(() => () => mesh?.dispose(), [mesh]);
  return mesh ? <primitive object={mesh} /> : null;
}

export default function HotelDetails({ rows, look }) {
  const d = useMemo(() => (rows?.length && look ? buildDetails(rows, look) : null), [rows, look]);
  const mats = useMemo(
    () => ({
      slab: new THREE.MeshStandardMaterial({ color: look?.slabs?.colour || '#f2efe8', roughness: 0.7 }),
      recess: new THREE.MeshStandardMaterial({ color: '#4c4a44', roughness: 1 }),
      crown: new THREE.MeshStandardMaterial({
        color: '#f7e7cf',
        emissive: new THREE.Color(look?.crown?.colour || '#ffd9a3'),
        emissiveIntensity: 1.4,
      }),
      fin: new THREE.MeshStandardMaterial({ color: look?.fins?.colour || '#f2efe8', roughness: 0.5 }),
      podium: new THREE.MeshStandardMaterial({
        color: look?.podiumFins?.colour || '#8a6a4c',
        roughness: 0.4,
        metalness: 0.5,
      }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    }),
    [look]
  );
  useEffect(
    () => () => {
      d && [d.slabs, d.recess, d.crown].forEach(g => g?.dispose());
      Object.values(mats).forEach(m => m.dispose());
    },
    [d, mats]
  );
  if (!d) return null;
  return (
    <group>
      {d.slabs && (
        <mesh geometry={d.slabs} material={mats.slab} castShadow receiveShadow raycast={() => null} />
      )}
      {d.recess && <mesh geometry={d.recess} material={mats.recess} receiveShadow raycast={() => null} />}
      {d.crown && <mesh geometry={d.crown} material={mats.crown} raycast={() => null} />}
      <Instanced items={d.fins} geometry={box} material={mats.fin} kind="fin" />
      <Instanced items={d.podium} geometry={box} material={mats.podium} kind="fin" />
      <Instanced items={d.plants} geometry={leaf} material={mats.leaf} kind="leaf" />
    </group>
  );
}
export { centroid };

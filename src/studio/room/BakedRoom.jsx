// The demo ballroom: modelled in Blender, lit in Cycles, with the light baked into textures
// (scripts/blender/ballroom.py + bake.py). Walls, ceiling and carpet show Cycles' soft shadows,
// bounce light and sconce glows at almost no cost: colour × lightmap, no real-time lighting.
// Gold, mirrors, bronze doors and crystal reflect a 360° panorama rendered from the room.
// Movable furniture keeps the studio's real-time lights; a shadow catcher on the carpet
// lets it cast soft shadows.
import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import ROOM from './demoBallroom.json';

export const ROOM_URL = '/venues/demo-ballroom/';
const GLB = ROOM_URL + ROOM.glb;
const LIGHTMAP_URLS = Object.fromEntries(
  Object.entries(ROOM.lightmaps).map(([k, v]) => [k, ROOM_URL + v.file])
);
const CEILING_PARTS = new Set(['ceiling', 'ceil_gold', 'ceil_emit']);
const REFLECTIVE = new Set(['gold', 'ceil_gold', 'mirror', 'bronze']);
// The studio's ACES tone mapping pushes warm light toward orange; Cycles' AgX keeps it champagne.
// A slight cool tint on the baked surfaces brings the two back together.
const NEUTRAL = new THREE.Color(0.9, 0.94, 1);

/** Start downloading the room as soon as the studio code loads, before the canvas mounts. */
export function preloadRoom() {
  useGLTF.preload(GLB);
  useTexture.preload([...Object.values(LIGHTMAP_URLS), ROOM_URL + ROOM.env]);
}

/** The part a mesh belongs to: the top-level node name from the Blender export (wall_head, gold…). */
function partOf(o) {
  while (o.parent && o.parent.type !== 'Scene' && o.parent.parent) o = o.parent;
  return o.name;
}

export function BakedRoom({ showCeiling = true, ceilingHeight = ROOM.dimensions.ceiling, brightness = 1 }) {
  const { scene } = useGLTF(GLB);
  const lightmaps = useTexture(LIGHTMAP_URLS);
  const env = useTexture(ROOM_URL + ROOM.env);
  const { root, ceiling } = useMemo(() => {
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    for (const t of Object.values(lightmaps)) {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    }
    const root = scene.clone(true),
      ceiling = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      const part = partOf(o),
        m = o.material,
        lm = lightmaps[part];
      if (CEILING_PARTS.has(part)) ceiling.push(o);
      if (lm) {
        // the lightmap UVs are the second set, or the only set on parts without textures
        lm.channel = o.geometry.attributes.uv1 ? 1 : 0;
        // colour × baked light; the lightmap stores light / scale in sRGB (see bake.py encode())
        o.material = new THREE.MeshBasicMaterial({
          color: m.color.clone().multiply(NEUTRAL),
          map: m.map || null,
          lightMap: lm,
          lightMapIntensity: ROOM.lightmaps[part].scale * Math.PI,
          name: m.name,
        });
        o.material.userData.baseLightMap = o.material.lightMapIntensity;
      } else if (REFLECTIVE.has(part)) {
        o.material = m.clone();
        o.material.envMap = env;
        o.material.envMapIntensity = part === 'mirror' ? 1.1 : 1.4;
      } else if (part === 'crystal') {
        o.material = new THREE.MeshStandardMaterial({
          color: '#fffaf2',
          roughness: 0.05,
          metalness: 0.6,
          envMap: env,
          envMapIntensity: 2,
          transparent: true,
          opacity: 0.8,
        });
      } else if (part === 'emit' || part === 'ceil_emit') {
        const c = (m.emissive && m.emissive.getHex() ? m.emissive : m.color).clone();
        o.material = new THREE.MeshBasicMaterial({
          color: c.multiplyScalar(part === 'emit' && m.name === 'Exit sign' ? 1 : 1.6),
          name: m.name,
        });
      }
      o.castShadow = false;
      o.receiveShadow = false;
    });
    return { root, ceiling };
  }, [scene, lightmaps, env]);
  // brightness follows the studio's lighting choice; the ceiling hides when looking from above
  useMemo(
    () =>
      root.traverse(o => {
        if (o.isMesh && o.material.userData.baseLightMap)
          o.material.lightMapIntensity = o.material.userData.baseLightMap * brightness;
      }),
    [root, brightness]
  );
  useFrame(({ camera }) => {
    const v = showCeiling && camera.position.y < ceilingHeight - 0.2;
    for (const o of ceiling) o.visible = v;
  });
  return (
    <group>
      <primitive object={root} />
      {/* lets real-time furniture cast soft shadows onto the baked carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[ROOM.dimensions.length, ROOM.dimensions.width]} />
        <shadowMaterial transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/** Shown for the moment the room is still downloading: plain carpet and walls in the room's colours. */
export function RoomPlaceholder() {
  const { length: l, width: w, height: h } = ROOM.dimensions;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[l, w]} />
        <meshBasicMaterial color="#6b5a66" />
      </mesh>
      {[
        [0, -w / 2, 0],
        [0, w / 2, Math.PI],
        [-l / 2, 0, Math.PI / 2],
        [l / 2, 0, -Math.PI / 2],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation={[0, r, 0]}>
          <planeGeometry args={[i < 2 ? l : w, h]} />
          <meshBasicMaterial color="#d9cbb5" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

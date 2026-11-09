// Lighting for the venue map at 6:20pm in Singapore: low, warm sunlight from
// its real direction (look/sun.js), a soft blue sky fill so shadows are never
// black, a dusk sky gradient and haze. The sun's shadow camera follows the
// point the map is looking at, sized to the zoom so nearby shadows stay crisp.
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const SKY = { top: '#a9bcd3', mid: '#d9d3cf', horizon: '#efd9c3' };

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY.top);
  grad.addColorStop(0.6, SKY.mid);
  grad.addColorStop(1, SKY.horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function EveningLight({ sun, rigRef }) {
  const { scene } = useThree();
  const light = useRef(),
    target = useMemo(() => new THREE.Object3D(), []);
  const sunColour = useMemo(() => {
    // the lower the sun, the more orange its light (6.5° in November, ~11° in June)
    const k = THREE.MathUtils.clamp((sun.elevation - 3) / 12, 0, 1);
    return new THREE.Color('#ff9a52').lerp(new THREE.Color('#ffd2a1'), k);
  }, [sun.elevation]);
  useEffect(() => {
    const tex = skyTexture(),
      prev = scene.background;
    scene.background = tex;
    scene.add(target);
    return () => {
      scene.background = prev;
      tex.dispose();
      scene.remove(target);
    };
  }, [scene, target]);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target = target;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.8;
    l.shadow.camera.near = 10;
    l.shadow.camera.far = 9000;
  }, [target]);
  // Shadow-map stability: the shadow area is resized only in steps, and its
  // centre is snapped to whole shadow-map texels in the light's own frame, so
  // shadows don't shimmer or flicker while the camera moves or zooms.
  const basis = useMemo(() => {
    const d = new THREE.Vector3(-sun.x, -sun.y, -sun.z).normalize(),
      right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize(),
      up = new THREE.Vector3().crossVectors(d, right).normalize();
    return { right, up };
  }, [sun]);
  const centre = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const { cur } = rigRef.current;
    const D = 4000,
      want = THREE.MathUtils.clamp(cur.r * 1.15, 160, 2600);
    const half = Math.min(2600, 160 * Math.pow(1.5, Math.ceil(Math.log(want / 160) / Math.log(1.5))));
    const texel = (2 * half) / l.shadow.mapSize.x;
    centre.set(cur.tx, 0, cur.tz);
    const u = centre.dot(basis.right),
      v = centre.dot(basis.up);
    centre
      .addScaledVector(basis.right, Math.round(u / texel) * texel - u)
      .addScaledVector(basis.up, Math.round(v / texel) * texel - v);
    target.position.copy(centre);
    l.position.set(centre.x + sun.x * D, centre.y + sun.y * D, centre.z + sun.z * D);
    const cam = l.shadow.camera;
    if (cam.right !== half) {
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.updateProjectionMatrix();
    }
  });
  return (
    <>
      <hemisphereLight args={['#b7c6e0', '#cbb497', 1.35]} />
      <ambientLight intensity={0.12} color="#ffeadb" />
      <directionalLight ref={light} color={sunColour} intensity={5.2} castShadow />
    </>
  );
}

// 3D musicians for the studio: jointed figures in concert dress playing their
// instruments, posed seated (classical) or standing (jazz, pop, double bass,
// singers), with a gentle playing motion. All geometry is procedural and shared.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ensembleLayout, GENRES } from './ensembles.js';

const geo = {},
  mat = {};
const G = (k, f) => geo[k] || (geo[k] = f());
const M = (k, f) => mat[k] || (mat[k] = f());
const std = (color, roughness = 0.7, metalness = 0) =>
  M(color + roughness + metalness, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
const WOOD = () => std('#7a3a1c', 0.38),
  DARKWOOD = () => std('#3b1d10', 0.45),
  BLACK = () => std('#151515', 0.5),
  GLOSS = () => std('#0d0d0f', 0.18, 0.1),
  BRASS = () => std('#c8a24a', 0.28, 0.9),
  CHROME = () => std('#d8d8dc', 0.2, 0.95),
  WHITE = () => std('#f4f1ea', 0.6);

// ---------- figure ----------
const SKIN = ['#f1c9a8', '#d9a47e', '#a8724e', '#6f4630', '#e8b896'];
const HAIR = ['#1d1612', '#3a2618', '#6b4a2b', '#151515', '#8a6a4a'];
function outfitFor(genre, i, instrument) {
  const woman = i % 2 === 1 || instrument === 'harp' || (instrument === 'vocals' && i % 3 !== 2);
  if (genre === 'classical')
    return {
      woman,
      top: woman ? '#141416' : '#111113',
      bottom: woman ? '#141416' : '#111113',
      shirt: '#f3f1ec',
      tie: !woman,
    };
  if (genre === 'jazz')
    return {
      woman,
      top: woman
        ? instrument === 'vocals'
          ? '#8e1f2a'
          : '#1b1b1f'
        : ['#1b1d24', '#2a2321', '#14161c'][i % 3],
      bottom: woman ? (instrument === 'vocals' ? '#8e1f2a' : '#1b1b1f') : '#141418',
      shirt: '#ece8df',
      tie: !woman,
    };
  return {
    woman,
    top: ['#d9d2c6', '#2d3e5c', '#7a2433', '#1a1a1a', '#c8a45a'][i % 5],
    bottom: ['#1a1a1d', '#30343c', '#1d2433'][i % 3],
    shirt: null,
    tie: false,
  };
}
const capsule = (r, len) => G('cap' + r + len, () => new THREE.CapsuleGeometry(r, len, 6, 12));
const torsoGeo = woman =>
  G('torso' + woman, () => {
    const pts = woman
      ? [
          [0.13, 0],
          [0.15, 0.06],
          [0.13, 0.2],
          [0.155, 0.36],
          [0.16, 0.44],
          [0.09, 0.52],
        ]
      : [
          [0.15, 0],
          [0.16, 0.08],
          [0.165, 0.24],
          [0.19, 0.4],
          [0.19, 0.46],
          [0.1, 0.53],
        ];
    const g = new THREE.LatheGeometry(
      pts.map(([x, y]) => new THREE.Vector2(x, y)),
      20
    );
    g.scale(1, 1, 0.62);
    return g;
  });
const gownGeo = (len, flare) =>
  G('gown' + len + flare, () => {
    const g = new THREE.LatheGeometry(
      [
        [0.13, len],
        [0.16, len * 0.8],
        [0.22 * flare, len * 0.35],
        [0.3 * flare, 0],
        [0.0, 0],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      24
    );
    g.scale(1, 1, 0.8);
    return g;
  });

/** Arm: a shoulder pivot with upper arm, elbow pivot, forearm and hand. Angles: [forward(-)/back, out, elbow]. */
function Arm({ side, pose, colour, skin, armRef }) {
  const sh = useRef(),
    el = useRef();
  if (armRef) armRef.current = { sh, el, pose };
  return (
    <group ref={sh} position={[side * 0.2, 0, 0]} rotation={[pose[0], 0, side * pose[1]]}>
      <mesh geometry={capsule(0.048, 0.22)} material={std(colour, 0.75)} position={[0, -0.14, 0]} />
      <group ref={el} position={[0, -0.29, 0]} rotation={[pose[2], 0, 0]}>
        <mesh geometry={capsule(0.04, 0.2)} material={std(colour, 0.75)} position={[0, -0.13, 0]} />
        <mesh
          geometry={G('hand', () => new THREE.SphereGeometry(0.045, 10, 8))}
          material={std(skin, 0.6)}
          position={[0, -0.28, 0]}
          scale={[0.8, 1.1, 0.6]}
        />
      </group>
    </group>
  );
}
/** A person, facing +z. seated: hips at seat height on a chair. */
function Figure({ seated, outfit, skin, hair, armsPose, armRefs, stool = false }) {
  const hipY = seated ? (stool ? 0.66 : 0.5) : 0.95,
    shoulderY = hipY + 0.47;
  const legM = std(outfit.bottom, 0.8),
    shoe = BLACK();
  return (
    <group>
      {/* legs */}
      {seated ? (
        [-1, 1].map(s => (
          <group key={s}>
            <mesh
              geometry={capsule(0.07, 0.34)}
              material={legM}
              position={[s * 0.1, hipY, 0.2]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <mesh
              geometry={capsule(0.06, hipY - 0.12)}
              material={legM}
              position={[s * 0.1, (hipY - 0.04) / 2, 0.42]}
            />
            <mesh material={shoe} position={[s * 0.1, 0.03, 0.47]}>
              <boxGeometry args={[0.09, 0.06, 0.22]} />
            </mesh>
          </group>
        ))
      ) : outfit.woman && outfit.shirt !== null ? (
        <mesh geometry={gownGeo(hipY, 1)} material={std(outfit.bottom, 0.65)} />
      ) : (
        [-1, 1].map(s => (
          <group key={s}>
            <mesh
              geometry={capsule(0.07, hipY - 0.16)}
              material={legM}
              position={[s * 0.1, hipY / 2 + 0.02, 0]}
            />
            <mesh material={shoe} position={[s * 0.1, 0.03, 0.05]}>
              <boxGeometry args={[0.1, 0.06, 0.24]} />
            </mesh>
          </group>
        ))
      )}
      {seated && outfit.woman && outfit.shirt !== null && (
        <mesh material={std(outfit.bottom, 0.65)} position={[0, hipY - 0.02, 0.22]}>
          <boxGeometry args={[0.36, 0.1, 0.5]} />
        </mesh>
      )}
      {seated && outfit.woman && outfit.shirt !== null && (
        <mesh
          geometry={gownGeo(hipY - 0.05, 1.1)}
          material={std(outfit.bottom, 0.65)}
          position={[0, 0, 0.44]}
        />
      )}
      {/* torso */}
      <mesh geometry={torsoGeo(outfit.woman)} material={std(outfit.top, 0.72)} position={[0, hipY, 0]} />
      {outfit.shirt && !outfit.woman && (
        <mesh
          material={std(outfit.shirt, 0.6)}
          position={[0, shoulderY - 0.14, 0.1]}
          rotation={[-0.12, 0, 0]}
        >
          <planeGeometry args={[0.11, 0.24]} />
        </mesh>
      )}
      {outfit.tie && (
        <mesh material={BLACK()} position={[0, shoulderY - 0.04, 0.115]}>
          <boxGeometry args={[0.09, 0.035, 0.02]} />
        </mesh>
      )}
      {/* neck and head */}
      <mesh geometry={capsule(0.045, 0.06)} material={std(skin, 0.6)} position={[0, shoulderY + 0.07, 0]} />
      <group position={[0, shoulderY + 0.21, 0]}>
        <mesh
          geometry={G('head', () => new THREE.SphereGeometry(0.105, 20, 16))}
          material={std(skin, 0.55)}
          scale={[0.92, 1.12, 1]}
        />
        <mesh
          geometry={G(
            'hair',
            () => new THREE.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)
          )}
          material={std(hair, 0.8)}
          position={[0, 0.02, -0.012]}
          scale={[0.95, 1.12, 1.04]}
        />
        {outfit.woman && (
          <mesh geometry={capsule(0.07, 0.16)} material={std(hair, 0.8)} position={[0, -0.08, -0.07]} />
        )}
      </group>
      {/* arms */}
      <group position={[0, shoulderY - 0.02, 0]}>
        <Arm
          side={1}
          pose={armsPose.L}
          colour={outfit.woman && !outfit.shirt ? skin : outfit.top}
          skin={skin}
          armRef={armRefs?.L}
        />
        <Arm
          side={-1}
          pose={armsPose.R}
          colour={outfit.woman && !outfit.shirt ? skin : outfit.top}
          skin={skin}
          armRef={armRefs?.R}
        />
      </group>
    </group>
  );
}

// ---------- instruments ----------
/** Violin-family body outline (a figure-of-eight with waist), length L. */
const bodyGeo = (L, depth) =>
  G('vbody' + L, () => {
    const w = L * 0.58,
      s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(w * 0.62, 0, w * 0.62, L * 0.32, w * 0.36, L * 0.42);
    s.bezierCurveTo(w * 0.28, L * 0.5, w * 0.28, L * 0.55, w * 0.36, L * 0.6);
    s.bezierCurveTo(w * 0.56, L * 0.72, w * 0.5, L, 0, L);
    s.bezierCurveTo(-w * 0.5, L, -w * 0.56, L * 0.72, -w * 0.36, L * 0.6);
    s.bezierCurveTo(-w * 0.28, L * 0.55, -w * 0.28, L * 0.5, -w * 0.36, L * 0.42);
    s.bezierCurveTo(-w * 0.62, L * 0.32, -w * 0.62, 0, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.25,
      bevelSize: L * 0.012,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
function StringInstrument({ L, neck, bow = true }) {
  const depth = L * 0.12;
  return (
    <group>
      <mesh geometry={bodyGeo(L, depth)} material={WOOD()} castShadow />
      <mesh material={BLACK()} position={[0, L + neck / 2, depth * 0.35]}>
        <boxGeometry args={[L * 0.07, neck, L * 0.05]} />
      </mesh>
      <mesh material={DARKWOOD()} position={[0, L + neck + L * 0.05, depth * 0.3]}>
        <sphereGeometry args={[L * 0.045, 10, 8]} />
      </mesh>
      <mesh material={BLACK()} position={[0, L * 0.25, depth * 0.62]}>
        <boxGeometry args={[L * 0.12, L * 0.03, L * 0.02]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} material={BLACK()} position={[s * L * 0.15, L * 0.45, depth * 0.6]}>
          <boxGeometry args={[L * 0.015, L * 0.12, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}
function GrandPiano() {
  const shape = G('pianoShape', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.74, 0);
    s.lineTo(0.74, 0);
    s.lineTo(0.74, 0.55);
    s.bezierCurveTo(0.74, 1.2, 0.2, 1.1, 0.05, 1.5);
    s.bezierCurveTo(-0.15, 1.85, -0.74, 1.9, -0.74, 1.75);
    s.lineTo(-0.74, 0);
    return s;
  });
  const body = G('pianoBody', () => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
      curveSegments: 20,
    });
    g.rotateX(Math.PI / 2);
    g.translate(0, 1.0, 0);
    return g;
  });
  const lid = G('pianoLid', () => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 20 });
    g.rotateX(Math.PI / 2);
    return g;
  });
  const blackKeys = useMemo(() => {
    const out = [];
    for (let i = 0; i < 52; i++) {
      const k = i % 7;
      if (k === 2 || k === 6) continue;
      out.push(-0.72 + (i + 0.7) * 0.0277);
    }
    return out;
  }, []);
  // keyboard faces -z (towards the pianist); the case extends to +z
  return (
    <group>
      <mesh geometry={body} material={GLOSS()} castShadow position={[0, 0, 0]} rotation={[0, 0, 0]} />
      <group position={[-0.74, 1.02, 0]} rotation={[0, 0, 0.5]}>
        <mesh geometry={lid} material={GLOSS()} position={[0.74, 0, 0]} />
      </group>
      {[
        [-0.62, 0.12],
        [0.62, 0.12],
        [-0.2, 1.55],
      ].map(([x, z], i) => (
        <mesh key={i} material={GLOSS()} position={[x, 0.37, z]}>
          <cylinderGeometry args={[0.045, 0.035, 0.74, 10]} />
        </mesh>
      ))}
      <mesh material={GLOSS()} position={[0, 0.76, -0.12]}>
        <boxGeometry args={[1.5, 0.1, 0.3]} />
      </mesh>
      <mesh material={WHITE()} position={[0, 0.82, -0.17]}>
        <boxGeometry args={[1.44, 0.025, 0.15]} />
      </mesh>
      {blackKeys.map((x, i) => (
        <mesh key={i} material={BLACK()} position={[x, 0.84, -0.14]}>
          <boxGeometry args={[0.014, 0.02, 0.09]} />
        </mesh>
      ))}
      <mesh material={WHITE()} position={[0, 1.0, -0.03]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.5, 0.24, 0.01]} />
      </mesh>
    </group>
  );
}
function Harp() {
  const frame = G(
    'harpFrame',
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          [
            [0, 0.05, 0],
            [0, 1.7, 0],
            [0.25, 1.78, 0],
            [0.55, 1.62, 0],
            [0.75, 1.3, 0],
            [0.62, 0.35, 0],
            [0, 0.08, 0],
          ].map(p => new THREE.Vector3(...p)),
          true
        ),
        80,
        0.03,
        8,
        true
      )
  );
  const strings = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const x = 0.04 + i * 0.028;
        const top = 1.7 - x * 0.5;
        return { x, h: top - 0.12 - x * 0.9 };
      }),
    []
  );
  return (
    <group>
      <mesh geometry={frame} material={std('#b98a3a', 0.35, 0.6)} castShadow />
      {strings.map((s, i) => (
        <mesh key={i} material={WHITE()} position={[s.x, 0.12 + x0(s) + s.h / 2, 0]}>
          <cylinderGeometry args={[0.002, 0.002, s.h, 4]} />
        </mesh>
      ))}
    </group>
  );
}
const x0 = s => s.x * 0.9;
const Flute = () => (
  <mesh material={CHROME()} rotation={[0, 0, Math.PI / 2]}>
    <cylinderGeometry args={[0.011, 0.011, 0.66, 10]} />
  </mesh>
);
function Sax() {
  const tube = G(
    'sax',
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          [
            [0, 0.5, 0],
            [0, 0.2, 0.02],
            [0, -0.12, 0.03],
            [0.04, -0.25, 0.06],
            [0.12, -0.22, 0.1],
            [0.15, -0.05, 0.13],
          ].map(p => new THREE.Vector3(...p))
        ),
        40,
        0.028,
        10,
        false
      )
  );
  return (
    <group>
      <mesh geometry={tube} material={BRASS()} />
      <mesh material={BRASS()} position={[0.15, 0, 0.13]}>
        <cylinderGeometry args={[0.08, 0.03, 0.12, 16, 1, true]} />
      </mesh>
      <mesh material={BLACK()} position={[0, 0.55, -0.01]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.1, 8]} />
      </mesh>
    </group>
  );
}
const Trumpet = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh material={BRASS()} position={[0, 0.2, 0]}>
      <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
    </mesh>
    <mesh material={BRASS()} position={[0, 0.45, 0]}>
      <cylinderGeometry args={[0.06, 0.012, 0.12, 16, 1, true]} />
    </mesh>
    <mesh material={BRASS()} position={[0, 0.2, -0.05]}>
      <boxGeometry args={[0.05, 0.16, 0.05]} />
    </mesh>
  </group>
);
function Guitar({ bass = false, colour = '#9a1c22' }) {
  const s = G('gtrShape', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0, 0.22, 0.16, 0.13, 0.22);
    s.bezierCurveTo(0.2, 0.3, 0.14, 0.42, 0.06, 0.4);
    s.lineTo(-0.06, 0.4);
    s.bezierCurveTo(-0.15, 0.42, -0.2, 0.3, -0.13, 0.22);
    s.bezierCurveTo(-0.22, 0.16, -0.2, 0, 0, 0);
    return s;
  });
  const body = G('gtrBody', () => {
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.022);
    return g;
  });
  const neck = bass ? 0.86 : 0.62;
  return (
    <group>
      <mesh geometry={body} material={std(colour, 0.3, 0.1)} castShadow />
      <mesh material={DARKWOOD()} position={[0, 0.4 + neck / 2, 0.01]}>
        <boxGeometry args={[bass ? 0.05 : 0.045, neck, 0.025]} />
      </mesh>
      <mesh material={BLACK()} position={[0, 0.42 + neck, 0.01]}>
        <boxGeometry args={[0.07, 0.14, 0.02]} />
      </mesh>
      <mesh material={WHITE()} position={[0, 0.16, 0.03]}>
        <boxGeometry args={[0.1, 0.06, 0.005]} />
      </mesh>
    </group>
  );
}
function Drums() {
  const shell = std('#5a1a20', 0.35, 0.2),
    head = WHITE();
  const Drum = ({ r, h, p, rot = [0, 0, 0] }) => (
    <group position={p} rotation={rot}>
      <mesh material={shell}>
        <cylinderGeometry args={[r, r, h, 24]} />
      </mesh>
      <mesh material={head} position={[0, h / 2 + 0.002, 0]}>
        <cylinderGeometry args={[r * 0.98, r * 0.98, 0.004, 24]} />
      </mesh>
    </group>
  );
  const Cym = ({ p, r = 0.2 }) => (
    <group position={p}>
      <mesh material={BRASS()}>
        <cylinderGeometry args={[r, r * 0.1, 0.02, 24]} />
      </mesh>
      <mesh material={CHROME()} position={[0, -p[1] / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, p[1], 6]} />
      </mesh>
    </group>
  );
  return (
    <group>
      <Drum r={0.28} h={0.42} p={[0, 0.3, 0.18]} rot={[Math.PI / 2, 0, 0]} />
      <Drum r={0.17} h={0.14} p={[0.32, 0.62, -0.05]} />
      <Drum r={0.12} h={0.14} p={[-0.13, 0.76, 0.12]} rot={[0.3, 0, 0]} />
      <Drum r={0.13} h={0.15} p={[0.15, 0.78, 0.14]} rot={[0.3, 0, 0]} />
      <Drum r={0.2} h={0.4} p={[-0.45, 0.38, -0.05]} />
      <Cym p={[0.6, 0.98, 0.02]} r={0.18} />
      <Cym p={[-0.55, 1.3, 0.3]} r={0.24} />
      <Cym p={[0.5, 1.35, 0.35]} r={0.22} />
      <mesh material={BLACK()} position={[0, 0.25, -0.45]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
      </mesh>
    </group>
  );
}
const MicStand = ({ h = 1.52 }) => (
  <group>
    <mesh material={BLACK()} position={[0, 0.01, 0]}>
      <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
    </mesh>
    <mesh material={CHROME()} position={[0, h / 2, 0]}>
      <cylinderGeometry args={[0.01, 0.01, h, 6]} />
    </mesh>
    <mesh material={BLACK()} position={[0, h + 0.04, -0.03]} rotation={[0.6, 0, 0]}>
      <capsuleGeometry args={[0.022, 0.08, 4, 8]} />
    </mesh>
  </group>
);
const Keyboard = () => (
  <group>
    <mesh material={BLACK()} position={[0, 0.92, 0]}>
      <boxGeometry args={[1.05, 0.06, 0.3]} />
    </mesh>
    <mesh material={WHITE()} position={[0, 0.955, 0.04]}>
      <boxGeometry args={[0.98, 0.015, 0.14]} />
    </mesh>
    {[-1, 1].map(s => (
      <mesh key={s} material={CHROME()} position={[s * 0.32, 0.45, 0]} rotation={[0, 0, s * 0.4]}>
        <boxGeometry args={[0.03, 1, 0.03]} />
      </mesh>
    ))}
  </group>
);
const Chair = ({ h = 0.46 }) => (
  <group>
    <mesh material={BLACK()} position={[0, h, 0]}>
      <boxGeometry args={[0.44, 0.05, 0.42]} />
    </mesh>
    <mesh material={BLACK()} position={[0, h + 0.25, -0.2]}>
      <boxGeometry args={[0.42, 0.4, 0.04]} />
    </mesh>
    {[
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => (
      <mesh key={a + ',' + b} material={CHROME()} position={[a * 0.19, h / 2, b * 0.18]}>
        <cylinderGeometry args={[0.012, 0.012, h, 6]} />
      </mesh>
    ))}
  </group>
);
const MusicStand = () => (
  <group position={[0, 0, 0.72]}>
    <mesh material={BLACK()} position={[0, 0.42, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 0.84, 6]} />
    </mesh>
    <mesh material={BLACK()} position={[0, 0.86, 0]} rotation={[-0.6, Math.PI, 0]}>
      <boxGeometry args={[0.36, 0.25, 0.01]} />
    </mesh>
    <mesh material={WHITE()} position={[0, 0.86, -0.006]} rotation={[-0.6, Math.PI, 0]}>
      <planeGeometry args={[0.32, 0.22]} />
    </mesh>
  </group>
);

// Arm poses [forward/back, out, elbow] and the instrument placement for each part.
const PARTS = {
  violin: {
    seated: true,
    L: [-1.35, 0.5, -1.1],
    R: [-0.9, -0.35, -1.3],
    bow: 'R',
    stand: true,
    inst: (
      <group position={[0.1, 0.96, 0.18]} rotation={[-1.2, 0.5, 1.35]}>
        <StringInstrument L={0.36} neck={0.24} />
      </group>
    ),
  },
  viola: {
    seated: true,
    L: [-1.35, 0.5, -1.1],
    R: [-0.9, -0.35, -1.3],
    bow: 'R',
    stand: true,
    inst: (
      <group position={[0.1, 0.94, 0.2]} rotation={[-1.2, 0.5, 1.35]}>
        <StringInstrument L={0.41} neck={0.27} />
      </group>
    ),
  },
  cello: {
    seated: true,
    L: [-0.7, 0.35, -1.5],
    R: [-0.75, -0.45, -0.7],
    bow: 'R',
    stand: true,
    inst: (
      <group position={[0, 0.08, 0.45]} rotation={[-0.22, 0, 0.08]}>
        <StringInstrument L={0.75} neck={0.48} />
        <mesh material={CHROME()} position={[0, -0.06, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
        </mesh>
      </group>
    ),
  },
  doubleBass: {
    seated: false,
    L: [-0.9, 0.5, -1.4],
    R: [-0.55, -0.2, -0.9],
    bow: 'R',
    inst: (
      <group position={[0.28, 0.12, 0.32]} rotation={[-0.15, -0.3, 0.12]}>
        <StringInstrument L={1.1} neck={0.72} />
      </group>
    ),
  },
  flute: {
    seated: true,
    L: [-1.45, -0.15, -1.65],
    R: [-1.25, -0.8, -1.35],
    stand: true,
    inst: (
      <group position={[-0.25, 1.17, 0.2]}>
        <Flute />
      </group>
    ),
  },
  harp: {
    seated: true,
    L: [-1.05, 0.1, -0.8],
    R: [-1.05, -0.1, -0.8],
    inst: (
      <group position={[-0.12, 0, 0.42]} rotation={[0, -0.5, -0.12]}>
        <Harp />
      </group>
    ),
  },
  piano: {
    seated: true,
    bench: true,
    L: [-1.0, -0.12, -0.75],
    R: [-1.0, 0.12, -0.75],
    hands: true,
    inst: (
      <group position={[0, 0, 0.72]}>
        <GrandPiano />
      </group>
    ),
  },
  drums: {
    seated: true,
    stool: true,
    L: [-0.85, 0.2, -0.9],
    R: [-0.85, -0.2, -0.9],
    drum: true,
    inst: (
      <group position={[0, 0, 0.62]}>
        <Drums />
      </group>
    ),
  },
  saxophone: {
    seated: false,
    L: [-0.6, 0.05, -1.6],
    R: [-0.55, -0.05, -1.45],
    sway: true,
    inst: (
      <group position={[0, 0.85, 0.2]}>
        <Sax />
      </group>
    ),
  },
  trumpet: {
    seated: false,
    L: [-1.35, 0.12, -1.5],
    R: [-1.3, -0.12, -1.5],
    sway: true,
    inst: (
      <group position={[0, 1.52, 0.25]}>
        <Trumpet />
      </group>
    ),
  },
  vocals: {
    seated: false,
    L: [-0.3, 0.25, -0.5],
    R: [-0.9, -0.1, -1.2],
    sing: true,
    inst: (
      <group position={[0, 0, 0.42]}>
        <MicStand />
      </group>
    ),
  },
  electricGuitar: {
    seated: false,
    L: [-0.8, 0.6, -1.3],
    R: [-0.45, -0.25, -1.5],
    strum: true,
    inst: (
      <group position={[-0.1, 0.86, 0.17]} rotation={[0, 0, -1.05]}>
        <Guitar />
      </group>
    ),
  },
  bassGuitar: {
    seated: false,
    L: [-0.8, 0.65, -1.2],
    R: [-0.45, -0.25, -1.5],
    strum: true,
    inst: (
      <group position={[-0.1, 0.84, 0.17]} rotation={[0, 0, -1.1]}>
        <Guitar bass colour="#1d1d22" />
      </group>
    ),
  },
  keyboard: {
    seated: false,
    L: [-0.95, -0.15, -0.7],
    R: [-0.95, 0.15, -0.7],
    hands: true,
    inst: (
      <group position={[0, 0, 0.5]}>
        <Keyboard />
      </group>
    ),
  },
};

function Musician({ genre, instrument, index, armRefs }) {
  const p = PARTS[instrument];
  const outfit = outfitFor(genre, index, instrument);
  const skin = SKIN[(index * 3 + 1) % SKIN.length],
    hair = HAIR[(index * 2) % HAIR.length];
  const singerMic = instrument === 'vocals';
  return (
    <group>
      {p.seated && !p.bench && <Chair h={p.stool ? 0.62 : 0.46} />}
      {p.bench && (
        <mesh material={GLOSS()} position={[0, 0.46, 0.05]}>
          <boxGeometry args={[0.8, 0.06, 0.34]} />
        </mesh>
      )}
      <Figure
        seated={p.seated}
        stool={p.stool}
        outfit={outfit}
        skin={skin}
        hair={hair}
        armsPose={{ L: p.L, R: p.R }}
        armRefs={armRefs}
      />
      {p.inst}
      {p.stand && genre === 'classical' && <MusicStand />}
      {singerMic && null}
    </group>
  );
}
/** A whole band, as laid out by ensembleLayout, with a riser for the drums. */
export function Ensemble({ genre = 'classical', lineup }) {
  const spots = useMemo(() => ensembleLayout(genre, lineup), [genre, JSON.stringify(lineup)]);
  const rigs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rigs.current.forEach((rig, i) => {
      if (!rig) return;
      const p = PARTS[rig.instrument],
        ph = i * 1.7;
      const L = rig.L.current,
        R = rig.R.current;
      if (!L || !R || !L.sh.current || !R.sh.current) return;
      if (p.bow) {
        R.sh.current.rotation.z = -(p.R[1] + Math.sin(t * 2.2 + ph) * 0.28);
        R.el.current.rotation.x = p.R[2] + Math.sin(t * 2.2 + ph) * 0.25;
      }
      if (p.drum) {
        L.sh.current.rotation.x = p.L[0] + Math.max(0, Math.sin(t * 7 + ph)) * 0.35;
        R.sh.current.rotation.x = p.R[0] + Math.max(0, Math.sin(t * 7 + ph + Math.PI)) * 0.35;
      }
      if (p.strum) {
        R.el.current.rotation.x = p.R[2] + Math.sin(t * 6 + ph) * 0.22;
      }
      if (p.hands) {
        L.el.current.rotation.x = p.L[2] + Math.sin(t * 3 + ph) * 0.08;
        R.el.current.rotation.x = p.R[2] + Math.sin(t * 3.4 + ph) * 0.08;
      }
      if (p.sing) {
        L.sh.current.rotation.x = p.L[0] - Math.max(0, Math.sin(t * 0.9 + ph)) * 0.6;
      }
      if (rig.body.current && (p.sway || p.sing || !p.seated))
        rig.body.current.rotation.z = Math.sin(t * 1.1 + ph) * 0.035;
    });
  });
  const hasDrums = spots.some(s => s.instrument === 'drums');
  return (
    <group>
      {hasDrums && (
        <mesh material={BLACK()} position={[0, 0.15, -1.4]} receiveShadow castShadow>
          <boxGeometry args={[2.2, 0.3, 1.9]} />
        </mesh>
      )}
      {spots.map((s, i) => {
        const rig = {
          instrument: s.instrument,
          L: { current: null },
          R: { current: null },
          body: React.createRef(),
        };
        rigs.current[i] = rig;
        const lift = s.instrument === 'drums' ? 0.3 : 0;
        return (
          <group key={i} position={[s.x, lift, s.z]} rotation={[0, s.rotation, 0]}>
            <group ref={rig.body}>
              <Musician genre={genre} instrument={s.instrument} index={i} armRefs={{ L: rig.L, R: rig.R }} />
            </group>
          </group>
        );
      })}
    </group>
  );
}
export { GENRES };

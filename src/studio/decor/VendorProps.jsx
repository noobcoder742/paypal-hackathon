// 3D models for the vendor items that are not florals or music: ambient uplights, stage
// spotlight towers, a fairy-light canopy, a photo booth, a dessert table, a banquet service
// station, bubble machines and wedding cars. Procedural and light (a few hundred triangles
// each, instancing for the many small parts), so a full plan stays smooth on a laptop.
// Every model's front faces local -z... except where noted; its back sits against a wall at -z.
import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { createCache } from '../../lib/format.js';

const cached = createCache();
const M = {
  black: () =>
    cached(
      'black',
      () => new THREE.MeshStandardMaterial({ color: '#1d1c1b', roughness: 0.45, metalness: 0.4 })
    ),
  alu: () =>
    cached(
      'alu',
      () => new THREE.MeshStandardMaterial({ color: '#b9bcc0', roughness: 0.35, metalness: 0.85 })
    ),
  gold: () =>
    cached(
      'gold',
      () => new THREE.MeshStandardMaterial({ color: '#c9a96a', metalness: 0.85, roughness: 0.3 })
    ),
  silver: () =>
    cached(
      'silver',
      () => new THREE.MeshStandardMaterial({ color: '#dfe1e3', metalness: 0.9, roughness: 0.18 })
    ),
  cloth: () => cached('cloth', () => new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 0.92 })),
  cake: () => cached('cake', () => new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.6 })),
  blush: () => cached('blush', () => new THREE.MeshStandardMaterial({ color: '#e6b9b6', roughness: 0.7 })),
  sage: () => cached('sage', () => new THREE.MeshStandardMaterial({ color: '#9fb39a', roughness: 0.75 })),
  lens: () => cached('lens', () => new THREE.MeshBasicMaterial({ color: '#fff1d6' })),
  bulb: () => cached('bulb', () => new THREE.MeshBasicMaterial({ color: '#ffe2a6', toneMapped: false })),
  glass: () =>
    cached(
      'glass',
      () => new THREE.MeshStandardMaterial({ color: '#1b2229', roughness: 0.08, metalness: 0.6 })
    ),
  tyre: () => cached('tyre', () => new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.85 })),
  asphalt: () =>
    cached('asphalt', () => new THREE.MeshStandardMaterial({ color: '#3c3b3a', roughness: 0.95 })),
};
/** Soft glow that fades from a bright bottom-centre spot: the light pool an uplight throws on a wall. */
const washTexture = () =>
  cached('wash', () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 128, 2, 32, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.45, 'rgba(255,255,255,.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
const additive = (color, opacity, map) =>
  new THREE.MeshBasicMaterial({
    color,
    map: map || null,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

/** Floor uplight 0.35 m from a wall (the wall is at local -z), washing it with warm light. */
export function Uplight() {
  const wash = useMemo(() => additive('#ffb067', 0.75, washTexture()), []);
  return (
    <group>
      <mesh material={M.black()} position={[0, 0.06, 0]} rotation={[-0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.14, 16]} />
      </mesh>
      <mesh material={M.lens()} position={[0, 0.12, -0.03]} rotation={[-Math.PI / 2 - 0.35, 0, 0]}>
        <circleGeometry args={[0.065, 16]} />
      </mesh>
      <mesh material={wash} position={[0, 1.55, -0.33]}>
        <planeGeometry args={[1.5, 3.1]} />
      </mesh>
    </group>
  );
}

/** Aluminium truss tower with a moving-head light at the top, beam aimed along local -z. */
export function SpotlightTower() {
  const beam = useMemo(() => additive('#fff3dc', 0.09), []);
  const h = 3,
    s = 0.29;
  const dir = useMemo(() => new THREE.Vector3(0, -0.62, -1).normalize(), []);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir), [dir]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, h + 0.1, 0).addScaledVector(dir, 5);
    return o;
  }, [dir]);
  return (
    <group>
      <mesh material={M.black()} position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[0.6, 0.02, 0.6]} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) => (
        <mesh key={a + ',' + b} material={M.alu()} position={[(a * s) / 2, h / 2, (b * s) / 2]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, h, 8]} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[0, 0.25 + i * 0.5, 0]}>
          {[0, 1, 2, 3].map(k => (
            <mesh
              key={k}
              material={M.alu()}
              rotation={[0, (k * Math.PI) / 2, 0]}
              position={[(Math.sin((k * Math.PI) / 2) * s) / 2, 0, (Math.cos((k * Math.PI) / 2) * s) / 2]}
            >
              <boxGeometry args={[s, 0.012, 0.012]} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0, h + 0.1, 0]}>
        <mesh material={M.black()} position={[0, -0.05, 0]}>
          <boxGeometry args={[0.32, 0.06, 0.2]} />
        </mesh>
        <group quaternion={q}>
          <mesh material={M.black()} castShadow>
            <cylinderGeometry args={[0.11, 0.14, 0.34, 16]} />
          </mesh>
          <mesh material={M.lens()} position={[0, -0.172, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 16]} />
          </mesh>
          <mesh material={beam} position={[0, -2.2, 0]}>
            <cylinderGeometry args={[0.1, 0.95, 4.1, 24, 1, true]} />
          </mesh>
        </group>
      </group>
      <primitive object={target} />
      <spotLight
        position={[0, h + 0.1, 0]}
        target={target}
        angle={0.32}
        penumbra={0.6}
        intensity={18}
        distance={9}
        decay={1.6}
        color="#fff1dc"
      />
    </group>
  );
}

/** Strands of warm fairy lights radiating from a hub under the ceiling, with swags between them. */
export function FairyCanopy() {
  const ref = useRef();
  const points = useMemo(() => {
    const hub = new THREE.Vector3(0, 4.45, 0),
      out = [],
      W = 10,
      D = 14,
      n = 16,
      anchors = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a),
        k = 1 / Math.max(Math.abs(c) / (W / 2), Math.abs(s) / (D / 2));
      anchors.push(new THREE.Vector3(c * k, 4.45, s * k));
    }
    const strand = (p, q, sag, step) => {
      const len = p.distanceTo(q),
        m = Math.max(2, Math.round(len / step));
      for (let j = 1; j < m; j++) {
        const t = j / m,
          v = p.clone().lerp(q, t);
        v.y -= sag * 4 * t * (1 - t);
        out.push(v);
      }
    };
    anchors.forEach((a, i) => {
      strand(hub, a, 0.75, 0.26);
      strand(a, anchors[(i + 1) % n], 0.35, 0.26);
      out.push(a);
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    points.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <group>
      <instancedMesh ref={ref} args={[null, null, points.length]} material={M.bulb()} frustumCulled={false}>
        <sphereGeometry args={[0.024, 6, 4]} />
      </instancedMesh>
      <mesh material={M.gold()} position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.12, 16, 10]} />
      </mesh>
      <pointLight position={[0, 4, 0]} intensity={6} distance={9} decay={1.8} color="#ffd9a0" />
    </group>
  );
}

/** Sequin backdrop in a gold frame (at local -z), a camera with a ring light facing it, a props table. */
export function PhotoBooth() {
  const sequin = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e9d8c4', roughness: 0.32, metalness: 0.45 }),
    []
  );
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);
  return (
    <group>
      <group position={[0, 0, -0.9]}>
        <mesh material={sequin} position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 2.2, 0.05]} />
        </mesh>
        {[
          [-1.18, 1.18, 0.05, 2.4],
          [1.18, 1.18, 0.05, 2.4],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} material={M.gold()} position={[x, y, 0.02]}>
            <boxGeometry args={[w, h, 0.07]} />
          </mesh>
        ))}
        <mesh material={M.gold()} position={[0, 2.36, 0.02]}>
          <boxGeometry args={[2.41, 0.05, 0.07]} />
        </mesh>
        <mesh material={M.gold()} position={[0, 0.03, 0.15]}>
          <boxGeometry args={[2.5, 0.06, 0.4]} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => {
          const x = -1.05 + i * 0.16,
            y = 2.25 + Math.sin(i * 1.7) * 0.06;
          return (
            <mesh key={i} material={i % 3 ? M.blush() : M.sage()} position={[x, y, 0.06]}>
              <sphereGeometry args={[0.07 + (i % 2) * 0.025, 10, 8]} />
            </mesh>
          );
        })}
      </group>
      <group position={[0, 0, 0.85]}>
        {[0, 1, 2].map(k => {
          const a = (k * Math.PI * 2) / 3;
          return (
            <mesh
              key={k}
              material={M.black()}
              position={[Math.sin(a) * 0.18, 0.6, Math.cos(a) * 0.18]}
              rotation={[Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28]}
            >
              <cylinderGeometry args={[0.012, 0.012, 1.25, 6]} />
            </mesh>
          );
        })}
        <mesh material={M.black()} position={[0, 1.32, 0]} castShadow>
          <boxGeometry args={[0.16, 0.12, 0.12]} />
        </mesh>
        <mesh material={ring} position={[0, 1.32, -0.08]}>
          <torusGeometry args={[0.22, 0.02, 8, 32]} />
        </mesh>
      </group>
      <group position={[1.05, 0, 0.25]}>
        <mesh material={M.gold()} position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.025, 0.04, 0.8, 10]} />
        </mesh>
        <mesh material={M.cloth()} position={[0, 0.81, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.03, 24]} />
        </mesh>
        <mesh material={M.blush()} position={[-0.1, 0.87, 0]}>
          <boxGeometry args={[0.18, 0.08, 0.04]} />
        </mesh>
        <mesh material={M.gold()} position={[0.1, 0.85, 0.05]}>
          <torusGeometry args={[0.05, 0.012, 6, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function ClothTable({ w = 2.4, d = 0.75 }) {
  return (
    <group>
      <mesh material={M.cloth()} position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.76, d]} />
      </mesh>
      <mesh material={M.gold()} position={[0, 0.73, d / 2 + 0.004]}>
        <boxGeometry args={[w, 0.03, 0.006]} />
      </mesh>
    </group>
  );
}

/** Styled dessert table: a three-tier cake and gold stands of small sweets. Front faces +z. */
export function DessertTable() {
  return (
    <group>
      <ClothTable />
      <group position={[0, 0.76, 0]}>
        {
          [
            [0.27, 0.15],
            [0.2, 0.14],
            [0.13, 0.13],
          ].reduce(
            (acc, [r, h], i) => {
              const y = acc.y;
              acc.items.push(
                <mesh key={i} material={M.cake()} position={[0, y + h / 2, 0]} castShadow>
                  <cylinderGeometry args={[r, r, h, 28]} />
                </mesh>,
                <mesh
                  key={'f' + i}
                  material={i === 1 ? M.sage() : M.blush()}
                  position={[r * 0.7, y + h * 0.8, r * 0.5]}
                >
                  <sphereGeometry args={[0.045, 8, 6]} />
                </mesh>
              );
              acc.y += h;
              return acc;
            },
            { y: 0, items: [] }
          ).items
        }
        {[-0.78, 0.78].map(x => (
          <group key={x} position={[x, 0, 0]}>
            <mesh material={M.gold()} position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.02, 0.07, 0.26, 12]} />
            </mesh>
            <mesh material={M.gold()} position={[0, 0.27, 0]}>
              <cylinderGeometry args={[0.2, 0.18, 0.02, 24]} />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => {
              const a = (i / 7) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  material={i % 2 ? M.blush() : M.cake()}
                  position={[Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12]}
                >
                  <sphereGeometry args={[0.035, 8, 6]} />
                </mesh>
              );
            })}
          </group>
        ))}
        {[-0.45, -0.3, 0.3, 0.45].map((x, i) => (
          <mesh key={i} material={M.cake()} position={[x, 0.06, 0.2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Hotel banquet service station: chafing dishes and plates. Front faces +z. */
export function ServiceStation() {
  return (
    <group>
      <ClothTable />
      <group position={[0, 0.76, 0]}>
        {[-0.75, 0, 0.75].map(x => (
          <group key={x} position={[x, 0, 0]}>
            <mesh material={M.silver()} position={[0, 0.09, 0]} castShadow>
              <boxGeometry args={[0.56, 0.14, 0.36]} />
            </mesh>
            <mesh
              material={M.silver()}
              position={[0, 0.16, 0]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[1, 1, 0.62]}
            >
              <cylinderGeometry args={[0.28, 0.28, 0.54, 20, 1, false, 0, Math.PI]} />
            </mesh>
            <mesh material={M.black()} position={[0, 0.45, 0]}>
              <boxGeometry args={[0.1, 0.02, 0.03]} />
            </mesh>
          </group>
        ))}
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} material={M.cake()} position={[1.08, 0.01 + i * 0.012, 0.18]}>
            <cylinderGeometry args={[0.13, 0.11, 0.01, 24]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Bubble machine on a stand, with bubbles drifting up and away. */
export function BubbleMachine() {
  const ref = useRef();
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.28,
        roughness: 0,
        metalness: 0.1,
        iridescence: 1,
        iridescenceIOR: 1.35,
        depthWrite: false,
      }),
    []
  );
  const bubbles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        o: i / 36,
        r: 0.025 + ((i * 7) % 5) * 0.008,
        a: i * 2.39,
        spd: 0.12 + ((i * 13) % 7) * 0.02,
        reach: 0.6 + ((i * 5) % 9) * 0.18,
      })),
    []
  );
  const m = useMemo(() => new THREE.Matrix4(), []),
    v = useMemo(() => new THREE.Vector3(), []),
    s = useMemo(() => new THREE.Vector3(), []),
    q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    bubbles.forEach((b, i) => {
      const k = (t * b.spd + b.o) % 1;
      v.set(
        Math.cos(b.a) * b.reach * k + Math.sin(t + i) * 0.05,
        0.75 + k * 2.4,
        Math.sin(b.a) * b.reach * k
      );
      s.setScalar(b.r * (k < 0.9 ? 1 : (1 - k) * 10));
      m.compose(v, q, s);
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh material={M.gold()} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.025, 0.12, 0.6, 12]} />
      </mesh>
      <RoundedBox args={[0.3, 0.22, 0.3]} radius={0.04} position={[0, 0.71, 0]}>
        <meshStandardMaterial color="#f3eee8" roughness={0.5} />
      </RoundedBox>
      <mesh material={M.black()} position={[0, 0.71, -0.152]}>
        <circleGeometry args={[0.07, 16]} />
      </mesh>
      <instancedMesh ref={ref} args={[null, null, bubbles.length]} material={mat} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 8]} />
      </instancedMesh>
    </group>
  );
}

/** A wedding car on the driveway outside the entrance, ribbon on the bonnet. Length along local z, nose at -z. */
export function WeddingCar({ model = 'sedan' }) {
  const classic = model === 'classic';
  const paint = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: classic ? '#efe5d0' : '#141517',
        metalness: 0.5,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    [classic]
  );
  const ribbon = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), []);
  const wheelZ = classic ? [-1.45, 1.5] : [-1.5, 1.45],
    len = classic ? 4.4 : 4.8;
  return (
    <group>
      <mesh material={M.asphalt()} position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.26, 6.6]} />
      </mesh>
      <group position={[0, 0, 0]}>
        <RoundedBox
          args={[1.82, classic ? 0.55 : 0.62, len]}
          radius={0.16}
          smoothness={3}
          position={[0, 0.62, 0]}
          material={paint}
          castShadow
        />
        {classic ? (
          <>
            <RoundedBox
              args={[1.5, 0.62, 1.7]}
              radius={0.12}
              position={[0, 1.18, 0.75]}
              material={M.glass()}
              castShadow
            />
            <RoundedBox args={[1.56, 0.08, 1.8]} radius={0.03} position={[0, 1.5, 0.75]}>
              <meshStandardMaterial color="#1e1b18" roughness={0.6} />
            </RoundedBox>
            {wheelZ.flatMap(z =>
              [-1, 1].map(sx => (
                <mesh
                  key={z + ',' + sx}
                  material={paint}
                  position={[sx * 0.9, 0.66, z]}
                  rotation={[0, 0, Math.PI / 2]}
                  scale={[1, 1, 1]}
                >
                  <cylinderGeometry args={[0.45, 0.45, 0.34, 20, 1, false, 0, Math.PI]} />
                </mesh>
              ))
            )}
            <mesh material={M.silver()} position={[0, 0.72, -len / 2 - 0.01]}>
              <boxGeometry args={[0.6, 0.4, 0.04]} />
            </mesh>
            {[-1, 1].map(sx => (
              <mesh key={sx} material={M.silver()} position={[sx * 0.98, 0.32, 0]}>
                <boxGeometry args={[0.2, 0.04, 2]} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            <RoundedBox
              args={[1.62, 0.56, 2.5]}
              radius={0.2}
              smoothness={3}
              position={[0, 1.18, 0.25]}
              material={M.glass()}
              castShadow
            />
            <RoundedBox args={[1.5, 0.06, 1.9]} radius={0.03} position={[0, 1.47, 0.3]} material={paint} />
          </>
        )}
        {wheelZ.flatMap(z =>
          [-1, 1].map(sx => (
            <group key={'w' + z + sx} position={[sx * 0.86, 0.34, z]}>
              <mesh material={M.tyre()} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.34, 0.34, 0.24, 24]} />
              </mesh>
              <mesh
                material={classic ? M.cake() : M.silver()}
                position={[sx * 0.125, 0, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[classic ? 0.24 : 0.2, classic ? 0.24 : 0.2, 0.01, 20]} />
              </mesh>
            </group>
          ))
        )}
        {[-1, 1].map(sx => (
          <mesh key={'h' + sx} material={M.lens()} position={[sx * 0.62, 0.7, -len / 2 - 0.005]}>
            <circleGeometry args={[0.1, 16]} />
          </mesh>
        ))}
        {/* white ribbon from the bonnet's front corners to a bow under the windscreen */}
        {[-1, 1].map(sx => (
          <mesh
            key={'r' + sx}
            material={ribbon}
            position={[sx * 0.42, classic ? 0.92 : 0.95, -len / 2 + 0.75]}
            rotation={[0, sx * 0.5, 0]}
          >
            <boxGeometry args={[0.06, 0.012, 1.5]} />
          </mesh>
        ))}
        <group position={[0, classic ? 0.96 : 0.99, -len / 2 + 1.45]}>
          {[-1, 1].map(sx => (
            <mesh key={sx} material={ribbon} position={[sx * 0.1, 0, 0]} scale={[1.3, 0.5, 1]}>
              <sphereGeometry args={[0.08, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

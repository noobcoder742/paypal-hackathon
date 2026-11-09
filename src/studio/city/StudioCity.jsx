// The surrounding city in the design studio, drawn with exactly the same
// layers as the venue map (explorer/VenueExplorer.jsx › CityLayers): same
// tiles, colours, Orchard detail, hotel details, name tags and 6:20pm light.
//
// The studio puts the ballroom at the origin. In map coordinates the ballroom
// sits at the venue's first map point, so the city is shifted by that offset.
// The hotel itself is drawn see-through so the room stays visible inside it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CityLayers, loadIndex, VENUE_GEO, Pins, SUN } from '../../explorer/VenueExplorer.jsx';
import { EveningLight, SKY } from '../../explorer/look/EveningLight.jsx';
import { useSettings } from '../../data/settings.js';

export function StudioCity({
  venueId = 'orchard-grand',
  spaceId = 'room',
  showFrom = 60,
  onOpenVenue,
  onReady,
}) {
  const { camera, scene } = useThree();
  const [index, setIndex] = useState(null),
    [active, setActive] = useState(false),
    [mounted, setMounted] = useState(false);
  const [{ mapQuality }] = useSettings();
  useEffect(() => {
    let live = true;
    loadIndex().then(i => {
      if (live && i) {
        setIndex(i);
        onReady?.(i);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  const [ox, oz] = VENUE_GEO[venueId]?.points[0] || [0, 0];
  const mapRig = useRef({ cur: { tx: ox, tz: oz, r: 400 } }),
    worldRig = useRef({ cur: { tx: 0, tz: 0, r: 400 } });
  const dir = useMemo(() => new THREE.Vector3(), []),
    hit = useMemo(() => new THREE.Vector3(), []),
    activeRef = useRef(false);
  useFrame(() => {
    const on = camera.position.length() > showFrom;
    if (on !== activeRef.current) {
      activeRef.current = on;
      setActive(on);
      if (on) setMounted(true);
    }
    // the ground point the camera is looking at drives tile loading and the sun's shadows
    camera.getWorldDirection(dir);
    const t = dir.y < -0.05 ? -camera.position.y / dir.y : camera.position.length();
    hit.copy(camera.position).addScaledVector(dir, Math.min(t, 6000));
    const r = camera.position.distanceTo(hit);
    Object.assign(worldRig.current.cur, { tx: hit.x, tz: hit.z, r });
    Object.assign(mapRig.current.cur, { tx: hit.x + ox, tz: hit.z + oz, r });
  });
  // Outside the room the sky and haze match the venue map.
  // Lighting matches too: while the city is in view, the ballroom's indoor
  // lights are dimmed and its reflection map / exposure boost switched off,
  // so the city is lit only like the venue map (6:20pm sun and sky).
  const { gl } = useThree();
  useEffect(() => {
    if (!active) return;
    const prevFog = scene.fog?.color.clone(),
      prevEnv = scene.environment,
      prevExp = gl.toneMappingExposure,
      dimmed = [];
    scene.fog?.color.set(SKY.horizon);
    scene.environment = null;
    gl.toneMappingExposure = 1;
    scene.traverse(o => {
      if (!o.isLight) return;
      let p = o;
      while (p) {
        if (p.userData?.cityLight) return;
        p = p.parent;
      }
      dimmed.push([o, o.intensity]);
      o.intensity *= 0.15;
    });
    return () => {
      if (prevFog) scene.fog.color.copy(prevFog);
      scene.environment = prevEnv;
      gl.toneMappingExposure = prevExp;
      dimmed.forEach(([o, i]) => {
        o.intensity = i;
      });
    };
  }, [active, scene, gl]);
  const focus = useMemo(() => ({ venueId, spaceId }), [venueId, spaceId]);
  if (!index || !mounted) return null;
  return (
    <>
      {active && (
        <group userData={{ cityLight: true }}>
          <EveningLight sun={SUN} rigRef={worldRig} />
        </group>
      )}
      <group position={[-ox, 0, -oz]} visible={active}>
        <CityLayers index={index} rigRef={mapRig} focus={focus} details={mapQuality !== 'saver'} />
        {active && <Pins focus={{}} heights={{}} onSelect={id => onOpenVenue?.(id)} filter="all" />}
      </group>
    </>
  );
}

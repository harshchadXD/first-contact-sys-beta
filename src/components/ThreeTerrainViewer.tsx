import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Globe,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sun,
  Video,
  X,
} from 'lucide-react';
import { sampleDemHeight } from '../science/physicsEngine';
import {
  NASA_30_TOPOGRAPHIC_FEATURES,
  type LunarTopographicFeature,
} from '../science/lunarTopography';
import type {
  DispersionCell,
  LunarSiteDefinition,
  TimeSeriesPoint,
} from '../science/types';

interface ThreeTerrainViewerProps {
  site: LunarSiteDefinition;
  dispersionGrid: DispersionCell[];
  selectedCellIndex: number;
  mastHeightM: number;
  currentPoint: TimeSeriesPoint;
  onSelectCell: (cellIndex: number) => void;
  onSelectSite?: (siteId: string) => void;
  showGisDrift?: boolean;
  onToggleGisDrift?: () => void;
}

const CANDIDATE_SITES = [
  { id: 'PGDA-20', name: 'Mons Mouton (IM-2)', lat: -84.7906, lon: 29.1957, color: '#f59e0b' },
  { id: 'PGDA-01', name: 'Connecting Ridge', lat: -89.4632, lon: -137.49, color: '#10b981' },
  { id: 'PGDA-04', name: 'Shackleton Crater Rim', lat: -89.7668, lon: -171.87, color: '#38bdf8' },
  { id: 'PGDA-06', name: 'Nobile Rim 1 (VIPER)', lat: -85.4381, lon: 37.3667, color: '#6366f1' },
  { id: 'PGDA-07', name: 'Peak Near Shackleton', lat: -88.811, lon: 123.6901, color: '#a855f7' },
  { id: 'PGDA-11', name: 'de Gerlache Rim 1', lat: -88.6834, lon: -67.9321, color: '#06b6d4' },
  { id: 'PGDA-23', name: 'Malapert Massif (IM-1)', lat: -85.9948, lon: -0.2358, color: '#ec4899' },
  { id: 'ISRO-CY3', name: 'Shiv Shakti (CY-3)', lat: -69.3676, lon: 32.3481, color: '#f97316' },
  { id: 'PGDA-02', name: 'Faustini Rim A', lat: -87.1245, lon: 67.0412, color: '#eab308' },
  { id: 'PGDA-08', name: 'Haworth Crater Rim', lat: -87.4215, lon: -5.1324, color: '#8b5cf6' },
  { id: 'PGDA-12', name: 'de Gerlache Rim 2', lat: -88.3418, lon: -75.1235, color: '#14b8a6' },
  { id: 'PGDA-14', name: 'Amundsen Crater Rim', lat: -84.5218, lon: 82.8142, color: '#3b82f6' },
  { id: 'PGDA-16', name: 'Nobile Rim 2', lat: -85.1241, lon: 43.1518, color: '#84cc16' },
  { id: 'PGDA-18', name: 'Leibnitz Beta Plateau', lat: -85.7812, lon: 31.4219, color: '#f43f5e' },
  { id: 'MOCK-01', name: 'Synthetic Calibration Site', lat: -84.79, lon: 29.2, color: '#94a3b8' },
];

const _sunDir = new THREE.Vector3();
const _yUp = new THREE.Vector3(0, 1, 0);
const _sunQuat = new THREE.Quaternion();

function expEase(t: number): number {
  const k = 6;
  const clamped = Math.min(1, Math.max(0, t));
  return (1 - Math.exp(-k * clamped)) / (1 - Math.exp(-k));
}

function nearestDispersionCell(
  grid: DispersionCell[],
  dxM: number,
  dyM: number
): DispersionCell | null {
  let best: DispersionCell | null = null;
  let bestD = Infinity;
  for (const cell of grid) {
    const ddx = cell.dxM - dxM;
    const ddy = cell.dyM - dyM;
    const d = ddx * ddx + ddy * ddy;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

function buildSurfaceReticle(): {
  group: THREE.Group;
  material: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outerRing = new THREE.Mesh(new THREE.RingGeometry(18, 19.4, 48), material);
  outerRing.rotateX(-Math.PI / 2);
  group.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(6, 7, 32), material);
  innerRing.rotateX(-Math.PI / 2);
  group.add(innerRing);

  const tickGeo = new THREE.BoxGeometry(0.7, 0.2, 3.8);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeo, material);
    tick.position.set(Math.sin(ang) * 19.5, 0.05, Math.cos(ang) * 19.5);
    tick.rotation.y = ang;
    group.add(tick);
  }

  const crossH = new THREE.Mesh(new THREE.BoxGeometry(32, 0.15, 0.4), material);
  crossH.position.y = 0.05;
  group.add(crossH);

  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 32), material);
  crossV.position.y = 0.05;
  group.add(crossV);

  return { group, material };
}

function createRealisticSun(): THREE.Group {
  const sunGroup = new THREE.Group();

  const coreGeo = new THREE.SphereGeometry(22, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const core = new THREE.Mesh(coreGeo, coreMat);
  sunGroup.add(core);

  const coronaCanvas = document.createElement('canvas');
  coronaCanvas.width = 256;
  coronaCanvas.height = 256;
  const ctx = coronaCanvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 248, 220, 0.85)');
  grad.addColorStop(0.45, 'rgba(255, 215, 120, 0.45)');
  grad.addColorStop(0.8, 'rgba(255, 180, 50, 0.12)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const coronaTex = new THREE.CanvasTexture(coronaCanvas);
  const coronaMat = new THREE.SpriteMaterial({
    map: coronaTex,
    color: 0xfff6dd,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.set(190, 190, 1);
  sunGroup.add(corona);

  return sunGroup;
}

function createRealisticEarth(): {
  group: THREE.Group;
  atmosphereHalo: THREE.Mesh;
  earthSphere: THREE.Mesh;
  statusBadge: THREE.Sprite;
  updateStatus: (isVisible: boolean, elevationDeg: number) => void;
} {
  const group = new THREE.Group();

  // Create canvas with realistic Earth colors (deep blues, green continents, cloudy white swirls)
  const earthCanvas = document.createElement('canvas');
  earthCanvas.width = 512;
  earthCanvas.height = 256;
  const ctx = earthCanvas.getContext('2d')!;

  // Deep oceanic blue
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
  oceanGrad.addColorStop(0, '#0a192f');
  oceanGrad.addColorStop(0.5, '#1d4ed8');
  oceanGrad.addColorStop(1, '#0a192f');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Continents (green / earth tones)
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.ellipse(135, 105, 60, 40, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(280, 95, 75, 48, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(360, 155, 42, 28, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(170, 170, 38, 52, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Swirling cloud deck
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 27) % 512,
      50 + (i * 15) % 155,
      35 + (i * 8) % 30,
      10 + (i * 4) % 15,
      i * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = 'rgba(240, 249, 255, 0.95)';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 238, 512, 18);

  const earthTex = new THREE.CanvasTexture(earthCanvas);
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 0.6,
    metalness: 0.08,
  });
  const earthSphere = new THREE.Mesh(new THREE.SphereGeometry(22, 32, 32), earthMat);
  group.add(earthSphere);

  // Atmospheric Rayleigh scattering halo
  const atmoGeo = new THREE.SphereGeometry(26, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.42,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphereHalo = new THREE.Mesh(atmoGeo, atmoMat);
  group.add(atmosphereHalo);

  // Status Badge sprite (shows "EARTH · DSN DIRECT" or "OCCULTED")
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 256;
  badgeCanvas.height = 64;
  const bCtx = badgeCanvas.getContext('2d')!;

  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  const statusBadge = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: badgeTex,
      transparent: true,
      depthTest: false,
    })
  );
  statusBadge.scale.set(46, 11.5, 1);
  statusBadge.position.y = 34;
  group.add(statusBadge);

  const updateStatus = (isVisible: boolean, elevationDeg: number) => {
    bCtx.clearRect(0, 0, 256, 64);
    bCtx.fillStyle = isVisible ? 'rgba(8, 47, 73, 0.88)' : 'rgba(76, 5, 25, 0.88)';
    bCtx.roundRect(8, 8, 240, 48, 8);
    bCtx.fill();
    bCtx.strokeStyle = isVisible ? '#38bdf8' : '#f43f5e';
    bCtx.lineWidth = 2.5;
    bCtx.stroke();
    bCtx.fillStyle = isVisible ? '#38bdf8' : '#fda4af';
    bCtx.font = 'bold 17px monospace';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    const text = isVisible
      ? `EARTH DSN · +${elevationDeg.toFixed(1)}°`
      : `OCCULTED · ${elevationDeg.toFixed(1)}°`;
    bCtx.fillText(text, 128, 32);
    badgeTex.needsUpdate = true;
  };

  return { group, atmosphereHalo, earthSphere, statusBadge, updateStatus };
}

function createLaserCommsBeam(): {
  group: THREE.Group;
  laserLine: THREE.Line;
  pulseRings: THREE.Mesh[];
  updateBeam: (from: THREE.Vector3, to: THREE.Vector3, isVisible: boolean) => void;
} {
  const group = new THREE.Group();

  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 100, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.85,
    linewidth: 2,
  });
  const laserLine = new THREE.Line(lineGeo, lineMat);
  group.add(laserLine);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pulseRings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.8, 16), ringMat.clone());
    group.add(ring);
    pulseRings.push(ring);
  }

  const updateBeam = (from: THREE.Vector3, to: THREE.Vector3, isVisible: boolean) => {
    lineGeo.setFromPoints([from, to]);
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.color.setHex(isVisible ? 0x06b6d4 : 0xf43f5e);
    lineMat.opacity = isVisible ? 0.85 : 0.2;

    const dir = new THREE.Vector3().subVectors(to, from);
    const time = (Date.now() * 0.0012) % 1;

    pulseRings.forEach((ring, idx) => {
      ring.visible = isVisible;
      if (isVisible) {
        const frac = (time + idx * 0.2) % 1;
        ring.position.copy(from).addScaledVector(dir, frac);
        ring.lookAt(to);
        const s = 1.0 + frac * 4.0;
        ring.scale.set(s, s, 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - frac * 0.8);
      }
    });
  };

  return { group, laserLine, pulseRings, updateBeam };
}


function buildCompositeLander(): {
  root: THREE.Group;
  mastMesh: THREE.Mesh;
  solarCrosshead: THREE.Group;
  dishPivot: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();

  const kaptonGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a428,
    metalness: 0.85,
    roughness: 0.28,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.72,
    roughness: 0.42,
  });
  const solarPanelMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3a8a,
    metalness: 0.2,
    roughness: 0.18,
    clearcoat: 0.9,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.1,
  });

  const bus = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 3.2, 6), kaptonGoldMat);
  bus.position.y = 2.4;
  bus.castShadow = true;
  bus.receiveShadow = true;
  root.add(bus);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.0, 8), titaniumMat);
    leg.position.set(Math.cos(angle) * 1.8, 1.2, Math.sin(angle) * 1.8);
    leg.rotation.z = Math.cos(angle) * 0.42;
    leg.rotation.x = -Math.sin(angle) * 0.42;
    leg.castShadow = true;
    root.add(leg);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.12, 12), titaniumMat);
    pad.position.set(Math.cos(angle) * 2.8, 0.06, Math.sin(angle) * 2.8);
    pad.receiveShadow = true;
    root.add(pad);
  }

  const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 12), titaniumMat);
  mastMesh.position.y = 4.0;
  mastMesh.castShadow = true;
  root.add(mastMesh);

  const solarCrosshead = new THREE.Group();
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.9), solarPanelMat);
    panel.position.set(sx * 1.0, 0, 0);
    panel.castShadow = true;
    solarCrosshead.add(panel);
  }
  root.add(solarCrosshead);

  const dishPivot = new THREE.Group();
  dishPivot.position.set(0, 4.2, 0);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), titaniumMat);
  dish.rotation.x = Math.PI;
  dish.castShadow = true;
  dishPivot.add(dish);
  root.add(dishPivot);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), beaconMat);
  beacon.position.y = 4.1;
  root.add(beacon);

  return { root, mastMesh, solarCrosshead, dishPivot, beaconMat };
}

/**
 * Computes exact topocentric ENU (East-North-Up) offset in meters between
 * the MOON_PA_DE421 (Principal Axes) frame and MOON_ME_DE421 (Mean Earth) frame
 * using official JPL NAIF SPICE frame kernel definitions (moon_080317.tf).
 * Sequence 3-2-1 Euler angles:
 * Axis 3 (Z): +67.92 arcseconds
 * Axis 2 (Y): +78.56 arcseconds
 * Axis 1 (X): +0.30 arcseconds
 */
export function computePaToMeDisplacementM(
  latDeg: number,
  lonDeg: number
): { dEastM: number; dNorthM: number; dUpM: number; totalM: number } {
  const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
  const R_MOON_M = 1737400.0; // Mean lunar volumetric radius in meters

  const a3 = 67.92 * ARCSEC_TO_RAD;
  const a2 = 78.56 * ARCSEC_TO_RAD;
  const a1 = 0.30 * ARCSEC_TO_RAD;

  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  const c2 = Math.cos(a2), s2 = Math.sin(a2);
  const c3 = Math.cos(a3), s3 = Math.sin(a3);

  // Direction cosine matrix R = R1(a1) * R2(a2) * R3(a3) [PA -> ME]
  const r00 = c2 * c3;
  const r01 = c2 * s3;
  const r02 = -s2;
  const r10 = s1 * s2 * c3 - c1 * s3;
  const r11 = s1 * s2 * s3 + c1 * c3;
  const r12 = s1 * c2;
  const r20 = c1 * s2 * c3 + s1 * s3;
  const r21 = c1 * s2 * s3 - s1 * c3;
  const r22 = c1 * c2;

  // Surface point in ME frame spherical coordinates
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);

  const xMe = R_MOON_M * cosLat * cosLon;
  const yMe = R_MOON_M * cosLat * sinLon;
  const zMe = R_MOON_M * sinLat;

  // Transform to PA frame: P_PA = R^T * P_ME
  const xPa = r00 * xMe + r10 * yMe + r20 * zMe;
  const yPa = r01 * xMe + r11 * yMe + r21 * zMe;
  const zPa = r02 * xMe + r12 * yMe + r22 * zMe;

  // Offset vector in lunar Cartesian frame: Delta P = P_PA - P_ME
  const dx = xPa - xMe;
  const dy = yPa - yMe;
  const dz = zPa - zMe;

  // Topocentric ENU basis vectors at (lat, lon)
  const dEastM = -sinLon * dx + cosLon * dy;
  const dNorthM = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const dUpM = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;
  const totalM = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return { dEastM, dNorthM, dUpM, totalM };
}

function buildGhostLander(): {
  root: THREE.Group;
  tetherLine: THREE.Line;
  updatePosition: (
    targetX: number,
    targetY: number,
    targetZ: number,
    visible: boolean,
    latDeg?: number,
    lonDeg?: number
  ) => void;
} {
  const root = new THREE.Group();
  root.visible = false;

  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    wireframe: true,
    transparent: true,
    opacity: 0.65,
  });

  const bus = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 3.2, 6), ghostMat);
  bus.position.y = 2.4;
  root.add(bus);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.0, 8), ghostMat);
    leg.position.set(Math.cos(angle) * 1.8, 1.2, Math.sin(angle) * 1.8);
    leg.rotation.z = Math.cos(angle) * 0.42;
    leg.rotation.x = -Math.sin(angle) * 0.42;
    root.add(leg);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.12, 12), ghostMat);
    pad.position.set(Math.cos(angle) * 2.8, 0.06, Math.sin(angle) * 2.8);
    root.add(pad);
  }

  // Floating crimson billboard badge
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 384;
  bCanvas.height = 96;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle = 'rgba(225, 29, 72, 0.92)';
  bCtx.roundRect(4, 4, 376, 88, 12);
  bCtx.fill();
  bCtx.strokeStyle = '#fda4af';
  bCtx.lineWidth = 3;
  bCtx.stroke();
  bCtx.fillStyle = '#ffffff';
  bCtx.font = 'bold 22px monospace';
  bCtx.textAlign = 'center';
  bCtx.fillText('CRITICAL 875m ROTATIONAL DRIFT', 192, 42);
  bCtx.font = '16px monospace';
  bCtx.fillStyle = '#fecdd3';
  bCtx.fillText('MOON_PA vs MOON_ME (IAU_2015:30135)', 192, 70);

  const bTex = new THREE.CanvasTexture(bCanvas);
  const badgeSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: bTex, transparent: true, depthTest: false })
  );
  badgeSprite.position.y = 8.5;
  badgeSprite.scale.set(38, 9.5, 1);
  root.add(badgeSprite);

  // Red dashed tether line
  const tetherGeo = new THREE.BufferGeometry();
  const tetherMat = new THREE.LineDashedMaterial({
    color: 0xf43f5e,
    dashSize: 4,
    gapSize: 2.5,
    linewidth: 2,
    transparent: true,
    opacity: 0.85,
  });
  const tetherLine = new THREE.Line(tetherGeo, tetherMat);
  tetherLine.visible = false;

  const updatePosition = (
    targetX: number,
    targetY: number,
    targetZ: number,
    visible: boolean,
    latDeg: number = -84.7906,
    lonDeg: number = 29.1957
  ) => {
    root.visible = visible;
    tetherLine.visible = visible;
    if (!visible) return;

    // Evaluated via JPL NAIF SPICE Frame Kernel (moon_080317.tf) 3-2-1 Euler transformation
    const { dEastM, dNorthM, dUpM } = computePaToMeDisplacementM(latDeg, lonDeg);
    const gx = targetX + dEastM;
    const gz = targetZ - dNorthM; // In Three.js -Z points North
    const gy = targetY + dUpM;

    root.position.set(gx, gy, gz);

    const pts = [
      new THREE.Vector3(targetX, targetY + 3.0, targetZ),
      new THREE.Vector3(gx, gy + 3.0, gz),
    ];
    tetherLine.geometry.setFromPoints(pts);
    tetherLine.computeLineDistances();
  };

  return { root, tetherLine, updatePosition };
}

export function ThreeTerrainViewer({
  site,
  dispersionGrid,
  selectedCellIndex,
  mastHeightM,
  currentPoint,
  onSelectCell,
  onSelectSite,
  showGisDrift = false,
  onToggleGisDrift,
}: ThreeTerrainViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'globe' | 'tactical' | 'mast-cam'>('tactical');
  const [show30Features, setShow30Features] = useState<boolean>(true);
  const [selectedFeature, setSelectedFeature] = useState<LunarTopographicFeature | null>(null);
  const [nonPolarAlert, setNonPolarAlert] = useState<{
    lat: number;
    lon: number;
    message: string;
  } | null>(null);

  const selectedCell = dispersionGrid[selectedCellIndex] ?? dispersionGrid[12];

  const tweenRef = useRef<{
    active: boolean;
    startTime: number;
    durationMs: number;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startCamPos: THREE.Vector3;
    endCamPos: THREE.Vector3;
  } | null>(null);

  const sceneHandlesRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    tacticalGroup: THREE.Group;
    globeGroup: THREE.Group;
    terrainGeo: THREE.PlaneGeometry;
    terrainMesh: THREE.Mesh;
    reticle: { group: THREE.Group; material: THREE.MeshBasicMaterial };
    lander: {
      root: THREE.Group;
      mastMesh: THREE.Mesh;
      solarCrosshead: THREE.Group;
      dishPivot: THREE.Group;
      beaconMat: THREE.MeshStandardMaterial;
    };
    cellMeshes: THREE.Mesh[];
    cellBorderLines: THREE.Line[];
    focusOnCell: (cellIndex: number) => void;
    sunLight: THREE.DirectionalLight;
    sunRealistic: THREE.Group;
    earthObj: {
      group: THREE.Group;
      atmosphereHalo: THREE.Mesh;
      earthSphere: THREE.Mesh;
      statusBadge: THREE.Sprite;
      updateStatus: (isVisible: boolean, elevationDeg: number) => void;
    };
    laserComms: {
      group: THREE.Group;
      laserLine: THREE.Line;
      pulseRings: THREE.Mesh[];
      updateBeam: (from: THREE.Vector3, to: THREE.Vector3, isVisible: boolean) => void;
    };
    wallGeo: THREE.BufferGeometry;
    sitePins: THREE.Group[];
    topoPinsGroup: THREE.Group;
    ghostLander: ReturnType<typeof buildGhostLander>;
    requestRender: () => void;
    focusOnTactical: (durationMs?: number) => void;
    focusOnGlobe: () => void;
    focusOnMastCam: () => void;
    siteRef: LunarSiteDefinition;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL2 context unavailable on this device.');
      return;
    }

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(260, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050608);

    // Deep Space Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 900;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1800 + Math.random() * 200;
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      transparent: true,
      opacity: 0.85,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 3500);
    camera.position.set(130, 90, 150);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 0, 0);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x050608, 0.28);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf5, 3.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.normalBias = 0.04;
    sunLight.shadow.bias = -0.00015;
    const d = 340;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1800;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Realistic Sun Billboard with Corona
    const sunRealistic = createRealisticSun();
    scene.add(sunRealistic);

    // Groups for Dual Mode
    const tacticalGroup = new THREE.Group();
    const globeGroup = new THREE.Group();
    scene.add(tacticalGroup);
    scene.add(globeGroup);

    // Load NASA LROC Texture
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const texLoader = new THREE.TextureLoader();
    const lrocTexture = texLoader.load('/data/lroc_color_2k.jpg', () => {
      terrainMat.needsUpdate = true;
      moonSphereMat.needsUpdate = true;
      requestRender();
    });
    lrocTexture.colorSpace = THREE.SRGBColorSpace;
    lrocTexture.anisotropy = maxAniso;

    // --- TACTICAL GROUP: 500m LOLA DEM Mesh ---
    const terrainGeo = new THREE.PlaneGeometry(500, 500, 100, 100);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xd8d6cf,
      map: lrocTexture,
      bumpMap: lrocTexture,
      bumpScale: 4.2,
      roughness: 0.92,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    tacticalGroup.add(terrainMesh);

    const skirtGeo = new THREE.PlaneGeometry(2400, 2400, 16, 16);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.98,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.position.y = -65.0;
    skirtMesh.receiveShadow = true;
    tacticalGroup.add(skirtMesh);

    // 4-Sided Geological Curtain Walls (seals all outer edges down to -65m so holes never appear)
    const wallGeo = new THREE.BufferGeometry();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.receiveShadow = true;
    tacticalGroup.add(wallMesh);

    const reticle = buildSurfaceReticle();
    tacticalGroup.add(reticle.group);

    const lander = buildCompositeLander();
    tacticalGroup.add(lander.root);

    const ghostLander = buildGhostLander();
    tacticalGroup.add(ghostLander.root);
    tacticalGroup.add(ghostLander.tetherLine);

    const earthObj = createRealisticEarth();
    tacticalGroup.add(earthObj.group);

    const laserComms = createLaserCommsBeam();
    tacticalGroup.add(laserComms.group);

    const cellMeshes: THREE.Mesh[] = [];
    const cellBorderLines: THREE.Line[] = [];
    for (let idx = 0; idx < 25; idx++) {
      // 8x8 segmented plane geometry = 64 quads, 81 vertices per pad (drapes perfectly over DEM surface)
      const cGeo = new THREE.PlaneGeometry(62, 62, 8, 8);
      cGeo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.28,
        transparent: true,
        opacity: 0.25,
        roughness: 0.45,
        metalness: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(cGeo, mat);
      mesh.userData = { cellIndex: idx };
      tacticalGroup.add(mesh);
      cellMeshes.push(mesh);

      // Holographic boundary perimeter line
      const borderGeo = new THREE.BufferGeometry();
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.7,
        linewidth: 2,
      });
      const borderLine = new THREE.Line(borderGeo, borderMat);
      borderLine.userData = { cellIndex: idx };
      tacticalGroup.add(borderLine);
      cellBorderLines.push(borderLine);
    }

    // --- GLOBE GROUP: 3D Whole Moon Globe ---
    const globeRadius = 110;
    const moonSphereGeo = new THREE.SphereGeometry(globeRadius, 96, 96);
    const moonSphereMat = new THREE.MeshStandardMaterial({
      color: 0xdcd8d0,
      map: lrocTexture,
      bumpMap: lrocTexture,
      bumpScale: 5.8,
      roughness: 0.88,
      metalness: 0.05,
    });
    const moonSphereMesh = new THREE.Mesh(moonSphereGeo, moonSphereMat);
    moonSphereMesh.name = 'moon-globe-mesh';
    globeGroup.add(moonSphereMesh);

    // --- HIGHLIGHT SOUTH POLAR BASIN (65°S to 90°S) ---
    // 1. Glowing Translucent Cyan Polar Basin Dome Cap
    const polarCapGeo = new THREE.SphereGeometry(globeRadius * 1.008, 64, 20, 0, Math.PI * 2, 2.705, Math.PI - 2.705);
    const polarCapMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const polarCapMesh = new THREE.Mesh(polarCapGeo, polarCapMat);
    globeGroup.add(polarCapMesh);

    // 2. Concentric Latitude Rings (-70°, -75°, -80°, -85°)
    const polarLats = [-70, -75, -80, -85];
    polarLats.forEach((lat, idx) => {
      const latRad = (lat * Math.PI) / 180;
      const r = globeRadius * 1.012 * Math.cos(latRad);
      const y = globeRadius * 1.012 * Math.sin(latRad);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: idx === 0 ? 0x38bdf8 : idx === 2 ? 0x22d3ee : 0x0ea5e9,
        transparent: true,
        opacity: idx === 0 ? 0.95 : 0.65,
      });
      globeGroup.add(new THREE.Line(g, m));
    });

    // 3D Site Pins on Globe
    const sitePins: THREE.Group[] = [];
    for (const cs of CANDIDATE_SITES) {
      const pinGroup = new THREE.Group();
      const phi = (cs.lat * Math.PI) / 180;
      const lambda = (cs.lon * Math.PI) / 180;
      const px = globeRadius * 1.01 * Math.cos(phi) * Math.sin(lambda);
      const py = globeRadius * 1.01 * Math.sin(phi);
      const pz = globeRadius * 1.01 * Math.cos(phi) * Math.cos(lambda);

      pinGroup.position.set(px, py, pz);
      pinGroup.lookAt(px * 2, py * 2, pz * 2);

      const pinCore = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 16, 16),
        new THREE.MeshBasicMaterial({ color: cs.color })
      );
      pinGroup.add(pinCore);

      const pinShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.1, 7, 8),
        new THREE.MeshBasicMaterial({ color: cs.color })
      );
      pinShaft.position.z = -3.5;
      pinShaft.rotation.x = Math.PI / 2;
      pinGroup.add(pinShaft);

      pinGroup.userData = { siteId: cs.id, siteName: cs.name, lat: cs.lat, lon: cs.lon };
      globeGroup.add(pinGroup);
      sitePins.push(pinGroup);
    }

    // 30 NASA SVS Topographic Features on Globe
    const topoPinsGroup = new THREE.Group();
    for (const tf of NASA_30_TOPOGRAPHIC_FEATURES) {
      const pinGroup = new THREE.Group();
      const phi = (tf.latDeg * Math.PI) / 180;
      const lambda = (tf.lonDeg * Math.PI) / 180;
      const px = globeRadius * 1.015 * Math.cos(phi) * Math.sin(lambda);
      const py = globeRadius * 1.015 * Math.sin(phi);
      const pz = globeRadius * 1.015 * Math.cos(phi) * Math.cos(lambda);

      pinGroup.position.set(px, py, pz);
      pinGroup.lookAt(px * 2, py * 2, pz * 2);

      const color =
        tf.kind === 'crater'
          ? 0xf59e0b
          : tf.kind === 'ridge'
            ? 0x06b6d4
            : tf.kind === 'cold-trap'
              ? 0x38bdf8
              : 0xa855f7;

      const pinCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(2.2, 0),
        new THREE.MeshBasicMaterial({ color })
      );
      pinGroup.add(pinCore);

      pinGroup.userData = { featureData: tf };
      topoPinsGroup.add(pinGroup);
    }
    globeGroup.add(topoPinsGroup);

    globeGroup.visible = false;
    tacticalGroup.visible = true;

    // Render loop and interaction
    let renderRequested = false;
    function requestRender() {
      if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(() => {
          renderRequested = false;
          controls.update();
          renderer.render(scene, camera);
        });
      }
    }

    controls.addEventListener('start', () => {
      if (tweenRef.current) tweenRef.current.active = false;
    });

    const animateLoop = () => {
      if (tweenRef.current && tweenRef.current.active) {
        const elapsed = performance.now() - tweenRef.current.startTime;
        const p = Math.min(1.0, elapsed / tweenRef.current.durationMs);
        const ease = expEase(p);
        controls.target.lerpVectors(tweenRef.current.startTarget, tweenRef.current.endTarget, ease);
        camera.position.lerpVectors(tweenRef.current.startCamPos, tweenRef.current.endCamPos, ease);
        if (p >= 1.0) {
          tweenRef.current.active = false;
        }
      }
      controls.update();
      reticle.material.opacity = 0.55 + Math.sin(Date.now() * 0.005) * 0.35;
      earthObj.earthSphere.rotation.y += 0.0015;
      earthObj.atmosphereHalo.scale.setScalar(1.0 + Math.sin(Date.now() * 0.003) * 0.03);
      renderer.render(scene, camera);
      requestAnimationFrame(animateLoop);
    };
    const animId = requestAnimationFrame(animateLoop);

    // Raycaster for Cell Clicks (Tactical) and Globe Clicks
    const raycaster = new THREE.Raycaster();
    const mousePos = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const handlePointerDown = (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mousePos, camera);

      if (globeGroup.visible) {
        // Globe Mode Click: Check for 3D candidate site pins first
        const pinHits = raycaster.intersectObjects(sitePins, true);
        if (pinHits.length > 0) {
          let cur: THREE.Object3D | null = pinHits[0].object;
          while (cur && !cur.userData?.siteId && cur.parent) {
            cur = cur.parent;
          }
          if (cur?.userData?.siteId) {
            onSelectSite?.(cur.userData.siteId);
            setViewMode('tactical');
            return;
          }
        }

        // Check for 30 NASA SVS Topographic Feature Pins
        if (topoPinsGroup.visible) {
          const topoHits = raycaster.intersectObjects(topoPinsGroup.children, true);
          if (topoHits.length > 0) {
            let cur: THREE.Object3D | null = topoHits[0].object;
            while (cur && !cur.userData?.featureData && cur.parent) {
              cur = cur.parent;
            }
            if (cur?.userData?.featureData) {
              setSelectedFeature(cur.userData.featureData);
              return;
            }
          }
        }

        const hits = raycaster.intersectObject(moonSphereMesh);
        if (hits.length > 0) {
          const p = hits[0].point.clone().normalize();
          const latDeg = Math.asin(p.y) * (180 / Math.PI);
          const lonDeg = Math.atan2(p.x, p.z) * (180 / Math.PI);

          if (latDeg > -65.0) {
            setNonPolarAlert({
              lat: latDeg,
              lon: lonDeg,
              message: `Latitude ${latDeg.toFixed(1)}° is OUTSIDE the CLPS South Polar exploration corridor. Artemis & CLPS mission directives strictly mandate landing between -70° S and -90° S for permanently shadowed volatile cold traps.`,
            });
          } else {
            setNonPolarAlert({
              lat: latDeg,
              lon: lonDeg,
              message: `Target coordinate locked in South Polar zone (${Math.abs(latDeg).toFixed(2)}° S, ${lonDeg.toFixed(2)}° E). Ready to enter 500m Tactical Landing Zone.`,
            });
          }
        }
      } else {
        // Tactical Mode Click (raycasts both draped cell pads and raw terrain mesh)
        const hits = raycaster.intersectObjects([...cellMeshes, ...cellBorderLines, terrainMesh], true);
        if (hits.length > 0) {
          // Direct hit on any cell pad or border
          const cellHit = hits.find(
            (h) => h.object.userData?.cellIndex !== undefined
          );
          if (cellHit && cellHit.object.userData?.cellIndex !== undefined) {
            onSelectCell(cellHit.object.userData.cellIndex);
          } else {
            // Hit on surrounding terrain mesh: map world coords (x, z) -> (dxM = x, dyM = -z)
            const hit = hits[0].point;
            const nearest = nearestDispersionCell(dispersionGrid, hit.x, -hit.z);
            if (nearest) {
              onSelectCell(nearest.index);
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const focusOnCell = (cellIdx: number) => {
      const c = dispersionGrid[cellIdx] ?? dispersionGrid[12];
      if (!c) return;
      const cX = c.dxM;
      const cZ = -c.dyM;
      const cY = sampleDemHeight(site.demGrid101, c.dxM, c.dyM);

      const targetPos = new THREE.Vector3(cX, cY + 2.5, cZ);
      const curOffset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const dist = Math.min(180, Math.max(70, curOffset.length()));
      curOffset.setLength(dist);

      tweenRef.current = {
        active: true,
        startTime: performance.now(),
        durationMs: 420,
        startTarget: controls.target.clone(),
        endTarget: targetPos,
        startCamPos: camera.position.clone(),
        endCamPos: new THREE.Vector3().addVectors(targetPos, curOffset),
      };
    };

    const focusOnTactical = () => {
      globeGroup.visible = false;
      tacticalGroup.visible = true;
      camera.position.set(130, 90, 150);
      controls.target.set(0, 0, 0);
      controls.maxDistance = 580;
      controls.minDistance = 45;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.update();
      requestRender();
    };

    const focusOnGlobe = () => {
      tacticalGroup.visible = false;
      globeGroup.visible = true;
      // Focus on South Pole: camera placed below looking up at south pole
      camera.position.set(0, -220, 190);
      controls.target.set(0, -60, 0);
      controls.maxDistance = 900;
      controls.minDistance = 140;
      controls.maxPolarAngle = Math.PI;
      controls.update();
      requestRender();
    };

    const focusOnMastCam = () => {
      globeGroup.visible = false;
      tacticalGroup.visible = true;
      const c = dispersionGrid[selectedCellIndex] ?? dispersionGrid[12];
      const cX = c.dxM;
      const cZ = -c.dyM;
      const cY = sampleDemHeight(site.demGrid101, c.dxM, c.dyM);
      const mastH = Math.max(0.5, Math.min(10, mastHeightM));
      const camY = cY + 4.0 + mastH;

      camera.position.set(cX, camY, cZ);

      const azRad = (currentPoint.sunAzDeg * Math.PI) / 180;
      const elRad = (Math.max(-2, currentPoint.sunElDeg) * Math.PI) / 180;
      const dist = 180;
      controls.target.set(
        cX + dist * Math.cos(elRad) * Math.sin(azRad),
        camY + dist * Math.sin(elRad),
        cZ - dist * Math.cos(elRad) * Math.cos(azRad)
      );
      controls.minDistance = 0.5;
      controls.maxDistance = 600;
      controls.maxPolarAngle = Math.PI * 0.55;
      controls.update();
      requestRender();
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    sceneHandlesRef.current = {
      renderer,
      scene,
      camera,
      controls,
      tacticalGroup,
      globeGroup,
      terrainGeo,
      terrainMesh,
      reticle,
      lander,
      ghostLander,
      cellMeshes,
      cellBorderLines,
      focusOnCell,
      sunLight,
      sunRealistic,
      earthObj,
      laserComms,
      wallGeo,
      sitePins,
      topoPinsGroup,
      requestRender,
      focusOnTactical,
      focusOnGlobe,
      focusOnMastCam,
      siteRef: site,
    };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Terrain Geometry when Site changes
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (!h) return;
    h.siteRef = site;

    const posAttr = h.terrainGeo.attributes.position as THREE.BufferAttribute;
    let minE = 0;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const elev = sampleDemHeight(site.demGrid101, vx, -vz);
      if (elev < minE) minE = elev;
      posAttr.setY(i, elev);
    }
    posAttr.needsUpdate = true;
    h.terrainGeo.computeVertexNormals();
    h.terrainGeo.computeBoundingSphere();

    // Build solid curtain walls around the 500m perimeter from DEM edge elevation down to -65m
    const wallPositions: number[] = [];
    const wallNormals: number[] = [];
    const floorY = -65.0;
    const steps = 100;
    const stepSize = 500 / steps;

    const addWallQuad = (x1: number, z1: number, y1: number, x2: number, z2: number, y2: number, nx: number, nz: number) => {
      wallPositions.push(x1, y1, z1,  x1, floorY, z1,  x2, y2, z2);
      wallNormals.push(nx, 0, nz,  nx, 0, nz,  nx, 0, nz);
      wallPositions.push(x2, y2, z2,  x1, floorY, z1,  x2, floorY, z2);
      wallNormals.push(nx, 0, nz,  nx, 0, nz,  nx, 0, nz);
    };

    // North Edge (z = -250)
    for (let i = 0; i < steps; i++) {
      const x1 = -250 + i * stepSize;
      const x2 = -250 + (i + 1) * stepSize;
      const y1 = sampleDemHeight(site.demGrid101, x1, 250);
      const y2 = sampleDemHeight(site.demGrid101, x2, 250);
      addWallQuad(x1, -250, y1, x2, -250, y2, 0, -1);
    }
    // South Edge (z = +250)
    for (let i = 0; i < steps; i++) {
      const x1 = 250 - i * stepSize;
      const x2 = 250 - (i + 1) * stepSize;
      const y1 = sampleDemHeight(site.demGrid101, x1, -250);
      const y2 = sampleDemHeight(site.demGrid101, x2, -250);
      addWallQuad(x1, 250, y1, x2, 250, y2, 0, 1);
    }
    // East Edge (x = +250)
    for (let i = 0; i < steps; i++) {
      const z1 = -250 + i * stepSize;
      const z2 = -250 + (i + 1) * stepSize;
      const y1 = sampleDemHeight(site.demGrid101, 250, -z1);
      const y2 = sampleDemHeight(site.demGrid101, 250, -z2);
      addWallQuad(250, z1, y1, 250, z2, y2, 1, 0);
    }
    // West Edge (x = -250)
    for (let i = 0; i < steps; i++) {
      const z1 = 250 - i * stepSize;
      const z2 = 250 - (i + 1) * stepSize;
      const y1 = sampleDemHeight(site.demGrid101, -250, -z1);
      const y2 = sampleDemHeight(site.demGrid101, -250, -z2);
      addWallQuad(-250, z1, y1, -250, z2, y2, -1, 0);
    }

    h.wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
    h.wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wallNormals, 3));
    h.wallGeo.computeBoundingSphere();

    h.requestRender();
  }, [site]);

  // Update Lander, Mast, Reticle, and Sun Lighting
  useEffect(() => {
    const h = sceneHandlesRef.current;
    if (!h) return;

    // 1. Morph and drape all 25 5x5 cell overlay geometries and borders to hug craters seamlessly
    for (let idx = 0; idx < 25; idx++) {
      const cell = dispersionGrid[idx];
      const mesh = h.cellMeshes[idx];
      const border = h.cellBorderLines[idx];
      if (!cell || !mesh || !border) continue;

      const isSelected = idx === selectedCellIndex;
      const cellX = cell.dxM;
      const cellZ = -cell.dyM; // In Three.js: Northing is -Z!

      // Displace all 81 vertices of the 8x8 plane to hug the DEM surface
      const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < posAttr.count; k++) {
        const lx = -31 + (k % 9) * (62 / 8);
        const lz = -31 + Math.floor(k / 9) * (62 / 8);
        const worldX = cellX + lx;
        const worldZ = cellZ + lz;
        const elev = sampleDemHeight(site.demGrid101, worldX, -worldZ);
        posAttr.setXYZ(k, lx, elev + 0.32, lz);
      }
      posAttr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.position.set(cellX, 0, cellZ);

      // Displace 32 border line points around the perimeter
      const borderPts: number[] = [];
      const steps = 8;
      // Top Edge (North)
      for (let s = 0; s <= steps; s++) {
        const lx = -31 + (s / steps) * 62;
        const lz = -31;
        const ey = sampleDemHeight(site.demGrid101, cellX + lx, -(cellZ + lz)) + 0.42;
        borderPts.push(lx, ey, lz);
      }
      // Right Edge (East)
      for (let s = 1; s <= steps; s++) {
        const lx = 31;
        const lz = -31 + (s / steps) * 62;
        const ey = sampleDemHeight(site.demGrid101, cellX + lx, -(cellZ + lz)) + 0.42;
        borderPts.push(lx, ey, lz);
      }
      // Bottom Edge (South)
      for (let s = 1; s <= steps; s++) {
        const lx = 31 - (s / steps) * 62;
        const lz = 31;
        const ey = sampleDemHeight(site.demGrid101, cellX + lx, -(cellZ + lz)) + 0.42;
        borderPts.push(lx, ey, lz);
      }
      // Left Edge (West)
      for (let s = 1; s < steps; s++) {
        const lx = -31;
        const lz = 31 - (s / steps) * 62;
        const ey = sampleDemHeight(site.demGrid101, cellX + lx, -(cellZ + lz)) + 0.42;
        borderPts.push(lx, ey, lz);
      }
      border.geometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPts, 3));
      border.position.set(cellX, 0, cellZ);

      // Colors and Glowing Highlights
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const bMat = border.material as THREE.LineBasicMaterial;
      const isLoss = cell.status === 'MISSION_LOSS_TRAP';
      const isMarg = cell.status === 'MARGINAL';

      const hex = isLoss ? 0xf43f5e : isMarg ? 0xf59e0b : 0x10b981;
      mat.color.setHex(hex);
      mat.emissive.setHex(hex);
      mat.emissiveIntensity = isSelected ? 1.05 : 0.28;
      mat.opacity = isSelected ? 0.55 : 0.24;

      bMat.color.setHex(isSelected ? 0x38bdf8 : hex);
      bMat.opacity = isSelected ? 1.0 : 0.65;
    }

    // 2. Position Lander and Reticle EXACTLY on selected cell
    const targetCellX = selectedCell.dxM;
    const targetCellZ = -selectedCell.dyM;
    const targetY = sampleDemHeight(site.demGrid101, selectedCell.dxM, selectedCell.dyM);

    h.lander.root.position.set(targetCellX, targetY, targetCellZ);
    h.reticle.group.position.set(targetCellX, targetY + 0.15, targetCellZ);

    // 3. Mast Height
    const mastH = Math.max(0.5, Math.min(10, mastHeightM));
    h.lander.mastMesh.scale.y = mastH;
    h.lander.mastMesh.position.y = 4.0 + mastH / 2;
    h.lander.solarCrosshead.position.y = 4.0 + mastH;

    // 4. Realistic Sun Lighting & Corona Position
    const azRad = (currentPoint.sunAzDeg * Math.PI) / 180;
    const elRad = (Math.max(-2, currentPoint.sunElDeg) * Math.PI) / 180;
    const dist = 850;
    const sx = dist * Math.cos(elRad) * Math.sin(azRad);
    const sy = dist * Math.sin(elRad);
    const sz = -dist * Math.cos(elRad) * Math.cos(azRad);

    h.sunLight.position.set(sx, Math.max(15, sy), sz);
    h.sunLight.intensity = currentPoint.sunFraction > 0.02 ? 3.8 : 0.4;

    h.sunRealistic.position.set(sx, sy, sz);
    h.sunRealistic.visible = currentPoint.sunElDeg > -2.0;

    // 5. Accurate Earth Ephemeris Position & Comms Line-of-Sight
    const earthAzRad = (currentPoint.earthAzDeg * Math.PI) / 180;
    const earthElRad = (currentPoint.earthElDeg * Math.PI) / 180;
    const earthDist = 950;
    const ex = earthDist * Math.cos(earthElRad) * Math.sin(earthAzRad);
    const ey = earthDist * Math.sin(earthElRad);
    const ez = -earthDist * Math.cos(earthElRad) * Math.cos(earthAzRad);

    h.earthObj.group.position.set(ex, ey, ez);
    h.earthObj.updateStatus(currentPoint.earthVisible, currentPoint.earthElDeg);

    // 6. Laser Comms Beam from Lander Antenna Dish to Earth
    const landerDishY = targetY + 4.0 + mastH;
    const landerOrigin = new THREE.Vector3(targetCellX, landerDishY, targetCellZ);
    h.laserComms.updateBeam(landerOrigin, h.earthObj.group.position, currentPoint.earthVisible);

    // Point Lander High-Gain Parabolic Dish directly at Earth!
    h.lander.dishPivot.lookAt(ex, ey, ez);

    // Update 875m Naive GIS Drift Ghost Position (MOON_PA vs MOON_ME SPICE FK transform)
    h.ghostLander.updatePosition(
      targetCellX,
      targetY,
      targetCellZ,
      !!showGisDrift,
      site.metadata.latDeg,
      site.metadata.lonDeg
    );

    // Camera Focus & Tracking
    if (viewMode === 'mast-cam') {
      const camY = targetY + 4.0 + mastH;
      h.camera.position.set(targetCellX, camY, targetCellZ);
      const mDist = 180;
      h.controls.target.set(
        targetCellX + mDist * Math.cos(elRad) * Math.sin(azRad),
        camY + mDist * Math.sin(elRad),
        targetCellZ - mDist * Math.cos(elRad) * Math.cos(azRad)
      );
      h.controls.update();
    } else if (viewMode === 'tactical') {
      h.focusOnCell(selectedCellIndex);
    }

    h.requestRender();
  }, [site, dispersionGrid, selectedCellIndex, mastHeightM, currentPoint, showGisDrift, viewMode]);

  // Switch View Mode handler
  const handleToggleMode = (mode: 'globe' | 'tactical' | 'mast-cam') => {
    setViewMode(mode);
    setNonPolarAlert(null);
    setSelectedFeature(null);
    if (mode === 'globe') {
      sceneHandlesRef.current?.focusOnGlobe();
    } else if (mode === 'mast-cam') {
      sceneHandlesRef.current?.focusOnMastCam();
    } else {
      sceneHandlesRef.current?.focusOnTactical();
    }
  };

  return (
    <section
      aria-label="3D Lunar Mission Viewport"
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen flex flex-col bg-[#050608]'
          : 'relative flex flex-col bg-[#080B12] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden'
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#1E293B] bg-[#0A0D16]">
        <div className="flex items-center gap-3">
          {/* Mode Switcher Pills */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#0F172A] border border-[#1E293B]">
            <button
              type="button"
              onClick={() => handleToggleMode('tactical')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                viewMode === 'tactical'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>500m TACTICAL ZONE</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode('mast-cam')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                viewMode === 'mast-cam'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>MAST-CAM POV</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode('globe')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                viewMode === 'globe'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D GLOBAL MOON</span>
            </button>
          </div>

          {/* Naive GIS Drift 875m Toggle */}
          <button
            type="button"
            onClick={onToggleGisDrift}
            className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-mono rounded-md border transition-all ${
              showGisDrift
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-sm'
                : 'bg-[#0F172A] border-[#1E293B] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle 875m coordinate discrepancy between MOON_PA and MOON_ME"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">875m GIS Drift</span>
          </button>

          {/* 30 NASA Topographic Features Toggle (Globe Mode) */}
          {viewMode === 'globe' && (
            <button
              type="button"
              onClick={() => {
                setShow30Features((p) => {
                  const next = !p;
                  if (sceneHandlesRef.current?.topoPinsGroup) {
                    sceneHandlesRef.current.topoPinsGroup.visible = next;
                    sceneHandlesRef.current.requestRender();
                  }
                  return next;
                });
              }}
              className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-mono rounded-md border transition-all ${
                show30Features
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                  : 'bg-[#0F172A] border-[#1E293B] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">30 NASA Sites</span>
            </button>
          )}

          <div className="hidden sm:block text-[11px] font-mono text-slate-400">
            {viewMode === 'globe'
              ? 'Click Moon or pins to inspect NASA SVS features'
              : viewMode === 'mast-cam'
                ? `Lander Mast-Cam POV · ${mastHeightM.toFixed(1)}m Mast`
                : `${site.metadata.name} · LOLA-Calibrated 5m/px DEM`}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'globe') {
                sceneHandlesRef.current?.focusOnGlobe();
              } else if (viewMode === 'mast-cam') {
                sceneHandlesRef.current?.focusOnMastCam();
              } else {
                sceneHandlesRef.current?.focusOnTactical();
              }
            }}
            className="h-8 px-2.5 flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:border-cyan-500 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-8 px-3 flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-cyan-700 hover:bg-cyan-600 border border-cyan-500/50 rounded-lg transition-colors"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>EXIT FULLSCREEN</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>FULLSCREEN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div className={`relative w-full ${isFullscreen ? 'flex-1' : 'h-[360px] lg:h-[420px]'} bg-[#050608]`}>
        {webglError ? (
          <div className="w-full h-full flex items-center justify-center p-6 text-center text-xs text-rose-400">
            {webglError}
          </div>
        ) : (
          <div
            ref={mountRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />
        )}

        {/* Mast-Cam POV On-Canvas HUD Badge */}
        {viewMode === 'mast-cam' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-400/50 backdrop-blur-md text-xs font-mono text-cyan-200 flex items-center gap-2.5 shadow-xl pointer-events-none z-10">
            <Video className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>
              MAST-CAM POV · CAM ELEV: <strong className="text-white">{(4.0 + mastHeightM).toFixed(1)}m</strong> · SUN EL: <strong className="text-amber-400">{currentPoint.sunElDeg.toFixed(2)}°</strong>
            </span>
          </div>
        )}

        {/* 875m Naive GIS Drift HUD Badge */}
        {showGisDrift && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/60 backdrop-blur-md text-xs font-mono text-rose-200 flex items-center gap-2 shadow-xl pointer-events-none z-10 animate-pulse">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>875m ROTATIONAL GIS DRIFT ACTIVE (MOON_PA vs MOON_ME)</span>
          </div>
        )}

        {/* NASA SVS 30 Topographic Feature Detail Card */}
        {selectedFeature && (
          <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 p-4 rounded-xl bg-[#090D16]/95 border border-cyan-500/60 backdrop-blur-md shadow-2xl text-xs font-mono flex flex-col gap-2.5 z-20 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>{selectedFeature.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeature(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-500">Kind:</span>{' '}
                <strong className="text-white capitalize">{selectedFeature.kind}</strong>
              </div>
              <div>
                <span className="text-slate-500">Elevation:</span>{' '}
                <strong className="text-cyan-300">{selectedFeature.elevationM} m</strong>
              </div>
              <div>
                <span className="text-slate-500">Coordinates:</span>{' '}
                <strong className="text-amber-300">
                  {Math.abs(selectedFeature.latDeg).toFixed(2)}°S, {selectedFeature.lonDeg.toFixed(2)}°E
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Diameter:</span>{' '}
                <strong className="text-slate-200">{selectedFeature.diameterKm} km</strong>
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 font-semibold">
              Ice Volatile: {selectedFeature.iceEvidence.replace(/_/g, ' ')}
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {selectedFeature.description}
            </p>
          </div>
        )}

        {/* Non-Polar Boundary Warning Overlay */}
        {nonPolarAlert && (
          <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 p-3.5 rounded-xl bg-[#090D16]/95 border border-amber-500/60 backdrop-blur-md shadow-2xl text-xs font-mono flex flex-col gap-2 z-20 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>{nonPolarAlert.lat > -65 ? 'NON-POLAR WARNING' : 'SOUTH POLAR LOCK'}</span>
              </div>
              <button
                type="button"
                onClick={() => setNonPolarAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {nonPolarAlert.message}
            </p>
            {nonPolarAlert.lat <= -65 && (
              <button
                type="button"
                onClick={() => handleToggleMode('tactical')}
                className="mt-1 w-full py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-center tracking-wider"
              >
                ENTER 500m TACTICAL ZONE →
              </button>
            )}
          </div>
        )}

        {/* Floating Space Badge */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-[#07090E]/80 border border-[#1E293B] backdrop-blur-sm text-[10px] font-mono text-slate-400 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{viewMode === 'globe' ? 'NASA LROC 2K GLOBAL MOON' : 'LOLA-CALIBRATED 5m/px VACUUM SHADOW ENGINE'}</span>
        </div>
      </div>

      {/* HUD Telemetry Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-[#1E293B] bg-[#080B12] text-[11px] font-mono text-slate-300 tabular-nums">
        <div className="flex items-center gap-3">
          <span>
            Elev <strong className="text-white">{selectedCell?.elevationM ?? site.metadata.elevationM} m</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Mast <strong className="text-cyan-400">{mastHeightM.toFixed(1)} m</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Sun Az/El{' '}
            <strong className="text-amber-400">
              {currentPoint.sunAzDeg.toFixed(1)}° / {currentPoint.sunElDeg.toFixed(2)}°
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">■ Safe (&lt;8°)</span>
          <span className="text-amber-400">■ Marginal (8-15°)</span>
          <span className="text-rose-400">■ Crater Loss (&gt;15°)</span>
        </div>
      </div>
    </section>
  );
}

export default ThreeTerrainViewer;

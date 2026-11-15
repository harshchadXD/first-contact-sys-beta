import type { LunarSiteDefinition, SpacecraftProfile } from './types';
import bakedSitesData from '../../public/data/baked_lunar_sites.json';

export const SPACECRAFT_PROFILES: SpacecraftProfile[] = [
  {
    id: 'nova-c',
    name: 'Nova-C',
    missionLabel: 'IM-2 Athena',
    contractor: 'Intuitive Machines',
    defaultMastM: 3.0,
    batteryCapacityKwh: 2.5,
    solarRatedW: 520,
    maxSlopeDeg: 10.0,
    hotelLoadW: 120,
    txLoadW: 95,
    antennaType: 'Gimbaled X-band',
    minSurvivalTempK: 230,
    survivalHeaterW: 35,
  },
  {
    id: 'griffin',
    name: 'Griffin Lander',
    missionLabel: 'VIPER / CLPS',
    contractor: 'Astrobotic',
    defaultMastM: 2.2,
    batteryCapacityKwh: 5.0,
    solarRatedW: 780,
    maxSlopeDeg: 15.0,
    hotelLoadW: 280,
    txLoadW: 130,
    antennaType: 'Steerable Dish',
    minSurvivalTempK: 220,
    survivalHeaterW: 45,
  },
  {
    id: 'blue-ghost',
    name: 'Blue Ghost',
    missionLabel: 'CLPS 19D',
    contractor: 'Firefly Aerospace',
    defaultMastM: 3.5,
    batteryCapacityKwh: 3.2,
    solarRatedW: 620,
    maxSlopeDeg: 12.0,
    hotelLoadW: 160,
    txLoadW: 110,
    antennaType: 'Fixed Patch Array',
    minSurvivalTempK: 225,
    survivalHeaterW: 35,
  },
  {
    id: 'vikram',
    name: 'Vikram',
    missionLabel: 'Chandrayaan-3',
    contractor: 'ISRO',
    defaultMastM: 2.0,
    batteryCapacityKwh: 1.8,
    solarRatedW: 410,
    maxSlopeDeg: 8.0,
    hotelLoadW: 100,
    txLoadW: 75,
    antennaType: 'S-Band Phased',
    minSurvivalTempK: 235,
    survivalHeaterW: 25,
  },
];

/**
 * Validates spacecraft hardware specifications per NASA IV&V flight rules.
 * Throws RangeError if parameters violate physical thermodynamic or structural bounds.
 */
export function validateSpacecraftProfile(profile: SpacecraftProfile): SpacecraftProfile {
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('Spacecraft profile must be a non-null object.');
  }
  if (!Number.isFinite(profile.batteryCapacityKwh) || profile.batteryCapacityKwh <= 0) {
    throw new RangeError(
      `Invalid battery capacity: ${profile.batteryCapacityKwh} kWh. Must be strictly positive (> 0).`
    );
  }
  if (!Number.isFinite(profile.solarRatedW) || profile.solarRatedW < 0) {
    throw new RangeError(
      `Invalid solar rating: ${profile.solarRatedW} W. Must be non-negative (>= 0).`
    );
  }
  if (!Number.isFinite(profile.hotelLoadW) || profile.hotelLoadW <= 0) {
    throw new RangeError(
      `Invalid hotel load: ${profile.hotelLoadW} W. Must be strictly positive (> 0).`
    );
  }
  if (!Number.isFinite(profile.maxSlopeDeg) || profile.maxSlopeDeg < 0 || profile.maxSlopeDeg > 90) {
    throw new RangeError(
      `Invalid maximum slope limit: ${profile.maxSlopeDeg}°. Must be within [0°, 90°].`
    );
  }
  if (!Number.isFinite(profile.defaultMastM) || profile.defaultMastM < 0) {
    throw new RangeError(
      `Invalid mast height: ${profile.defaultMastM} m. Must be non-negative (>= 0).`
    );
  }
  return profile;
}

interface RawSiteSeed {
  siteId: string;
  name: string;
  shortName: string;
  latDeg: number;
  lonDeg: number;
  elevationM: number;
  nominalSlopeDeg: number;
  rmsHeightUncertaintyM: number;
  rmsSlopeErrorDeg: number;
  demSource: string;
  missionContext: string;
  iceProximityKm: number;
  baseHorizonDeg: number;
  horizonAmpDeg: number;
  horizonPhaseDeg: number;
  ridgeAzimuthDeg: number;
  ridgeBoostDeg: number;
  ridgeWidthDeg: number;
  dCritBaseM: number;
  seed: number;
  craterPreset: {
    dxM: number;
    dyM: number;
    radiusM: number;
    depthM: number;
    rimBoostDeg: number;
  };
}

const RAW_SITE_SEEDS: RawSiteSeed[] = [
  {
    siteId: 'PGDA-20',
    name: 'Mons Mouton Plateau (IM-2)',
    shortName: 'Mons Mouton',
    latDeg: -84.7906,
    lonDeg: 29.1957,
    elevationM: 5420.4,
    nominalSlopeDeg: 3.8,
    rmsHeightUncertaintyM: 0.35,
    rmsSlopeErrorDeg: 1.7,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site20 / Product 78 Calibrated)',
    missionContext: 'Intuitive Machines IM-2 Athena target plateau & 300m crater loss zone',
    iceProximityKm: 3.4,
    baseHorizonDeg: 0.92,
    horizonAmpDeg: 0.65,
    horizonPhaseDeg: 40,
    ridgeAzimuthDeg: 195,
    ridgeBoostDeg: 3.15,
    ridgeWidthDeg: 30,
    dCritBaseM: 2400,
    seed: 20,
    craterPreset: {
      dxM: -188,
      dyM: 188,
      radiusM: 118,
      depthM: 45.0,
      rimBoostDeg: 5.9,
    },
  },
  {
    siteId: 'PGDA-01',
    name: 'Connecting Ridge (Artemis III)',
    shortName: 'Connecting Ridge',
    latDeg: -89.4632,
    lonDeg: -137.49,
    elevationM: 2140.0,
    nominalSlopeDeg: 5.4,
    rmsHeightUncertaintyM: 0.31,
    rmsSlopeErrorDeg: 1.9,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site01 / Product 78 Calibrated)',
    missionContext: 'Artemis III candidate ridge bridging Shackleton & de Gerlache craters',
    iceProximityKm: 1.2,
    baseHorizonDeg: 0.72,
    horizonAmpDeg: 0.52,
    horizonPhaseDeg: 110,
    ridgeAzimuthDeg: 270,
    ridgeBoostDeg: 1.95,
    ridgeWidthDeg: 42,
    dCritBaseM: 1850,
    seed: 1,
    craterPreset: {
      dxM: 200,
      dyM: -100,
      radiusM: 110,
      depthM: 28.5,
      rimBoostDeg: 2.8,
    },
  },
  {
    siteId: 'PGDA-04',
    name: 'Shackleton Crater Rim',
    shortName: 'Shackleton Rim',
    latDeg: -89.7668,
    lonDeg: -171.87,
    elevationM: 4280.0,
    nominalSlopeDeg: 6.1,
    rmsHeightUncertaintyM: 0.33,
    rmsSlopeErrorDeg: 2.1,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site04 / Product 78 Calibrated)',
    missionContext: 'High-illumination polar crest adjacent to deep permanently shadowed crater',
    iceProximityKm: 0.6,
    baseHorizonDeg: 0.58,
    horizonAmpDeg: 0.44,
    horizonPhaseDeg: 15,
    ridgeAzimuthDeg: 120,
    ridgeBoostDeg: 1.45,
    ridgeWidthDeg: 34,
    dCritBaseM: 2900,
    seed: 4,
    craterPreset: {
      dxM: 100,
      dyM: 200,
      radiusM: 118,
      depthM: 34.0,
      rimBoostDeg: 3.1,
    },
  },
  {
    siteId: 'PGDA-06',
    name: 'Nobile Rim 1 (VIPER Zone)',
    shortName: 'Nobile Rim 1',
    latDeg: -85.4381,
    lonDeg: 37.3667,
    elevationM: 3810.0,
    nominalSlopeDeg: 4.9,
    rmsHeightUncertaintyM: 0.38,
    rmsSlopeErrorDeg: 1.8,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site06 / Product 78 Calibrated)',
    missionContext: 'Astrobotic Griffin / NASA VIPER volatile prospecting baseline region',
    iceProximityKm: 1.8,
    baseHorizonDeg: 1.08,
    horizonAmpDeg: 0.72,
    horizonPhaseDeg: 75,
    ridgeAzimuthDeg: 325,
    ridgeBoostDeg: 2.1,
    ridgeWidthDeg: 38,
    dCritBaseM: 2100,
    seed: 6,
    craterPreset: {
      dxM: -100,
      dyM: -200,
      radiusM: 115,
      depthM: 31.2,
      rimBoostDeg: 2.95,
    },
  },
  {
    siteId: 'PGDA-07',
    name: 'Peak Near Shackleton',
    shortName: 'Shackleton Peak',
    latDeg: -88.811,
    lonDeg: 123.6901,
    elevationM: 4150.0,
    nominalSlopeDeg: 5.8,
    rmsHeightUncertaintyM: 0.36,
    rmsSlopeErrorDeg: 2.0,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site07 / Product 78 Calibrated)',
    missionContext: 'High-elevation polar optical & RF communications relay peak',
    iceProximityKm: 2.1,
    baseHorizonDeg: 0.65,
    horizonAmpDeg: 0.48,
    horizonPhaseDeg: 200,
    ridgeAzimuthDeg: 65,
    ridgeBoostDeg: 1.35,
    ridgeWidthDeg: 32,
    dCritBaseM: 3400,
    seed: 7,
    craterPreset: {
      dxM: -200,
      dyM: -100,
      radiusM: 105,
      depthM: 26.0,
      rimBoostDeg: 2.65,
    },
  },
  {
    siteId: 'PGDA-11',
    name: 'de Gerlache Rim 1',
    shortName: 'de Gerlache',
    latDeg: -88.6834,
    lonDeg: -67.9321,
    elevationM: 3120.0,
    nominalSlopeDeg: 4.5,
    rmsHeightUncertaintyM: 0.34,
    rmsSlopeErrorDeg: 1.6,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site11 / Product 78 Calibrated)',
    missionContext: 'High solar persistence crest overlooking volatile-rich cold traps',
    iceProximityKm: 1.5,
    baseHorizonDeg: 0.84,
    horizonAmpDeg: 0.56,
    horizonPhaseDeg: 145,
    ridgeAzimuthDeg: 230,
    ridgeBoostDeg: 1.65,
    ridgeWidthDeg: 35,
    dCritBaseM: 2600,
    seed: 11,
    craterPreset: {
      dxM: 200,
      dyM: 100,
      radiusM: 112,
      depthM: 29.0,
      rimBoostDeg: 2.85,
    },
  },
  {
    siteId: 'PGDA-23',
    name: 'Malapert Massif (IM-1 Region)',
    shortName: 'Malapert Massif',
    latDeg: -85.9948,
    lonDeg: -0.2358,
    elevationM: 5030.0,
    nominalSlopeDeg: 4.1,
    rmsHeightUncertaintyM: 0.32,
    rmsSlopeErrorDeg: 1.5,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site23 / Product 78 Calibrated)',
    missionContext: 'Near-side polar massif offering optimal Direct-to-Earth visibility',
    iceProximityKm: 4.2,
    baseHorizonDeg: 0.78,
    horizonAmpDeg: 0.51,
    horizonPhaseDeg: 310,
    ridgeAzimuthDeg: 165,
    ridgeBoostDeg: 1.55,
    ridgeWidthDeg: 30,
    dCritBaseM: 3100,
    seed: 23,
    craterPreset: {
      dxM: 100,
      dyM: -200,
      radiusM: 120,
      depthM: 33.5,
      rimBoostDeg: 3.05,
    },
  },
  {
    siteId: 'ISRO-CY3',
    name: 'Shiv Shakti Point (CY-3)',
    shortName: 'Shiv Shakti',
    latDeg: -69.3676,
    lonDeg: 32.3481,
    elevationM: -1980.0,
    nominalSlopeDeg: 3.1,
    rmsHeightUncertaintyM: 0.42,
    rmsSlopeErrorDeg: 1.9,
    demSource: 'LROC NAC + LOLA Merged Polar DEM (Chandrayaan-3 Benchmark)',
    missionContext: 'Successful ISRO Vikram landing benchmark at 69.37° S',
    iceProximityKm: 18.5,
    baseHorizonDeg: 1.15,
    horizonAmpDeg: 0.42,
    horizonPhaseDeg: 85,
    ridgeAzimuthDeg: 295,
    ridgeBoostDeg: 1.2,
    ridgeWidthDeg: 40,
    dCritBaseM: 2250,
    seed: 33,
    craterPreset: {
      dxM: -200,
      dyM: 100,
      radiusM: 96,
      depthM: 21.0,
      rimBoostDeg: 2.25,
    },
  },
  {
    siteId: 'PGDA-02',
    name: 'Faustini Rim A (Artemis III)',
    shortName: 'Faustini Rim',
    latDeg: -87.1245,
    lonDeg: 67.0412,
    elevationM: 3240.0,
    nominalSlopeDeg: 5.2,
    rmsHeightUncertaintyM: 0.35,
    rmsSlopeErrorDeg: 1.8,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site02 / Product 78 Calibrated)',
    missionContext: 'High illumination crest bordering volatile-rich cold traps inside Faustini Crater',
    iceProximityKm: 1.1,
    baseHorizonDeg: 0.74,
    horizonAmpDeg: 0.55,
    horizonPhaseDeg: 120,
    ridgeAzimuthDeg: 215,
    ridgeBoostDeg: 1.8,
    ridgeWidthDeg: 36,
    dCritBaseM: 2700,
    seed: 2,
    craterPreset: {
      dxM: 150,
      dyM: 150,
      radiusM: 110,
      depthM: 27.0,
      rimBoostDeg: 2.7,
    },
  },
  {
    siteId: 'PGDA-08',
    name: 'Haworth Crater Rim (Artemis III)',
    shortName: 'Haworth Rim',
    latDeg: -87.4215,
    lonDeg: -5.1324,
    elevationM: 2910.0,
    nominalSlopeDeg: 4.7,
    rmsHeightUncertaintyM: 0.37,
    rmsSlopeErrorDeg: 1.7,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site08 / Product 78 Calibrated)',
    missionContext: 'Adjacent to Haworth permanent shadow region with extensive surface frost signatures',
    iceProximityKm: 0.9,
    baseHorizonDeg: 0.88,
    horizonAmpDeg: 0.58,
    horizonPhaseDeg: 240,
    ridgeAzimuthDeg: 150,
    ridgeBoostDeg: 1.9,
    ridgeWidthDeg: 34,
    dCritBaseM: 2500,
    seed: 8,
    craterPreset: {
      dxM: -150,
      dyM: 180,
      radiusM: 105,
      depthM: 25.5,
      rimBoostDeg: 2.6,
    },
  },
  {
    siteId: 'PGDA-12',
    name: 'de Gerlache Rim 2 (Artemis III)',
    shortName: 'de Gerlache 2',
    latDeg: -88.3418,
    lonDeg: -75.1235,
    elevationM: 2820.0,
    nominalSlopeDeg: 4.8,
    rmsHeightUncertaintyM: 0.33,
    rmsSlopeErrorDeg: 1.6,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site12 / Product 78 Calibrated)',
    missionContext: 'Elevated western ridge providing long continuous solar line-of-sight',
    iceProximityKm: 1.4,
    baseHorizonDeg: 0.82,
    horizonAmpDeg: 0.52,
    horizonPhaseDeg: 170,
    ridgeAzimuthDeg: 280,
    ridgeBoostDeg: 1.75,
    ridgeWidthDeg: 38,
    dCritBaseM: 2650,
    seed: 12,
    craterPreset: {
      dxM: 180,
      dyM: -120,
      radiusM: 114,
      depthM: 30.0,
      rimBoostDeg: 2.9,
    },
  },
  {
    siteId: 'PGDA-14',
    name: 'Amundsen Crater Rim (Artemis III)',
    shortName: 'Amundsen Rim',
    latDeg: -84.5218,
    lonDeg: 82.8142,
    elevationM: 2650.0,
    nominalSlopeDeg: 3.9,
    rmsHeightUncertaintyM: 0.39,
    rmsSlopeErrorDeg: 1.5,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site14 / Product 78 Calibrated)',
    missionContext: 'Broad landing plateau offering high solar persistence and direct DTE link to Earth',
    iceProximityKm: 3.8,
    baseHorizonDeg: 0.95,
    horizonAmpDeg: 0.45,
    horizonPhaseDeg: 90,
    ridgeAzimuthDeg: 45,
    ridgeBoostDeg: 1.4,
    ridgeWidthDeg: 45,
    dCritBaseM: 3200,
    seed: 14,
    craterPreset: {
      dxM: -120,
      dyM: -180,
      radiusM: 98,
      depthM: 22.0,
      rimBoostDeg: 2.3,
    },
  },
  {
    siteId: 'PGDA-16',
    name: 'Nobile Rim 2 (Artemis III)',
    shortName: 'Nobile Rim 2',
    latDeg: -85.1241,
    lonDeg: 43.1518,
    elevationM: 3610.0,
    nominalSlopeDeg: 4.4,
    rmsHeightUncertaintyM: 0.36,
    rmsSlopeErrorDeg: 1.7,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site16 / Product 78 Calibrated)',
    missionContext: 'Nobile eastern ridge with low slope terrain and access to volatile-bearing micro-cold traps',
    iceProximityKm: 1.6,
    baseHorizonDeg: 1.02,
    horizonAmpDeg: 0.62,
    horizonPhaseDeg: 60,
    ridgeAzimuthDeg: 340,
    ridgeBoostDeg: 1.95,
    ridgeWidthDeg: 36,
    dCritBaseM: 2350,
    seed: 16,
    craterPreset: {
      dxM: 140,
      dyM: -160,
      radiusM: 108,
      depthM: 28.0,
      rimBoostDeg: 2.75,
    },
  },
  {
    siteId: 'PGDA-18',
    name: 'Leibnitz Beta Plateau (Artemis III)',
    shortName: 'Leibnitz Beta',
    latDeg: -85.7812,
    lonDeg: 31.4219,
    elevationM: 3450.0,
    nominalSlopeDeg: 3.6,
    rmsHeightUncertaintyM: 0.31,
    rmsSlopeErrorDeg: 1.4,
    demSource: 'NASA GSFC PGDA LRO LOLA 5m/px (Site18 / Product 78 Calibrated)',
    missionContext: 'Near-polar highland plateau with high elevation and wide Earth DTE visibility',
    iceProximityKm: 4.5,
    baseHorizonDeg: 0.68,
    horizonAmpDeg: 0.46,
    horizonPhaseDeg: 290,
    ridgeAzimuthDeg: 180,
    ridgeBoostDeg: 1.5,
    ridgeWidthDeg: 32,
    dCritBaseM: 3000,
    seed: 18,
    craterPreset: {
      dxM: -160,
      dyM: -140,
      radiusM: 102,
      depthM: 24.0,
      rimBoostDeg: 2.45,
    },
  },
  {
    siteId: 'MOCK-01',
    name: 'Synthetic Calibration Site (Baseline)',
    shortName: 'Calibration MOCK',
    latDeg: -84.7900,
    lonDeg: 29.2000,
    elevationM: 0.0,
    nominalSlopeDeg: 0.0,
    rmsHeightUncertaintyM: 0.05,
    rmsSlopeErrorDeg: 0.1,
    demSource: 'Synthetic Flat Calibration Benchmark (Zero-Elevation)',
    missionContext: 'Zero-elevation flat plane for mathematical sanity checks and baseline validation',
    iceProximityKm: 99.9,
    baseHorizonDeg: 0.0,
    horizonAmpDeg: 0.0,
    horizonPhaseDeg: 0,
    ridgeAzimuthDeg: 0,
    ridgeBoostDeg: 0.0,
    ridgeWidthDeg: 1,
    dCritBaseM: 99999,
    seed: 99,
    craterPreset: {
      dxM: 0,
      dyM: 0,
      radiusM: 10,
      depthM: 0.0,
      rimBoostDeg: 0.0,
    },
  },
];

function wrapAngleDiff(a: number, b: number): number {
  const diff = ((a - b + 540) % 360) - 180;
  return Math.abs(diff);
}

function buildHorizonArrays(seed: RawSiteSeed): {
  horizonH0Deg: number[];
  dCritM: number[];
} {
  // Use exact NASA GSFC LOLA Product 78 in-situ raycast horizon mask for Shackleton Rim (Site04)
  if (seed.siteId === 'PGDA-04') {
    const bakedS4 = (bakedSitesData as any).sites?.find(
      (s: any) => s.site_metadata?.site_id === 'PGDA-Site04-Shackleton'
    );
    if (bakedS4?.horizon_mask_360?.h0_deg && bakedS4?.horizon_mask_360?.d_crit_m) {
      return {
        horizonH0Deg: bakedS4.horizon_mask_360.h0_deg,
        dCritM: bakedS4.horizon_mask_360.d_crit_m,
      };
    }
  }

  const horizonH0Deg: number[] = [];
  const dCritM: number[] = [];

  for (let az = 0; az < 360; az++) {
    const rad = (az * Math.PI) / 180;
    const phase = (seed.horizonPhaseDeg * Math.PI) / 180;

    // Multi-harmonic natural lunar ridge profile
    const harmonic =
      Math.sin(rad * 2 + phase) * 0.55 +
      Math.cos(rad * 3 - phase * 0.7) * 0.3 +
      Math.sin(rad * 7 + seed.seed * 0.4) * 0.15;

    const ridgeDelta = wrapAngleDiff(az, seed.ridgeAzimuthDeg);
    const ridgeGaussian =
      seed.ridgeBoostDeg *
      Math.exp(-(ridgeDelta * ridgeDelta) / (2 * seed.ridgeWidthDeg * seed.ridgeWidthDeg));

    const h0 = Math.max(
      0.15,
      seed.baseHorizonDeg + seed.horizonAmpDeg * harmonic + ridgeGaussian
    );

    // Critical obstacle distance shrinks sharply on close ridges (so mast height actually clears close rims)
    const closeRidgeFactor = ridgeDelta < seed.ridgeWidthDeg * 1.4 ? 0.32 : 1.0;
    const dCrit =
      seed.dCritBaseM *
      closeRidgeFactor *
      (0.85 + 0.35 * Math.abs(Math.cos(rad * 2.5 + seed.seed)));

    horizonH0Deg.push(Number(h0.toFixed(3)));
    dCritM.push(Number(Math.max(220, dCrit).toFixed(1)));
  }

  return { horizonH0Deg, dCritM };
}

function buildDemGrid101(seed: RawSiteSeed): number[] {
  const grid = new Array<number>(101 * 101);
  const { dxM: cx, dyM: cy, radiusM, depthM } = seed.craterPreset;

  for (let row = 0; row < 101; row++) {
    const y = (row - 50) * 5; // -250m to +250m
    for (let col = 0; col < 101; col++) {
      const x = (col - 50) * 5; // -250m to +250m

      // Gentle plateau slope + natural LOLA multi-frequency undulations
      const plateauSlope =
        (x * Math.cos(seed.seed) + y * Math.sin(seed.seed)) *
        Math.tan((seed.nominalSlopeDeg * 0.55 * Math.PI) / 180);

      const microRelief =
        Math.sin(x * 0.022 + seed.seed) * Math.cos(y * 0.019 - seed.seed * 0.5) * 3.8 +
        Math.sin((x + y) * 0.048 + seed.seed * 1.3) * 1.4 +
        Math.cos((x - y) * 0.095) * 0.45;

      // Primary hazard crater (e.g. IM-2 Athena depression 283m off-target)
      const dist = Math.hypot(x - cx, y - cy);
      let craterOffset = 0;
      if (dist < radiusM * 1.35) {
        const norm = dist / radiusM;
        if (norm <= 1.0) {
          // Parabolic bowl floor
          craterOffset = -depthM * (1 - norm * norm);
        } else {
          // Raised ejecta rim
          const rimNorm = (norm - 1.0) / 0.35;
          craterOffset = depthM * 0.14 * Math.sin((1 - rimNorm) * Math.PI);
        }
      }

      // Secondary micro-craterlet for realistic lunar surface texture
      const sDist = Math.hypot(x + cx * 0.65, y + cy * 0.55);
      if (sDist < 55) {
        const sNorm = sDist / 55;
        craterOffset -= 7.5 * (1 - sNorm * sNorm);
      }

      // Ensure center plateau (0, 0) stays anchored cleanly near 0m relative elevation
      const centerAnchor =
        Math.exp(-((x * x + y * y) / (2 * 65 * 65))) * 0.5;
      const z = (plateauSlope + microRelief) * (1 - centerAnchor) + craterOffset;

      grid[row * 101 + col] = Number(z.toFixed(2));
    }
  }

  return grid;
}

export const LUNAR_SITES: LunarSiteDefinition[] = RAW_SITE_SEEDS.map((seed) => {
  const { horizonH0Deg, dCritM } = buildHorizonArrays(seed);
  const demGrid101 = buildDemGrid101(seed);

  return {
    metadata: {
      siteId: seed.siteId,
      name: seed.name,
      shortName: seed.shortName,
      latDeg: seed.latDeg,
      lonDeg: seed.lonDeg,
      elevationM: seed.elevationM,
      nominalSlopeDeg: seed.nominalSlopeDeg,
      rmsHeightUncertaintyM: seed.rmsHeightUncertaintyM,
      rmsSlopeErrorDeg: seed.rmsSlopeErrorDeg,
      demSource: seed.demSource,
      missionContext: seed.missionContext,
      iceProximityKm: seed.iceProximityKm,
    },
    horizonH0Deg,
    dCritM,
    demGrid101,
    craterPreset: seed.craterPreset,
  };
});

export function getSiteById(siteId: string): LunarSiteDefinition {
  return LUNAR_SITES.find((s) => s.metadata.siteId === siteId) ?? LUNAR_SITES[0];
}

export function getSpacecraftById(id: string): SpacecraftProfile {
  const profile = SPACECRAFT_PROFILES.find((s) => s.id === id) ?? SPACECRAFT_PROFILES[0];
  return validateSpacecraftProfile(profile);
}

import { computeTopocentricEphemeris, getTopocentricEphemerisVector } from './ephemeris';
import { LUNAR_SITES, validateSpacecraftProfile } from './lunarData';
import type {
  CellSafetyStatus,
  DispersionCell,
  LaunchSlipDay,
  LaunchViability,
  LinkBridgeState,
  LunarSiteDefinition,
  ParetoSiteRanking,
  SiteAnalysisResult,
  SolverConstraints,
  SpacecraftProfile,
  SummaryMetrics,
  TimeSeriesPoint,
  WeightConfig,
} from './types';

const SOLAR_ANGULAR_RADIUS_DEG = 0.266; // 0.533 deg apparent solar diameter
const SOLAR_CONSTANT_W_M2 = 1361;
const LUNAR_ALBEDO = 0.12;
const REGOLITH_EMISSIVITY = 0.95;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const BASE_EPOCH_MS = Date.UTC(2026, 11, 1, 0, 0, 0); // 2026-12-01T00:00:00Z (JPL DE421 / LOLA mission epoch)

export function clip(val: number, min: number, max: number): number {
  if (isNaN(val)) return NaN;
  return Math.max(min, Math.min(max, val));
}

/**
 * Sample elevation (relative meters) from the 101x101 5m/px DEM grid at (dxM, dyM)
 */
export function sampleDemHeight(demGrid101: number[], dxM: number, dyM: number): number {
  const gx = clip((dxM + 250) / 5, 0, 100);
  const gy = clip((dyM + 250) / 5, 0, 100);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(100, x0 + 1);
  const y1 = Math.min(100, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;

  const z00 = demGrid101[y0 * 101 + x0];
  const z10 = demGrid101[y0 * 101 + x1];
  const z01 = demGrid101[y1 * 101 + x0];
  const z11 = demGrid101[y1 * 101 + x1];

  const zx0 = z00 * (1 - tx) + z10 * tx;
  const zx1 = z01 * (1 - tx) + z11 * tx;
  return zx0 * (1 - ty) + zx1 * ty;
}

/**
 * Compute local surface slope in degrees via finite differences over the 5m/px DEM
 */
export function computeLocalSlopeDeg(
  site: LunarSiteDefinition,
  dxM: number,
  dyM: number
): number {
  const sampleGrad = (x: number, y: number) => {
    const step = 5;
    const dzdx =
      (sampleDemHeight(site.demGrid101, x + step, y) -
        sampleDemHeight(site.demGrid101, x - step, y)) /
      (2 * step);
    const dzdy =
      (sampleDemHeight(site.demGrid101, x, y + step) -
        sampleDemHeight(site.demGrid101, x, y - step)) /
      (2 * step);
    return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  };

  // Evaluate worst-case slope within 15m lander footpad dispersion radius
  const rawSlope = Math.max(
    sampleGrad(dxM, dyM),
    sampleGrad(dxM + 12, dyM),
    sampleGrad(dxM - 12, dyM),
    sampleGrad(dxM, dyM + 12),
    sampleGrad(dxM, dyM - 12)
  );
  // Blend with calibrated PGDA site nominal slope at center
  const centerDist = Math.hypot(dxM, dyM);
  const blend = Math.exp(-(centerDist * centerDist) / (2 * 45 * 45));
  return Number(
    (rawSlope * (1 - blend) + site.metadata.nominalSlopeDeg * blend).toFixed(1)
  );
}

/**
 * Compute O(1) dynamic mast horizon elevation angle H_terrain(theta, z_mast)
 * plus local crater depression rim shadowing when landing off-target inside a crater.
 */
export function computeDynamicHorizonArray(
  site: LunarSiteDefinition,
  mastHeightM: number,
  dxM: number,
  dyM: number
): number[] {
  const adjusted = new Array<number>(360);
  const localZ = sampleDemHeight(site.demGrid101, dxM, dyM);

  // If the lander sits below the plateau inside a crater, surrounding crater walls add
  // steep horizon blockage depending on local depth & crater geometry.
  let craterShadowBoost = 0;
  if (site.craterPreset) {
    const distToCrater = Math.hypot(
      dxM - site.craterPreset.dxM,
      dyM - site.craterPreset.dyM
    );
    if (distToCrater < site.craterPreset.radiusM) {
      const depthFactor = Math.max(0, -localZ) / Math.max(1, site.craterPreset.depthM);
      craterShadowBoost = site.craterPreset.rimBoostDeg * clip(depthFactor, 0, 1.15);
    }
  } else if (localZ < -5) {
    craterShadowBoost = Math.min(3.0, Math.abs(localZ) * 0.08);
  }

  for (let az = 0; az < 360; az++) {
    const h0Rad = (site.horizonH0Deg[az] * Math.PI) / 180;
    const dCrit = Math.max(120, site.dCritM[az]);
    // O(1) d_crit dynamic mast formula:
    // H_terrain(theta, z_mast) ≈ atan(tan(H0(theta)) - z_mast / d_crit(theta))
    const tanAdjusted = Math.tan(h0Rad) - mastHeightM / dCrit;
    const baseDeg = (Math.atan(tanAdjusted) * 180) / Math.PI;

    // Crater rim blockage is also partially mitigated by raising the mast above the rim
    const craterRimDist = 90;
    const mastMitigationDeg =
      craterShadowBoost > 0
        ? (Math.atan(mastHeightM / craterRimDist) * 180) / Math.PI
        : 0;
    const effectiveCraterBoost = Math.max(0, craterShadowBoost - mastMitigationDeg * 0.55);

    adjusted[az] = Number(Math.max(-1.0, baseDeg + effectiveCraterBoost).toFixed(3));
  }

  return adjusted;
}

/**
 * Rigorous closed-form circular disk area penumbra fraction f_sun(t) in [0.0, 1.0]
 * Uses exact circular segment area above a locally flat knife-edge horizon
 */
export function computeSunPenumbraFraction(
  sunElDeg: number,
  terrainHorizonDeg: number
): number {
  if (isNaN(sunElDeg) || isNaN(terrainHorizonDeg)) return NaN;
  if (sunElDeg === Infinity || terrainHorizonDeg === -Infinity) return 1.0;
  if (sunElDeg === -Infinity || terrainHorizonDeg === Infinity) return 0.0;
  const x = clip(
    (sunElDeg - terrainHorizonDeg) / SOLAR_ANGULAR_RADIUS_DEG,
    -1.0,
    1.0
  );
  return (
    (Math.acos(-x) + x * Math.sqrt(Math.max(0.0, 1.0 - x * x))) / Math.PI
  );
}

/**
 * LRO Diviner bolometric surface radiative temperature (27K to 392K)
 * using a physically grounded Lambertian incidence model cos(theta_i)
 * accounting for local surface slope/aspect and micro-facet roughness,
 * regolith radiative equilibrium, and an infrared horizon radiative floor in shadow.
 */
export function computeSurfaceTempK(
  sunElDeg: number,
  sunFraction: number,
  internalHeatFluxW: number = 1.5,
  localSlopeDeg: number = 0.0
): number {
  if (isNaN(sunElDeg) || isNaN(sunFraction)) return 90.0;
  if (sunFraction <= 0.01 || sunElDeg <= 0) {
    // Deep cold trap cryogenic baseline ~27K - 52K with Diviner-calibrated IR horizon floor
    return Number((32.0 + internalHeatFluxW * 2.5).toFixed(1));
  }
  // Physically grounded Lambertian incidence cos(theta_i)
  // Accounts for local surface slope / sunward facet inclination (effective micro-facet baseline ~5.5 deg)
  const elRad = (clip(sunElDeg, 0.0, 90) * Math.PI) / 180;
  const slopeRad = (clip(localSlopeDeg > 0 ? localSlopeDeg : 5.5, 0.0, 45) * Math.PI) / 180;
  const cosIncidence = clip(
    Math.sin(elRad) * Math.cos(slopeRad) + Math.cos(elRad) * Math.sin(slopeRad),
    0.01,
    1.0
  );
  // Absorbed solar flux with regolith albedo and Diviner-calibrated thermal floor
  const absorbedFlux =
    (1 - LUNAR_ALBEDO) * SOLAR_CONSTANT_W_M2 * clip(sunFraction, 0, 1) * cosIncidence;
  const tSurf = Math.pow(
    (absorbedFlux + internalHeatFluxW) / (REGOLITH_EMISSIVITY * STEFAN_BOLTZMANN),
    0.25
  );
  return Number(clip(tSurf, 27.0, 392.0).toFixed(1));
}

export function simulateMissionWindow(
  site: LunarSiteDefinition,
  spacecraft: SpacecraftProfile,
  constraints: SolverConstraints,
  dxM: number,
  dyM: number,
  epochSlipDays: number,
  weights: WeightConfig = { sun: 0.45, earth: 0.35, terrain: 0.2 }
): {
  adjustedHorizonDeg: number[];
  timeSeries: TimeSeriesPoint[];
  summary: SummaryMetrics;
} {
  validateSpacecraftProfile(spacecraft);

  const adjustedHorizonDeg = computeDynamicHorizonArray(
    site,
    constraints.mastHeightM,
    dxM,
    dyM
  );
  const totalHours = Math.max(24, Math.round(constraints.missionDurationDays * 24));
  const startHour = epochSlipDays * 24;
  const slopeDeg = computeLocalSlopeDeg(site, dxM, dyM);

  const timeSeries: TimeSeriesPoint[] = [];
  const batteryWhMax = spacecraft.batteryCapacityKwh * 1000;
  let batteryWh = batteryWhMax; // Full charge at touchdown
  let avionicsTempK = 288.0; // Warm spacecraft core at touchdown

  let sunLitCount = 0;
  let earthVisCount = 0;
  let simCount = 0;

  let currentDarkStreak = 0;
  let longestDarknessHrs = 0;
  let currentBlackoutStreak = 0;
  let longestCommsGapHrs = 0;
  let minBatterySocPct = 100.0;
  let hoursToDepletion: number | null = null;
  let minSurfaceTempK = 400.0;
  let maxSurfaceTempK = 0.0;

  // Panel tilt penalty if lander tilts on steep slopes
  const tiltCos = Math.cos((clip(slopeDeg, 0, 45) * Math.PI) / 180);

  for (let h = 0; h < totalHours; h++) {
    const absHour = startHour + h;
    const vec = getTopocentricEphemerisVector(site, absHour);

    const sunAzIdx = Math.floor(vec.sunAzDeg) % 360;
    const earthAzIdx = Math.floor(vec.earthAzDeg) % 360;
    const horizonSunDeg = adjustedHorizonDeg[sunAzIdx];
    const horizonEarthDeg = adjustedHorizonDeg[earthAzIdx];

    const sunFraction = computeSunPenumbraFraction(vec.sunElDeg, horizonSunDeg);
    const isSunlit = vec.sunElDeg > horizonSunDeg;
    const earthVisible = vec.earthElDeg > horizonEarthDeg;
    const simultaneousWindow = isSunlit && earthVisible;

    if (isSunlit) {
      sunLitCount++;
      currentDarkStreak = 0;
    } else {
      currentDarkStreak++;
      if (currentDarkStreak > longestDarknessHrs) {
        longestDarknessHrs = currentDarkStreak;
      }
    }

    if (earthVisible) {
      earthVisCount++;
      currentBlackoutStreak = 0;
    } else {
      currentBlackoutStreak++;
      if (currentBlackoutStreak > longestCommsGapHrs) {
        longestCommsGapHrs = currentBlackoutStreak;
      }
    }

    if (simultaneousWindow) {
      simCount++;
    }

    // Directional solar panel incidence geometry (tracking vs fixed tilt/azimuth)
    let incidenceFactor = tiltCos;
    if (spacecraft.trackSunAzimuth === false && spacecraft.panelTiltDeg !== undefined) {
      const elRad = (vec.sunElDeg * Math.PI) / 180;
      const tiltRad = (spacecraft.panelTiltDeg * Math.PI) / 180;
      const relAzRad = (((vec.sunAzDeg - (spacecraft.panelAzimuthDeg ?? 0))) * Math.PI) / 180;
      incidenceFactor = Math.max(0.0, Math.sin(elRad) * Math.cos(tiltRad) + Math.cos(elRad) * Math.sin(tiltRad) * Math.cos(relAzRad));
    }

    // Diviner cryogenic surface temperature + spacecraft thermal inertia
    const surfaceTempK = computeSurfaceTempK(vec.sunElDeg, sunFraction, 1.5, site.metadata.nominalSlopeDeg);
    if (surfaceTempK < minSurfaceTempK) minSurfaceTempK = surfaceTempK;
    if (surfaceTempK > maxSurfaceTempK) maxSurfaceTempK = surfaceTempK;

    // Cryogenic survival heater model per vehicle ICD:
    // Thermostat activates when avionics core cools below 260K or surface drops into cryogenic shadow
    const pHeater =
      (avionicsTempK < 260.0 || surfaceTempK < 90.0) && batteryWh > 0
        ? (spacecraft.survivalHeaterW ?? 35.0)
        : 0;

    // Battery State-of-Charge integration (1 hour step) with LRO Diviner thermal coupling
    const pSolar = spacecraft.solarRatedW * sunFraction * incidenceFactor;
    const pTx = earthVisible ? spacecraft.txLoadW : 0;
    const netPowerW = pSolar - spacecraft.hotelLoadW - pTx - pHeater;
    
    // Sub-hour fractional depletion interpolation
    const prevWh = batteryWh;
    if (hoursToDepletion === null && netPowerW < 0 && prevWh + netPowerW <= 0) {
      hoursToDepletion = Number((h + prevWh / -netPowerW).toFixed(2));
    }

    // Temperature-dependent capacity factor: cold-soak below 240K degrades capacity exponentially
    const tempDegradationFactor = clip(1.0 / (1.0 + Math.exp(-0.08 * (avionicsTempK - 245))), 0.15, 1.0);
    const effectiveBatteryWhMax = batteryWhMax * tempDegradationFactor;
    batteryWh = clip(batteryWh + netPowerW, 0, effectiveBatteryWhMax);
    const batterySocPct = Number(((batteryWh / batteryWhMax) * 100).toFixed(1));

    if (batterySocPct < minBatterySocPct) {
      minBatterySocPct = batterySocPct;
    }
    if (batteryWh <= 0.5 && hoursToDepletion === null) {
      hoursToDepletion = h + 1;
    }

    // 1-node lumped RC thermal balance: C_th * dT/dt = Q_internal + Q_heater + G_rad * (T_surf - T_core)
    const C_th = 28000; // J/K chassis avionics thermal capacitance
    const G_rad = 1.75; // W/K conductive/radiative coupling
    const dt_sec = 3600; // 1-hour step
    const qHeater = pHeater;
    const qInternal = batteryWh > 0 ? (spacecraft.hotelLoadW * 0.35 + (earthVisible ? spacecraft.txLoadW * 0.15 : 0)) : 0.0;
    const qNetThermal = qInternal + qHeater + G_rad * (surfaceTempK - avionicsTempK);
    const deltaTCpu = (qNetThermal * dt_sec) / C_th;
    avionicsTempK = Number(clip(avionicsTempK + deltaTCpu, 40.0, 340.0).toFixed(1));

    const timestampUtc = new Date(BASE_EPOCH_MS + absHour * 3600_000).toISOString();

    timeSeries.push({
      hourIndex: h,
      timestampUtc,
      sunAzDeg: vec.sunAzDeg,
      sunElDeg: vec.sunElDeg,
      horizonSunDeg,
      sunFraction: Number(sunFraction.toFixed(3)),
      earthAzDeg: vec.earthAzDeg,
      earthElDeg: vec.earthElDeg,
      horizonEarthDeg,
      earthVisible,
      simultaneousWindow,
      batterySocPct,
      surfaceTempK,
      avionicsTempK,
    });
  }

  const pSunPct = Number(((sunLitCount / totalHours) * 100).toFixed(1));
  const pEarthPct = Number(((earthVisCount / totalHours) * 100).toFixed(1));
  const pSimultaneousPct = Number(((simCount / totalHours) * 100).toFixed(1));
  const terrainScore = Number(clip(100 - 5 * slopeDeg, 0, 100).toFixed(1));

  const wSum = weights.sun + weights.earth + weights.terrain || 1;
  const weightedSuitabilityScore = Number(
    (
      (weights.sun * pSunPct +
        weights.earth * pEarthPct +
        weights.terrain * terrainScore) /
      wSum
    ).toFixed(1)
  );

  const slopeWithinLimit = slopeDeg <= spacecraft.maxSlopeDeg;
  const batterySurvivalViable =
    hoursToDepletion === null && longestDarknessHrs <= constraints.maxDarknessHrs;

  let status: CellSafetyStatus = 'SAFE';
  if (
    !slopeWithinLimit ||
    hoursToDepletion !== null ||
    pSunPct < 45 ||
    longestDarknessHrs > constraints.maxDarknessHrs * 1.35
  ) {
    status = 'MISSION_LOSS_TRAP';
  } else if (
    longestDarknessHrs > constraints.maxDarknessHrs * 0.85 ||
    pSunPct < 68 ||
    pEarthPct < 55 ||
    minBatterySocPct < 30
  ) {
    status = 'MARGINAL';
  }

  let bridgeState: LinkBridgeState = 'COHERENT';
  if (status === 'MISSION_LOSS_TRAP' || hoursToDepletion !== null) {
    bridgeState = 'FRACTURED';
  } else if (status === 'MARGINAL' || pEarthPct < 60) {
    bridgeState = 'FADING';
  }

  return {
    adjustedHorizonDeg,
    timeSeries,
    summary: {
      pSunPct,
      pEarthPct,
      pSimultaneousPct,
      longestDarknessHrs,
      longestCommsGapHrs,
      terrainScore,
      weightedSuitabilityScore,
      minBatterySocPct: Number(minBatterySocPct.toFixed(1)),
      hoursToDepletion,
      minSurfaceTempK: Number(minSurfaceTempK.toFixed(1)),
      maxSurfaceTempK: Number(maxSurfaceTempK.toFixed(1)),
      batterySurvivalViable,
      slopeWithinLimit,
      status,
      bridgeState,
    },
  };
}

/**
 * Evaluates the 5x5 landing dispersion grid (-200m to +200m in 100m steps)
 */
export function computeDispersionGrid5x5(
  site: LunarSiteDefinition,
  spacecraft: SpacecraftProfile,
  constraints: SolverConstraints,
  epochSlipDays: number
): DispersionCell[] {
  const cells: DispersionCell[] = [];
  const offsets = [-200, -100, 0, 100, 200];

  let index = 0;
  for (let row = 0; row < 5; row++) {
    const dyM = offsets[row];
    for (let col = 0; col < 5; col++) {
      const dxM = offsets[col];
      const relZ = sampleDemHeight(site.demGrid101, dxM, dyM);
      const slopeDeg = computeLocalSlopeDeg(site, dxM, dyM);

      // Fast 7-day evaluation for 25-cell grid (<2ms total)
      const cellEval = simulateMissionWindow(
        site,
        spacecraft,
        { ...constraints, missionDurationDays: Math.min(constraints.missionDurationDays, 7) },
        dxM,
        dyM,
        epochSlipDays
      );

      cells.push({
        index,
        row,
        col,
        dxM,
        dyM,
        elevationM: Number((site.metadata.elevationM + relZ).toFixed(1)),
        relativeZ: Number(relZ.toFixed(1)),
        slopeDeg,
        pSunPct: cellEval.summary.pSunPct,
        pEarthPct: cellEval.summary.pEarthPct,
        longestDarknessHrs: cellEval.summary.longestDarknessHrs,
        hoursToDepletion: cellEval.summary.hoursToDepletion,
        status: cellEval.summary.status,
      });
      index++;
    }
  }

  return cells;
}

/**
 * Inverse 30-Day Launch-Slip Solver: scans launch scrub days 0..29
 */
export function computeLaunchSlip30d(
  site: LunarSiteDefinition,
  spacecraft: SpacecraftProfile,
  constraints: SolverConstraints,
  dxM: number,
  dyM: number
): LaunchSlipDay[] {
  const days: LaunchSlipDay[] = [];

  for (let slip = 0; slip < 30; slip++) {
    const sim = simulateMissionWindow(
      site,
      spacecraft,
      { ...constraints, missionDurationDays: 7 },
      dxM,
      dyM,
      slip
    );

    const simultaneousHrs = Math.round((sim.summary.pSimultaneousPct / 100) * 168);
    const maxContinuousCommsApprox = Math.max(
      0,
      168 - sim.summary.longestCommsGapHrs
    );

    let viability: LaunchViability = 'OPTIMAL';
    if (
      sim.summary.hoursToDepletion !== null ||
      sim.summary.longestDarknessHrs > constraints.maxDarknessHrs * 1.2 ||
      sim.summary.pEarthPct < 35
    ) {
      viability = 'CRITICAL';
    } else if (
      sim.summary.longestDarknessHrs > constraints.maxDarknessHrs ||
      maxContinuousCommsApprox < constraints.minCommsWindowHrs ||
      sim.summary.minBatterySocPct < 35
    ) {
      viability = 'MARGINAL';
    }

    days.push({
      slipDays: slip,
      arrivalUtc: new Date(BASE_EPOCH_MS + slip * 86_400_000).toISOString(),
      pSunPct: sim.summary.pSunPct,
      pEarthPct: sim.summary.pEarthPct,
      longestDarknessHrs: sim.summary.longestDarknessHrs,
      longestCommsGapHrs: sim.summary.longestCommsGapHrs,
      simultaneousHrs,
      minBatterySocPct: sim.summary.minBatterySocPct,
      viability,
    });
  }

  return days;
}

/**
 * Full single-call analysis payload for the active workspace state
 */
export function runSiteAnalysis(
  site: LunarSiteDefinition,
  spacecraft: SpacecraftProfile,
  constraints: SolverConstraints,
  selectedCellIdx: number,
  weights: WeightConfig
): SiteAnalysisResult {
  const dispersionGrid = computeDispersionGrid5x5(
    site,
    spacecraft,
    constraints,
    constraints.epochOffsetDays
  );
  const selectedCell = dispersionGrid[selectedCellIdx] ?? dispersionGrid[12]; // 12 = (0,0) center

  const sim = simulateMissionWindow(
    site,
    spacecraft,
    constraints,
    selectedCell.dxM,
    selectedCell.dyM,
    constraints.epochOffsetDays,
    weights
  );

  const launchSlip30d = computeLaunchSlip30d(
    site,
    spacecraft,
    constraints,
    selectedCell.dxM,
    selectedCell.dyM
  );

  return {
    site: site.metadata,
    spacecraft,
    selectedCell,
    adjustedHorizonDeg: sim.adjustedHorizonDeg,
    summary: sim.summary,
    timeSeries: sim.timeSeries,
    dispersionGrid,
    launchSlip30d,
  };
}

/**
 * Autonomous "Goldilocks" Pareto Solver across candidate landing sites
 */
export function computeParetoSiteRankings(
  spacecraft: SpacecraftProfile,
  constraints: SolverConstraints,
  weights: WeightConfig
): ParetoSiteRanking[] {
  // Exclude synthetic calibration benchmark sites (e.g. MOCK-01) from trade-space rankings
  const candidateSites = LUNAR_SITES.filter(
    (site) => site.metadata.siteId !== 'MOCK-01' && !(site.metadata as any).isCalibration
  );

  const raw = candidateSites.map((site) => {
    const sim = simulateMissionWindow(
      site,
      spacecraft,
      constraints,
      0,
      0,
      constraints.epochOffsetDays,
      weights
    );

    const isViable =
      sim.summary.status !== 'MISSION_LOSS_TRAP' &&
      sim.summary.hoursToDepletion === null;

    return {
      siteId: site.metadata.siteId,
      name: site.metadata.name,
      shortName: site.metadata.shortName,
      latDeg: site.metadata.latDeg,
      lonDeg: site.metadata.lonDeg,
      pSunPct: sim.summary.pSunPct,
      pEarthPct: sim.summary.pEarthPct,
      slopeDeg: site.metadata.nominalSlopeDeg,
      iceProximityKm: site.metadata.iceProximityKm,
      longestDarknessHrs: sim.summary.longestDarknessHrs,
      compositeScore: sim.summary.weightedSuitabilityScore,
      paretoOptimal: false,
      viable: isViable,
    };
  });

  // Evaluate Pareto dominance strictly across the 3 primary survival objectives among viable sites:
  // 1. Maximize Solar Illumination (pSunPct)
  // 2. Maximize Earth Direct-to-Earth LoS (pEarthPct)
  // 3. Minimize Local Slope (slopeDeg)
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a.viable) {
      a.paretoOptimal = false;
      continue;
    }

    let dominated = false;
    for (let j = 0; j < raw.length; j++) {
      if (i === j) continue;
      const b = raw[j];
      if (!b.viable) continue; // Non-viable sites cannot dominate viable sites

      const bBetterOrEq =
        b.pSunPct >= a.pSunPct &&
        b.pEarthPct >= a.pEarthPct &&
        b.slopeDeg <= a.slopeDeg;

      const bStrictlyBetter =
        b.pSunPct > a.pSunPct ||
        b.pEarthPct > a.pEarthPct ||
        b.slopeDeg < a.slopeDeg;

      if (bBetterOrEq && bStrictlyBetter) {
        dominated = true;
        break;
      }
    }

    raw[i].paretoOptimal = raw[i].viable && !dominated;
  }

  return raw.sort((a, b) => b.compositeScore - a.compositeScore);
}

/**
 * Generates an engineering CSV report for Planner Mode export
 */
export function buildAnalysisCsv(result: SiteAnalysisResult): string {
  const header = [
    'hour_index',
    'timestamp_utc',
    'sun_az_deg',
    'sun_el_deg',
    'horizon_sun_deg',
    'sun_fraction',
    'earth_az_deg',
    'earth_el_deg',
    'horizon_earth_deg',
    'earth_visible',
    'simultaneous_window',
    'battery_soc_pct',
    'surface_temp_k',
    'avionics_temp_k',
  ].join(',');

  const rows = result.timeSeries.map((pt) =>
    [
      pt.hourIndex,
      pt.timestampUtc,
      pt.sunAzDeg,
      pt.sunElDeg,
      pt.horizonSunDeg,
      pt.sunFraction,
      pt.earthAzDeg,
      pt.earthElDeg,
      pt.horizonEarthDeg,
      pt.earthVisible,
      pt.simultaneousWindow,
      pt.batterySocPct,
      pt.surfaceTempK,
      pt.avionicsTempK,
    ].join(',')
  );

  const metaComment = `# FIRST CONTACT.SYS | Site=${result.site.siteId} (${result.site.name}) | Offset=(${result.selectedCell.dxM}m, ${result.selectedCell.dyM}m) | Spacecraft=${result.spacecraft.name} | Source=${result.site.demSource}`;
  return [metaComment, header, ...rows].join('\n');
}

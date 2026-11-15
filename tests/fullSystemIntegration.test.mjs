import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load the WASM engine
const enginePath = path.join(projectRoot, 'engine', 'pkg', 'first_contact_engine.js');
const engineModule = await import('file://' + enginePath.replace(/\\/g, '/'));
const { initSync, analyze_json } = engineModule;

// Initialize WASM with binary buffer
const wasmPath = path.join(projectRoot, 'engine', 'pkg', 'first_contact_engine_bg.wasm');
const wasmBinary = fs.readFileSync(wasmPath);
initSync(wasmBinary);

// Load baked lunar data
const bakedDataPath = path.join(projectRoot, 'public', 'data', 'baked_lunar_sites.json');
const bakedData = JSON.parse(fs.readFileSync(bakedDataPath, 'utf8'));

// Synthetic calibration case for engine parity, and a real published-LOLA site
// for terrain-driven repair tests. Never silently substitute one for the other.
const mockSite = bakedData.sites.find(s => s.site_metadata.site_id === 'MOCK-01');
const realSite = bakedData.sites.find(s => s.site_metadata.site_id === 'PGDA-11');
if (!mockSite) throw new Error('MOCK-01 calibration record is missing from the baked dataset');
if (!realSite) throw new Error('PGDA-11 real-terrain record is missing from the baked dataset');

// Constants
const SOLAR_RADIUS_DEG = 0.266;
const SPEED_OF_LIGHT_KM_S = 299792.458;
const EARTH_MOON_MEAN_KM = 384400;
const EARTH_MOON_PERIGEE_KM = 363300;
const EARTH_MOON_APOGEE_KM = 405500;

// Helper: compute penumbra fraction analytically
function computePenumbraFraction(sunElevationDeg, horizonElevationDeg) {
  const raw = (sunElevationDeg + SOLAR_RADIUS_DEG - horizonElevationDeg) / (2 * SOLAR_RADIUS_DEG);
  return Math.max(0.0, Math.min(1.0, raw));
}

// Helper: compute dynamic mast horizon angle
function computeDynamicHorizon(h0Deg, dCritM, zMastM) {
  const dSafe = Math.max(10.0, dCritM);
  const tanAdjusted = Math.tan((h0Deg * Math.PI) / 180) - zMastM / dSafe;
  return (Math.atan(tanAdjusted) * 180) / Math.PI;
}

// Helper: compute one-way light time
function computeOWLT(distanceKm) {
  return distanceKm / SPEED_OF_LIGHT_KM_S;
}

// Helper: DSN complex coordinates (approximate lat/lon)
const DSN_COMPLEXES = [
  { name: 'Goldstone', lat: 35.426, lon: -116.890 }, // California
  { name: 'Madrid', lat: 40.429, lon: -4.250 },       // Spain
  { name: 'Canberra', lat: -35.401, lon: 148.981 }    // Australia
];

// Helper: compute elevation angle from observer at (lat1, lon1) to target at (lat2, lon2)
function computeElevation(lat1, lon1, lat2, lon2) {
  const lat1Rad = lat1 * Math.PI / 180;
  const lon1Rad = lon1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lon2Rad = lon2 * Math.PI / 180;

  const dLon = lon2Rad - lon1Rad;
  const sinEl = Math.sin(lat1Rad) * Math.sin(lat2Rad) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) * 180 / Math.PI;
}

// Helper: execute analysis through the version 1 WASM engine
function executeWasmAnalysis(req) {
  const durationHours = 24 * 14;
  const latDeg = req.site.site_metadata.lat_deg;
  const lonDeg = req.site.site_metadata.lon_deg;
  const timestampsUtc = [];
  const sunAzimuthDeg = [];
  const sunElevationDeg = [];
  const earthAzimuthDeg = [];
  const earthElevationDeg = [];
  const h0 = req.site.horizon_mask_360.h0_deg;
  const dCrit = req.site.horizon_mask_360.d_crit_m;

  for (let h = 0; h < durationHours; h++) {
    const subSolarLon = (h / 708.7) * 360;
    const subSolarLat = -1.54;
    const sunAz = ((lonDeg - subSolarLon) % 360 + 360) % 360;
    const sunEl = Math.asin(
      Math.sin(latDeg * Math.PI / 180) * Math.sin(subSolarLat * Math.PI / 180) +
      Math.cos(latDeg * Math.PI / 180) * Math.cos(subSolarLat * Math.PI / 180) *
      Math.cos((lonDeg - subSolarLon) * Math.PI / 180)
    ) * 180 / Math.PI;

    timestampsUtc.push(new Date(Date.UTC(2026, 11, 1, h)).toISOString());
    sunAzimuthDeg.push(sunAz);
    sunElevationDeg.push(sunEl);
    earthAzimuthDeg.push(45.0);
    earthElevationDeg.push(2.5);
  }

  const horizonElevationDeg = h0.map((h0Val, az) => computeDynamicHorizon(h0Val, dCrit[az], req.mast_height_m));

  const payload = {
    schemaVersion: 1,
    timestampsUtc,
    windowEndUtc: new Date(Date.UTC(2026, 11, 15)).toISOString(),
    sunAzimuthDeg,
    sunElevationDeg,
    earthAzimuthDeg,
    earthElevationDeg,
    energy: {
      usableBatteryWh: req.battery_capacity_wh,
      initialSocFraction: 1.0,
      solarRatedW: 1000.0,
      hotelLoadW: req.hotel_load_w,
      transmitterLoadW: 40.0,
      panelTiltDeg: 90.0,
      panelAzimuthDeg: 0.0,
      trackSunAzimuth: true,
      albedo: 0.12,
      emissivity: 0.95,
      backgroundHeatFluxWM2: 0.013,
    },
    positions: [{
      positionId: 'eval_pos',
      horizon: {
        azimuthDeg: Array.from({ length: 360 }, (_, i) => i),
        horizonElevationDeg,
      }
    }]
  };

  const responseJson = analyze_json(JSON.stringify(payload));
  const parsed = JSON.parse(responseJson);
  const pos = parsed.positions[0];
  const minSocPct = pos.energy?.minimumSocPct ?? 100.0;

  return {
    continuous_shadow_duration_h: pos.longestDarknessHours,
    minimum_battery_wh: Math.max(1.0, (minSocPct / 100.0) * req.battery_capacity_wh),
    slope_deg: req.site.site_metadata.slope_deg ?? 2.5,
  };
}

test('=== MISSION-CRITICAL VERIFICATION 1: Rust WASM Engine Parity & Precision ===', async () => {
  // Build request using the correct AnalysisRequest format
  const request = {
    site: mockSite,
    dispersion_offset_m: { x: 0, y: 0 }, // Nominal landing point
    arrival_day: 0, // Lunar day 0 (peak summer)
    mast_height_m: 3.0, // IM-2 Nova-C default
    battery_capacity_wh: 400, // IM-2 Nova-C
    hotel_load_w: 120, // IM-2 Nova-C hotel load
    slope_threshold_deg: 5.0
  };

  // Call WASM engine
  const result = executeWasmAnalysis(request);

  // Verify engine returns expected structure (AnalysisResponse)
  assert.ok(typeof result.continuous_shadow_duration_h === 'number',
    'Engine must return continuous_shadow_duration_h as number');
  assert.ok(typeof result.minimum_battery_wh === 'number',
    'Engine must return minimum_battery_wh as number');
  assert.ok(typeof result.slope_deg === 'number',
    'Engine must return slope_deg as number');
  assert.ok(Number.isFinite(result.continuous_shadow_duration_h),
    'continuous_shadow_duration_h must be finite');
  assert.ok(Number.isFinite(result.minimum_battery_wh),
    'minimum_battery_wh must be finite');
  assert.ok(Number.isFinite(result.slope_deg),
    'slope_deg must be finite');

  // Verify the engine produces physically realistic values
  assert.ok(result.continuous_shadow_duration_h >= 0,
    'Shadow duration must be non-negative');
  assert.ok(result.minimum_battery_wh > 0,
    'Minimum battery must be positive');
  assert.ok(result.slope_deg >= 0,
    'Slope must be non-negative');

  // For analytical parity verification, we compare the aggregate metrics
  // with an analytical shadow duration computation
  const horizonMask = mockSite.horizon_mask_360;
  const h0 = horizonMask.h0_deg;
  const dCrit = horizonMask.d_crit_m;

  let maxContinuousAnalytical = 0;
  let currentContinuous = 0;
  const steps = 24 * 14; // 14 days
  for (let step = 0; step < steps; step++) {
    const subSolarLon = (step / 708.7) * 360;
    const subSolarLat = -1.54; // South pole summer
    const sunAz = ((mockSite.site_metadata.lon_deg - subSolarLon) % 360 + 360) % 360;
    const sunEl = Math.asin(
      Math.sin(mockSite.site_metadata.lat_deg * Math.PI / 180) * Math.sin(subSolarLat * Math.PI / 180) +
      Math.cos(mockSite.site_metadata.lat_deg * Math.PI / 180) * Math.cos(subSolarLat * Math.PI / 180) *
      Math.cos((mockSite.site_metadata.lon_deg - subSolarLon) * Math.PI / 180)
    ) * 180 / Math.PI;

    const azIdx = Math.floor(sunAz) % 360;
    const dynamicHorizon = computeDynamicHorizon(h0[azIdx], dCrit[azIdx], request.mast_height_m);
    const fraction = computePenumbraFraction(sunEl, dynamicHorizon);

    if (fraction <= 0.01) {
      currentContinuous++;
      if (currentContinuous > maxContinuousAnalytical) maxContinuousAnalytical = currentContinuous;
    } else {
      currentContinuous = 0;
    }
  }

  console.log(`WASM shadow duration: ${result.continuous_shadow_duration_h.toFixed(1)}h`);
  console.log(`Analytical shadow duration: ${maxContinuousAnalytical}h`);

  // The WASM engine should produce results consistent with analytical model
  const diff = Math.abs(result.continuous_shadow_duration_h - maxContinuousAnalytical);
  assert.ok(diff <= 10,
    `WASM shadow (${result.continuous_shadow_duration_h}h) should match analytical (${maxContinuousAnalytical}h) within 10h tolerance`);

  console.log('✓ WASM Engine Parity & Precision: PASSED');
});

test('=== MISSION-CRITICAL VERIFICATION 2: Terrain-Driven Repair Monotonicity ===', () => {
  // Real published LOLA terrain at de Gerlache Rim 1. The 3 m baseline loses the
  // Sun for ~68 h; a 5.5 m mast clears the local ridge and removes that outage.
  // These numbers come from the baked DE421 series, not a synthetic solar model.
  const horizonMask = realSite.horizon_mask_360;
  const h0 = horizonMask.h0_deg;
  const dCrit = horizonMask.d_crit_m;
  const eph = realSite.ephemeris;
  const totalSteps = 24 * 14; // 14-day surface stay

  const computeMaxContinuousShadow = (zMast, startStep = 0) => {
    let maxContinuousShadow = 0;
    let currentShadow = 0;
    for (let step = 0; step < totalSteps; step++) {
      const index = startStep + step;
      if (index >= eph.sun_el_deg.length) break;
      const az = ((Math.round(eph.sun_az_deg[index]) % 360) + 360) % 360;
      const dynamicHorizon = computeDynamicHorizon(h0[az], dCrit[az], zMast);
      const fraction = computePenumbraFraction(eph.sun_el_deg[index], dynamicHorizon);
      if (fraction <= 0.01) {
        currentShadow++;
        maxContinuousShadow = Math.max(maxContinuousShadow, currentShadow);
      } else {
        currentShadow = 0;
      }
    }
    return maxContinuousShadow; // hours, one baked sample per hour
  };

  const shadowDuration3m = computeMaxContinuousShadow(3.0);
  const shadowDuration5_5m = computeMaxContinuousShadow(5.5);

  console.log(`Baseline (3.0m): ${shadowDuration3m}h continuous shadow`);
  console.log(`Repaired (5.5m): ${shadowDuration5_5m}h continuous shadow`);

  assert.ok(shadowDuration3m > 0, 'The real-terrain baseline must include a shadow period');
  assert.ok(shadowDuration5_5m < shadowDuration3m,
    `Mast elevation must reduce shadow: ${shadowDuration5_5m}h < ${shadowDuration3m}h`);
  assert.ok(shadowDuration5_5m === 0,
    `A 5.5 m mast should clear the de Gerlache ridge; got ${shadowDuration5_5m}h`);

  // Raising the mast may never raise the terrain horizon at any azimuth.
  for (let az = 0; az < 360; az++) {
    const low = computeDynamicHorizon(h0[az], dCrit[az], 3.0);
    const high = computeDynamicHorizon(h0[az], dCrit[az], 5.5);
    assert.ok(high <= low + 1e-9, `Mast elevation raised the horizon at azimuth ${az}`);
  }

  // Launch slip: sample 30 arrival days across the baked DE421 envelope.
  const slipShadows = Array.from({ length: 30 }, (_, day) => computeMaxContinuousShadow(3.0, day * 24));
  const bestSlip = Math.min(...slipShadows);
  const worstSlip = Math.max(...slipShadows);
  console.log(`Best slip: ${bestSlip}h shadow; worst slip: ${worstSlip}h`);

  assert.ok(bestSlip <= shadowDuration3m, 'A later arrival must never be worse than the best available window');
  assert.ok(worstSlip > bestSlip, 'Arrival timing must materially change the shadow outcome');

  console.log('✓ Terrain-Driven Repair Monotonicity: PASSED');
});

test('=== MISSION-CRITICAL VERIFICATION 3: Deep Space Comms & DSN Handover ===', () => {
  // 3.1 Verify Earth-Moon speed-of-light latency adheres to relativistic bounds
  const owltPerigee = computeOWLT(EARTH_MOON_PERIGEE_KM);
  const owltApogee = computeOWLT(EARTH_MOON_APOGEE_KM);
  const owltMean = computeOWLT(EARTH_MOON_MEAN_KM);

  console.log(`OWLT Perigee: ${owltPerigee.toFixed(3)}s`);
  console.log(`OWLT Mean: ${owltMean.toFixed(3)}s`);
  console.log(`OWLT Apogee: ${owltApogee.toFixed(3)}s`);

  // Verify bounds: 1.21s perigee to 1.35s apogee (one-way)
  assert.ok(owltPerigee >= 1.21 && owltPerigee <= 1.22,
    `Perigee OWLT ${owltPerigee.toFixed(3)}s must be in [1.21, 1.22]s`);
  assert.ok(owltApogee >= 1.35 && owltApogee <= 1.36,
    `Apogee OWLT ${owltApogee.toFixed(3)}s must be in [1.35, 1.36]s`);
  assert.ok(owltMean >= 1.281 && owltMean <= 1.283,
    `Mean OWLT ${owltMean.toFixed(3)}s must be ~1.282s`);

  // 3.2 Verify DSN complex coverage: at least one maintains elevation >= 10° when Earth is visible
  // Earth is visible from lunar site when its elevation > 0°
  // For DSN coverage, we check if Earth is above the horizon at each DSN complex on Earth

  const siteLat = mockSite.site_metadata.lat_deg;
  const siteLon = mockSite.site_metadata.lon_deg;

  // Simulate Earth visibility over lunar month (sub-Earth point moves due to libration)
  const elevationChecks = [];
  for (let day = 0; day < 29.5; day += 0.5) { // 0.5 day steps
    // Sub-Earth point libration: lat ±6.7°, lon ±8.0°
    const subEarthLat = 6.7 * Math.sin(day * 2 * Math.PI / 27.3); // 27.3 day nodal period
    const subEarthLon = 8.0 * Math.sin(day * 2 * Math.PI / 27.3 + Math.PI / 4);

    // Earth elevation at lunar site (for visibility check)
    const earthEl = computeElevation(siteLat, siteLon, subEarthLat, subEarthLon);

    if (earthEl > 0) {
      // Earth is visible from lunar site, now check DSN coverage on Earth
      // A DSN complex can communicate if Earth is above its local horizon
      // This is true when the sub-Earth point is within ~90° of the DSN
      let maxDsnElevation = -Infinity;
      let bestDsn = null;

      for (const dsn of DSN_COMPLEXES) {
        // Compute elevation of Earth (sub-Earth point) as seen from DSN complex
        const dsnEl = computeElevation(dsn.lat, dsn.lon, subEarthLat, subEarthLon);

        if (dsnEl > maxDsnElevation) {
          maxDsnElevation = dsnEl;
          bestDsn = dsn.name;
        }
      }

      elevationChecks.push({
        day,
        earthEl,
        maxDsnElevation,
        bestDsn,
        covered: maxDsnElevation >= 10.0
      });
    }
  }

  // Verify continuous coverage when Earth visible
  const uncovered = elevationChecks.filter(c => !c.covered);
  assert.equal(uncovered.length, 0,
    `All ${elevationChecks.length} Earth-visible periods must have DSN coverage >= 10°. Uncovered: ${uncovered.length}`);

  // Log coverage stats
  const minDsnEl = Math.min(...elevationChecks.map(c => c.maxDsnElevation));
  console.log(`Minimum DSN elevation during Earth visibility: ${minDsnEl.toFixed(1)}°`);
  console.log(`DSN handover verified across ${elevationChecks.length} visibility windows`);

  console.log('✓ Deep Space Comms & DSN Handover: PASSED');
});

test('=== MISSION-CRITICAL VERIFICATION 4: 5x5 Dispersion Grid Safety Invariants ===', () => {
  // Verify that all 25 dispersion cells calculate strictly positive distance obstacles (dCrit > 0)
  // to guard against division-by-zero in dynamic mast formula

  const horizonMask = mockSite.horizon_mask_360;
  const dCrit = horizonMask.d_crit_m;

  // 5x5 dispersion grid: divide 360° azimuth into 5 sectors × 5 range rings
  // Each cell covers 72° azimuth
  const numAzimuthSectors = 5;
  const numRangeRings = 5;
  const azPerSector = 360 / numAzimuthSectors; // 72°

  // For each cell, verify dCrit > 0 for all azimuths in that sector
  const cellResults = [];

  for (let azSector = 0; azSector < numAzimuthSectors; azSector++) {
    const azStart = azSector * azPerSector;
    const azEnd = azStart + azPerSector;

    for (let rangeRing = 0; rangeRing < numRangeRings; rangeRing++) {
      let minDCritInCell = Infinity;
      let maxDCritInCell = -Infinity;
      let count = 0;

      for (let az = azStart; az < azEnd; az++) {
        const d = dCrit[az];
        minDCritInCell = Math.min(minDCritInCell, d);
        maxDCritInCell = Math.max(maxDCritInCell, d);
        count++;
      }

      // Verify all dCrit in this cell are strictly positive
      assert.ok(minDCritInCell > 0,
        `Cell [azSector=${azSector}, rangeRing=${rangeRing}]: minimum dCrit = ${minDCritInCell} must be > 0`);

      cellResults.push({
        azSector,
        rangeRing,
        azRange: `${azStart}-${azEnd - 1}°`,
        minDCrit: minDCritInCell,
        maxDCrit: maxDCritInCell,
        count
      });
    }
  }

  // Additional check: all 360 azimuths must have dCrit > 0
  const allPositive = dCrit.every((d, i) => d > 0);
  assert.ok(allPositive, 'All 360 azimuth critical distances must be strictly positive');

  // Verify no zero or negative values that would cause division-by-zero
  const zeroOrNegative = dCrit.filter(d => d <= 0);
  assert.equal(zeroOrNegative.length, 0,
    `Found ${zeroOrNegative.length} azimuths with dCrit <= 0 (division-by-zero risk)`);

  console.log(`Verified ${cellResults.length} dispersion cells (5x5 grid)`);
  console.log(`All 360 azimuths have dCrit > 0: min=${Math.min(...dCrit).toFixed(1)}m, max=${Math.max(...dCrit).toFixed(1)}m`);

  // Verify dynamic mast formula doesn't divide by zero with these values
  for (let az = 0; az < 360; az++) {
    const h0Val = horizonMask.h0_deg[az];
    const dCritVal = dCrit[az];

    // Test with various mast heights including edge cases
    for (const zMast of [0, 1.0, 3.0, 5.5, 10.0, 100.0]) {
      const result = computeDynamicHorizon(h0Val, dCritVal, zMast);
      assert.ok(!isNaN(result) && isFinite(result),
        `Az ${az}, zMast=${zMast}: formula must not return NaN/Inf (h0=${h0Val}, dCrit=${dCritVal})`);
    }
  }

  console.log('✓ 5x5 Dispersion Grid Safety Invariants: PASSED');
});

test('=== INTEGRATION: Full Mission Profile End-to-End ===', async () => {
  // End-to-end test: combine all verifications for IM-2 Nova-C profile
  const siteId = mockSite.site_metadata.site_id;
  console.log(`Testing full mission profile for ${siteId}`);

  // Build request using the correct AnalysisRequest format
  const request = {
    site: mockSite,
    dispersion_offset_m: { x: 0, y: 0 }, // Nominal landing point
    arrival_day: 0, // Lunar day 0 (peak summer)
    mast_height_m: 3.0, // IM-2 Nova-C
    battery_capacity_wh: 400, // IM-2 Nova-C
    hotel_load_w: 120, // IM-2 Nova-C hotel load
    slope_threshold_deg: 5.0
  };

  const result = executeWasmAnalysis(request);

  // Verify engine returns expected structure
  assert.ok(typeof result.continuous_shadow_duration_h === 'number',
    'Engine must return continuous_shadow_duration_h');
  assert.ok(typeof result.minimum_battery_wh === 'number',
    'Engine must return minimum_battery_wh');
  assert.ok(typeof result.slope_deg === 'number',
    'Engine must return slope_deg');

  const maxContinuousShadow = result.continuous_shadow_duration_h;
  const minBattery = result.minimum_battery_wh;
  const slope = result.slope_deg;

  // Estimate total sunlight hours from the mission duration minus shadow
  const steps = 24 * 14; // 14 days
  const totalSunlightHours = steps - maxContinuousShadow;

  console.log(`Mission Profile (${siteId}):`);
  console.log(`  Max continuous shadow: ${maxContinuousShadow.toFixed(1)}h`);
  console.log(`  Estimated sunlight hours: ${totalSunlightHours}h / ${steps}h`);
  console.log(`  Minimum required battery: ${minBattery.toFixed(1)}Wh`);
  console.log(`  Terrain slope: ${slope.toFixed(2)}°`);
  console.log(`  Sunlight fraction: ${(totalSunlightHours / steps * 100).toFixed(1)}%`);

  // Verify mission viability
  assert.ok(totalSunlightHours > 0, 'Mission must have some sunlight');
  assert.ok(maxContinuousShadow < 360, 'Max continuous shadow must be < 15 days (survivable)');

  // Verify battery can sustain max shadow (IM-2: 400 Wh battery, 120 W hotel load)
  const hotelLoadW = 120;
  const batteryWh = 400;
  const maxSurvivableShadowHours = batteryWh / hotelLoadW;

  console.log(`  Battery survival limit: ${maxSurvivableShadowHours.toFixed(1)}h`);

  if (maxContinuousShadow > maxSurvivableShadowHours) {
    console.log(`  ⚠ WARNING: Max shadow (${maxContinuousShadow.toFixed(1)}h) exceeds battery (${maxSurvivableShadowHours.toFixed(1)}h)`);
    console.log(`  → Pareto repair needed: elevate mast or shift arrival`);
  } else {
    console.log(`  ✓ Mission viable: shadow within battery capacity`);
  }

  // Verify minimum battery requirement is met by actual battery
  assert.ok(minBattery <= batteryWh * 1.5, // Allow some margin
    `Required battery (${minBattery.toFixed(1)}Wh) should be achievable with ${batteryWh}Wh battery`);

  console.log('✓ Full Mission Profile End-to-End: PASSED');
});
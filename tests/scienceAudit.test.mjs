import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read baked lunar data
const bakedDataPath = path.join(projectRoot, 'public', 'data', 'baked_lunar_sites.json');

test('Verification 1: baked_lunar_sites.json exists and adheres to schema', () => {
  assert.ok(fs.existsSync(bakedDataPath), 'baked_lunar_sites.json must exist');
  const data = JSON.parse(fs.readFileSync(bakedDataPath, 'utf8'));
  assert.ok(data.sites && Array.isArray(data.sites), 'Master dataset must contain sites array');
  assert.equal(data.sites.length, 15, 'Master dataset must contain all 15 curated sites');

  const ids = data.sites.map((site) => site.site_metadata?.site_id);
  assert.equal(new Set(ids).size, ids.length, 'Site ids must be unique');

  for (const site of data.sites) {
    const id = site.site_metadata?.site_id;
    assert.ok(id, 'Site must have site_id');
    assert.ok(typeof site.site_metadata?.lat_deg === 'number', 'Site must have numeric lat_deg');
    assert.ok(typeof site.site_metadata?.lon_deg === 'number', 'Site must have numeric lon_deg');
    if (id === 'ISRO-CY3') {
      // Documented operational benchmark at 69.37° S, deliberately outside the
      // 80° S PSR product. It must never be relabelled as a polar PSR site.
      assert.ok(site.site_metadata.lat_deg > -80 && site.site_metadata.lat_deg < -68,
        'ISRO-CY3 must stay at its real Chandrayaan-3 latitude');
      assert.equal(site.site_metadata.nearest_psr_km, null,
        'ISRO-CY3 must report PSR distance as unavailable');
    } else {
      assert.ok(site.site_metadata.lat_deg < -80, 'Must be a south polar site (lat < -80)');
    }

    assert.ok(
      site.horizon_mask_360?.h0_deg?.length === 360,
      'Horizon mask must contain exactly 360 values'
    );
    assert.ok(
      site.horizon_mask_360?.d_crit_m?.length === 360,
      'Critical distance must contain exactly 360 values'
    );
    assert.equal(site.dem_grid_101?.relative_elevations_m?.length, 101 * 101,
      'DEM grid must be 101x101');
    assert.equal(site.dispersion_grid_5x5?.length, 25, 'Dispersion grid must be 5x5');
    assert.equal(site.ephemeris?.sun_el_deg?.length, 2185,
      'DE421 series must cover the 91-day, hourly operations envelope');

    const expectedFidelity = id === 'MOCK-01' ? 'synthetic' : 'lola_published';
    assert.equal(site.provenance?.terrain_fidelity, expectedFidelity,
      `${id} must declare ${expectedFidelity} terrain`);
  }
});

test('Verification 2: Horizon elevation angles remain within physical bounds [-90, +90]', () => {
  const data = JSON.parse(fs.readFileSync(bakedDataPath, 'utf8'));
  for (const site of data.sites) {
    for (let az = 0; az < 360; az++) {
      const h0 = site.horizon_mask_360.h0_deg[az];
      const dCrit = site.horizon_mask_360.d_crit_m[az];
      assert.ok(h0 >= -30 && h0 <= 75, `Horizon angle ${h0} at az ${az} must be physically realistic`);
      assert.ok(dCrit > 0, `Obstacle distance ${dCrit} must be positive to prevent division by zero`);
    }
  }
});

test('Verification 3: O(1) Dynamic Mast formula monotonicity & zero-division safety', () => {
  // Formula: H_terrain(theta, z_mast) ≈ atan(tan(H0) - z_mast / d_crit)
  const computeAngle = (h0Deg, dCritM, zMastM) => {
    const dSafe = Math.max(10, dCritM);
    const tanAdjusted = Math.tan((h0Deg * Math.PI) / 180) - zMastM / dSafe;
    return (Math.atan(tanAdjusted) * 180) / Math.PI;
  };

  // Test zero / negative distance safeguard
  const safeZero = computeAngle(5.0, 0, 3.0);
  assert.ok(!isNaN(safeZero) && isFinite(safeZero), 'Must not return NaN when dCrit is 0');

  // Test monotonicity: higher mast must reduce effective obstacle angle
  const angleLow = computeAngle(6.5, 250, 0.5);
  const angleHigh = computeAngle(6.5, 250, 10.0);
  assert.ok(
    angleHigh < angleLow,
    `Elevating mast must lower effective horizon obstacle (${angleHigh} < ${angleLow})`
  );
  assert.ok(Math.abs(angleLow - angleHigh) > 1.5, '10m mast should clear obstacle by >1.5 degrees');
});

test('Verification 4: Continuous penumbra fraction clips smoothly in [0.0, 1.0]', () => {
  const SOLAR_RADIUS_DEG = 0.266;
  const penumbra = (sunEl, horizon) => {
    const raw = (sunEl + SOLAR_RADIUS_DEG - horizon) / (2 * SOLAR_RADIUS_DEG);
    return Math.max(0.0, Math.min(1.0, raw));
  };

  assert.equal(penumbra(0.0, 10.0), 0.0, 'Deep shadow must be 0.0');
  assert.equal(penumbra(10.0, 0.0), 1.0, 'Full sun must be 1.0');
  assert.equal(penumbra(5.0, 5.0), 0.5, 'Sun disk half-occluded at limb must be 0.5');
  assert.ok(penumbra(5.1, 5.0) > 0.5 && penumbra(5.1, 5.0) < 1.0, 'Continuous transition');
});

test('Verification 5: Exploratory radiative-temperature estimate remains bounded', () => {
  const BOLTZMANN = 5.670374419e-8;
  const EMISSIVITY = 0.95;
  const ALBEDO = 0.12;
  const SOLAR_CONST = 1361;

  const computeTemp = (sunElDeg, fSun) => {
    if (fSun <= 0.01 || sunElDeg <= 0) return Number((32.0 + 1.5 * 2.5).toFixed(1));
    const inc = Math.sin((Math.max(0.4, sunElDeg) * Math.PI) / 180);
    const absorbed = (1 - ALBEDO) * SOLAR_CONST * fSun * Math.pow(inc, 0.35);
    const t = Math.pow((absorbed + 1.5) / (EMISSIVITY * BOLTZMANN), 0.25);
    return Math.max(27.0, Math.min(392.0, t));
  };

  const shadowTemp = computeTemp(-2.0, 0.0);
  const sunlitTemp = computeTemp(2.5, 1.0);

  assert.equal(shadowTemp, 35.8, 'Night-side estimate must reflect the configured internal-heat assumption');
  assert.ok(sunlitTemp >= 27 && sunlitTemp <= 392, `Sunlit estimate ${sunlitTemp}K must stay within model bounds`);
});

test('Verification 6: Speed-of-Light propagation, DSN coverage, & Shannon-Hartley capacity', () => {
  const SPEED_OF_LIGHT_KM_S = 299792.458;
  const DIST_MEAN_KM = 384400;
  const PERIGEE_KM = 363300;
  const APOGEE_KM = 405500;

  // 1. One-way light time bounds
  const owltMean = DIST_MEAN_KM / SPEED_OF_LIGHT_KM_S;
  const owltPerigee = PERIGEE_KM / SPEED_OF_LIGHT_KM_S;
  const owltApogee = APOGEE_KM / SPEED_OF_LIGHT_KM_S;

  assert.ok(owltMean >= 1.281 && owltMean <= 1.283, 'Mean OWLT must be ~1.282s');
  assert.ok(owltPerigee >= 1.21 && owltPerigee <= 1.22, 'Perigee OWLT must be ~1.212s');
  assert.ok(owltApogee >= 1.35 && owltApogee <= 1.36, 'Apogee OWLT must be ~1.353s');

  // 2. Physical Free Space Path Loss (FSPL)
  const fspl = (dKm, fHz) => {
    return 20 * Math.log10(dKm * 1000) + 20 * Math.log10(fHz) + 20 * Math.log10((4 * Math.PI) / (SPEED_OF_LIGHT_KM_S * 1000));
  };
  const fsplXBand = fspl(DIST_MEAN_KM, 8.45e9);
  const fsplSBand = fspl(DIST_MEAN_KM, 2.21e9);

  assert.ok(fsplXBand >= 222.0 && fsplXBand <= 223.5, 'X-band FSPL must be ~222.6 dB');
  assert.ok(fsplSBand >= 210.0 && fsplSBand <= 211.5, 'S-band FSPL must be ~211.0 dB');
  assert.ok(fsplXBand > fsplSBand, 'Higher frequency experiences greater free-space dispersion');

  // 3. Shannon-Hartley Capacity monotonic scaling
  const shannon = (bHz, snrDb) => {
    const snrLin = Math.pow(10, snrDb / 10);
    return bHz * Math.log2(1 + snrLin);
  };
  const capLow = shannon(10e6, 2.0);
  const capHigh = shannon(10e6, 12.0);
  assert.ok(capHigh > capLow * 2, 'Higher SNR yields strictly higher channel capacity');
});

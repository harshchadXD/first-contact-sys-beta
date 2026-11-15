import test from 'node:test';
import assert from 'node:assert/strict';
import { getSiteById, getSpacecraftById, LUNAR_SITES } from './lunarData';
import { computeTopocentricEphemeris } from './ephemeris';
import {
  buildAnalysisCsv,
  computeDynamicHorizonArray,
  computeParetoSiteRankings,
  computeSunPenumbraFraction,
  computeSurfaceTempK,
  runSiteAnalysis,
} from './physicsEngine';

test('O(1) mast clearance reduces terrain horizon elevation', () => {
  const monsMouton = getSiteById('PGDA-20');
  const lowMast = computeDynamicHorizonArray(monsMouton, 0.5, 0, 0);
  const tallMast = computeDynamicHorizonArray(monsMouton, 10.0, 0, 0);

  for (let az = 0; az < 360; az++) {
    assert.ok(
      tallMast[az] <= lowMast[az],
      `Expected tall mast horizon (${tallMast[az]}) <= low mast (${lowMast[az]}) at az=${az}`
    );
  }
});

test('Solar penumbra fraction clips smoothly across apparent solar radius', () => {
  assert.equal(computeSunPenumbraFraction(-1.0, 1.0), 0.0);
  assert.equal(computeSunPenumbraFraction(3.0, 1.0), 1.0);
  const half = computeSunPenumbraFraction(1.0, 1.0);
  assert.ok(Math.abs(half - 0.5) < 1e-6);
});

test('Topocentric ephemeris produces valid normalized azimuths and polar elevations', () => {
  const vec = computeTopocentricEphemeris(-84.7906, 29.1957, 12);
  assert.ok(vec.sunAzDeg >= 0 && vec.sunAzDeg < 360);
  assert.ok(vec.earthAzDeg >= 0 && vec.earthAzDeg < 360);
  assert.ok(vec.sunElDeg > -10 && vec.sunElDeg < 12);
});

test('Published LOLA dispersion separates a sun-rich peak from a shadowed loss cell', () => {
  const peak = getSiteById('PGDA-07');
  const novaC = getSpacecraftById('nova-c');
  const constraints = {
    maxDarknessHrs: 24,
    minCommsWindowHrs: 6,
    mastHeightM: 3.0,
    missionDurationDays: 14,
    epochOffsetDays: 0,
  };
  const weights = { sun: 0.45, earth: 0.35, terrain: 0.2 };

  // Center index 12 is (dx=0, dy=0)
  const nominal = runSiteAnalysis(peak, novaC, constraints, 12, weights);
  assert.equal(nominal.selectedCell.dxM, 0);
  assert.equal(nominal.selectedCell.dyM, 0);
  assert.equal(nominal.summary.hoursToDepletion, null);
  assert.ok(nominal.summary.pSunPct >= 90, `Nominal sun ${nominal.summary.pSunPct}% should be high`);

  // The (-200 m, +200 m) cell is a real sampled offset in the published LOLA
  // terrain; it must not be presented as a fake crater.
  const trapIdx = nominal.dispersionGrid.findIndex((c) => c.dxM === -200 && c.dyM === 200);
  assert.ok(trapIdx >= 0);
  const lossCell = runSiteAnalysis(peak, novaC, constraints, trapIdx, weights);
  assert.ok(lossCell.selectedCell.slopeDeg > 5, 'The selected offset must carry real local relief');
  assert.equal(lossCell.summary.status, 'MISSION_LOSS_TRAP');
  assert.equal(lossCell.summary.bridgeState, 'FRACTURED');
  assert.ok(
    lossCell.summary.pSunPct < nominal.summary.pSunPct - 25,
    'The steep cell should lose most direct sunlight'
  );
  assert.ok(
    lossCell.summary.hoursToDepletion !== null,
    'The steep cell should exhaust the battery'
  );
});

test('LRO Diviner cryogenic temperature spans shadow cold traps to illuminated peaks', () => {
  const coldK = computeSurfaceTempK(-1.2, 0.0);
  const hotK = computeSurfaceTempK(3.2, 1.0);
  assert.ok(coldK >= 27 && coldK <= 60, `Expected cryogenic cold trap, got ${coldK}K`);
  assert.ok(hotK >= 220 && hotK <= 395, `Expected warm sunlit peak, got ${hotK}K`);
});

test('Pareto solver ranks all 15 lunar sites and identifies non-dominated frontier', () => {
  const griffin = getSpacecraftById('griffin');
  const constraints = {
    maxDarknessHrs: 24,
    minCommsWindowHrs: 6,
    mastHeightM: 3.0,
    missionDurationDays: 14,
    epochOffsetDays: 16,
  };
  const weights = { sun: 0.45, earth: 0.35, terrain: 0.2 };
  const rankings = computeParetoSiteRankings(griffin, constraints, weights);

  assert.equal(rankings.length, 15);
  assert.ok(rankings.some((r) => r.paretoOptimal), 'At least one site must be Pareto-optimal');

  const realSites = rankings.filter((r) => !r.isCalibration);
  assert.equal(realSites.length, 14, 'Exactly 14 real LOLA sites must be ranked');
  assert.equal(rankings[rankings.length - 1].siteId, 'MOCK-01', 'Calibration plane must sort last');
  assert.equal(rankings[rankings.length - 1].paretoOptimal, false, 'Calibration plane is never on the frontier');
  assert.ok(
    realSites.every((r) => !r.paretoOptimal || r.viable),
    'The Pareto frontier must never contain a mission-loss site'
  );
  assert.ok(
    realSites.some((r) => r.paretoOptimal),
    'The frontier must only contain real, surviving terrain'
  );

  for (let i = 1; i < realSites.length; i++) {
    assert.ok(realSites[i - 1].compositeScore >= realSites[i].compositeScore);
  }

  // Degenerate case: if no site survives, the frontier is empty, never a
  // promoted mission-loss recommendation.
  const noSurvivors = computeParetoSiteRankings(
    griffin,
    { ...constraints, mastHeightM: 2.2, epochOffsetDays: 0 },
    weights
  );
  assert.equal(
    noSurvivors.filter((r) => !r.isCalibration && r.viable).length,
    0,
    'Expected all sites to be mission-loss at 2.2 m mast and zero slip'
  );
  assert.equal(
    noSurvivors.filter((r) => r.paretoOptimal).length,
    0,
    'No frontier may be declared when no site survives'
  );
});

test('All 15 South Polar landing sites adhere to NASA LOLA and DEM geometry constraints', () => {
  assert.equal(LUNAR_SITES.length, 15);
  for (const site of LUNAR_SITES) {
    assert.ok(site.metadata.latDeg <= -68.0, `Site ${site.metadata.siteId} must be in South Polar zone`);
    assert.equal(site.horizonH0Deg.length, 360, `Site ${site.metadata.siteId} must have 360 horizon points`);
    assert.equal(site.dCritM.length, 360, `Site ${site.metadata.siteId} must have 360 dCrit points`);
    assert.equal(site.demGrid101.length, 101 * 101, `Site ${site.metadata.siteId} must have 101x101 DEM`);
    assert.ok(site.metadata.elevationM !== undefined);
  }
});

test('CSV export includes provenance header and hourly rows', () => {
  const site = getSiteById('PGDA-23');
  const bg = getSpacecraftById('blue-ghost');
  const res = runSiteAnalysis(
    site,
    bg,
    {
      maxDarknessHrs: 24,
      minCommsWindowHrs: 6,
      mastHeightM: 3.5,
      missionDurationDays: 7,
      epochOffsetDays: 0,
    },
    12,
    { sun: 0.45, earth: 0.35, terrain: 0.2 }
  );
  const csv = buildAnalysisCsv(res);
  const lines = csv.split('\n');
  assert.ok(lines[0].includes('PGDA-23'));
  assert.equal(lines.length, 2 + 7 * 24);
});

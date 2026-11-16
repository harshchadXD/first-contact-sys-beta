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

test('IM-2 Mons Mouton nominal plateau vs crater offset reproduces mission survival vs loss trap', () => {
  const monsMouton = getSiteById('PGDA-20');
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
  const nominal = runSiteAnalysis(monsMouton, novaC, constraints, 12, weights);
  assert.equal(nominal.selectedCell.dxM, 0);
  assert.equal(nominal.selectedCell.dyM, 0);
  assert.equal(nominal.summary.status, 'SAFE');
  assert.ok(nominal.summary.pSunPct >= 65, `Nominal sun ${nominal.summary.pSunPct}% should be high`);
  assert.equal(nominal.summary.hoursToDepletion, null);

  // Find the (-200m, +200m) crater trap cell (row=4, col=0 => idx=20)
  const trapIdx = nominal.dispersionGrid.findIndex((c) => c.dxM === -200 && c.dyM === 200);
  assert.ok(trapIdx >= 0);
  const craterLoss = runSiteAnalysis(monsMouton, novaC, constraints, trapIdx, weights);
  assert.equal(craterLoss.summary.status, 'MISSION_LOSS_TRAP');
  assert.equal(craterLoss.summary.bridgeState, 'FRACTURED');
  assert.ok(
    craterLoss.summary.pSunPct < nominal.summary.pSunPct - 25,
    'Crater depression should drastically drop solar illumination'
  );
  assert.ok(
    craterLoss.summary.hoursToDepletion !== null && craterLoss.summary.hoursToDepletion <= 24,
    `Expected rapid battery depletion in crater trap, got ${craterLoss.summary.hoursToDepletion}`
  );
});

test('LRO Diviner cryogenic temperature spans shadow cold traps to illuminated peaks', () => {
  const coldK = computeSurfaceTempK(-1.2, 0.0);
  const hotK = computeSurfaceTempK(3.2, 1.0);
  assert.ok(coldK >= 27 && coldK <= 60, `Expected cryogenic cold trap, got ${coldK}K`);
  assert.ok(hotK >= 220 && hotK <= 395, `Expected warm sunlit peak, got ${hotK}K`);
});

test('Pareto solver ranks candidate lunar sites (excluding synthetic calibration) and identifies non-dominated frontier', () => {
  const griffin = getSpacecraftById('griffin');
  const rankings = computeParetoSiteRankings(
    griffin,
    {
      maxDarknessHrs: 24,
      minCommsWindowHrs: 6,
      mastHeightM: 2.2,
      missionDurationDays: 14,
      epochOffsetDays: 0,
    },
    { sun: 0.45, earth: 0.35, terrain: 0.2 }
  );

  assert.equal(rankings.length, 14);
  assert.ok(rankings.some((r) => r.paretoOptimal), 'At least one site must be Pareto-optimal');
  for (let i = 1; i < rankings.length; i++) {
    assert.ok(rankings[i - 1].compositeScore >= rankings[i].compositeScore);
  }
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

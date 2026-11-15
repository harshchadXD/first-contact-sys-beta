import fs from 'node:fs';
import assert from 'node:assert/strict';
import init, { analyze_json } from '../../engine/pkg/first_contact_engine.js';

await init({ module_or_path: fs.readFileSync(new URL('../../engine/pkg/first_contact_engine_bg.wasm',import.meta.url)) });
const request = {
  schemaVersion:1,
  timestampsUtc:['2026-12-01T00:00:00Z','2026-12-01T01:00:00Z','2026-12-01T04:00:00Z','2026-12-01T05:00:00Z'],
  windowEndUtc:'2026-12-01T07:00:00Z',
  sunAzimuthDeg:[0,90,180,270], sunElevationDeg:[1,-1,-1,1],
  earthAzimuthDeg:[0,90,180,270], earthElevationDeg:[-1,1,1,-1],
  positions:[{positionId:'analytic-flat',horizon:{azimuthDeg:[0,90,180,270],horizonElevationDeg:[0,0,0,0]}}],
};
const evaluate = r => JSON.parse(analyze_json(JSON.stringify(r))).positions[0];
const weighted = evaluate(request);
// Independent hand calculation: durations are 1,3,1,2 hours, not four equal samples.
assert.deepEqual(weighted.sunVisible,[true,false,false,true]);
assert.deepEqual(weighted.earthVisible,[false,true,true,false]);
assert.ok(Math.abs(weighted.sunVisibleFraction-3/7)<1e-12);
assert.ok(Math.abs(weighted.earthVisibleFraction-4/7)<1e-12);
assert.equal(weighted.longestDarknessHours,4);
assert.equal(weighted.longestEarthVisibleHours,4);
assert.equal(weighted.longestEarthBlackoutHours,2);
const seam = evaluate({...request,
  sunAzimuthDeg:[315,315,45,45],sunElevationDeg:[4.9,5.1,4.9,5.1],
  positions:[{positionId:'analytic-seam',horizon:{azimuthDeg:[0,90,180,270],horizonElevationDeg:[10,0,-10,0]}}],
});
// Linear angular interpolation gives exactly 5 degrees at both 315 and 45 degrees.
assert.deepEqual(seam.sunVisible,[false,true,false,true]);
const polar = evaluate({...request, sunElevationDeg:[90,90,90,90], earthElevationDeg:[-90,-90,-90,-90]});
assert.equal(polar.sunVisibleFraction,1);
assert.equal(polar.earthVisibleFraction,0);
assert.equal(polar.longestEarthBlackoutHours,7);
const report = {
  scope:'Actual compiled WASM against hand-derived geometric cases; no NASA DEM, ephemeris or mission validation.',
  cases:[{name:'Irregular intervals',expected:{sunFraction:3/7,earthFraction:4/7,darknessHours:4,earthContinuousHours:4,earthBlackoutHours:2},actual:weighted},{name:'North seam',expectedSun:[false,true,false,true],actual:seam},{name:'Zenith and nadir',actual:polar}],
  status:'PASS',
};
fs.writeFileSync(new URL('../../docs/validation/analytic-geometry-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('Independent analytic expectations PASS against actual WASM: irregular intervals, north seam, zenith/nadir.');

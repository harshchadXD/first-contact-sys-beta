/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { skyDirection, globePosition, skylineAt } from "./worldGeometry.ts";
import { terrainHeightAt } from "./worldGeometry.ts";
test("display directions preserve geographic cardinal directions and zenith", () => {
  for (const [az, el, expected] of [
    [0, 0, [0, 0, -1]],
    [90, 0, [1, 0, 0]],
    [180, 0, [0, 0, 1]],
    [0, 90, [0, 1, 0]],
  ] as const)
    skyDirection(az, el).forEach((v, i) =>
      assert.ok(Math.abs(v - expected[i]) < 1e-12),
    );
});
test("NASA map coordinates put the south pole below and eastern longitude toward negative Z", () => {
  assert.ok(Math.abs(globePosition(-90, 0, 2)[1] + 2) < 1e-12);
  assert.ok(Math.abs(globePosition(0, 90, 2)[2] + 2) < 1e-12);
});
test("skyline clearance interpolates continuously across the north seam", () => {
  const az = [0, 90, 180, 270],
    el = [2, 4, 8, 6];
  assert.equal(skylineAt(45, az, el), 3);
  assert.equal(skylineAt(315, az, el), 4);
  assert.equal(skylineAt(-45, az, el), 4);
  assert.equal(skylineAt(360, az, el), 2);
});
test("distance overlays follow bilinear elevation and respect geographic grid rotation and missing coverage", () => {
  const terrain = {
    columns: 3,
    rows: 3,
    spacingMeters: 1,
    elevationsMeters: [0, 1, 2, 10, 11, 12, 20, 21, 22],
  };
  assert.equal(terrainHeightAt(terrain, 0, 0), 11);
  assert.equal(terrainHeightAt(terrain, 0.5, 0.5), 6.5);
  assert.equal(
    terrainHeightAt({ ...terrain, gridNorthLongitudeDeg: 90 }, 0, 0.5),
    11.5,
  );
  assert.equal(terrainHeightAt(terrain, 2, 0), null);
});

import fs from "node:fs";
import assert from "node:assert/strict";
import init, { analyze_json } from "../../engine/pkg/first_contact_engine.js";
import { analyzeDataset } from "../src/services/missionEngine.ts";
import { selectStudyWindow } from "../src/services/studyWindow.ts";
import { profileParameters } from "../src/services/energyProfiles.ts";
import { syntheticComparisonFixture } from "../src/data/syntheticComparisonFixture.ts";
const study = JSON.parse(
  fs.readFileSync(new URL("../src/data/shackletonStudy.json", import.meta.url)),
);
await init({
  module_or_path: fs.readFileSync(
    new URL("../../engine/pkg/first_contact_engine_bg.wasm", import.meta.url),
  ),
});
const fixture = analyzeDataset(
  syntheticComparisonFixture,
  "2026-10-02T00:00:00Z",
  analyze_json,
  profileParameters(0),
);
assert.equal(fixture.positions[0].sunVisibleFraction, 1);
assert.equal(fixture.positions[1].sunVisibleFraction, 0);
assert.ok(fixture.positions[1].energy.firstDepletionHours !== null);
assert.equal(study.dataset.positions.length, 25);
for (const position of study.dataset.positions) {
  let previous = Array(360).fill(Infinity);
  for (const height of study.supportedHeightsMeters) {
    const values = study.heightProfiles[position.positionId][height.toFixed(1)];
    assert.equal(values.length, 360);
    values.forEach((v, i) => {
      assert.ok(Number.isFinite(v));
      assert.ok(
        v <= previous[i] + 1e-6,
        "Raising observer must not raise a baked horizon",
      );
    });
    previous = values;
  }
  assert.equal(position.ephemeris.timestampsUtc.length, 1465);
}
const window = selectStudyWindow(study.dataset, 0, 168);
const start = performance.now();
const result = analyzeDataset(
  window.dataset,
  window.windowEndUtc,
  analyze_json,
  profileParameters(0),
);
assert.equal(result.positions.length, 25);
for (const p of result.positions) {
  assert.equal(p.sunVisible.length, 168);
  assert.equal(p.energy.batterySocPct.length, 168);
  assert.ok(p.energy.minimumSocPct >= 0 && p.energy.minimumSocPct <= 100);
}
assert.throws(() =>
  analyze_json(
    JSON.stringify({
      schemaVersion: 1,
      timestampsUtc: ["2026-02-31T00:00:00Z"],
    }),
  ),
);
console.log(
  `Actual WASM checks PASS: synthetic geometric/battery contrast, 25 position-specific requests, 150 supported horizons, valid power arrays. One 7-day batch: ${(performance.now() - start).toFixed(1)} ms (not a benchmark guarantee).`,
);

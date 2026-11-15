import fs from "node:fs";
import assert from "node:assert/strict";
import init, { analyze_json } from "../../engine/pkg/first_contact_engine.js";
import { analyzeDataset } from "../src/services/missionEngine.ts";
import { selectStudyWindow } from "../src/services/studyWindow.ts";
import { profileParameters } from "../src/services/energyProfiles.ts";
import { scenarioPresets } from "../src/data/scenarioPresets.ts";
const study = JSON.parse(
  fs.readFileSync(new URL("../src/data/shackletonStudy.json", import.meta.url)),
);
await init({
  module_or_path: fs.readFileSync(
    new URL("../../engine/pkg/first_contact_engine_bg.wasm", import.meta.url),
  ),
});
const results = scenarioPresets.map((s) => {
  const source = {
    ...study.dataset,
    positions: study.dataset.positions
      .filter((p) => p.positionId === s.positionId)
      .map((p) => ({
        ...p,
        horizon: {
          ...p.horizon,
          horizonElevationDeg:
            study.heightProfiles[p.positionId][s.height.toFixed(1)],
        },
      })),
  };
  assert.equal(source.positions.length, 1);
  const w = selectStudyWindow(source, s.arrivalDay * 24, 168);
  const r = analyzeDataset(
    w.dataset,
    w.windowEndUtc,
    analyze_json,
    profileParameters(0),
  ).positions[0];
  return {
    ...s,
    sunFraction: r.sunVisibleFraction,
    earthFraction: r.earthVisibleFraction,
    continuousEarthHours: r.longestEarthVisibleHours,
    darknessHours: r.longestDarknessHours,
    minimumBatteryPct: r.energy.minimumSocPct,
    slopeDeg: study.points.find((p) => p.id === s.positionId).slopeDeg,
  };
});
assert.equal(results[0].continuousEarthHours, 0);
assert.ok(results[1].continuousEarthHours >= 4);
assert.ok(results[2].continuousEarthHours > results[1].continuousEarthHours);
assert.ok(results[3].slopeDeg > 10);
fs.writeFileSync(
  new URL("../../docs/validation/scenario-checks.json", import.meta.url),
  JSON.stringify(
    {
      scope:
        "Four exact-WASM exploratory cases in one Shackleton region; not historical mission outcomes. Default illustrative profile, 7 days, explicit per-position ephemeris.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  "Four exploratory cases verified with actual WASM; no historical mission outcome assertions.",
);

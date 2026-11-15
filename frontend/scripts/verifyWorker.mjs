import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { profileParameters } from "../src/services/energyProfiles.ts";
const assets = new URL("../dist/assets/", import.meta.url);
const file = fs
  .readdirSync(assets)
  .find((p) => p.startsWith("repairSearch.worker-"));
assert.ok(file, "Build the frontend before verifying the emitted worker");
const study = JSON.parse(
  fs.readFileSync(process.argv[2] ?? new URL("../src/data/shackletonStudy.json", import.meta.url)),
);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (url.protocol === "file:" && url.pathname.endsWith(".wasm"))
    return new Response(
      fs.readFileSync(new URL(path.basename(url.pathname), assets)),
      { headers: { "Content-Type": "application/wasm" } },
    );
  return originalFetch(input, options);
};
let result;
globalThis.self = {
  location: { href: new URL(file, assets).href },
  postMessage(message) {
    if (message.type === "complete" || message.type === "error")
      result = message;
  },
};
await import(new URL(file, assets).href);
const t = performance.now();
await self.onmessage({
  data: {
    dataset: study.dataset,
    heightProfiles: study.heightProfiles,
    heights: study.supportedHeightsMeters,
    durationDays: 7,
    constraints: {
      maxDarknessHours: 24,
      minEarthVisibleHours: 4,
      minimumSocPct: 20,
      maxSlopeDeg: 10,
    },
    energy: profileParameters(0),
    points: study.points,
    baseline: { positionId: "0:0", arrivalDay: 0, heightMeters: 0 },
  },
});
assert.equal(result?.type, "complete", result?.message);
assert.equal(result.total, 4500);
assert.equal(result.tested, 4500);
assert.ok(result.computed > 0);
assert.ok(
  result.feasibleCount > 0,
  "This recorded study should offer actual alternatives under the specified demonstration limits",
);
console.log(
  "Built worker actual WASM PASS:",
  JSON.stringify({
    tested: result.tested,
    computed: result.computed,
    feasible: result.feasibleCount,
    frontier: result.frontierCount,
    milliseconds: performance.now() - t,
    firstAlternative: result.frontier[0],
  }),
);

fs.mkdirSync(new URL("../../docs/validation/", import.meta.url), {
  recursive: true,
});
fs.writeFileSync(
  process.argv[3] ?? new URL("../../docs/validation/search-check.json", import.meta.url),
  JSON.stringify(
    {
      datasetId: study.dataset.datasetId,
      scope:
        "Built worker executed in Node with actual WASM; not browser interaction validation",
      tested: result.tested,
      computed: result.computed,
      feasible: result.feasibleCount,
      frontier: result.frontierCount,
      milliseconds: performance.now() - t,
      baseline: { positionId: "0:0", arrivalDay: 0, heightMeters: 0 },
      durationDays: 7,
      constraints: {
        maxDarknessHours: 24,
        minEarthVisibleHours: 4,
        minimumSocPct: 20,
        maxSlopeDeg: 10,
      },
      energy: profileParameters(0),
      firstAlternative: result.frontier[0],
    },
    null,
    2,
  ),
);

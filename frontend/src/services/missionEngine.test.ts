/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { syntheticComparisonFixture as fixture } from "../data/syntheticComparisonFixture.ts";
import { analyzeDataset } from "./missionEngine.ts";
import { profileParameters } from "./energyProfiles.ts";

const end = "2026-10-02T00:00:00Z";
function response() {
  return {
    schemaVersion: 1,
    assumptions: [
      "Sample states persist until the next timestamp or explicit window end.",
    ],
    positions: fixture.positions.map((p) => ({
      positionId: p.positionId,
      sunVisible: Array<boolean>(24).fill(true),
      earthVisible: Array<boolean>(24).fill(false),
      sunVisibleFraction: 1,
      earthVisibleFraction: 0,
      longestDarknessHours: 0,
      longestEarthBlackoutHours: 24,
      longestEarthVisibleHours: 0,
    })),
  };
}

test("passes explicit interval end and each position horizon to the engine", () => {
  const result = analyzeDataset(fixture, end, (json) => {
    const request = JSON.parse(json);
    assert.equal(request.windowEndUtc, end);
    assert.deepEqual(
      request.positions[1].horizon,
      fixture.positions[1].horizon,
    );
    assert.equal(request.timestampsUtc.length, 24);
    return JSON.stringify(response());
  });
  assert.equal(result.positions[1].longestEarthBlackoutHours, 24);
});

test("rejects missing or impossible UTC interval ends before calling engine", () => {
  for (const invalid of [
    "",
    "2026-10-02T00:00:00",
    "2026-02-31T00:00:00Z",
    fixture.ephemeris.timestampsUtc[23],
  ]) {
    assert.throws(() =>
      analyzeDataset(fixture, invalid, () => {
        assert.fail("Engine must not run");
      }),
    );
  }
});

test("rejects duplicate position IDs before calling engine", () => {
  const data = structuredClone(fixture);
  data.positions[1].positionId = data.positions[0].positionId;
  assert.throws(
    () =>
      analyzeDataset(data, end, () => {
        assert.fail("Engine must not run");
      }),
    /position/i,
  );
});

test("accepts canonical millisecond timestamps and a reordered response by position ID", () => {
  const data = structuredClone(fixture);
  data.ephemeris.timestampsUtc = data.ephemeris.timestampsUtc.map((t) =>
    t.replace("Z", ".000Z"),
  );
  const result = response();
  result.positions.reverse();
  assert.equal(
    analyzeDataset(data, "2026-10-02T00:00:00.000Z", () =>
      JSON.stringify(result),
    ).positions[0].positionId,
    fixture.positions[1].positionId,
  );
});

test("rejects malformed, mismatched and out-of-bounds engine responses", () => {
  const wrongId = response();
  wrongId.positions[1].positionId = "unknown";
  const shortFlags = response();
  shortFlags.positions[0].sunVisible.pop();
  const wrongFraction = response();
  wrongFraction.positions[0].sunVisibleFraction = 2;
  const wrongDuration = response();
  wrongDuration.positions[0].longestDarknessHours = 25;
  for (const value of [
    null,
    {},
    { ...response(), schemaVersion: 2 },
    wrongId,
    shortFlags,
    wrongFraction,
    wrongDuration,
  ]) {
    assert.throws(
      () => analyzeDataset(fixture, end, () => JSON.stringify(value)),
      /engine/i,
    );
  }
});

test("propagates engine errors without substituting synthetic success", () => {
  assert.throws(
    () =>
      analyzeDataset(fixture, end, () => {
        throw new Error("WASM calculation failed");
      }),
    /WASM calculation failed/,
  );
});

test("allows a single NASA-derived position only with traceable sources", () => {
  const data = structuredClone(fixture);
  data.positions = data.positions.slice(0, 1);
  Object.assign(data.provenance, {
    dataFidelity: "NASA_DERIVED",
    sourceUrls: ["https://pgda.gsfc.nasa.gov/products/78/"],
  });
  const output = response();
  output.positions = output.positions.slice(0, 1);
  assert.equal(
    analyzeDataset(data, end, () => JSON.stringify(output)).positions.length,
    1,
  );
  Object.assign(data.provenance, { sourceUrls: [] });
  assert.throws(
    () => analyzeDataset(data, end, () => JSON.stringify(output)),
    /source/i,
  );
});

test("evaluates per-position ephemeris separately instead of sharing observer vectors", () => {
  const data = structuredClone(fixture);
  data.positions[1].ephemeris = structuredClone(data.ephemeris);
  data.positions[1].ephemeris.sunElevationDeg.fill(7);
  const requests: {
    positions: { positionId: string }[];
    sunElevationDeg: number[];
  }[] = [];
  const result = analyzeDataset(data, end, (json) => {
    const req = JSON.parse(json);
    requests.push(req);
    return JSON.stringify({
      ...response(),
      positions: response().positions.filter(
        (p) => p.positionId === req.positions[0].positionId,
      ),
    });
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].sunElevationDeg[0], 7);
  assert.equal(result.positions.length, 2);
});

test("requires finite synchronized energy results when assumptions are requested", () => {
  assert.throws(
    () =>
      analyzeDataset(
        fixture,
        end,
        () => JSON.stringify(response()),
        profileParameters(0),
      ),
    /engine/i,
  );
  const output = {
    ...response(),
    positions: response().positions.map((p) => ({
      ...p,
      energy: {
        batterySocPct: Array(24).fill(50),
        solarPowerW: Array(24).fill(0),
        netPowerW: Array(24).fill(-25),
        surfaceTemperatureK: Array(24).fill(30),
        minimumSocPct: 50,
        firstDepletionHours: null,
        assumptions: ["Illustrative hardware only"],
      },
    })),
  };
  assert.equal(
    analyzeDataset(
      fixture,
      end,
      () => JSON.stringify(output),
      profileParameters(0),
    ).positions[0].energy?.minimumSocPct,
    50,
  );
  output.positions[0].energy.batterySocPct[0] = 120;
  assert.throws(
    () =>
      analyzeDataset(
        fixture,
        end,
        () => JSON.stringify(output),
        profileParameters(0),
      ),
    /engine/i,
  );
});

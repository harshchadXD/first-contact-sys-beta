/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { assessConstraints } from "./missionConstraints.ts";

const metrics = { longestDarknessHours: 8, longestEarthVisibleHours: 4 };
test("accepts a result exactly at both hard thresholds", () => {
  assert.deepEqual(
    assessConstraints(metrics, {
      maxDarknessHours: 8,
      minEarthVisibleHours: 4,
    }),
    [],
  );
});
test("reports every violated constraint without a weighted score", () => {
  const failures = assessConstraints(metrics, {
    maxDarknessHours: 7,
    minEarthVisibleHours: 5,
  });
  assert.equal(failures.length, 2);
  assert.match(failures[0], /darkness/i);
  assert.match(failures[1], /continuous Earth/i);
});
test("rejects invalid constraints and metrics", () => {
  for (const invalid of [-1, NaN, Infinity]) {
    assert.throws(() =>
      assessConstraints(metrics, {
        maxDarknessHours: invalid,
        minEarthVisibleHours: 0,
      }),
    );
    assert.throws(() =>
      assessConstraints(
        { ...metrics, longestEarthVisibleHours: invalid },
        { maxDarknessHours: 8, minEarthVisibleHours: 4 },
      ),
    );
  }
});

test("battery reserve and slope are hard failures independent of geometry", () => {
  const result = { ...metrics, energy: { minimumSocPct: 5 } };
  const failures = assessConstraints(
    result,
    {
      maxDarknessHours: 8,
      minEarthVisibleHours: 4,
      minimumSocPct: 20,
      maxSlopeDeg: 10,
    },
    12,
  );
  assert.equal(failures.length, 2);
  assert.match(failures[0], /battery/i);
  assert.match(failures[1], /slope/i);
});

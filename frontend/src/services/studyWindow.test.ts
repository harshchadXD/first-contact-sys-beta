/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { syntheticComparisonFixture } from "../data/syntheticComparisonFixture.ts";
import { selectStudyWindow } from "./studyWindow.ts";

test("uses the next recorded timestamp as the exclusive window end", () => {
  const result = selectStudyWindow(syntheticComparisonFixture, 0, 12);
  assert.equal(result.dataset.ephemeris.timestampsUtc.length, 12);
  assert.equal(result.windowEndUtc, "2026-10-01T12:00:00Z");
  assert.equal(syntheticComparisonFixture.ephemeris.timestampsUtc.length, 24);
});
test("rejects a window without a recorded endpoint or with invalid offsets", () => {
  for (const [start, hours] of [
    [0, 24],
    [-1, 12],
    [0, 0],
    [0, NaN],
    [0, 1.5],
  ]) {
    assert.throws(() =>
      selectStudyWindow(syntheticComparisonFixture, start, hours),
    );
  }
});

test("slices per-position ephemeris with the same recorded time window", () => {
  const data = structuredClone(syntheticComparisonFixture);
  data.positions[0].ephemeris = structuredClone(data.ephemeris);
  const result = selectStudyWindow(data, 2, 4);
  assert.equal(result.dataset.positions[0].ephemeris?.timestampsUtc.length, 4);
  assert.equal(
    result.dataset.positions[0].ephemeris?.timestampsUtc[0],
    data.ephemeris.timestampsUtc[2],
  );
});

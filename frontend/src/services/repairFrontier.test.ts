/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { repairFrontier } from "./repairFrontier.ts";
import type { RepairCandidate } from "./repairFrontier.ts";
const candidate = (
  id: string,
  distance: number,
  day: number,
  height: number,
): RepairCandidate => ({
  positionId: id,
  arrivalDay: day,
  heightMeters: height,
  distanceMeters: distance,
  arrivalShiftDays: day,
  heightShiftMeters: height,
  sunFraction: 1,
  earthFraction: 1,
  darknessHours: 0,
  continuousEarthHours: 24,
  minimumSocPct: 80,
});
test("keeps genuine repair tradeoffs and removes strictly worse changes", () => {
  const result = repairFrontier([
    candidate("move", 100, 0, 0),
    candidate("delay", 0, 1, 0),
    candidate("worse", 200, 1, 1),
  ]);
  assert.deepEqual(
    new Set(result.map((r) => r.positionId)),
    new Set(["move", "delay"]),
  );
});
test("an already feasible unchanged candidate dominates all changes", () => {
  assert.deepEqual(
    repairFrontier([
      candidate("same", 0, 0, 0),
      candidate("other", 100, 0, 0),
    ]).map((r) => r.positionId),
    ["same"],
  );
});
test("equal-cost but spatially different candidates remain available", () => {
  assert.equal(
    repairFrontier([candidate("east", 100, 0, 0), candidate("west", 100, 0, 0)])
      .length,
    2,
  );
});

/// <reference lib="webworker" />
import { initializeEngine } from "./engineLoader";
import { analyzeDataset } from "./missionEngine";
import { selectStudyWindow } from "./studyWindow";
import { assessConstraints } from "./missionConstraints";
import { repairFrontier } from "./repairFrontier";
import type { RepairCandidate } from "./repairFrontier";
import type { LunarComparisonDataset } from "../types/lunarSite";
import type { EnergyParameters } from "./energyProfiles";
import type { MissionConstraints } from "./missionConstraints";

export interface RepairRequest {
  dataset: LunarComparisonDataset;
  heightProfiles: Record<string, Record<string, number[]>>;
  heights: number[];
  durationDays: number;
  constraints: MissionConstraints;
  energy: EnergyParameters;
  points: { id: string; slopeDeg: number | null }[];
  baseline: { positionId: string; arrivalDay: number; heightMeters: number };
}
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async (event: MessageEvent<RepairRequest>) => {
  try {
    const request = event.data;
    const analyze = await initializeEngine(
      () => import("../../../engine/pkg/first_contact_engine.js"),
    );
    const origin = request.dataset.positions.find(
      (p) => p.positionId === request.baseline.positionId,
    );
    if (!origin)
      throw new Error("The selected baseline position is not in this study");
    const feasible: RepairCandidate[] = [];
    const total =
      request.heights.length * 30 * request.dataset.positions.length;
    let tested = 0,
      computed = 0;
    for (const height of request.heights)
      for (let day = 0; day < 30; day++) {
        for (const position of request.dataset.positions) {
          tested++;
          const slope = request.points.find(
            (p) => p.id === position.positionId,
          )?.slopeDeg;
          if (
            request.constraints.maxSlopeDeg !== undefined &&
            (slope === null ||
              slope === undefined ||
              slope > request.constraints.maxSlopeDeg)
          )
            continue;
          const profile =
            request.heightProfiles[position.positionId]?.[height.toFixed(1)];
          if (!profile)
            throw new Error(
              "Missing supported-height horizon; no extrapolation performed",
            );
          const source = {
            ...request.dataset,
            provenance: {
              ...request.dataset.provenance,
              observerMastHeightMeters: height,
            },
            positions: [
              {
                ...position,
                horizon: { ...position.horizon, horizonElevationDeg: profile },
              },
            ],
          };
          const window = selectStudyWindow(
            source,
            day * 24,
            request.durationDays * 24,
          );
          const result = analyzeDataset(
            window.dataset,
            window.windowEndUtc,
            analyze,
            request.energy,
          ).positions[0];
          computed++;
          if (
            assessConstraints(result, request.constraints, slope ?? undefined)
              .length
          )
            continue;
          feasible.push({
            positionId: position.positionId,
            arrivalDay: day,
            heightMeters: height,
            distanceMeters: Math.hypot(
              position.coordinates.dxMeters - origin.coordinates.dxMeters,
              position.coordinates.dyMeters - origin.coordinates.dyMeters,
            ),
            arrivalShiftDays: Math.abs(day - request.baseline.arrivalDay),
            heightShiftMeters: Math.abs(height - request.baseline.heightMeters),
            sunFraction: result.sunVisibleFraction,
            earthFraction: result.earthVisibleFraction,
            darknessHours: result.longestDarknessHours,
            continuousEarthHours: result.longestEarthVisibleHours,
            minimumSocPct: result.energy!.minimumSocPct,
          });
        }
        worker.postMessage({ type: "progress", tested, total, computed });
      }
    const frontier = repairFrontier(feasible);
    worker.postMessage({
      type: "complete",
      tested,
      total,
      computed,
      feasibleCount: feasible.length,
      frontier: frontier.slice(0, 12),
      frontierCount: frontier.length,
    });
  } catch (error) {
    worker.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Alternative search failed",
    });
  }
};

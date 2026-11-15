import type { PositionAnalysis } from "./missionEngine.ts";

export interface MissionConstraints {
  maxDarknessHours: number;
  minEarthVisibleHours: number;
  minimumSocPct?: number;
  maxSlopeDeg?: number;
}

/** Checks selected geometry, reserve and available slope limits, not mission survival. */
export function assessConstraints(
  result: Pick<
    PositionAnalysis,
    "longestDarknessHours" | "longestEarthVisibleHours"
  > & { energy?: { minimumSocPct: number } },
  constraints: MissionConstraints,
  slopeDeg?: number,
): string[] {
  if (
    ![
      result.longestDarknessHours,
      result.longestEarthVisibleHours,
      constraints.maxDarknessHours,
      constraints.minEarthVisibleHours,
    ].every((value) => Number.isFinite(value) && value >= 0)
  ) {
    throw new Error(
      "Constraint limits and interval metrics must be finite, nonnegative hours.",
    );
  }
  const violations: string[] = [];
  if (result.longestDarknessHours > constraints.maxDarknessHours) {
    violations.push(
      `Longest darkness ${result.longestDarknessHours.toFixed(1)} h exceeds ${constraints.maxDarknessHours.toFixed(1)} h.`,
    );
  }
  if (result.longestEarthVisibleHours < constraints.minEarthVisibleHours) {
    violations.push(
      `Longest continuous Earth visibility ${result.longestEarthVisibleHours.toFixed(1)} h is below ${constraints.minEarthVisibleHours.toFixed(1)} h.`,
    );
  }
  if (constraints.minimumSocPct !== undefined) {
    if (
      !Number.isFinite(constraints.minimumSocPct) ||
      constraints.minimumSocPct < 0 ||
      constraints.minimumSocPct > 100
    )
      throw new Error("Battery reserve must be a percentage in [0,100]");
    if (!result.energy)
      violations.push(
        "Battery assessment unavailable for the requested reserve.",
      );
    else if (
      !Number.isFinite(result.energy.minimumSocPct) ||
      result.energy.minimumSocPct < constraints.minimumSocPct
    )
      violations.push(
        `Minimum battery reserve ${result.energy.minimumSocPct.toFixed(1)}% is below ${constraints.minimumSocPct}%.`,
      );
  }
  if (constraints.maxSlopeDeg !== undefined) {
    if (
      !Number.isFinite(constraints.maxSlopeDeg) ||
      constraints.maxSlopeDeg < 0 ||
      constraints.maxSlopeDeg > 90
    )
      throw new Error("Slope limit must be in [0,90] degrees");
    if (slopeDeg === undefined || !Number.isFinite(slopeDeg))
      violations.push("Local slope assessment unavailable.");
    else if (slopeDeg > constraints.maxSlopeDeg)
      violations.push(
        `Local slope ${slopeDeg.toFixed(1)}° exceeds ${constraints.maxSlopeDeg}°.`,
      );
  }
  return violations;
}

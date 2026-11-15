export interface RepairCandidate {
  positionId: string;
  arrivalDay: number;
  heightMeters: number;
  distanceMeters: number;
  arrivalShiftDays: number;
  heightShiftMeters: number;
  sunFraction: number;
  earthFraction: number;
  darknessHours: number;
  continuousEarthHours: number;
  minimumSocPct: number;
}

/** Pareto-minimal changes among tested feasible candidates; no mixing metres and days into a score. */
export function repairFrontier(
  candidates: RepairCandidate[],
): RepairCandidate[] {
  const cost = (c: RepairCandidate) => [
    c.distanceMeters,
    c.arrivalShiftDays,
    c.heightShiftMeters,
  ];
  return candidates
    .filter(
      (a) =>
        !candidates.some((b) => {
          const aa = cost(a),
            bb = cost(b);
          return bb.every((v, i) => v <= aa[i]) && bb.some((v, i) => v < aa[i]);
        }),
    )
    .sort((a, b) => {
      const changed = (c: RepairCandidate) =>
        cost(c).filter((v) => v > 0).length;
      return (
        changed(a) - changed(b) ||
        a.arrivalShiftDays - b.arrivalShiftDays ||
        a.heightShiftMeters - b.heightShiftMeters ||
        a.distanceMeters - b.distanceMeters
      );
    });
}

import { validateDataset } from "../data/validateDataset.ts";
import type { PreparedStudy } from "../types/study.ts";

/** Remote static payloads must satisfy the same geometry and supported-height contract as the bundled study. */
export function validateStudyPayload(
  value: unknown,
): asserts value is PreparedStudy {
  if (!value || typeof value !== "object")
    throw new Error("Study payload is missing.");
  const study = value as PreparedStudy;
  const report = validateDataset(study.dataset);
  if (!report.valid)
    throw new Error(`Invalid regional data: ${report.errors.join("; ")}`);
  const t = study.terrain;
  if (
    !t ||
    !Number.isInteger(t.columns) ||
    !Number.isInteger(t.rows) ||
    t.columns < 2 ||
    t.rows < 2 ||
    t.columns > 512 ||
    t.rows > 512 ||
    !(t.spacingMeters > 0) ||
    !Number.isFinite(t.spacingMeters) ||
    !Number.isFinite(t.referenceElevationMeters) ||
    !Number.isFinite(t.gridNorthLongitudeDeg) ||
    !Array.isArray(t.elevationsMeters) ||
    t.elevationsMeters.length !== t.rows * t.columns ||
    !t.elevationsMeters.every(Number.isFinite)
  )
    throw new Error("Invalid regional terrain mesh.");
  if (
    !Array.isArray(study.points) ||
    study.points.length !== study.dataset.positions.length ||
    study.points.length !== 25
  )
    throw new Error("Regional positions and points do not match.");
  if (
    JSON.stringify(study.supportedHeightsMeters) !==
    JSON.stringify([0, 0.5, 1, 2, 5, 10])
  )
    throw new Error("Regional observer heights are unsupported.");
  const ids = new Set<string>();
  for (const point of study.points) {
    if (
      ids.has(point.id) ||
      ![
        point.eastMeters,
        point.northMeters,
        point.elevationMeters,
        point.slopeDeg,
      ].every((v) => typeof v === "number" && Number.isFinite(v)) ||
      !study.dataset.positions.some((p) => p.positionId === point.id)
    )
      throw new Error("Invalid regional point or duplicate ID.");
    ids.add(point.id);
    for (const height of study.supportedHeightsMeters) {
      const profile = study.heightProfiles?.[point.id]?.[height.toFixed(1)];
      if (
        !Array.isArray(profile) ||
        profile.length !== 360 ||
        !profile.every((v) => Number.isFinite(v) && v >= -90 && v <= 90)
      )
        throw new Error("Missing or invalid supported-height horizon.");
    }
  }
  const provenance = study.sourceManifest;
  const convergence = provenance?.correctedGeographicBake?.convergence;
  if (
    !/^[a-f0-9]{64}$/i.test(provenance?.lola_dem?.sha256 ?? "") ||
    !convergence ||
    ![
      convergence.halfDegreeMidpointMaxDifferenceDeg,
      convergence.finerRadialSamplingMaxDifferenceDeg,
      convergence.twentyVsThirtyKmMaxDifferenceDeg,
    ].every((v) => Number.isFinite(v) && v >= 0) ||
    !ids.has("0:0")
  )
    throw new Error("Regional provenance or reference point is missing.");
}

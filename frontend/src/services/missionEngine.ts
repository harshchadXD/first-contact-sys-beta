import type { LunarComparisonDataset } from "../types/lunarSite.ts";
import { validateDataset } from "../data/validateDataset.ts";
import type { EnergyParameters } from "./energyProfiles.ts";

export interface EnergyAnalysis {
  batterySocPct: number[];
  solarPowerW: number[];
  netPowerW: number[];
  surfaceTemperatureK: number[];
  minimumSocPct: number;
  firstDepletionHours: number | null;
  assumptions: string[];
}

export interface PositionAnalysis {
  energy?: EnergyAnalysis;
  positionId: string;
  sunVisible: boolean[];
  earthVisible: boolean[];
  sunVisibleFraction: number;
  earthVisibleFraction: number;
  longestDarknessHours: number;
  longestEarthBlackoutHours: number;
  longestEarthVisibleHours: number;
}

export interface AnalysisResponse {
  schemaVersion: 1;
  positions: PositionAnalysis[];
  assumptions: string[];
}

function utcMilliseconds(value: string): number {
  const milliseconds = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !==
      (value.includes(".") ? value : value.replace("Z", ".000Z"))
  ) {
    throw new Error(
      "Expected a valid UTC timestamp with seconds and a Z suffix",
    );
  }
  return milliseconds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Calls the reviewed WASM export; it never substitutes a JavaScript physics model. */
export function analyzeDataset(
  dataset: LunarComparisonDataset,
  windowEndUtc: string,
  analyzeJson: (request: string) => string,
  energy?: EnergyParameters,
): AnalysisResponse {
  const validation = validateDataset(dataset);
  if (!validation.valid)
    throw new Error(`Invalid dataset: ${validation.errors.join("; ")}`);
  const times = dataset.ephemeris.timestampsUtc.map(utcMilliseconds);
  const end = utcMilliseconds(windowEndUtc);
  if (!times.length || end <= times[times.length - 1])
    throw new Error("Window end must follow the last sample");
  const ids = new Set(dataset.positions.map((p) => p.positionId));
  if (
    ids.size !== dataset.positions.length ||
    [...ids].some((id) => !id.trim())
  ) {
    throw new Error("Evaluation position IDs must be non-empty and unique");
  }
  if (dataset.positions.some((p) => p.ephemeris)) {
    const responses = dataset.positions.map((p) => {
      const ephemeris = p.ephemeris ?? dataset.ephemeris;
      if (
        ephemeris.timestampsUtc.length !== times.length ||
        ephemeris.timestampsUtc.some(
          (t, i) => t !== dataset.ephemeris.timestampsUtc[i],
        )
      ) {
        throw new Error(
          `Position ${p.positionId} ephemeris timestamps do not match the study window`,
        );
      }
      const position = { ...p };
      delete position.ephemeris;
      return analyzeDataset(
        { ...dataset, ephemeris, positions: [position] },
        windowEndUtc,
        analyzeJson,
        energy,
      );
    });
    return {
      schemaVersion: 1,
      positions: responses.flatMap((r) => r.positions),
      assumptions: [...new Set(responses.flatMap((r) => r.assumptions))],
    };
  }
  const request = {
    schemaVersion: 1,
    ...dataset.ephemeris,
    windowEndUtc,
    energy,
    positions: dataset.positions.map((p) => ({
      positionId: p.positionId,
      horizon: p.horizon,
    })),
  };
  let response: unknown;
  const output = analyzeJson(JSON.stringify(request));
  try {
    response = JSON.parse(output);
  } catch {
    throw new Error("Invalid engine response: expected JSON");
  }
  const invalid = () =>
    new Error(
      "Invalid engine response: schema, position IDs, flags or metrics do not match the request",
    );
  if (
    !isRecord(response) ||
    response.schemaVersion !== 1 ||
    !Array.isArray(response.positions) ||
    response.positions.length !== ids.size ||
    !Array.isArray(response.assumptions) ||
    !response.assumptions.length ||
    !response.assumptions.every(
      (a) => typeof a === "string" && a.trim().length > 0,
    )
  )
    throw invalid();
  const seen = new Set<string>();
  const hours = (end - times[0]) / 3600_000;
  for (const position of response.positions) {
    if (
      !isRecord(position) ||
      typeof position.positionId !== "string" ||
      !ids.has(position.positionId) ||
      seen.has(position.positionId)
    )
      throw invalid();
    seen.add(position.positionId);
    for (const key of ["sunVisible", "earthVisible"]) {
      const flags = position[key];
      if (
        !Array.isArray(flags) ||
        flags.length !== times.length ||
        !flags.every((v) => typeof v === "boolean")
      )
        throw invalid();
    }
    for (const key of ["sunVisibleFraction", "earthVisibleFraction"]) {
      const value = position[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
      )
        throw invalid();
    }
    for (const key of [
      "longestDarknessHours",
      "longestEarthBlackoutHours",
      "longestEarthVisibleHours",
    ]) {
      const value = position[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > hours + 1e-9
      )
        throw invalid();
    }
    if (energy) {
      const output = position.energy;
      if (
        !isRecord(output) ||
        typeof output.minimumSocPct !== "number" ||
        !Number.isFinite(output.minimumSocPct) ||
        output.minimumSocPct < 0 ||
        output.minimumSocPct > 100 ||
        !Array.isArray(output.assumptions) ||
        !output.assumptions.every((v) => typeof v === "string")
      )
        throw invalid();
      for (const key of [
        "batterySocPct",
        "solarPowerW",
        "netPowerW",
        "surfaceTemperatureK",
      ]) {
        const values = output[key];
        if (
          !Array.isArray(values) ||
          values.length !== times.length ||
          !values.every((v) => typeof v === "number" && Number.isFinite(v))
        )
          throw invalid();
      }
      if (
        (output.batterySocPct as number[]).some((v) => v < 0 || v > 100) ||
        (output.solarPowerW as number[]).some((v) => v < 0) ||
        (output.surfaceTemperatureK as number[]).some((v) => v < 0)
      )
        throw invalid();
      if (
        output.firstDepletionHours !== null &&
        (typeof output.firstDepletionHours !== "number" ||
          !Number.isFinite(output.firstDepletionHours) ||
          output.firstDepletionHours < 0 ||
          output.firstDepletionHours > hours + 1e-9)
      )
        throw invalid();
    }
  }
  return response as unknown as AnalysisResponse;
}

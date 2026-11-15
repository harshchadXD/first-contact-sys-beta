/// <reference lib="webworker" />

import type { LunarSite } from "../types";
import type { BakedEphemerisSeries, LunarSiteDefinition } from "../science/types";
import { computeSiteEphemeris, OPS_EPOCH_MS } from "../science/ephemeris";
import { computeLocalSlopeDeg } from "../science/physicsEngine";
import { loadEngine, computeHorizonDeg } from "./wasmEngineBridge";

export const MAST_HEIGHT_CANDIDATES_M = [0.5, 1.5, 3.0, 5.5, 8.0, 10.0] as const;
export const DEFAULT_BATTERY_RESERVE_FRACTION = 0.2;

export interface RepairSearchRequest {
  site: LunarSite | LunarSiteDefinition;
  arrivalDayWindow: { startDay: number; endDay: number };
  batteryCapacityWh: number;
  hotelLoadW: number;
  slopeThresholdDeg: number;
  /** Minimum remaining battery energy required at the end of the analysis. */
  batteryReserveWh?: number;
  durationDays?: number;
}

export interface RepairCandidate {
  dxM: number;
  dyM: number;
  arrivalDay: number;
  mastHeightM: (typeof MAST_HEIGHT_CANDIDATES_M)[number];
  continuousShadowDurationH: number;
  minimumBatteryWh: number;
  slopeDeg: number;
}

export interface RepairSearchResult {
  tested: number;
  computed: number;
  feasibleCount: number;
  durationMs: number;
  frontier: RepairCandidate[];
}

type WorkerScope = DedicatedWorkerGlobalScope & {
  onmessage: ((event: MessageEvent<RepairSearchRequest>) => void) | null;
};

const workerScope = self as unknown as WorkerScope;

function getDispersionCells(site: LunarSite | LunarSiteDefinition): { dxM: number; dyM: number }[] {
  const anySite = site as any;
  if (Array.isArray(anySite.bakedDispersion) && anySite.bakedDispersion.length === 25) {
    return anySite.bakedDispersion.map((c: any) => ({
      dxM: Number(c.dxM ?? 0),
      dyM: Number(c.dyM ?? 0),
    }));
  }
  if (Array.isArray(anySite.dispersion_grid_5x5) && anySite.dispersion_grid_5x5.length === 25) {
    return anySite.dispersion_grid_5x5.map((c: any) => ({
      dxM: Number(c.dx_m ?? c.dxM ?? 0),
      dyM: Number(c.dy_m ?? c.dyM ?? 0),
    }));
  }
  if (Array.isArray(anySite.dispersionGrid25) && anySite.dispersionGrid25.length === 25) {
    return anySite.dispersionGrid25.map((c: any) => ({
      dxM: Number(c.dxM ?? 0),
      dyM: Number(c.dyM ?? 0),
    }));
  }

  // Standard 5x5 -200m to +200m polar dispersion grid
  const offsets = [-200, -100, 0, 100, 200];
  const cells: { dxM: number; dyM: number }[] = [];
  for (const dyM of offsets) {
    for (const dxM of offsets) {
      cells.push({ dxM, dyM });
    }
  }
  return cells;
}

function validateRequest(request: RepairSearchRequest): void {
  const { startDay, endDay } = request.arrivalDayWindow;
  if (!Number.isInteger(startDay) || !Number.isInteger(endDay) || startDay < 0 || endDay > 30 || startDay > endDay) {
    throw new Error("arrivalDayWindow must be an inclusive integer range within 0 to 30 days.");
  }
  for (const [label, value] of [
    ["batteryCapacityWh", request.batteryCapacityWh],
    ["hotelLoadW", request.hotelLoadW],
    ["slopeThresholdDeg", request.slopeThresholdDeg],
    ["batteryReserveWh", request.batteryReserveWh ?? 0],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`);
  }
}

function extractBakedEphemeris(site: LunarSite | LunarSiteDefinition | any): BakedEphemerisSeries | undefined {
  if (site?.bakedEphemeris?.sunAzDeg) return site.bakedEphemeris as BakedEphemerisSeries;
  const raw = site?.ephemeris;
  if (raw?.sun_az_deg) {
    return {
      startUtc: raw.start_utc,
      stepHours: raw.step_hours,
      sunAzDeg: raw.sun_az_deg,
      sunElDeg: raw.sun_el_deg,
      earthAzDeg: raw.earth_az_deg,
      earthElDeg: raw.earth_el_deg,
    };
  }
  return undefined;
}

function dominates(a: RepairCandidate, b: RepairCandidate): boolean {
  const noWorse =
    a.continuousShadowDurationH <= b.continuousShadowDurationH &&
    a.mastHeightM <= b.mastHeightM &&
    a.arrivalDay <= b.arrivalDay;
  const strictlyBetter =
    a.continuousShadowDurationH < b.continuousShadowDurationH ||
    a.mastHeightM < b.mastHeightM ||
    a.arrivalDay < b.arrivalDay;
  return noWorse && strictlyBetter;
}

function paretoFrontier(candidates: RepairCandidate[]): RepairCandidate[] {
  const frontier = candidates.filter((candidate, index) =>
    !candidates.some((other, otherIndex) => otherIndex !== index && dominates(other, candidate)),
  );

  return frontier.sort(
    (a, b) =>
      a.continuousShadowDurationH - b.continuousShadowDurationH ||
      a.mastHeightM - b.mastHeightM ||
      a.arrivalDay - b.arrivalDay ||
      b.minimumBatteryWh - a.minimumBatteryWh
  );
}

async function search(request: RepairSearchRequest): Promise<RepairSearchResult> {
  validateRequest(request);
  const startedAt = performance.now();
  const engine = await loadEngine();

  const cells = getDispersionCells(request.site);
  const anySite = request.site as any;
  const latDeg: number = anySite.site_metadata?.lat_deg ?? anySite.metadata?.latDeg ?? -89.9;
  const lonDeg: number = anySite.site_metadata?.lon_deg ?? anySite.metadata?.lonDeg ?? 0.0;
  const nominalSlopeDeg: number = anySite.site_metadata?.slope_deg ?? anySite.metadata?.nominalSlopeDeg ?? 2.5;

  const durationHours = (request.durationDays ?? 7) * 24;
  const azimuthDeg = Array.from({ length: 360 }, (_, i) => i);
  const batteryReserveWh = request.batteryReserveWh ?? request.batteryCapacityWh * DEFAULT_BATTERY_RESERVE_FRACTION;
  const ephemerisSite = {
    metadata: { latDeg, lonDeg },
    bakedEphemeris: extractBakedEphemeris(request.site),
  };

  // Precompute slopes for all 25 dispersion cells
  const cellSlopes = cells.map((cell) => {
    if (anySite.demGrid101 && anySite.metadata) {
      return computeLocalSlopeDeg(anySite as LunarSiteDefinition, cell.dxM, cell.dyM);
    }
    return nominalSlopeDeg;
  });

  const feasible: RepairCandidate[] = [];
  let tested = 0;
  let computed = 0;

  // Search across mast heights and arrival slip days
  for (const mastHeightM of MAST_HEIGHT_CANDIDATES_M) {
    // Precompute the 25 cell horizon profiles at this mast height
    const cellHorizons = cells.map((cell) =>
      computeHorizonDeg(request.site, mastHeightM, cell.dxM, cell.dyM)
    );

    for (let arrivalDay = request.arrivalDayWindow.startDay; arrivalDay <= request.arrivalDayWindow.endDay; arrivalDay += 1) {
      const startHour = arrivalDay * 24;
      const timestampsUtc: string[] = [];
      const sunAzimuthDeg: number[] = [];
      const sunElevationDeg: number[] = [];
      const earthAzimuthDeg: number[] = [];
      const earthElevationDeg: number[] = [];

      for (let h = 0; h < durationHours; h++) {
        const absHour = startHour + h;
        const vec = computeSiteEphemeris(ephemerisSite, absHour);
        timestampsUtc.push(new Date(OPS_EPOCH_MS + absHour * 3_600_000).toISOString());
        sunAzimuthDeg.push(Number((((vec.sunAzDeg % 360) + 360) % 360).toFixed(3)));
        sunElevationDeg.push(Number(vec.sunElDeg.toFixed(3)));
        earthAzimuthDeg.push(Number((((vec.earthAzDeg % 360) + 360) % 360).toFixed(3)));
        earthElevationDeg.push(Number(vec.earthElDeg.toFixed(3)));
      }

      const windowEndUtc = new Date(OPS_EPOCH_MS + (startHour + durationHours) * 3_600_000).toISOString();

      // Batch evaluate all 25 dispersion cells in 1 single WASM call
      const positions = cells.map((cell, idx) => ({
        positionId: `cell_${idx}`,
        horizon: {
          azimuthDeg,
          horizonElevationDeg: cellHorizons[idx],
        },
      }));

      const wasmPayload = {
        schemaVersion: 1,
        timestampsUtc,
        windowEndUtc,
        sunAzimuthDeg,
        sunElevationDeg,
        earthAzimuthDeg,
        earthElevationDeg,
        energy: {
          usableBatteryWh: request.batteryCapacityWh,
          initialSocFraction: 1.0,
          solarRatedW: 1000.0,
          hotelLoadW: request.hotelLoadW,
          transmitterLoadW: 40.0,
          panelTiltDeg: 90.0,
          panelAzimuthDeg: 0.0,
          trackSunAzimuth: true,
          albedo: 0.12,
          emissivity: 0.95,
          backgroundHeatFluxWM2: 0.013,
        },
        positions,
      };

      tested += cells.length;
      const responseJson = engine.analyze_json(JSON.stringify(wasmPayload));
      const rustResp = JSON.parse(responseJson);
      computed += rustResp.positions.length;

      for (let i = 0; i < rustResp.positions.length; i++) {
        const pos = rustResp.positions[i];
        const slopeDeg = cellSlopes[i];
        const minSocPct: number = pos.energy?.minimumSocPct ?? 100.0;
        const minimumBatteryWh = (minSocPct / 100.0) * request.batteryCapacityWh;
        const continuousShadowDurationH = pos.longestDarknessHours;

        if (minimumBatteryWh < batteryReserveWh || slopeDeg > request.slopeThresholdDeg) {
          continue;
        }

        feasible.push({
          dxM: cells[i].dxM,
          dyM: cells[i].dyM,
          arrivalDay,
          mastHeightM,
          continuousShadowDurationH,
          minimumBatteryWh,
          slopeDeg,
        });
      }
    }
  }

  return {
    tested,
    computed,
    feasibleCount: feasible.length,
    durationMs: performance.now() - startedAt,
    frontier: paretoFrontier(feasible),
  };
}

workerScope.onmessage = async (event: MessageEvent<RepairSearchRequest>): Promise<void> => {
  try {
    const result = await search(event.data);
    workerScope.postMessage(result);
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : String(error),
      tested: 0,
      computed: 0,
      feasibleCount: 0,
      durationMs: 0,
      frontier: [],
    });
  }
};

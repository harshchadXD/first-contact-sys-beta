import type { LunarSite } from "../types";
import { computeTopocentricEphemeris, getTopocentricEphemerisVector } from "../science/ephemeris";
import { computeLocalSlopeDeg, computeDynamicHorizonArray } from "../science/physicsEngine";
import type { LunarSiteDefinition } from "../science/types";

/** Candidate request for single-candidate evaluation. */
export interface AnalysisRequest {
  site: LunarSite | LunarSiteDefinition;
  dispersion_offset_m: { x: number; y: number };
  arrival_day: number;
  mast_height_m: number;
  battery_capacity_wh: number;
  hotel_load_w: number;
  slope_threshold_deg: number;
  duration_days?: number;
}

/** Metrics returned by the Rust analysis engine. */
export interface AnalysisResponse {
  continuous_shadow_duration_h: number;
  minimum_battery_wh: number;
  slope_deg: number;
  [metric: string]: unknown;
}

export interface WasmEngineModule {
  default: () => Promise<unknown>;
  initSync?: (bytes: Uint8Array | ArrayBuffer) => unknown;
  analyze_json: (requestJson: string) => string;
}

let enginePromise: Promise<WasmEngineModule> | undefined;

export async function loadEngine(): Promise<WasmEngineModule> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        let engine: any;
        if (
          typeof window === 'undefined' &&
          typeof (globalThis as any).process !== 'undefined' &&
          (globalThis as any).process.versions?.node
        ) {
          // Node.js test environment: resolve file paths relative to this file
          const path = await import('node:path');
          const fs = await import('node:fs');
          const { fileURLToPath, pathToFileURL } = await import('node:url');
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          const enginePath = path.resolve(currentDir, '../../engine/pkg/first_contact_engine.js');
          const wasmPath = path.resolve(currentDir, '../../engine/pkg/first_contact_engine_bg.wasm');
          engine = await import(pathToFileURL(enginePath).href);
          const wasmBuffer = fs.readFileSync(wasmPath);
          engine.initSync(wasmBuffer);
        } else {
          // Browser / Worker environment: Vite bundler resolution
          engine = (await import('../../engine/pkg/first_contact_engine.js')) as WasmEngineModule;
          await engine.default();
        }
        return engine;
      } catch (error) {
        enginePromise = undefined;
        throw new Error(
          "FIRST CONTACT.SYS WASM engine is unavailable. Ensure engine/pkg/first_contact_engine.js and its .wasm file are deployed and loadable.",
          { cause: error },
        );
      }
    })();
  }
  return enginePromise;
}

function extractSiteParams(site: LunarSite | LunarSiteDefinition) {
  const anySite = site as any;
  const latDeg = anySite.site_metadata?.lat_deg ?? anySite.metadata?.latDeg ?? -89.9;
  const lonDeg = anySite.site_metadata?.lon_deg ?? anySite.metadata?.lonDeg ?? 0.0;
  const h0Deg: number[] = anySite.horizon_mask_360?.h0_deg ?? anySite.horizonH0Deg ?? [];
  const dCritM: number[] = anySite.horizon_mask_360?.d_crit_m ?? anySite.dCritM ?? [];
  const nominalSlopeDeg = anySite.site_metadata?.slope_deg ?? anySite.metadata?.nominalSlopeDeg ?? 2.5;

  return { latDeg, lonDeg, h0Deg, dCritM, nominalSlopeDeg, demGrid101: anySite.demGrid101 };
}

/**
 * Computes dynamic horizon elevation angles across 360 azimuths [0..359].
 */
export function computeHorizonDeg(
  site: LunarSite | LunarSiteDefinition,
  mastHeightM: number,
  dxM: number,
  dyM: number
): number[] {
  const anySite = site as any;
  if (anySite.demGrid101 && anySite.metadata) {
    return computeDynamicHorizonArray(anySite as LunarSiteDefinition, mastHeightM, dxM, dyM);
  }

  const { h0Deg, dCritM } = extractSiteParams(site);
  const adjusted = new Array<number>(360);
  for (let az = 0; az < 360; az++) {
    const h0 = h0Deg[az] ?? 1.5;
    const dCrit = Math.max(120, dCritM[az] ?? 2500);
    const h0Rad = (h0 * Math.PI) / 180;
    const tanAdjusted = Math.tan(h0Rad) - mastHeightM / dCrit;
    adjusted[az] = Number(((Math.atan(tanAdjusted) * 180) / Math.PI).toFixed(3));
  }
  return adjusted;
}

/**
 * Evaluates a single candidate through the real Rust WebAssembly kernel.
 */
export async function analyzeWithWasm(request: AnalysisRequest): Promise<AnalysisResponse> {
  const engine = await loadEngine();

  const { latDeg, lonDeg, nominalSlopeDeg, demGrid101 } = extractSiteParams(request.site);
  const dxM = request.dispersion_offset_m.x;
  const dyM = request.dispersion_offset_m.y;

  let slopeDeg = nominalSlopeDeg;
  if (demGrid101 && (request.site as any).metadata) {
    slopeDeg = computeLocalSlopeDeg(request.site as LunarSiteDefinition, dxM, dyM);
  }

  const horizonElevationDeg = computeHorizonDeg(request.site, request.mast_height_m, dxM, dyM);
  const azimuthDeg = Array.from({ length: 360 }, (_, i) => i);

  const durationHours = (request.duration_days ?? 7) * 24;
  const startHour = request.arrival_day * 24;

  const timestampsUtc: string[] = [];
  const sunAzimuthDeg: number[] = [];
  const sunElevationDeg: number[] = [];
  const earthAzimuthDeg: number[] = [];
  const earthElevationDeg: number[] = [];

  for (let h = 0; h < durationHours; h++) {
    const absHour = startHour + h;
    const vec = getTopocentricEphemerisVector(request.site as any, absHour);
    timestampsUtc.push(new Date(Date.UTC(2026, 11, 1, h)).toISOString());
    sunAzimuthDeg.push(Number((((vec.sunAzDeg % 360) + 360) % 360).toFixed(3)));
    sunElevationDeg.push(Number(vec.sunElDeg.toFixed(3)));
    earthAzimuthDeg.push(Number((((vec.earthAzDeg % 360) + 360) % 360).toFixed(3)));
    earthElevationDeg.push(Number(vec.earthElDeg.toFixed(3)));
  }

  const windowEndUtc = new Date(Date.UTC(2026, 11, 1, durationHours)).toISOString();

  const wasmPayload = {
    schemaVersion: 1,
    timestampsUtc,
    windowEndUtc,
    sunAzimuthDeg,
    sunElevationDeg,
    earthAzimuthDeg,
    earthElevationDeg,
    energy: {
      usableBatteryWh: request.battery_capacity_wh,
      initialSocFraction: 1.0,
      solarRatedW: 1000.0,
      hotelLoadW: request.hotel_load_w,
      transmitterLoadW: 40.0,
      panelTiltDeg: 90.0,
      panelAzimuthDeg: 0.0,
      trackSunAzimuth: true,
      albedo: 0.12,
      emissivity: 0.95,
      backgroundHeatFluxWM2: 0.013,
    },
    positions: [
      {
        positionId: `eval_${dxM}_${dyM}`,
        horizon: {
          azimuthDeg,
          horizonElevationDeg,
        },
      },
    ],
  };

  try {
    const responseJson = engine.analyze_json(JSON.stringify(wasmPayload));
    const parsed = JSON.parse(responseJson);
    const pos = parsed.positions[0];
    const minSocPct: number = pos.energy?.minimumSocPct ?? 100.0;
    const minBatteryWh = (minSocPct / 100.0) * request.battery_capacity_wh;

    return {
      continuous_shadow_duration_h: pos.longestDarknessHours,
      minimum_battery_wh: minBatteryWh,
      slope_deg: slopeDeg,
    };
  } catch (error) {
    throw new Error(
      `FIRST CONTACT.SYS WASM analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

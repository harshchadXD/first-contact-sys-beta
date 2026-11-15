import initWasm, { WasmMissionEngine } from "../wasm/wasm_science.js";
import { runGmScenario } from "../gm-scenario.js";
import type { GMReference, GMValues, LunarSite, MissionResult, MissionSettings } from "../types";

type WasmExports = Awaited<ReturnType<typeof initWasm>>;
type ScenarioInput = {
  schema: string; initial_state_km_km_s: number[]; sample_times_et_tdb_seconds: number[];
  moon_offsets_km: number[][]; earth_offsets_km: number[][]; moon_to_j2000_row_major: number[][];
  site: { latitude_deg: number; east_longitude_deg: number; elevation_m: number };
  baseline_model: string; scenario_model: string; scenario_caveats: string[];
};

export type EngineBundle = {
  engine: WasmMissionEngine; wasm: WasmExports; scenario: ScenarioInput; reference: GMReference;
  site: LunarSite; baseline: MissionResult;
};

let wasmPromise: Promise<WasmExports> | undefined;
async function wasmExports() { wasmPromise ??= initWasm(); return wasmPromise; }

export async function loadEngineBundle(site: LunarSite, onProgress?: (message: string) => void): Promise<EngineBundle> {
  const [reference, scenario, csv, wasm] = await Promise.all([
    fetchJson<GMReference>("/data/gravitational_parameters_de421.json"),
    fetchJson<ScenarioInput>("/data/ephemeris/site04_gm_scenario.json"),
    fetchText("/data/ephemeris/site04.csv"), wasmExports(),
  ]);
  if (scenario.site.latitude_deg !== site.site_metadata.lat_deg || scenario.site.east_longitude_deg !== site.site_metadata.lon_deg) {
    onProgress?.("Ephemeris site and terrain site differ; using the baked official site geometry.");
  }
  const rows = parseEphemerisCsv(csv);
  const engine = new WasmMissionEngine();
  engine.set_data(
    new Float32Array(site.horizon_mask_360.h0_deg), new Float32Array(site.horizon_mask_360.d_crit_m),
    new Float32Array(rows.sunAz), new Float32Array(rows.sunEl), new Float32Array(rows.earthAz), new Float32Array(rows.earthEl),
  );
  const settings: MissionSettings = { profileIndex: 0, mastM: 1, hotelLoadW: 120, initialSoc: 0.8 };
  const baseline = evaluate(engine, wasm, settings);
  return { engine, wasm, scenario, reference, site, baseline };
}

export function runScenario(bundle: EngineBundle, gms: GMValues, settings: MissionSettings): {
  result: MissionResult; baseline: MissionResult; delta: Float32Array;
} {
  const site = bundle.site;
  const csvBaseline = bundle.baseline;
  const baseAngles = csvBaseline.timeline;
  // Re-establish the original baked DE421 series before each what-if run.
  bundle.engine.set_data(
    new Float32Array(site.horizon_mask_360.h0_deg), new Float32Array(site.horizon_mask_360.d_crit_m),
    new Float32Array(baseAngles.map((r) => r.sunAz)), new Float32Array(baseAngles.map((r) => r.sunEl)),
    new Float32Array(baseAngles.map((r) => r.earthAz)), new Float32Array(baseAngles.map((r) => r.earthEl)),
  );
  bundle.engine.set_hardware_profile(settings.profileIndex, profileBattery[settings.profileIndex], profileSolar[settings.profileIndex], profileComms[settings.profileIndex], 0);
  const baseline = evaluate(bundle.engine, bundle.wasm, settings);
  runGmScenario({ engine: bundle.engine, wasm: bundle.wasm, scenario: bundle.scenario, gms, mission: settings });
  const result = evaluate(bundle.engine, bundle.wasm, settings);
  const delta = new Float32Array(bundle.wasm.memory.buffer, bundle.engine.get_gm_scenario_delta_ptr(), bundle.engine.get_gm_scenario_delta_len()).slice();
  return { baseline, result, delta };
}

const profileBattery = [1200, 2400, 1800, 1000];
const profileSolar = [500, 900, 600, 450];
const profileComms = [80, 120, 100, 70];

function evaluate(engine: WasmMissionEngine, wasm: WasmExports, settings: MissionSettings): MissionResult {
  engine.evaluate(settings.profileIndex, settings.mastM, settings.hotelLoadW, settings.initialSoc);
  const metrics = Array.from(engine.get_metrics());
  const values = new Float32Array(wasm.memory.buffer, engine.get_results_ptr(), engine.get_results_len()).slice();
  const timeline = Array.from({ length: Math.floor(values.length / 10) }, (_, i) => {
    const j = i * 10;
    return { sunAz: values[j], sunEl: values[j + 1], sunFraction: values[j + 2], earthAz: values[j + 3], earthEl: values[j + 4],
      earthVisible: values[j + 5] > 0.5, socPct: values[j + 6], temperatureK: values[j + 7], solarW: values[j + 8], netW: values[j + 9] };
  });
  engine.solve_launch_slips(settings.profileIndex, settings.mastM, settings.hotelLoadW, settings.initialSoc);
  const launchValues = new Float32Array(wasm.memory.buffer, engine.get_launch_results_ptr(), engine.get_launch_results_len()).slice();
  const launch = Array.from({ length: Math.floor(launchValues.length / 7) }, (_, i) => {
    const j = i * 7;
    return { day: launchValues[j], sunPct: launchValues[j + 1], earthPct: launchValues[j + 2], darknessH: launchValues[j + 3],
      commsGapH: launchValues[j + 4], minSocPct: launchValues[j + 5], survives: launchValues[j + 6] > 0.5 };
  });
  return { metrics, timeline, launch };
}

function parseEphemerisCsv(text: string) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const index = Object.fromEntries(header.split(",").map((name, i) => [name, i]));
  const series = { sunAz: [] as number[], sunEl: [] as number[], earthAz: [] as number[], earthEl: [] as number[] };
  for (const line of lines) {
    const row = line.split(",");
    series.sunAz.push(Number(row[index.sun_az_deg])); series.sunEl.push(Number(row[index.sun_el_deg]));
    series.earthAz.push(Number(row[index.earth_az_deg])); series.earthEl.push(Number(row[index.earth_el_deg]));
  }
  if (!lines.length || Object.values(series).some((values) => values.some((v) => !Number.isFinite(v)))) throw new Error("Invalid DE421 ephemeris CSV");
  return series;
}

async function fetchJson<T>(url: string): Promise<T> { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }
async function fetchText(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); }

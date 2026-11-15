#!/usr/bin/env node
/** Run edited GMs through the compiled Rust/WASM mission engine and compare with DE421. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const scenarioPath = resolve(option("--scenario", "data/ephemeris/site04_gm_scenario.json"));
const baselinePath = resolve(option("--baseline", "data/ephemeris/site04.csv"));
const referencePath = resolve(option("--reference", "frontend/public/data/gravitational_parameters_de421.json"));
const sitesPath = resolve(option("--sites", "frontend/public/data/baked_lunar_sites.json"));
const gmsPath = option("--gms", null);
const outputPath = resolve(option("--output", "data/ephemeris/site04_gm_comparison.json"));
const wasmPath = resolve(option("--wasm", "wasm-science/pkg/wasm_science.js"));
const wasmBinaryPath = resolve(dirname(wasmPath), "wasm_science_bg.wasm");
const mission = {
  profileIndex: Number(option("--profile", "0")),
  mastM: Number(option("--mast-m", "1.5")),
  hotelLoadW: Number(option("--hotel-w", "120")),
  initialSoc: Number(option("--initial-soc", "0.8")),
};

const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
const reference = JSON.parse(await readFile(referencePath, "utf8"));
const sites = JSON.parse(await readFile(sitesPath, "utf8"));
const site = sites.sites?.find((entry) => entry.site_metadata.site_id === "PGDA-Site04-Shackleton");
if (!site || site.provenance.mode !== "validated_computed") {
  throw new Error("A validated PGDA-Site04-Shackleton terrain record is required for mission comparisons");
}
const edited = gmsPath ? JSON.parse(await readFile(resolve(gmsPath), "utf8")) : null;
const gmById = edited ?? Object.fromEntries(reference.bodies.map((b) => [b.id, b.gm_km3_s2]));
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--gm-scale") continue;
  const [id, factorText] = (args[i + 1] ?? "").split("=");
  const factor = Number(factorText);
  if (!Object.hasOwn(gmById, id) || !Number.isFinite(factor) || factor <= 0) {
    throw new Error("--gm-scale must be bodyId=positiveFactor, for example --gm-scale jupiter=1.001");
  }
  gmById[id] = Number(gmById[id]) * factor;
}
const gmOrder = ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const gmValues = gmOrder.map((id) => Number(gmById[id]));
if (gmValues.some((x) => !Number.isFinite(x) || x <= 0)) throw new Error("GM file must map body IDs to positive km^3/s^2 numbers");

const csv = (await readFile(baselinePath, "utf8")).trim().split(/\r?\n/);
const columns = csv[0].split(",");
const index = Object.fromEntries(columns.map((name, i) => [name, i]));
const rows = csv.slice(1).map((line) => line.split(","));
const values = (name) => rows.map((row) => Number(row[index[name]]));
const baseline = {
  sunAz: values("sun_az_deg"), sunEl: values("sun_el_deg"),
  earthAz: values("earth_az_deg"), earthEl: values("earth_el_deg"),
};
const { default: init, WasmMissionEngine } = await import(pathToFileURL(wasmPath));
const wasm = await init({ module_or_path: await readFile(wasmBinaryPath) });
const engine = new WasmMissionEngine();
const n = rows.length;
const horizon = new Float32Array(site.horizon_mask_360.h0_deg);
const criticalDistance = new Float32Array(site.horizon_mask_360.d_crit_m);
if (horizon.length !== 360 || criticalDistance.length !== 360) throw new Error("Site horizon must have 360 azimuth bins");
const arrays = Object.values(baseline).map((a) => new Float32Array(a));
engine.set_data(horizon, criticalDistance, ...arrays);
const battery = [1200, 2400, 1800, 1000][mission.profileIndex];
const solar = [500, 900, 600, 450][mission.profileIndex];
const comms = [80, 120, 100, 70][mission.profileIndex];
if (![battery, solar, comms].every(Number.isFinite)) throw new Error("--profile must be between 0 and 3");
engine.set_hardware_profile(mission.profileIndex, battery, solar, comms, 0);
engine.evaluate(mission.profileIndex, mission.mastM, mission.hotelLoadW, mission.initialSoc);
const baselineMetrics = Array.from(engine.get_metrics());
const baselineLaunch = runLaunchSolver(engine, mission);

const flatten = (a) => a.flat();
engine.apply_gm_scenario(
  new Float64Array(scenario.initial_state_km_km_s), new Float64Array(gmValues),
  new Float64Array(scenario.sample_times_et_tdb_seconds),
  new Float64Array(flatten(scenario.moon_offsets_km)), new Float64Array(flatten(scenario.earth_offsets_km)),
  new Float64Array(flatten(scenario.moon_to_j2000_row_major)),
  scenario.site.latitude_deg, scenario.site.east_longitude_deg, scenario.site.elevation_m,
);
engine.evaluate(mission.profileIndex, mission.mastM, mission.hotelLoadW, mission.initialSoc);
const scenarioMetrics = Array.from(engine.get_metrics());
const scenarioLaunch = runLaunchSolver(engine, mission);
const delta = copyF32(wasm.memory.buffer, engine.get_gm_scenario_delta_ptr(), engine.get_gm_scenario_delta_len());
const scenarioEphemeris = copyF32(wasm.memory.buffer, engine.get_gm_scenario_ephemeris_ptr(), engine.get_gm_scenario_ephemeris_len());
const componentNames = ["sun_azimuth_deg", "sun_elevation_deg", "earth_azimuth_deg", "earth_elevation_deg"];
const angularComparison = Object.fromEntries(componentNames.map((name, component) => {
  const v = [];
  for (let i = 0; i < n; i++) v.push(delta[i * 4 + component]);
  return [name, summarize(v)];
}));
const output = {
  schema: "firstcontact-gm-comparison-v1",
  baseline: scenario.baseline_model,
  scenario: scenario.scenario_model,
  caveats: scenario.scenario_caveats,
  site: scenario.site,
  epoch_start_utc: scenario.initial_epoch_utc,
  samples: n,
  interval_hours_nominal: 1,
  gm_values_km3_s2: Object.fromEntries(gmOrder.map((id, i) => [id, gmValues[i]])),
  comparison: angularComparison,
  mission_assumptions: { ...mission, hardware_profile: ["Nova-C", "Griffin", "Blue Ghost", "Vikram"][mission.profileIndex], battery_wh: battery, solar_w: solar, comms_budget_w: comms, site_terrain: "NASA PGDA Product 78 Site04 at 5 m/pixel with Product 90 regional 20 m/pixel LOLA horizon coverage; heuristic terrain flags and provisional hardware are not a certified landing assessment." },
  mission_metrics_layout: ["sun_percent", "earth_percent", "simultaneous_percent", "longest_darkness_hours", "longest_comms_gap_hours", "minimum_soc_percent", "minimum_temperature_k", "mission_survives_0_or_1"],
  mission_metrics_baseline: baselineMetrics,
  mission_metrics_scenario: scenarioMetrics,
  launch_slip_layout: ["slip_day", "sun_percent", "earth_percent", "longest_darkness_hours", "longest_comms_gap_hours", "minimum_soc_percent", "survives_0_or_1"],
  launch_slips_baseline: baselineLaunch,
  launch_slips_scenario: scenarioLaunch,
  scenario_ephemeris_layout: "per sample [sun_az_deg, sun_el_deg, earth_az_deg, earth_el_deg]",
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Compared ${n} samples; wrote ${outputPath}`);
console.log(JSON.stringify({ comparison: angularComparison, mission_metrics_baseline: baselineMetrics, mission_metrics_scenario: scenarioMetrics }, null, 2));
engine.free();

function copyF32(memory, ptr, length) { return new Float32Array(memory, ptr, length).slice(); }
function summarize(a) {
  return { mean_deg: a.reduce((s, x) => s + x, 0) / a.length,
    rms_deg: Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length),
    max_abs_deg: Math.max(...a.map(Math.abs)) };
}
function runLaunchSolver(e, m) {
  e.solve_launch_slips(m.profileIndex, m.mastM, m.hotelLoadW, m.initialSoc);
  const result = copyF32(wasm.memory.buffer, e.get_launch_results_ptr(), e.get_launch_results_len());
  return Array.from({ length: result.length / 7 }, (_, i) => Array.from(result.slice(i * 7, (i + 1) * 7)));
}

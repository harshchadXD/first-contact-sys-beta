/**
 * Bridge a DE421-baked scenario JSON and user-edited GM values into the WASM
 * mission engine. The mission engine must already have set_data()'d the
 * unchanged DE421 baseline horizon and pointing series.
 */

const flatten = (rows, width, label) => {
  if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row) || row.length !== width)) {
    throw new Error(`${label} must be an array of ${width}-value rows`);
  }
  return rows.flat();
};

const copyWasmF32 = (wasm, pointer, length) => {
  if (!length) return new Float32Array();
  return new Float32Array(wasm.memory.buffer, pointer, length).slice();
};

/**
 * Apply an edited GM set and run the regular mission simulation on that
 * scenario. `gms` maps lowercase body IDs to km^3/s^2 numbers; `mission` is
 * { profileIndex, mastM, hotelLoadW, initialSoc }.
 */
export function runGmScenario({ engine, wasm, scenario, gms, mission }) {
  if (scenario?.schema !== "firstcontact-gm-scenario-input-v1") {
    throw new Error("Unsupported GM scenario input schema");
  }
  const bodyKeys = ["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
  if (!Array.isArray(scenario.gm_input_order) || scenario.gm_input_order.join(",") !== bodyKeys.join(",")) {
    throw new Error("Scenario GM order is missing or incompatible");
  }
  const gmValues = bodyKeys.map((key) => Number(gms[key]));
  if (gmValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Every GM value must be a finite positive km^3/s^2 number");
  }

  engine.apply_gm_scenario(
    new Float64Array(scenario.initial_state_km_km_s),
    new Float64Array(gmValues),
    new Float64Array(scenario.sample_times_et_tdb_seconds),
    new Float64Array(flatten(scenario.moon_offsets_km, 3, "moon_offsets_km")),
    new Float64Array(flatten(scenario.earth_offsets_km, 3, "earth_offsets_km")),
    new Float64Array(flatten(scenario.moon_to_j2000_row_major, 9, "moon_to_j2000_row_major")),
    Number(scenario.site.latitude_deg),
    Number(scenario.site.east_longitude_deg),
    Number(scenario.site.elevation_m),
  );

  // apply_gm_scenario replaces active pointing data, so the existing mission
  // evaluator and launch-slip solver consume these scenario angles directly.
  engine.evaluate(mission.profileIndex, mission.mastM, mission.hotelLoadW, mission.initialSoc);
  return {
    scenarioEphemeris: copyWasmF32(wasm, engine.get_gm_scenario_ephemeris_ptr(), engine.get_gm_scenario_ephemeris_len()),
    deltaVsDe421: copyWasmF32(wasm, engine.get_gm_scenario_delta_ptr(), engine.get_gm_scenario_delta_len()),
    missionMetrics: new Float64Array(engine.get_metrics()),
    labels: {
      baseline: scenario.baseline_model,
      scenario: scenario.scenario_model,
      caveats: scenario.scenario_caveats,
      deltaLayout: "per sample: Sun dAz,dEl, Earth dAz,dEl in degrees; azimuth is shortest signed difference",
    },
  };
}

/** Return the official DE421 defaults in the propagator's fixed input order. */
export function de421DefaultGms(reference) {
  const byId = new Map(reference.bodies.map((body) => [body.id, Number(body.gm_km3_s2)]));
  return Object.fromEntries(["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]
    .map((id) => [id, byId.get(id)]));
}

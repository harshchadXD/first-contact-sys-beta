/* tslint:disable */
/* eslint-disable */

export class WasmMissionEngine {
    free(): void;
    [Symbol.dispose](): void;
    apply_gm_scenario(initial_states: Float64Array | number[], gm: Float64Array | number[], sample_times_et: Float64Array | number[], moon_offsets_km: Float64Array | number[], earth_offsets_km: Float64Array | number[], moon_to_j2000: Float64Array | number[], latitude_deg: number, east_longitude_deg: number, elevation_m: number): void;
    evaluate(profile_index: number, mast_m: number, hotel_load_w: number, initial_soc: number): void;
    get_gm_scenario_delta_len(): number;
    get_gm_scenario_delta_ptr(): number;
    get_gm_scenario_ephemeris_len(): number;
    get_gm_scenario_ephemeris_ptr(): number;
    get_launch_results_len(): number;
    get_launch_results_ptr(): number;
    get_metrics(): Float64Array;
    get_results_len(): number;
    get_results_ptr(): number;
    constructor();
    set_data(horizon_deg: Float32Array | number[], critical_distance_m: Float32Array | number[], sun_azimuth_deg: Float32Array | number[], sun_elevation_deg: Float32Array | number[], earth_azimuth_deg: Float32Array | number[], earth_elevation_deg: Float32Array | number[]): void;
    set_hardware_profile(index: number, battery_capacity_wh: number, solar_array_w: number, communication_load_w: number, panel_tilt_deg: number): void;
    solve_launch_slips(profile_index: number, mast_m: number, hotel_load_w: number, initial_soc: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmmissionengine_free: (a: number, b: number) => void;
    readonly wasmmissionengine_apply_gm_scenario: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number) => [number, number];
    readonly wasmmissionengine_evaluate: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wasmmissionengine_get_gm_scenario_delta_len: (a: number) => number;
    readonly wasmmissionengine_get_gm_scenario_delta_ptr: (a: number) => number;
    readonly wasmmissionengine_get_gm_scenario_ephemeris_len: (a: number) => number;
    readonly wasmmissionengine_get_gm_scenario_ephemeris_ptr: (a: number) => number;
    readonly wasmmissionengine_get_launch_results_len: (a: number) => number;
    readonly wasmmissionengine_get_launch_results_ptr: (a: number) => number;
    readonly wasmmissionengine_get_metrics: (a: number) => [number, number];
    readonly wasmmissionengine_get_results_len: (a: number) => number;
    readonly wasmmissionengine_get_results_ptr: (a: number) => number;
    readonly wasmmissionengine_new: () => number;
    readonly wasmmissionengine_set_data: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => [number, number];
    readonly wasmmissionengine_set_hardware_profile: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasmmissionengine_solve_launch_slips: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

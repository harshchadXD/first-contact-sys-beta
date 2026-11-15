/* @ts-self-types="./wasm_science.d.ts" */

export class WasmMissionEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmMissionEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmmissionengine_free(ptr, 0);
    }
    /**
     * @param {Float64Array | number[]} initial_states
     * @param {Float64Array | number[]} gm
     * @param {Float64Array | number[]} sample_times_et
     * @param {Float64Array | number[]} moon_offsets_km
     * @param {Float64Array | number[]} earth_offsets_km
     * @param {Float64Array | number[]} moon_to_j2000
     * @param {number} latitude_deg
     * @param {number} east_longitude_deg
     * @param {number} elevation_m
     */
    apply_gm_scenario(initial_states, gm, sample_times_et, moon_offsets_km, earth_offsets_km, moon_to_j2000, latitude_deg, east_longitude_deg, elevation_m) {
        const val7 = +latitude_deg;
        const val8 = +east_longitude_deg;
        const val9 = +elevation_m;
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5;
        try {
            ptr0 = passArrayF64ToWasm0(initial_states, wasm.__wbindgen_malloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF64ToWasm0(gm, wasm.__wbindgen_malloc);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArrayF64ToWasm0(sample_times_et, wasm.__wbindgen_malloc);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passArrayF64ToWasm0(moon_offsets_km, wasm.__wbindgen_malloc);
            len3 = WASM_VECTOR_LEN;
            ptr4 = passArrayF64ToWasm0(earth_offsets_km, wasm.__wbindgen_malloc);
            len4 = WASM_VECTOR_LEN;
            ptr5 = passArrayF64ToWasm0(moon_to_j2000, wasm.__wbindgen_malloc);
            len5 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr5) { wasm.__wbindgen_free(ptr5, len5 * 8, 8); }
            if (ptr4) { wasm.__wbindgen_free(ptr4, len4 * 8, 8); }
            if (ptr3) { wasm.__wbindgen_free(ptr3, len3 * 8, 8); }
            if (ptr2) { wasm.__wbindgen_free(ptr2, len2 * 8, 8); }
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 8, 8); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 8, 8); }
            throw e;
        }
        const ret = wasm.wasmmissionengine_apply_gm_scenario(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, val7, val8, val9);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} profile_index
     * @param {number} mast_m
     * @param {number} hotel_load_w
     * @param {number} initial_soc
     */
    evaluate(profile_index, mast_m, hotel_load_w, initial_soc) {
        const ret = wasm.wasmmissionengine_evaluate(this.__wbg_ptr, profile_index, mast_m, hotel_load_w, initial_soc);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {number}
     */
    get_gm_scenario_delta_len() {
        const ret = wasm.wasmmissionengine_get_gm_scenario_delta_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_gm_scenario_delta_ptr() {
        const ret = wasm.wasmmissionengine_get_gm_scenario_delta_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_gm_scenario_ephemeris_len() {
        const ret = wasm.wasmmissionengine_get_gm_scenario_ephemeris_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_gm_scenario_ephemeris_ptr() {
        const ret = wasm.wasmmissionengine_get_gm_scenario_ephemeris_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_launch_results_len() {
        const ret = wasm.wasmmissionengine_get_launch_results_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_launch_results_ptr() {
        const ret = wasm.wasmmissionengine_get_launch_results_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Float64Array}
     */
    get_metrics() {
        const ret = wasm.wasmmissionengine_get_metrics(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {number}
     */
    get_results_len() {
        const ret = wasm.wasmmissionengine_get_results_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_results_ptr() {
        const ret = wasm.wasmmissionengine_get_results_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.wasmmissionengine_new();
        this.__wbg_ptr = ret;
        WasmMissionEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Float32Array | number[]} horizon_deg
     * @param {Float32Array | number[]} critical_distance_m
     * @param {Float32Array | number[]} sun_azimuth_deg
     * @param {Float32Array | number[]} sun_elevation_deg
     * @param {Float32Array | number[]} earth_azimuth_deg
     * @param {Float32Array | number[]} earth_elevation_deg
     */
    set_data(horizon_deg, critical_distance_m, sun_azimuth_deg, sun_elevation_deg, earth_azimuth_deg, earth_elevation_deg) {
        let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5;
        try {
            ptr0 = passArrayF32ToWasm0(horizon_deg, wasm.__wbindgen_malloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF32ToWasm0(critical_distance_m, wasm.__wbindgen_malloc);
            len1 = WASM_VECTOR_LEN;
            ptr2 = passArrayF32ToWasm0(sun_azimuth_deg, wasm.__wbindgen_malloc);
            len2 = WASM_VECTOR_LEN;
            ptr3 = passArrayF32ToWasm0(sun_elevation_deg, wasm.__wbindgen_malloc);
            len3 = WASM_VECTOR_LEN;
            ptr4 = passArrayF32ToWasm0(earth_azimuth_deg, wasm.__wbindgen_malloc);
            len4 = WASM_VECTOR_LEN;
            ptr5 = passArrayF32ToWasm0(earth_elevation_deg, wasm.__wbindgen_malloc);
            len5 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr5) { wasm.__wbindgen_free(ptr5, len5 * 4, 4); }
            if (ptr4) { wasm.__wbindgen_free(ptr4, len4 * 4, 4); }
            if (ptr3) { wasm.__wbindgen_free(ptr3, len3 * 4, 4); }
            if (ptr2) { wasm.__wbindgen_free(ptr2, len2 * 4, 4); }
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 4, 4); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 4, 4); }
            throw e;
        }
        const ret = wasm.wasmmissionengine_set_data(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} index
     * @param {number} battery_capacity_wh
     * @param {number} solar_array_w
     * @param {number} communication_load_w
     * @param {number} panel_tilt_deg
     */
    set_hardware_profile(index, battery_capacity_wh, solar_array_w, communication_load_w, panel_tilt_deg) {
        const ret = wasm.wasmmissionengine_set_hardware_profile(this.__wbg_ptr, index, battery_capacity_wh, solar_array_w, communication_load_w, panel_tilt_deg);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} profile_index
     * @param {number} mast_m
     * @param {number} hotel_load_w
     * @param {number} initial_soc
     */
    solve_launch_slips(profile_index, mast_m, hotel_load_w, initial_soc) {
        const ret = wasm.wasmmissionengine_solve_launch_slips(this.__wbg_ptr, profile_index, mast_m, hotel_load_w, initial_soc);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) WasmMissionEngine.prototype[Symbol.dispose] = WasmMissionEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./wasm_science_bg.js": import0,
    };
}

const WasmMissionEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmmissionengine_free(ptr, 1));

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('wasm_science_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

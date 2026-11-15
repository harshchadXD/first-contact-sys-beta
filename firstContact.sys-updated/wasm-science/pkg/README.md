# First Contact.sys science engine

The crate is the client-side physics kernel. It consumes a baked 360-bin terrain horizon and hourly Sun/Earth topocentric azimuth/elevation arrays, then calculates mast clearance, solar-disk illumination, communications visibility, battery state of charge, equilibrium temperature, and 30 launch-slip windows.

## WASM build

Install Rust and `wasm-pack`, then run from the repository root:

```sh
wasm-pack build wasm-science --target web --release
```

The release profile enables size optimization, LTO, one codegen unit, and abort-on-panic. `wasm-pack`'s bundled optimizer is disabled because its version rejected WebAssembly features emitted by the current stable Rust compiler. The generated package builds without that optional post-optimization; apply `wasm-opt -Oz` later with a compatible Binaryen release if desired.

## JavaScript API

The generated module exports `WasmMissionEngine`:

1. Create an engine.
2. Call `set_data(horizonDeg, criticalDistanceM, sunAzDeg, sunElDeg, earthAzDeg, earthElDeg)` with `Float32Array` inputs. Horizon arrays have 360 entries; all time series arrays must have the same hourly length.
3. Optionally call `set_hardware_profile(index, batteryWh, arrayW, transmitW, panelTiltDeg)` to replace the provisional hardware power assumptions.
4. Call `evaluate(profileIndex, mastM, hotelW, initialSocFraction)` or `solve_launch_slips(...)`.
5. Read the pointer and length, then create a view into the current WASM memory buffer. Timeline records have 10 floats per hour: `[sunAzDeg, sunElDeg, sunFraction, earthAzDeg, earthElDeg, earthVisible, socPercent, surfaceTempK, solarW, netW]`. Launch results have 7 floats per day: `[slipDay, sunPercent, earthPercent, maxDarkHours, maxCommsGapHours, minSocPercent, survives]`.

Pointers are invalidated when the corresponding engine operation reallocates its result buffer. Create the `Float32Array` view after each operation. Launch-slip solving needs at least 59 days of hourly samples to evaluate 30 consecutive 30-day windows.

## Ephemeris and model assumptions

`ephemeris.rs` evaluates caller-supplied Chebyshev coordinate coefficients and converts Moon-centered MOON_ME positions to local azimuth/elevation. The crate does not parse NAIF SPK/PCK kernels. The offline data pipeline must use DE421 plus the matching lunar orientation/frame kernels to produce the hourly MOON_ME vectors before passing them to this engine.

Only the nominal hotel loads (Nova-C 120 W, Griffin 280 W, Blue Ghost 160 W, Vikram 100 W) come from the project brief. Battery capacity, solar-array rating, and communications loads in the starter profiles are explicitly provisional placeholders and must be replaced with sourced mission values using `set_hardware_profile` before presenting survival results as mission-specific. The temperature calculation is instantaneous radiative equilibrium; it does not model thermal inertia or depth-dependent heat flow.

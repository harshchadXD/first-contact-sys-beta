# First Contact.sys

**A lunar south-pole landing-site analysis console** combining LOLA terrain, DE421 illumination and communications geometry, landing-dispersion context, a CLPS power-survival model, and editable gravitational-parameter sensitivity scenarios.

## Run locally

Requirements: Node.js 20+, Rust with the `wasm32-unknown-unknown` target, `wasm-pack`, and Python 3.11+.

```powershell
cd wasm-science
wasm-pack build --target web --release
Copy-Item pkg\wasm_science.js, pkg\wasm_science_bg.wasm, pkg\wasm_science.d.ts ..\frontend\src\wasm\
cd ..\frontend
npm install
npm run dev
```

Open the Vite address printed in the terminal. The app defaults to the baked PGDA Site04 Shackleton Rim reference point and keeps `MOCK-01` visibly marked as synthetic. The web data includes the 5 m/pixel site patch, 30 km terrain horizon, hourly DE421 baseline, and DE421-seeded GM scenario inputs.

## Regenerate site data

Install the Python requirements, then use the official kernels and raster products described in [backend/README.md](backend/README.md). `bake_ephemeris.py` creates the direct DE421 baseline and GM-propagation inputs. `bake_lunar_data.py` combines the high-resolution local DEM with an optional larger regional DEM; the current reference uses Product 78 at 5 m/pixel and Product 90 at 20 m/pixel beyond its local raster bounds. Both sources are read in windows. The regional Product 90 COG can be streamed over HTTP range requests using GDAL's `/vsicurl/`.

`backend/tools/run_gm_scenario.mjs` runs the DE421-seeded what-if propagation through the compiled WASM engine and compares it with the unchanged ephemeris baseline using the baked Site04 horizon and selected hardware profile. For example, run `node backend/tools/run_gm_scenario.mjs --gm-scale sun=1.01` for a diagnostic perturbation; omit `--gm-scale` to compare the reference GMs.

## Model scope

GM edits use a reduced Newtonian point-mass model initialized from DE421 states. It omits DE421's PPN terms, asteroid perturbations, solar J2, and changes to the lunar orbit and orientation under edited Earth/Moon GMs. Those results are sensitivity scenarios, not revised DE421 products. Hardware ratings are provisional until replaced with sourced lander specifications. Read the [methodology](docs/methodology.md) and [references](REFERENCES.md) before interpreting mission scores.

## Build and validation

```powershell
cd frontend
npm run build
cd ..
cargo test --manifest-path wasm-science\Cargo.toml --lib
python -m pytest backend\tests
```

For ordinary use after dependency installation, run `cd frontend` then `npm run dev` and open the local URL printed by Vite. Rebuild the WASM bundle only when changing the Rust engine; the generated web bundle is included in `frontend/src/wasm/`.

## License and credits

Software: MIT. NASA/JPL and PGDA datasets retain their source attribution; see [REFERENCES.md](REFERENCES.md).

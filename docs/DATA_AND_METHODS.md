# Data, derivation and reproduction

## Runtime payload

The application loads `public/data/baked_lunar_sites.json` (about 2.05 MB, compact JSON).
It contains 15 records: **14 real south-polar sites and one synthetic calibration plane**.
Each record carries:

- `site_metadata` — coordinates, reference elevation, slope, RMS height uncertainty,
  reference frame, native pixel size, PSR proximity, and mission context.
- `provenance` — source URLs, product identifiers, raster windows, ray parameters, access
  time, and citation. Real records are marked `terrain_fidelity: lola_published`;
  `MOCK-01` is marked `synthetic`.
- `heightmap` — the 100 × 100, 16-bit visual height patch and its quantization metadata.
- `horizon_mask_360` — 360 horizon elevations `h0_deg` and controlling obstacle distances
  `d_crit_m`, sampled to a 30 km radius with lunar curvature correction.
- `dem_grid_101` — a 101 × 101 elevation grid at 5 m spacing for slope and skyline sampling.
- `dispersion_grid_5x5` — 25 cells at ±200 m in 100 m steps, with elevation, relative height,
  published slope and height uncertainty when available, and a display status. Missing source
  values remain `null`.
- `ephemeris` — 2,185 hourly Sun/Earth azimuth and elevation samples from
  2026-12-01T00:00Z through 2027-03-02T00:00Z.

The full multi-site bake manifest, including kernel hashes, is
`data/lola/bake_manifest.json`.

## Terrain sources

| Records | Source | Native resolution |
|---|---|---|
| 12 PGDA sites | `LDEM_80S_20MPP_ADJ`, `LDSM_80S_20MPP_ADJ`, and error rasters | 20 m/pixel |
| PGDA-04 | PGDA Product 78 `Site04_final_adj_5mpp_surf` and companions | 5 m/pixel |
| ISRO-CY3 | `LDEM_60S_60MPP_ADJ` | 60 m/pixel |
| MOCK-01 | Procedural flat plane | synthetic |

PSR distances use `LPSR_80S_20MPP_ADJ`. ISRO-CY3 is outside that product's coverage and is
reported as `null` / `n/a`; the merge tool enforces that exception explicitly.

## Dispersion, geometry and ephemeris

The dispersion display status is a slope-only heuristic: `SAFE` below 8°, `CAUTION` from 8°
to below 12°, `MISSION_LOSS_TRAP` at 12° or above, and `OUTSIDE_DATA` where elevation is
unavailable. It is not a landing safety certification or a mission-survival prediction.

Azimuth is clockwise from geographic north, independently of the polar projection grid.
Spherical destination rays are sampled bilinearly; radial terrain vectors are transformed
into the observer tangent plane with lunar reference radius 1,737,400 m. The ray step is
`max(pixel_size, 25 m)` out to 30 km. The horizon is stored in 360 one-degree bins, so narrow
sub-degree ridges and boulders below the native pixel size are not resolved.

DE421 Sun/Earth directions are geometric and expressed in MOON_ME, using the archived SPK,
leap-second kernel, lunar frame kernel, and orientation PCK. Hourly samples are treated as
interval-start values with an explicit exclusive endpoint. This is sampled geometry, not
continuous event root-solving. The compiled WASM engine applies the same series to the
terrain horizon for each mast height and dispersion offset.

## Derived mission model

The Rust/WASM engine combines solar incidence and penumbra, a battery state-of-charge model,
cryogenic capacity derating, an avionics thermal model, and geometric Earth visibility. A
5 × 5 dispersion grid is evaluated over the configured mission duration, and a 30-day
launch-slip matrix is scanned independently. The Pareto solver ranks real sites on solar
persistence, Earth visibility, slope, and PSR proximity when both compared sites have mapped
PSR distances, with survival as a hard constraint. Missing PSR coverage is unknown, not a
penalty. `MOCK-01` never enters that ranking, and an empty frontier is returned if no site
survives.

Power, thermal, and hardware values are exploratory assumptions. Geometric Earth visibility
is not an RF link budget, DSN schedule, or antenna-pattern model. Surface equilibrium is an
instantaneous radiative calculation, not a survival certification.

## Reproduction

The terrain and ephemeris bakers are in `backend/tools/`. The parallel bake outputs are
validated and merged with:

```powershell
python backend/tools/merge_lola_parts.py          # publish
python backend/tools/merge_lola_parts.py --check  # validate only
```

The merge refuses duplicate or missing sites, horizons shorter than 360 samples, malformed
101 × 101 grids, incomplete 5 × 5 dispersion sets, hourly series shorter than 2,185 samples,
or an unexplained missing PSR value. It writes the runtime JSON and refreshes the manifest.

`npm test` runs the 11 system/integration checks and 113 in-app science checks. `npm run
build` performs the TypeScript check and production bundle.

## Imagery and attribution

The landing Moon uses NASA SVS's CGI Moon Kit display mosaic, credited to NASA's Scientific
Visualization Studio / Ernie Wright and the LROC/LOLA teams. It is aesthetic imagery and
never supplies the scientific elevation or visibility calculations. NASA products and
source URLs are attributed in the runtime provenance; the code's MIT license does not
relicense upstream datasets or artwork.

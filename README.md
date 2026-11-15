# FIRST CONTACT.sys

**A lunar south-pole landing-site observatory.** Published LOLA terrain, baked JPL DE421
geometry, a 5 × 5 landing-dispersion grid, a CLPS power/thermal survival model, a 30-day
launch-slip scan, and an autonomous Pareto comparison across the south-polar candidate set.

Built for the NASA Space Apps Challenge 2026 **CLPS: Lunar Landing Site Navigator** challenge.

## What is in the box

- **14 real south-polar sites** — 13 NASA GSFC PGDA candidates plus ISRO Chandrayaan-3's
  Shiv Shakti Point. Terrain comes from published LOLA products: the 20 m/pixel 80°S
  adjusted DEM for most sites, the 5 m/pixel Site04 Shackleton Rim product for PGDA-04,
  and the 60 m/pixel 60°S DEM for ISRO-CY3.
- **One synthetic calibration case** — `MOCK-01` proves the full pipeline on a known flat
  plane. It is labelled everywhere, pinned last in the comparison table, and excluded from
  the Pareto frontier and every mission-site recommendation.
- **Per-site terrain products** — a 101 × 101 local elevation grid, a 360-sample horizon
  mask with obstacle distances, and a 5 × 5 dispersion grid spanning ±200 m.
- **Baked JPL DE421 sky** — 2,185 hourly Sun/Earth azimuth-elevation samples per site from
  2026-12-01T00:00Z through 2027-03-02T00:00Z, in the MOON_ME frame with kernel hashes
  recorded in `data/lola/bake_manifest.json`.
- **Mission model** — solar incidence with penumbra, battery state of charge, cryogenic
  thermal derating, DTE geometric visibility, launch-slip windows, and a survival-gated
  Pareto solver.
- **Observatory workspaces** — terrain, time, hardware, and comparison views; CSV export;
  keyboard control; a planner/educator copy toggle.

The app opens at **PGDA-01, Connecting Ridge**, with a default arrival of **2026-12-17**
(+16 days after the 2026-12-01 operations epoch) and a **3.0 m** observer mast. Those
defaults were chosen because that window is viable and exercises the full trade-space.

## Run locally

Requirements: Node.js 20+.

```powershell
npm install
npm run dev
```

The compiled WASM science bundle is committed in `src/wasm/`, so no Rust toolchain is
needed just to run the app.

## Build and validate

```powershell
npm run build   # TypeScript check + production Vite build
npm test        # 11 system/integration checks + 113 in-app science checks
```

The tests verify horizon bounds, penumbra math, thermal bounds, dispersion invariants,
DE421 sample coverage, real-terrain provenance, the survival-gated Pareto frontier, and the
calibration-plane exclusion.

## Scientific scope

This is a research explorer, not a flight-certification tool.

- Terrain is real published LOLA data. No procedural terrain is used for a real site.
- `MOCK-01` is the only synthetic terrain record; its sky is still real DE421 geometry.
- PSR distance is **proximity evidence**, not a confirmed ice measurement. ISRO-CY3 lies
  outside the published 80°S PSR product and is reported as `n/a`.
- Geometric Earth visibility is **not** an RF link budget and does not model DSN scheduling,
  antenna patterns, or pointing loss.
- LOLA resolution (5–60 m/pixel) resolves macro-topography and horizon blockage, not
  sub-metre boulders. Terminal hazard avoidance still requires onboard lidar.
- Power, thermal, and hardware parameters are exploratory assumptions until replaced with
  mission datasheets.
- GM edits run a separate reduced Newtonian sensitivity model. They are not modified DE421
  products and do not reproduce DE421's PPN terms, asteroid perturbations, or solar J2.

Read [docs/methodology.md](docs/methodology.md) and [REFERENCES.md](REFERENCES.md) before
interpreting mission scores.

## Regenerate the baked dataset

The source kernels and raster products are described in
[backend/README.md](backend/README.md). The shipped dataset was assembled from four
parallel LOLA/DE421 bake parts:

```powershell
python backend/tools/merge_lola_parts.py          # validate + publish
python backend/tools/merge_lola_parts.py --check  # validate only
```

The merge refuses missing sites, short horizons, malformed dispersion grids, incomplete
hourly series, or a missing PSR case that is not explicitly out of coverage. It writes
`public/data/baked_lunar_sites.json` and `data/lola/bake_manifest.json`.

`backend/tools/run_gm_scenario.mjs` runs the DE421-seeded GM sensitivity propagation through
the compiled WASM engine; for example `--gm-scale sun=1.01`.

## Project layout

| Path | Purpose |
|---|---|
| `src/` | React observatory, landing experience, and science engine |
| `public/data/` | Shipped baked site dataset, heightmaps, textures, GM table |
| `data/lola/` | Bake parts, manifest, and validation assets |
| `backend/tools/` | Terrain/ephemeris bakers, merge validation, capture tools |
| `wasm-science/` | Rust/WASM mission engine |
| `docs/` | Methodology, data dictionary, validation notes |
| `submission/` | Pitch deck, demo storyboard, captions |

## License and credits

Software: MIT. NASA/JPL and PGDA datasets retain their source attribution; see
[REFERENCES.md](REFERENCES.md). Moon display imagery: NASA SVS / LROC / LOLA.

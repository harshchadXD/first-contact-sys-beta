# Lead 2 data pipeline

Use Python 3.11 or later. The mock generator has no third-party dependencies. The real GeoTIFF baker needs the packages in `backend/requirements.txt`:

```cmd
python -m pip install -r backend/requirements.txt
```

## Generate development data

From the repository root:

```cmd
python backend/tools/generate_mock_dem.py
```

This writes a synthetic site JSON and 16-bit PNG under `frontend/public/data`. It includes 59 days of mock hourly Sun/Earth directions so the WASM engine can exercise its launch-slip windows. These mock angles and terrain are illustrative only.

## Bake a real raster

Download/extract the desired 5 m/pixel PGDA GeoTIFF files yourself, then provide a selected center pixel. Example:

```cmd
python backend/tools/bake_lunar_data.py --dem data\Site04_final_adj_5mpp_surf.tif --slope data\Site04_final_adj_5mpp_slp.tif --uncertainty data\Site04_final_adj_5mpp_toterr.tif --site-id PGDA-04 --name "Shackleton Rim" --latitude -89.7668 --longitude -171.8700 --reference-frame MOON_ME --center-row 2000 --center-col 2100
```

The center row/column must be selected for the actual raster footprint; verify coordinates and frame before baking. The current reference uses NASA PGDA Product 78 Site04 (Shackleton Rim), center pixel row 1600/column 1600, at approximately -89.7667415 latitude, -171.8928091 east longitude, and 767.979 m in the raster's MOON_ME/DE421 frame. The fine site rasters are 5 m/pixel. Product 90's adjusted 20 m/pixel LOLA COG fills the terrain horizon outside the Site04 raster footprint.

The actual hourly ephemeris CSV has columns `timestamp_utc,sun_az_deg,sun_el_deg,earth_az_deg,earth_el_deg`. It was generated for 2026-12-01 through 2027-01-31 from the matching archived DE421 kernels. To regenerate it:

```cmd
python backend\tools\bake_ephemeris.py --latitude -89.7667415 --longitude -171.8928091 --elevation-m 767.979 --start-utc 2026-12-01T00:00:00Z --end-utc 2027-01-31T00:00:00Z --output data\ephemeris\site04.csv
```

Then bake the matching terrain and horizon (GDAL streams Product 90 by HTTP range requests):

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) 'backend\.raster-vendor')
python backend\tools\bake_lunar_data.py --dem data\dem\Site04\Site04_final_adj_5mpp_surf.tif --slope data\dem\Site04\Site04_final_adj_5mpp_slp.tif --uncertainty data\dem\Site04\Site04_final_adj_5mpp_toterr.tif --regional-dem '/vsicurl/https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF' --ephemeris-csv data\ephemeris\site04.csv --site-id PGDA-Site04-Shackleton --name 'Shackleton Rim (Site04 footprint center)' --latitude -89.7667415 --longitude -171.8928091 --reference-frame 'MOON_ME / DE421' --center-row 1600 --center-col 1600 --radius-m 30000 --output-dir frontend\public\data
```

Copy `data\ephemeris\site04.csv` and `data\ephemeris\site04_gm_scenario.json` into `frontend\public\data\ephemeris` to serve them with the app. Repeated runs update the matching site ID in `baked_lunar_sites.json` and preserve other site records.

The baker rejects geographic/non-metre rasters and rotated grids, reads bounded windows, and records source CRS, paths, pixel size, ray coverage, frame declaration, and uncertainty provenance. Missing uncertainty data remains `null`.

## Ephemeris comparison

Reference CSVs for direct local-angle comparison need the same UTC timestamps and columns as the ephemeris CSV. Run:

```cmd
python -m backend.tools.benchmark_ephemeris computed.csv reference.csv --tolerance-deg 0.05
```

NASA SVS 5587 provides geocentric subsolar/subearth points and libration values, not site-local azimuth/elevation. Use it to validate lunar subpoint/orientation calculations; use JPL Horizons observer tables for direct local azimuth/elevation comparisons. Method limitations and source notes are in `docs/methodology.md` and `REFERENCES.md`.

## Generate hourly site ephemeris with DE421

The matching official DE421 kernel set, including the UTC leap-seconds kernel, is stored in `data/kernels/de421`. Generate a geometric hourly local Sun/Earth CSV and its companion DE421-seeded GM-scenario inputs with NAIF SPICE:

```cmd
python backend/tools/bake_ephemeris.py --latitude -84.7906 --longitude 29.1957 --elevation-m 5420 --start-utc 2026-01-01T00:00:00Z --end-utc 2026-03-01T00:00:00Z --output data\ephemeris\candidate_site_2026.csv
```

The candidate coordinates come from the project blueprint; verify the PGDA product/site identity and DEM coordinates before treating them as a selected landing site. The command writes `candidate_site_2026.csv`, a metadata sidecar with kernel SHA-256 hashes, and `candidate_site_2026_gm_scenario.json`. The CSV is the unchanged geometric DE421 baseline. The scenario JSON includes the start states, exact TDB sample times, Earth/Moon barycenter offsets, lunar orientation matrices, and provenance needed by the WASM propagator.

Run the comparison through the compiled WASM mission engine:

```cmd
node backend\tools\run_gm_scenario.mjs --scenario data\ephemeris\candidate_site_2026_gm_scenario.json --baseline data\ephemeris\candidate_site_2026.csv
```

The generated comparison JSON contains pointing deltas against the unchanged DE421 baseline, mission metrics for baseline and scenario, and launch-slip windows. To explore a GM perturbation, add one or more `--gm-scale body=factor` arguments (for example, `--gm-scale jupiter=1.001`). An edited GM file can be supplied with `--gms path\to\scenario.json`; it must be an object mapping the lowercase body IDs (`sun`, `earth`, `moon`, etc.) to positive values in km^3/s^2. This is a reduced Newtonian point-mass sensitivity run; it does not reproduce DE421's PPN terms, asteroid perturbations, solar J2, or a modified lunar orbit and orientation. Mission calculations remain provisional until real DEM and hardware inputs replace the mock terrain and placeholder hardware values.

# Lunar terrain data methodology

## Provenance and input

The baker accepts a LOLA-derived surface-elevation GeoTIFF in a projected lunar CRS whose axes are east/north in metres and pixels are square. NASA GSFC PGDA Product 78 identifies its 5 m/pixel south-polar site DEMs as MOON_ME (DE421) products and supplies companion slope and total-height-uncertainty rasters for many sites. The operator supplies the chosen center pixel, its site name and coordinates, and optional matching slope/uncertainty rasters. The program verifies matching raster dimensions, CRS and pixel transforms before using companion maps. This project's selected record is Product 78 Site04, catalogued as Shackleton Rim. Product 90's 20 m/pixel 80S regional LOLA DEM fills terrain rays outside the local Site04 raster footprint; see [the Product 90 page](https://pgda.gsfc.nasa.gov/products/90).

Do not infer the site identity from a `SiteXX` label alone. PGDA's current catalogue identifies Site20/Site20v2 as the Leibnitz Beta Plateau; Mons Mouton/IM-2 naming in project planning material needs independent verification against the actual DEM footprint before being used as site metadata.

## Crop and heightmap

The 100 by 100 pixel patch is read with a Rasterio `Window` centered on the selected landing pixel (500 m square for 5 m data). The baker writes a 16-bit grayscale PNG plus minimum elevation and metres-per-code metadata. The original elevations remain in the source GeoTIFF; the PNG is quantized for visualization and is not a substitute for the source DEM or its uncertainty raster. Raster reads are bounded windows: the complete source GeoTIFF is never loaded into RAM.

## Horizon and mast clearance

For each integer azimuth from 0 through 359 degrees, the baker samples the terrain from the site center out to the requested radius (default 30 km), at `max(pixel_size, 25 m)` steps. Azimuth is clockwise from north; projected X is east and Y is north. At each valid terrain sample with radial distance `d`, it computes

```text
angle = atan((Z(d) - Z0 - d^2 / (2 * 1,737,400 m)) / d)
```

The largest angle is stored as `h0_deg`; the distance of that sample is stored as `d_crit_m` for the WASM engine's dynamic mast correction. Ray reads are grouped in small windows (up to 128 points per chunk) to bound memory. The JSON records requested radius and minimum ray coverage; the tool warns if the source raster does not cover nearly the full requested radius. The finite ray step can miss narrow features, and the 360-bin azimuth spacing can miss sub-degree ridges. Outputs are resolution-limited terrain analyses, not certified landing safety determinations.

## Dispersion grid

The 5 by 5 grid samples offsets at -200, -100, 0, +100 and +200 m in east/north directions. Elevation and uncertainty are read from source rasters; if no slope raster is supplied, slope is estimated from a 3 by 3 central-difference stencil. Status labels use heuristic slope bands: `SAFE` below 8 degrees, `CAUTION` from 8 to below 12 degrees, and `MISSION_LOSS_TRAP` at 12 degrees or more. These thresholds are display categories only. A missing uncertainty raster is represented by JSON `null`; the baker does not invent an uncertainty estimate.

## Ephemeris validation

`bake_ephemeris.py` loads the archived DE421 SPK, the UTC leap-seconds kernel, and matching lunar PCK/FK kernels. It writes a geometric DE421 Sun/Earth baseline CSV and a companion GM-scenario JSON containing the DE421 barycentric starting state, exact SPICE TDB sample epochs, Earth/Moon offsets from the Earth-Moon barycenter, lunar-frame transforms, site coordinates, and kernel hashes. Geometric directions use `spkcpo` with `NONE` so the Newtonian scenario and baseline share the same reception-time convention. The GM scenario propagates a reduced ten-body Newtonian point-mass model with kick-drift-kick integration. Its angles replace the active mission-engine angles, so the normal mission and launch-slip calculations consume edited GM values. The WASM engine also keeps the original DE421 baseline and reports signed Sun/Earth azimuth/elevation deltas. This scenario does not reproduce DE421's PPN terms, asteroid perturbations, solar J2, or modified lunar orbit/orientation; it is a sensitivity run, not a replacement for DE421. The `benchmark_ephemeris.py` utility compares matching UTC rows in computed and reference CSV files using circular angular difference for azimuth.

NASA SVS 5587 publishes hourly 2026 geocentric lunar data including subsolar and subearth coordinates, J2000 RA/Dec, and libration fields. Those values can benchmark lunar orientation/subpoint calculations, but they are not site-local azimuth/elevation columns. For direct topocentric Sun/Earth azimuth/elevation validation, use JPL Horizons observer tables at the selected lunar site and convert/check the reference frame consistently. Do not report the 0.05-degree benchmark as passed without matching timestamp data and a documented frame conversion.

## Gravitational-parameter scenarios

`frontend/public/data/gravitational_parameters_de421.json` records the exact DE421 Table 1 body/system GM values and GM ratios. The original table supplied by the project brief is consistent with the DE421 constants at its displayed precision. The reference data also includes Uranus, Neptune, Pluto, the Moon, and the Earth-Moon system because the DE421 table contains these mass parameters.

The current Site04 comparison uses the Product 78 raster center at `-89.7667415°` latitude, `-171.8928091°` east longitude, and `767.979 m` elevation for 2026-12-01 through 2027-01-31 (1,465 hourly samples). These values are from the Site04 Shackleton Rim raster footprint; they should not be confused with other candidate sites or with IM-2's landing location. With the reference DE421 GMs, the reduced-model Sun azimuth differs from the unchanged geometric DE421 CSV by at most `0.000031°`; Sun elevation differs by at most `0.00000033°`, and Earth-angle differences are zero at the current output precision. A diagnostic `+1%` Sun-GM perturbation produces `0.08665°` RMS and `0.22696°` maximum Sun-azimuth difference over this interval. Earth direction remains unchanged in this reduced scenario because the Moon orbit and orientation relative to the Earth-Moon barycenter are held to their DE421 values. Mission comparison now consumes the real Site04 horizon and hourly Sun/Earth series. Hardware ratings and some model thresholds remain provisional, so its scores are exploratory planning metrics rather than validated mission predictions.

GM ratios are derived quantities (`GM_sun / GM_body`) and should be recomputed whenever either GM changes; they should not be independently adjustable. In the baseline mode, use DE421 ephemeris vectors unchanged. A user edit creates a separate sensitivity scenario. It can affect mission predictions only when a propagation model recomputes body states from a documented initial state, epoch, reference frame, time scale, force model, and integration step. Such a run must be compared to the unchanged DE421 baseline and labeled with its model assumptions; simply changing a displayed GM while continuing to use precomputed DE421 vectors does not alter the trajectory.

## Synthetic fallback

`generate_mock_dem.py` creates a procedural 100 by 100 terrain patch, a compact site JSON record, and a standard 16-bit grayscale PNG using Python's standard library only. All outputs are marked `synthetic_mock`; values are for interface development and must never be described as measured NASA terrain or science results.

# FIRST CONTACT.sys data dictionary

This document describes the values shipped by the application and the assumptions
used to interpret them. The explorer is an educational planning model, not a NASA
site ranking, flight dynamics product, or landing-safety certification.

## Runtime data

The application loads `public/data/baked_lunar_sites.json`. The dataset contains
**14 real sites and one synthetic calibration record**. The 14 real sites use
published LOLA terrain products; `MOCK-01` is a synthetic zero-elevation plane and
is retained only to exercise the analysis pipeline. The comparison UI assigns it
no ranked suitability score and excludes it from recommendations and the Pareto
frontier; its telemetry remains calibration output, not a real-site result.

Each record contains:

| Field | Meaning |
|---|---|
| `site_metadata` | Site ID, label, selenographic coordinates, reference elevation, nominal slope, data resolution/frame, source context, and optional uncertainty and PSR proximity fields. Missing source measurements remain `null`. |
| `provenance` | Terrain source/product, URL, raster window, native pixel size, reference frame, horizon ray settings, access time, and citation. Synthetic provenance is explicit. |
| `heightmap` | 100 × 100 quantized display texture. It is for visualization and does not replace the source DEM. |
| `horizon_mask_360` | One baseline terrain elevation angle `h0_deg` and controlling-ray distance `d_crit_m` for each integer azimuth from 0° to 359°. |
| `dem_grid_101` | Local 101 × 101 elevation samples covering a 500 m square at 5 m spacing, resampled from the relevant source raster. Native resolution remains 5, 20, or 60 m/pixel as recorded per site. |
| `dispersion_grid_5x5` | 25 terrain samples at east/north offsets −200, −100, 0, +100, and +200 m. Elevation, slope, and RMS height uncertainty may be null where the source does not provide coverage. |
| `ephemeris` | 2,185 hourly geometric Sun/Earth azimuth and elevation samples in MOON_ME from 2026-12-01T00:00Z through 2027-03-02T00:00Z. |

The bake manifest at `data/lola/bake_manifest.json` records source and kernel hashes.
Rebuild and schema checks are described in [DATA_AND_METHODS.md](DATA_AND_METHODS.md).

## Terrain products and derived geometry

| Sites | Terrain source | Native resolution |
|---|---|---:|
| 12 PGDA regional candidates | NASA GSFC PGDA adjusted 80°S LOLA DEM and companion slope/error products where available | 20 m/pixel |
| PGDA-04 | PGDA Product 78 Site04 surface, slope and error products, with the 20 m/pixel regional DEM used beyond its local footprint | 5 m/pixel local; 20 m/pixel regional |
| ISRO-CY3 | NASA GSFC PGDA adjusted 60°S LOLA DEM | 60 m/pixel |
| MOCK-01 | Synthetic flat plane | synthetic |

The reported PGDA-04 center is on a steep crater rim (about 32.7° nominal slope in
the shipped record). This is the selected raster center, not a claim that the full
Shackleton region is uniformly steep or a representation of the IM-2 landing site.

PSR proximity is distance to the nearest mapped permanently shadowed region in the
published PSR product. It is spatial context only; it does not confirm water ice at
the candidate point. ISRO-CY3 is outside the PSR product coverage and correctly has
no PSR distance.

Azimuth is clockwise from geographic north. The horizon baker samples terrain rays
to 30 km, applies lunar-curvature correction using a 1,737,400 m reference radius,
and stores one value per degree. `d_crit_m` is the distance of the ray sample that
sets the baseline horizon. The runtime adjusts distant horizon clearance for mast
height and combines it with a near-field skyline sampled from the local DEM. Ray
spacing, source resolution, and one-degree azimuth bins limit the detail resolved;
the products do not certify boulder-scale hazards.

## Ephemeris and time

The shipped sky series is baked from the JPL DE421 SPK with matching NAIF lunar
orientation kernels. It contains geometric topocentric directions in the MOON_ME
frame at one-hour intervals. Runtime interpolation between adjacent samples is
linear, with circular interpolation for azimuth. Mission windows inside the baked
envelope use this series. Requests outside it use a low-order analytic fallback,
which is explicitly labelled and is **not DE421**.

The common operations epoch is 2026-12-01T00:00Z. The default PGDA-01 arrival is
2026-12-17 (+16 days) with a 3.0 m observer mast. Hourly sampling is not continuous
event root-solving; very short visibility transitions can fall between samples.

## Dispersion and mission outputs

The 5 × 5 grid reports terrain values at offsets across a 400 m center-to-center
span. Its baked display status is a **slope-only heuristic**: `SAFE` below 8°,
`CAUTION` from 8° to below 12°, `MISSION_LOSS_TRAP` at 12° or above, and
`OUTSIDE_DATA` when elevation is unavailable. These labels do not certify the
terrain or predict mission survival.

For the selected offset, the runtime evaluates solar visibility, geometric Earth
visibility, battery state of charge, a simplified thermal model, darkness duration,
and communications geometry over the configured stay. Percentages are sampled
fractions of hourly intervals. Earth visibility is not an RF link budget, antenna
pattern, DSN schedule, or link-availability guarantee. Thermal values are simple
radiative estimates with an internal-heat assumption, not Diviner measurements at
the selected point or a survival certification.

The displayed weighted suitability score is an **exploratory project metric**:

```text
score = (sun_weight × sun_visible_percent
       + earth_weight × earth_visible_percent
       + terrain_weight × max(0, 100 − 5 × slope_degrees))
        / (sun_weight + earth_weight + terrain_weight)
```

It is not an official NASA ranking. The Pareto comparison instead shows the
underlying illumination, geometric Earth visibility, slope, and PSR proximity
metrics. Survival is treated as a hard constraint; the synthetic calibration case
is excluded from comparisons. A missing PSR distance is unknown: that objective is
compared only when both sites have mapped values, never as an invented long distance
or a positive ice detection.

## Spacecraft model profiles

The following values are configuration inputs in `src/science/lunarData.ts`. They
are **illustrative project assumptions**, not vendor-published or verified flight
specifications. The app allows relevant assumptions to be changed in its hardware
workspace.

| Profile | Modeled solar rating | Modeled battery | Hotel load | Slope limit | Default mast |
|---|---:|---:|---:|---:|---:|
| Nova-C | 520 W | 2.5 kWh | 120 W | 10° | 3.0 m |
| Griffin | 780 W | 5.0 kWh | 280 W | 15° | 2.2 m |
| Blue Ghost | 620 W | 3.2 kWh | 160 W | 12° | 3.5 m |
| Vikram | 410 W | 1.8 kWh | 100 W | 8° | 2.0 m |

Other modeled inputs include a 1,361 W/m² solar constant, 0.12 regolith albedo,
0.95 emissivity, 27–392 K surface-temperature clamp, and a default 1.5 W internal
heat-flux assumption. These constants and model simplifications should not be read
as site measurements or validated spacecraft performance.

## Sources and reproduction

Terrain, product identifiers, per-site source URLs, and the Barker et al. citation
are recorded in the baked manifest and site provenance. NASA display imagery is
used only for presentation, never as the elevation input. The data baker and merge
commands are documented in [DATA_AND_METHODS.md](DATA_AND_METHODS.md), and the
project limitations and test commands are in [README.md](../README.md).

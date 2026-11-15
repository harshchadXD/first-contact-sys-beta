---
marp: true
theme: default
paginate: true
backgroundColor: #050608
color: #e2e8f0
style: |
  section { font-family: 'Aptos', 'Segoe UI', sans-serif; padding: 56px 72px; }
  h1, h2 { color: #f2f5f6; letter-spacing: -0.03em; }
  h1 { font-size: 1.65em; }
  h2 { color: #38bdf8; font-size: .85em; letter-spacing: .12em; text-transform: uppercase; }
  strong { color: #facc15; }
  blockquote { border-left: 3px solid #38bdf8; color: #aab8c0; }
  footer { color: #74828c; font-size: 14px; }
---

<!-- _class: lead -->

# FIRST CONTACT.sys
## Lunar Landing Site Navigator

**See the local horizon. Check the power window. Move the landing point.**

NASA Space Apps Challenge 2026 · CLPS: Lunar Landing Site Navigator

---

## 01 — A landing site is more than a pin

IM-2 Athena landed near Mons Mouton on March 6, 2025. NASA reported that the lander
came to rest on its side, limiting science operations. At the lunar south pole,
nearby terrain can also interrupt sunlight and geometric view of Earth.

> First Contact makes those local geometry and energy trade-offs inspectable before a landing point is chosen.

*Context only: the app does not model IM-2's actual touchdown terrain or reconstruct its telemetry.*

---

## 02 — The south-pole geometry problem

- The Sun follows a shallow arc, so small terrain ridges can change illumination.
- Earth visibility changes with lunar orientation and the local skyline.
- A 500 m analysis patch shows terrain variation near the candidate center.
- Terrain line of sight does **not** equal a complete RF link budget.

**One reference point. One hourly sky. Twenty-five nearby terrain cells.**

---

## 03 — Fourteen real sites, one calibration case

**Terrain:** 12 PGDA regional candidates use published LOLA products at 20 m/pixel; PGDA-04 uses the Site04 product at 5 m/pixel with a 20 m/pixel regional DEM beyond its local footprint; ISRO-CY3 uses the 60 m/pixel 60°S DEM.

**Local analysis:** each site has a 360-bin horizon and 101 × 101 grid sampled at 5 m spacing. The grid is resampled from source terrain; it does not increase native resolution. Published slope and height-error values are carried where available; missing values remain missing.

**A deliberate hard case:** the selected PGDA-04 center lies on a steep Shackleton rim (about 32.7° nominal slope). It is not a benign plateau and is not the IM-2 landing site.

**Calibration:** MOCK-01 is a synthetic flat plane. It remains visible for pipeline checks, has no composite suitability score, and is excluded from recommendations and the Pareto frontier.

---

## 04 — Trace the data into a landing view

1. Read bounded windows from the published DEM products.
2. Cast 360 azimuth rays with lunar-curvature correction, to 30 km where data coverage allows.
3. Carry source slope and height uncertainty into a 5 × 5 offset grid; preserve unavailable values as `n/a`.
4. Evaluate offsets over the configured mission duration against the local horizon and sampled sky.
5. Render terrain with illustrative lighting; the rendered surface is not the science input.

Regional DEM fill is used for PGDA-04 horizon rays beyond the local Site04 raster. Every site carries source provenance; MOCK-01 is marked synthetic.

---

## 05 — Put mission assumptions on screen

- Inspect 2,185 hourly geometric Sun/Earth samples from 2026-12-01 to 2027-03-02.
- The default scenario opens at PGDA-01 with a +16-day arrival (2026-12-17) and a 3.0 m observer mast.
- Compare mast height, hotel load, spacecraft profile, and arrival timing.
- Inspect darkness, geometric Earth visibility, battery state, and the 30-day launch-slip scan.
- Outside the baked DE421 envelope, the analytic fallback is labelled as a non-DE421 approximation.

**DE421 remains the baseline.** Editable GM runs use a separate reduced Newtonian sensitivity model, not a modified DE421 product.

---

## 06 — Explore the trade, inspect the limits

**Planner:** terrain, energy, and arrival windows in one workspace.

**Educator:** a simplified atmosphere comparison band and a visible Sun/Earth sky path.

**Failure replay:** select a high-slope offset to explore an off-nominal model case. This is an illustration, not an IM-2 telemetry reconstruction or causal finding.

---

## 07 — What the result can support

- Fourteen real records use published LOLA terrain; MOCK-01 is synthetic and excluded from site recommendations.
- PSR distance is proximity to a mapped region, not a confirmed ice measurement. ISRO-CY3 is outside the PSR product coverage.
- Geometric Earth visibility is not an RF link budget, antenna-pattern model, or DSN schedule.
- Hourly sampling can miss short visibility transitions; LOLA-scale terrain does not resolve sub-metre hazards.
- Spacecraft power and thermal profiles are exploratory assumptions, not verified vendor specifications.
- The GM sensitivity model omits DE421's PPN terms, asteroid perturbations, solar J2, and modified lunar orbit/orientation.

**A planning explorer with visible assumptions—not a flight certification.**

<footer>Sources and method: `REFERENCES.md` · `docs/methodology.md` · `docs/DATA_AND_METHODS.md`</footer>

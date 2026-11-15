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

# FIRST CONTACT.SYS
## Lunar Landing Site Navigator

**See the local horizon. Check the power window. Move the landing point.**

NASA Space Apps Challenge · CLPS: Lunar Landing Site Navigator

---

## 01 — A landing site is more than a pin

IM-2 Athena landed near Mons Mouton on March 6, 2025. NASA reports that the lander came to rest on its side, limiting science operations.

Polar terrain adds a second planning problem: the Sun and Earth skim low horizons, so nearby ridges can interrupt power and geometric communications visibility.

> Our tool makes those local geometry and energy trade-offs inspectable before a landing point is chosen.

*Source: NASA mission summary and IM-2 surface report.*

---

## 02 — The south-pole geometry problem

- The Sun follows a shallow arc, making terrain elevation decisive for illumination.
- Earth visibility changes with lunar orientation and local skyline.
- A 500 m landing footprint can contain materially different slopes and height uncertainty.
- Terrain line of sight does **not** equal a complete RF link budget.

**One reference point. One hourly sky. Twenty-five nearby terrain cells.**

---

## 03 — Measured terrain, 14 real sites

**Regional terrain:** NASA GSFC PGDA LOLA adjusted south-polar DEMs at 20 m/pixel for 12 sites, 5 m/pixel at Shackleton Rim, and 60 m/pixel for Chandrayaan-3.

**Local layers:** each site carries a 360° horizon mask, a 101 × 101 analysis grid, published slope and height-error products, and a 5 × 5 dispersion grid.

**Sky:** direct JPL DE421 SPICE baseline in the lunar MOON_ME frame, with kernel hashes recorded beside the output.

**Calibration:** MOCK-01 is a synthetic plane used to prove the pipeline. It is labelled, pinned last, and excluded from the Pareto ranking.

---

## 04 — From pixels to a landing view

1. Read only the selected DEM windows.
2. March 360 azimuth rays with lunar-curvature correction.
3. Carry slope and LOLA RMS height uncertainty into a 5 × 5 dispersion grid.
4. Evaluate every offset over the configured mission duration.
5. Render the terrain patch and terrain-aware grazing-light shadows.

Every rendered site carries a provenance label; the one synthetic fallback is marked as synthetic and kept out of the ranking.

---

## 05 — Put the mission assumptions on the screen

- Scrub 2,185 hourly Sun/Earth samples from 2026-12-01 to 2027-03-02.
- Open at PGDA-01 with a +16-day arrival (2026-12-17) and a 3.0 m mast.
- Compare mast height, hotel load, and CLPS power-profile assumptions.
- Inspect darkness, communications gaps, battery state, and 30 launch-slip windows.
- Edit planetary GMs and propagate a separate scenario from the DE421 starting state.

**DE421 stays the baseline.** GM edits use a reduced Newtonian point-mass sensitivity model.

---

## 06 — Planner and Educator views

**Planner:** terrain risk, power margin, and launch timing in one console.

**Educator:** a simplified atmosphere comparison band and a visible Sun/Earth sky path.

**Failure replay:** select a high-slope offset to explore an off-nominal case. This replay is an illustration; it is not presented as an IM-2 telemetry reconstruction or a causal finding.

---

## 07 — What the result can support

- Terrain and topocentric geometry are traceable to public NASA/JPL sources.
- Fourteen real sites use published LOLA products at 5–60 m/pixel; MOCK-01 is synthetic and excluded from rankings.
- Battery and lander hardware numbers remain provisional until replaced with mission datasheets.
- LOLA resolution resolves horizon-scale terrain, not sub-metre boulders; terminal hazard avoidance still needs onboard lidar.
- The GM sensitivity model does not reproduce DE421's PPN terms, asteroid perturbations, solar J2, or modified lunar orbit/orientation.
- Geometric Earth visibility is not a DSN schedule or RF link budget.

**A planning aid with explicit assumptions—not a flight certification.**

<footer>Data sources and method: `REFERENCES.md` · `docs/methodology.md`</footer>

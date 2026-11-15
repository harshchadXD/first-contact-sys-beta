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

## 03 — Measured terrain, traceable geometry

**Near field:** NASA GSFC PGDA Product 78 Site04 Shackleton Rim surface, slope, and height-error rasters at 5 m/pixel.

**Regional horizon:** NASA GSFC PGDA Product 90 adjusted LOLA DEM at 20 m/pixel, read by COG windows outside the Site04 footprint.

**Sky:** Direct JPL DE421 SPICE baseline in the lunar MOON_ME frame, with kernel hashes recorded beside the output.

Site04 is Shackleton Rim. It is **not** the Mons Mouton region where IM-2 landed.

---

## 04 — From pixels to a landing view

1. Read only the selected DEM windows.
2. March 360 azimuth rays with lunar-curvature correction and a regional fallback.
3. Carry slope and LOLA RMS height uncertainty into a 5 × 5 dispersion grid.
4. Render the 500 m height patch and terrain-aware grazing-light shadows.

Every rendered site carries a provenance label; synthetic fallback data is marked as synthetic.

---

## 05 — Put the mission assumptions on the screen

- Scrub the hourly Sun/Earth geometry.
- Compare a mast height, hotel load, and CLPS power-profile assumption.
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
- Battery and lander hardware numbers remain provisional until replaced with mission datasheets.
- The GM sensitivity model does not reproduce DE421's PPN terms, asteroid perturbations, solar J2, or modified lunar orbit/orientation.
- Geometric Earth visibility is not a DSN schedule or RF link budget.

**A planning aid with explicit assumptions—not a flight certification.**

<footer>Data sources and method: `REFERENCES.md` · `docs/methodology.md`</footer>

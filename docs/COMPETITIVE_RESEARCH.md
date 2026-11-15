# Competitive research: lunar operating-window explorer

**Checked:** 2026-11-14. This is a dated scan of public pages and repositories, not an exhaustive market or team census. Competitor capabilities below are what their authors publicly describe; I did not independently run or validate their software.

## The actual challenge

The official 2026 challenge page is titled **Lunar Landing Site Navigator**; the Space Apps listing and team pages also call it **CLPS Lunar Mission Browser**. Its central ask is an intuitive app for mission planners, educators, and the public to compare lunar south-pole landing sites and dates, show Sun and Earth positions relative to the local horizon, and use those views to assess solar-power potential and direct-to-Earth communication windows. The challenge specifically identifies the existing tools' complicated interfaces as the user problem. The product therefore has to make a decision legible; a striking 3D Moon alone does not answer the brief. [Official challenge statement](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) (accessed 2026-11-14).

## Relevant tools already exist

- **NASA Moon Trek** already offers lunar data/map layers, 3D navigation, lighting and slope analysis, Sun-angle calculation, and other research tools. NASA says its advanced mission-planning and research analyses (including lighting and slope) require a registered account. This makes “3D lunar terrain plus lighting” an established category, not a defensible differentiator by itself. [Moon Trek](https://trek.nasa.gov/moon/), [NASA Moon Trek overview](https://trek.nasa.gov/moon/jpl/config/textAbout.html) (accessed 2026-11-14).
- **NASA Celestial Mapping System** already describes LRO terrain visualization, CLPS landing annotations, line-of-sight, terrain profiling, and sunlight shading. [NASA CMS](https://celestialmappingsystem.arc.nasa.gov/) (accessed 2026-11-14).
- **NASA GRC Lunar Site Analysis Software** is specifically for assessing landing-site illumination and communications availability from LOLA terrain masks. The catalog lists it as Windows software with U.S.-only release; the page provides a request route. Its existence rules out claiming that the underlying analysis concept is new. [NASA Software Catalog: LEW-20529-1](https://software.nasa.gov/software/LEW-20529-1) (accessed 2026-11-14).
- **NASA's published polar illumination products** already map solar illumination and Earth visibility across long periods. The LOLA team's products commonly average over an 18.6-year nutation cycle; NASA says shorter-period, finer-resolution, and above-surface-height cases merit further analysis. For Earth visibility, any unobscured part of Earth's disk counts as visible, which NASA notes can be slightly optimistic for radio-link studies involving DSN stations. These are useful baselines, not substitutes for a specific mission's power or RF model. [NASA GSFC PGDA, Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69) (accessed 2026-11-14).

## Public project scan

The challenge already has public implementations and near-complete concepts. These examples overlap enough that feature claims should be checked against them before being used in a pitch:

| Public project | Publicly described overlap |
|---|---|
| [LUNAR//OPS](https://github.com/RootVandal/lunar-ops) — explicitly says it is an independent tool, **not a hackathon submission** | User-set sunlight, darkness, DTE and blackout requirements; every landing hour across 2027–28 at six sites; reason-for-failure explanations and smallest one-constraint change; re-evaluation across 19 touchdown points and available DEM error clones. Its author claims JPL Horizons / NASA GSFC checks. Those are repo claims, not independently audited here. |
| [Lunar Landing Site Navigator](https://github.com/daniel27-space/lunar-navigator) — identifies itself as a Singapore hackathon entry built Nov. 14–15 | Arbitrary south-pole points; 3D terrain and local horizon; 60-day visibility windows; site finder; dates ranked across 7-, 14-, and 30-day stays; and 2–3-site comparison. |
| [CLPS Lunar Mission Browser](https://github.com/BroBYW/CLPS-Lunar-Mission-Website) — challenge entry | 14 cited sites, date-range analysis, DSN-contact windows, battery/power calculator, 2–50 m mast planner, multi-site comparison, and a year-of-start-dates heatmap subject to user constraints. |
| [SIGHTLINE](https://github.com/WarRinOP/sightline) — Bangladesh challenge entry | Authors describe 5 m terrain, SPICE geometry, 3D terrain, sky/timeline and evidence pages; their October 3 status explicitly said the window finder was still future work. The repository describes horizons out to 300 km and variable mast-height evaluation. |
| [CLPS Lunar Mission Browser](https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser) — challenge project | Multi-site comparison, LOLA horizons, sky diagram, timelines, 3D terrain, simple/expert modes, exports and shareable scenario links. Its README explicitly labels its current sites as arbitrary placeholders. |

The official [OrbitForge team page](https://www.spaceappschallenge.org/2026/find-a-team/orbitforge1/) repeats the same challenge framing: combine locations, mission data, power conditions, and communications windows in an intuitive tool. That page and the project repositories show what teams say they intend or built; they do not establish judging outcomes, quality, or adoption.

## What could credibly distinguish this project

The broad promise—“show terrain-aware sunlight and Earth visibility and compare sites/dates”—is **not distinctive on the evidence reviewed**. Nor are 3D terrain, mast height, site comparison, hard constraints, energy budgets, or date searches individually unoccupied.

The strongest narrow positioning supported by the current implementation is a **touchdown-dispersion × arrival-date × observer-height trade-space**: for one locally detailed Shackleton study area, it tests 25 positions, 30 arrival candidates, and six separately baked heights with the exact Rust/WASM engine, then returns tested Pareto alternatives whose metrics stay attached to each alternative's actual location, date, height, and hardware assumptions. The practical story is: *a small landing offset or equipment-height change can alter which operating-window trade-off is feasible; inspect the specific alternatives and the constraint margin.* This is a combination and a case-study focus, not a verified exclusive feature. Some public tools already cover parts of it, and no comprehensive survey established that no other tool covers the whole combination.

To make that positioning useful beyond a globe, show one reproducible scenario end-to-end: which candidate passes or fails each explicit limit, where and when it was tested, how changing position or height changes that result, and what the Pareto alternative gives up. Keep scenario-specific metrics attached to the chosen candidate. Do not imply a global optimum, mission survival, actual RF/DSN contact, or a validated power system.

## Evidence limits and wording guardrails

- Current local study data are NASA-derived, not independently validated. The terrain is finite-range (30 km); recorded 20-to-30 km centre sensitivity reaches 3.158°, so horizon convergence remains unresolved. Pixel spacing must not be called effective resolution.
- The search covers a finite candidate grid (25 positions × 30 arrival candidates × 6 supported heights), not every touchdown coordinate, time, terrain feature, or lander configuration. Call its output the best/Pareto candidates **among tested cases**, not a global optimum.
- Battery capacities, loads, and orientation assumptions are illustrative; a surface-equilibrium temperature is not avionics-survival prediction. Earth-disc visibility is not an RF link budget or DSN schedule. Do not turn passing geometric/energy constraints into a mission-success claim.
- Do not present the trained surrogate as a product advantage: its later-date holdout has 542 false-feasible predictions among 1,440 cases, so it remains research-only; exact Rust currently powers app decisions.
- Avoid “first,” “unique,” “only,” “NASA-endorsed,” and winner claims. A defensible short description is: **“A local lunar operating-window explorer that shows how touchdown offset, arrival date, and observer height change terrain-limited sunlight, Earth visibility, and assumed battery trade-offs.”**

## Useful source records

- [NASA GSFC PGDA product 69](https://pgda.gsfc.nasa.gov/products/69): illumination product cadence, height/resolution caveats, Earth-disc definition.
- [NASA Moon Trek](https://trek.nasa.gov/moon/) and its [about page](https://trek.nasa.gov/moon/jpl/config/textAbout.html): existing public mapping/analysis capabilities and registration boundary for advanced tools.
- [NASA CMS](https://celestialmappingsystem.arc.nasa.gov/): current lunar terrain and analysis capabilities.
- [NASA GRC analysis software](https://software.nasa.gov/software/LEW-20529-1): LOLA terrain-mask illumination and communications analysis exists as NASA software.
- [Official 2026 challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) and [OrbitForge team page](https://www.spaceappschallenge.org/2026/find-a-team/orbitforge1/): brief and challenge framing.
- Public project evidence: [LUNAR//OPS](https://github.com/RootVandal/lunar-ops), [Daniel's entry](https://github.com/daniel27-space/lunar-navigator), [BroBYW entry](https://github.com/BroBYW/CLPS-Lunar-Mission-Website), [SIGHTLINE](https://github.com/WarRinOP/sightline), and [Emanuel Abasto project](https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser).

## What was not verified

The official challenge page's suggested datasets/resources were not retrievable in the browse view beyond the challenge statement. I did not inspect every public team, test each repository, benchmark competitor accuracy, or check every live UI; self-reported implementation claims above remain unverified. The final global-judging set and outcome do not yet exist as of this dated snapshot.

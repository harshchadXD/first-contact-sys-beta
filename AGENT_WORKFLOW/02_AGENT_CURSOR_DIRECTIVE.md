# AGENT DIRECTIVE 02: CURSOR (COMPLEX ARCHITECT TIER)
**Agent Grade:** Grade 4 (Master Architect / Heavy Full-Stack Tier)  
**Assigned Complexity:** The Most Complex Shit (Full-System Composition, Three.js 3D Interactive Raycasting, Smooth Camera Tweens, Dual-Persona Mode Overhaul)  
**Free-Tier Optimization:** Feed single major architectural modules per composer session, keep file diffs targeted to UI/UX integration.  
**Recommended Tooling:** Cursor Composer (`Ctrl + I` or `Cmd + I`) in Agent Mode, referencing `@App.tsx`, `@ThreeTerrainViewer.tsx`, `@DispersionGrid500m.tsx`, `@HorizonPanorama2D.tsx`.  

---

## Assigned Responsibilities Overview
You are giving Cursor the heaviest, most technically demanding user-interface and 3D graphics challenges in the application:
1. **Task 1:** **3D Camera Tweening & Interactive Reticle:** Seamlessly tweening Three.js OrbitControls camera when selecting any of the 25 landing dispersion cells, with a pulsating holographic targeting reticle on the lunar surface.
2. **Task 2:** **Full Tactical Dashboard Grid Assembly (`src/App.tsx`):** Unifying 7 disparate tactical panels (`HeaderAdamBridge`, `ThreeTerrainViewer`, `HorizonPanorama2D`, `DispersionGrid500m`, `LaunchSlipMatrix`, `HardwareProfileSelector`, `GMParameterPanel`, `ComparisonWorkspace`) into a seamless, high-density aerospace OS layout with zero CSS overflow or layout thrashing.
3. **Task 3:** **Dual-Persona State Machine (Planner Mode vs. Educator Mode):** Injecting rich educational tooltips, visual explainer overlays, and interactive diagrams when Educator Mode is toggled (explaining Lunar Vacuum Twilight, Earth Libration loops, and Cryogenic Shadow Traps).
4. **Task 4:** **Dynamic Mast Height Visualizer & Real-Time Shadow Raycasting:** Connecting the mast height slider ($0.5\text{ m}$ to $10.0\text{ m}$) directly to the 3D spacecraft model and recalculating real-time obstacle horizon angles.

---

## TASK 1: 3D Camera Tweening & Interactive Reticle (`src/components/ThreeTerrainViewer.tsx`)

### Copy-Paste Prompt for Cursor Composer:
```text
@ThreeTerrainViewer.tsx @physicsEngine.ts @types.ts
Refactor `src/components/ThreeTerrainViewer.tsx` to implement high-precision interactive landing cell selection and smooth camera tweening:

1. Interactive 3D Cell Selection:
   - When the user clicks anywhere on the 3D lunar terrain mesh, perform raycasting (`THREE.Raycaster`) to find the nearest cell in the 5x5 dispersion grid (from `dispersionGrid` prop, cells spaced 100m apart from dx=-200m to +200m).
   - Trigger `onSelectCell(nearestCell.index)`.

2. Smooth Camera Tweening:
   - When `selectedCellIndex` changes, smoothly animate the Three.js camera position and OrbitControls target toward the selected cell's 3D coordinate:
     x = cell.dxM
     z = cell.dyM
     y = sampleDemHeight(site.demGrid101, cell.dxM, cell.dyM) + 40 (look down angle)
   - Use an exponential lerp or cubic easing curve over 600ms without stutter or locking OrbitControls.

3. Holographic Reticle & Mast Visualization:
   - On the selected cell, render an Obsidian Tactical targeting reticle:
     - Outer rotating circular ring with measurement ticks (#38bdf8 cyan).
     - Vertical laser plumb-line indicating local slope angle.
     - 3D Lander model at the cell's elevation, with a vertical telescoping cylinder representing `mastHeightM` (0.5m to 10m).
     - At the top of the mast, attach a miniature solar array / antenna crosshead that dynamically reflects the incoming sunlight vector (`currentPoint.sunAzDeg`, `currentPoint.sunElDeg`).

4. Grazing Shadow Calibration:
   - Set `directionalLight.castShadow = true`.
   - Configure `shadow.bias = -0.00015` and `shadow.normalBias = 0.04` to eliminate grazing angle shadow acne.
   - Constrain shadow camera frustum tightly to 350m bounds for maximum shadow depth resolution.
```

---

## TASK 2: High-Density Tactical Aerospace OS Layout (`src/App.tsx`)

### Copy-Paste Prompt for Cursor Composer:
```text
@App.tsx @HeaderAdamBridge.tsx @DispersionGrid500m.tsx @LaunchSlipMatrix.tsx @ComparisonWorkspace.tsx @GMParameterPanel.tsx
Refactor `src/App.tsx` into a high-density, mission-control tactical aerospace layout:

1. Grid Layout Hierarchy:
   - Top Bar: `HeaderAdamBridge` (Creation of Adam telemetry wireframe with coherent laser spark connecting Earth and Lunar base).
   - Below Header: Quick telemetry metrics bar (`MissionMetricsBar`) and mode toggle pill [PLANNER MODE | EDUCATOR MODE].
   - Main Cockpit Grid (Split View):
     - Left Column (58% width):
       - Primary: 3D LOLA Terrain View (`ThreeTerrainViewer`) with full-screen toggle and camera reset button.
       - Below 3D: 2D 360° Horizon Skyline & Earth Libration Panorama (`HorizonPanorama2D`).
       - Bottom: Time Scrubber & 14-day Playback transport bar (Play/Pause, Step ±1h, Scrub slider, MET display).
     - Right Column (42% width, tabbed or stacked tactical panels):
       - Tab 1: "500m DISPERSION GRID" -> `DispersionGrid500m` (5x5 safety status, slope warnings, IM-2 failure preset button).
       - Tab 2: "30-DAY LAUNCH SLIP" -> `LaunchSlipMatrix` (Viability heatmap, continuous daylight & comms windows).
       - Tab 3: "SPACECRAFT & MAST" -> `HardwareProfileSelector` + Mast height slider (0.5m to 10.0m).
       - Tab 4: "N-BODY GM SENSITIVITY" -> `GMParameterPanel` (Planetary gravitational parameter perturbation).
       - Tab 5: "MULTI-SITE TRADE STUDY" -> `ComparisonWorkspace` (Pareto frontier comparison between Shackleton, Malapert, Mons Mouton, Haworth).

2. IM-2 Athena Disaster Scenario Preset:
   - Add a one-click tactical preset button: "⚠️ REPLAY IM-2 MONS MOUTON DISASTER".
   - When clicked, sets `siteId = 'PGDA-20'`, `spacecraftId = 'nova-c'`, `selectedCellIndex = 20` (the 300m shadow trap crater), and `mastHeightM = 3.0`.
   - Automatically scrolls the timeline to Hour 13 where battery State-of-Charge hits 0% due to local rim shadow.
   - Displays an explanatory alert: "MISSION LOSS: Terrain rim blocked 1.5° solar rays. 4.5m mast would have maintained 84% solar power."

3. Zero Lag & Clean Responsive Styles:
   - Enforce `#050608` background with slate-800 borders, `#e2e8f0` typography.
   - Keep timeline updates buttery smooth (use `useCallback` and `useMemo` for heavy physics calculations).
```

---

## TASK 3: Dual-Persona State Machine (Planner vs. Educator Mode)

### Copy-Paste Prompt for Cursor Composer:
```text
@App.tsx @HorizonPanorama2D.tsx @DispersionGrid500m.tsx
Implement the Dual-Persona Switch in FIRST CONTACT.SYS:

When `persona === 'educator'`:
1. Overlay 3 interactive visual guide banners:
   - Banner A (Atmosphere vs Vacuum): "🌙 Why Sunset is Instant on the Moon: With zero atmosphere, there is no twilight refraction (+0.57°). Sun drops instantly below crater rims, cutting solar power from 100% to 0% in seconds."
   - Banner B (Earth Libration): "🌍 The 27.3-Day Figure-8: Earth never rises or sets normally at the Lunar South Pole; it wobbles in a tight loop due to orbital libration, dipping behind peaks and cutting radio communications."
   - Banner C (Mast Elevation Principle): "📡 The Inverse Mast Rule: Raising your mast by just 2 meters can clear a mountain ridge 15 kilometers away when the solar angle is 1.5 degrees."
2. Highlight key interactive elements with friendly glowing guide rings and plain-language subtitles under all scientific metrics.
3. In `HorizonPanorama2D.tsx`, render a dashed cyan line indicating "+0.57° Earth Atmospheric Twilight" to visually contrast with the sharp razor lunar vacuum cutoff.

When `persona === 'planner'`:
- Switch to raw engineering telemetry: display RMS slope errors, LOLA DEM metadata, geodetic uncertainty bounds (±1.8m), battery discharge curves (C-rate, voltage sag), and enable the "Export Telemetry CSV" button.
```

# FIRST CONTACT.SYS: SWARM LAUNCHPAD & MULTI-CLI EXECUTION GUIDE
**NASA International Space Apps Challenge 2026** — *Challenge 10: CLPS Lunar Landing Site Navigator*  
**Workspace:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS`  
**Purpose:** 1 distinct task per CLI tool, ready-to-send prompts, and step-by-step instructions on running multiple agents/swarms simultaneously in GitHub Copilot, Codex, Claude Code, and Cursor.

---

## Part 1: Swarm Roster — 1 Distinct Task per CLI Tool

Every CLI agent has **exactly one job** and a **strict file-lock** so no two tools ever edit the same file or cause conflicts:

| CLI Tool | Complexity Level | Strict File Lock (Do Not Touch Others) | Assigned 1 Task |
| :--- | :--- | :--- | :--- |
| **OpenCode** (NVIDIA NIM) | Easiest / Utility | 🔒 `docs/DATA_DICTIONARY.md` | Author the complete NASA Data Dictionary & Mathematical Notation guide |
| **Cursor** | Most Complex UI/3D | 🔒 `src/components/ThreeTerrainViewer.tsx` | Implement smooth 3D camera tweening & holographic targeting reticle |
| **ChatGPT Codex** | Hard Science & Math | 🔒 `src/science/physicsEngine.ts` | Refine LRO Diviner cryogenic radiative thermal equilibrium & cold-soak math |
| **GitHub Copilot** | Hard Systems / GLSL | 🔒 `src/shaders/terrainShaders.ts` | Build WebGL2 slope hazard color ramp (Green <8°, Amber 8-15°, Red >15°) & contour shaders |
| **Claude Code** | Hard QA & Geodesy | 🔒 `tests/scienceAudit.test.mjs` | Build standalone science verification & edge-case test suite (division by zero, IM-2 failure) |

---

## Part 2: Exact Copy-Paste Prompts for Each CLI

---

### 🟢 1. OPENCODE (NVIDIA NIM API Free)
* **Goal:** Create the complete Data Dictionary and NASA dataset reference.
* **Locked File:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS\docs\DATA_DICTIONARY.md`
* **Copy & Paste this into OpenCode:**

```text
You are a technical documentation specialist working on FIRST CONTACT.SYS (NASA Space Apps Challenge: CLPS Lunar Landing Site Navigator).
Your ONLY task is to create the complete data dictionary file at:
docs/DATA_DICTIONARY.md

Do NOT edit or touch any other files in this codebase.

Include clear GitHub Flavored Markdown tables covering:
1. Ephemeris & Geodesy Parameters:
   - Sub-solar latitude/longitude (MOON_ME frame, DE421)
   - Sub-Earth latitude/longitude (Libration ±6.7° lat, ±8.0° lon)
   - Topocentric Sun elevation (h_sun) and azimuth (az_sun)
   - Topocentric Earth elevation (h_earth) and azimuth (az_earth)
   - Solar angular radius (0.266°)
2. LOLA Topography Parameters:
   - Baseline horizon elevation mask H_0(theta) (degrees, 360 elements)
   - Critical obstacle distance d_crit(theta) (meters, 360 elements)
   - Dynamic mast elevation angle formula: H_terrain(theta, z_mast) = atan(tan(H_0) - z_mast / d_crit)
   - 101x101 5m/px DEM grid bounds (-250m to +250m)
3. Thermodynamics & Power:
   - Solar constant S_0 = 1361 W/m^2
   - Lunar regolith albedo A = 0.12, emissivity epsilon = 0.95
   - Stefan-Boltzmann constant sigma = 5.67037e-8 W/m^2/K^4
   - Cryogenic temperature floor = 27 K (-246°C)
   - CLPS battery State of Charge (SoC, 0% to 100%)
4. Real Mission Profiles:
   - Intuitive Machines Nova-C (120W hotel, 3m mast)
   - Astrobotic Griffin (280W hotel, 4m mast)
   - Firefly Blue Ghost (160W hotel, 2.5m mast)
   - ISRO Vikram (100W hotel, 2m mast)

Format cleanly with LaTeX formulas ($...$) and clear descriptions.
```

---

### 🟣 2. CURSOR (Composer / Chat)
* **Goal:** Implement smooth Three.js OrbitControls camera tweening and an interactive holographic reticle on the lunar surface.
* **Locked File:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS\src\components\ThreeTerrainViewer.tsx`
* **Copy & Paste this into Cursor Composer (`Ctrl + I`):**

```text
@ThreeTerrainViewer.tsx @physicsEngine.ts
You are the 3D Graphics Engineer for FIRST CONTACT.SYS.
Your ONLY task is to enhance `src/components/ThreeTerrainViewer.tsx`. Do NOT touch any other files.

Requirements:
1. Interactive Cell Raycasting:
   - When the user clicks the 3D lunar terrain mesh, use THREE.Raycaster to identify the nearest cell in `dispersionGrid` (spacing 100m, from dx=-200m to +200m).
   - Call `onSelectCell(nearestCell.index)`.

2. Smooth Camera Tweening:
   - When `selectedCellIndex` changes, smoothly animate the camera position and OrbitControls target toward that cell's 3D coordinates:
     targetX = selectedCell.dxM
     targetZ = selectedCell.dyM
     targetY = sampleDemHeight(site.demGrid101, selectedCell.dxM, selectedCell.dyM)
   - Animate over 500ms using an exponential easing/lerp loop in requestAnimationFrame without blocking user drag.

3. Holographic Reticle & Mast Model:
   - At the selected cell position, render:
     - A cyan pulsing ring (#38bdf8) with compass tick marks on the surface.
     - A telescoping cylinder representing `mastHeightM` (0.5m to 10m).
     - Miniature solar panel crosshead at top of mast reflecting sunlight direction (`currentPoint.sunAzDeg`, `currentPoint.sunElDeg`).

4. Shadow Quality:
   - Ensure shadow.bias = -0.00015 and shadow.normalBias = 0.04 to prevent grazing-angle shadow acne.
```

---

### 🟠 3. CHATGPT CODEX
* **Goal:** High-fidelity LRO Diviner thermal radiative balance & battery cold-soak mathematical modeling.
* **Locked File:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS\src\science\physicsEngine.ts`
* **Copy & Paste this into ChatGPT Codex:**

```text
You are an astrodynamics and planetary physics specialist working on FIRST CONTACT.SYS.
Your ONLY task is to review and enhance the thermal and battery formulas in:
`src/science/physicsEngine.ts`
Do NOT modify UI components or types.

Implement / verify these exact physical equations in `computeSurfaceTempK` and the battery simulation loop:

1. Direct Solar Insolation at 1 AU:
   F_sun(t) = S_0 * (1 - A) * sin(max(0, h_sun(t))) * f_sun(t)
   where S_0 = 1361 W/m^2, A = 0.12 (lunar regolith albedo), f_sun in [0, 1] is penumbra fraction.

2. Lunar Surface Radiative Equilibrium:
   T_reg(t) = ((F_sun(t) + Q_internal) / (epsilon * sigma))^0.25
   where Q_internal = 0.018 W/m^2, epsilon = 0.95, sigma = 5.670374e-8 W/m^2/K^4.
   Clamp minimum surface temperature to 27.0 K (LRO Diviner cryogenic floor in PSR craters).

3. Avionics Cold-Soak Transient in Shadow:
   When in terrain shadow (f_sun == 0), avionics cool down via:
   dT_sc/dt = (P_internal - epsilon_sc * A_rad * sigma * T_sc^4) / (m_sc * c_p)
   where hotel power P_internal is generated by the battery.

4. Temperature-Dependent Battery Capacity Drop:
   Effective capacity degrades exponentially when cell temperature drops below 240 K (-33°C):
   C_eff(T) = C_rated * clamp(1.0 / (1.0 + exp(-0.08 * (T - 250))), 0.1, 1.0)
   (Models why IM-2 died rapidly in Mons Mouton shadow trap).

Return clean TypeScript code for these functions.
```

---

### 🔵 4. GITHUB COPILOT
* **Goal:** Custom WebGL2 GLSL shaders for slope hazard heatmaps and contour line overlays.
* **Locked File:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS\src\shaders\terrainShaders.ts`
* **Copy & Paste this into GitHub Copilot Chat (or inline completion):**

```typescript
/**
 * You are the WebGL Shader Engineer for FIRST CONTACT.SYS.
 * Your ONLY task is to implement `src/shaders/terrainShaders.ts`.
 * Do NOT modify any other files.
 * 
 * Implement two complete Three.js ShaderMaterials:
 * 
 * 1. `createSlopeHazardMaterial(albedoMap, bumpMap)`:
 *    - Vertex Shader: Pass world normal and position to fragment shader.
 *    - Fragment Shader:
 *      Calculate slope angle: slopeDeg = acos(clamp(dot(normalize(vNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0)) * 57.2958;
 *      Color ramp:
 *        - slope < 8.0°: Regolith silver with subtle emerald tint (#059669 - safe landing)
 *        - 8.0° <= slope < 15.0°: Amber hazard tint (#d97706 - marginal stability)
 *        - slope >= 15.0°: Crimson glowing tint (#e11d48 - IM-1 tipping hazard)
 *      Blend 60% albedoMap texture with 40% slope color.
 * 
 * 2. `createContourShaderMaterial(intervalMeters)`:
 *    - Fragment Shader:
 *      Draw thin cyan contour lines every 5.0 meters of elevation using fract(vWorldPosition.y / 5.0) and fwidth.
 */
```

---

### 🟡 5. CLAUDE CODE
* **Goal:** Standalone science verification and mathematical edge-case test suite.
* **Locked File:** `C:\Users\HarshLocal\Desktop\FirstContact-SYS\tests\scienceAudit.test.mjs`
* **Run in terminal:** `claude` (in `C:\Users\HarshLocal\Desktop\FirstContact-SYS`) and paste:

```text
You are the QA and Planetary Science Verification Lead for FIRST CONTACT.SYS.
Your ONLY task is to author a standalone, zero-dependency Node test script at:
`tests/scienceAudit.test.mjs`
Do NOT edit any frontend or UI files.

Author tests covering these critical operational requirements:
1. Division-by-Zero Guards:
   - When dCritM == 0 or negative, dynamic mast formula must not return NaN or Infinity.
   - When sunElDeg == 0, penumbra fraction must return valid 0.5.
2. Polar Horizon Elevation Angle Bounds:
   - For all 360 azimuth angles, horizon elevation must stay within [-90°, +90°].
3. IM-2 Athena Mons Mouton Disaster Preset:
   - Read `public/data/baked_lunar_sites.json` (Site PGDA-20).
   - Verify that at offset (dx=-200m, dy=+200m) with 3.0m mast, continuous shadow duration exceeds 20 hours.
   - Verify that raising mast to 5.5m reduces shadow duration by at least 60%.
4. Earth Libration Range:
   - Verify Earth elevation oscillates within polar visibility threshold (libration loop).

Use `node:test` and `node:assert/strict`. Make it runnable with `node tests/scienceAudit.test.mjs`.
```

---

## Part 3: How to Run Multiple Agents / Swarms in Each Tool

Here is how you unleash multiple agents simultaneously in each tool:

### A. How to Run Swarms in Claude Code
Claude Code is a CLI tool. You can run **multiple parallel Claude instances** in Windows Terminal:
1. Open **Windows Terminal** (`wt.exe`).
2. Press `Ctrl + Shift + T` to open 2 or 3 split tabs.
3. In each tab, `cd C:\Users\HarshLocal\Desktop\FirstContact-SYS`.
4. Run `claude` in Tab 1 for Task A, and `claude` in Tab 2 for Task B.
5. Because each tab has a different prompt and strict file locks, they work in parallel without stepping on each other!

### B. How to Run Swarms in GitHub Copilot
VS Code allows multiple concurrent Copilot interactions:
1. **Copilot Edits (Multi-file Agent):**
   - Press `Ctrl + Shift + I` to open **Copilot Edits**.
   - Click **Add Files** and select ONLY the locked file (e.g. `src/shaders/terrainShaders.ts`).
   - Paste the directive prompt.
2. **Parallel Copilot Chat Thread:**
   - In the secondary sidebar (`Ctrl + Alt + I`), open a separate Chat thread.
   - Use `@workspace` to query documentation while Edits is actively generating code.

### C. How to Run Swarms in ChatGPT / Codex
You can run multiple parallel thinking threads:
1. Open two browser tabs on `chatgpt.com`.
2. **Tab 1:** Dedicated to **Astrodynamics & Math** (Paste the Codex prompt for physics).
3. **Tab 2:** Dedicated to **Code Review & Sanity Check** (Paste the code from Tab 1 and ask: *"Review this against NASA LOLA 5m/px constraints for edge cases"*).
4. This gives you a maker-checker swarm with zero cross-context interference.

### D. How to Run Swarms in Cursor
Cursor has native concurrent agents:
1. **Composer Agent (`Ctrl + I`):** Set mode to **Agent**.
2. Reference the exact file with `@ThreeTerrainViewer.tsx`.
3. You can click **New Composer** (`Ctrl + N` inside Composer) to start a second background task while the first is generating!

---

## Part 4: Swarm Synchronization & Final Check

Once any agent finishes its task:
1. Save the file.
2. Come back to this Antigravity terminal and run:
   ```powershell
   cd "$HOME\Desktop\FirstContact-SYS"
   npx tsc --noEmit
   npm run build
   ```
3. If both commands exit with 0 errors, update [SHARED_SWARM_COORDINATION_BOARD.md](file:///C:/Users/HarshLocal/Desktop/FirstContact-SYS/AGENT_WORKFLOW/SHARED_SWARM_COORDINATION_BOARD.md) from `[IN_PROGRESS]` to `[VERIFIED]`.

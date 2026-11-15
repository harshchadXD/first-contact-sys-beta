# AGENT DIRECTIVE 01: OPENCODE (NVIDIA NIM API)
**Agent Grade:** Grade 1 (Junior / Utility Tier)  
**Assigned Complexity:** Least Hard / Easiest Stuff (Boilerplate, Micro-UI Widgets, Docs, Simple Math Tests)  
**Free-Tier Optimization:** Low-token prompts, isolated file scopes, zero coupling with 3D or SPICE math.  
**Recommended NIM Models:** `meta/llama-3.3-70b-instruct`, `mistralai/mistral-large-2411`, or `deepseek-ai/deepseek-v3`.  

---

## Assigned Responsibilities Overview
You are assigning OpenCode the four safest, highest-velocity tasks that do not risk breaking core scientific physics or WebGL rendering:
1. **Task 1:** Create `src/components/HelpKeybindingsModal.tsx` (Tactical Hotkey & Glossary Modal).
2. **Task 2:** Create `src/components/MissionMetricsBar.tsx` (Quick Telemetry Ribbon).
3. **Task 3:** Create `docs/DATA_DICTIONARY.md` (Scientific Fields & Acronym Reference).
4. **Task 4:** Create `tests/mathUtils.test.ts` (Unit tests for pure math functions: `clip`, `formatElevation`, `formatCoordinates`).

---

## TASK 1: Help & Keybindings Modal (`src/components/HelpKeybindingsModal.tsx`)

### Copy-Paste Prompt for OpenCode:
```text
You are a frontend developer working on FIRST CONTACT.SYS (a NASA Space Apps hackathon lunar landing web app).
Create a React 19 + TypeScript modal component at `src/components/HelpKeybindingsModal.tsx`.

Styling theme: "Obsidian Tactical Aerospace OS"
- Background: #0a0d14 with a subtle cyan/slate border (#1e293b / #0ea5e9).
- Text: #e2e8f0 (regolith silver), highlights: #38bdf8 (cyan) and #facc15 (solar gold).
- Font: monospace / sans-serif with uppercase tracking for section headers.

Props:
interface HelpKeybindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: 'planner' | 'educator';
}

Features:
1. Displays keyboard shortcuts:
   - [Space]: Play / Pause 14-day solar playback loop
   - [ [ ] / [ ] ]: Step backward / forward by 1 hour
   - [R]: Reset timeline to Hour 0 (Arrival)
   - [M]: Toggle between Planner Mode and Educator Mode
   - [1-4]: Switch Spacecraft (Nova-C, Griffin, Blue Ghost, Vikram)
   - [Esc]: Close this modal
2. Displays an Aerospace Glossary:
   - LOLA DEM: Lunar Orbiter Laser Altimeter Digital Elevation Model (5m/px resolution).
   - Grazing Solar Angle: Sun skimming at ~1.54° inclination, creating long shadows.
   - DTE: Direct-to-Earth radio communication line of sight.
   - PSR: Permanently Shadowed Region (cryogenic cold trap, <40 K).
   - Mast Height: Telescoping mast (0.5m - 10m) elevating solar panels above crater rims.
3. Include an "ESC or Click Outside to Dismiss" footer button with nice hover effects.
Ensure zero external dependencies other than 'react' and 'lucide-react' (e.g. X, Keyboard, BookOpen icons).
```

---

## TASK 2: Quick Mission Metrics Bar (`src/components/MissionMetricsBar.tsx`)

### Copy-Paste Prompt for OpenCode:
```text
You are a frontend developer working on FIRST CONTACT.SYS.
Create a compact horizontal telemetry ribbon component at `src/components/MissionMetricsBar.tsx`.

Theme: Tactical aerospace HUD ribbon with micro-chips.
Background: rgba(10, 13, 20, 0.85), backdrop-blur-md, border-y border-slate-800.

Props:
interface MissionMetricsBarProps {
  siteName: string;
  spacecraftName: string;
  hourIndex: number;
  maxHours: number;
  sunElevationDeg: number;
  earthElevationDeg: number;
  batterySocPct: number;
  surfaceTempK: number;
  isSimultaneous: boolean;
  isShadowed: boolean;
}

Design & Display requirements:
1. Left chip: Site & Spacecraft tag with active status indicator dot (green pulse when running).
2. Mission Elapsed Time (MET): "T+ [hourIndex]h / [maxHours]h" with progress bar fill.
3. Solar Elevation chip:
   - Value with "°" unit.
   - If `isShadowed` is true, badge reads "TERRAIN OCCLUSION" in crimson (#ef4444); otherwise "DIRECT SUN" in amber (#f59e0b).
4. Earth Link chip:
   - Value with "°" unit.
   - If `earthElevationDeg > 0` and not blocked: "DTE COHERENT" in cyan (#06b6d4); else "LOS LOSS" in red (#f43f5e).
5. Battery State-of-Charge (SoC) chip:
   - Percentage with a mini-gauge bar.
   - Green (>50%), Amber (20-50%), Red (<20% CRITICAL DEPLETION).
6. Surface Cryo Temp chip:
   - Value in Kelvin (e.g., "120 K" or "35 K CRYOGENIC TRAP").
7. Simultaneous Window indicator:
   - Glowing badge: "OPTIMAL COMM & POWER WINDOW" if `isSimultaneous` is true.

Export component as default and as named export. Use standard Tailwind CSS classes.
```

---

## TASK 3: Data Dictionary (`docs/DATA_DICTIONARY.md`)

### Copy-Paste Prompt for OpenCode:
```text
Generate a comprehensive markdown reference document at `docs/DATA_DICTIONARY.md` for the FIRST CONTACT.SYS project.
Detail all mathematical parameters, units, coordinate frames, and variables used in the Lunar Landing Browser:

Include tables with columns: Parameter, Symbol, Units, Coordinate Frame / Standard, Description:
1. Ephemeris & Geometry:
   - Sub-solar latitude/longitude (MOON_ME frame)
   - Sub-Earth latitude/longitude (Optical + Physical Libration)
   - Topocentric Sun Elevation ($h_\odot$) & Azimuth ($\text{az}_\odot$)
   - Topocentric Earth Elevation ($h_\oplus$) & Azimuth ($\text{az}_\oplus$)
   - Apparent solar angular radius ($r_\odot = 0.266^\circ$)
2. LOLA Topography & Horizon:
   - Baseline horizon elevation mask $H_0(\theta)$ (degrees, 360 values)
   - Critical obstacle distance $d_{\text{crit}}(\theta)$ (meters, 360 values)
   - Dynamic mast clearance formula $H_{\text{terrain}}(\theta, z_{\text{mast}})$
   - 5m/px DEM grid (101x101 matrix, $-250\text{ m}$ to $+250\text{ m}$)
3. Power & Thermal Thermodynamics:
   - Solar constant at 1 AU ($S_0 = 1361\text{ W/m}^2$)
   - Regolith albedo ($A \approx 0.12$), infrared emissivity ($\epsilon \approx 0.95$)
   - Radiative equilibrium surface temperature ($T_{\text{eq}}$)
   - Spacecraft hotel power load ($P_{\text{hotel}}$), transmitter load ($P_{\text{tx}}$)
   - Battery State of Charge (SoC, 0% to 100%)
4. Historical Mission Precedents:
   - IM-2 Athena Mons Mouton site specs
   - IM-1 Odysseus Malapert-A site specs
   - VIPER Rover landing coordinates
Format in clean, GitHub-flavored markdown with mathematical equations in LaTeX formatting ($ ... $).
```

---

## TASK 4: Math Utility Tests (`tests/mathUtils.test.ts`)

### Copy-Paste Prompt for OpenCode:
```text
Write a unit test suite using Node's built-in test runner or Vitest at `tests/mathUtils.test.ts`.
Test the utility functions in FIRST CONTACT.SYS:

1. `clip(val, min, max)`:
   - Test value within bounds
   - Test value below min
   - Test value above max
2. `sampleDemHeight(demGrid, dx, dy)`:
   - Test center (0, 0)
   - Test corners (+250, +250) and (-250, -250)
   - Test bilinear interpolation between grid cells
3. Dynamic Mast Elevation angle formula:
   - Verify that increasing mast height decreases effective horizon angle (clears obstacle).
   - Verify that when distance to obstacle is small, mast height impact is larger.
4. Solar Penumbra Fraction:
   - Full sunlight when sun elevation > horizon + radius -> 1.0
   - Full shadow when sun elevation < horizon - radius -> 0.0
   - Partial eclipse when sun elevation is intermediate -> value in (0.0, 1.0)

Keep assertions simple (`assert.strictEqual` or `expect`), runnable with `node --test`.
```

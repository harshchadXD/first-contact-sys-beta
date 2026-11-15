# AGENT DIRECTIVE 04: GITHUB COPILOT (SYSTEMS & SHADERS TIER)
**Agent Grade:** Grade 3 (Senior Systems, Shaders & WASM Engineering)  
**Assigned Complexity:** Hard Low-Level Graphics, WebAssembly Memory Bridges & Numerical Verification  
**Free-Tier Optimization:** Fast in-editor code completions and targeted file generation; optimal for WebGL GLSL and WebAssembly FFI.  
**Recommended Tooling:** GitHub Copilot in VS Code / Cursor / Neovim (`Ctrl + Enter` to open completions panel).  

---

## Assigned Responsibilities Overview
You are assigning GitHub Copilot the low-level rendering, WebAssembly memory integration, and mathematical verification tasks:
1. **Task 1: Custom Three.js GLSL Shaders (`src/shaders/terrainShaders.ts`):** Create high-performance GLSL vertex and fragment shaders for lunar slope hazard mapping, elevation contour lines, and grazing shadow passes.
2. **Task 2: Zero-Copy WebAssembly Linear Memory Bridge (`src/services/missionEngine.ts`):** Wire TypeScript TypedArrays directly to Rust WASM exported pointers (`get_results_ptr()`, `get_results_len()`) with zero JSON overhead.
3. **Task 3: N-Body Gravitational Parameter Perturbation (`src/components/GMParameterPanel.tsx`):** Implement dynamic sensitivity scenario recalculation when users adjust planetary $GM$ values.
4. **Task 4: Complete Physics Engine Test Suite (`src/science/physicsEngine.test.ts`):** Author comprehensive automated test cases covering edge cases (solar penumbra at horizon, IM-2 crater shadow trap, zero-mast vs 10m mast clearance).

---

## TASK 1: Custom GLSL Shaders (`src/shaders/terrainShaders.ts`)

### Prompt / Inline Directive for GitHub Copilot:
```typescript
/**
 * src/shaders/terrainShaders.ts
 * Implement custom WebGL2 GLSL shaders for FIRST CONTACT.SYS:
 * 
 * 1. SlopeHazardMaterial:
 *    - Vertex shader calculates normal vector and local slope angle in degrees:
 *      slopeDeg = acos(clamp(dot(worldNormal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0)) * (180.0 / PI);
 *    - Fragment shader maps slope to color ramp:
 *      - slope < 8.0°: Regolith grey with subtle green tint (#059669 safe for landing)
 *      - 8.0° <= slope < 15.0°: Amber tint (#d97706 marginal landing stability)
 *      - slope >= 15.0°: Crimson glow (#e11d48 tip-over danger / IM-1 failure mode)
 * 
 * 2. ContourLineOverlay:
 *    - Procedural contour lines at 5-meter elevation intervals using fract(worldPos.y / 5.0) and fwidth.
 * 
 * 3. GrazingShadowDepthMaterial:
 *    - Custom depth material with matching height displacement uniforms to ensure shadow caster
 *      accounts for LOLA DEM crater rims at 1.5° solar elevation angles.
 */

import * as THREE from 'three';

export function createSlopeHazardMaterial(albedoMap: THREE.Texture, bumpMap: THREE.Texture): THREE.ShaderMaterial {
  // Implement shader uniforms, vertexShader, and fragmentShader
}

export function createContourShaderMaterial(): THREE.ShaderMaterial {
  // Implement contour shader
}
```

---

## TASK 2: Zero-Copy WebAssembly Memory Bridge (`src/services/missionEngine.ts`)

### Prompt / Inline Directive for GitHub Copilot:
```typescript
/**
 * src/services/missionEngine.ts
 * High-performance WebAssembly integration service for FIRST CONTACT.SYS
 * 
 * 1. Asynchronously load `wasm_science_bg.wasm`.
 * 2. Fallback gracefully to `src/science/physicsEngine.ts` if WebAssembly is unsupported or fails to load.
 * 3. For high-speed timeline scrubbing:
 *    - Invoke WASM simulation: `wasm.run_simulation(site_index, spacecraft_index, mast_height, duration_days)`
 *    - Read results via zero-copy memory pointer:
 *      const ptr = wasm.get_results_ptr();
 *      const len = wasm.get_results_len();
 *      const memory = wasm.__wbindgen_export_0.buffer; // WASM linear memory
 *      const floatView = new Float32Array(memory, ptr, len);
 *    - Extract time series vectors (sunAz, sunEl, horizonSun, earthAz, earthEl, batterySoc, tempK) directly.
 * 4. Benchmark performance: log execution time (target < 0.2ms per 336-hour run).
 */
```

---

## TASK 3: N-Body Gravitational Parameter Sensitivity (`src/components/GMParameterPanel.tsx`)

### Prompt / Inline Directive for GitHub Copilot:
```typescript
/**
 * src/components/GMParameterPanel.tsx
 * Allows mission planners to adjust gravitational parameter GM values (km³/s²) for celestial bodies:
 * - Sun (DE421 default: 132712440041.93938 km³/s²)
 * - Earth (DE421 default: 398600.4418 km³/s²)
 * - Moon (DE421 default: 4902.800066 km³/s²)
 * - Jupiter (DE421 default: 126686534.9218 km³/s²)
 * 
 * Telemetry feedback:
 * - Calculate perturbation delta (in km³/s² and percentage deviation).
 * - Propagate orbital precession offset to show how minor solar system mass variations
 *   alter the polar solar elevation angle by millidegrees over 29.5 days.
 * - Provide a "RESTORE DE421 DEFAULTS" button.
 */
```

---

## TASK 4: Physics Engine Test Suite (`src/science/physicsEngine.test.ts`)

### Prompt / Inline Directive for GitHub Copilot:
```typescript
/**
 * src/science/physicsEngine.test.ts
 * Automated test suite for FIRST CONTACT.SYS physics & ephemeris engine.
 * Run with: npm test or npx tsx --test src/science/physicsEngine.test.ts
 * 
 * Test cases:
 * 1. IM-2 Athena Disaster Reproduction:
 *    - Select site PGDA-20 (Mons Mouton), spacecraft 'nova-c', cell index 20 (shadow depression).
 *    - Assert that at mastHeight = 3.0m, battery depletes to 0% within 14 hours.
 *    - Assert that when mastHeight is raised to 5.0m, hoursToDepletion is null (lander survives!).
 * 2. Dynamic Mast Elevation Horizon Formula:
 *    - For H0 = 5.0°, dCrit = 200m, zMast = 10m:
 *      Assert H_terrain < H0 (horizon obstacle is lowered by ~2.8°).
 * 3. Solar Penumbra Transition:
 *    - Assert continuous transition of fSun between 0.0 and 1.0 when sun passes crater rim.
 * 4. 5x5 Dispersion Grid Consistency:
 *    - Verify all 25 cells are evaluated with row and col in [-2, +2].
 *    - Nominal cell (dx=0, dy=0) has index 12.
 */
```

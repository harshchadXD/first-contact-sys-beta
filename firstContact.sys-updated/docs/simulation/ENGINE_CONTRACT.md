# Engine Contract & Browser Boundary Specification (Schema Version 1)

**Owner:** Antigravity  
**Consumer:** Codex (`frontend/`)  
**Crate:** `engine/` (`first-contact-engine`)  
**Artifact Destination:** `engine/pkg/` (committed or generated via `wasm-pack build`)

---

## 1. Boundary Function Signature

```rust
// Wasm export signature (exposed to JavaScript):
#[wasm_bindgen]
pub fn analyze_json(request_json: &str) -> Result<String, JsValue>;

// Native Rust signature (for unit testing and native CLI):
pub fn analyze_json_native(request_json: &str) -> Result<String, String>;
```

---

## 2. Request Schema (`AnalysisRequest`)

```json
{
  "schemaVersion": 1,
  "timestampsUtc": [
    "2026-10-01T00:00:00Z",
    "2026-10-01T01:00:00Z"
  ],
  "windowEndUtc": "2026-10-01T02:00:00Z",
  "sunAzimuthDeg": [45.0, 45.5],
  "sunElevationDeg": [1.42, 1.45],
  "earthAzimuthDeg": [358.1, 358.2],
  "earthElevationDeg": [4.12, 4.15],
  "positions": [
    {
      "positionId": "pos_alpha",
      "horizon": {
        "azimuthDeg": [0.0, 90.0, 180.0, 270.0, 350.0],
        "horizonElevationDeg": [1.0, 2.0, 3.0, 2.0, 1.5]
      }
    }
  ]
}
```

### Constraints:
* `schemaVersion`: Must equal `1`.
* `timestampsUtc`: $N$ elements, strictly monotonically increasing ISO 8601 UTC strings.
* `windowEndUtc`: ISO 8601 UTC string strictly greater than `timestampsUtc[N-1]`.
* `sunAzimuthDeg`, `earthAzimuthDeg`: Array length $N$, finite numbers in $[0.0, 360.0)$.
* `sunElevationDeg`, `earthElevationDeg`: Array length $N$, finite numbers in $[-90.0, 90.0]$.
* `positions`: Non-empty array. Each position must have non-empty `horizon.azimuthDeg` and `horizon.horizonElevationDeg` of equal length.
* `horizon.azimuthDeg`: Strictly increasing within $[0.0, 360.0)$. Circular wrap interpolation ($350^\circ \to 0^\circ$) is handled automatically.

---

## 3. Response Schema (`AnalysisResponse`)

```json
{
  "schemaVersion": 1,
  "positions": [
    {
      "positionId": "pos_alpha",
      "sunVisible": [true, true],
      "earthVisible": [true, true],
      "sunVisibleFraction": 1.0,
      "earthVisibleFraction": 1.0,
      "longestDarknessHours": 0.0,
      "longestEarthBlackoutHours": 0.0,
      "longestEarthVisibleHours": 2.0
    }
  ],
  "assumptions": [
    "Geometric centre line-of-sight: celestial bodies are evaluated as dimensionless points at their geometric centres.",
    "Equality rule: an elevation exactly equal to the terrain horizon elevation is treated as blocked (strictly requires elevation > horizon for visibility).",
    "Periodic horizon interpolation: sampled terrain elevations are linearly interpolated across azimuth, with circular wrap-around connecting the last and first azimuth samples.",
    "Sampled interval model: sample index i represents the persistent visibility state over the time interval [t_i, t_{i+1}), with interval N-1 ending at windowEndUtc.",
    "Partial solar disk penumbral illumination and atmospheric refraction (0.0° in lunar vacuum) are distinct models and separate from this geometric centre boundary."
  ]
}
```

---

## 4. Build & Browser Import Commands

### Building WebAssembly Artifacts:
Run inside `engine/`:
```bash
# Requires Rust toolchain (rustup, wasm-pack):
cd engine
wasm-pack build --target web --out-dir pkg --features wasm
```

This compiles `engine/pkg/`:
* `first_contact_engine.js` (JavaScript wrapper)
* `first_contact_engine_bg.wasm` (Compiled WASM binary, ~30–40 KB gzipped)
* `first_contact_engine.d.ts` (TypeScript typings)

### Consuming in Frontend (`frontend/`):
```typescript
import init, { analyze_json } from '../../../engine/pkg/first_contact_engine.js';

await init();
const responseJson = analyze_json(JSON.stringify(requestPayload));
const result = JSON.parse(responseJson);
```

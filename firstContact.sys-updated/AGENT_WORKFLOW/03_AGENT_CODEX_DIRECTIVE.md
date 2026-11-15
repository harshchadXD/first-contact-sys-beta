# AGENT DIRECTIVE 03: CODEX (MATHEMATICAL & SCIENTIFIC TIER)
**Agent Grade:** Grade 3 (Senior Scientific & Algorithmic Tier)  
**Assigned Complexity:** Hard Algorithmic & Planetary Physics (DE421 Ephemeris, Topocentric Geometry, Cryogenic Thermal Equilibrium, 30-Day Inverse Solver)  
**Free-Tier Optimization:** Pure mathematical logic prompts without UI clutter; zero tokens wasted on CSS or DOM operations.  
**Recommended Environment:** ChatGPT (GPT-4o / o1 / Codex model) with code interpreter or reasoning enabled.  

---

## Assigned Responsibilities Overview
You are assigning Codex the scientific and algorithmic core of FIRST CONTACT.SYS:
1. **Task 1: Topocentric Ephemeris Vectors (`src/science/ephemeris.ts`):** Validate topocentric transformation from lunar body-fixed frame (`MOON_ME` / DE421) to local topocentric horizon coordinates (Azimuth, Elevation) for both the Sun and Earth.
2. **Task 2: 30-Day Inverse Launch-Slip Solver (`src/science/physicsEngine.ts`):** Multi-objective sliding-window solver that computes an arrival score across 30 days based on continuous solar illumination, direct-to-Earth communication duration, and battery depth of discharge.
3. **Task 3: LRO Diviner Cryogenic Thermal & Battery Integration:** Radiative equilibrium equations for lunar regolith and spacecraft avionics, including cold-soak battery capacity degradation ($T < 240\t```text{ K}$).
4. **Task 4: Python GeoTIFF Windowed Raymarcher (`backend/tools/bake_lunar_data.py`):** Efficient radial raymarching with spherical lunar curvature correction ($R_{\t```text{moon}} = 1,737.4\t```text{ km}$) to ```textract $H_0(\theta)$ and $d_{\t```text{crit}}(\theta)$.

---

## TASK 1: Topocentric Ephemeris Verification (`src/science/ephemeris.ts`)

### Copy-Paste Prompt for Codex:
```text
Review and optimize `src/science/ephemeris.ts` for FIRST CONTACT.SYS.

Mathematical cont```text:
- Coordinate Frame: Lunar Body-Fixed (Mean Earth / Polar Axis `MOON_ME`, JPL DE421 kernel).
- Observer Location: Lunar South Pole candidate site at geodetic latitude $\phi$ (e.g. $-89.9^\circ$), longitude $\lambda$.
- Targets: Sun ($\odot$) and Earth ($\oplus$).

Ensure the topocentric elevation $h$ and azimuth $\t```text{az}$ formulas account for:
1. Lunar local topocentric tangent plane:
   - Up vector $\hat{u} = (\cos\phi\cos\lambda, \cos\phi\sin\lambda, \sin\phi)$
   - East vector $\hat{e} = (-\sin\lambda, \cos\lambda, 0)$
   - North vector $\hat{n} = (-\sin\phi\cos\lambda, -\sin\phi\sin\lambda, \cos\phi)$
2. Topocentric Elevation:
   $$h = \arcsin(\hat{r}_{\t```text{target}} \cdot \hat{u})$$
3. Topocentric Azimuth (measured North through East, 0° to 360°):
   $$\t```text{az} = \t```text{atan2}(\hat{r}_{\t```text{target}} \cdot \hat{e}, \hat{r}_{\t```text{target}} \cdot \hat{n}) \pmod{360^\circ}$$
4. Apparent Solar Disk Semi-Diameter:
   $$r_\odot \approx 0.266^\circ$$
5. Earth Libration Range:
   Verify that Earth topocentric coordinates accurately reproduce the 27.3-day libration loop ($\pm 6.7^\circ$ latitude, $\pm 8.0^\circ$ longitude variation) near the polar horizon.

Write clean, typed TypeScript with zero ```texternal dependencies. Include explicit unit test vectors comparing against NASA SVS 5587 ground truth.
```

---

## TASK 2: 30-Day Inverse Launch-Slip Viability Solver (`src/science/physicsEngine.ts`)

### Copy-Paste Prompt for Codex:
```text
In `src/science/physicsEngine.ts`, optimize `computeLaunchSlipDays(site, spacecraft, constraints)`.

Operational Problem:
A lunar mission launch slips by $\Delta t$ days ($0 \le \Delta t \le 30$). Because the Moon rotates at $0.55^\circ/\t```text{hour}$, solar azimuth shifts and mountain shadows move across the landing site. We need to evaluate every arrival day for operational viability:

Objectives to evaluate for each arrival day:
1. $P_{\t```text{sun}}$: Total fraction of daylight hours over the mission duration (e.g., 14 days).
2. $P_{\t```text{earth}}$: Total fraction of direct-to-Earth communication hours.
3. Maximum Continuous Darkness ($t_{\t```text{dark,max}}$): Longest uninterrupted shadow duration in hours.
4. Minimum Battery State-of-Charge ($\t```text{SoC}_{\t```text{min}}$): Simulated battery percentage at deepest discharge.
5. Viability Classification:
   - `OPTIMAL`: $t_{\t```text{dark,max}} \le \t```text{constraints.maxDarknessHrs}$ AND $\t```text{SoC}_{\t```text{min}} \ge 20\%$ AND $P_{\t```text{sun}} \ge 70\%$.
   - `MARGINAL`: Battery does not deplete completely ($>5\%$) but darkness exceeds desired threshold.
   - `CRITICAL`: Battery hits 0% (freezing/mission loss trap like IM-2).

Return array of `LaunchSlipDay` with ranking score:
$$\t```text{Score} = w_{\t```text{sun}} P_{\t```text{sun}} + w_{\t```text{earth}} P_{\t```text{earth}} + w_{\t```text{soc}} \t```text{SoC}_{\t```text{min}} - w_{\t```text{gap}} \left(\frac{t_{\t```text{dark,max}}}{24}\right)$$

Ensure $O(N)$ execution time across the 30-day window so it runs instantaneously in the browser.
```

---

## TASK 3: LRO Diviner Cryogenic Thermal & Battery Integration

### Copy-Paste Prompt for Codex:
```text
Implement a high-fidelity lunar polar thermal model in `src/science/physicsEngine.ts`:

Physical equations:
1. Direct Solar Flux:
   $$F_{\odot}(t) = S_0 \cdot (1 - A) \cdot \sin(h_{\odot}(t)) \cdot f_{\t```text{sun}}(t)$$
   where $S_0 = 1361\t```text{ W/m}^2$, $A = 0.12$ (lunar albedo), $f_{\t```text{sun}} \in [0, 1]$ is penumbra fraction.
2. Lunar Regolith Radiative Equilibrium:
   $$T_{\t```text{reg}}(t) = \left(\frac{F_\odot(t) + Q_{\t```text{internal}}}{\epsilon \sigma}\right)^{0.25}$$
   where $\epsilon = 0.95$, $\sigma = 5.67037 \times 10^{-8}\t```text{ W/m}^2\t```text{K}^4$, $Q_{\t```text{internal}} \approx 0.018\t```text{ W/m}^2$ (geothermal heat flux), clamped to cryogenic floor $T_{\t```text{min}} = 27\t```text{ K}$.
3. Spacecraft Avionics Temperature Transient:
   $$\frac{dT_{\t```text{sc}}}{dt} = \frac{Q_{\t```text{solar}} + P_{\t```text{internal}} - \epsilon_{\t```text{sc}} A_{\t```text{rad}} \sigma T_{\t```text{sc}}^4}{m_{\t```text{sc}} c_p}$$
4. Battery Temperature-Dependent Effective Capacity:
   $$C_{\t```text{eff}}(T) = C_0 \cdot \max\left(0.1, \frac{1}{1 + e^{-0.08 (T - 250)}}\right)$$
   (Models dramatic capacity drop when cell temperatures freeze below $-20^\circ\t```text{C}$).

Output `surfaceTempK` and `avionicsTempK` in `TimeSeriesPoint`.
```

---

## TASK 4: Python GeoTIFF Windowed Parser (`backend/tools/bake_lunar_data.py`)

### Copy-Paste Prompt for Codex:
```text
In `backend/tools/bake_lunar_data.py`, implement memory-safe processing for NASA LOLA 5m/px GeoTIFFs:

Requirements:
1. Use `rasterio.windows.Window` to crop $100 \times 100$ pixel patches centered at candidate polar coordinates without loading multi-gigabyte GeoTIFFs into RAM ($<64\t```text{ MB}$ RAM footprint).
2. For each degree of azimuth $\theta \in [0^\circ, 359^\circ]$:
   - Raymarch outward along azimuth up to $30\t```text{ km}$ in steps of $\Delta r = 10\t```text{ m}$.
   - Calculate elevation angle including lunar spherical curvature:
     $$\alpha(r) = \arctan\left(\frac{z(r) - z_0 - \frac{r^2}{2 R_{\t```text{moon}}}}{r}\right)$$
   - Find maximum angle $H_0(\theta) = \max_r \alpha(r)$ and distance $d_{\t```text{crit}}(\theta) = \arg\max_r \alpha(r)$.
3. Export JSON schema matching `baked_lunar_sites.json`.
```

---

## TASK 5: Deep Space Comms & Speed-of-Light Engine (src/science/commsEngine.ts)

### Copy-Paste Prompt for Codex:
```text
You are the Deep Space Telecommunications and Astrodynamics Lead for FIRST CONTACT.SYS (NASA Space Apps Challenge 2026).
Your task is to author a high-precision, zero-dependency TypeScript scientific engine at:
src/science/commsEngine.ts

The file must export clean, type-safe functions and interfaces for:
1. Dynamic Earth-Moon Distance:
   - Calculate instantaneous Euclidean distance d(t) in km given a mission epoch (Julian Date or UTC Date).
   - Use Keplerian orbit elements for the Moon around Earth (semi-major axis a = 384,400 km, eccentricity e = 0.0549006, mean anomaly).
   - Returns distance bounded within lunar perigee (~363,300 km) and apogee (~405,500 km).

2. Speed-of-Light Propagation Latencies:
   - One-Way Light Time (OWLT): tau_owlt = d / c (where c = 299,792.458 km/s).
   - Round-Trip Time (RTT): tau_rtt = 2 * tau_owlt.
   - ISS direct distance and latency (ISS at 420 km LEO altitude).
   - Ground routing overhead for ISS via NASA TDRSS relay (+0.245s).
   - Artemis Gateway latency in Near Rectilinear Halo Orbit (NRHO, ~68,000 km from lunar surface).

3. Free Space Path Loss (FSPL):
   - FSPL(dB) = 20 * log10(d_km * 1000) + 20 * log10(f_Hz) + 20 * log10(4 * PI / c_m_s) - 147.55
   - Provide presets for:
     * X-Band Deep Space: 8.45 GHz
     * S-Band Near-Earth: 2.21 GHz
     * Ka-Band Lunar Gateway: 26.5 GHz
     * Optical Laser Comm: 1550 nm (193.4 THz)

4. NASA Deep Space Network (DSN) Active Station Solver:
   - Coordinates for the three primary complexes:
     * Goldstone (DSS-14 / DSS-24): 35.426° N, 116.89° W
     * Madrid (DSS-63 / DSS-65): 40.427° N, 4.25° W
     * Canberra (DSS-43 / DSS-34): 35.40° S, 148.98° E
   - Computes which DSN complex is in line-of-sight of the Moon at UTC hour (Earth sidereal rotation 23.9344h).
   - Returns active station name, antenna diameter (70m or 34m), elevation angle from ground station, and lock status (lock when station elevation >= 10°).

5. Complete Link Budget & Shannon-Hartley Channel Capacity:
   - P_rx (dBm) = P_tx (dBm) + G_tx (dBi) - FSPL (dB) - L_atm (dB) + G_rx (dBi)
   - SNR (dB) = P_rx - Thermal Noise Floor (k * T_sys * B)
   - Link Margin = SNR - SNR_required
   - Shannon Capacity: C = B * log2(1 + 10^(SNR/10))
   - Maximum sustainable bitrates for Telemetry, Voice, and Compressed HD Video.

Write self-contained TypeScript with full JSDoc comments, exact formulas, zero ```texternal npm imports, and export all necessary types.
``
`
```

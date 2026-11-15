# FIRST CONTACT.SYS: COMPREHENSIVE LUNAR MISSION DATA DICTIONARY
**Project Target:** NASA International Space Apps Challenge 2026 — *CLPS: Lunar Landing Site Navigator*  
**Application:** FIRST CONTACT.SYS (Obsidian Aerospace OS)  
**Standard Coordinate Frames:** `MOON_ME` (Mean Earth / Polar Axis, DE421), Topocentric SEZ (South-East-Zenith), Lunar Geodetic.  

---

## 1. Astronomical & Planetary Ephemeris Parameters

| Parameter | Symbol | Units | Coordinate Frame | Physical Range | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sub-Solar Latitude** | $\delta_\odot$ | Degrees ($^\circ$) | `MOON_ME` | $[-1.54^\circ, +1.54^\circ]$ | Lunar latitude directly beneath the Sun. Constrained by Moon's $1.54^\circ$ obliquity to ecliptic. |
| **Sub-Solar Longitude** | $\alpha_\odot$ | Degrees ($^\circ$) | `MOON_ME` | $[0^\circ, 360^\circ)$ | Lunar longitude directly beneath the Sun. Advances $\approx 0.55^\circ/\text{hr}$ ($29.53$ day synodic cycle). |
| **Sub-Earth Latitude** | $\delta_\oplus$ | Degrees ($^\circ$) | `MOON_ME` | $[-6.7^\circ, +6.7^\circ]$ | Optical and physical libration latitude of Earth as seen from lunar center. |
| **Sub-Earth Longitude** | $\alpha_\oplus$ | Degrees ($^\circ$) | `MOON_ME` | $[-8.0^\circ, +8.0^\circ]$ | Optical and physical libration longitude of Earth as seen from lunar center. |
| **Topocentric Sun Elevation** | $h_\odot(t)$ | Degrees ($^\circ$) | Local Tangent Plane | $[-5.0^\circ, +5.0^\circ]$ | Angle of Sun center above the local mathematical horizontal plane. Grazing at South Pole. |
| **Topocentric Sun Azimuth** | $\text{az}_\odot(t)$ | Degrees ($^\circ$) | North through East | $[0^\circ, 360^\circ)$ | Compass bearing of the Sun relative to local lunar North. |
| **Topocentric Earth Elevation** | $h_\oplus(t)$ | Degrees ($^\circ$) | Local Tangent Plane | $[-5.0^\circ, +15.0^\circ]$ | Angle of Earth center above local horizon. Governs Direct-to-Earth (DTE) radio links. |
| **Topocentric Earth Azimuth** | $\text{az}_\oplus(t)$ | Degrees ($^\circ$) | North through East | $[0^\circ, 360^\circ)$ | Compass bearing of Earth relative to local lunar North. Traces a 27.3-day figure-8 pattern. |
| **Solar Angular Semi-Diameter** | $r_\odot$ | Degrees ($^\circ$) | Apparent Disk | $0.266^\circ$ ($16.0'$) | Apparent radius of solar disk as viewed from 1 AU ($0.533^\circ$ total diameter). |

---

## 2. Topography & LOLA DEM Elevation Parameters

| Parameter | Symbol | Units | Dataset Source | Physical Range | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline Horizon Skyline** | $H_0(\theta)$ | Degrees ($^\circ$) | NASA Goddard LOLA | $[-15^\circ, +70^\circ]$ | Maximum terrain elevation angle in direction of azimuth $\theta \in [0^\circ, 359^\circ]$ at surface ($z=0\text{ m}$). |
| **Critical Obstacle Distance** | $d_{\text{crit}}(\theta)$ | Meters ($\text{m}$) | NASA Goddard LOLA | $[50\text{ m}, 30,000\text{ m}]$ | Radial distance to the specific mountain peak or crater rim establishing $H_0(\theta)$. |
| **Dynamic Mast Height** | $z_{\text{mast}}$ | Meters ($\text{m}$) | User / Spacecraft | $[0.5\text{ m}, 10.0\text{ m}]$ | Height of deployable solar array / communications antenna above local ground. |
| **Effective Terrain Horizon** | $H_{\text{terrain}}(\theta, z)$ | Degrees ($^\circ$) | Calculated | $[-5^\circ, +70^\circ]$ | Effective obstacle elevation angle accounting for mast elevation: $\arctan\left(\tan(H_0) - \frac{z_{\text{mast}}}{d_{\text{crit}}}\right)$. |
| **Continuous Penumbra Fraction** | $f_{\text{sun}}(t)$ | Dimensionless | Solar Geometry | $[0.0, 1.0]$ | Fraction of solar disk visible above local terrain: $\text{clip}\left(\frac{h_\odot + r_\odot - H_{\text{terrain}}}{2 r_\odot}, 0, 1\right)$. |
| **Local Surface Slope** | $\beta$ | Degrees ($^\circ$) | 5m/px DEM Gradients | $[0^\circ, 45^\circ]$ | Terrain slope angle relative to gravity vector. Landers risk tip-over at $\beta > 15^\circ$. |
| **RMS Height Uncertainty** | $\sigma_z$ | Meters ($\text{m}$) | NASA LOLA Product 78 | $[0.4\text{ m}, 3.5\text{ m}]$ | Geodetic vertical uncertainty of altimetry measurements. |

---

## 3. Power, Thermodynamics & CLPS Survival Parameters

| Parameter | Symbol | Units | Baseline Constant | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Solar Constant at 1 AU** | $S_0$ | $\text{W/m}^2$ | $1361.0\text{ W/m}^2$ | Solar irradiance in vacuum before regolith absorption. |
| **Lunar Regolith Albedo** | $A$ | Dimensionless | $0.12$ | Fraction of incident solar flux reflected back into space. |
| **Regolith Thermal Emissivity** | $\epsilon$ | Dimensionless | $0.95$ | Infrared bolometric emissivity of lunar regolith. |
| **Stefan-Boltzmann Constant** | $\sigma$ | $\text{W/m}^2\text{K}^4$ | $5.670374 \times 10^{-8}$ | Radiative heat emission constant. |
| **Cryogenic Temperature Floor** | $T_{\text{min}}$ | Kelvin ($\text{K}$) | $27.0\text{ K}$ ($-246.15^\circ\text{C}$) | Minimum surface temperature observed by LRO Diviner in Permanently Shadowed Regions. |
| **Hotel Power Load** | $P_{\text{hotel}}$ | Watts ($\text{W}$) | Spacecraft Profile | Baseline power consumed by lander avionics and thermal survival heaters. |
| **Battery State of Charge** | $\text{SoC}$ | Percent ($\%$) | $[0\%, 100\%]$ | Usable electrical energy remaining in onboard lithium-ion or secondary battery cells. |
| **Effective Battery Capacity** | $C_{\text{eff}}(T)$ | Kilowatt-hours ($\text{kWh}$) | Temperature Dependent | Degrades exponentially when cell temperature drops below $240\text{ K}$ ($-33^\circ\text{C}$). |

---

## 4. Real CLPS Spacecraft Specifications

| Spacecraft | Contractor | Mission Target | Solar Array | Default Mast | Battery Capacity | Hotel Load | Max Slope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nova-C** | Intuitive Machines | IM-2 Mons Mouton | $800\text{ W}$ | $3.0\text{ m}$ | $3.5\text{ kWh}$ | $120\text{ W}$ | $12^\circ$ |
| **Griffin** | Astrobotic | VIPER / South Pole | $1400\text{ W}$ | $4.0\text{ m}$ | $8.0\text{ kWh}$ | $280\text{ W}$ | $15^\circ$ |
| **Blue Ghost** | Firefly Aerospace | Mare Crisium / Pole | $650\text{ W}$ | $2.5\text{ m}$ | $4.2\text{ kWh}$ | $160\text{ W}$ | $10^\circ$ |
| **Vikram** | ISRO | Chandrayaan-3 | $738\text{ W}$ | $2.0\text{ m}$ | $3.0\text{ kWh}$ | $100\text{ W}$ | $12^\circ$ |

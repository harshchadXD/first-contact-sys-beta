# JPL DE421 SPICE kernels

This folder contains the official NAIF/JPL files used to calculate local hourly Sun/Earth directions in the DE421 `MOON_ME` frame:

The `naif0012.tls` leap-seconds kernel is also required for UTC-to-ephemeris-time conversion and is included here.

- `de421.bsp` — planetary and lunar SPK ephemeris.
- `moon_pa_de421_1900-2050.bpc` — lunar orientation PCK consistent with DE421.
- `moon_080317.tf` — lunar frame definitions, including the DE421 Mean Earth frame.
- `pck00010.tpc` — generic planetary constants and orientation definitions.

Source directories: [NAIF planetary SPKs](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/), [NAIF PCKs](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/), [NAIF satellite frame kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/).

The DE421 report defines the GM reference table; the SPK contains fitted ephemeris states. Changing the GM table does not alter the SPK states. Recomputed GM scenarios must therefore use a separate, documented propagator and be compared against this unchanged DE421 baseline.

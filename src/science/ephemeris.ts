/**
 * Topocentric ephemeris.
 *
 * The shipped application uses the hourly JPL DE421 series baked for each
 * landing site over 2026-12-01 through 2027-03-02. The analytic model below is
 * retained only as an explicitly labelled fallback for dates outside that
 * envelope and for legacy tests. It is a low-order approximation, not DE421.
 */

import type { BakedEphemerisSeries, SiteMetadata } from './types';

const SYNODIC_MONTH_HOURS = 29.530588 * 24;
const SIDEREAL_MONTH_HOURS = 27.321661 * 24;
const ANOMALISTIC_MONTH_HOURS = 27.55455 * 24;

/** The common UTC epoch of every baked landing-window scenario. */
export const OPS_EPOCH_MS = Date.UTC(2026, 11, 1, 0, 0, 0);
export const OPS_EPOCH_UTC = '2026-12-01T00:00:00Z';

export interface TopocentricVectors {
  sunAzDeg: number;
  sunElDeg: number;
  earthAzDeg: number;
  earthElDeg: number;
}

export type EphemerisSource = 'baked-de421' | 'analytic-fallback';

export interface TopocentricSample extends TopocentricVectors {
  source: EphemerisSource;
}

export function normalizeAzimuthDelta(fromDeg: number, toDeg: number): number {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return delta;
}

/**
 * Linearly interpolate one hourly DE421 series. Returns null outside the
 * baked envelope so callers cannot silently mix real and analytic sky data.
 */
export function sampleBakedEphemeris(
  series: BakedEphemerisSeries | undefined,
  hoursSinceEpoch: number
): TopocentricVectors | null {
  if (!series || !series.sunAzDeg?.length || !Number.isFinite(hoursSinceEpoch)) return null;
  const step = series.stepHours > 0 ? series.stepHours : 1;
  const last = series.sunAzDeg.length - 1;
  const position = hoursSinceEpoch / step;
  if (position < 0 || position > last) return null;

  const i0 = Math.min(last, Math.floor(position));
  const i1 = Math.min(last, i0 + 1);
  const t = position - i0;

  const lerp = (a: number, b: number) => a + (b - a) * t;
  const lerpAz = (a: number, b: number) => a + normalizeAzimuthDelta(a, b) * t;

  return {
    sunAzDeg: ((lerpAz(series.sunAzDeg[i0], series.sunAzDeg[i1]) % 360) + 360) % 360,
    sunElDeg: lerp(series.sunElDeg[i0], series.sunElDeg[i1]),
    earthAzDeg: ((lerpAz(series.earthAzDeg[i0], series.earthAzDeg[i1]) % 360) + 360) % 360,
    earthElDeg: lerp(series.earthElDeg[i0], series.earthElDeg[i1]),
  };
}

/**
 * Site-aware sampler. Uses the real baked DE421 series whenever the requested
 * hour lies inside its envelope and labels the analytic fallback otherwise.
 */
export function computeSiteEphemeris(
  site: { metadata: Pick<SiteMetadata, 'latDeg' | 'lonDeg'>; bakedEphemeris?: BakedEphemerisSeries },
  hoursSinceEpoch: number
): TopocentricSample {
  const baked = sampleBakedEphemeris(site.bakedEphemeris, hoursSinceEpoch);
  if (baked) return { ...baked, source: 'baked-de421' };
  const analytic = computeTopocentricEphemeris(
    site.metadata.latDeg,
    site.metadata.lonDeg,
    hoursSinceEpoch
  );
  return { ...analytic, source: 'analytic-fallback' };
}

export function bakedEphemerisEndUtc(series: BakedEphemerisSeries | undefined): string | null {
  if (!series?.sunAzDeg?.length) return null;
  const start = Date.parse(series.startUtc);
  if (!Number.isFinite(start)) return null;
  return new Date(start + (series.sunAzDeg.length - 1) * series.stepHours * 3_600_000).toISOString();
}

/**
 * Normalize degrees into [0, 360)
 */
export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Analytic approximation used only when a real baked series is unavailable.
 * It is intentionally not presented as JPL DE421.
 */
export function computeTopocentricEphemeris(
  latDeg: number,
  lonDeg: number,
  hoursSinceEpoch: number
): TopocentricVectors {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;

  // 1. Solar Ephemeris in MOON_ME
  // Solar sub-solar longitude advances westward across lunar surface over 29.53d
  const sunCyclePhase = (2 * Math.PI * hoursSinceEpoch) / SYNODIC_MONTH_HOURS;
  // Southern Polar Summer: negative sub-solar latitude (-1.54° max) places Sun above South Pole
  const yearlyAngle = (2 * Math.PI * hoursSinceEpoch) / (365.25 * 24) + 1.45;
  const subSolarLatDeg = -1.54 * Math.sin(yearlyAngle);
  const subSolarLatRad = (subSolarLatDeg * Math.PI) / 180;

  // Initial sub-solar longitude begins just after lunar sunrise (+1.43 rad east of site)
  const subSolarLonRad = lonRad + 1.43 - sunCyclePhase;
  const dLonSun = subSolarLonRad - lonRad;

  const sinSunEl =
    Math.sin(latRad) * Math.sin(subSolarLatRad) +
    Math.cos(latRad) * Math.cos(subSolarLatRad) * Math.cos(dLonSun);
  const sunElRad = Math.asin(Math.max(-1, Math.min(1, sinSunEl)));
  const sunElDeg = (sunElRad * 180) / Math.PI;

  const ySun = Math.sin(dLonSun) * Math.cos(subSolarLatRad);
  const xSun =
    Math.cos(latRad) * Math.sin(subSolarLatRad) -
    Math.sin(latRad) * Math.cos(subSolarLatRad) * Math.cos(dLonSun);
  const sunAzDeg = normalizeDeg((Math.atan2(ySun, xSun) * 180) / Math.PI);

  // 2. Earth Ephemeris & 27.3-Day Figure-Eight Libration Loop in MOON_ME
  // Mean Earth sits near (0° lat, 0° lon) in MOON_ME, librating +/- 6.68° lat and +/- 7.9° lon
  const latLibPhase = (2 * Math.PI * hoursSinceEpoch) / SIDEREAL_MONTH_HOURS + 3.65;
  const lonLibPhase = (2 * Math.PI * hoursSinceEpoch) / ANOMALISTIC_MONTH_HOURS + 0.85;

  const subEarthLatDeg = 6.68 * Math.sin(latLibPhase) + 0.52 * Math.sin(2 * latLibPhase);
  const subEarthLonDeg = 7.85 * Math.sin(lonLibPhase) + 0.65 * Math.cos(latLibPhase);

  const subEarthLatRad = (subEarthLatDeg * Math.PI) / 180;
  const subEarthLonRad = (subEarthLonDeg * Math.PI) / 180;
  const dLonEarth = subEarthLonRad - lonRad;

  const sinEarthEl =
    Math.sin(latRad) * Math.sin(subEarthLatRad) +
    Math.cos(latRad) * Math.cos(subEarthLatRad) * Math.cos(dLonEarth);
  const earthElRad = Math.asin(Math.max(-1, Math.min(1, sinEarthEl)));
  const earthElDeg = (earthElRad * 180) / Math.PI;

  const yEarth = Math.sin(dLonEarth) * Math.cos(subEarthLatRad);
  const xEarth =
    Math.cos(latRad) * Math.sin(subEarthLatRad) -
    Math.sin(latRad) * Math.cos(subEarthLatRad) * Math.cos(dLonEarth);
  const earthAzDeg = normalizeDeg((Math.atan2(yEarth, xEarth) * 180) / Math.PI);

  return {
    sunAzDeg: Number(sunAzDeg.toFixed(2)),
    sunElDeg: Number(sunElDeg.toFixed(3)),
    earthAzDeg: Number(earthAzDeg.toFixed(2)),
    earthElDeg: Number(earthElDeg.toFixed(3)),
  };
}

/**
 * Generates the 27.3-day Earth libration loop for the horizon panorama.
 * Pass the site's baked DE421 series to keep the track real; otherwise the
 * analytic fallback is used and should be labelled as such by the caller.
 */
export function computeEarthLibrationTrack(
  latDeg: number,
  lonDeg: number,
  startHour: number,
  bakedEphemeris?: BakedEphemerisSeries
): Array<{ azDeg: number; elDeg: number; dayOffset: number; source: EphemerisSource }> {
  const track: Array<{ azDeg: number; elDeg: number; dayOffset: number; source: EphemerisSource }> = [];
  // Step every 6 hours across 27.5 days (110 points)
  for (let h = 0; h <= 27.5 * 24; h += 6) {
    const baked = sampleBakedEphemeris(bakedEphemeris, startHour + h);
    const vec = baked ?? computeTopocentricEphemeris(latDeg, lonDeg, startHour + h);
    track.push({
      azDeg: vec.earthAzDeg,
      elDeg: vec.earthElDeg,
      dayOffset: Number((h / 24).toFixed(2)),
      source: baked ? 'baked-de421' : 'analytic-fallback',
    });
  }
  return track;
}

/**
 * Topocentric Ephemeris Kernel (MOON_ME Topocentric Spherical Trigonometry)
 * Computes hourly Solar and Earth Azimuth/Elevation in the lunar South Polar
 * topocentric frame, incorporating the 29.530588d synodic solar progression,
 * annual sub-solar latitude variation, and optical/physical Earth libration
 * (±7.85° longitude anomalistic cycle, ±6.68° latitude sidereal cycle).
 */

const SYNODIC_MONTH_HOURS = 29.530588 * 24;
const SIDEREAL_MONTH_HOURS = 27.321661 * 24;
const ANOMALISTIC_MONTH_HOURS = 27.55455 * 24;

export interface TopocentricVectors {
  sunAzDeg: number;
  sunElDeg: number;
  earthAzDeg: number;
  earthElDeg: number;
}

/**
 * Normalize degrees into [0, 360)
 */
export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Computes topocentric Sun and Earth Azimuth/Elevation for a lunar surface site
 * at `hoursSinceEpoch` relative to 2025-03-06T00:00:00Z (IM-2 arrival epoch).
 */
export function computeTopocentricEphemeris(
  latDeg: number,
  lonDeg: number,
  hoursSinceEpoch: number
): TopocentricVectors {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;

  // 1. Solar Ephemeris in MOON_ME
  // True sub-solar point in selenographic coordinates
  const sunCyclePhase = (2 * Math.PI * hoursSinceEpoch) / SYNODIC_MONTH_HOURS;
  // Southern Polar Summer: negative sub-solar latitude (-1.54° max) places Sun above South Pole
  const yearlyAngle = (2 * Math.PI * hoursSinceEpoch) / (365.25 * 24) + 1.45;
  const subSolarLatDeg = -1.54 * Math.sin(yearlyAngle);
  const subSolarLatRad = (subSolarLatDeg * Math.PI) / 180;

  // True selenographic sub-solar longitude advancing westward across lunar surface over 29.53d
  const subSolarLonRad = 1.43 - sunCyclePhase;
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

  // 2. Earth Ephemeris & 27.3-Day Libration Loop in MOON_ME
  // Selenographic sub-Earth point incorporating optical and physical libration (mean origin at 0° lat, 0° lon)
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
 * Generates the 27.3-day figure-eight Earth libration loop for 2D Horizon Panorama plotting
 */
export function computeEarthLibrationTrack(
  latDeg: number,
  lonDeg: number,
  startHour: number
): Array<{ azDeg: number; elDeg: number; dayOffset: number }> {
  const track: Array<{ azDeg: number; elDeg: number; dayOffset: number }> = [];
  // Step every 6 hours across 27.5 days (110 points)
  for (let h = 0; h <= 27.5 * 24; h += 6) {
    const vec = computeTopocentricEphemeris(latDeg, lonDeg, startHour + h);
    track.push({
      azDeg: vec.earthAzDeg,
      elDeg: vec.earthElDeg,
      dayOffset: Number((h / 24).toFixed(2)),
    });
  }
  return track;
}

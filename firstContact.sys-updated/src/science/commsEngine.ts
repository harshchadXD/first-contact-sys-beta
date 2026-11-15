/**
 * Zero-dependency lunar communications and link-budget calculations.
 *
 * Lunar state is a two-body Keplerian approximation referenced to J2000. It is
 * deterministic and suitable for planning estimates, but it is not a JPL
 * ephemeris and omits solar, planetary, and lunar perturbations.
 */

/** A JavaScript UTC Date, or a numeric Julian Date (not Unix milliseconds). */
export type MissionEpoch = Date | number;

export interface LunarOrbitOptions {
  /** Julian Date where `meanAnomalyAtEpochRad` is defined. Defaults to J2000. */
  epochJulianDate?: number;
  /** Mean anomaly at the reference epoch, in radians. */
  meanAnomalyAtEpochRad?: number;
  /** Sidereal lunar orbital period, in days. */
  orbitalPeriodDays?: number;
}

export interface LunarPosition {
  julianDate: number;
  distanceKm: number;
  meanAnomalyRad: number;
  eccentricAnomalyRad: number;
  /** Geocentric position components in the mean equatorial J2000 frame. */
  xKm: number;
  yKm: number;
  zKm: number;
  rightAscensionRad: number;
  declinationRad: number;
}

export interface LatencyResult {
  distanceKm: number;
  oneWaySeconds: number;
  roundTripSeconds: number;
}

export type FrequencyBand =
  | "xBandDeepSpace"
  | "sBandNearEarth"
  | "kaBandGateway"
  | "opticalLaser";

export interface FrequencyPreset {
  band: FrequencyBand;
  name: string;
  frequencyHz: number;
}

export interface DsnStation {
  name: "Goldstone" | "Madrid" | "Canberra";
  latitudeDeg: number;
  longitudeDeg: number;
  /** Primary DSN antenna modeled for this complex. */
  antennaDiameterM: 70 | 34;
  primaryAntenna: string;
}

export interface DsnCandidate {
  station: DsnStation;
  elevationDeg: number;
}

export interface DsnVisibility {
  julianDate: number;
  /** Highest-elevation complex when it is above the horizon, otherwise null. */
  station: DsnStation | null;
  elevationDeg: number | null;
  inLineOfSight: boolean;
  lock: boolean;
  lockElevationThresholdDeg: number;
  candidates: DsnCandidate[];
}

export interface LinkBudgetInput {
  transmitPowerDbm: number;
  transmitGainDbi: number;
  receiveGainDbi: number;
  frequencyHz: number;
  distanceKm: number;
  systemTemperatureK: number;
  bandwidthHz: number;
  /** One-way atmospheric attenuation in dB. Defaults to zero. */
  atmosphericLossDb?: number;
  /** Required demodulator SNR in dB. Defaults to zero. */
  requiredSnrDb?: number;
}

export interface LinkBudgetResult {
  freeSpacePathLossDb: number;
  receivedPowerDbm: number;
  thermalNoisePowerW: number;
  thermalNoiseFloorDbm: number;
  snrDb: number;
  requiredSnrDb: number;
  linkMarginDb: number;
  shannonCapacityBps: number;
}

export type CommunicationService = "telemetry" | "voice" | "compressedHdVideo";

export interface ServiceBitrate {
  service: CommunicationService;
  /** Reference application bitrate used for the feasibility check. */
  targetBitrateBps: number;
  /** Maximum information rate if the service receives the full channel. */
  maximumSustainableBitrateBps: number;
  targetIsSustainable: boolean;
}

export const SPEED_OF_LIGHT_KM_S = 299_792.458;
export const SPEED_OF_LIGHT_M_S = SPEED_OF_LIGHT_KM_S * 1_000;
export const BOLTZMANN_CONSTANT_J_K = 1.380_649e-23;

export const LUNAR_ORBIT = Object.freeze({
  semiMajorAxisKm: 384_400,
  eccentricity: 0.0549006,
  perigeeBoundKm: 363_300,
  apogeeBoundKm: 405_500,
  siderealPeriodDays: 27.321661,
  j2000JulianDate: 2_451_545.0,
  /** Approximate mean anomaly at J2000. */
  j2000MeanAnomalyDeg: 115.3654,
  /** Fixed approximate J2000 orientation of the lunar orbital plane. */
  ascendingNodeDeg: 125.08,
  argumentOfPerigeeDeg: 318.15,
  inclinationDeg: 5.145,
  obliquityDeg: 23.4392911,
});

export const FREQUENCY_PRESETS: Readonly<Record<FrequencyBand, FrequencyPreset>> =
  Object.freeze({
    xBandDeepSpace: {
      band: "xBandDeepSpace",
      name: "X-Band Deep Space",
      frequencyHz: 8.45e9,
    },
    sBandNearEarth: {
      band: "sBandNearEarth",
      name: "S-Band Near-Earth",
      frequencyHz: 2.21e9,
    },
    kaBandGateway: {
      band: "kaBandGateway",
      name: "Ka-Band Lunar Gateway",
      frequencyHz: 26.5e9,
    },
    opticalLaser: {
      band: "opticalLaser",
      name: "Optical Laser Communications (1550 nm)",
      frequencyHz: 193.4e12,
    },
  });

export const DSN_STATIONS: readonly DsnStation[] = Object.freeze([
  {
    name: "Goldstone",
    latitudeDeg: 35.426,
    longitudeDeg: -116.89,
    antennaDiameterM: 70,
    primaryAntenna: "DSS-14",
  },
  {
    name: "Madrid",
    latitudeDeg: 40.427,
    longitudeDeg: -4.25,
    antennaDiameterM: 70,
    primaryAntenna: "DSS-63",
  },
  {
    name: "Canberra",
    latitudeDeg: -35.4,
    longitudeDeg: 148.98,
    antennaDiameterM: 70,
    primaryAntenna: "DSS-43",
  },
]);

/** Assumed service rates; these are application profiles, not physical limits. */
export const SERVICE_TARGET_BITRATES_BPS: Readonly<
  Record<CommunicationService, number>
> = Object.freeze({
  telemetry: 64_000,
  voice: 32_000,
  compressedHdVideo: 8_000_000,
});

export const EARTH_SIDEREAL_ROTATION_HOURS = 23.9344;
export const ISS_ALTITUDE_KM = 420;
export const TDRSS_ROUTING_OVERHEAD_SECONDS = 0.245;
export const GATEWAY_ABOVE_LUNAR_SURFACE_KM = 68_000;
export const DSN_LOCK_ELEVATION_DEG = 10;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TWO_PI = 2 * Math.PI;
const EARTH_EQUATORIAL_RADIUS_KM = 6_378.137;
const LUNAR_RADIUS_KM = 1_737.4;
const J2000_JD = 2_451_545.0;
const J2000_GREENWICH_SIDEREAL_ANGLE_DEG = 280.46061837;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function normalizeRadians(angleRad: number): number {
  return ((angleRad % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Convert a UTC Date or numeric Julian Date to Julian Date. */
export function toJulianDate(epoch: MissionEpoch): number {
  const julianDate =
    epoch instanceof Date
      ? epoch.getTime() / 86_400_000 + 2_440_587.5
      : epoch;
  assertFinite(julianDate, "epoch");
  return julianDate;
}

/** Solve Kepler's equation E - e sin(E) = M using Newton iteration. */
export function solveKeplerEquation(
  meanAnomalyRad: number,
  eccentricity: number,
): number {
  assertFinite(meanAnomalyRad, "meanAnomalyRad");
  if (!Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError("eccentricity must be in [0, 1).");
  }
  const mean = normalizeRadians(meanAnomalyRad);
  let eccentricAnomaly = eccentricity < 0.8 ? mean : Math.PI;
  for (let i = 0; i < 50; i += 1) {
    const correction =
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - mean) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-13) return eccentricAnomaly;
  }
  throw new Error("Kepler equation solver did not converge.");
}

/**
 * Calculate the approximate instantaneous geocentric lunar state.
 * Mean anomaly advances as M(t) = M0 + 2π(t - t0) / orbitalPeriod.
 * Distance is bounded to the specified nominal perigee and apogee.
 */
export function calculateLunarPosition(
  epoch: MissionEpoch,
  options: LunarOrbitOptions = {},
): LunarPosition {
  const julianDate = toJulianDate(epoch);
  const a = LUNAR_ORBIT.semiMajorAxisKm;
  const e = LUNAR_ORBIT.eccentricity;
  const epochJulianDate = options.epochJulianDate ?? LUNAR_ORBIT.j2000JulianDate;
  const meanAnomalyAtEpochRad =
    options.meanAnomalyAtEpochRad ??
    LUNAR_ORBIT.j2000MeanAnomalyDeg * DEG_TO_RAD;
  const orbitalPeriodDays =
    options.orbitalPeriodDays ?? LUNAR_ORBIT.siderealPeriodDays;
  assertFinite(epochJulianDate, "epochJulianDate");
  assertFinite(meanAnomalyAtEpochRad, "meanAnomalyAtEpochRad");
  assertFinitePositive(orbitalPeriodDays, "orbitalPeriodDays");

  const meanAnomalyRad = normalizeRadians(
    meanAnomalyAtEpochRad +
      (TWO_PI * (julianDate - epochJulianDate)) / orbitalPeriodDays,
  );
  const eccentricAnomalyRad = solveKeplerEquation(meanAnomalyRad, e);
  const rawDistanceKm = a * (1 - e * Math.cos(eccentricAnomalyRad));
  const distanceKm = Math.min(
    LUNAR_ORBIT.apogeeBoundKm,
    Math.max(LUNAR_ORBIT.perigeeBoundKm, rawDistanceKm),
  );

  const trueAnomalyRad =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(eccentricAnomalyRad / 2),
      Math.sqrt(1 - e) * Math.cos(eccentricAnomalyRad / 2),
    );
  const longitudeFromNodeRad =
    trueAnomalyRad + LUNAR_ORBIT.argumentOfPerigeeDeg * DEG_TO_RAD;
  const nodeRad = LUNAR_ORBIT.ascendingNodeDeg * DEG_TO_RAD;
  const inclinationRad = LUNAR_ORBIT.inclinationDeg * DEG_TO_RAD;

  // Rotate perifocal coordinates by argument of perigee, inclination, and node.
  const xEclipticKm =
    distanceKm *
    (Math.cos(nodeRad) * Math.cos(longitudeFromNodeRad) -
      Math.sin(nodeRad) *
        Math.sin(longitudeFromNodeRad) *
        Math.cos(inclinationRad));
  const yEclipticKm =
    distanceKm *
    (Math.sin(nodeRad) * Math.cos(longitudeFromNodeRad) +
      Math.cos(nodeRad) *
        Math.sin(longitudeFromNodeRad) *
        Math.cos(inclinationRad));
  const zEclipticKm =
    distanceKm * Math.sin(longitudeFromNodeRad) * Math.sin(inclinationRad);

  // Rotate from the mean ecliptic J2000 frame into the mean equatorial frame.
  const obliquityRad = LUNAR_ORBIT.obliquityDeg * DEG_TO_RAD;
  const xKm = xEclipticKm;
  const yKm =
    yEclipticKm * Math.cos(obliquityRad) -
    zEclipticKm * Math.sin(obliquityRad);
  const zKm =
    yEclipticKm * Math.sin(obliquityRad) +
    zEclipticKm * Math.cos(obliquityRad);
  const rightAscensionRad = normalizeRadians(Math.atan2(yKm, xKm));
  const declinationRad = Math.atan2(zKm, Math.hypot(xKm, yKm));

  return {
    julianDate,
    distanceKm,
    meanAnomalyRad,
    eccentricAnomalyRad,
    xKm,
    yKm,
    zKm,
    rightAscensionRad,
    declinationRad,
  };
}

/** One-way light time is d/c; round-trip time is exactly 2d/c. */
export function calculateLatency(distanceKm: number): LatencyResult {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError("distanceKm must be a finite non-negative number.");
  }
  const oneWaySeconds = distanceKm / SPEED_OF_LIGHT_KM_S;
  return { distanceKm, oneWaySeconds, roundTripSeconds: 2 * oneWaySeconds };
}

/**
 * Ideal overhead ISS path uses its 420 km orbital altitude as range. A TDRSS
 * routed path adds 0.245 seconds to each one-way leg; RTT includes both legs.
 */
export function calculateIssLatency(): LatencyResult {
  return calculateLatency(ISS_ALTITUDE_KM);
}

export function calculateIssTdrssLatency(): LatencyResult & {
  routingOverheadSeconds: number;
} {
  const direct = calculateIssLatency();
  const oneWaySeconds =
    direct.oneWaySeconds + TDRSS_ROUTING_OVERHEAD_SECONDS;
  return {
    distanceKm: direct.distanceKm,
    oneWaySeconds,
    roundTripSeconds: 2 * oneWaySeconds,
    routingOverheadSeconds: TDRSS_ROUTING_OVERHEAD_SECONDS,
  };
}

/**
 * Approximate Earth-to-Gateway range by adding lunar radius and 68,000 km
 * altitude to the Earth-Moon center range (outer radial NRHO position).
 */
export function calculateGatewayLatency(epoch: MissionEpoch): LatencyResult {
  const lunarDistanceKm = calculateLunarPosition(epoch).distanceKm;
  return calculateLatency(
    lunarDistanceKm + LUNAR_RADIUS_KM + GATEWAY_ABOVE_LUNAR_SURFACE_KM,
  );
}

export interface EarthMoonLatencySet {
  earthMoon: LatencyResult;
  issDirect: LatencyResult;
  issViaTdrss: LatencyResult & { routingOverheadSeconds: number };
  artemisGateway: LatencyResult;
}

/** Calculate Earth-Moon, ISS direct/TDRSS, and Gateway light-time estimates. */
export function calculateEarthMoonLatencies(
  epoch: MissionEpoch,
): EarthMoonLatencySet {
  return {
    earthMoon: calculateLatency(calculateLunarPosition(epoch).distanceKm),
    issDirect: calculateIssLatency(),
    issViaTdrss: calculateIssTdrssLatency(),
    artemisGateway: calculateGatewayLatency(epoch),
  };
}

/**
 * Free-space path loss in dB, following the requested expression:
 * 20log10(d_m) + 20log10(f_Hz) + 20log10(4π/c_m_s) - 147.55.
 * Note: the supplied expression includes -147.55 in addition to the explicit
 * 4π/c term; it is implemented literally for project-spec compatibility.
 */
export function calculateFsplDb(distanceKm: number, frequencyHz: number): number {
  assertFinitePositive(distanceKm, "distanceKm");
  assertFinitePositive(frequencyHz, "frequencyHz");
  return (
    20 * Math.log10(distanceKm * 1_000) +
    20 * Math.log10(frequencyHz) +
    20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT_M_S) -
    147.55
  );
}

/** Standard dimensionally consistent FSPL from Friis' free-space equation. */
export function calculatePhysicalFsplDb(
  distanceKm: number,
  frequencyHz: number,
): number {
  assertFinitePositive(distanceKm, "distanceKm");
  assertFinitePositive(frequencyHz, "frequencyHz");
  return (
    20 * Math.log10(distanceKm * 1_000) +
    20 * Math.log10(frequencyHz) +
    20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT_M_S)
  );
}

/** Get one of the standard X, S, Ka, or optical frequency presets. */
export function getFrequencyPreset(band: FrequencyBand): FrequencyPreset {
  return FREQUENCY_PRESETS[band];
}

/** Convert a positive power in watts to dBm. */
export function wattsToDbm(powerW: number): number {
  assertFinitePositive(powerW, "powerW");
  return 10 * Math.log10(powerW * 1_000);
}

function log2OnePlusLinearSnr(snrDb: number): number {
  const x = (snrDb * Math.LN10) / 10;
  // Stable log(1 + exp(x)) avoids overflow at very high SNR.
  const logOnePlus =
    x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));
  return logOnePlus / Math.LN2;
}

/**
 * Compute the requested received power, thermal-noise SNR, link margin, and
 * Shannon-Hartley capacity C = B log2(1 + 10^(SNR_dB/10)).
 */
export function calculateLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  assertFinite(input.transmitPowerDbm, "transmitPowerDbm");
  assertFinite(input.transmitGainDbi, "transmitGainDbi");
  assertFinite(input.receiveGainDbi, "receiveGainDbi");
  assertFinitePositive(input.distanceKm, "distanceKm");
  assertFinitePositive(input.frequencyHz, "frequencyHz");
  assertFinitePositive(input.systemTemperatureK, "systemTemperatureK");
  assertFinitePositive(input.bandwidthHz, "bandwidthHz");
  const atmosphericLossDb = input.atmosphericLossDb ?? 0;
  const requiredSnrDb = input.requiredSnrDb ?? 0;
  if (!Number.isFinite(atmosphericLossDb) || atmosphericLossDb < 0) {
    throw new RangeError("atmosphericLossDb must be finite and non-negative.");
  }
  assertFinite(requiredSnrDb, "requiredSnrDb");

  const freeSpacePathLossDb = calculateFsplDb(
    input.distanceKm,
    input.frequencyHz,
  );
  const receivedPowerDbm =
    input.transmitPowerDbm +
    input.transmitGainDbi -
    freeSpacePathLossDb -
    atmosphericLossDb +
    input.receiveGainDbi;
  const thermalNoisePowerW =
    BOLTZMANN_CONSTANT_J_K * input.systemTemperatureK * input.bandwidthHz;
  const thermalNoiseFloorDbm = wattsToDbm(thermalNoisePowerW);
  const snrDb = receivedPowerDbm - thermalNoiseFloorDbm;
  const linkMarginDb = snrDb - requiredSnrDb;
  const shannonCapacityBps =
    input.bandwidthHz * log2OnePlusLinearSnr(snrDb);

  return {
    freeSpacePathLossDb,
    receivedPowerDbm,
    thermalNoisePowerW,
    thermalNoiseFloorDbm,
    snrDb,
    requiredSnrDb,
    linkMarginDb,
    shannonCapacityBps,
  };
}

/**
 * Compare capacity with representative application rates. Each service is
 * shown as if it were allocated the entire channel; sharing lowers its rate.
 */
export function calculateServiceBitrates(
  channelCapacityBps: number,
): ServiceBitrate[] {
  if (!Number.isFinite(channelCapacityBps) || channelCapacityBps < 0) {
    throw new RangeError(
      "channelCapacityBps must be a finite non-negative number.",
    );
  }
  return (
    Object.keys(SERVICE_TARGET_BITRATES_BPS) as CommunicationService[]
  ).map((service) => ({
    service,
    targetBitrateBps: SERVICE_TARGET_BITRATES_BPS[service],
    maximumSustainableBitrateBps: channelCapacityBps,
    targetIsSustainable:
      channelCapacityBps >= SERVICE_TARGET_BITRATES_BPS[service],
  }));
}

/**
 * Greenwich sidereal angle in radians, using the specified 23.9344-hour
 * sidereal rotation and the standard J2000 Greenwich sidereal angle.
 */
export function calculateGreenwichSiderealAngleRad(
  julianDate: number,
): number {
  assertFinite(julianDate, "julianDate");
  const elapsedHours = (julianDate - J2000_JD) * 24;
  const angleDeg =
    J2000_GREENWICH_SIDEREAL_ANGLE_DEG +
    (elapsedHours / EARTH_SIDEREAL_ROTATION_HOURS) * 360;
  return normalizeRadians(angleDeg * DEG_TO_RAD);
}

/**
 * Choose the DSN complex with greatest lunar elevation for the given UTC Date
 * or Julian Date. Lock requires elevation >= 10 degrees; visibility requires
 * elevation > 0 degrees.
 */
export function solveDsnVisibility(epoch: MissionEpoch): DsnVisibility {
  const julianDate = toJulianDate(epoch);
  const moon = calculateLunarPosition(julianDate);
  const greenwichSiderealAngleRad =
    calculateGreenwichSiderealAngleRad(julianDate);
  const candidates = DSN_STATIONS.map((station): DsnCandidate => {
    const latitudeRad = station.latitudeDeg * DEG_TO_RAD;
    const longitudeRad = station.longitudeDeg * DEG_TO_RAD;
    const localSiderealAngleRad = normalizeRadians(
      greenwichSiderealAngleRad + longitudeRad,
    );
    const hourAngleRad = localSiderealAngleRad - moon.rightAscensionRad;
    const sinElevation =
      Math.sin(latitudeRad) * Math.sin(moon.declinationRad) +
      Math.cos(latitudeRad) *
        Math.cos(moon.declinationRad) *
        Math.cos(hourAngleRad);
    const elevationDeg =
      Math.asin(Math.max(-1, Math.min(1, sinElevation))) * RAD_TO_DEG;
    return { station, elevationDeg };
  }).sort((a, b) => b.elevationDeg - a.elevationDeg);

  const best = candidates[0];
  const inLineOfSight = best.elevationDeg > 0;
  return {
    julianDate,
    station: inLineOfSight ? best.station : null,
    elevationDeg: inLineOfSight ? best.elevationDeg : null,
    inLineOfSight,
    lock: best.elevationDeg >= DSN_LOCK_ELEVATION_DEG,
    lockElevationThresholdDeg: DSN_LOCK_ELEVATION_DEG,
    candidates,
  };
}

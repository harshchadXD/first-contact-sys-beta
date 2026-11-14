/**
 * Coordinate and Geodesy Conventions:
 * - Reference frame: MOON_ME (Moon Mean Earth / Polar Axis frame)
 * - Azimuth: Degrees [0, 360) clockwise from Lunar North (0° = North, 90° = East)
 * - Elevation: Degrees [-90, +90] relative to local horizontal tangent plane
 * - Distances: Meters relative to lunar datum sphere R_moon = 1,737,400 m
 * - Timestamps: ISO 8601 UTC strings (e.g., "2026-10-01T00:00:00Z")
 */

export interface DatasetProvenance {
  dataFidelity: 'SYNTHETIC';
  generator: string;
  generatedAtUtc: string;
  coordinateConvention: 'MOON_ME';
  angleUnits: 'DEGREES';
  distanceUnits: 'METERS';
  observerMastHeightMeters: number;
  notes: string;
}

export interface HorizonProfile {
  /** Array of azimuth samples in degrees, strictly [0, 360) */
  azimuthDeg: number[];
  /** Array of terrain horizon elevation angles in degrees, strictly [-90, 90] */
  horizonElevationDeg: number[];
}

export interface PositionCoordinates {
  /** Selenographic latitude in degrees [-90, 90] */
  latDeg: number;
  /** Selenographic longitude in degrees [-180, 180] or [0, 360) */
  lonDeg: number;
  /** Surface elevation in meters relative to reference sphere */
  elevationMeters: number;
  /** Topocentric X offset in meters (East) */
  dxMeters: number;
  /** Topocentric Y offset in meters (North) */
  dyMeters: number;
}

export interface LunarPosition {
  positionId: string;
  label: string;
  description: string;
  coordinates: PositionCoordinates;
  /** Local terrain horizon measured from this exact position */
  horizon: HorizonProfile;
}

export interface EphemerisTimeSeries {
  /** Array of ISO 8601 UTC timestamp strings, strictly increasing */
  timestampsUtc: string[];
  /** Solar azimuth in degrees [0, 360) */
  sunAzimuthDeg: number[];
  /** Solar elevation in degrees [-90, 90] */
  sunElevationDeg: number[];
  /** Earth apparent azimuth in degrees [0, 360) */
  earthAzimuthDeg: number[];
  /** Earth apparent elevation in degrees [-90, 90] */
  earthElevationDeg: number[];
}

export interface LunarComparisonDataset {
  datasetId: string;
  siteName: string;
  provenance: DatasetProvenance;
  ephemeris: EphemerisTimeSeries;
  positions: LunarPosition[];
}

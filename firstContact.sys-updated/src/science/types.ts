export type PersonaMode = 'planner' | 'educator';

export type CellSafetyStatus = 'SAFE' | 'MARGINAL' | 'MISSION_LOSS_TRAP';

export type LaunchViability = 'OPTIMAL' | 'MARGINAL' | 'CRITICAL';

export type LinkBridgeState = 'COHERENT' | 'FADING' | 'FRACTURED';

export interface SpacecraftProfile {
  id: 'nova-c' | 'griffin' | 'blue-ghost' | 'vikram';
  name: string;
  missionLabel: string;
  contractor: string;
  defaultMastM: number;
  batteryCapacityKwh: number;
  solarRatedW: number;
  maxSlopeDeg: number;
  hotelLoadW: number;
  txLoadW: number;
  antennaType: string;
  minSurvivalTempK: number;
  survivalHeaterW?: number;
  panelTiltDeg?: number;
  panelAzimuthDeg?: number;
  trackSunAzimuth?: boolean;
}

export interface SiteMetadata {
  siteId: string;
  name: string;
  shortName: string;
  latDeg: number;
  lonDeg: number;
  elevationM: number;
  nominalSlopeDeg: number;
  rmsHeightUncertaintyM: number;
  rmsSlopeErrorDeg: number;
  demSource: string;
  missionContext: string;
  iceProximityKm: number;
}

export interface LunarSiteDefinition {
  metadata: SiteMetadata;
  /** 360 elements (0..359 deg) baseline terrain horizon elevation angle at z_mast = 0m */
  horizonH0Deg: number[];
  /** 360 elements (0..359 deg) radial distance in meters to the critical obstacle */
  dCritM: number[];
  /** 101x101 elevation grid in meters relative to nominal elevationM (row-major y=-250..+250, x=-250..+250) */
  demGrid101: number[];
  /** Seeded terrain characteristics for local dispersion craters */
  craterPreset?: {
    dxM: number;
    dyM: number;
    radiusM: number;
    depthM: number;
    rimBoostDeg: number;
  };
}

export interface DispersionCell {
  index: number;
  row: number;
  col: number;
  dxM: number;
  dyM: number;
  elevationM: number;
  relativeZ: number;
  slopeDeg: number;
  pSunPct: number;
  pEarthPct: number;
  longestDarknessHrs: number;
  hoursToDepletion: number | null;
  status: CellSafetyStatus;
}

export interface TimeSeriesPoint {
  hourIndex: number;
  timestampUtc: string;
  sunAzDeg: number;
  sunElDeg: number;
  horizonSunDeg: number;
  sunFraction: number;
  earthAzDeg: number;
  earthElDeg: number;
  horizonEarthDeg: number;
  earthVisible: boolean;
  simultaneousWindow: boolean;
  batterySocPct: number;
  surfaceTempK: number;
  avionicsTempK: number;
}

export interface LaunchSlipDay {
  slipDays: number;
  arrivalUtc: string;
  pSunPct: number;
  pEarthPct: number;
  longestDarknessHrs: number;
  longestCommsGapHrs: number;
  simultaneousHrs: number;
  minBatterySocPct: number;
  viability: LaunchViability;
}

export interface SummaryMetrics {
  pSunPct: number;
  pEarthPct: number;
  pSimultaneousPct: number;
  longestDarknessHrs: number;
  longestCommsGapHrs: number;
  terrainScore: number;
  weightedSuitabilityScore: number;
  minBatterySocPct: number;
  hoursToDepletion: number | null;
  minSurfaceTempK: number;
  maxSurfaceTempK: number;
  batterySurvivalViable: boolean;
  slopeWithinLimit: boolean;
  status: CellSafetyStatus;
  bridgeState: LinkBridgeState;
}

export interface WeightConfig {
  sun: number;
  earth: number;
  terrain: number;
}

export interface SolverConstraints {
  maxDarknessHrs: number;
  minCommsWindowHrs: number;
  mastHeightM: number;
  missionDurationDays: number;
  epochOffsetDays: number;
}

export interface SiteAnalysisResult {
  site: SiteMetadata;
  spacecraft: SpacecraftProfile;
  selectedCell: DispersionCell;
  adjustedHorizonDeg: number[];
  summary: SummaryMetrics;
  timeSeries: TimeSeriesPoint[];
  dispersionGrid: DispersionCell[];
  launchSlip30d: LaunchSlipDay[];
}

export interface ParetoSiteRanking {
  siteId: string;
  name: string;
  shortName: string;
  latDeg: number;
  lonDeg: number;
  pSunPct: number;
  pEarthPct: number;
  slopeDeg: number;
  iceProximityKm: number;
  longestDarknessHrs: number;
  compositeScore: number;
  paretoOptimal: boolean;
  viable: boolean;
}

export type GMReference = { bodies: Array<{ id: string; name: string; kind?: string; gm_km3_s2: number; ratio_to_sun: number }> };
export type GMValues = Record<string, number>;

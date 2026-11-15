export type DispersionCell = {
  dx_m: number; dy_m: number; elevation_m: number | null; slope_deg: number | null;
  rms_height_uncertainty_m: number | null; status: "SAFE" | "CAUTION" | "MISSION_LOSS_TRAP" | "OUTSIDE_DATA";
};

export type LunarSite = {
  site_metadata: {
    site_id: string; name: string; lat_deg: number; lon_deg: number; elevation_m: number;
    slope_deg: number | null; rms_height_uncertainty_m: number | null; reference_frame: string;
  };
  provenance: { mode: string; dem_source: string; heightmap_png: string; pixel_size_m: number; [key: string]: unknown };
  heightmap: { width: number; height: number; minimum_elevation_m: number; meters_per_code: number };
  horizon_mask_360: { h0_deg: number[]; d_crit_m: number[] };
  horizon_profile?: { azimuth_deg: number[]; elevation_h0_deg: number[]; d_crit_m: number[] };
  dispersion_grid_5x5: DispersionCell[];
  time_series?: {
    timestamps_utc: string[]; sun_az_deg: number[]; sun_el_deg: number[]; earth_az_deg: number[]; earth_el_deg: number[];
  };
};

export type GMReference = { bodies: Array<{ id: string; name: string; kind?: string; gm_km3_s2: number; ratio_to_sun: number }> };
export type GMValues = Record<string, number>;
export type MissionSettings = { profileIndex: number; mastM: number; hotelLoadW: number; initialSoc: number };
export type MissionMetrics = number[];
export type MissionRecord = { sunAz: number; sunEl: number; sunFraction: number; earthAz: number; earthEl: number; earthVisible: boolean; socPct: number; temperatureK: number; solarW: number; netW: number };
export type LaunchWindow = { day: number; sunPct: number; earthPct: number; darknessH: number; commsGapH: number; minSocPct: number; survives: boolean };
export type MissionResult = { metrics: MissionMetrics; timeline: MissionRecord[]; launch: LaunchWindow[] };

import type {
  BakedDispersionCell,
  BakedEphemerisSeries,
  LunarSiteDefinition,
  SiteMetadata,
  SpacecraftProfile,
  TerrainFidelity,
} from './types';
import bakedSitesData from '../../public/data/baked_lunar_sites.json';

export const SPACECRAFT_PROFILES: SpacecraftProfile[] = [
  {
    id: 'nova-c',
    name: 'Nova-C',
    missionLabel: 'IM-2 Athena',
    contractor: 'Intuitive Machines',
    defaultMastM: 3.0,
    batteryCapacityKwh: 2.5,
    solarRatedW: 520,
    maxSlopeDeg: 10.0,
    hotelLoadW: 120,
    txLoadW: 95,
    antennaType: 'Gimbaled X-band',
    minSurvivalTempK: 230,
    survivalHeaterW: 35,
  },
  {
    id: 'griffin',
    name: 'Griffin Lander',
    missionLabel: 'VIPER / CLPS',
    contractor: 'Astrobotic',
    defaultMastM: 2.2,
    batteryCapacityKwh: 5.0,
    solarRatedW: 780,
    maxSlopeDeg: 15.0,
    hotelLoadW: 280,
    txLoadW: 130,
    antennaType: 'Steerable Dish',
    minSurvivalTempK: 220,
    survivalHeaterW: 45,
  },
  {
    id: 'blue-ghost',
    name: 'Blue Ghost',
    missionLabel: 'CLPS 19D',
    contractor: 'Firefly Aerospace',
    defaultMastM: 3.5,
    batteryCapacityKwh: 3.2,
    solarRatedW: 620,
    maxSlopeDeg: 12.0,
    hotelLoadW: 160,
    txLoadW: 110,
    antennaType: 'Fixed Patch Array',
    minSurvivalTempK: 225,
    survivalHeaterW: 35,
  },
  {
    id: 'vikram',
    name: 'Vikram',
    missionLabel: 'Chandrayaan-3',
    contractor: 'ISRO',
    defaultMastM: 2.0,
    batteryCapacityKwh: 1.8,
    solarRatedW: 410,
    maxSlopeDeg: 8.0,
    hotelLoadW: 100,
    txLoadW: 75,
    antennaType: 'S-Band Phased',
    minSurvivalTempK: 235,
    survivalHeaterW: 25,
  },
];

/**
 * Validates spacecraft hardware specifications per NASA IV&V flight rules.
 * Throws RangeError if parameters violate physical thermodynamic or structural bounds.
 */
export function validateSpacecraftProfile(profile: SpacecraftProfile): SpacecraftProfile {
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('Spacecraft profile must be a non-null object.');
  }
  if (!Number.isFinite(profile.batteryCapacityKwh) || profile.batteryCapacityKwh <= 0) {
    throw new RangeError(
      `Invalid battery capacity: ${profile.batteryCapacityKwh} kWh. Must be strictly positive (> 0).`
    );
  }
  if (!Number.isFinite(profile.solarRatedW) || profile.solarRatedW < 0) {
    throw new RangeError(
      `Invalid solar rating: ${profile.solarRatedW} W. Must be non-negative (>= 0).`
    );
  }
  if (!Number.isFinite(profile.hotelLoadW) || profile.hotelLoadW <= 0) {
    throw new RangeError(
      `Invalid hotel load: ${profile.hotelLoadW} W. Must be strictly positive (> 0).`
    );
  }
  if (!Number.isFinite(profile.maxSlopeDeg) || profile.maxSlopeDeg < 0 || profile.maxSlopeDeg > 90) {
    throw new RangeError(
      `Invalid maximum slope limit: ${profile.maxSlopeDeg}°. Must be within [0°, 90°].`
    );
  }
  if (!Number.isFinite(profile.defaultMastM) || profile.defaultMastM < 0) {
    throw new RangeError(
      `Invalid mast height: ${profile.defaultMastM} m. Must be non-negative (>= 0).`
    );
  }
  return profile;
}

interface BakedDispersionRecord {
  dx_m: number;
  dy_m: number;
  elevation_m: number | null;
  relative_z_m: number | null;
  slope_deg: number | null;
  rms_height_uncertainty_m: number | null;
  status: 'SAFE' | 'CAUTION' | 'MISSION_LOSS_TRAP' | 'OUTSIDE_DATA';
}

interface BakedSiteRecord {
  site_metadata: {
    site_id: string;
    name: string;
    short_name: string;
    lat_deg: number;
    lon_deg: number;
    elevation_m: number;
    slope_deg: number | null;
    rms_height_uncertainty_m: number | null;
    rms_slope_error_deg: number | null;
    reference_frame?: string;
    pixel_size_m?: number | null;
    mission_context?: string;
    nearest_psr_km?: number | null;
    psr_fraction_1km_pct?: number | null;
    psr_fraction_5km_pct?: number | null;
    psr_fraction_10km_pct?: number | null;
    psr_source?: string;
  };
  provenance?: {
    mode?: string;
    dem_source?: string;
    dem_source_label?: string;
    terrain_fidelity?: TerrainFidelity;
    pixel_size_m?: number | null;
    horizontal_datum?: string;
    ray_step_m?: number;
    ray_radius_m?: number;
    accessed_utc?: string;
    citation?: string;
  };
  heightmap?: {
    width: number;
    height: number;
    bit_depth: number;
    minimum_elevation_m: number;
    meters_per_code: number;
  };
  horizon_mask_360?: { h0_deg: number[]; d_crit_m: number[] };
  dem_grid_101?: {
    spacing_m: number;
    center_elevation_m: number;
    relative_elevations_m: number[];
  };
  dispersion_grid_5x5?: BakedDispersionRecord[];
  ephemeris?: {
    start_utc: string;
    step_hours: number;
    sun_az_deg: number[];
    sun_el_deg: number[];
    earth_az_deg: number[];
    earth_el_deg: number[];
  };
}

const BAKED_SITES: BakedSiteRecord[] = ((bakedSitesData as { sites?: BakedSiteRecord[] }).sites ?? []).filter(
  (site) => Boolean(site?.site_metadata?.site_id)
);

const BAKED_BY_ID = new Map(BAKED_SITES.map((site) => [site.site_metadata.site_id, site]));

/**
 * Curated presentation order. Every real site is a published LOLA product;
 * MOCK-01 remains deliberately last and explicitly synthetic.
 */
export const SITE_ORDER = [
  'PGDA-01',
  'PGDA-20',
  'PGDA-04',
  'ISRO-CY3',
  'PGDA-02',
  'PGDA-06',
  'PGDA-07',
  'PGDA-08',
  'PGDA-11',
  'PGDA-12',
  'PGDA-14',
  'PGDA-16',
  'PGDA-18',
  'PGDA-23',
  'MOCK-01',
] as const;

export const DEFAULT_SITE_ID = 'PGDA-01';

const CONTEXT_OVERRIDES: Record<string, string> = {
  'PGDA-01':
    'Artemis III candidate ridge between Shackleton and de Gerlache; real LOLA 20 m terrain and ray-cast horizon.',
  'PGDA-04':
    'Published Site04 5 m LOLA product. Its ROI centre sits on the crater rim, so the measured slopes are steep and must not be read as a benign plateau.',
  'ISRO-CY3':
    'Operational Chandrayaan-3 landing benchmark at 69.37° S. Included to test the model against a site that actually landed; it is not an Artemis candidate.',
  'MOCK-01':
    'Explicitly synthetic zero-elevation plane. It exists only as a numerical calibration case and carries no LOLA terrain.',
};

function flipRowsSouthToNorth(values: number[], size = 101): number[] {
  if (values.length !== size * size) {
    throw new Error(`Expected a ${size}x${size} DEM, received ${values.length} samples.`);
  }
  const out = new Array<number>(values.length);
  for (let row = 0; row < size; row++) {
    const sourceRow = size - 1 - row;
    for (let col = 0; col < size; col++) {
      out[row * size + col] = values[sourceRow * size + col];
    }
  }
  return out;
}

function buildBakedSite(record: BakedSiteRecord): LunarSiteDefinition {
  const meta = record.site_metadata;
  const horizon = record.horizon_mask_360;
  const dem = record.dem_grid_101;
  if (!horizon?.h0_deg?.length || horizon.h0_deg.length !== 360) {
    throw new Error(`Baked LOLA record ${meta.site_id} is missing its 360-sample horizon.`);
  }
  if (!horizon.d_crit_m || horizon.d_crit_m.length !== 360) {
    throw new Error(`Baked LOLA record ${meta.site_id} is missing its 360-sample critical distance.`);
  }
  if (!dem?.relative_elevations_m || dem.relative_elevations_m.length !== 101 * 101) {
    throw new Error(`Baked LOLA record ${meta.site_id} is missing its 101x101 DEM.`);
  }

  const provenance = record.provenance;
  const terrainFidelity: TerrainFidelity =
    provenance?.terrain_fidelity ?? (meta.site_id === 'MOCK-01' ? 'synthetic' : 'lola_published');

  const nearestPsrKm =
    typeof meta.nearest_psr_km === 'number' && Number.isFinite(meta.nearest_psr_km)
      ? meta.nearest_psr_km
      : null;

  const metadata: SiteMetadata = {
    siteId: meta.site_id,
    name: meta.name,
    shortName: meta.short_name,
    latDeg: meta.lat_deg,
    lonDeg: meta.lon_deg,
    elevationM: meta.elevation_m,
    nominalSlopeDeg: meta.slope_deg ?? 0,
    rmsHeightUncertaintyM: meta.rms_height_uncertainty_m ?? null,
    rmsSlopeErrorDeg: meta.rms_slope_error_deg ?? null,
    demSource:
      provenance?.dem_source_label ??
      (terrainFidelity === 'synthetic'
        ? 'Synthetic plane — no LOLA terrain'
        : 'NASA GSFC PGDA LOLA published product'),
    missionContext: CONTEXT_OVERRIDES[meta.site_id] ?? meta.mission_context ?? 'Lunar south-polar site.',
    iceProximityKm: nearestPsrKm ?? 999,
    terrainFidelity,
    pixelSizeM: meta.pixel_size_m ?? provenance?.pixel_size_m ?? null,
    nearestPsrKm,
    psrFraction1kmPct: meta.psr_fraction_1km_pct ?? null,
    psrFraction5kmPct: meta.psr_fraction_5km_pct ?? null,
    psrFraction10kmPct: meta.psr_fraction_10km_pct ?? null,
    psrSource: meta.psr_source,
    referenceFrame: meta.reference_frame ?? provenance?.horizontal_datum ?? 'MOON_ME',
  };

  const bakedDispersion: BakedDispersionCell[] = (record.dispersion_grid_5x5 ?? []).map((cell) => ({
    dxM: cell.dx_m,
    dyM: cell.dy_m,
    elevationM: cell.elevation_m,
    relativeZM: cell.relative_z_m,
    slopeDeg: cell.slope_deg,
    rmsHeightUncertaintyM: cell.rms_height_uncertainty_m,
    status: cell.status,
  }));

  return {
    metadata,
    horizonH0Deg: horizon.h0_deg,
    dCritM: horizon.d_crit_m,
    // The bake stores image rows north-to-south; the renderer and sampler use
    // south-to-north rows, so flip once here and keep one convention everywhere.
    demGrid101: flipRowsSouthToNorth(dem.relative_elevations_m),
    bakedDispersion,
    bakedEphemeris: record.ephemeris
      ? ({
          startUtc: record.ephemeris.start_utc,
          stepHours: record.ephemeris.step_hours,
          sunAzDeg: record.ephemeris.sun_az_deg,
          sunElDeg: record.ephemeris.sun_el_deg,
          earthAzDeg: record.ephemeris.earth_az_deg,
          earthElDeg: record.ephemeris.earth_el_deg,
        } satisfies BakedEphemerisSeries)
      : undefined,
    provenance: provenance
      ? {
          mode: provenance.mode ?? 'validated_computed',
          demSource: provenance.dem_source ?? '',
          demSourceLabel: provenance.dem_source_label ?? metadata.demSource,
          terrainFidelity,
          pixelSizeM: provenance.pixel_size_m ?? null,
          referenceFrame: provenance.horizontal_datum ?? metadata.referenceFrame ?? 'MOON_ME',
          rayStepM: provenance.ray_step_m,
          rayRadiusM: provenance.ray_radius_m,
          accessedUtc: provenance.accessed_utc,
          citation: provenance.citation,
        }
      : undefined,
    heightmap: record.heightmap
      ? {
          width: record.heightmap.width,
          height: record.heightmap.height,
          minimumElevationM: record.heightmap.minimum_elevation_m,
          metersPerCode: record.heightmap.meters_per_code,
        }
      : undefined,
  };
}

function buildSiteList(): LunarSiteDefinition[] {
  return SITE_ORDER.map((siteId) => {
    const record = BAKED_BY_ID.get(siteId);
    if (!record) {
      throw new Error(
        `Missing baked LOLA/DE421 record for ${siteId}. Run backend/tools/bake_multisite_lola.py and merge the part files before building.`
      );
    }
    return buildBakedSite(record);
  });
}

export const LUNAR_SITES: LunarSiteDefinition[] = buildSiteList();

export function findSiteById(siteId: string): LunarSiteDefinition | undefined {
  return LUNAR_SITES.find((site) => site.metadata.siteId === siteId);
}

export function getSiteById(siteId: string): LunarSiteDefinition {
  return findSiteById(siteId) ?? LUNAR_SITES[0];
}

export function getSpacecraftById(id: string): SpacecraftProfile {
  const profile = SPACECRAFT_PROFILES.find((s) => s.id === id) ?? SPACECRAFT_PROFILES[0];
  return validateSpacecraftProfile(profile);
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const snapshot = path.join(root, 'shaurya_work/Firstcontact.sys - Copy');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const destination=path.join(root,'frontend/src/data/shackletonStudy.json');
if(fs.existsSync(destination)&&read(destination).sourceManifest?.correctedGeographicBake){
  throw new Error('The corrected study already exists. Rebuild with bakeStudy.py; this legacy bootstrap must not overwrite it.');
}
const site = read(path.join(snapshot, 'frontend/public/data/baked_lunar_sites.json')).sites.find(s => s.site_metadata.site_id === 'PGDA-Site04-Shackleton');
assert.ok(site, 'Expected the archived Site04 bake');
const patch = read(path.join(root, 'data/site04_traceable_patch.json'));
const manifest = read(path.join(root, 'data/real_data_manifest.json'));
const dem = fs.readFileSync(path.join(snapshot, 'data/dem/Site04/Site04_final_adj_5mpp_surf.tif'));
const hash = createHash('sha256').update(dem).digest('hex');
assert.equal(hash, manifest.lola_dem.sha256, 'DEM must match the extraction manifest');
assert.equal(patch.elevationsMeters.length, patch.columns * patch.rows);
assert.ok(patch.elevationsMeters.every(Number.isFinite));
assert.equal(site.horizon_mask_360.h0_deg.length, 360);
const times = site.time_series;
assert.ok(times.timestamps_utc.length >= 59 * 24 + 1);
for (const values of Object.values(times)) assert.equal(values.length, times.timestamps_utc.length);
const meta = site.site_metadata;
const centreId = '0:0';
const output = {
  dataset: {
    datasetId: 'pgda-site04-de421-reference', siteName: 'Shackleton Rim',
    provenance: {
      dataFidelity: 'NASA_DERIVED', generator: 'Adapted from teammate Site04 raster/SPICE bake; original arrays preserved',
      generatedAtUtc: new Date().toISOString(), coordinateConvention: 'MOON_ME', angleUnits: 'DEGREES', distanceUnits: 'METERS', observerMastHeightMeters: 0,
      sourceUrls: ['https://pgda.gsfc.nasa.gov/products/78/', 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'],
      notes: 'Imported NASA-derived study, not independently validated mission predictions. One central 30 km horizon only; 25 grid points carry slope/context, not per-point visibility. Geometric DE421 hourly samples, ground-level observer. Original source DEM hash checked against supplied extraction manifest. Resolution, orientation and horizon convergence still require independent review.',
    },
    ephemeris: {timestampsUtc: times.timestamps_utc, sunAzimuthDeg: times.sun_az_deg, sunElevationDeg: times.sun_el_deg, earthAzimuthDeg: times.earth_az_deg, earthElevationDeg: times.earth_el_deg},
    positions: [{positionId: centreId, label: 'Reference centre', description: 'Ground-level regional horizon at the Site04 reference pixel.', coordinates: {latDeg: meta.lat_deg, lonDeg: meta.lon_deg, elevationMeters: meta.elevation_m, dxMeters: 0, dyMeters: 0}, horizon: {azimuthDeg: Array.from({length: 360}, (_, i) => i), horizonElevationDeg: site.horizon_mask_360.h0_deg}}],
  },
  terrain: {columns: patch.columns, rows: patch.rows, spacingMeters: patch.spacingMeters, referenceElevationMeters: patch.referenceElevationMeters, elevationsMeters: patch.elevationsMeters},
  points: site.dispersion_grid_5x5.map(c => ({id: `${c.dx_m}:${c.dy_m}`, eastMeters: c.dx_m, northMeters: c.dy_m, elevationMeters: c.elevation_m, slopeDeg: c.slope_deg})),
  sourceManifest: {...manifest, verifiedDemSha256: hash, originalBake: site.provenance},
};
fs.writeFileSync(path.join(root, 'frontend/src/data/shackletonStudy.json'), JSON.stringify(output));
console.log(`Prepared Site04 terrain and ${times.timestamps_utc.length} DE421 samples; DEM hash matches supplied manifest. No source files modified.`);

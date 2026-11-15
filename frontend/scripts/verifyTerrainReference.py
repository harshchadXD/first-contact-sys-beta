"""Compare the baked horizon with a Cartesian/GDAL reference using the same raster sources.

This is independent-formulation consistency, not observational terrain validation.
"""
from pathlib import Path
import json
import sys
ROOT = Path(__file__).resolve().parents[2]
SNAP = ROOT / 'shaurya_work/Firstcontact.sys - Copy'
for folder in ['.vendor', '.raster-vendor']:
    sys.path.insert(0, str(SNAP / 'backend' / folder))
import numpy as np
import rasterio
from rasterio.warp import transform
from rasterio.crs import CRS

R = 1737400.
GEOGRAPHIC = CRS.from_proj4(f'+proj=longlat +R={R} +no_defs')
study = json.loads((ROOT / 'frontend/src/data/shackletonStudy.json').read_text())
heights = np.array(study['supportedHeightsMeters'])

def interpolate(array, affine, xs, ys):
    columns, rows = (~affine) * (xs, ys)
    columns -= .5
    rows -= .5
    left, top = np.floor(columns).astype(int), np.floor(rows).astype(int)
    valid = (left >= 0) & (top >= 0) & (left + 1 < array.shape[1]) & (top + 1 < array.shape[0])
    result = np.full(xs.shape, np.nan)
    c, r = left[valid], top[valid]
    u, v = columns[valid] - c, rows[valid] - r
    values = np.stack([array[r,c], array[r,c+1], array[r+1,c], array[r+1,c+1]])
    weights = np.stack([(1-u)*(1-v),u*(1-v),(1-u)*v,u*v])
    result[valid] = np.sum(values * weights, axis=0)
    return result

local_path = SNAP / 'data/dem/Site04/Site04_final_adj_5mpp_surf.tif'
with rasterio.open(local_path) as ds, rasterio.open(ROOT / '.tools/cache/site04-regional.tif') as regional:
    local = ds.read(1, masked=True).astype(float).filled(np.nan)
    outer = regional.read(1, masked=True).astype(float).filled(np.nan)
    checks = []
    distances = np.r_[np.arange(5.,2000.,5.),np.arange(2000.,30000.1,25.)]
    angle = distances/R
    for pid in ['0:0','-200:200','200:-200']:
        position = next(p for p in study['dataset']['positions'] if p['positionId'] == pid)
        lat, lon = np.radians([position['coordinates']['latDeg'],position['coordinates']['lonDeg']])
        up = np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
        east = np.array([-np.sin(lon),np.cos(lon),0.])
        north = np.cross(up,east)
        origin = (R+position['coordinates']['elevationMeters'])*up
        reference = np.zeros((len(heights),360))
        for az in range(360):
            bearing = np.sin(np.radians(az))*east + np.cos(np.radians(az))*north
            radial = up[:,None]*np.cos(angle) + bearing[:,None]*np.sin(angle)
            longitude = np.degrees(np.arctan2(radial[1],radial[0]))
            latitude = np.degrees(np.arctan2(radial[2],np.hypot(radial[0],radial[1])))
            xs,ys = transform(GEOGRAPHIC,ds.crs,longitude,latitude)
            xs,ys = np.array(xs),np.array(ys)
            z = interpolate(local,ds.transform,xs,ys)
            missing = ~np.isfinite(z)
            z[missing] = interpolate(outer,regional.transform,xs[missing],ys[missing])
            assert np.isfinite(z).all(), f'Missing terrain in {pid}/{az}'
            vectors = radial*(R+z) - origin[:,None]
            horizontal = np.hypot(east@vectors,north@vectors)
            for i,height in enumerate(heights):
                reference[i,az] = np.degrees(np.arctan2(up@vectors-height,horizontal)).max()
        baked = np.array([study['heightProfiles'][pid][f'{h:.1f}'] for h in heights])
        difference = np.abs(reference-baked)
        checks.append(dict(positionId=pid,maximumAbsoluteDifferenceDeg=float(difference.max()),rmsDifferenceDeg=float(np.sqrt(np.mean(difference**2)))))
        print(pid,checks[-1],flush=True)
        assert difference.max() < .00001, 'Reference disagreement requires investigation'
    centre = next(p for p in study['dataset']['positions'] if p['positionId']=='0:0')['coordinates']
    x,y = ds.xy(study['sourceManifest']['correctedGeographicBake']['centreRow'],study['sourceManifest']['correctedGeographicBake']['centreColumn'])
    lon,lat = transform(ds.crs,GEOGRAPHIC,[x],[y])
    assert abs(lat[0]-centre['latDeg']) < 1e-9 and abs(lon[0]-centre['lonDeg']) < 1e-9

report = dict(status='PASS',positions=checks,azimuthsPerPosition=360,heightsMeters=heights.tolist(),coordinateReference='GDAL/PROJ lunar spherical polar stereographic vs geographic',horizonReference='Cartesian terrain vectors projected onto an orthonormal local east/north/up frame',limitations='Shared source DEMs, ray distances, spherical radius and bilinear sampling assumptions. This is independent-formulation consistency, not validation against observations or a bound on DEM, temporal or finite-range errors.')
(ROOT/'docs/validation/terrain-reference-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print('GDAL coordinate and Cartesian horizon reference checks PASS.',flush=True)

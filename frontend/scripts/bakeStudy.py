"""Prepare geographically oriented per-position/per-height Site04 study; run from repo root.
Outputs only frontend-owned data and a local ignored raster cache. No source mutation.
"""
import sys, json, math, hashlib, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
SNAP=ROOT/'shaurya_work/Firstcontact.sys - Copy'
for folder in ['.vendor','.raster-vendor']: sys.path.insert(0,str(SNAP/'backend'/folder))
import numpy as np
import rasterio
from rasterio.windows import Window,from_bounds
import spiceypy as spice
R=1737400.
HEIGHTS=[0.,.5,1.,2.,5.,10.]
SOURCE='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF'
CACHE=ROOT/'.tools/cache/site04-regional.tif'
OUT=ROOT/'frontend/src/data/shackletonStudy.json'

def projected(lat,lon):
    rho=2*R*np.tan((np.pi/2+lat)/2)
    return rho*np.sin(lon),rho*np.cos(lon)

def geographic(x,y):
    return 2*np.arctan2(np.hypot(x,y),2*R)-np.pi/2,np.arctan2(x,y)

def destination(lat,lon,distance,az):
    delta=distance/R
    p=np.arcsin(np.sin(lat)*np.cos(delta)+np.cos(lat)*np.sin(delta)*np.cos(az))
    l=lon+np.arctan2(np.sin(az)*np.sin(delta)*np.cos(lat),np.cos(delta)-np.sin(lat)*np.sin(p))
    return p,l

def sample(array,transform,x,y):
    col=(x-transform.c)/transform.a-.5;row=(y-transform.f)/transform.e-.5
    c=np.floor(col).astype(int);r=np.floor(row).astype(int)
    inside=(c>=0)&(r>=0)&(c+1<array.shape[1])&(r+1<array.shape[0])
    out=np.full(np.shape(x),np.nan,dtype=float)
    rr=r[inside];cc=c[inside];fc=col[inside]-cc;fr=row[inside]-rr
    out[inside]=array[rr,cc]*(1-fr)*(1-fc)+array[rr+1,cc]*fr*(1-fc)+array[rr,cc+1]*(1-fr)*fc+array[rr+1,cc+1]*fr*fc
    return out

def self_check():
    lat,lon=np.radians([-89.7667415,-171.8928091]);x,y=projected(lat,lon)
    p,l=geographic(x,y)
    assert abs(p-lat)<1e-12 and abs(l-lon)<1e-12
    for az in [0,math.pi/2,math.pi,3*math.pi/2]:
        p,l=destination(lat,lon,1.,az);xx,yy=projected(p,l);dx,dy=xx-x,yy-y
        east=dx*math.cos(lon)-dy*math.sin(lon);north=dx*math.sin(lon)+dy*math.cos(lon)
        assert abs(east-math.sin(az))<.002 and abs(north-math.cos(az))<.002
    d=np.array([5.,100.,1000.,30000.]);delta=d/R
    angle=np.arctan2(R*np.cos(delta)-R,R*np.sin(delta))
    assert np.max(np.abs(angle+delta/2))<1e-9
    a=np.array([[0.,10.],[20.,30.]])
    from affine import Affine
    assert abs(float(sample(a,Affine(1,0,0,0,1,0),np.array([1.]),np.array([1.]))[0])-15)<1e-10
    print('Analytic checks PASS: projection roundtrip, geographic cardinal directions, curved sphere and bilinear interpolation.',flush=True)

def main(site='Site04', output=None):
    global CACHE, OUT
    self_check();t0=time.perf_counter()
    template=ROOT/'frontend/src/data/shackletonStudy.json'
    local_dir=SNAP/'data/dem/Site04' if site=='Site04' else ROOT/'.tools/cache'/site
    CACHE=ROOT/f'.tools/cache/{site.lower()}-regional.tif'
    OUT=Path(output) if output else template
    label={'Site04':'Shackleton ridge candidate','Site01':'Connecting Ridge candidate'}[site]
    path=local_dir/f'{site}_final_adj_5mpp_surf.tif'
    with rasterio.open(path) as ds:
        local=ds.read(1,masked=True).astype('float32').filled(np.nan);tr=ds.transform
        # Reproducible exploratory candidate: highest valid interior pixel with slope < 6 degrees.
        # This is an algorithm-selected terrain sample, not an official NASA landing target.
        with rasterio.open(local_dir/f'{site}_final_adj_5mpp_slp.tif') as sd:
            candidate_slopes=sd.read(1,masked=True).filled(np.nan)
        valid=np.isfinite(local)&np.isfinite(candidate_slopes)&(candidate_slopes<6)
        valid[:150]=False;valid[-150:]=False;valid[:,:150]=False;valid[:,-150:]=False
        centre_row,centre_col=np.unravel_index(np.argmax(np.where(valid,local,-np.inf)),local.shape)
        assert valid[centre_row,centre_col]
        x0,y0=ds.xy(int(centre_row),int(centre_col))
        print('Selected exploratory ridge pixel:',centre_row,centre_col,'height',float(local[centre_row,centre_col]),'slope',float(candidate_slopes[centre_row,centre_col]),flush=True)
        lat0,lon0=geographic(x0,y0)
        del candidate_slopes,valid
        if not CACHE.exists():
            CACHE.parent.mkdir(parents=True,exist_ok=True)
            print('Reading only a 64 km regional COG window, not the 2.6 GB product.',flush=True)
            with rasterio.Env(GDAL_CACHEMAX=16000000,GDAL_NUM_THREADS="1",GDAL_HTTP_TIMEOUT='30',GDAL_HTTP_MULTIRANGE='SERIAL',GDAL_HTTP_MAX_RETRY='3',GDAL_HTTP_RETRY_DELAY='2',CPL_VSIL_CURL_CHUNK_SIZE='262144',GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF'):
                from httpRangeReader import regional_opener
                with rasterio.open(SOURCE,opener=regional_opener) as region:
                    assert abs(region.crs.ellipsoid.semi_major_metre-R)<1 if hasattr(region.crs,'ellipsoid') else True
                    win=from_bounds(x0-32000,y0-32000,x0+32000,y0+32000,region.transform).round_offsets().round_lengths()
                    profile=region.profile.copy();profile.update(width=int(win.width),height=int(win.height),transform=region.window_transform(win),count=1,compress='deflate',tiled=True)
                    temporary=CACHE.with_suffix('.partial.tif')
                    with rasterio.open(temporary,'w',**profile) as out:
                        for row in range(0,int(win.height),512):
                            for col in range(0,int(win.width),512):
                                w=min(512,int(win.width)-col);h=min(512,int(win.height)-row)
                                block=region.read(1,window=Window(win.col_off+col,win.row_off+row,w,h),masked=True)
                                out.write(block.filled(region.nodata),1,window=Window(col,row,w,h))
                            print(f'Regional cache: {min(row+512,int(win.height))}/{int(win.height)} rows',flush=True)
                    temporary.replace(CACHE)
        with rasterio.open(CACHE) as region:
            regional=region.read(1,masked=True).astype('float32').filled(np.nan);rt=region.transform
        with rasterio.open(local_dir/f'{site}_final_adj_5mpp_slp.tif') as sd:slope=sd.read(1,masked=True).filled(np.nan)
        with rasterio.open(local_dir/f'{site}_final_adj_5mpp_toterr.tif') as ed:err=ed.read(1,masked=True).filled(np.nan)
        def elevation(xs,ys):
            zs=sample(local,tr,xs,ys);missing=~np.isfinite(zs)
            if missing.any():zs[missing]=sample(regional,rt,xs[missing],ys[missing])
            return zs
        def horizons(lat,lon,z,azimuths,radius=30000.,dense=False):
            distances=np.concatenate((np.arange(2.5 if dense else 5.,2000.,2.5 if dense else 5.),np.arange(2000.,radius+.1,12.5 if dense else 25.)))
            delta=distances/R;result=np.zeros((len(HEIGHTS),len(azimuths)));coverage=[]
            for i,az in enumerate(azimuths):
                p,l=destination(lat,lon,distances,np.radians(az));xs,ys=projected(p,l);zs=elevation(xs,ys)
                if not np.isfinite(zs).all():raise ValueError(f'Incomplete terrain along geographic azimuth {az}; do not fill nodata with safe horizon')
                horiz=(R+zs)*np.sin(delta)
                up=(R+zs)*np.cos(delta)-(R+z)
                for j,height in enumerate(HEIGHTS):result[j,i]=np.degrees(np.arctan2(up-height,horiz)).max()
                coverage.append(float(distances[-1]))
            return result
        positions=[];points=[];height_profiles={};convergence={}
        for north in [200,100,0,-100,-200]:
            for east in [-200,-100,0,100,200]:
                distance=math.hypot(east,north);az=math.atan2(east,north)
                lat,lon=destination(lat0,lon0,distance,az);px,py=projected(lat,lon)
                z=float(elevation(np.array([px]),np.array([py]))[0]);pid=f'{east}:{north}'
                profiles=horizons(lat,lon,z,np.arange(360.))
                height_profiles[pid]={str(h):[round(float(v),6) for v in profiles[j]] for j,h in enumerate(HEIGHTS)}
                sl=float(sample(slope,tr,np.array([px]),np.array([py]))[0]);er=float(sample(err,tr,np.array([px]),np.array([py]))[0])
                points.append(dict(id=pid,eastMeters=east,northMeters=north,elevationMeters=round(z,3),slopeDeg=round(sl,3),heightErrorMeters=round(er,3)))
                positions.append(dict(positionId=pid,label='Reference centre' if pid=='0:0' else f'E {east:+d} / N {north:+d} m',description='Geographic-azimuth horizon, sampled to 30 km.',coordinates=dict(latDeg=float(np.degrees(lat)),lonDeg=float(np.degrees(lon)),elevationMeters=z,dxMeters=east,dyMeters=north),horizon=dict(azimuthDeg=list(range(360)),horizonElevationDeg=height_profiles[pid]['0.0'])))
                if pid=='0:0':
                    fine=horizons(lat,lon,z,np.arange(.5,360,.9999999999999))
                    interpolated=(profiles[:,np.arange(360)]+profiles[:,(np.arange(360)+1)%360])/2
                    convergence['halfDegreeMidpointMaxDifferenceDeg']=float(np.max(np.abs(fine-interpolated)))
                    convergence['finerRadialSamplingMaxDifferenceDeg']=float(np.max(np.abs(horizons(lat,lon,z,np.arange(360.),dense=True)-profiles)))
                    convergence['twentyVsThirtyKmMaxDifferenceDeg']=float(np.max(np.abs(horizons(lat,lon,z,np.arange(360.),radius=20000.)-profiles)))
                    convergence['meaning']='Angular interpolation sensitivity, not end-to-end error or confidence interval; hourly timing, raster sampling and finite ray range remain limitations.'
                print(f'Horizons {len(points)}/25, all {len(HEIGHTS)} supported heights: {pid}',flush=True)
        kernels=SNAP/'data/kernels/de421'
        for name in ['naif0012.tls','de421.bsp','moon_pa_de421_1900-2050.bpc','moon_080317.tf','pck00010.tpc']:spice.furnsh(str(kernels/name))
        old=json.load(open(template,encoding='utf-8'))
        times=old['dataset']['ephemeris']['timestampsUtc']
        ets=np.array([spice.str2et(s) for s in times])
        vectors={body:np.array([spice.spkpos(body,float(et),'MOON_ME','NONE','MOON')[0] for et in ets])*1000 for body in ['SUN','EARTH']}
        height_direction_bound=0.
        for pos in positions:
            lat,lon=np.radians([pos['coordinates']['latDeg'],pos['coordinates']['lonDeg']]);z=pos['coordinates']['elevationMeters']
            up=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
            east=np.array([-np.sin(lon),np.cos(lon),0.]);north=np.cross(up,east)
            observer=(R+z)*up;ep=dict(timestampsUtc=times)
            for body,prefix in [('SUN','sun'),('EARTH','earth')]:
                direction=vectors[body]-observer;e=direction@east;n=direction@north;u=direction@up
                height_direction_bound=max(height_direction_bound,float(np.degrees(np.arcsin(max(HEIGHTS)/np.linalg.norm(direction,axis=1).min()))))
                ep[prefix+'AzimuthDeg']=[round(float(v),7) for v in np.degrees(np.arctan2(e,n))%360]
                ep[prefix+'ElevationDeg']=[round(float(v),7) for v in np.degrees(np.arctan2(u,np.hypot(e,n)))]
            pos['ephemeris']=ep
        centre=next(p for p in positions if p['positionId']=='0:0')
        # Independent temporal-resolution reference for the 7-day, 5m centre scenario.
        from datetime import datetime,timedelta,timezone
        start=datetime(2026,12,1,tzinfo=timezone.utc)
        dense_times=[(start+timedelta(minutes=15*i)).strftime('%Y-%m-%dT%H:%M:%SZ') for i in range(7*24*4+1)]
        lat,lon=np.radians([centre['coordinates']['latDeg'],centre['coordinates']['lonDeg']]);up=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)]);east=np.array([-np.sin(lon),np.cos(lon),0.]);north=np.cross(up,east)
        observer=(R+centre['coordinates']['elevationMeters']+5)*up
        dense_ep=dict(timestampsUtc=dense_times)
        for body,prefix in [('SUN','sun'),('EARTH','earth')]:
            direction=np.array([spice.spkpos(body,spice.str2et(t),'MOON_ME','NONE','MOON')[0] for t in dense_times])*1000-observer
            e=direction@east;n=direction@north;u=direction@up
            dense_ep[prefix+'AzimuthDeg']=[float(v) for v in np.degrees(np.arctan2(e,n))%360]
            dense_ep[prefix+'ElevationDeg']=[float(v) for v in np.degrees(np.arctan2(u,np.hypot(e,n)))]
        (ROOT/('.tools/cache/temporal-reference.json' if site=='Site04' else f'.tools/cache/{site}-temporal-reference.json')).write_text(json.dumps(dict(ephemeris=dense_ep,horizon=height_profiles['0:0']['5.0'],observerHeightMeters=5)))
        spice.kclear()
        old['dataset']['positions']=positions;old['dataset']['ephemeris']=centre['ephemeris'];old['points']=points
        old['dataset']['siteName']=label;old['dataset']['datasetId']=f'pgda-{site.lower()}-ridge-geographic-de421'
        old['dataset']['provenance']['generatedAtUtc']=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
        old['sourceManifest']['extracted_at']=old['dataset']['provenance']['generatedAtUtc']
        old['sourceManifest']['verifiedDemSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        if site!='Site04':
            old['sourceManifest'].pop('originalBake',None)
            old['sourceManifest']['downloadedSources']=json.loads((local_dir/'sources.json').read_text())
        old['sourceManifest']['lola_dem']['source_file']=path.name
        old['sourceManifest']['lola_dem']['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        old['sourceManifest']['lola_dem']['downloadUrl']=f'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/{site}/{path.name}'
        patch=ds.read(1,window=Window(int(centre_col)-50,int(centre_row)-50,100,100),masked=True).astype(float).filled(np.nan)
        assert np.isfinite(patch).all()
        old['terrain']=dict(columns=100,rows=100,spacingMeters=5,referenceElevationMeters=float(local[centre_row,centre_col]),elevationsMeters=[round(float(v),3) for v in patch.ravel()],gridNorthLongitudeDeg=float(np.degrees(lon0)))
        old['supportedHeightsMeters']=HEIGHTS;old['heightProfiles']=height_profiles
        old['dataset']['provenance']['generator']='Geographic spherical-ray horizon bake + direct per-position SPICE DE421 geometric vectors'
        old['dataset']['provenance']['notes']=f'NASA-derived exploration: 25 position-specific 30 km horizons and per-position DE421 geometric ephemeris. Supported heights are separately baked. Ground-observer celestial vectors are reused at height; maximum computed direction approximation {height_direction_bound:.8f} degrees. Terrain sampling and finite range remain limitations. No landing or survival certification.'
        old['sourceManifest']['lola_dem']['window']=dict(col_off=int(centre_col)-50,row_off=int(centre_row)-50,width=100,height=100)
        old['sourceManifest']['correctedGeographicBake']=dict(centreRow=int(centre_row),centreColumn=int(centre_col),selectionMethod='Highest elevation interior source pixel with slope below 6 degrees; exploratory candidate, not official target',azimuthConvention='geographic north clockwise',horizonGeometry='exact spherical radial terrain in observer tangent plane',interpolation='bilinear raster heights',raySampling='5 m to 2 km; 25 m from 2 to 30 km',regionalSource=SOURCE,supportedHeightsMeters=HEIGHTS,maximumHeightDirectionApproximationDeg=height_direction_bound,positions=25,convergence=convergence,seconds=time.perf_counter()-t0)
        OUT.parent.mkdir(parents=True,exist_ok=True)
        temporary=OUT.with_suffix('.tmp.json');temporary.write_text(json.dumps(old,separators=(',',':')),encoding='utf-8');temporary.replace(OUT)
        print('Wrote',OUT,'bytes',OUT.stat().st_size,'elapsed',time.perf_counter()-t0,flush=True)
        print('Angular sensitivity:',convergence,flush=True)
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',choices=['Site04','Site01'],default='Site04')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    if args.site!='Site04' and not args.output: parser.error('A new region requires an explicit output; do not overwrite the existing study.')
    main(args.site,args.output)

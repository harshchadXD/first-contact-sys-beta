import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import init,{analyze_json} from '../../engine/pkg/first_contact_engine.js';
const bytes=fs.readFileSync(new URL('../../engine/pkg/first_contact_engine_bg.wasm',import.meta.url));
await init({module_or_path:bytes});
const study=JSON.parse(fs.readFileSync(new URL('../../frontend/src/data/shackletonStudy.json',import.meta.url)));
assert.equal(study.dataset.positions.length,25);
const featureNames=['east/200','north/200','height/10','duration/336','arrival/29','horizonMean/40','horizonStd/20','horizonMin/40','horizonMax/40','horizonCos1/20','horizonSin1/20','horizonCos2/20','horizonSin2/20','sunSinAz','sunCosAz','sunEl/10','earthSinAz','earthCosAz','earthEl/10'];
const rows=[];let exactMs=0;const started=performance.now();
for(let pi=0;pi<study.dataset.positions.length;pi++){
 const p=study.dataset.positions[pi];
 for(const height of [0,1,5,10]){
  const h=study.heightProfiles[p.positionId][height.toFixed(1)];
  const mean=h.reduce((s,v)=>s+v,0)/h.length,std=Math.sqrt(h.reduce((s,v)=>s+(v-mean)**2,0)/h.length);
  const shape=[mean/40,std/20,Math.min(...h)/40,Math.max(...h)/40,...[1,2].flatMap(k=>[h.reduce((s,v,i)=>s+v*Math.cos(k*i*Math.PI/180),0)/360/20,h.reduce((s,v,i)=>s+v*Math.sin(k*i*Math.PI/180),0)/360/20])];
  for(const duration of [24,168,336])for(let arrival=0;arrival<30;arrival++){
   const start=arrival*24,end=start+duration,e=p.ephemeris;
   const request={schemaVersion:1,windowEndUtc:e.timestampsUtc[end],...Object.fromEntries(Object.entries(e).map(([k,v])=>[k,v.slice(start,end)])),positions:[{positionId:p.positionId,horizon:{azimuthDeg:p.horizon.azimuthDeg,horizonElevationDeg:h}}]};
   const t=performance.now();const result=JSON.parse(analyze_json(JSON.stringify(request))).positions[0];exactMs+=performance.now()-t;
   const sa=e.sunAzimuthDeg[start]*Math.PI/180,ea=e.earthAzimuthDeg[start]*Math.PI/180;
   const features=[p.coordinates.dxMeters/200,p.coordinates.dyMeters/200,height/10,duration/336,arrival/29,...shape,Math.sin(sa),Math.cos(sa),e.sunElevationDeg[start]/10,Math.sin(ea),Math.cos(ea),e.earthElevationDeg[start]/10];
   assert.equal(features.length,featureNames.length);assert.ok(features.every(Number.isFinite));
   rows.push({positionIndex:pi,positionId:p.positionId,arrivalDay:arrival,heightMeters:height,durationHours:duration,features,targets:[result.sunVisibleFraction,result.earthVisibleFraction,result.longestDarknessHours/duration,result.longestEarthVisibleHours/duration]});
  }
 }
 console.log(`Rust labels: position ${pi+1}/25, ${rows.length} cases`);
}
const metadata={schemaVersion:1,sourceStudySha256:createHash('sha256').update(JSON.stringify(study)).digest('hex'),wasmSha256:createHash('sha256').update(bytes).digest('hex'),features:featureNames,targets:['sunVisibleFraction','earthVisibleFraction','longestDarkness/window','longestEarthVisible/window'],cases:rows.length,exactEngineMilliseconds:exactMs,totalGenerationMilliseconds:performance.now()-started,scope:'One Site04 region; physics-generated sampled geometric labels, not mission success labels. Full future ephemeris is not passed as model features.'};
fs.writeFileSync(new URL('./labels.json.gz',import.meta.url),gzipSync(JSON.stringify({metadata,rows})));
fs.writeFileSync(new URL('./label-manifest.json',import.meta.url),JSON.stringify(metadata,null,2));
console.log('Completed',rows.length,'cases. Exact Rust call total ms',exactMs.toFixed(1));

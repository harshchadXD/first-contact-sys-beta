import fs from "node:fs";
import assert from "node:assert/strict";
import init, { analyze_json } from "../../engine/pkg/first_contact_engine.js";
import { validateStudyPayload } from "../src/services/studyLoader.ts";
import { selectStudyWindow } from "../src/services/studyWindow.ts";
import { analyzeDataset } from "../src/services/missionEngine.ts";
import { profileParameters } from "../src/services/energyProfiles.ts";

await init({module_or_path:fs.readFileSync(new URL("../../engine/pkg/first_contact_engine_bg.wasm",import.meta.url))});
const paths = ["../src/data/shackletonStudy.json","../public/data/connecting-ridge-study.json"];
const studies = paths.map(path => JSON.parse(fs.readFileSync(new URL(path,import.meta.url),"utf8")));
const reports = [];
for (const study of studies) {
  validateStudyPayload(study);
  assert.equal(study.sourceManifest.verifiedDemSha256,study.sourceManifest.lola_dem.sha256);
  const cases = [];
  for (const height of study.supportedHeightsMeters) for (const day of [0,13]) {
    const dataset = {...study.dataset,provenance:{...study.dataset.provenance,observerMastHeightMeters:height},positions:study.dataset.positions.map(p => ({...p,horizon:{...p.horizon,horizonElevationDeg:study.heightProfiles[p.positionId][height.toFixed(1)]}}))};
    const window = selectStudyWindow(dataset,day*24,168);
    const result = analyzeDataset(window.dataset,window.windowEndUtc,analyze_json,profileParameters(0));
    assert.equal(result.positions.length,25);
    for (const p of result.positions) {
      assert.equal(p.sunVisible.length,168);
      assert.equal(p.energy.batterySocPct.length,168);
      assert.ok(p.energy.minimumSocPct >= 0 && p.energy.minimumSocPct <= 100);
    }
    const centre=result.positions.find(p => p.positionId==="0:0");
    cases.push({heightMeters:height,arrivalDay:day,sunFraction:centre.sunVisibleFraction,earthFraction:centre.earthVisibleFraction,continuousEarthHours:centre.longestEarthVisibleHours,darknessHours:centre.longestDarknessHours,minimumSocPct:centre.energy.minimumSocPct});
  }
  reports.push({datasetId:study.dataset.datasetId,sourceSha256:study.sourceManifest.lola_dem.sha256,centre:study.dataset.positions.find(p => p.positionId==="0:0").coordinates,cases});
}
assert.notEqual(reports[0].datasetId,reports[1].datasetId);
assert.notEqual(reports[0].sourceSha256,reports[1].sourceSha256);
const first=reports[0].centre,second=reports[1].centre;
const radians=v => v*Math.PI/180;
const cosine=Math.sin(radians(first.latDeg))*Math.sin(radians(second.latDeg))+Math.cos(radians(first.latDeg))*Math.cos(radians(second.latDeg))*Math.cos(radians(first.lonDeg-second.lonDeg));
const separationMeters=1737400*Math.acos(Math.min(1,Math.max(-1,cosine)));
assert.ok(separationMeters>5000,"Regions must be geographically distinct, not renamed points in one grid");
assert.notDeepEqual(studies[0].heightProfiles["0:0"],studies[1].heightProfiles["0:0"]);
fs.writeFileSync(new URL("../../docs/validation/region-checks.json",import.meta.url),JSON.stringify({status:"PASS",scope:"Actual compiled WASM across two separately sourced regions; not independent mission validation",separationMeters,positionWindows:600,reports},null,2)+"\n");
console.log(`Two-region actual WASM PASS: 600 position/windows across six heights and two arrivals; centres ${separationMeters.toFixed(0)} m apart.`);

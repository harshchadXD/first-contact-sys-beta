import { analyzeWithWasm } from '../src/services/wasmEngineBridge.ts';
import { getSiteById } from '../src/science/lunarData.ts';

async function main() {
  const site = getSiteById('PGDA-04');
  console.log('Testing WASM evaluation for Site 04...');
  const res = await analyzeWithWasm({
    site,
    dispersion_offset_m: { x: 0, y: 0 },
    arrival_day: 0,
    mast_height_m: 3.0,
    battery_capacity_wh: 2500,
    hotel_load_w: 120,
    slope_threshold_deg: 10.0
  });
  console.log('>>> WASM ANALYSIS SUCCESSFUL:', res);
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});

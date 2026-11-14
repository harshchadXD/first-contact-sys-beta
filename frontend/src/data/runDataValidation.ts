import { syntheticComparisonFixture } from './syntheticComparisonFixture.ts';
import { validateDataset } from './validateDataset.ts';
import type { LunarComparisonDataset } from '../types/lunarSite.ts';

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Assertion failed: expected ${String(expected)}, got ${String(actual)}`);
  }
}

console.log('=== Running Lunar Data Foundation Validation Checks ===\n');

// 1. Validate the canonical synthetic fixture
console.log('Test 1: Validating canonical syntheticComparisonFixture...');
const baselineReport = validateDataset(syntheticComparisonFixture);
assertStrictEqual(baselineReport.valid, true, `Baseline fixture failed validation: ${baselineReport.errors.join('; ')}`);
assertStrictEqual(baselineReport.errors.length, 0);
console.log('  ✓ syntheticComparisonFixture passed all validation checks.');
console.log(`    - Positions evaluated: ${syntheticComparisonFixture.positions.length}`);
console.log(`    - Ephemeris samples: ${syntheticComparisonFixture.ephemeris.timestampsUtc.length} hourly steps`);
console.log(`    - Horizon samples per position: ${syntheticComparisonFixture.positions[0].horizon.azimuthDeg.length} azimuth steps`);

// 2. Test rejection on non-increasing timestamps
console.log('\nTest 2: Testing rejection of non-increasing timestamps...');
const corruptTimestamps: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
corruptTimestamps.ephemeris.timestampsUtc[3] = corruptTimestamps.ephemeris.timestampsUtc[2]; // duplicate timestamp
const tsReport = validateDataset(corruptTimestamps);
assertStrictEqual(tsReport.valid, false);
assert(tsReport.errors.some((err) => err.includes('not strictly after previous timestamp')));
console.log('  ✓ Corrupt/duplicate timestamp properly rejected.');

// 3. Test rejection on mismatched array lengths
console.log('\nTest 3: Testing rejection of mismatched ephemeris array lengths...');
const corruptLengths: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
corruptLengths.ephemeris.sunAzimuthDeg.pop(); // remove one element
const lengthReport = validateDataset(corruptLengths);
assertStrictEqual(lengthReport.valid, false);
assert(lengthReport.errors.some((err) => err.includes('length') && err.includes('does not match')));
console.log('  ✓ Mismatched array length properly rejected.');

// 4. Test rejection of non-finite numbers (NaN)
console.log('\nTest 4: Testing rejection of non-finite numbers (NaN)...');
const corruptNumbers: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
corruptNumbers.ephemeris.sunElevationDeg[5] = Number.NaN;
const nanReport = validateDataset(corruptNumbers);
assertStrictEqual(nanReport.valid, false);
assert(nanReport.errors.some((err) => err.includes('not a finite number')));
console.log('  ✓ NaN angle properly rejected.');

// 5. Test rejection of angles outside supported ranges
console.log('\nTest 5: Testing rejection of out-of-range azimuth (>= 360°)...');
const corruptAngle: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
corruptAngle.ephemeris.sunAzimuthDeg[0] = 360.0;
const angleReport = validateDataset(corruptAngle);
assertStrictEqual(angleReport.valid, false);
assert(angleReport.errors.some((err) => err.includes('outside valid range')));
console.log('  ✓ Out-of-bounds azimuth properly rejected.');

// 6. Test rejection if a position lacks its own distinct horizon
console.log('\nTest 6: Testing rejection of positions with identical horizons...');
const identicalHorizons: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
identicalHorizons.positions[1].horizon = structuredClone(identicalHorizons.positions[0].horizon);
const horizonReport = validateDataset(identicalHorizons);
assertStrictEqual(horizonReport.valid, false);
assert(horizonReport.errors.some((err) => err.includes('must have different terrain horizons')));
console.log('  ✓ Identical horizons properly rejected.');

// 7. Test rejection of non-synthetic provenance fidelity label
console.log('\nTest 7: Testing rejection of non-synthetic provenance fidelity label...');
const invalidProvenance: LunarComparisonDataset = structuredClone(syntheticComparisonFixture);
// @ts-expect-error Testing invalid runtime value
invalidProvenance.provenance.dataFidelity = 'REAL_OBSERVED';
const provReport = validateDataset(invalidProvenance);
assertStrictEqual(provReport.valid, false);
assert(provReport.errors.some((err) => err.includes('Expected provenance.dataFidelity to be "SYNTHETIC"')));
console.log('  ✓ Invalid fidelity label properly rejected.');

console.log('\n=== All 7 Data Foundation Validation Tests Passed Successfully ===');

import type { LunarComparisonDataset, LunarPosition } from '../types/lunarSite.ts';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a LunarComparisonDataset instance:
 * 1. Provenance integrity (fidelity=SYNTHETIC, conventions, finite mast height)
 * 2. Ephemeris synchronized array lengths, finite numbers, strictly increasing timestamps, valid angles
 * 3. Multiple supported positions (at least 2), each with distinct local horizon profiles
 * 4. Horizon array matching lengths, valid azimuth [0, 360), elevation [-90, 90]
 */
export function validateDataset(dataset: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dataset || typeof dataset !== 'object') {
    return { valid: false, errors: ['Dataset must be a non-null object'], warnings };
  }

  const ds = dataset as LunarComparisonDataset;

  // 1. Provenance validation
  if (!ds.provenance) {
    errors.push('Missing provenance section');
  } else {
    if (ds.provenance.dataFidelity !== 'SYNTHETIC') {
      errors.push(`Expected provenance.dataFidelity to be "SYNTHETIC", got "${ds.provenance.dataFidelity}"`);
    }
    if (ds.provenance.coordinateConvention !== 'MOON_ME') {
      errors.push(`Expected coordinateConvention "MOON_ME", got "${ds.provenance.coordinateConvention}"`);
    }
    if (ds.provenance.angleUnits !== 'DEGREES') {
      errors.push(`Expected angleUnits "DEGREES", got "${ds.provenance.angleUnits}"`);
    }
    if (ds.provenance.distanceUnits !== 'METERS') {
      errors.push(`Expected distanceUnits "METERS", got "${ds.provenance.distanceUnits}"`);
    }
    if (
      typeof ds.provenance.observerMastHeightMeters !== 'number' ||
      !Number.isFinite(ds.provenance.observerMastHeightMeters) ||
      ds.provenance.observerMastHeightMeters <= 0
    ) {
      errors.push('provenance.observerMastHeightMeters must be a positive finite number');
    }
    if (!ds.provenance.generatedAtUtc || isNaN(Date.parse(ds.provenance.generatedAtUtc))) {
      errors.push('provenance.generatedAtUtc must be a valid ISO 8601 UTC timestamp string');
    }
  }

  // 2. Ephemeris time series validation
  if (!ds.ephemeris) {
    errors.push('Missing ephemeris section');
  } else {
    const { timestampsUtc, sunAzimuthDeg, sunElevationDeg, earthAzimuthDeg, earthElevationDeg } = ds.ephemeris;

    const arrays = [
      { name: 'timestampsUtc', arr: timestampsUtc },
      { name: 'sunAzimuthDeg', arr: sunAzimuthDeg },
      { name: 'sunElevationDeg', arr: sunElevationDeg },
      { name: 'earthAzimuthDeg', arr: earthAzimuthDeg },
      { name: 'earthElevationDeg', arr: earthElevationDeg },
    ];

    for (const item of arrays) {
      if (!Array.isArray(item.arr)) {
        errors.push(`ephemeris.${item.name} must be an array`);
      }
    }

    const len = timestampsUtc?.length ?? 0;
    if (len === 0) {
      errors.push('ephemeris arrays must contain at least 1 sample');
    } else {
      for (const item of arrays) {
        if (Array.isArray(item.arr) && item.arr.length !== len) {
          errors.push(`ephemeris.${item.name} length (${item.arr.length}) does not match timestampsUtc length (${len})`);
        }
      }

      // Check strictly increasing timestamps
      let prevEpoch = -Infinity;
      for (let i = 0; i < len; i++) {
        const ts = timestampsUtc[i];
        const epoch = Date.parse(ts);
        if (isNaN(epoch)) {
          errors.push(`ephemeris.timestampsUtc[${i}] ("${ts}") is not a valid ISO date string`);
        } else if (epoch <= prevEpoch) {
          errors.push(`ephemeris.timestampsUtc[${i}] ("${ts}") is not strictly after previous timestamp`);
        } else {
          prevEpoch = epoch;
        }
      }

      // Check angle ranges and finite numbers
      const checkAngleArray = (arr: number[] | undefined, name: string, min: number, max: number, exclusiveMax = false) => {
        if (!Array.isArray(arr)) return;
        for (let i = 0; i < arr.length; i++) {
          const val = arr[i];
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            errors.push(`ephemeris.${name}[${i}] is not a finite number: ${val}`);
            break;
          }
          const inRange = exclusiveMax ? val >= min && val < max : val >= min && val <= max;
          if (!inRange) {
            errors.push(`ephemeris.${name}[${i}] (${val}) is outside valid range [${min}, ${max}${exclusiveMax ? ')' : ']'}`);
            break;
          }
        }
      };

      checkAngleArray(sunAzimuthDeg, 'sunAzimuthDeg', 0, 360, true);
      checkAngleArray(earthAzimuthDeg, 'earthAzimuthDeg', 0, 360, true);
      checkAngleArray(sunElevationDeg, 'sunElevationDeg', -90, 90, false);
      checkAngleArray(earthElevationDeg, 'earthElevationDeg', -90, 90, false);
    }
  }

  // 3. Positions validation
  if (!Array.isArray(ds.positions) || ds.positions.length < 2) {
    errors.push('positions must be an array containing at least 2 distinct evaluation positions');
  } else {
    const positionIds = new Set<string>();

    for (let pIdx = 0; pIdx < ds.positions.length; pIdx++) {
      const pos = ds.positions[pIdx] as LunarPosition;
      const posPrefix = `positions[${pIdx}] (${pos?.positionId ?? 'unknown'})`;

      if (!pos || typeof pos !== 'object') {
        errors.push(`${posPrefix}: position must be an object`);
        continue;
      }

      if (!pos.positionId || typeof pos.positionId !== 'string') {
        errors.push(`${posPrefix}: missing or non-string positionId`);
      } else if (positionIds.has(pos.positionId)) {
        errors.push(`${posPrefix}: duplicate positionId "${pos.positionId}"`);
      } else {
        positionIds.add(pos.positionId);
      }

      // Coordinates
      if (!pos.coordinates) {
        errors.push(`${posPrefix}: missing coordinates`);
      } else {
        const { latDeg, lonDeg, elevationMeters, dxMeters, dyMeters } = pos.coordinates;
        if (!Number.isFinite(latDeg) || latDeg < -90 || latDeg > 90) {
          errors.push(`${posPrefix}: coordinates.latDeg (${latDeg}) must be finite and within [-90, 90]`);
        }
        if (!Number.isFinite(lonDeg) || lonDeg < -180 || lonDeg > 360) {
          errors.push(`${posPrefix}: coordinates.lonDeg (${lonDeg}) must be finite and within [-180, 360]`);
        }
        if (!Number.isFinite(elevationMeters)) {
          errors.push(`${posPrefix}: coordinates.elevationMeters must be a finite number`);
        }
        if (!Number.isFinite(dxMeters) || !Number.isFinite(dyMeters)) {
          errors.push(`${posPrefix}: coordinates dxMeters and dyMeters must be finite numbers`);
        }
      }

      // Horizon (each position must contain its own horizon)
      if (!pos.horizon) {
        errors.push(`${posPrefix}: missing horizon profile`);
      } else {
        const { azimuthDeg, horizonElevationDeg } = pos.horizon;
        if (!Array.isArray(azimuthDeg) || !Array.isArray(horizonElevationDeg)) {
          errors.push(`${posPrefix}: horizon azimuthDeg and horizonElevationDeg must be arrays`);
        } else if (azimuthDeg.length === 0) {
          errors.push(`${posPrefix}: horizon profile must not be empty`);
        } else if (azimuthDeg.length !== horizonElevationDeg.length) {
          errors.push(
            `${posPrefix}: horizon azimuthDeg length (${azimuthDeg.length}) does not match horizonElevationDeg length (${horizonElevationDeg.length})`
          );
        } else {
          for (let hIdx = 0; hIdx < azimuthDeg.length; hIdx++) {
            const az = azimuthDeg[hIdx];
            const el = horizonElevationDeg[hIdx];
            if (!Number.isFinite(az) || az < 0 || az >= 360) {
              errors.push(`${posPrefix}: horizon azimuth[${hIdx}] (${az}) must be finite and in [0, 360)`);
              break;
            }
            if (!Number.isFinite(el) || el < -90 || el > 90) {
              errors.push(`${posPrefix}: horizon elevation[${hIdx}] (${el}) must be finite and in [-90, 90]`);
              break;
            }
          }
        }
      }
    }

    // Verify that the positions do not have identical horizons (must have different horizons)
    if (ds.positions.length >= 2 && ds.positions[0]?.horizon && ds.positions[1]?.horizon) {
      const h0 = ds.positions[0].horizon.horizonElevationDeg;
      const h1 = ds.positions[1].horizon.horizonElevationDeg;
      if (h0 && h1 && h0.length === h1.length) {
        const identical = h0.every((val, idx) => val === h1[idx]);
        if (identical) {
          errors.push('positions[0] and positions[1] must have different terrain horizons');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

import type { LunarComparisonDataset } from '../types/lunarSite.ts';

export const syntheticComparisonFixture: LunarComparisonDataset = {
  datasetId: 'synthetic-mons-mouton-m1',
  siteName: 'Mons Mouton Synthetic Evaluation Slice',
  provenance: {
    dataFidelity: 'SYNTHETIC',
    generator: 'First Contact.sys synthetic test fixture generator v1',
    generatedAtUtc: '2026-11-14T12:00:00Z',
    coordinateConvention: 'MOON_ME',
    angleUnits: 'DEGREES',
    distanceUnits: 'METERS',
    observerMastHeightMeters: 2.0,
    notes:
      'Explicitly synthetic test fixture containing two lunar evaluation positions with distinct topographic horizons and synchronized 24-hour Sun/Earth topocentric ephemeris vectors.',
  },
  ephemeris: {
    timestampsUtc: [
      '2026-10-01T00:00:00Z',
      '2026-10-01T01:00:00Z',
      '2026-10-01T02:00:00Z',
      '2026-10-01T03:00:00Z',
      '2026-10-01T04:00:00Z',
      '2026-10-01T05:00:00Z',
      '2026-10-01T06:00:00Z',
      '2026-10-01T07:00:00Z',
      '2026-10-01T08:00:00Z',
      '2026-10-01T09:00:00Z',
      '2026-10-01T10:00:00Z',
      '2026-10-01T11:00:00Z',
      '2026-10-01T12:00:00Z',
      '2026-10-01T13:00:00Z',
      '2026-10-01T14:00:00Z',
      '2026-10-01T15:00:00Z',
      '2026-10-01T16:00:00Z',
      '2026-10-01T17:00:00Z',
      '2026-10-01T18:00:00Z',
      '2026-10-01T19:00:00Z',
      '2026-10-01T20:00:00Z',
      '2026-10-01T21:00:00Z',
      '2026-10-01T22:00:00Z',
      '2026-10-01T23:00:00Z',
    ],
    sunAzimuthDeg: [
      45.00, 45.51, 46.02, 46.53, 47.04, 47.55, 48.06, 48.57,
      49.08, 49.59, 50.10, 50.61, 51.12, 51.63, 52.14, 52.65,
      53.16, 53.67, 54.18, 54.69, 55.20, 55.71, 56.22, 56.73,
    ],
    sunElevationDeg: [
      1.42, 1.43, 1.43, 1.44, 1.45, 1.45, 1.46, 1.46,
      1.45, 1.45, 1.44, 1.43, 1.42, 1.41, 1.40, 1.39,
      1.38, 1.38, 1.39, 1.40, 1.41, 1.42, 1.43, 1.44,
    ],
    earthAzimuthDeg: [
      358.10, 358.11, 358.12, 358.13, 358.15, 358.16, 358.17, 358.18,
      358.20, 358.21, 358.22, 358.23, 358.25, 358.26, 358.27, 358.28,
      358.30, 358.31, 358.32, 358.33, 358.34, 358.35, 358.35, 358.36,
    ],
    earthElevationDeg: [
      4.12, 4.13, 4.13, 4.14, 4.15, 4.15, 4.16, 4.17,
      4.17, 4.18, 4.18, 4.19, 4.20, 4.20, 4.21, 4.21,
      4.22, 4.22, 4.21, 4.21, 4.20, 4.20, 4.19, 4.18,
    ],
  },
  positions: [
    {
      positionId: 'pos_alpha',
      label: 'Plateau Point A',
      description: 'Elevated plateau terrain with low horizon obstruction.',
      coordinates: {
        latDeg: -84.7906,
        lonDeg: 29.1957,
        elevationMeters: 5420.0,
        dxMeters: 0.0,
        dyMeters: 0.0,
      },
      horizon: {
        azimuthDeg: [
          0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
          100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
          200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
          300, 310, 320, 330, 340, 350,
        ],
        horizonElevationDeg: [
          1.15, 1.20, 1.25, 1.30, 1.25, 1.20, 1.18, 1.22, 1.35, 1.40,
          1.45, 1.38, 1.30, 1.22, 1.15, 1.10, 1.12, 1.18, 1.25, 1.30,
          1.35, 1.42, 1.50, 1.55, 1.48, 1.40, 1.32, 1.25, 1.20, 1.18,
          1.15, 1.12, 1.10, 1.12, 1.14, 1.15,
        ],
      },
    },
    {
      positionId: 'pos_beta',
      label: 'Depression Point B',
      description: 'Depression offset location flanked by prominent crater rim ridges.',
      coordinates: {
        latDeg: -84.7942,
        lonDeg: 29.2012,
        elevationMeters: 5380.0,
        dxMeters: 200.0,
        dyMeters: -200.0,
      },
      horizon: {
        azimuthDeg: [
          0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
          100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
          200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
          300, 310, 320, 330, 340, 350,
        ],
        horizonElevationDeg: [
          2.10, 2.50, 3.20, 4.10, 4.85, 5.20, 4.95, 4.30, 3.50, 2.80,
          2.20, 1.90, 1.70, 1.65, 1.80, 2.10, 2.80, 3.40, 3.80, 3.60,
          3.10, 2.60, 2.20, 1.90, 1.75, 1.65, 1.60, 1.65, 1.70, 1.80,
          1.85, 1.90, 1.95, 2.00, 2.05, 2.10,
        ],
      },
    },
  ],
};

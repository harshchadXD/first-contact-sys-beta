export interface ScenePoint {
  id: string;
  eastMeters: number;
  northMeters: number;
  elevationMeters: number | null;
  slopeDeg: number | null;
}

export interface TerrainGrid {
  columns: number;
  rows: number;
  spacingMeters: number;
  referenceElevationMeters: number;
  elevationsMeters: number[];
  gridNorthLongitudeDeg?: number;
}

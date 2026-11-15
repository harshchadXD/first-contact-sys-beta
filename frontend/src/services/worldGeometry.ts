/** Display coordinates: east +X, up +Y, geographic north -Z. */
export function skyDirection(
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180,
    el = (elevationDeg * Math.PI) / 180;
  return [
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el),
  ];
}

/** Matches a longitude-centred NASA equirectangular map on Three.js SphereGeometry. */
export function globePosition(
  latDeg: number,
  lonDeg: number,
  radius: number,
): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180,
    lon = (lonDeg * Math.PI) / 180;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}

export function skylineAt(
  azimuthDeg: number,
  azimuths: number[],
  elevations: number[],
): number {
  const az = ((azimuthDeg % 360) + 360) % 360;
  const next = azimuths.findIndex((value) => value > az);
  const a =
    next === -1
      ? azimuths.length - 1
      : (next - 1 + azimuths.length) % azimuths.length;
  const b = (a + 1) % azimuths.length;
  const start = azimuths[a],
    end = azimuths[b] + (b === 0 ? 360 : 0);
  const angle = az < start ? az + 360 : az;
  return (
    elevations[a] +
    ((elevations[b] - elevations[a]) * (angle - start)) / (end - start)
  );
}

/** Bilinear display-height lookup in the polar grid, with geographic offsets as input. */
export function terrainHeightAt(
  terrain: {
    columns: number;
    rows: number;
    spacingMeters: number;
    elevationsMeters: number[];
    gridNorthLongitudeDeg?: number;
  },
  east: number,
  north: number,
): number | null {
  const longitude = ((terrain.gridNorthLongitudeDeg ?? 0) * Math.PI) / 180;
  const col =
    (east * Math.cos(longitude) + north * Math.sin(longitude)) /
      terrain.spacingMeters +
    Math.floor(terrain.columns / 2);
  const row =
    -(-east * Math.sin(longitude) + north * Math.cos(longitude)) /
      terrain.spacingMeters +
    Math.floor(terrain.rows / 2);
  if (col < 0 || row < 0 || col > terrain.columns - 1 || row > terrain.rows - 1)
    return null;
  const c = Math.min(Math.floor(col), terrain.columns - 2),
    r = Math.min(Math.floor(row), terrain.rows - 2),
    x = col - c,
    y = row - r;
  const at = (rr: number, cc: number) =>
    terrain.elevationsMeters[rr * terrain.columns + cc];
  return (
    (1 - y) * ((1 - x) * at(r, c) + x * at(r, c + 1)) +
    y * ((1 - x) * at(r + 1, c) + x * at(r + 1, c + 1))
  );
}
/** Break recorded tracks at the north seam instead of drawing a false full-width segment. */
export function recordedSkyTrack(
  azimuths: number[],
  elevations: number[],
  x: (v: number) => number,
  y: (v: number) => number,
): string {
  return azimuths
    .map(
      (az, i) =>
        `${!i || Math.abs(az - azimuths[i - 1]) > 180 ? "M" : "L"}${x(az)},${y(elevations[i])}`,
    )
    .join(" ");
}

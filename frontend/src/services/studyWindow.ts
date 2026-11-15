import type {
  LunarComparisonDataset,
  EphemerisTimeSeries,
} from "../types/lunarSite.ts";

/** Uses an actual recorded endpoint, never an inferred final sample duration. */
export function selectStudyWindow(
  dataset: LunarComparisonDataset,
  startHour: number,
  durationHours: number,
) {
  if (
    !Number.isInteger(startHour) ||
    startHour < 0 ||
    !Number.isInteger(durationHours) ||
    durationHours <= 0 ||
    startHour + durationHours >= dataset.ephemeris.timestampsUtc.length
  ) {
    throw new Error(
      "The requested window requires positive integer hours and a recorded exclusive endpoint.",
    );
  }
  const end = startHour + durationHours;
  const slice = (series: EphemerisTimeSeries) =>
    Object.fromEntries(
      Object.entries(series).map(([key, values]) => [
        key,
        values.slice(startHour, end),
      ]),
    ) as unknown as EphemerisTimeSeries;
  const ephemeris = slice(dataset.ephemeris);
  const times = dataset.ephemeris.timestampsUtc;
  if (
    Date.parse(times[end]) - Date.parse(times[startHour]) !==
      durationHours * 3600_000 ||
    ephemeris.timestampsUtc.some(
      (t, i) => Date.parse(t) !== Date.parse(times[startHour]) + i * 3600_000,
    )
  ) {
    throw new Error(
      "Arrival search requires an hourly ephemeris series without gaps.",
    );
  }
  const positions = dataset.positions.map((p) =>
    p.ephemeris ? { ...p, ephemeris: slice(p.ephemeris) } : p,
  );
  return {
    dataset: { ...dataset, ephemeris, positions },
    windowEndUtc: times[end],
  };
}

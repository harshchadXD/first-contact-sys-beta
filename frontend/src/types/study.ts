import type originalStudy from "../data/shackletonStudy.json";
import type { EnergyParameters } from "../services/energyProfiles";

export type RegionId = "shackleton" | "connecting-ridge";
export type PreparedStudy = Omit<typeof originalStudy, "sourceManifest"> & {
  sourceManifest: Omit<typeof originalStudy.sourceManifest, "originalBake">;
  heightProfiles: Record<string, Record<string, number[]>>;
};
export interface SavedView {
  regionId: RegionId;
  label: string;
  sun: number;
  earth: number;
  dark: number;
  assumptions: string;
  durationDays: number;
  positionId: string;
  arrivalDay: number;
  height: number;
  hour: number;
  parameters: EnergyParameters;
  profileIndex: number;
  limits: {
    maxDarknessHours: number;
    minEarthVisibleHours: number;
    reserve: number;
    slopeLimit: number;
  };
}

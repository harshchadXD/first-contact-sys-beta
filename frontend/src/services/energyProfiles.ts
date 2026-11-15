export interface EnergyParameters {
  usableBatteryWh: number;
  initialSocFraction: number;
  solarRatedW: number;
  hotelLoadW: number;
  transmitterLoadW: number;
  panelTiltDeg: number;
  panelAzimuthDeg: number;
  trackSunAzimuth: boolean;
  albedo: number;
  emissivity: number;
  backgroundHeatFluxWM2: number;
}

/** Exploratory presets only: these are not sourced spacecraft specifications. */
export const energyProfiles = [
  {
    id: "nova-c",
    name: "Nova-C",
    usableBatteryWh: 2500,
    solarRatedW: 520,
    hotelLoadW: 120,
    transmitterLoadW: 95,
  },
  {
    id: "griffin",
    name: "Griffin",
    usableBatteryWh: 5000,
    solarRatedW: 780,
    hotelLoadW: 280,
    transmitterLoadW: 130,
  },
  {
    id: "blue-ghost",
    name: "Blue Ghost",
    usableBatteryWh: 3200,
    solarRatedW: 620,
    hotelLoadW: 160,
    transmitterLoadW: 110,
  },
  {
    id: "vikram",
    name: "Vikram",
    usableBatteryWh: 1800,
    solarRatedW: 410,
    hotelLoadW: 100,
    transmitterLoadW: 75,
  },
];

export function profileParameters(index: number): EnergyParameters {
  const profile = energyProfiles[index];
  if (!profile) throw new Error("Unknown illustrative hardware preset");
  return {
    ...profile,
    initialSocFraction: 1,
    panelTiltDeg: 90,
    panelAzimuthDeg: 90,
    trackSunAzimuth: true,
    albedo: 0.12,
    emissivity: 0.95,
    backgroundHeatFluxWM2: 0.02,
  };
}

/** Recorded exploratory cases in this Shackleton dataset, not historical mission replays. */
export const scenarioPresets = [
  {
    id: "ground",
    name: "Earth behind the skyline",
    description:
      "1 December, ground level. Plenty of sunlight does not guarantee a view of Earth.",
    positionId: "0:0",
    arrivalDay: 0,
    height: 0,
  },
  {
    id: "height",
    name: "A higher viewpoint",
    description:
      "Same place and dates, 5 m observer. Inspect how the supported-height skyline changes.",
    positionId: "0:0",
    arrivalDay: 0,
    height: 5,
  },
  {
    id: "date",
    name: "A different arrival",
    description:
      "14 December, 2 m observer. Compare the same seven-day duration at a later date.",
    positionId: "0:0",
    arrivalDay: 13,
    height: 2,
  },
  {
    id: "slope",
    name: "Light is not the only limit",
    description:
      "A nearby steep point. Check slope alongside light, Earth visibility and battery needs.",
    positionId: "-200:-200",
    arrivalDay: 13,
    height: 2,
  },
] as const;

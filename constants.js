// Constants and configuration
export const MIN_SPEED = 25;
export const MIN_ALT = 29;
export const PX_TO_NM = 0.1;

export const AIRCRAFT_TYPES = {
  A320: { type: "A320", maxSpeed: 46, maxAlt: 41 },
  B744: { type: "B744", maxSpeed: 51, maxAlt: 45 },
  B738: { type: "B738", maxSpeed: 48, maxAlt: 41 },
  G5: { type: "G5", maxSpeed: 55, maxAlt: 51 },
};

export const CALLSIGN_OPERATORS = [
  "AAL",
  "ACA",
  "BAW",
  "DLH",
  "JAL",
  "UPS",
  "FDX",
  "WJA",
  "MAL",
];

export const DIFFICULTIES = ["easy", "medium", "hard"];
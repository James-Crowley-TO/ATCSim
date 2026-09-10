// Shared configuration for the ATC problem-solving trainer.

export const NM_PER_PIXEL = 0.1;
export const RADAR_PADDING_PX = 56;

export const HORIZONTAL_SEPARATION_NM = 5;
export const VERTICAL_SEPARATION_FT = 1000;
export const CONFLICT_SAMPLE_MINUTES = 0.05;

export const HISTORY_DOTS = 4;
export const HISTORY_INTERVAL_MINUTES = 0.2;
export const DEFAULT_PTL_MINUTES = 3;
export const DEFAULT_HALO_NM = 5;
export const OFFSCREEN_TRAFFIC_CHANCE = 0.16;
export const OFFSCREEN_MARGIN_RATIO = 0.42;
export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 2.6;

// Simplified performance envelopes. They are intentionally approximate: the
// application is a conflict-recognition exercise, not an aircraft performance model.
export const AIRCRAFT_TYPES = {
  B744: { minSpeedKts: 390, maxSpeedKts: 510, maxFlightLevel: 450, maxVerticalRateFpm: 2000 },
  A333: { minSpeedKts: 370, maxSpeedKts: 490, maxFlightLevel: 410, maxVerticalRateFpm: 2200 },
  B763: { minSpeedKts: 350, maxSpeedKts: 470, maxFlightLevel: 430, maxVerticalRateFpm: 2500 },
  A343: { minSpeedKts: 360, maxSpeedKts: 470, maxFlightLevel: 410, maxVerticalRateFpm: 2000 },
  GLF5: { minSpeedKts: 380, maxSpeedKts: 500, maxFlightLevel: 510, maxVerticalRateFpm: 3000 },
  CRJ9: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  B738: { minSpeedKts: 320, maxSpeedKts: 470, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  E190: { minSpeedKts: 300, maxSpeedKts: 450, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  A320: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2300 },
  DH8C: { minSpeedKts: 180, maxSpeedKts: 270, maxFlightLevel: 250, maxVerticalRateFpm: 1300 },
  DH8D: { minSpeedKts: 200, maxSpeedKts: 360, maxFlightLevel: 250, maxVerticalRateFpm: 2000 },
  B190: { minSpeedKts: 170, maxSpeedKts: 280, maxFlightLevel: 250, maxVerticalRateFpm: 1500 },
  SW4: { minSpeedKts: 160, maxSpeedKts: 260, maxFlightLevel: 250, maxVerticalRateFpm: 1200 },
  C208: { minSpeedKts: 140, maxSpeedKts: 185, maxFlightLevel: 250, maxVerticalRateFpm: 700 },
  BE9L: { minSpeedKts: 160, maxSpeedKts: 250, maxFlightLevel: 300, maxVerticalRateFpm: 1200 },
  PC12: { minSpeedKts: 180, maxSpeedKts: 285, maxFlightLevel: 300, maxVerticalRateFpm: 1200 },
  C550: { minSpeedKts: 280, maxSpeedKts: 420, maxFlightLevel: 430, maxVerticalRateFpm: 1800 },
  PA31: { minSpeedKts: 150, maxSpeedKts: 230, maxFlightLevel: 240, maxVerticalRateFpm: 900 },
};

export const FLIGHT_LEVELS = [
  180, 190, 200, 210, 220, 230, 240, 250, 260, 270,
  280, 290, 300, 310, 320, 330, 340, 350, 360, 370,
  380, 390, 400, 410, 430, 450,
];

export const CALLSIGN_OPERATORS = [
  "AAL", "ACA", "BAW", "CAV", "CFC", "DAL", "DLH", "EIN", "FDX",
  "JAL", "JZA", "KAL", "ROU", "TGO", "UPS", "WJA",
];

export const DIFFICULTIES = ["easy", "medium", "hard"];

export const DIFFICULTY_CONFIG = {
  easy: {
    aircraftRange: [4, 6],
    conflictPairs: 1,
    lookaheadMinutes: 15,
    conflictTimeRange: [10, 15],
    crossingAngleRange: [30, 150],
    verticalTrafficChance: 0.25,
  },
  medium: {
    aircraftRange: [12, 16],
    conflictPairs: 3,
    lookaheadMinutes: 20,
    conflictTimeRange: [10, 20],
    crossingAngleRange: [15, 160],
    verticalTrafficChance: 0.4,
  },
  hard: {
    aircraftRange: [24, 30],
    conflictPairs: 6,
    lookaheadMinutes: 30,
    conflictTimeRange: [10, 30],
    crossingAngleRange: [5, 175],
    verticalTrafficChance: 0.55,
  },
};

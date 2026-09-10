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
  // Boeing airliners
  B737: { minSpeedKts: 310, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  B739: { minSpeedKts: 320, maxSpeedKts: 470, maxFlightLevel: 410, maxVerticalRateFpm: 2300 },
  B38M: { minSpeedKts: 320, maxSpeedKts: 470, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  B752: { minSpeedKts: 340, maxSpeedKts: 480, maxFlightLevel: 420, maxVerticalRateFpm: 3000 },
  B77L: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2500 },
  B77W: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2300 },
  B788: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2500 },
  B789: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2500 },
  B748: { minSpeedKts: 390, maxSpeedKts: 520, maxFlightLevel: 430, maxVerticalRateFpm: 2200 },

  // Airbus airliners
  A319: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 390, maxVerticalRateFpm: 2500 },
  A321: { minSpeedKts: 310, maxSpeedKts: 470, maxFlightLevel: 390, maxVerticalRateFpm: 2200 },
  A20N: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 390, maxVerticalRateFpm: 2500 },
  A21N: { minSpeedKts: 310, maxSpeedKts: 470, maxFlightLevel: 390, maxVerticalRateFpm: 2300 },
  A332: { minSpeedKts: 370, maxSpeedKts: 490, maxFlightLevel: 410, maxVerticalRateFpm: 2400 },
  A359: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2500 },
  A35K: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 410, maxVerticalRateFpm: 2300 },
  A388: { minSpeedKts: 380, maxSpeedKts: 510, maxFlightLevel: 430, maxVerticalRateFpm: 2000 },

  // A220 and regional jets
  BCS1: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2700 },
  BCS3: { minSpeedKts: 300, maxSpeedKts: 470, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  CRJ2: { minSpeedKts: 280, maxSpeedKts: 430, maxFlightLevel: 410, maxVerticalRateFpm: 2000 },
  CRJ7: { minSpeedKts: 300, maxSpeedKts: 450, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  CRJX: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2300 },
  E145: { minSpeedKts: 280, maxSpeedKts: 430, maxFlightLevel: 370, maxVerticalRateFpm: 2200 },
  E170: { minSpeedKts: 290, maxSpeedKts: 450, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  E175: { minSpeedKts: 290, maxSpeedKts: 450, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  E195: { minSpeedKts: 300, maxSpeedKts: 450, maxFlightLevel: 410, maxVerticalRateFpm: 2300 },
  E295: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },

  // Business jets
  CL35: { minSpeedKts: 330, maxSpeedKts: 470, maxFlightLevel: 450, maxVerticalRateFpm: 3000 },
  CL60: { minSpeedKts: 320, maxSpeedKts: 460, maxFlightLevel: 410, maxVerticalRateFpm: 2500 },
  GLEX: { minSpeedKts: 370, maxSpeedKts: 500, maxFlightLevel: 510, maxVerticalRateFpm: 3000 },
  GLF6: { minSpeedKts: 380, maxSpeedKts: 530, maxFlightLevel: 510, maxVerticalRateFpm: 3500 },
  FA7X: { minSpeedKts: 350, maxSpeedKts: 500, maxFlightLevel: 510, maxVerticalRateFpm: 3000 },
  C56X: { minSpeedKts: 300, maxSpeedKts: 440, maxFlightLevel: 450, maxVerticalRateFpm: 2500 },
  C750: { minSpeedKts: 370, maxSpeedKts: 530, maxFlightLevel: 510, maxVerticalRateFpm: 3500 },
  E55P: { minSpeedKts: 280, maxSpeedKts: 450, maxFlightLevel: 450, maxVerticalRateFpm: 3000 },
  LJ45: { minSpeedKts: 300, maxSpeedKts: 460, maxFlightLevel: 510, maxVerticalRateFpm: 3000 },

  // Turboprops
  AT43: { minSpeedKts: 170, maxSpeedKts: 280, maxFlightLevel: 250, maxVerticalRateFpm: 1500 },
  AT76: { minSpeedKts: 180, maxSpeedKts: 280, maxFlightLevel: 250, maxVerticalRateFpm: 1500 },
  DH8A: { minSpeedKts: 170, maxSpeedKts: 250, maxFlightLevel: 250, maxVerticalRateFpm: 1500 },
  SF34: { minSpeedKts: 180, maxSpeedKts: 280, maxFlightLevel: 250, maxVerticalRateFpm: 1500 },
  BE20: { minSpeedKts: 180, maxSpeedKts: 290, maxFlightLevel: 350, maxVerticalRateFpm: 1800 },
  BE30: { minSpeedKts: 190, maxSpeedKts: 310, maxFlightLevel: 350, maxVerticalRateFpm: 2000 },
  TBM9: { minSpeedKts: 200, maxSpeedKts: 330, maxFlightLevel: 310, maxVerticalRateFpm: 2000 },
  P180: { minSpeedKts: 230, maxSpeedKts: 400, maxFlightLevel: 410, maxVerticalRateFpm: 2200 },
};

export const FLIGHT_LEVELS = [
  180, 190, 200, 210, 220, 230, 240, 250, 260, 270,
  280, 290, 300, 310, 320, 330, 340, 350, 360, 370,
  380, 390, 400, 410, 430, 450,
];

export const CALLSIGN_OPERATORS = [
  // Canadian
  "ACA", "JZA", "ROU", "WJA", "WEN", "POE", "TSC", "FLE",
  "JBO", "CJT", "BFL", "MPE", "AKT", "CAV", "CFC", "TGO",

  // United States
  "AAL", "DAL", "UAL", "SWA", "JBU", "ASA", "FFT", "NKS",
  "AAY", "SKW", "RPA", "ENY", "EDV", "JIA", "EJA",

  // Europe
  "BAW", "VIR", "AFR", "KLM", "DLH", "SWR", "AUA", "BEL",
  "EIN", "IBE", "TAP", "LOT", "SAS", "FIN", "ICE", "THY",

  // Asia, Middle East, and Oceania
  "JAL", "ANA", "KAL", "AAR", "CPA", "EVA", "CAL", "SIA",
  "CCA", "CES", "CSN", "AIC", "UAE", "ETD", "QTR", "SVA",
  "QFA", "ANZ",

  // Latin America and Africa
  "AMX", "CMP", "AVA", "LAN", "TAM", "ETH", "MSR", "RAM",

  // Cargo
  "FDX", "UPS", "GTI", "PAC", "ABX", "ATN", "CLX", "BOX",
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

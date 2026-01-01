// Constants and configuration
export const MIN_SPEED = 25;
export const MIN_ALT = 29;
export const PX_TO_NM = 0.1;

export const AIRCRAFT_TYPES = {
  B744: { type: "B744", maxSpeed: 51, maxAlt: 45 , climb: 15 },
  A333: { type: "A333", maxSpeed: 49, maxAlt: 41 , climb: 20 },
  B763: { type: "B763", maxSpeed: 47, maxAlt: 45 , climb: 25 },
  A343: { type: "A343", maxSpeed: 46, maxAlt: 41 , climb: 15 },
  GLF5: { type: "GLF5", maxSpeed: 48, maxAlt: 51 , climb: 30 },
  CRJ9: { type: "CRJ9", maxSpeed: 46, maxAlt: 41 , climb: 25 },
  B738: { type: "B738", maxSpeed: 46, maxAlt: 41 , climb: 25 },
  E190: { type: "E190", maxSpeed: 45, maxAlt: 41 , climb: 25 },
  A320: { type: "A320", maxSpeed: 45, maxAlt: 41 , climb: 20 },
  DH8C: { type: "DH8C", maxSpeed: 27, maxAlt: 25 , climb: 13 },
  DH8D: { type: "DH8D", maxSpeed: 38, maxAlt: 25 , climb: 20 },
  B190: { type: "B190", maxSpeed: 28, maxAlt: 25 , climb: 15 },
  SW4 : { type: "SW4" , maxSpeed: 26, maxAlt: 25 , climb: 11 },
  C208: { type: "C208", maxSpeed: 17, maxAlt: 26 , climb: 6  },
  BE9L: { type: "BE9L", maxSpeed: 22, maxAlt: 29 , climb: 12 },
  PC12: { type: "PC12", maxSpeed: 26, maxAlt: 30 , climb: 10 },
  C550: { type: "C550", maxSpeed: 39, maxAlt: 43 , climb: 16 },
  PA31: { type: "PA31", maxSpeed: 19, maxAlt: 24 , climb: 8  },
};

export const CALLSIGN_OPERATORS = [
  "AAL",
  "ACA",
  "BAW",
  "CAV",
  "CFC",
  "CME",
  "CRQ",
  "DAL",
  "DLH",
  "EGF",
  "EIN",
  "FAB",
  "FDX",
  "GGN",
  "JAL",
  "JZA",
  "KAL",
  "KEE",
  "MAL",
  "MAX",
  "MES",
  "MPE",
  "PAG",
  "PCO",
  "POE",
  "ROU",
  "SLQ",
  "TGO",
  "UPS",
  "WEN",
  "WEW",
  "WJA",
];

export const DIFFICULTIES = ["easy", "medium", "hard"];
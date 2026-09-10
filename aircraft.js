import { AIRCRAFT_TYPES, CALLSIGN_OPERATORS, FLIGHT_LEVELS } from "./constants.js";
import { createId, nmToPx, normalizeHeading, randomBetween, randomChoice, randomInt, randomLetters } from "./utils.js";

function generateRegistration() {
  if (Math.random() < 0.7) return `C${randomChoice(["F", "G"])}${randomLetters(3)}`;
  const suffix = Math.random() < 0.55 ? randomLetters(randomInt(1, 2)) : "";
  return `N${randomInt(1, 999)}${suffix}`;
}
export function generateCallsign() {
  if (Math.random() < 0.12) return generateRegistration();

  const roll = Math.random();
  const number = roll < 0.8
    ? randomInt(100, 999)
    : roll < 0.9
      ? randomInt(10, 99)
      : randomInt(1000, 9999);

  return `${randomChoice(CALLSIGN_OPERATORS)}${number}`;
}
function compatibleAircraftTypes({ aircraftType, speedKts, flightLevel }) {
  return Object.entries(AIRCRAFT_TYPES).filter(([type, data]) =>
    (aircraftType === undefined || type === aircraftType) &&
    (speedKts === undefined || (speedKts >= data.minSpeedKts && speedKts <= data.maxSpeedKts)) &&
    (flightLevel === undefined || (flightLevel >= FLIGHT_LEVELS[0] && flightLevel <= data.maxFlightLevel))
  ).map(([type]) => type);
}

// Random vertical traffic reverses direction at the floor/ceiling if necessary.
export function assignVerticalClearance(aircraft, requestedRate) {
  const model = AIRCRAFT_TYPES[aircraft.aircraftType];
  if (!Number.isFinite(requestedRate) || Math.abs(requestedRate) > model.maxVerticalRateFpm) {
    throw new Error("Vertical rate exceeds the simplified aircraft envelope");
  }
  aircraft.verticalRateFpm = requestedRate;
  if (requestedRate === 0) {
    aircraft.clearedFlightLevel = aircraft.flightLevel;
    return aircraft;
  }
  const allowed = FLIGHT_LEVELS.filter(level => level <= model.maxFlightLevel && level !== aircraft.flightLevel);
  let candidates = allowed.filter(level => (level - aircraft.flightLevel) * requestedRate > 0);
  if (!candidates.length) {
    aircraft.verticalRateFpm = -requestedRate;
    candidates = allowed.filter(level => (level - aircraft.flightLevel) * aircraft.verticalRateFpm > 0);
  }
  const nearby = candidates.filter(level => Math.abs(level - aircraft.flightLevel) <= 60);
  aircraft.clearedFlightLevel = randomChoice(nearby.length ? nearby : candidates);
  return aircraft;
}

export function createAircraft(bounds, pad, overrides = {}) {
  const candidates = compatibleAircraftTypes(overrides);
  if (!candidates.length) throw new Error("No aircraft type satisfies the requested constraints");
  const aircraftType = overrides.aircraftType ?? randomChoice(candidates);
  const data = AIRCRAFT_TYPES[aircraftType];
  const aircraft = {
    id: createId(), callsign: overrides.callsign ?? generateCallsign(), aircraftType,
    speedKts: overrides.speedKts ?? Math.round(randomBetween(data.minSpeedKts, data.maxSpeedKts)),
    flightLevel: overrides.flightLevel ?? randomChoice(FLIGHT_LEVELS.filter(level => level <= data.maxFlightLevel)),
    heading: normalizeHeading(overrides.heading ?? randomBetween(0, 360)),
    x: overrides.x ?? randomBetween(pad, bounds.width - pad),
    y: overrides.y ?? randomBetween(pad, bounds.height - pad),
  };
  const randomRate = () => Math.random() < 0.12
    ? (Math.random() < 0.5 ? -1 : 1) * Math.round(randomBetween(500, data.maxVerticalRateFpm) / 100) * 100 : 0;
  const rate = overrides.verticalRateFpm ?? randomRate();
  assignVerticalClearance(aircraft, rate);
  if (overrides.verticalRateFpm !== undefined && aircraft.verticalRateFpm !== rate) {
    throw new Error("Requested vertical direction has no reachable cleared flight level");
  }
  if (overrides.clearedFlightLevel !== undefined) {
    const cleared = overrides.clearedFlightLevel;
    if (!Number.isInteger(cleared) || cleared < FLIGHT_LEVELS[0] || cleared > data.maxFlightLevel ||
      (rate === 0 ? cleared !== aircraft.flightLevel : (cleared - aircraft.flightLevel) * rate <= 0)) {
      throw new Error("Cleared flight level must be reachable in the assigned vertical direction");
    }
    aircraft.clearedFlightLevel = cleared;
  }
  return aircraft;
}

// Shared rows keep the radar and flight-strip clearance/state presentation equal.
export function aircraftTagRows(aircraft) {
  if (!isAircraftComplete(aircraft)) return [
    { text: aircraft.callsign || "NEW AIRCRAFT", kind: "callsign" },
    { text: "INCOMPLETE", kind: "state" },
    { text: aircraft.aircraftType || "No flight strip", kind: "type" },
  ];
  const rows = [];
  if (aircraft.verticalRateFpm !== 0) rows.push({ text: String(aircraft.clearedFlightLevel), kind: "clearance" });
  rows.push({ text: aircraft.callsign, kind: "callsign" });
  const trend = aircraft.verticalRateFpm === 0 ? "" :
    ` ${aircraft.verticalRateFpm > 0 ? "↑" : "↓"}${Math.round(Math.abs(aircraft.verticalRateFpm) / 100)}`;
  const speedCode = String(Math.round(aircraft.speedKts / 10)).padStart(2, "0");
  rows.push({ text: `${aircraft.flightLevel}${trend} ${speedCode}`, kind: "state" });
  rows.push({ text: aircraft.aircraftType, kind: "type" });
  return rows;
}

export const AIRCRAFT_FIELDS = ["callsign", "aircraftType", "x", "y", "heading", "speedKts", "flightLevel", "verticalRateFpm", "clearedFlightLevel"];

export function isAircraftComplete(aircraft) {
  return Boolean(aircraft.callsign && AIRCRAFT_TYPES[aircraft.aircraftType]) &&
    AIRCRAFT_FIELDS.slice(2).every(key => Number.isFinite(aircraft[key]));
}

export function createAircraftDraft(point) {
  return {
    id: createId(), callsign: "", aircraftType: "", x: point.x, y: point.y,
    heading: null, speedKts: null, flightLevel: null, verticalRateFpm: 0, clearedFlightLevel: null
  };
}

// Accept partially specified traffic without inventing operational values.
// A level aircraft's clearance is derived; all other identifiers/derived displays
// are deliberately absent from the editable field whitelist.
export function validateAircraftInput(input, original, otherAircraft = []) {
  const aircraft = { ...original };
  const errors = {};
  aircraft.callsign = String(input.callsign ?? "").trim().toUpperCase();
  aircraft.aircraftType = String(input.aircraftType ?? "").trim().toUpperCase();
  if (aircraft.callsign && !/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(aircraft.callsign)) {
    errors.callsign = "Use 1–16 letters, digits or hyphens, starting with a letter or digit.";
  }
  if (aircraft.callsign && otherAircraft.some(item => item.id !== original.id && item.callsign === aircraft.callsign)) {
    errors.callsign = "Another aircraft already uses this callsign.";
  }
  const model = AIRCRAFT_TYPES[aircraft.aircraftType];
  if (aircraft.aircraftType && !model) errors.aircraftType = "Choose a supported aircraft type.";
  for (const key of AIRCRAFT_FIELDS.slice(2)) {
    const text = String(input[key] ?? "").trim();
    aircraft[key] = text === "" ? null : Number(text);
    if (text && !Number.isFinite(aircraft[key])) errors[key] = "Enter a finite number.";
  }
  for (const key of ["x", "y"]) if (aircraft[key] === null) errors[key] = "Position is required (NM).";
  const check = (key, min, max, integer = false) => {
    const value = aircraft[key];
    if (value !== null && (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))) {
      errors[key] = `Enter ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`;
    }
  };
  check("heading", 0, 360);
  check("speedKts", model?.minSpeedKts ?? 1, model?.maxSpeedKts ?? 2000);
  check("flightLevel", FLIGHT_LEVELS[0], model?.maxFlightLevel ?? 510, true);
  check("verticalRateFpm", -(model?.maxVerticalRateFpm ?? 10000), model?.maxVerticalRateFpm ?? 10000, true);
  if (aircraft.verticalRateFpm === 0) aircraft.clearedFlightLevel = aircraft.flightLevel;
  else {
    check("clearedFlightLevel", FLIGHT_LEVELS[0], model?.maxFlightLevel ?? 510, true);
    if (Number.isFinite(aircraft.flightLevel) && Number.isFinite(aircraft.clearedFlightLevel) &&
      Number.isFinite(aircraft.verticalRateFpm) && (aircraft.clearedFlightLevel - aircraft.flightLevel) * aircraft.verticalRateFpm <= 0) {
      errors.clearedFlightLevel = "Clearance must be above a climbing aircraft or below a descending aircraft.";
    }
  }
  if (Number.isFinite(aircraft.heading)) aircraft.heading = normalizeHeading(aircraft.heading);
  // The editor presents NM; the established aircraft model stores world pixels.
  aircraft.x = nmToPx(aircraft.x);
  aircraft.y = nmToPx(aircraft.y);
  return { aircraft, errors, valid: Object.keys(errors).length === 0 };
}

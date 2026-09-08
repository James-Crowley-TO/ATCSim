import { AIRCRAFT_TYPES, CALLSIGN_OPERATORS, FLIGHT_LEVELS } from "./constants.js";
import { createId, normalizeHeading, randomBetween, randomChoice, randomInt, randomLetters } from "./utils.js";

function generateRegistration() {
  if (Math.random() < 0.7) return `C${randomChoice(["F", "G"])}${randomLetters(3)}`;
  const suffix = Math.random() < 0.55 ? randomLetters(randomInt(1, 2)) : "";
  return `N${randomInt(1, 999)}${suffix}`;
}
export function generateCallsign() {
  if (Math.random() < 0.12) return generateRegistration();
  return `${randomChoice(CALLSIGN_OPERATORS)}${randomInt(1, 9999)}`;
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


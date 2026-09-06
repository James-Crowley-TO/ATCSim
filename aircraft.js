import {
  AIRCRAFT_TYPES,
  CALLSIGN_OPERATORS,
  FLIGHT_LEVELS,
  HISTORY_INTERVAL_MINUTES,
} from "./constants.js";
import {
  clamp,
  createId,
  getClosestPointOnRect,
  headingToUnitVector,
  nmToPx,
  normalizeHeading,
  randomBetween,
  randomChoice,
  randomInt,
  randomLetters,
  setSvgLine,
} from "./utils.js";

function generateRegistration() {
  if (Math.random() < 0.7) {
    return `C${randomChoice(["F", "G"])}${randomLetters(3)}`;
  }

  const digits = randomInt(1, 999).toString();
  const suffix = Math.random() < 0.55 ? randomLetters(randomInt(1, 2)) : "";
  return `N${digits}${suffix}`;
}

export function generateCallsign() {
  if (Math.random() < 0.12) return generateRegistration();
  return `${randomChoice(CALLSIGN_OPERATORS)}${randomInt(1, 9999)}`;
}

function compatibleAircraftTypes({ aircraftType, speedKts, flightLevel }) {
  if (aircraftType !== undefined) {
    const data = AIRCRAFT_TYPES[aircraftType];
    if (!data) throw new Error(`Unknown aircraft type: ${aircraftType}`);
    if (speedKts !== undefined && (speedKts < data.minSpeedKts || speedKts > data.maxSpeedKts)) {
      throw new Error(`${aircraftType} cannot satisfy speed ${speedKts} kt`);
    }
    if (flightLevel !== undefined && flightLevel > data.maxFlightLevel) {
      throw new Error(`${aircraftType} cannot satisfy FL${flightLevel}`);
    }
    return [aircraftType];
  }

  return Object.entries(AIRCRAFT_TYPES)
    .filter(([, data]) => {
      if (speedKts !== undefined && (speedKts < data.minSpeedKts || speedKts > data.maxSpeedKts)) return false;
      if (flightLevel !== undefined && flightLevel > data.maxFlightLevel) return false;
      return true;
    })
    .map(([type]) => type);
}

function randomFlightLevel(maxFlightLevel) {
  return randomChoice(FLIGHT_LEVELS.filter((level) => level <= maxFlightLevel));
}

function randomVerticalRate(modelData) {
  if (Math.random() >= 0.12) return 0;
  const direction = Math.random() < 0.5 ? -1 : 1;
  const magnitude = Math.round(randomBetween(500, modelData.maxVerticalRateFpm) / 100) * 100;
  return direction * magnitude;
}

export function createAircraft(bounds, pad, overrides = {}) {
  const candidates = compatibleAircraftTypes(overrides);
  if (!candidates.length) throw new Error("No aircraft type satisfies the requested constraints");

  const aircraftType = overrides.aircraftType ?? randomChoice(candidates);
  const modelData = AIRCRAFT_TYPES[aircraftType];
  const flightLevel = overrides.flightLevel ?? randomFlightLevel(modelData.maxFlightLevel);
  const speedKts = overrides.speedKts ?? Math.round(randomBetween(modelData.minSpeedKts, modelData.maxSpeedKts));
  const verticalRateFpm = overrides.verticalRateFpm ?? randomVerticalRate(modelData);

  if (flightLevel > modelData.maxFlightLevel) {
    throw new Error(`${aircraftType} cannot operate at FL${flightLevel}`);
  }
  if (speedKts < modelData.minSpeedKts || speedKts > modelData.maxSpeedKts) {
    throw new Error(`${aircraftType} cannot operate at ${speedKts} kt in this simplified model`);
  }
  if (Math.abs(verticalRateFpm) > modelData.maxVerticalRateFpm) {
    throw new Error(`${aircraftType} vertical rate exceeds the simplified performance envelope`);
  }

  return {
    id: createId(),
    callsign: overrides.callsign ?? generateCallsign(),
    aircraftType,
    speedKts,
    flightLevel,
    verticalRateFpm,
    heading: normalizeHeading(overrides.heading ?? randomBetween(0, 360)),
    x: overrides.x ?? randomBetween(pad, bounds.width - pad),
    y: overrides.y ?? randomBetween(pad, bounds.height - pad),
  };
}

export function positionAircraft(wrapper, aircraft) {
  wrapper.style.left = `${aircraft.x}px`;
  wrapper.style.top = `${aircraft.y}px`;
}

export function renderTrail(wrapper, aircraft, count) {
  wrapper.querySelectorAll(".trail-dot").forEach((dot) => dot.remove());
  const { vx, vy } = headingToUnitVector(aircraft.heading);
  const spacingPx = nmToPx((aircraft.speedKts / 60) * HISTORY_INTERVAL_MINUTES);

  for (let i = 1; i <= count; i += 1) {
    const dot = document.createElement("div");
    dot.className = "trail-dot";
    dot.style.left = `${-vx * spacingPx * i}px`;
    dot.style.top = `${-vy * spacingPx * i}px`;
    wrapper.appendChild(dot);
  }
}

export function createLeaderLine(leaderSvg) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("leader-line");
  leaderSvg.appendChild(line);
  return line;
}

function formatTag(aircraft) {
  const trend = aircraft.verticalRateFpm === 0
    ? ""
    : `${aircraft.verticalRateFpm > 0 ? "↑" : "↓"}${Math.round(Math.abs(aircraft.verticalRateFpm) / 100)}`;
  const speedCode = Math.round(aircraft.speedKts / 10).toString().padStart(2, "0");
  return `${aircraft.callsign}\n${aircraft.flightLevel}${trend} ${speedCode}\n${aircraft.aircraftType}`;
}

export function createDataTag(aircraft, tagLayer, radarScreen) {
  const tag = document.createElement("div");
  tag.className = "data-tag";
  tag.textContent = formatTag(aircraft);
  tag.title = `${aircraft.callsign}: FL${aircraft.flightLevel}, ${Math.round(aircraft.speedKts)} kt, heading ${Math.round(aircraft.heading)}°`;
  tagLayer.appendChild(tag);

  const x = aircraft.x + 34;
  const y = aircraft.y - 24;

  tag.style.left = `${x}px`;
  tag.style.top = `${y}px`;
  return tag;
}

export function updateLeaderForAircraft(aircraft, tag, line) {
  const rect = {
    x: parseFloat(tag.style.left),
    y: parseFloat(tag.style.top),
    width: tag.offsetWidth,
    height: tag.offsetHeight,
  };
  const anchor = { x: aircraft.x, y: aircraft.y };
  const edge = getClosestPointOnRect(rect, anchor);
  setSvgLine(line, anchor.x, anchor.y, edge.x, edge.y);
}

export function enableTagDragging(tag, aircraft, line, radarScreen, screenToWorld, maxDistancePx = 180) {
  let pointerId = null;
  let offsetX = 0;
  let offsetY = 0;

  tag.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    const pointer = screenToWorld(event.clientX, event.clientY);
    offsetX = pointer.x - parseFloat(tag.style.left);
    offsetY = pointer.y - parseFloat(tag.style.top);
    tag.setPointerCapture(pointerId);
    tag.classList.add("dragging");
    event.preventDefault();
  });

  tag.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;

    const point = screenToWorld(event.clientX, event.clientY);
    let x = point.x - offsetX;
    let y = point.y - offsetY;

    const dx = x - aircraft.x;
    const dy = y - aircraft.y;
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistancePx) {
      const scale = maxDistancePx / distance;
      x = aircraft.x + dx * scale;
      y = aircraft.y + dy * scale;
    }

    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;
    updateLeaderForAircraft(aircraft, tag, line);
  });

  const stopDragging = (event) => {
    if (event.pointerId !== pointerId) return;
    if (tag.hasPointerCapture(pointerId)) tag.releasePointerCapture(pointerId);
    pointerId = null;
    tag.classList.remove("dragging");
  };

  tag.addEventListener("pointerup", stopDragging);
  tag.addEventListener("pointercancel", stopDragging);
  tag.addEventListener("lostpointercapture", stopDragging);
}

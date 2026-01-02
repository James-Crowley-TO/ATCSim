// Aircraft creation and management
import {
  AIRCRAFT_TYPES,
  CALLSIGN_OPERATORS,
  MIN_SPEED,
  MIN_ALT,
} from "./constants.js";
import {
  randomChoice,
  clamp,
  headingToUnitVector,
  speedToTrailSpacingPx,
  nmToPx,
  getClosestPointOnRect,
  setLine,
  biasedRandom,
} from "./utils.js";

export function generateCallsign() {
  const prefix = randomChoice(CALLSIGN_OPERATORS);
  const number = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${number}`;
}

export function isTooClose(a, b, minNm = 5) {
  const dx = a.longitude - b.longitude;
  const dy = a.latitude - b.latitude;
  return Math.hypot(dx, dy) < nmToPx(minNm) && a.altitude == b.altitude;
}

function isEastbound(heading) {
  return heading < 180;
}

function altitudeMatchesHeading(altitude, heading) {
  const isOdd = altitude % 2 !== 0;
  return isEastbound(heading) ? isOdd : !isOdd;
}

function getCompatibleAircraftModels({ speed, altitude, aircraftModel }) {
  if (aircraftModel) return [aircraftModel];
  
  return Object.entries(AIRCRAFT_TYPES)
    .filter(([_, model]) => {
      if (speed !== undefined && speed > model.maxSpeed) return false;
      if (altitude !== undefined && altitude > model.maxAlt) return false;
      return true;
    })
    .map(([name]) => name);
}

function deriveHeadingFromAltitude(altitude) {
  const eastbound = altitude % 2 !== 0;
  const min = eastbound ? 1 : 180;
  const range = eastbound ? 179 : 180;
  return Math.floor(Math.random() * range) + min;
}

function deriveAltitudeFromHeading(modelData, heading) {
  const eastbound = isEastbound(heading);  
  let altitude;
    do {
      altitude = Math.floor(Math.random() * (modelData.maxAlt - MIN_ALT + 1) + MIN_ALT);
    } while ((altitude % 2 !== 0) !== eastbound);
  return altitude;
}

function generateRandomHeading() {
  return Math.floor(Math.random() * 360) + 1;
}

function resolveHeadingAndAltitude(modelData, overrides) {
  const { heading, altitude } = overrides;

  // Both provided → validate compatibility
  if (heading !== undefined && altitude !== undefined) {
    if (!altitudeMatchesHeading(altitude, heading)) {
      throw new Error(
        `Incompatible heading (${heading}°) and altitude (${altitude}k ft): ` +
        `${isEastbound(heading) ? 'Eastbound' : 'Westbound'} flights must use ` +
        `${isEastbound(heading) ? 'odd' : 'even'} altitudes`
      );
    }
    return { heading, altitude };
  }

  // Heading only → derive altitude
  if (heading !== undefined) {
    return {
      heading,
      altitude: deriveAltitudeFromHeading(modelData, heading),
    };
  }

  // Altitude only → derive heading
  if (altitude !== undefined) {
    return {
      altitude,
      heading: deriveHeadingFromAltitude(altitude),
    };
  }

  // Neither → generate both
  const randomHeading = generateRandomHeading();
  return {
    heading: randomHeading,
    altitude: deriveAltitudeFromHeading(modelData, randomHeading),
  };
}

function climbRate(modelData, overrides) {
  const {climb} = overrides;

  if (climb !== undefined) {
    return {climb};
  }

  const climbDirection = Math.random() < 0.5 ? -1 : 1;
  const isClimbing = Math.random() < 0.1 ? true : false;

  if (climbDirection == 1 && isClimbing) {
    return {climb: Math.round(biasedRandom() * modelData.climb)};
  } else if (isClimbing) {
    return {climb: Math.round(-2 * biasedRandom() * modelData.climb)}
  } else {
    return {climb: 0}
  }
}

export function createAircraftInstance(radarRangePx, pad, overrides = {}) {
  const candidates = getCompatibleAircraftModels(overrides);
  
  if (candidates.length === 0) {
    throw new Error("No aircraft can satisfy the given constraints");
  }

  const modelName = randomChoice(candidates);
  const modelData = AIRCRAFT_TYPES[modelName];
  
  const { heading, altitude } = resolveHeadingAndAltitude(modelData, overrides);
  
  const speed =
    overrides.speed ??
    Math.round(Math.random() * (modelData.maxSpeed - MIN_SPEED) + MIN_SPEED);

  const longitude = 
    overrides.longitude ??
    Math.round(biasedRandom() * (radarRangePx - pad * 2)) + pad;

  const latitude = 
    overrides.latitude ??
    Math.round(biasedRandom() * (radarRangePx - pad * 2)) + pad;

  const {climb} = climbRate(modelData, overrides);
  
  return {
    id: crypto.randomUUID(),
    callsign: generateCallsign(),
    aircraftModel: modelName,
    modelData,
    latitude,
    longitude,
    heading,
    altitude,
    speed,
    climb,
  };
}

export function renderTrail(wrapper, aircraft, numDots = 4) {
  wrapper.querySelectorAll(".trail-dot").forEach((d) => d.remove());

  const { vx, vy } = headingToUnitVector(aircraft.heading);
  const spacing = speedToTrailSpacingPx(aircraft.speed);

  for (let i = 1; i <= numDots; i++) {
    const dot = document.createElement("div");
    dot.className = "trail-dot";

    const x = -vx * spacing * i;
    const y = -vy * spacing * i;

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    wrapper.appendChild(dot);
  }
}

export function positionAircraft(wrapper, aircraft) {
  wrapper.style.left = `${aircraft.longitude}px`;
  wrapper.style.top = `${aircraft.latitude}px`;
}

export function createLeaderLine(leaderSvg) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("leader-line");
  leaderSvg.appendChild(line);
  return line;
}

export function createDataTag(aircraft, aircraftX, aircraftY, radarScreen) {
  const tag = document.createElement("div");
  tag.className = "data-tag";

  if (aircraft.climb == 0) {
    tag.textContent = `${aircraft.callsign}\n${aircraft.altitude} ${aircraft.speed}\n${aircraft.aircraftModel}`;
  } else {
    const climbIcon =
      aircraft.climb > 0
        ? '<i class="fa-solid fa-arrow-up fa-xs"></i>'
        : aircraft.climb < 0
        ? '<i class="fa-solid fa-arrow-down fa-xs"></i>'
        : '';
    tag.innerHTML = `${aircraft.callsign}\n${aircraft.altitude}${climbIcon}${Math.abs(aircraft.climb)} ${aircraft.speed}\n${aircraft.aircraftModel}`;
  }
  

  tag.style.position = "absolute";

  const radarWidth = radarScreen.getBoundingClientRect().width;
  const radarHeight = radarScreen.getBoundingClientRect().height;
  const tagWidth = 100;
  const tagHeight = 50;

  let initialX = aircraftX + 40;
  let initialY = aircraftY - 20;

  initialX = clamp(initialX, 10, radarWidth - tagWidth - 10);
  initialY = clamp(initialY, 10, radarHeight - tagHeight - 10);

  tag.style.left = `${initialX}px`;
  tag.style.top = `${initialY}px`;

  radarScreen.appendChild(tag);

  return tag;
}

export function updateLeaderForAircraft(aircraftX, aircraftY, tagEl, lineEl) {
  const tagX = parseFloat(tagEl.style.left);
  const tagY = parseFloat(tagEl.style.top);
  const tagWidth = tagEl.offsetWidth;
  const tagHeight = tagEl.offsetHeight;

  // Get the closest point on the tag's edge to the aircraft
  const closestPoint = getClosestPointOnRect(
    tagX,
    tagY,
    tagWidth,
    tagHeight,
    aircraftX,
    aircraftY
  );

  setLine(lineEl, aircraftX, aircraftY, closestPoint.x, closestPoint.y);
}

export function enableTagDragging(
  tag,
  anchorX,
  anchorY,
  lineEl,
  radarScreen,
  maxDist = 180
) {
  let dragging = false;
  let offsetX, offsetY;

  const radarRect = radarScreen.getBoundingClientRect();

  tag.addEventListener("mousedown", (e) => {
    dragging = true;
    const tagRect = tag.getBoundingClientRect();
    offsetX = e.clientX - tagRect.left;
    offsetY = e.clientY - tagRect.top;
    tag.style.cursor = "grabbing";
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    let x = e.clientX - radarRect.left - offsetX;
    let y = e.clientY - radarRect.top - offsetY;

    const dx = x - anchorX;
    const dy = y - anchorY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxDist) {
      const s = maxDist / dist;
      x = anchorX + dx * s;
      y = anchorY + dy * s;
    }

    const tagWidth = tag.offsetWidth;
    const tagHeight = tag.offsetHeight;
    x = clamp(x, 0, radarRect.width - tagWidth);
    y = clamp(y, 0, radarRect.height - tagHeight);

    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;

    updateLeaderForAircraft(anchorX, anchorY, tag, lineEl);
  });

  document.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      tag.style.cursor = "grab";
    }
  });
}
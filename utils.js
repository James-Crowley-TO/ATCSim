import { NM_PER_PIXEL } from "./constants.js";

export function pxToNm(px) {
  return px * NM_PER_PIXEL;
}

export function nmToPx(nm) {
  return nm / NM_PER_PIXEL;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function randomStep(min, max, step) {
  const steps = Math.floor((max - min) / step);
  return min + randomInt(0, steps) * step;
}

export function randomChoice(items) {
  if (!items.length) throw new Error("Cannot choose from an empty array");
  return items[randomInt(0, items.length - 1)];
}

export function chance(probability) {
  return Math.random() < probability;
}

export function normalizeHeading(heading) {
  return ((heading % 360) + 360) % 360;
}

export function headingToUnitVector(heading) {
  const radians = (normalizeHeading(heading) * Math.PI) / 180;
  return {
    vx: Math.sin(radians),
    vy: -Math.cos(radians),
  };
}

export function projectPoint(x, y, heading, speedKts, minutes) {
  const { vx, vy } = headingToUnitVector(heading);
  const distancePx = nmToPx((speedKts / 60) * minutes);
  return {
    x: x + vx * distancePx,
    y: y + vy * distancePx,
  };
}

export function distanceNm(a, b) {
  return pxToNm(Math.hypot(a.x - b.x, a.y - b.y));
}

export function bearingDegrees(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return normalizeHeading((Math.atan2(dx, -dy) * 180) / Math.PI);
}

export function isInsideBounds(point, bounds, pad = 0) {
  return (
    point.x >= pad &&
    point.x <= bounds.width - pad &&
    point.y >= pad &&
    point.y <= bounds.height - pad
  );
}

export function setSvgLine(line, x1, y1, x2, y2) {
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
}

export function getClosestPointOnRect(rect, target) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const dx = target.x - centerX;
  const dy = target.y - centerY;

  if (dx === 0 && dy === 0) {
    return { x: centerX, y: rect.y };
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);

  return {
    x: centerX + dx * scale,
    y: centerY + dy * scale,
  };
}

export function randomLetters(length) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[randomInt(0, alphabet.length - 1)];
  }
  return value;
}

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function setAttributes(element, attributes) {
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

export function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  setAttributes(element, attributes);
  if (text !== null && text !== undefined) element.textContent = String(text);
  return element;
}

export function altitudeFeetAt(aircraft, timeMinutes) {
  const altitudeFt = aircraft.flightLevel * 100;
  const verticalRateFpm = aircraft.verticalRateFpm ?? 0;
  if (verticalRateFpm === 0) return altitudeFt;

  const clearedAltitudeFt = (aircraft.clearedFlightLevel ?? aircraft.flightLevel) * 100;
  const projectedAltitudeFt = altitudeFt + verticalRateFpm * timeMinutes;
  return verticalRateFpm > 0
    ? Math.min(projectedAltitudeFt, clearedAltitudeFt)
    : Math.max(projectedAltitudeFt, clearedAltitudeFt);
}

function velocityPxPerMinute(aircraft) {
  const { vx, vy } = headingToUnitVector(aircraft.heading);
  const speedPxPerMinute = nmToPx(aircraft.speedKts / 60);
  return { vx: vx * speedPxPerMinute, vy: vy * speedPxPerMinute };
}

export function projectedInterceptTime(a, b) {
  const positionDelta = { x: b.x - a.x, y: b.y - a.y };
  const directionA = headingToUnitVector(a.heading);
  const directionB = headingToUnitVector(b.heading);
  const cross = (u, v) => u.vx * v.vy - u.vy * v.vx;
  const trackCross = cross(directionA, directionB);
  const angularEpsilon = 1e-10;
  const positionEpsilon = 1e-7;

  // PIV applies only when the two forward ground tracks intersect. For
  // parallel tracks, that means they must be collinear and their rays overlap.
  if (Math.abs(trackCross) > angularEpsilon) {
    const deltaVector = { vx: positionDelta.x, vy: positionDelta.y };
    const distanceAlongA = cross(deltaVector, directionB) / trackCross;
    const distanceAlongB = cross(deltaVector, directionA) / trackCross;
    if (distanceAlongA < -positionEpsilon || distanceAlongB < -positionEpsilon) return null;
  } else {
    const offsetFromTrack = positionDelta.x * directionA.vy - positionDelta.y * directionA.vx;
    if (Math.abs(offsetFromTrack) > positionEpsilon) return null;

    const sameDirection = directionA.vx * directionB.vx + directionA.vy * directionB.vy > 0;
    const distanceFromAToB = positionDelta.x * directionA.vx + positionDelta.y * directionA.vy;
    if (!sameDirection && distanceFromAToB < -positionEpsilon) return null;
  }

  const va = velocityPxPerMinute(a);
  const vb = velocityPxPerMinute(b);
  const dvx = vb.vx - va.vx;
  const dvy = vb.vy - va.vy;
  const denominator = dvx ** 2 + dvy ** 2;

  if (denominator <= Number.EPSILON) return null;

  const time = -(positionDelta.x * dvx + positionDelta.y * dvy) / denominator;
  if (time < -1e-10) return null;
  return Math.max(0, time);
}

export function projectedIntercept(a, b) {
  const time = projectedInterceptTime(a, b);
  if (time === null) return null;
  const endA = projectPoint(a.x, a.y, a.heading, a.speedKts, time);
  const endB = projectPoint(b.x, b.y, b.heading, b.speedKts, time);
  return {
    endA,
    endB,
    timeMinutes: time,
    distanceANm: distanceNm(a, endA),
    distanceBNm: distanceNm(b, endB),
    separationNm: distanceNm(endA, endB),
  };
}

export function centreCrossingMinutes(aircraft, centre) {
  const velocity = velocityPxPerMinute(aircraft);
  const speedSquared = velocity.vx ** 2 + velocity.vy ** 2;
  if (speedSquared <= Number.EPSILON) return 0;
  return (
    (centre.x - aircraft.x) * velocity.vx +
    (centre.y - aircraft.y) * velocity.vy
  ) / speedSquared;
}

export function utcTime(startUtcSeconds = 0, minutesFromStart = 0) {
  const pad = value => String(value).padStart(2, "0");
  const totalSeconds = Math.round(startUtcSeconds + minutesFromStart * 60);
  const dayOffset = Math.floor(totalSeconds / 86400);
  const daySeconds = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(daySeconds / 3600);
  const minutes = Math.floor((daySeconds % 3600) / 60);
  const seconds = Math.floor(daySeconds % 60);
  const text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const dayLabel = dayOffset === 0
    ? ""
    : ` (${dayOffset > 0 ? "+" : "−"}${Math.abs(dayOffset)}d)`;
  return {
    text,
    label: `${text}Z${dayLabel}`,
    hours,
    minutes,
    seconds,
    dayOffset,
    totalSeconds: daySeconds,
  };
}

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

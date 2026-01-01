// Utility functions
import { PX_TO_NM } from "./constants.js";

export function pxToNm(px) {
  return px * PX_TO_NM;
}

export function nmToPx(nm) {
  return nm / PX_TO_NM;
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function headingToUnitVector(deg) {
  const rad = (deg * Math.PI) / 180;
  const vx = Math.sin(rad);
  const vy = -Math.cos(rad);
  return { vx, vy };
}

export function speedToTrailSpacingPx(speed) {
  return nmToPx(speed / 120);
}

export function getClosestPointOnRect(
  rectX,
  rectY,
  rectWidth,
  rectHeight,
  targetX,
  targetY
) {
  // Calculate center of rectangle
  const centerX = rectX + rectWidth / 2;
  const centerY = rectY + rectHeight / 2;

  // Vector from center to target
  const dx = targetX - centerX;
  const dy = targetY - centerY;

  // Check if target is inside the rectangle
  if (
    targetX >= rectX &&
    targetX <= rectX + rectWidth &&
    targetY >= rectY &&
    targetY <= rectY + rectHeight
  ) {
    // Target is inside, find closest edge
    const distToLeft = targetX - rectX;
    const distToRight = rectX + rectWidth - targetX;
    const distToTop = targetY - rectY;
    const distToBottom = rectY + rectHeight - targetY;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) return { x: rectX, y: targetY };
    if (minDist === distToRight) return { x: rectX + rectWidth, y: targetY };
    if (minDist === distToTop) return { x: targetX, y: rectY };
    return { x: targetX, y: rectY + rectHeight };
  }

  // Target is outside, project onto edges
  let closestPoint = { x: centerX, y: centerY };
  let minDistance = Infinity;

  // Top edge
  if (dy < 0) {
    const pointX = clamp(targetX, rectX, rectX + rectWidth);
    const dist = Math.hypot(pointX - targetX, rectY - targetY);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = { x: pointX, y: rectY };
    }
  }

  // Bottom edge
  if (dy > 0) {
    const pointX = clamp(targetX, rectX, rectX + rectWidth);
    const dist = Math.hypot(pointX - targetX, rectY + rectHeight - targetY);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = { x: pointX, y: rectY + rectHeight };
    }
  }

  // Left edge
  if (dx < 0) {
    const pointY = clamp(targetY, rectY, rectY + rectHeight);
    const dist = Math.hypot(rectX - targetX, pointY - targetY);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = { x: rectX, y: pointY };
    }
  }

  // Right edge
  if (dx > 0) {
    const pointY = clamp(targetY, rectY, rectY + rectHeight);
    const dist = Math.hypot(rectX + rectWidth - targetX, pointY - targetY);
    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = { x: rectX + rectWidth, y: pointY };
    }
  }

  return closestPoint;
}

export function biasedRandom() {
  return (Math.random() + Math.random())/2
}

export function setLine(lineEl, x1, y1, x2, y2) {
  lineEl.setAttribute("x1", x1);
  lineEl.setAttribute("y1", y1);
  lineEl.setAttribute("x2", x2);
  lineEl.setAttribute("y2", y2);
}
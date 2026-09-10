import { DEFAULT_STYLE, parseMap } from "./map.js";
import { bearingDegrees, normalizeHeading, nmToPx, pxToNm } from "./utils.js";

export const GEOMETRY_FIELDS = {
  line: ["x1", "y1", "x2", "y2"], arc: ["cx", "cy", "radius", "startBearing", "endBearing"],
  circle: ["cx", "cy", "radius"], point: ["x", "y"],
};
const STYLE_KEYS = { hashSpacing: "hash-spacing", hashLength: "hash-length" };
const quoted = value => {
  if (/[\r\n]/.test(String(value))) throw new Error("Map names, colours and labels must fit on one line.");
  return JSON.stringify(String(value));
};

export function serializeStyle(style) {
  return Object.entries({ ...DEFAULT_STYLE, ...style }).map(([key, value]) =>
    `${STYLE_KEYS[key] ?? key}=${typeof value === "string" ? quoted(value) : value}`).join(" ");
}

export function serializeFeature(feature) {
  const keys = GEOMETRY_FIELDS[feature.kind];
  if (!keys) throw new Error("Unsupported map element.");
  for (const key of keys) if (!Number.isFinite(feature[key])) throw new Error(`${key} must be a finite number.`);
  return `${feature.kind.toUpperCase()} ${keys.map(key => feature[key]).join(" ")} ${serializeStyle(feature.style)}`;
}

// Materialize every feature's effective style. This preserves STYLE changes
// within a layer, even when elements are moved, deleted, or reordered.
export function serializeMap(map) {
  const lines = [...(map.comments ?? []), `MAP ${quoted(map.name)}`, `SIZE ${map.widthNm} ${map.heightNm}`];
  for (const layer of map.layers) {
    lines.push("", `LAYER ${layer.name}`, `STYLE ${serializeStyle(layer.defaults)}`);
    for (const feature of layer.features) lines.push(serializeFeature(feature));
  }
  const source = `${lines.join("\n")}\n`;
  parseMap(source, "Map validation");
  return source;
}

export function placementFeature(kind, points, style = DEFAULT_STYLE) {
  if (!points.length) return null;
  const [a, b = a, c = b] = points;
  const base = { kind, style: { ...style } };
  if (kind === "point") return { ...base, x: a.x, y: a.y };
  if (kind === "line") return { ...base, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  const radius = Math.hypot(b.x - a.x, b.y - a.y);
  if (radius <= 1e-9) return null;
  const circle = { ...base, cx: a.x, cy: a.y, radius };
  if (kind === "circle") return circle;
  const startBearing = bearingDegrees(a, b), endBearing = bearingDegrees(a, c);
  if (normalizeHeading(endBearing - startBearing) < 1e-9) return null;
  return { ...circle, startBearing, endBearing };
}

const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

// Hit tolerance is in screen pixels; geometry is always in DSL nautical miles.
export function hitTestMap(map, worldPoint, camera) {
  const point = { x: pxToNm(worldPoint.x), y: pxToNm(worldPoint.y) };
  const pixelsPerNm = nmToPx(1) * camera.zoom;
  let nearest = null, best = Infinity;
  for (const layer of [...map.layers].reverse()) for (const feature of [...layer.features].reverse()) {
    let distance;
    if (feature.kind === "point") distance = Math.max(0,
      Math.hypot(point.x - feature.x, point.y - feature.y) * pixelsPerNm - feature.style.size);
    else if (feature.kind === "line") distance = segmentDistance(point,
      { x: feature.x1, y: feature.y1 }, { x: feature.x2, y: feature.y2 }) * pixelsPerNm;
    else {
      distance = Math.abs(Math.hypot(point.x - feature.cx, point.y - feature.cy) - feature.radius) * pixelsPerNm;
      if (feature.kind === "arc") {
        const centre = { x: feature.cx, y: feature.cy };
        const bearing = bearingDegrees(centre, point);
        if (normalizeHeading(bearing - feature.startBearing) > normalizeHeading(feature.endBearing - feature.startBearing)) {
          distance = Math.min(...[feature.startBearing, feature.endBearing].map(angle => {
            const r = angle * Math.PI / 180;
            return Math.hypot(point.x - feature.cx - Math.sin(r) * feature.radius,
              point.y - feature.cy + Math.cos(r) * feature.radius) * pixelsPerNm;
          }));
        }
      }
    }
    if (distance <= 8 + feature.style.width / 2 && distance < best) {
      best = distance; nearest = { layer, feature };
    }
  }
  return nearest;
}

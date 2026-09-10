import { mapColor, nmToPx, normalizeHeading, normalizeTheme, setAttributes, svgElement } from "./utils.js";

const LINE_PATTERNS = new Set(["solid", "dashed", "dotted", "hashed"]);
const POINT_SHAPES = new Set(["circle", "square", "triangle", "diamond", "cross"]);

export const DEFAULT_STYLE = Object.freeze({
  color: "#5b9bb3",
  opacity: 0.5,
  width: 1,
  pattern: "solid",
  shape: "circle",
  size: 4,
  rotation: 0,
  filled: false,
  label: "",
  hashSpacing: 16,
  hashLength: 6,
});

export class MapSyntaxError extends Error {
  constructor(sourceName, lineNumber, message) {
    super(`${sourceName}:${lineNumber}: ${message}`);
    this.name = "MapSyntaxError";
    this.sourceName = sourceName;
    this.lineNumber = lineNumber;
  }
}

function tokenize(line, sourceName, lineNumber) {
  const tokens = [];
  let token = "";
  let started = false;
  let quote = null;
  let escaped = false;

  for (const character of line) {
    if (quote) {
      if (escaped) {
        token += character;
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      started = true;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) {
        tokens.push(token);
        token = "";
        started = false;
      }
    } else {
      token += character;
      started = true;
    }
  }

  if (quote) throw new MapSyntaxError(sourceName, lineNumber, "unterminated quoted value");
  if (escaped) throw new MapSyntaxError(sourceName, lineNumber, "unfinished escape sequence");
  if (started) tokens.push(token);
  return tokens;
}

function numberValue(value, name, sourceName, lineNumber) {
  const parsed = Number(value);
  if (String(value).trim() === "" || !Number.isFinite(parsed)) {
    throw new MapSyntaxError(sourceName, lineNumber, `${name} must be a finite number`);
  }
  return parsed;
}

function positiveValue(value, name, sourceName, lineNumber) {
  const parsed = numberValue(value, name, sourceName, lineNumber);
  if (parsed <= 0) throw new MapSyntaxError(sourceName, lineNumber, `${name} must be greater than zero`);
  return parsed;
}

function opacityValue(value, sourceName, lineNumber) {
  const parsed = numberValue(value, "opacity", sourceName, lineNumber);
  if (parsed < 0 || parsed > 1) {
    throw new MapSyntaxError(sourceName, lineNumber, "opacity must be between 0 and 1");
  }
  return parsed;
}

function booleanValue(value, sourceName, lineNumber) {
  if (["true", "yes", "1"].includes(value.toLowerCase())) return true;
  if (["false", "no", "0"].includes(value.toLowerCase())) return false;
  throw new MapSyntaxError(sourceName, lineNumber, "filled must be true or false");
}

function styleOptions(tokens, sourceName, lineNumber) {
  const options = {};
  const seen = new Set();
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator <= 0) {
      throw new MapSyntaxError(sourceName, lineNumber, `expected key=value option, received "${token}"`);
    }

    const key = token.slice(0, separator).toLowerCase();
    const value = token.slice(separator + 1);
    if (seen.has(key)) {
      throw new MapSyntaxError(sourceName, lineNumber, `duplicate option "${key}"`);
    }
    seen.add(key);

    if (key === "color") {
      if (!value) throw new MapSyntaxError(sourceName, lineNumber, "color cannot be empty");
      if (globalThis.CSS?.supports && !CSS.supports("color", value)) {
        throw new MapSyntaxError(sourceName, lineNumber, `invalid colour "${value}"`);
      }
      options.color = value;
    } else if (key === "opacity") {
      options.opacity = opacityValue(value, sourceName, lineNumber);
    } else if (key === "width") {
      options.width = positiveValue(value, "width", sourceName, lineNumber);
    } else if (key === "pattern") {
      const pattern = value.toLowerCase();
      if (!LINE_PATTERNS.has(pattern)) {
        throw new MapSyntaxError(sourceName, lineNumber, `unknown line pattern "${value}"`);
      }
      options.pattern = pattern;
    } else if (key === "shape") {
      const shape = value.toLowerCase();
      if (!POINT_SHAPES.has(shape)) {
        throw new MapSyntaxError(sourceName, lineNumber, `unknown point shape "${value}"`);
      }
      options.shape = shape;
    } else if (key === "size") {
      options.size = positiveValue(value, "size", sourceName, lineNumber);
    } else if (key === "rotation") {
      options.rotation = numberValue(value, "rotation", sourceName, lineNumber);
    } else if (key === "filled") {
      options.filled = booleanValue(value, sourceName, lineNumber);
    } else if (key === "label") {
      options.label = value;
    } else if (key === "hash-spacing") {
      options.hashSpacing = positiveValue(value, "hash-spacing", sourceName, lineNumber);
    } else if (key === "hash-length") {
      options.hashLength = positiveValue(value, "hash-length", sourceName, lineNumber);
    } else {
      throw new MapSyntaxError(sourceName, lineNumber, `unknown style option "${key}"`);
    }
  }
  return options;
}

function requireArguments(tokens, count, command, sourceName, lineNumber) {
  if (tokens.length < count) {
    throw new MapSyntaxError(sourceName, lineNumber, `${command} requires ${count} numeric arguments`);
  }
}

function clockwiseSweep(startBearing, endBearing) {
  return normalizeHeading(endBearing - startBearing);
}

export function parseMap(source, sourceName = "<map>") {
  const document = { name: null, widthNm: null, heightNm: null, layers: [] };
  const comments = [];
  const layers = new Map();
  let currentLayer = null;

  const useLayer = (name = "base") => {
    if (!layers.has(name)) {
      const layer = { name, defaults: { ...DEFAULT_STYLE }, features: [] };
      layers.set(name, layer);
      document.layers.push(layer);
    }
    currentLayer = layers.get(name);
    return currentLayer;
  };

  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith("#") || line.startsWith("//")) { comments.push(rawLine); return; }

    const [rawCommand, ...tokens] = tokenize(line, sourceName, lineNumber);
    const command = rawCommand.toUpperCase();

    if (command === "MAP") {
      if (!tokens.length || !tokens.join(" ").trim()) throw new MapSyntaxError(sourceName, lineNumber, "MAP requires a name");
      if (document.name !== null) throw new MapSyntaxError(sourceName, lineNumber, "MAP may only appear once");
      document.name = tokens.join(" ");
      return;
    }

    if (command === "SIZE") {
      if (tokens.length !== 2) throw new MapSyntaxError(sourceName, lineNumber, "SIZE requires width and height");
      if (document.widthNm !== null) throw new MapSyntaxError(sourceName, lineNumber, "SIZE may only appear once");
      document.widthNm = positiveValue(tokens[0], "map width", sourceName, lineNumber);
      document.heightNm = positiveValue(tokens[1], "map height", sourceName, lineNumber);
      return;
    }

    if (command === "LAYER") {
      if (tokens.length !== 1 || !/^[a-z][a-z0-9_-]*$/i.test(tokens[0])) {
        throw new MapSyntaxError(sourceName, lineNumber, "LAYER requires one simple name");
      }
      useLayer(tokens[0]);
      return;
    }

    const layer = currentLayer ?? useLayer();
    if (command === "STYLE") {
      if (!tokens.length) throw new MapSyntaxError(sourceName, lineNumber, "STYLE requires at least one option");
      Object.assign(layer.defaults, styleOptions(tokens, sourceName, lineNumber));
      return;
    }

    const definitions = {
      LINE: { count: 4, fields: ["x1", "y1", "x2", "y2"] },
      ARC: { count: 5, fields: ["cx", "cy", "radius", "startBearing", "endBearing"] },
      CIRCLE: { count: 3, fields: ["cx", "cy", "radius"] },
      POINT: { count: 2, fields: ["x", "y"] },
    };
    const definition = definitions[command];
    if (!definition) throw new MapSyntaxError(sourceName, lineNumber, `unknown command "${rawCommand}"`);

    requireArguments(tokens, definition.count, command, sourceName, lineNumber);
    const values = {};
    definition.fields.forEach((field, fieldIndex) => {
      const positive = field === "radius";
      values[field] = positive
        ? positiveValue(tokens[fieldIndex], field, sourceName, lineNumber)
        : numberValue(tokens[fieldIndex], field, sourceName, lineNumber);
    });

    if (command === "ARC" && clockwiseSweep(values.startBearing, values.endBearing) === 0) {
      throw new MapSyntaxError(sourceName, lineNumber, "ARC bearings must describe a non-zero clockwise sweep; use CIRCLE for 360 degrees");
    }

    const overrides = styleOptions(tokens.slice(definition.count), sourceName, lineNumber);
    layer.features.push({
      kind: command.toLowerCase(),
      ...values,
      style: { ...layer.defaults, ...overrides },
      sourceLine: lineNumber,
    });
  });

  if (document.name === null) throw new MapSyntaxError(sourceName, 1, "missing MAP declaration");
  if (document.widthNm === null) throw new MapSyntaxError(sourceName, 1, "missing SIZE declaration");

  return {
    name: document.name,
    widthNm: document.widthNm,
    heightNm: document.heightNm,
    layers: document.layers,
    comments,
    sources: [sourceName],
  };
}

export async function loadMapFile(url, fetchImplementation = globalThis.fetch) {
  if (typeof fetchImplementation !== "function") throw new Error("No fetch implementation is available");
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new Error(`Could not load map "${url}" (${response.status || "request failed"})`);
  }
  return parseMap(await response.text(), url);
}

export function mergeMaps(documents) {
  if (!documents.length) throw new Error("At least one map file is required");
  const [base, ...overlays] = documents;
  const layers = [];
  const byName = new Map();

  for (const document of documents) {
    if (Math.abs(document.widthNm - base.widthNm) > 1e-9 || Math.abs(document.heightNm - base.heightNm) > 1e-9) {
      throw new Error(`Map "${document.name}" does not match the ${base.widthNm} × ${base.heightNm} NM base map`);
    }
    for (const layer of document.layers) {
      if (!byName.has(layer.name)) {
        const mergedLayer = { name: layer.name, defaults: { ...layer.defaults }, features: [] };
        byName.set(layer.name, mergedLayer);
        layers.push(mergedLayer);
      }
      byName.get(layer.name).features.push(...layer.features);
      Object.assign(byName.get(layer.name).defaults, layer.defaults);
    }
  }

  return {
    name: base.name,
    widthNm: base.widthNm,
    heightNm: base.heightNm,
    layers,
    sources: [base, ...overlays].flatMap(document => document.sources ?? []),
    comments: documents.flatMap(document => document.comments ?? []),
  };
}

export async function loadMapFiles(urls, fetchImplementation = globalThis.fetch) {
  if (!Array.isArray(urls) || !urls.length) throw new Error("At least one map URL is required");
  const documents = await Promise.all(urls.map(url => loadMapFile(url, fetchImplementation)));
  return mergeMaps(documents);
}

export function mapBounds(map) {
  return { width: nmToPx(map.widthNm), height: nmToPx(map.heightNm) };
}

function screenPoint(camera, xNm, yNm) {
  return camera.toScreen({ x: nmToPx(xNm), y: nmToPx(yNm) });
}

function pointOnCircle(center, radius, bearing) {
  const radians = normalizeHeading(bearing) * Math.PI / 180;
  return {
    x: center.x + Math.sin(radians) * radius,
    y: center.y - Math.cos(radians) * radius,
  };
}

function lineGeometry(feature, camera) {
  const start = screenPoint(camera, feature.x1, feature.y1);
  const end = screenPoint(camera, feature.x2, feature.y2);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  return {
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    length,
    sample: distance => {
      const fraction = length === 0 ? 0 : distance / length;
      return {
        x: start.x + dx * fraction,
        y: start.y + dy * fraction,
        nx: length === 0 ? 0 : -dy / length,
        ny: length === 0 ? 1 : dx / length,
      };
    },
  };
}

function curvedGeometry(feature, camera, fullCircle = false) {
  const center = screenPoint(camera, feature.cx, feature.cy);
  const radius = nmToPx(feature.radius) * camera.zoom;
  const startBearing = fullCircle ? 0 : normalizeHeading(feature.startBearing);
  const sweep = fullCircle ? 360 : clockwiseSweep(feature.startBearing, feature.endBearing);
  const sweepRadians = sweep * Math.PI / 180;

  if (fullCircle) {
    const top = pointOnCircle(center, radius, 0);
    const bottom = pointOnCircle(center, radius, 180);
    return {
      path: `M ${top.x} ${top.y} A ${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y} A ${radius} ${radius} 0 1 1 ${top.x} ${top.y}`,
      length: 2 * Math.PI * radius,
      sample: distance => {
        const bearing = distance / (2 * Math.PI * radius) * 360;
        const point = pointOnCircle(center, radius, bearing);
        const radians = bearing * Math.PI / 180;
        return { ...point, nx: Math.sin(radians), ny: -Math.cos(radians) };
      },
    };
  }

  const start = pointOnCircle(center, radius, startBearing);
  const end = pointOnCircle(center, radius, startBearing + sweep);
  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${end.x} ${end.y}`,
    length: radius * sweepRadians,
    sample: distance => {
      const fraction = radius === 0 ? 0 : distance / (radius * sweepRadians);
      const bearing = startBearing + sweep * fraction;
      const point = pointOnCircle(center, radius, bearing);
      const radians = bearing * Math.PI / 180;
      return { ...point, nx: Math.sin(radians), ny: -Math.cos(radians) };
    },
  };
}

function hashPath(geometry, style) {
  if (geometry.length <= 0) return "";
  const halfLength = style.hashLength / 2;
  const segments = [];
  for (let distance = style.hashSpacing / 2; distance < geometry.length; distance += style.hashSpacing) {
    const point = geometry.sample(distance);
    segments.push(
      `M ${point.x - point.nx * halfLength} ${point.y - point.ny * halfLength} ` +
      `L ${point.x + point.nx * halfLength} ${point.y + point.ny * halfLength}`
    );
  }
  return segments.join(" ");
}

function markerPath(shape, x, y, size) {
  if (shape === "circle") {
    return `M ${x + size} ${y} A ${size} ${size} 0 1 1 ${x - size} ${y} A ${size} ${size} 0 1 1 ${x + size} ${y}`;
  }
  if (shape === "square") {
    return `M ${x - size} ${y - size} H ${x + size} V ${y + size} H ${x - size} Z`;
  }
  if (shape === "triangle") {
    return `M ${x} ${y - size} L ${x + size * 0.866} ${y + size * 0.5} L ${x - size * 0.866} ${y + size * 0.5} Z`;
  }
  if (shape === "diamond") {
    return `M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`;
  }
  return `M ${x - size} ${y} H ${x + size} M ${x} ${y - size} V ${y + size}`;
}

function strokeAttributes(style) {
  const attributes = {
    class: "map-stroke",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": style.width,
    "stroke-linecap": style.pattern === "dotted" ? "round" : "butt",
    "stroke-linejoin": "round",
  };
  if (style.pattern === "dashed") attributes["stroke-dasharray"] = "8 6";
  if (style.pattern === "dotted") attributes["stroke-dasharray"] = "1 5";
  return attributes;
}

export class MapRenderer {
  constructor(root, map, theme = "blue") {
    this.records = [];
    this.theme = normalizeTheme(theme);
    for (const layer of map.layers) {
      const layerElement = svgElement("g", { class: "map-layer", "data-map-layer": layer.name });
      root.append(layerElement);
      for (const feature of layer.features) this.records.push(this.createRecord(layerElement, feature));
    }
  }

  setTheme(theme) {
    this.theme = normalizeTheme(theme);
    for (const { group, feature } of this.records) {
      group.setAttribute("color", mapColor(feature.style.color, this.theme));
    }
  }

  createRecord(layer, feature) {
    const group = svgElement("g", {
      class: `map-feature map-${feature.kind}`,
      opacity: feature.style.opacity,
      color: mapColor(feature.style.color, this.theme),
    });
    layer.append(group);

    if (feature.kind === "point") {
      const marker = svgElement("path", {
        class: "map-point-marker",
        fill: feature.style.filled && feature.style.shape !== "cross" ? "currentColor" : "none",
        stroke: "currentColor",
        "stroke-width": feature.style.width,
        "stroke-linejoin": "round",
      });
      const label = feature.style.label
        ? svgElement("text", { class: "map-label", fill: "currentColor" }, feature.style.label)
        : null;
      group.append(marker);
      if (label) group.append(label);
      return { group, feature, marker, label };
    }

    const stroke = svgElement("path", strokeAttributes(feature.style));
    const hashes = feature.style.pattern === "hashed"
      ? svgElement("path", {
        class: "map-hashes",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": feature.style.width,
        "stroke-linecap": "round",
      })
      : null;
    group.append(stroke);
    if (hashes) group.append(hashes);
    return { group, feature, stroke, hashes };
  }

  render(camera) {
    for (const record of this.records) {
      const { feature } = record;
      if (feature.kind === "point") {
        const point = screenPoint(camera, feature.x, feature.y);
        record.marker.setAttribute("d", markerPath(feature.style.shape, point.x, point.y, feature.style.size));
        record.marker.setAttribute("transform", `rotate(${feature.style.rotation} ${point.x} ${point.y})`);
        if (record.label) {
          setAttributes(record.label, {
            x: point.x + feature.style.size + 5,
            y: point.y + 4,
          });
        }
        continue;
      }

      const geometry = feature.kind === "line"
        ? lineGeometry(feature, camera)
        : curvedGeometry(feature, camera, feature.kind === "circle");
      record.stroke.setAttribute("d", geometry.path);
      if (record.hashes) record.hashes.setAttribute("d", hashPath(geometry, feature.style));
    }
  }
}

import { NM_PER_PIXEL } from "./constants.js";

const FULL_CIRCLE_DEGREES = 360;
const SECONDS_PER_DAY = 86_400;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const TRACK_ANGLE_EPSILON = 1e-10;
const TRACK_POSITION_EPSILON_PX = 1e-7;
const TIME_EPSILON_MINUTES = 1e-10;

export function pxToNm(pixels) {
    return pixels * NM_PER_PIXEL;
}

export function nmToPx(nauticalMiles) {
    return nauticalMiles / NM_PER_PIXEL;
}

export function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
}

// Both endpoints are inclusive.
export function randomInt(minimum, maximum) {
    return Math.floor(randomBetween(minimum, maximum + 1));
}

export function randomStep(minimum, maximum, step) {
    const stepCount = Math.floor((maximum - minimum) / step + Number.EPSILON);
    return minimum + randomInt(0, stepCount) * step;
}

export function randomChoice(items) {
    if (!items.length) throw new Error("Cannot choose from an empty array");
    return items[randomInt(0, items.length - 1)];
}

export function chance(probability) {
    return Math.random() < probability;
}

export function normalizeHeading(heading) {
    return ((heading % FULL_CIRCLE_DEGREES) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES;
}

// Radar headings are clockwise from north; screen Y increases downward.
export function headingToUnitVector(heading) {
    const radians = normalizeHeading(heading) * Math.PI / 180;
    return {
        vx: Math.sin(radians),
        vy: -Math.cos(radians),
    };
}

export function projectPoint(x, y, heading, speedKts, minutes) {
    const direction = headingToUnitVector(heading);
    const distancePx = nmToPx(speedKts * minutes / 60);
    return {
        x: x + direction.vx * distancePx,
        y: y + direction.vy * distancePx,
    };
}

export function distanceNm(pointA, pointB) {
    return pxToNm(Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y));
}

export function bearingDegrees(from, to) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    return normalizeHeading(Math.atan2(deltaX, -deltaY) * 180 / Math.PI);
}

export function isInsideBounds(point, bounds, padding = 0) {
    return (
        point.x >= padding &&
        point.x <= bounds.width - padding &&
        point.y >= padding &&
        point.y <= bounds.height - padding
    );
}

export function setSvgLine(line, x1, y1, x2, y2) {
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
}

// Returns the intersection of the centre-to-target ray with the rectangle.
export function getClosestPointOnRect(rectangle, target) {
    const centreX = rectangle.x + rectangle.width / 2;
    const centreY = rectangle.y + rectangle.height / 2;
    const deltaX = target.x - centreX;
    const deltaY = target.y - centreY;

    if (deltaX === 0 && deltaY === 0) return { x: centreX, y: rectangle.y };

    const scale = 1 / Math.max(
        Math.abs(deltaX) / (rectangle.width / 2),
        Math.abs(deltaY) / (rectangle.height / 2)
    );
    return {
        x: centreX + deltaX * scale,
        y: centreY + deltaY * scale,
    };
}

export function randomLetters(length) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let index = 0; index < length; index += 1) {
        result += alphabet[randomInt(0, alphabet.length - 1)];
    }
    return result;
}

export function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `ac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function round(value, decimalPlaces = 1) {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}

export function setAttributes(element, attributes) {
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    return element;
}

export function svgElement(tagName, attributes = {}, text = null) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    setAttributes(element, attributes);
    if (text !== null && text !== undefined) element.textContent = String(text);
    return element;
}

// Aircraft levels are flight levels (hundreds of feet); vertical rates are ft/min.
// Future motion stops exactly at the assigned cleared level.
export function altitudeFeetAt(aircraft, timeMinutes) {
    const initialAltitudeFt = aircraft.flightLevel * 100;
    const verticalRateFpm = aircraft.verticalRateFpm ?? 0;
    if (verticalRateFpm === 0 || timeMinutes === 0) return initialAltitudeFt;

    const clearedAltitudeFt = (aircraft.clearedFlightLevel ?? aircraft.flightLevel) * 100;
    const unrestrictedAltitudeFt = initialAltitudeFt + verticalRateFpm * timeMinutes;

    if (timeMinutes < 0) return unrestrictedAltitudeFt;
    return verticalRateFpm > 0
        ? Math.min(unrestrictedAltitudeFt, clearedAltitudeFt)
        : Math.max(unrestrictedAltitudeFt, clearedAltitudeFt);
}

function velocityPxPerMinute(aircraft) {
    const direction = headingToUnitVector(aircraft.heading);
    const magnitude = nmToPx(aircraft.speedKts / 60);
    return {
        vx: direction.vx * magnitude,
        vy: direction.vy * magnitude,
    };
}

function cross(vectorA, vectorB) {
    return vectorA.vx * vectorB.vy - vectorA.vy * vectorB.vx;
}

function dot(vectorA, vectorB) {
    return vectorA.vx * vectorB.vx + vectorA.vy * vectorB.vy;
}

function forwardTracksIntersect(aircraftA, aircraftB) {
    const directionA = headingToUnitVector(aircraftA.heading);
    const directionB = headingToUnitVector(aircraftB.heading);
    const positionDelta = {
        vx: aircraftB.x - aircraftA.x,
        vy: aircraftB.y - aircraftA.y,
    };
    const directionCross = cross(directionA, directionB);

    if (Math.abs(directionCross) > TRACK_ANGLE_EPSILON) {
        const distanceAlongA = cross(positionDelta, directionB) / directionCross;
        const distanceAlongB = cross(positionDelta, directionA) / directionCross;
        return distanceAlongA >= -TRACK_POSITION_EPSILON_PX &&
            distanceAlongB >= -TRACK_POSITION_EPSILON_PX;
    }

    // Parallel forward rays intersect only when they are collinear. Rays travelling
    // in the same direction always overlap; opposing rays overlap when B is ahead.
    if (Math.abs(cross(positionDelta, directionA)) > TRACK_POSITION_EPSILON_PX) return false;
    if (dot(directionA, directionB) > 0) return true;
    return dot(positionDelta, directionA) >= -TRACK_POSITION_EPSILON_PX;
}

// Common future time of horizontal closest approach, gated by the PIV rule that
// both infinite forward tracks must intersect.
export function projectedInterceptTime(aircraftA, aircraftB) {
    if (!forwardTracksIntersect(aircraftA, aircraftB)) return null;

    const velocityA = velocityPxPerMinute(aircraftA);
    const velocityB = velocityPxPerMinute(aircraftB);
    const relativePosition = {
        vx: aircraftB.x - aircraftA.x,
        vy: aircraftB.y - aircraftA.y,
    };
    const relativeVelocity = {
        vx: velocityB.vx - velocityA.vx,
        vy: velocityB.vy - velocityA.vy,
    };
    const speedSquared = dot(relativeVelocity, relativeVelocity);
    if (speedSquared <= Number.EPSILON) return null;

    const timeMinutes = -dot(relativePosition, relativeVelocity) / speedSquared;
    if (timeMinutes < -TIME_EPSILON_MINUTES) return null;
    return Math.max(0, timeMinutes);
}

export function projectedIntercept(aircraftA, aircraftB) {
    const timeMinutes = projectedInterceptTime(aircraftA, aircraftB);
    if (timeMinutes === null) return null;

    const endA = projectPoint(
        aircraftA.x, aircraftA.y, aircraftA.heading, aircraftA.speedKts, timeMinutes
    );
    const endB = projectPoint(
        aircraftB.x, aircraftB.y, aircraftB.heading, aircraftB.speedKts, timeMinutes
    );
    return {
        endA,
        endB,
        timeMinutes,
        distanceANm: distanceNm(aircraftA, endA),
        distanceBNm: distanceNm(aircraftB, endB),
        separationNm: distanceNm(endA, endB),
    };
}

// Signed time to closest approach to a fixed reference point.
export function centreCrossingMinutes(aircraft, centre) {
    const velocity = velocityPxPerMinute(aircraft);
    const speedSquared = dot(velocity, velocity);
    if (speedSquared <= Number.EPSILON) return 0;

    const displacement = {
        vx: centre.x - aircraft.x,
        vy: centre.y - aircraft.y,
    };
    return dot(displacement, velocity) / speedSquared;
}

export function utcTime(startUtcSeconds = 0, minutesFromStart = 0) {
    const absoluteSeconds = Math.round(startUtcSeconds + minutesFromStart * 60);
    const dayOffset = Math.floor(absoluteSeconds / SECONDS_PER_DAY);
    const secondsOfDay = ((absoluteSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const hours = Math.floor(secondsOfDay / 3600);
    const minutes = Math.floor((secondsOfDay % 3600) / 60);
    const seconds = secondsOfDay % 60;
    const pad = value => String(value).padStart(2, "0");
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
        totalSeconds: secondsOfDay,
    };
}

// Theme helpers live here so the application remains self-contained when the
// core files are copied individually.
export const THEMES = Object.freeze(["blue", "black", "light"]);
export const THEME_STORAGE_KEY = "atc-trainer-theme";

export function normalizeTheme(theme) {
    return THEMES.includes(theme) ? theme : "blue";
}

export function readTheme(storage) {
    try {
        return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
    } catch {
        return "blue";
    }
}

export function initializeThemeSelector() {
    const root = document.documentElement;
    const select = document.getElementById("themeSelect");
    if (!select) return;
    let storage;
    try { storage = window.localStorage; } catch { /* Browser storage is optional. */ }

    const apply = theme => {
        const selected = normalizeTheme(theme);
        root.dataset.theme = selected;
        select.value = selected;
        try { storage?.setItem(THEME_STORAGE_KEY, selected); } catch { /* Apply without persistence. */ }
        document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: selected } }));
    };

    apply(readTheme(storage));
    select.addEventListener("change", () => apply(select.value));
}

const resolvedColors = new Map();

function parseRgb(color) {
    const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color);
    if (hex) {
        const value = hex[1].length <= 4 ? [...hex[1]].map(character => character + character).join("") : hex[1];
        const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
        return [...channels, value.length === 8 ? parseInt(value.slice(6), 16) / 255 : 1];
    }
    const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
    if (!rgb) return null;
    const values = rgb[1].trim().split(/[\s,/]+/);
    if (values.length < 3 || values.length > 4) return null;
    const channels = values.map((value, index) => {
        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)%?$/.test(value)) return NaN;
        return Math.min(1, Math.max(0, parseFloat(value) / (value.endsWith("%") ? 100 : index < 3 ? 255 : 1)));
    });
    if (!channels.every(Number.isFinite)) return null;
    return [...channels.slice(0, 3), channels[3] ?? 1];
}

function resolveRgb(color) {
    const parsed = parseRgb(color);
    if (parsed) return parsed;
    if (resolvedColors.has(color)) return resolvedColors.get(color);
    if (typeof document === "undefined" || !document.body) return null;
    const probe = document.createElement("span");
    probe.style.color = color;
    if (!probe.style.color) return null;
    probe.hidden = true;
    document.body.append(probe);
    const result = parseRgb(getComputedStyle(probe).color);
    probe.remove();
    resolvedColors.set(color, result);
    return result;
}

export function mapColor(color, theme) {
    const selected = normalizeTheme(theme);
    if (selected === "blue" || /var\(|currentcolor|^(none|transparent)$/i.test(color)) return color;
    const rgb = resolveRgb(color.trim());
    if (!rgb) return color;
    const [red, green, blue, alpha] = rgb;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    const lightness = (maximum + minimum) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    let hue = 0;
    if (delta) {
        if (maximum === red) hue = ((green - blue) / delta) % 6;
        else if (maximum === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
        hue = (hue * 60 + 360) % 360;
    }
    const neutral = saturation < 0.1;
    const targetSaturation = neutral ? saturation : Math.max(saturation, selected === "black" ? 0.9 : 0.55);
    let targetLightness = selected === "black" ? (neutral ? 0.72 : 0.68) : (neutral ? 0.30 : 0.32);
    if (selected === "light") {
        const luminance = candidate => {
            const adjustment = targetSaturation * Math.min(candidate, 1 - candidate);
            const channels = [0, 8, 4].map(offset => {
                const k = (offset + hue / 30) % 12;
                const channel = candidate - adjustment * Math.max(-1, Math.min(k - 3, 9 - k, 1));
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        while (targetLightness > 0.1 && luminance(targetLightness) > 0.14) targetLightness -= 0.02;
    }
    return `hsla(${hue.toFixed(2)}, ${(targetSaturation * 100).toFixed(2)}%, ${(targetLightness * 100).toFixed(2)}%, ${alpha})`;
}

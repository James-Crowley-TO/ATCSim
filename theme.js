export const THEMES = Object.freeze(["blue", "black", "light"]);
export const THEME_STORAGE_KEY = "atc-trainer-theme";

export function normalizeTheme(theme) {
  return THEMES.includes(theme) ? theme : "blue";
}

export function readTheme(storage) {
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "blue";
  }
}

export function initializeThemeSelector() {
  const root = document.documentElement;
  const select = document.getElementById("themeSelect");
  let storage;
  try { storage = window.localStorage; } catch { /* Preferences are optional. */ }

  function apply(theme) {
    const selected = normalizeTheme(theme);
    root.dataset.theme = selected;
    select.value = selected;
    try { storage?.setItem(THEME_STORAGE_KEY, selected); } catch { /* Still switch in memory. */ }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: selected } }));
  }

  apply(readTheme(storage));
  select.addEventListener("change", () => apply(select.value));
}

const resolvedColors = new Map();

function parseRgb(color) {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color);
  if (hex) {
    const value = hex[1].length <= 4 ? [...hex[1]].map(c => c + c).join("") : hex[1];
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
  // The browser resolves named colours and hsl(); hex/rgb work without a DOM.
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

// Retain the authored hue and alpha; adjust tone for the radar background.
// Original map data, opacity, geometry and line/point styles stay intact.
export function mapColor(color, theme) {
  const selected = normalizeTheme(theme);
  if (selected === "blue" || /var\(|currentcolor|^(none|transparent)$/i.test(color)) return color;
  const rgb = resolveRgb(color.trim());
  if (!rgb) return color;
  const [r, g, b, alpha] = rgb;
  const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta) {
    if (maximum === r) hue = ((g - b) / delta) % 6;
    else if (maximum === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const neutral = saturation < 0.1;
  const targetSaturation = neutral ? saturation : Math.max(saturation, selected === "black" ? 0.9 : 0.55);
  let targetLightness = selected === "black"
    ? (neutral ? 0.72 : 0.68)
    : (neutral ? 0.30 : 0.32);
  if (selected === "light") {
    // Yellow and green need a darker tone than blue for equal legibility.
    const luminance = light => {
      const a = targetSaturation * Math.min(light, 1 - light);
      const channels = [0, 8, 4].map(n => {
        const k = (n + hue / 30) % 12;
        const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    while (targetLightness > 0.1 && luminance(targetLightness) > 0.14) targetLightness -= 0.02;
  }
  return `hsla(${hue.toFixed(2)}, ${(targetSaturation * 100).toFixed(2)}%, ${(targetLightness * 100).toFixed(2)}%, ${alpha})`;
}

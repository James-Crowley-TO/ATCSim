import { DEFAULT_HALO_NM, DEFAULT_PTL_MINUTES } from "./constants.js";
import {
  bearingDegrees, distanceNm, nmToPx, projectPoint, projectedIntercept,
  setAttributes, setSvgLine, svgElement, utcTime, clamp
} from "./utils.js";

const pairKey = (a, b) => [a.id, b.id].sort().join("|");

export class RadarTools {
  constructor(layer, onChange, onStatus) {
    this.layer = layer;
    this.onChange = onChange;
    this.onStatus = onStatus;
    this.records = [];
    this.selectedTool = null;
    this.pending = null;
    this.startUtcSeconds = 0;
  }

  reset(scenario) {
    this.layer.replaceChildren();
    this.records = [];
    this.pending = null;
    this.selectedTool = null;
    this.startUtcSeconds = scenario?.startUtcSeconds ?? 0;
    this.onStatus("");
    this.onChange();
  }

  select(kind) {
    this.selectedTool = this.selectedTool === kind ? null : kind;
    this.pending = null;
    this.onStatus(this.selectedTool ? `Select ${["rbl", "piv"].includes(kind) ? "two targets" : "a target"} for ${kind.toUpperCase()}.` : "");
    this.onChange();
  }

  cancelSelection() {
    this.pending = null;
    this.onStatus("");
    this.onChange();
  }

  clear(kind) {
    const removed = this.records.filter(record => !kind || record.kind === kind);
    removed.forEach(record => record.group.remove());
    this.records = this.records.filter(record => !removed.includes(record));
    if (!kind || kind === this.selectedTool) this.pending = null;
    this.onStatus("");
    this.onChange();
  }

  clearForAircraft(aircraft) {
    for (const record of [...this.records]) {
      if (record.a.id === aircraft.id || record.b?.id === aircraft.id) this.remove(record);
    }
    if (this.pending?.id === aircraft.id) this.pending = null;
    this.onStatus("");
    this.onChange();
  }

  remove(record) {
    record.group.remove();
    this.records = this.records.filter(item => item !== record);
    this.onChange();
  }

  handleTarget(aircraft) {
    const kind = this.selectedTool;
    if (!kind) return;
    if (kind === "rbl" || kind === "piv") {
      if (!this.pending) {
        this.pending = aircraft;
        this.onStatus(`${aircraft.callsign} selected. Select the second target.`);
        this.onChange();
        return;
      }
      if (this.pending.id === aircraft.id) {
        this.cancelSelection();
        return;
      }
      const a = this.pending;
      this.pending = null;
      this.add(kind, a, aircraft);
    } else this.add(kind, aircraft);
    this.onChange();
  }

  add(kind, a, b) {
    const key = b ? pairKey(a, b) : a.id;
    if (this.records.some(record => record.kind === kind && record.key === key)) {
      this.onStatus(`${kind.toUpperCase()} is already displayed for this selection.`);
      return;
    }
    const prediction = kind === "piv" ? projectedIntercept(a, b) : null;
    if (kind === "piv" && !prediction) {
      this.onStatus(`${a.callsign} / ${b.callsign}: no future intercept on the forward tracks.`);
      return;
    }
    const group = svgElement("g", { class: `radar-tool ${kind}-tool`, "data-tool-kind": kind });
    const title = svgElement("title", {}, `${kind.toUpperCase()}: click a line to remove`);
    group.append(title);
    const record = { kind, key, a, b, group, prediction, minutes: DEFAULT_PTL_MINUTES, radiusNm: DEFAULT_HALO_NM };
    const line = name => {
      const item = svgElement("line", { class: `tool-line ${kind}-line ${name}` });
      group.append(item);
      return item;
    };
    const label = (name, text) => {
      const item = svgElement("text", { class: `tool-label ${kind}-label ${name}` }, text);
      group.append(item);
      return item;
    };
    if (kind === "piv") {
      record.lineA = line("piv-vector-a");
      record.lineB = line("piv-vector-b");
      record.connector = line("piv-separation");
      record.labelA = label("piv-distance-a", `${prediction.distanceANm.toFixed(1)} NM`);
      record.labelB = label("piv-distance-b", `${prediction.distanceBNm.toFixed(1)} NM`);
      record.separationLabel = label("piv-separation-label", `SEP ${prediction.separationNm.toFixed(1)} NM`);
      record.timeLabel = label("piv-time", `CPA ${utcTime(this.startUtcSeconds, prediction.timeMinutes).label}`);
      for (const name of ["endMarkerA", "endMarkerB"]) {
        record[name] = svgElement("circle", { r: 2.5, class: "piv-endpoint" });
        group.append(record[name]);
      }
      title.textContent = `${a.callsign} / ${b.callsign}: closest approach in ${prediction.timeMinutes.toFixed(2)} min. Click a vector to remove.`;
    } else if (kind === "halo") {
      record.circle = svgElement("circle", { class: "tool-line halo-circle" });
      group.append(record.circle);
      record.label = label("halo-distance", `${record.radiusNm} NM`);
    } else {
      record.line = line("vector");
      record.label = label("vector-label", "");
    }
    group.addEventListener("click", event => {
      event.stopPropagation();
      this.remove(record);
    });
    this.layer.append(group);
    this.records.push(record);
    this.onStatus(`${kind.toUpperCase()} displayed for ${a.callsign}${b ? ` / ${b.callsign}` : ""}.`);
  }

  handleScroll(aircraft, deltaY) {
    if (!deltaY) return false;
    const adjustable = this.records.filter(record => record.a.id === aircraft.id &&
      ["ptl", "halo"].includes(record.kind));
    const record = adjustable.find(item => item.kind === this.selectedTool) ??
      (adjustable.length === 1 ? adjustable[0] : null);
    if (!record) return false;
    const direction = deltaY > 0 ? -1 : 1;
    if (record.kind === "ptl") record.minutes = clamp(record.minutes + direction, 1, 12);
    else record.radiusNm = clamp(record.radiusNm + direction, 1, 20);
    this.onChange();
    return true;
  }

  render(camera) {
    const drawLine = (line, start, end) => setSvgLine(line, start.x, start.y, end.x, end.y);
    const midpointLabel = (label, start, end, offset = -8) =>
      setAttributes(label, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 + offset });
    const legLabel = (label, start, end) => {
      let angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      setAttributes(label, {
        x: 0, y: -7,
        transform: `translate(${(start.x + end.x) / 2} ${(start.y + end.y) / 2}) rotate(${angle})`
      });
    };
    for (const record of this.records) {
      const start = camera.toScreen(record.a);
      if (record.kind === "halo") {
        const radius = nmToPx(record.radiusNm) * camera.zoom;
        setAttributes(record.circle, { cx: start.x, cy: start.y, r: radius });
        setAttributes(record.label, { x: start.x, y: start.y - radius - 8 });
        record.label.textContent = `${record.radiusNm} NM`;
      } else if (record.kind === "ptl") {
        const end = camera.toScreen(projectPoint(record.a.x, record.a.y, record.a.heading, record.a.speedKts, record.minutes));
        drawLine(record.line, start, end);
        midpointLabel(record.label, start, end);
        record.label.textContent = `${record.minutes} min`;
      } else if (record.kind === "rbl") {
        const end = camera.toScreen(record.b);
        drawLine(record.line, start, end);
        midpointLabel(record.label, start, end);
        record.label.textContent = `${distanceNm(record.a, record.b).toFixed(1)} NM / ${String(Math.round(bearingDegrees(record.a, record.b)) % 360).padStart(3, "0")}°`;
      } else {
        const prediction = record.prediction;
        const startB = camera.toScreen(record.b);
        const endA = camera.toScreen(prediction.endA);
        const endB = camera.toScreen(prediction.endB);
        drawLine(record.lineA, start, endA);
        drawLine(record.lineB, startB, endB);
        drawLine(record.connector, endA, endB);
        legLabel(record.labelA, start, endA);
        legLabel(record.labelB, startB, endB);
        midpointLabel(record.separationLabel, endA, endB, 17);
        setAttributes(record.endMarkerA, { cx: endA.x, cy: endA.y });
        setAttributes(record.endMarkerB, { cx: endB.x, cy: endB.y });
        const end = prediction.distanceANm >= prediction.distanceBNm ? endA : endB;
        setAttributes(record.timeLabel, { x: end.x, y: end.y - 15 });
      }
    }
  }
}


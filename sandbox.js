import { bearingDegrees, distanceNm, normalizeHeading, setAttributes, setSvgLine, svgElement } from "./utils.js";

export function clockwiseAngle(points) {
  return normalizeHeading(bearingDegrees(points[0], points[2]) - bearingDegrees(points[0], points[1]));
}

export class SandboxTools {
  constructor(layer, { onChange, onStatus, onPlace }) {
    Object.assign(this, { layer, onChange, onStatus, onPlace });
    this.selectedTool = null;
    this.measurements = [];
    this.points = [];
    this.hover = null;
    this.draft = null;
  }
  select(kind) {
    this.selectedTool = this.selectedTool === kind ? null : kind;
    this.points = []; this.hover = null;
    this.status(); this.onChange();
  }
  status() {
    const messages = {
      ruler: this.points.length ? "Ruler: click the endpoint to finish." : "Ruler: click the start, then the endpoint. Distance is in NM.",
      angle: ["Protractor: click the vertex.", "Protractor: click the first ray.", "Protractor: click the second ray to finish. Clockwise angle from ray 1 to ray 2 (0–360°). "][this.points.length],
      aircraft: "Click to place an aircraft. Right-click an existing PPS to edit it.",
    };
    this.onStatus(messages[this.selectedTool] || "Sandbox Mode · Select a tool, or right-click a PPS to edit. Drag to pan; wheel to zoom.");
  }
  cancel() { this.points = []; this.hover = null; this.status(); this.onChange(); }
  clear() { this.measurements = []; this.cancel(); }
  reset() { this.selectedTool = null; this.draft = null; this.clear(); this.layer.replaceChildren(); }
  move(point) { this.hover = point; this.onChange(); }
  click(point) {
    if (this.selectedTool === "aircraft") { this.onPlace(point); return; }
    if (!["ruler", "angle"].includes(this.selectedTool)) return;
    if (this.points.length && distanceNm(point, this.points[0]) < 1e-8) {
      this.onStatus("Choose a point distinct from the start / vertex."); return;
    }
    this.points.push({ ...point });
    if (this.points.length === (this.selectedTool === "ruler" ? 2 : 3)) {
      this.measurements.push({ kind: this.selectedTool, points: this.points });
      this.points = []; this.hover = null;
    }
    this.status(); this.onChange();
  }
  render(camera) {
    this.layer.replaceChildren();
    const render = (measurement, preview = false) => {
      const points = measurement.points.map(point => camera.toScreen(point));
      const group = svgElement("g", { class: `sandbox-measurement${preview ? " measurement-preview" : ""}` });
      const line = (a, b) => {
        const element = svgElement("line", { class: "measurement-line" });
        setSvgLine(element, a.x, a.y, b.x, b.y); group.append(element);
      };
      const [a, b, c] = points;
      if (b) line(a, b);
      if (c) line(a, c);
      for (const point of points) group.append(svgElement("circle", { cx: point.x, cy: point.y, r: 3, class: "measurement-point" }));
      let label = "";
      if (measurement.kind === "ruler" && b) label = `${distanceNm(...measurement.points).toFixed(2)} NM`;
      if (measurement.kind === "angle" && c) {
        const angle = clockwiseAngle(measurement.points);
        label = `${angle.toFixed(1)}° CW`;
        const radius = Math.min(32, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - a.x, c.y - a.y) / 2);
        const bearing = bearingDegrees(a, b) * Math.PI / 180;
        const end = bearing + angle * Math.PI / 180;
        group.append(svgElement("path", { class: "measurement-arc", d: `M ${a.x + Math.sin(bearing) * radius} ${a.y - Math.cos(bearing) * radius} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${a.x + Math.sin(end) * radius} ${a.y - Math.cos(end) * radius}` }));
      }
      if (label) group.append(svgElement("text", { class: "measurement-label", x: measurement.kind === "ruler" ? (a.x + b.x) / 2 : a.x + 12, y: measurement.kind === "ruler" ? (a.y + b.y) / 2 - 12 : a.y - 15 }, label));
      this.layer.append(group);
    };
    for (const measurement of this.measurements) render(measurement);
    if (this.points.length) render({ kind: this.selectedTool, points: this.hover ? [...this.points, this.hover] : this.points }, true);
    if (this.draft) {
      const point = camera.toScreen(this.draft);
      this.layer.append(svgElement("circle", { cx: point.x, cy: point.y, r: 6, class: "draft-aircraft" }));
    }
  }
}

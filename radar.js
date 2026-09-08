import { HISTORY_DOTS, HISTORY_INTERVAL_MINUTES } from "./constants.js";
import { Camera } from "./camera.js";
import { aircraftTagRows } from "./aircraft.js";
import { RadarTools } from "./tools.js";
import { clamp, getClosestPointOnRect, nmToPx, projectPoint, setAttributes, setSvgLine, svgElement } from "./utils.js";

const boundaryFractions = [
  [0.08, 0.22], [0.25, 0.07], [0.55, 0.11], [0.72, 0.04],
  [0.94, 0.27], [0.87, 0.53], [0.97, 0.76], [0.69, 0.93],
  [0.43, 0.86], [0.18, 0.96], [0.04, 0.68], [0.13, 0.45],
];

export class RadarView {
  constructor(svg, bounds, { onStatus = () => { }, onToolsChange = () => { } } = {}) {
    this.svg = svg;
    this.bounds = bounds;
    this.camera = new Camera(bounds);
    this.frame = null;
    this.drag = null;
    this.records = new Map();
    const defs = svgElement("defs");
    this.pattern = svgElement("pattern", { id: "radar-grid-pattern", patternUnits: "userSpaceOnUse" });
    this.gridPath = svgElement("path", { class: "radar-grid-line" });
    this.pattern.append(this.gridPath);
    defs.append(this.pattern);
    this.background = svgElement("rect", { width: "100%", height: "100%", fill: "url(#radar-grid-pattern)" });
    this.boundary = svgElement("polygon", { id: "airspace-boundary" });
    this.centre = svgElement("path", { class: "centre-marker" });
    this.layers = {};
    for (const name of ["tools", "leaders", "trails", "targets", "tags"]) {
      this.layers[name] = svgElement("g", { id: `${name}-layer` });
    }
    svg.replaceChildren(defs, this.background, this.boundary, this.centre, ...Object.values(this.layers));
    this.createScale();
    this.tools = new RadarTools(this.layers.tools, () => {
      onToolsChange(this.tools);
      this.schedule();
    }, onStatus);
    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      this.camera.resize(width, height);
      setAttributes(svg, { viewBox: `0 0 ${this.camera.width} ${this.camera.height}` });
      this.schedule();
    });
    this.resizeObserver.observe(svg);
    const initialRect = svg.getBoundingClientRect();
    this.camera.resize(initialRect.width, initialRect.height);
    setAttributes(svg, { viewBox: `0 0 ${this.camera.width} ${this.camera.height}` });
    this.bindNavigation();
  }

  createScale() {
    this.scale = svgElement("g", { id: "radar-scale", "aria-hidden": "true" });
    this.scaleBackground = svgElement("rect", { x: -8, y: -15, height: 30, rx: 4, class: "scale-background" });
    this.scaleBaseline = svgElement("line", { class: "scale-line" });
    this.scaleTicks = Array.from({ length: 11 }, () => svgElement("line", { class: "scale-line" }));
    this.scaleText = svgElement("text", { class: "scale-label", y: 3 });
    this.scale.append(this.scaleBackground, this.scaleBaseline, ...this.scaleTicks, this.scaleText);
    this.svg.append(this.scale);
  }

  schedule() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.paint();
    });
  }

  setScenario(scenario) {
    if (this.drag && this.svg.hasPointerCapture(this.drag.id)) this.svg.releasePointerCapture(this.drag.id);
    this.drag = null;
    this.svg.classList.remove("panning");
    this.records.clear();
    for (const layer of Object.values(this.layers)) layer.replaceChildren();
    this.tools.reset(scenario);
    this.camera.reset();
    for (const aircraft of scenario?.aircraft ?? []) this.addAircraft(aircraft);
    this.schedule();
  }

  addAircraft(aircraft) {
    const target = svgElement("g", {
      class: "pps", "data-aircraft-id": aircraft.id,
      role: "button", tabindex: 0, "aria-label": `${aircraft.callsign} radar target`,
    });
    target.append(
      svgElement("circle", { r: 12, class: "target-hit" }),
      svgElement("circle", { r: 4.5, class: "target-symbol" }),
      svgElement("title", {}, `${aircraft.callsign}: heading ${Math.round(aircraft.heading)}°, ${aircraft.speedKts} kt`),
    );
    target.addEventListener("click", event => {
      event.stopPropagation();
      this.tools.handleTarget(aircraft);
    });
    target.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      this.tools.handleTarget(aircraft);
    });
    target.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      this.tools.clearForAircraft(aircraft);
    });
    this.layers.targets.append(target);

    const tag = svgElement("g", { class: "data-tag", "data-tag-id": aircraft.id });
    const tagBackground = svgElement("rect", { class: "tag-background", rx: 4 });
    const rows = aircraftTagRows(aircraft);
    const textNodes = rows.map((row, index) =>
      svgElement("text", { class: `tag-row tag-${row.kind}`, x: 6, y: 15 + index * 14 }, row.text));
    tag.append(tagBackground, ...textNodes);
    this.layers.tags.append(tag);
    // Measure once on creation. No bounding-box or font measurements during zoom.
    const width = Math.ceil(Math.max(...textNodes.map(text => text.getComputedTextLength()))) + 12;
    const height = rows.length * 14 + 8;
    setAttributes(tagBackground, { width, height });
    const anchor = this.camera.toScreen(aircraft);
    const offset = { x: anchor.x + width + 34 > this.camera.width - 8 ? -width - 28 : 34, y: -24 };
    if (anchor.y + offset.y < 8) offset.y = 8 - anchor.y;
    const leader = svgElement("line", { class: "leader-line" });
    this.layers.leaders.append(leader);
    const trails = Array.from({ length: HISTORY_DOTS }, (_, index) => {
      const point = projectPoint(aircraft.x, aircraft.y, aircraft.heading, aircraft.speedKts, -(index + 1) * HISTORY_INTERVAL_MINUTES);
      const dot = svgElement("circle", { r: 1.5, class: "trail-dot" });
      this.layers.trails.append(dot);
      return { point, dot };
    });
    this.records.set(aircraft.id, { aircraft, target, tag, width, height, offset, leader, trails });
  }

  paint() {
    const camera = this.camera;
    const spacing = nmToPx(10) * camera.zoom;
    const mod = value => ((value % spacing) + spacing) % spacing;
    setAttributes(this.pattern, { x: mod(camera.x), y: mod(camera.y), width: spacing, height: spacing });
    this.gridPath.setAttribute("d", `M ${spacing} 0 H 0 V ${spacing}`);
    this.boundary.setAttribute("points", boundaryFractions.map(([x, y]) => {
      const point = camera.toScreen({ x: x * this.bounds.width, y: y * this.bounds.height });
      return `${point.x},${point.y}`;
    }).join(" "));
    const centre = camera.toScreen({ x: this.bounds.width / 2, y: this.bounds.height / 2 });
    this.centre.setAttribute("d", `M ${centre.x - 5} ${centre.y} h 10 M ${centre.x} ${centre.y - 5} v 10`);
    for (const record of this.records.values()) {
      const point = camera.toScreen(record.aircraft);
      record.target.setAttribute("transform", `translate(${point.x} ${point.y})`);
      const selected = this.tools.pending?.id === record.aircraft.id;
      record.target.classList.toggle("pair-selected", selected);
      record.target.setAttribute("aria-pressed", String(selected));
      for (const { point: worldPoint, dot } of record.trails) {
        const screen = camera.toScreen(worldPoint);
        setAttributes(dot, { cx: screen.x, cy: screen.y });
      }
      const tagRect = { x: point.x + record.offset.x, y: point.y + record.offset.y, width: record.width, height: record.height };
      record.tag.setAttribute("transform", `translate(${tagRect.x} ${tagRect.y})`);
      const visible = point.x >= 0 && point.x <= camera.width && point.y >= 0 && point.y <= camera.height;
      record.tag.setAttribute("visibility", visible ? "visible" : "hidden");
      record.leader.setAttribute("visibility", visible ? "visible" : "hidden");
      const edge = getClosestPointOnRect(tagRect, point);
      setSvgLine(record.leader, point.x, point.y, edge.x, edge.y);
    }
    this.tools.render(camera);
    const distance = [1, 2, 5, 10, 20, 50].reduce((best, candidate) =>
      Math.abs(nmToPx(candidate) * camera.zoom - 90) < Math.abs(nmToPx(best) * camera.zoom - 90) ? candidate : best, 10);
    const length = nmToPx(distance) * camera.zoom;
    this.scale.setAttribute("transform", `translate(${camera.width - length - 64} 25)`);
    setAttributes(this.scaleBackground, { width: length + 66 });
    setSvgLine(this.scaleBaseline, 0, 0, length, 0);
    this.scaleTicks.forEach((tick, index) => setSvgLine(tick, length * index / 10, 0, length * index / 10, index % 10 === 0 ? -8 : -4));
    this.scaleText.setAttribute("x", length + 8);
    this.scaleText.textContent = `${distance} NM`;
  }

  localPoint(event) {
    const rect = this.svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  resetView() { this.camera.reset(); this.schedule(); }
  zoom(factor, point = { x: this.camera.width / 2, y: this.camera.height / 2 }) {
    this.camera.zoomAt(point, factor);
    this.schedule();
  }

  bindNavigation() {
    this.svg.addEventListener("wheel", event => {
      event.preventDefault();
      if (this.drag) return;
      const target = event.target.closest("[data-aircraft-id]");
      const record = target && this.records.get(target.dataset.aircraftId);
      if (record && this.tools.handleScroll(record.aircraft, event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.camera.height : 1);
      this.zoom(Math.exp(-clamp(delta, -500, 500) * 0.0015), this.localPoint(event));
    }, { passive: false });

    this.svg.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.drag || event.target.closest(".pps, .radar-tool")) return;
      const tag = event.target.closest("[data-tag-id]");
      const record = tag && this.records.get(tag.dataset.tagId);
      this.drag = {
        id: event.pointerId, record,
        x: event.clientX, y: event.clientY,
        initialX: record ? record.offset.x : this.camera.x,
        initialY: record ? record.offset.y : this.camera.y,
      };
      if (record) record.tag.classList.add("dragging");
      else this.svg.classList.add("panning");
      this.svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    this.svg.addEventListener("pointermove", event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      let x = drag.initialX + event.clientX - drag.x;
      let y = drag.initialY + event.clientY - drag.y;
      if (drag.record) {
        const distance = Math.hypot(x, y);
        if (distance > 220) { x *= 220 / distance; y *= 220 / distance; }
        drag.record.offset = { x, y };
      } else { this.camera.x = x; this.camera.y = y; }
      this.schedule();
    });
    const end = event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      this.drag = null;
      drag.record?.tag.classList.remove("dragging");
      this.svg.classList.remove("panning");
      if (this.svg.hasPointerCapture(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.svg.addEventListener(type, end);
    this.svg.addEventListener("keydown", event => {
      if (event.target !== this.svg) return;
      if (["+", "=", "-"].includes(event.key)) this.zoom(event.key === "-" ? 1 / 1.25 : 1.25);
      else if (event.key === "Home") this.resetView();
      else if (event.key.startsWith("Arrow")) {
        this.camera.x += event.key === "ArrowLeft" ? 40 : event.key === "ArrowRight" ? -40 : 0;
        this.camera.y += event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0;
        this.schedule();
      } else return;
      event.preventDefault();
    });
  }
}

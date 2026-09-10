import { HISTORY_DOTS, HISTORY_INTERVAL_MINUTES } from "./constants.js";
import { Camera } from "./camera.js";
import { aircraftTagRows, isAircraftComplete } from "./aircraft.js";
import { MapRenderer } from "./map.js";
import { RadarTools } from "./tools.js";
import { clamp, getClosestPointOnRect, nmToPx, projectPoint, setAttributes, setSvgLine, svgElement } from "./utils.js";

export class RadarView {
  constructor(svg, bounds, { map = null, theme = "blue", onStatus = () => { }, onToolsChange = () => { } } = {}) {
    this.svg = svg;
    this.mode = "normal";
    this.theme = theme;
    this.interactions = null;
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
    this.mapLayer = svgElement("g", { id: "map-layer", "aria-hidden": "true" });
    this.mapRenderer = map ? new MapRenderer(this.mapLayer, map, theme) : null;
    this.layers = {};
    for (const name of ["tools", "leaders", "trails", "targets", "tags"]) {
      this.layers[name] = svgElement("g", { id: `${name}-layer` });
    }
    svg.replaceChildren(defs, this.background, this.mapLayer, ...Object.values(this.layers));
    this.editLayer = svgElement("g", { id: "edit-layer" });
    svg.append(this.editLayer);
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

  setTheme(theme) {
    this.theme = theme;
    this.mapRenderer?.setTheme(theme);
    this.schedule();
  }

  setMap(map) {
    this.bounds = { width: nmToPx(map.widthNm), height: nmToPx(map.heightNm) };
    this.camera.bounds = this.bounds;
    this.mapLayer.replaceChildren();
    this.mapRenderer = new MapRenderer(this.mapLayer, map, this.theme);
    this.schedule();
  }

  setMode(mode, interactions = null) {
    this.cancelNavigation();
    this.mode = mode;
    this.interactions = interactions;
    this.tools.selectedTool = null;
    this.tools.cancelSelection();
    for (const [name, layer] of Object.entries(this.layers)) {
      layer.style.display = mode === "mapmaker" || (name === "tools" && mode !== "normal") ? "none" : "";
    }
    this.editLayer.replaceChildren();
    this.schedule();
  }

  cancelNavigation() {
    const drag = this.drag;
    this.drag = null;
    drag?.record?.tag?.classList.remove("dragging");
    this.svg.classList.remove("panning");
    if (drag && this.svg.hasPointerCapture(drag.id)) this.svg.releasePointerCapture(drag.id);
  }

  syncAircraft(aircraft) {
    const previous = this.records.get(aircraft.id);
    const offset = previous?.offset;
    if (previous) {
      for (const key of ["target", "tag", "leader"]) previous[key].remove();
      for (const trail of previous.trails) trail.dot.remove();
      this.records.delete(aircraft.id);
    }
    this.addAircraft(aircraft);
    if (offset) this.records.get(aircraft.id).offset = offset;
    this.tools.refreshForAircraft(aircraft);
    this.schedule();
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
    this.cancelNavigation();
    this.records.clear();
    for (const layer of Object.values(this.layers)) layer.replaceChildren();
    this.tools.reset(scenario);
    this.camera.reset();
    for (const aircraft of scenario?.aircraft ?? []) this.addAircraft(aircraft);
    this.schedule();
  }

  addAircraft(aircraft) {
    if (this.records.has(aircraft.id)) return;
    const complete = isAircraftComplete(aircraft);
    const target = svgElement("g", {
      class: `pps${complete ? "" : " incomplete"}`, "data-aircraft-id": aircraft.id,
      role: "button", tabindex: 0, "aria-label": `${aircraft.callsign} radar target`,
    });
    target.append(
      svgElement("circle", { r: 12, class: "target-hit" }),
      svgElement("circle", { r: 4.5, class: "target-symbol" }),
      svgElement("title", {}, complete ? `${aircraft.callsign}: heading ${Math.round(aircraft.heading)}°, ${aircraft.speedKts} kt` : "Incomplete aircraft · edit in Sandbox Mode"),
    );
    target.addEventListener("click", event => {
      event.stopPropagation();
      if (this.mode === "normal" && complete) this.tools.handleTarget(aircraft);
    });
    target.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      if (this.mode === "sandbox") this.interactions?.onEdit(aircraft);
      else if (this.mode === "normal" && complete) this.tools.handleTarget(aircraft);
    });
    target.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      if (this.mode === "sandbox") this.interactions?.onEdit(aircraft);
      else if (this.mode === "normal") this.tools.clearForAircraft(aircraft);
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
    const trails = Array.from({ length: complete ? HISTORY_DOTS : 0 }, (_, index) => {
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
    this.mapRenderer?.render(camera);
    for (const record of this.records.values()) {
      const point = camera.toScreen(record.aircraft);
      record.target.setAttribute("transform", `translate(${point.x} ${point.y})`);
      const selected = this.mode === "normal" && this.tools.pending?.id === record.aircraft.id;
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
    if (this.mode === "normal") this.tools.render(camera);
    this.interactions?.render(camera);
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
      if (this.mode === "normal" && record && this.tools.handleScroll(record.aircraft, event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.camera.height : 1);
      this.zoom(Math.exp(-clamp(delta, -500, 500) * 0.0015), this.localPoint(event));
    }, { passive: false });

    this.svg.addEventListener("pointerdown", event => {
      if (![0, 1].includes(event.button) || this.drag || !event.isPrimary) return;
      if (this.mode === "normal" && event.button === 0 && event.target.closest(".pps, .radar-tool")) return;
      const tag = event.target.closest("[data-tag-id]");
      const record = this.mode !== "mapmaker" && event.button === 0 && tag ? this.records.get(tag.dataset.tagId) : null;
      this.drag = {
        id: event.pointerId, button: event.button, record, moved: false,
        x: event.clientX, y: event.clientY,
        initialX: record ? record.offset.x : this.camera.x,
        initialY: record ? record.offset.y : this.camera.y,
      };
      this.svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    this.svg.addEventListener("pointermove", event => {
      const drag = this.drag;
      if (!drag) {
        this.interactions?.onMove(this.camera.toWorld(this.localPoint(event)));
        return;
      }
      if (drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      let x = drag.initialX + dx, y = drag.initialY + dy;
      if (drag.record) {
        const distance = Math.hypot(x, y);
        if (distance > 220) { x *= 220 / distance; y *= 220 / distance; }
        drag.record.offset = { x, y };
        drag.record.tag.classList.add("dragging");
      } else {
        this.camera.x = x; this.camera.y = y;
        this.svg.classList.add("panning");
      }
      this.schedule();
    });
    this.svg.addEventListener("pointerleave", () => {
      if (!this.drag) this.interactions?.onMove(null);
    });
    const end = event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const clicked = event.type === "pointerup" && !drag.moved && !drag.record && drag.button === 0;
      this.cancelNavigation();
      if (clicked) this.interactions?.onClick(this.camera.toWorld(this.localPoint(event)), event);
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.svg.addEventListener(type, end);
    this.svg.addEventListener("contextmenu", event => {
      if (this.mode === "normal") return;
      event.preventDefault();
      if (!event.target.closest(".pps")) this.interactions?.onCancel();
    });
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

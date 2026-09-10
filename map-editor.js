import { confirmAction } from "./confirm-dialog.js";
import { DEFAULT_STYLE, MapRenderer, parseMap } from "./map.js";
import { GEOMETRY_FIELDS, hitTestMap, placementFeature, serializeFeature, serializeMap } from "./map-document.js";
import { field, showErrors } from "./editor-ui.js";
import { nmToPx, pxToNm, svgElement } from "./utils.js";

const GEOMETRY_LABELS = { x: "X / east (NM)", y: "Y / south (NM)", x1: "Start X (NM)", y1: "Start Y (NM)",
  x2: "End X (NM)", y2: "End Y (NM)", cx: "Centre X (NM)", cy: "Centre Y (NM)", radius: "Radius (NM)",
  startBearing: "Start bearing (°)", endBearing: "End bearing (°)" };

export class MapEditor {
  constructor(radar, map, { onChange, onStatus }) {
    Object.assign(this, { radar, map, onChange, onStatus });
    this.selectedTool = "select";
    this.points = []; this.hover = null; this.selected = null; this.draft = null;
    this.dirty = false; this.formDirty = false; this.metadataDirty = false; this.loadRequest = 0;
    this.overlayRenderer = null;
    this.form = document.getElementById("map-element-form");
    this.fields = document.getElementById("map-element-fields");
    this.errors = document.getElementById("map-errors");
    this.layerSelect = document.getElementById("map-layer-select");
    this.featureSelect = document.getElementById("map-feature-select");
    this.form.addEventListener("submit", event => { event.preventDefault(); this.applyElement(); });
    this.form.addEventListener("input", () => { this.formDirty = true; });
    this.form.addEventListener("change", () => { this.formDirty = true; });
    document.getElementById("cancelMapElementBtn").addEventListener("click", () => this.cancel());
    document.getElementById("deleteMapElementBtn").addEventListener("click", () => this.deleteSelected());
    this.featureSelect.addEventListener("change", async () => {
      const item = this.featureSelect.value === "" ? null : this.featureChoices[Number(this.featureSelect.value)];
      if (!await this.discardForm()) { this.updateLists(); return; }
      this.selectFeature(item ?? null);
    });
    document.getElementById("addMapLayerBtn").addEventListener("click", () => this.addLayer());
    document.getElementById("saveMapBtn").addEventListener("click", () => this.save());
    const fileInput = document.getElementById("map-file-input");
    document.getElementById("loadMapBtn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0]; fileInput.value = "";
      if (file) await this.loadFile(file);
    });
    const metadata = document.getElementById("map-metadata-form");
    metadata.addEventListener("input", () => { this.metadataDirty = true; });
    metadata.addEventListener("submit", event => { event.preventDefault(); this.applyMetadata(); });
    this.updateLists(); this.showMetadata(); this.showForm();
  }

  enter() { this.selectedTool = "select"; this.cancel(); this.status(); }
  async leave() {
    if ((this.formDirty || this.draft || this.metadataDirty) &&
      !await confirmAction("Discard unapplied form changes and leave Map-Maker? All applied map edits will be kept.")) return false;
    this.loadRequest++;
    this.selected = null; this.draft = null; this.points = []; this.hover = null;
    this.formDirty = false; this.metadataDirty = false; this.overlayRenderer = null;
    this.showMetadata(); this.showForm();
    return true;
  }
  async discardForm() {
    return !(this.formDirty || this.draft) || await confirmAction("Discard unapplied element changes?");
  }
  error(message) { showErrors(this.errors, { map: message }); }
  changed() {
    this.dirty = true;
    this.radar.setMap(this.map);
    this.updateLists(); this.updateOverlay(); this.onChange(this.map); this.status();
  }
  status() {
    const message = {
      select: "Select: click a map element, or choose it from the element list. Drag to pan; wheel to zoom.",
      point: "Point: click a position, then Apply element in the inspector.",
      line: this.points.length ? "Line: click the endpoint." : "Line: click the start point.",
      circle: this.points.length ? "Circle: click the radius endpoint." : "Circle: click the centre.",
      arc: ["Arc: click the centre.", "Arc: click the start of the arc to set its radius.", "Arc: click the end bearing. The arc sweeps clockwise from the start."][this.points.length],
    }[this.selectedTool];
    this.onStatus(this.draft ? "Review the new element in the inspector, then Apply element or Cancel." : message);
    document.getElementById("map-save-status").textContent = this.dirty ? "Unsaved map edits" : "Map unchanged since load / download";
    document.querySelectorAll("[data-map-tool]").forEach(button => {
      const active = button.dataset.mapTool === this.selectedTool;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
    this.radar.svg.classList.toggle("placing", this.selectedTool !== "select");
  }
  async selectTool(kind) {
    if (!await this.discardForm()) return;
    this.selectedTool = kind;
    this.selected = null; this.cancel(); this.status();
  }
  cancel() {
    this.points = []; this.hover = null; this.draft = null; this.formDirty = false;
    this.showForm(); this.updateOverlay(); this.status();
    showErrors(this.errors, {});
  }
  selectFeature(item) {
    this.selectedTool = "select";
    this.selected = item; this.points = []; this.hover = null; this.draft = null; this.formDirty = false;
    if (item) this.layerSelect.value = item.layer.name;
    this.showForm(); this.updateLists(); this.updateOverlay(); this.status();
  }
  async click(worldPoint) {
    if (this.draft) { this.status(); return; }
    if (this.selectedTool === "select") {
      if (await this.discardForm()) this.selectFeature(hitTestMap(this.map, worldPoint, this.radar.camera));
      return;
    }
    const point = { x: pxToNm(worldPoint.x), y: pxToNm(worldPoint.y) };
    if (this.points.length && Math.hypot(point.x - this.points[0].x, point.y - this.points[0].y) < 1e-8) {
      this.error("Choose a point distinct from the start / centre."); return;
    }
    const points = [...this.points, point];
    const count = { point: 1, line: 2, circle: 2, arc: 3 }[this.selectedTool];
    const layer = this.map.layers.find(layer => layer.name === this.layerSelect.value);
    if (!layer) { this.error("Create or choose a layer first."); return; }
    if (points.length === count) {
      const feature = placementFeature(this.selectedTool, points, layer.defaults);
      if (!feature) { this.error("Use a positive radius and a non-zero arc sweep; use Circle for a full circle."); return; }
      this.draft = { layer, feature };
      this.points = []; this.hover = null;
      this.showForm();
    } else this.points = points;
    showErrors(this.errors, {}); this.updateOverlay(); this.status();
  }
  move(worldPoint) {
    this.hover = worldPoint ? { x: pxToNm(worldPoint.x), y: pxToNm(worldPoint.y) } : null;
    if (this.points.length) this.updateOverlay();
  }
  updateOverlay() {
    this.radar.editLayer.replaceChildren();
    const chosen = this.draft ?? this.selected;
    let feature = chosen?.feature;
    if (this.points.length && this.hover) {
      const points = [...this.points, this.hover];
      // Show a radius line until an arc has enough points for a sweep.
      feature = this.selectedTool === "arc" && points.length === 2
        ? placementFeature("line", points)
        : placementFeature(this.selectedTool, points);
    }
    this.overlayRenderer = feature ? new MapRenderer(this.radar.editLayer, { layers: [{ name: "editor-preview", features: [{
      ...feature, style: { ...feature.style, color: "var(--cyan)", opacity: 1, width: Math.max(3, feature.style.width + 2),
        pattern: "dashed", size: feature.style.size + 3, filled: false },
    }] }] }, "blue") : null;
    this.radar.schedule();
  }
  render(camera) {
    this.overlayRenderer?.render(camera);
    this.radar.editLayer.querySelectorAll(".map-placement-anchor").forEach(node => node.remove());
    for (const point of this.points) {
      const screen = camera.toScreen({ x: nmToPx(point.x), y: nmToPx(point.y) });
      this.radar.editLayer.append(svgElement("circle", { class: "map-placement-anchor", cx: screen.x, cy: screen.y, r: 4 }));
    }
  }

  updateLists() {
    const layerName = this.layerSelect.value || this.selected?.layer.name;
    this.layerSelect.replaceChildren();
    this.featureSelect.replaceChildren(new Option("Choose an element…", ""));
    this.featureChoices = [];
    for (const layer of this.map.layers) {
      this.layerSelect.add(new Option(layer.name, layer.name));
      layer.features.forEach((feature, index) => {
        const value = String(this.featureChoices.length);
        this.featureChoices.push({ layer, feature });
        this.featureSelect.add(new Option(`${layer.name} · ${feature.kind} ${index + 1}${feature.style.label ? ` · ${feature.style.label}` : ""}`, value));
        if (this.selected?.feature === feature) this.featureSelect.value = value;
      });
    }
    if (this.map.layers.some(layer => layer.name === layerName)) this.layerSelect.value = layerName;
  }
  showForm() {
    const chosen = this.draft ?? this.selected;
    this.form.hidden = !chosen;
    document.getElementById("map-selection-help").hidden = Boolean(chosen);
    document.getElementById("deleteMapElementBtn").disabled = !this.selected || Boolean(this.draft);
    if (!chosen) return;
    document.getElementById("map-element-title").textContent = `${this.draft ? "New" : "Edit"} ${chosen.feature.kind}`;
    this.fields.replaceChildren();
    this.controls = {};
    this.controls.layer = field(this.fields, "layer", "Element layer", { value: chosen.layer.name, options: this.map.layers.map(layer => layer.name) });
    for (const key of GEOMETRY_FIELDS[chosen.feature.kind]) this.controls[key] = field(this.fields, key, GEOMETRY_LABELS[key], { value: chosen.feature[key], type: "number" });
    const add = (key, label, options = {}) => {
      this.controls[key] = field(this.fields, key, label, { value: chosen.feature.style[key], ...options });
    };
    add("color", "Colour (CSS / hex)");
    add("opacity", "Opacity (0–1)", { type: "number" });
    add("width", "Line width (screen px)", { type: "number" });
    if (chosen.feature.kind === "point") {
      add("shape", "Point style", { options: ["circle", "square", "triangle", "diamond", "cross"] });
      add("size", "Point size (screen px)", { type: "number" });
      add("rotation", "Point rotation (°)", { type: "number" });
      add("filled", "Filled marker", { options: ["false", "true"] });
      add("label", "Point label");
    } else {
      add("pattern", "Line pattern", { options: ["solid", "dashed", "dotted", "hashed"] });
      add("hashSpacing", "Hash spacing (screen px)", { type: "number" });
      add("hashLength", "Hash length (screen px)", { type: "number" });
    }
  }
  applyElement() {
    const chosen = this.draft ?? this.selected;
    if (!chosen) return false;
    const feature = { ...chosen.feature, style: { ...chosen.feature.style } };
    const errors = {};
    const geometry = GEOMETRY_FIELDS[feature.kind];
    for (const [key, control] of Object.entries(this.controls)) {
      if (key === "layer") continue;
      let value = control.value;
      if (control.type === "number") {
        if (!value.trim() || !Number.isFinite(Number(value))) errors[key] = "Enter a finite number.";
        value = Number(value);
      } else if (key === "filled") value = value === "true";
      if (geometry.includes(key)) feature[key] = value;
      else feature.style[key] = value;
    }
    showErrors(this.errors, errors, this.controls);
    if (Object.keys(errors).length) return false;
    try {
      parseMap(`MAP "Element validation"\nSIZE 1 1\n${serializeFeature(feature)}`, "Element");
    } catch (error) { this.error(error.message); return false; }
    const layer = this.map.layers.find(layer => layer.name === this.controls.layer.value);
    if (!layer) { this.error("Choose an existing layer."); return false; }
    if (this.draft) layer.features.push(feature);
    else {
      const index = chosen.layer.features.indexOf(chosen.feature);
      if (layer === chosen.layer) layer.features.splice(index, 1, feature);
      else { chosen.layer.features.splice(index, 1); layer.features.push(feature); }
    }
    this.draft = null; this.formDirty = false; this.selectedTool = "select";
    this.selected = { layer, feature };
    this.showForm(); this.changed();
    return true;
  }
  deleteSelected() {
    if (!this.selected || this.draft) return;
    const { layer, feature } = this.selected;
    layer.features.splice(layer.features.indexOf(feature), 1);
    this.selected = null; this.formDirty = false;
    this.showForm(); this.changed();
  }
  addLayer() {
    const input = document.getElementById("new-map-layer");
    const name = input.value.trim();
    if (!/^[a-z][a-z0-9_-]*$/i.test(name)) { this.error("Layer names must start with a letter and contain only letters, digits, _ or -."); return; }
    if (this.map.layers.some(layer => layer.name === name)) { this.error("That layer already exists; choose it from the layer list."); return; }
    this.map.layers.push({ name, defaults: { ...DEFAULT_STYLE }, features: [] });
    input.value = ""; this.changed(); this.layerSelect.value = name;
    if (this.selected || this.draft) this.controls.layer.add(new Option(name, name));
    showErrors(this.errors, {});
  }
  showMetadata() {
    document.getElementById("map-name").value = this.map.name;
    document.getElementById("map-width").value = this.map.widthNm;
    document.getElementById("map-height").value = this.map.heightNm;
  }
  applyMetadata() {
    const name = document.getElementById("map-name").value.trim();
    const widthNm = Number(document.getElementById("map-width").value);
    const heightNm = Number(document.getElementById("map-height").value);
    if (!name || !Number.isFinite(widthNm) || !Number.isFinite(heightNm) || widthNm <= 0 || heightNm <= 0) {
      this.error("Enter a map name and positive, finite width and height in NM."); return;
    }
    try { serializeMap({ ...this.map, name, widthNm, heightNm }); }
    catch (error) { this.error(error.message); return; }
    Object.assign(this.map, { name, widthNm, heightNm });
    this.metadataDirty = false; showErrors(this.errors, {}); this.changed();
  }

  async loadFile(file) {
    const request = ++this.loadRequest;
    try {
      const source = await file.text();
      const nextMap = parseMap(source, file.name);
      if (request !== this.loadRequest || this.radar.mode !== "mapmaker") return;
      if ((this.dirty || this.formDirty || this.draft || this.metadataDirty || this.points.length) &&
        !await confirmAction("Replace this map? Unsaved map edits and unapplied changes will be lost. Cancel to keep them, or Save Map first.")) return;
      this.map = nextMap; this.selected = null; this.draft = null; this.points = []; this.hover = null;
      this.dirty = false; this.formDirty = false; this.metadataDirty = false; this.selectedTool = "select";
      this.radar.setMap(this.map);
      this.showMetadata(); this.showForm(); this.updateLists(); this.updateOverlay();
      this.onChange(this.map); showErrors(this.errors, {}); this.status();
    } catch (error) { if (request === this.loadRequest) this.error(error.message); }
  }
  save() {
    if (this.formDirty || this.draft || this.metadataDirty) {
      this.error("Apply or cancel the form changes before downloading the map."); return;
    }
    try {
      const source = serializeMap(this.map);
      const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${this.map.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "radar-map"}.map`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.dirty = false; showErrors(this.errors, {}); this.status();
    } catch (error) { this.error(error.message); }
  }
}

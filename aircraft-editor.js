import { AIRCRAFT_TYPES } from "./constants.js";
import { createAircraftDraft, isAircraftComplete, validateAircraftInput } from "./aircraft.js";
import { pxToNm } from "./utils.js";
import { field, showErrors } from "./editor-ui.js";

export class AircraftEditor {
  constructor(session, { onSave, onPreview }) {
    this.session = session;
    this.onSave = onSave;
    this.onPreview = onPreview;
    this.dialog = document.getElementById("aircraft-dialog");
    this.form = document.getElementById("aircraft-form");
    this.fields = document.getElementById("aircraft-fields");
    this.errors = document.getElementById("aircraft-errors");
    this.form.addEventListener("submit", event => { event.preventDefault(); this.save(); });
    document.getElementById("cancelAircraftBtn").addEventListener("click", () => this.cancel());
    this.dialog.addEventListener("cancel", event => { event.preventDefault(); this.cancel(); });
    this.dialog.addEventListener("close", () => this.onPreview(null));
    this.form.addEventListener("input", () => this.updateRequirements());
    this.form.addEventListener("change", () => this.updateRequirements());
  }

  open(aircraftOrPoint, isNew = false) {
    if (this.dialog.open) return;
    this.original = isNew ? createAircraftDraft(aircraftOrPoint) : aircraftOrPoint;
    this.isNew = isNew;
    this.fields.replaceChildren();
    this.controls = {};
    document.getElementById("aircraft-dialog-title").textContent = isNew ? "Place aircraft" : `Edit ${this.original.callsign || "incomplete aircraft"}`;
    document.getElementById("aircraft-identity").textContent = `Aircraft ID: ${this.original.id} (read-only)`;
    const add = (key, label, options) => {
      this.controls[key] = field(this.fields, key, label, { value: this.original[key], ...options });
    };
    add("callsign", "Callsign");
    add("aircraftType", "Aircraft type", { options: [{ value: "", label: "Not specified" }, ...Object.keys(AIRCRAFT_TYPES)] });
    add("x", "X / east (NM)", { type: "number", value: pxToNm(this.original.x), required: true });
    add("y", "Y / south (NM)", { type: "number", value: pxToNm(this.original.y), required: true });
    add("heading", "Heading (° clockwise from north)", { type: "number" });
    add("speedKts", "Speed (kt)", { type: "number" });
    add("flightLevel", "Flight level (hundreds of feet)", { type: "number" });
    add("verticalRateFpm", "Vertical rate (ft/min; + climb, − descend)", { type: "number" });
    add("clearedFlightLevel", "Cleared flight level", { type: "number" });
    showErrors(this.errors, {}, this.controls);
    this.updateRequirements();
    if (isNew) this.onPreview(this.original);
    this.dialog.showModal();
    this.controls.callsign.focus();
  }

  values() { return Object.fromEntries(Object.entries(this.controls).map(([key, input]) => [key, input.value])); }

  updateRequirements() {
    const level = this.controls.verticalRateFpm.value.trim() !== "" && Number(this.controls.verticalRateFpm.value) === 0;
    this.controls.clearedFlightLevel.readOnly = level;
    if (level) this.controls.clearedFlightLevel.value = this.controls.flightLevel.value;
    const model = AIRCRAFT_TYPES[this.controls.aircraftType.value];
    document.getElementById("aircraft-envelope").textContent = model
      ? `Type limits: ${model.minSpeedKts}–${model.maxSpeedKts} kt, FL180–${model.maxFlightLevel}, vertical rate ±${model.maxVerticalRateFpm} ft/min.`
      : "Choose an aircraft type to see its simplified performance limits.";
    const result = validateAircraftInput(this.values(), this.original, this.session.aircraft);
    document.getElementById("aircraft-completeness").textContent = result.valid && isAircraftComplete(result.aircraft)
      ? "Ready: Save will create or update exactly one flight strip."
      : "A strip requires callsign, type, position, heading, speed, flight level, vertical rate and a reachable clearance. Blank fields may be saved as incomplete traffic. At zero vertical rate, clearance equals flight level automatically.";
  }

  save() {
    const result = validateAircraftInput(this.values(), this.original, this.session.aircraft);
    for (const [key, input] of Object.entries(this.controls)) if (input.validity.badInput) {
      result.errors[key] = "Enter a valid number, or deliberately clear the field."; result.valid = false;
    }
    showErrors(this.errors, result.errors, this.controls);
    if (!result.valid) { this.controls[Object.keys(result.errors)[0]]?.focus(); return; }
    const aircraft = this.session.saveAircraft(result.aircraft);
    this.dialog.close();
    this.onPreview(null);
    this.onSave(aircraft);
  }

  cancel() {
    if (this.dialog.open) this.dialog.close();
    this.onPreview(null);
  }
}

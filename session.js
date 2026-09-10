import { isAircraftComplete } from "./aircraft.js";
import { findPredictedConflicts } from "./scenarios.js";

// Aircraft objects are shared by the session, radar, strips and target tools.
// Drafts live in the editor and only enter this state after a successful Save.
export class Session {
  constructor(bounds) {
    this.mode = "normal";
    this.returnMode = "normal";
    this.warningIds = new Set();
    this.replaceScenario(null, bounds);
  }

  replaceScenario(scenario, bounds) {
    this.scenario = scenario;
    this.aircraft = scenario?.aircraft ?? [];
    this.referenceBounds = { ...bounds };
    this.startUtcSeconds = scenario?.startUtcSeconds ?? Math.floor(Date.now() / 1000) % 86400;
    this.warningIds.clear();
    this.answerStale = false;
    this.hasAircraftEdits = false;
  }

  setMode(mode) {
    if (!["normal", "sandbox", "mapmaker"].includes(mode)) throw new Error("Unknown application mode");
    if (mode === this.mode) return false;
    if (mode === "mapmaker") this.returnMode = this.mode;
    this.mode = mode;
    return true;
  }

  saveAircraft(draft) {
    const existing = this.aircraft.find(aircraft => aircraft.id === draft.id);
    if (existing && Object.keys(draft).every(key => draft[key] === existing[key])) return existing;
    if (existing) Object.assign(existing, draft);
    else this.aircraft.push(draft);
    this.hasAircraftEdits = true;
    if (this.scenario) this.answerStale = true;
    return existing ?? draft;
  }

  recalculateAnswer() {
    if (!this.scenario) return false;
    if (!this.aircraft.every(isAircraftComplete)) throw new Error("Complete every aircraft before recalculating the answer.");
    this.scenario.conflicts = findPredictedConflicts(this.aircraft, this.scenario.lookaheadMinutes);
    this.answerStale = false;
    return true;
  }

  get stripContext() {
    return { aircraft: this.aircraft, startUtcSeconds: this.startUtcSeconds };
  }
}

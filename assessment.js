import test from "node:test";
import assert from "node:assert/strict";
import { renderFlightStrips, hideSolution, toggleSolution } from "../ui.js";
import { installDocument } from "./dom-fixture.js";

test("strip clicks toggle warnings and Reveal grades the warning selection", t => {
  const { nodes } = installDocument(t, ["flight-strips", "scenario-clock", "solution-panel", "revealSolutionBtn"]);
  const aircraft = ["a", "b", "extra"].map((id, index) => ({
    id, callsign: `ACA${index + 100}`, aircraftType: "A320", x: 120 + index * 30, y: 150,
    heading: 90, speedKts: 450, flightLevel: 350, verticalRateFpm: 0, clearedFlightLevel: 350,
  }));
  const scenario = { aircraft, startUtcSeconds: 86340, conflicts: [{
    aircraftA: aircraft[0], aircraftB: aircraft[1], firstLossMinutes: 2,
    cpaHorizontalNm: 0, cpaVerticalFt: 0, cpaMinutes: 3,
  }] };
  const warnings = new Set();
  const panel = nodes.get("solution-panel");
  hideSolution();
  renderFlightStrips(scenario, { width: 500, height: 500 }, warnings);
  const strips = nodes.get("flight-strips").children;
  const byId = new Map(strips.map(strip => [strip.dataset.aircraftId, strip]));
  for (const strip of strips) {
    assert.equal(strip.tagName, "BUTTON");
    assert.equal(strip.type, "button");
    assert.equal(strip.getAttribute("aria-pressed"), "false");
    assert.equal(strip.children[1].textContent, "W");
  }
  byId.get("a").click();
  assert.ok(warnings.has("a"));
  assert.ok(byId.get("a").classList.contains("warning"));
  assert.equal(byId.get("a").getAttribute("aria-pressed"), "true");
  byId.get("extra").click();
  assert.equal(toggleSolution(scenario, warnings).passed, false);
  assert.equal(panel.dataset.result, "missed");
  assert.doesNotMatch(panel.textContent, /well done|passed/i);
  assert.match(panel.textContent, /Missing: ACA101/);
  toggleSolution(scenario, warnings);
  assert.equal(panel.hidden, true);
  byId.get("b").click();
  assert.equal(toggleSolution(scenario, warnings).passed, true);
  assert.match(panel.textContent, /Scenario passed — well done!/);
  assert.equal(nodes.get("revealSolutionBtn").getAttribute("aria-expanded"), "true");

  // Results describe the selection at reveal; hiding/revealing reassesses it.
  byId.get("a").click();
  assert.equal(byId.get("a").getAttribute("aria-pressed"), "false");
  assert.equal(warnings.has("a"), false);
  assert.equal(panel.dataset.result, "pass");
  toggleSolution(scenario, warnings);
  assert.equal(toggleSolution(scenario, warnings).passed, false);

  warnings.clear();
  hideSolution();
  renderFlightStrips(scenario, { width: 500, height: 500 }, warnings);
  assert.equal(panel.hidden, true);
  assert.equal(panel.dataset.result, undefined);
  assert.ok(nodes.get("flight-strips").children.every(strip => strip.getAttribute("aria-pressed") === "false"));
});

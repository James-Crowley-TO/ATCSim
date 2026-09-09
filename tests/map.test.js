import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWarnings } from "../assessment.js";

const a = { id: "a", callsign: "ACA101" };
const b = { id: "b", callsign: "WJA202" };
const c = { id: "c", callsign: "ACA101" };
const scenario = { conflicts: [{ aircraftA: a, aircraftB: b }, { aircraftA: { ...a }, aircraftB: c }] };

test("all aircraft in all answer pairs must be warned; shared aircraft count once", () => {
  const result = evaluateWarnings(scenario, new Set(["a", "b", "c"]));
  assert.deepEqual(result, { passed: true, requiredCount: 3, markedCount: 3, missingAircraft: [] });
});

test("additional warnings never prevent a pass", () => {
  assert.equal(evaluateWarnings(scenario, new Set(["a", "b", "c", "d", "e"])).passed, true);
});

test("extra warnings cannot substitute for a missing answer aircraft", () => {
  const result = evaluateWarnings(scenario, new Set(["a", "b", "d", "e"]));
  assert.equal(result.passed, false);
  assert.deepEqual(result.missingAircraft, [c]);
  assert.equal(result.markedCount, 2);
});

test("unmarked aircraft and matching callsigns with different IDs do not pass", () => {
  assert.equal(evaluateWarnings(scenario).markedCount, 0);
  assert.equal(evaluateWarnings(scenario, new Set(["ACA101", "WJA202"])).passed, false);
  assert.equal(evaluateWarnings(scenario, new Set(["a", "b"])).passed, false);
});

test("an answer with no conflicts has no required warnings", () => {
  assert.equal(evaluateWarnings({ conflicts: [] }).passed, true);
  assert.equal(evaluateWarnings({ conflicts: [] }, new Set(["extra"])).passed, true);
});

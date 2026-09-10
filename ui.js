import { aircraftTagRows, isAircraftComplete } from "./aircraft.js";
import { centreCrossingMinutes, normalizeHeading, utcTime } from "./utils.js";

export { evaluateWarnings } from "./assessment.js";
import { evaluateWarnings } from "./assessment.js";

function element(tagName, className = "", text = "") {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function headingLabel(heading) {
    return String(Math.round(normalizeHeading(heading)) % 360).padStart(3, "0");
}

function buildFlightStrip(aircraft, crossingMinutes, startUtcSeconds, warningIds) {
    const strip = element("button", "flight-strip");
    strip.type = "button";
    strip.dataset.aircraftId = aircraft.id;
    strip.setAttribute("aria-label", `${aircraft.callsign} warning`);
    strip.setAttribute("aria-describedby", "strip-help");

    const updateWarning = () => {
        const warning = warningIds.has(aircraft.id);
        strip.classList.toggle("warning", warning);
        strip.setAttribute("aria-pressed", String(warning));
        strip.title = `${aircraft.callsign}: ${warning ? "clear" : "mark"} warning`;
    };
    strip.addEventListener("click", () => {
        if (warningIds.has(aircraft.id)) warningIds.delete(aircraft.id);
        else warningIds.add(aircraft.id);
        updateWarning();
    });
    updateWarning();

    const data = element("span", "strip-data");
    for (const row of aircraftTagRows(aircraft)) {
        const line = element("span", `strip-${row.kind}`, row.text);
        if (row.kind === "clearance") {
            line.title = `Cleared to FL${aircraft.clearedFlightLevel}`;
        }
        data.append(line);
    }

    const warning = element("span", "strip-warning", "W");
    warning.setAttribute("aria-hidden", "true");
    const details = element("span", "strip-details");
    const label = element("span", "strip-time-label", "CENTRE");
    const estimate = element("time", "strip-eta");
    const estimateUtc = utcTime(startUtcSeconds, crossingMinutes);
    estimate.textContent = estimateUtc.label;
    estimate.setAttribute("datetime", `${estimateUtc.text}Z`);
    estimate.title = "Time of closest approach to the original radar centre; Z means UTC.";

    const heading = element("span", "strip-heading", `HDG ${headingLabel(aircraft.heading)}°`);
    details.append(label, estimate, heading);
    strip.append(data, warning, details);
    return strip;
}

export function renderFlightStrips(scenario, bounds, warningIds = new Set()) {
    const scenarioTime = utcTime(scenario.startUtcSeconds);
    const clock = document.getElementById("scenario-clock");
    clock.textContent = scenarioTime.text;
    clock.setAttribute("datetime", `${scenarioTime.text}Z`);

    const centre = { x: bounds.width / 2, y: bounds.height / 2 };
    const orderedAircraft = scenario.aircraft
        .filter(isAircraftComplete)
        .map(aircraft => ({
            aircraft,
            crossingMinutes: centreCrossingMinutes(aircraft, centre),
        }))
        .sort((left, right) =>
            left.crossingMinutes - right.crossingMinutes ||
            left.aircraft.callsign.localeCompare(right.aircraft.callsign)
        );

    const strips = orderedAircraft.map(({ aircraft, crossingMinutes }) =>
        buildFlightStrip(aircraft, crossingMinutes, scenario.startUtcSeconds, warningIds)
    );
    document.getElementById("flight-strips").replaceChildren(...strips);
}

export function renderScenarioBriefing(scenario, mapName = "") {
    const mapLabel = mapName ? `${mapName.toUpperCase()} · ` : "";
    document.getElementById("scenario-meta").textContent =
        `${mapLabel}${scenario.difficulty.toUpperCase()} · ${scenario.aircraft.length} aircraft · ` +
        `${scenario.lookaheadMinutes} min look-ahead`;

    document.getElementById("scenario-objective").textContent =
        `Identify every pair predicted to lose ${scenario.separation.horizontalNm} NM / ` +
        `${scenario.separation.verticalFt.toLocaleString()} ft separation. ` +
        "Mark the involved aircraft by clicking their flight strips, then reveal the answer. Extra warnings are allowed.";
}

export function hideSolution() {
    const panel = document.getElementById("solution-panel");
    const button = document.getElementById("revealSolutionBtn");
    panel.hidden = true;
    panel.replaceChildren();
    delete panel.dataset.result;
    button.textContent = "Reveal answer";
    button.setAttribute("aria-expanded", "false");
}

export function toggleSolution(scenario, warningIds = new Set()) {
    const panel = document.getElementById("solution-panel");
    const button = document.getElementById("revealSolutionBtn");
    if (!panel.hidden) {
        hideSolution();
        return;
    }

    const result = evaluateWarnings(scenario, warningIds);
    const feedback = element("div", `assessment-result ${result.passed ? "assessment-pass" : "assessment-missed"}`);
    const resultHeading = element("strong", "assessment-heading", result.passed
        ? "Scenario passed — well done!"
        : "Some aircraft were missed");
    const resultDetails = element("p", "assessment-details", result.passed
        ? `${result.requiredCount} of ${result.requiredCount} aircraft in the answer were marked at reveal. Additional warnings are allowed.`
        : `${result.markedCount} of ${result.requiredCount} aircraft in the answer were marked at reveal. Missing: ${result.missingAircraft.map(aircraft => aircraft.callsign).join(", ")}.`);
    feedback.append(resultHeading, resultDetails);

    const count = scenario.conflicts.length;
    const heading = element(
        "strong",
        "",
        `${count} predicted conflict${count === 1 ? "" : "s"}`
    );
    const list = element("ol");

    for (const conflict of scenario.conflicts) {
        const item = element(
            "li",
            "",
            `${conflict.aircraftA.callsign} / ${conflict.aircraftB.callsign}: ` +
            `loss begins in ~${conflict.firstLossMinutes} min; ` +
            `CPA ${conflict.cpaHorizontalNm} NM / ` +
            `${conflict.cpaVerticalFt.toLocaleString()} ft at ~${conflict.cpaMinutes} min.`
        );
        list.append(item);
    }

    panel.dataset.result = result.passed ? "pass" : "missed";
    panel.replaceChildren(feedback, heading, list);
    panel.hidden = false;
    button.textContent = "Hide answer";
    button.setAttribute("aria-expanded", "true");
    return result;
}

export function showGenerationError(message) {
    hideSolution();
    document.getElementById("scenario-meta").textContent = "SCENARIO GENERATION ERROR";
    document.getElementById("scenario-objective").textContent = message;
}

import { centreCrossingMinutes, utcTime } from "./utils.js";
import { aircraftTagRows } from "./aircraft.js";

export function renderFlightStrips(scenario, bounds) {
  const clock = document.getElementById("scenario-clock");
  const time = utcTime(scenario.startUtcSeconds);
  clock.textContent = time.text;
  clock.setAttribute("datetime", `${time.text}Z`);
  const centre = { x: bounds.width / 2, y: bounds.height / 2 };
  const sorted = scenario.aircraft.map(aircraft => ({
    aircraft, crossing: centreCrossingMinutes(aircraft, centre),
  })).sort((a, b) => a.crossing - b.crossing || a.aircraft.callsign.localeCompare(b.aircraft.callsign));
  const strips = sorted.map(({ aircraft, crossing }) => {
    const strip = document.createElement("article");
    strip.className = "flight-strip";
    strip.dataset.aircraftId = aircraft.id;
    strip.setAttribute("aria-label", `${aircraft.callsign} flight strip`);
    const data = document.createElement("div");
    data.className = "strip-data";
    for (const row of aircraftTagRows(aircraft)) {
      const line = document.createElement("div");
      line.className = `strip-${row.kind}`;
      line.textContent = row.text;
      if (row.kind === "clearance") line.title = `Cleared to FL${aircraft.clearedFlightLevel}`;
      data.append(line);
    }
    const details = document.createElement("div");
    details.className = "strip-details";
    const label = document.createElement("span");
    label.className = "strip-time-label";
    label.textContent = "CENTRE";
    const estimate = document.createElement("time");
    estimate.className = "strip-eta";
    const utc = utcTime(scenario.startUtcSeconds, crossing);
    estimate.textContent = utc.label;
    estimate.title = "Time of closest approach to the original radar centre; Z means UTC.";
    const heading = document.createElement("span");
    heading.className = "strip-heading";
    heading.textContent = `HDG ${String(Math.round(aircraft.heading) % 360).padStart(3, "0")}°`;
    details.append(label, estimate, heading);
    strip.append(data, details);
    return strip;
  });
  document.getElementById("flight-strips").replaceChildren(...strips);
}

export function renderScenarioBriefing(scenario) {
  document.getElementById("scenario-meta").textContent =
    `${scenario.difficulty.toUpperCase()} · ${scenario.aircraft.length} aircraft · ${scenario.lookaheadMinutes} min look-ahead`;

  document.getElementById("scenario-objective").textContent =
    `Identify every pair predicted to lose ${scenario.separation.horizontalNm} NM / ` +
    `${scenario.separation.verticalFt.toLocaleString()} ft separation. Use the radar tools before revealing the answer.`;
}

export function hideSolution() {
  const panel = document.getElementById("solution-panel");
  const button = document.getElementById("revealSolutionBtn");
  panel.hidden = true;
  panel.innerHTML = "";
  button.textContent = "Reveal answer";
  button.setAttribute("aria-expanded", "false");
}

export function toggleSolution(scenario) {
  const panel = document.getElementById("solution-panel");
  const button = document.getElementById("revealSolutionBtn");

  if (!panel.hidden) {
    hideSolution();
    return;
  }

  const heading = document.createElement("strong");
  heading.textContent = `${scenario.conflicts.length} predicted conflict${scenario.conflicts.length === 1 ? "" : "s"}`;
  panel.appendChild(heading);

  const list = document.createElement("ol");
  for (const conflict of scenario.conflicts) {
    const item = document.createElement("li");
    item.textContent =
      `${conflict.aircraftA.callsign} / ${conflict.aircraftB.callsign}: ` +
      `loss begins in ~${conflict.firstLossMinutes} min; ` +
      `CPA ${conflict.cpaHorizontalNm} NM / ${conflict.cpaVerticalFt.toLocaleString()} ft at ~${conflict.cpaMinutes} min.`;
    list.appendChild(item);
  }
  panel.appendChild(list);
  panel.hidden = false;
  button.textContent = "Hide answer";
  button.setAttribute("aria-expanded", "true");
}

export function showGenerationError(message) {
  document.getElementById("scenario-meta").textContent = "SCENARIO GENERATION ERROR";
  document.getElementById("scenario-objective").textContent = message;
  hideSolution();
}

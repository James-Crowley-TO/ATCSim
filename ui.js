import { nmToPx } from "./utils.js";

export function renderRadarScale(scaleBar, scaleLabel, distanceNm = 10, zoom = 1) {
  scaleBar.innerHTML = "";
  scaleBar.style.width = `${nmToPx(distanceNm) * zoom}px`;
  scaleLabel.textContent = `${distanceNm} NM`;

  for (let i = 0; i <= distanceNm; i += 1) {
    const tick = document.createElement("span");
    tick.className = i === 0 || i === distanceNm ? "scale-tick end" : "scale-tick";
    tick.style.left = `${(i / distanceNm) * 100}%`;
    scaleBar.appendChild(tick);
  }
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

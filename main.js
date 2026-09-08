import { DIFFICULTIES } from "./constants.js";
import { generateScenario } from "./scenarios.js";
import { RadarView } from "./radar.js";
import { hideSolution, renderFlightStrips, renderScenarioBriefing, showGenerationError, toggleSolution } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
  const difficultySelect = document.getElementById("difficultySelect");
  const status = document.getElementById("tool-status");
  const buttons = [...document.querySelectorAll(".tool-btn")];
  const bounds = { width: 760, height: 760 };
  let currentScenario = null;
  const radar = new RadarView(document.getElementById("radar-svg"), bounds, {
    onStatus: message => { status.textContent = message; },
    onToolsChange: tools => {
      for (const button of buttons) {
        const active = tools.selectedTool === button.dataset.tool;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    },
  });

  for (const difficulty of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = difficulty;
    option.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
    difficultySelect.append(option);
  }
  difficultySelect.value = "easy";

  function generate() {
    hideSolution();
    try {
      currentScenario = generateScenario(difficultySelect.value, bounds);
      radar.setScenario(currentScenario);
      renderFlightStrips(currentScenario, bounds);
      renderScenarioBriefing(currentScenario);
    } catch (error) {
      currentScenario = null;
      radar.setScenario(null);
      document.getElementById("flight-strips").replaceChildren();
      document.getElementById("scenario-clock").textContent = "--:--:--";
      showGenerationError(error instanceof Error ? error.message : "Unable to generate scenario");
    }
  }

  buttons.forEach(button => button.addEventListener("click", () => radar.tools.select(button.dataset.tool)));
  document.querySelectorAll("[data-clear-tool]").forEach(button =>
    button.addEventListener("click", () => radar.tools.clear(button.dataset.clearTool || undefined)));
  document.getElementById("nextScenarioBtn").addEventListener("click", generate);
  difficultySelect.addEventListener("change", generate);
  document.getElementById("revealSolutionBtn").addEventListener("click", () => {
    if (currentScenario) toggleSolution(currentScenario);
  });
  document.getElementById("resetViewBtn").addEventListener("click", () => radar.resetView());
  document.getElementById("zoomInBtn").addEventListener("click", () => radar.zoom(1.25));
  document.getElementById("zoomOutBtn").addEventListener("click", () => radar.zoom(1 / 1.25));
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key === "Escape") radar.tools.cancelSelection();
    if (event.key.toLowerCase() === "n" && !event.repeat) generate();
  });
  requestAnimationFrame(generate);
});


import { DIFFICULTIES } from "./constants.js";
import { loadMapFiles, mapBounds } from "./map.js";
import { generateScenario } from "./scenarios.js";
import { RadarView } from "./radar.js";
import { initializeThemeSelector } from "./utils.js";
import { hideSolution, renderFlightStrips, renderScenarioBriefing, showGenerationError, toggleSolution } from "./ui.js";

// Add more files to this list to place independent overlays over the base map.
const MAP_FILES = ["./maps/new-martin-high.map"];
const FALLBACK_MAP_FILES = ["./maps/north-channel.map"];

document.addEventListener("DOMContentLoaded", async () => {
  initializeThemeSelector();
  const difficultySelect = document.getElementById("difficultySelect");
  const status = document.getElementById("tool-status");
  const buttons = [...document.querySelectorAll(".tool-btn")];
  let map;
  let mapNotice = "";
  try {
    map = await loadMapFiles(MAP_FILES);
  } catch (primaryError) {
    try {
      map = await loadMapFiles(FALLBACK_MAP_FILES);
      mapNotice = "New Martin map was unavailable; displaying the included North Channel map.";
    } catch (fallbackError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : "Unable to load the configured radar map";
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Unable to load the fallback radar map";
      showGenerationError(`${primaryMessage}. ${fallbackMessage}.`);
      return;
    }
  }

  const bounds = mapBounds(map);
  let currentScenario = null;
  const warningIds = new Set();
  const radar = new RadarView(document.getElementById("radar-svg"), bounds, {
    map,
    theme: document.documentElement.dataset.theme,
    onStatus: message => { status.textContent = message; },
    onToolsChange: tools => {
      for (const button of buttons) {
        const active = tools.selectedTool === button.dataset.tool;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    },
  });
  document.addEventListener("themechange", event => radar.setTheme(event.detail.theme));
  if (mapNotice) status.textContent = mapNotice;

  for (const difficulty of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = difficulty;
    option.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
    difficultySelect.append(option);
  }
  difficultySelect.value = "easy";

  function generate() {
    hideSolution();
    warningIds.clear();
    try {
      currentScenario = generateScenario(difficultySelect.value, bounds);
      radar.setScenario(currentScenario);
      renderFlightStrips(currentScenario, bounds, warningIds);
      renderScenarioBriefing(currentScenario, map.name);
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
    if (currentScenario) toggleSolution(currentScenario, warningIds);
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

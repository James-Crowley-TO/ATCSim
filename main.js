import { DIFFICULTIES, HISTORY_DOTS } from "./constants.js";
import {
  createDataTag,
  createLeaderLine,
  enableTagDragging,
  positionAircraft,
  renderTrail,
  updateLeaderForAircraft,
} from "./aircraft.js";
import { generateScenario } from "./scenarios.js";
import {
  handlePPSClick,
  handlePPSScroll,
  removeAllToolsForPPS,
  resetToolState,
  setupToolbar,
} from "./tools.js";
import {
  hideSolution,
  renderRadarScale,
  renderScenarioBriefing,
  showGenerationError,
  toggleSolution,
} from "./ui.js";

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required DOM element #${id}`);
  return element;
}

document.addEventListener("DOMContentLoaded", () => {
  const radarScreen = requireElement("radar-screen");
  const aircraftContainer = requireElement("aircraft-container");
  const tagLayer = requireElement("tag-layer");
  const leaderSvg = requireElement("leader-layer");
  const toolsSvg = requireElement("tools-layer");
  const difficultySelect = requireElement("difficultySelect");
  const nextScenarioBtn = requireElement("nextScenarioBtn");
  const revealSolutionBtn = requireElement("revealSolutionBtn");
  const scaleBar = radarScreen.querySelector(".scale-bar");
  const scaleLabel = radarScreen.querySelector(".scale-label");

  let currentScenario = null;

  for (const difficulty of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = difficulty;
    option.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);
    difficultySelect.appendChild(option);
  }
  difficultySelect.value = "easy";

  function clearScene() {
    resetToolState();
    aircraftContainer.replaceChildren();
    tagLayer.replaceChildren();
    leaderSvg.replaceChildren();
    toolsSvg.replaceChildren();
    hideSolution();
  }

  function createPPS(wrapper, aircraft) {
    const pps = document.createElement("button");
    pps.className = "pps";
    pps.type = "button";
    pps.setAttribute("aria-label", `${aircraft.callsign} radar target`);
    wrapper.appendChild(pps);

    pps.addEventListener("click", (event) => {
      event.stopPropagation();
      handlePPSClick(pps, aircraft, toolsSvg);
    });

    pps.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      removeAllToolsForPPS(pps);
    });

    pps.addEventListener("wheel", (event) => {
      if (handlePPSScroll(pps, event.deltaY)) event.preventDefault();
    }, { passive: false });

    return pps;
  }

  function addAircraftToScene(aircraft) {
    const wrapper = document.createElement("div");
    wrapper.className = "aircraft";
    positionAircraft(wrapper, aircraft);
    aircraftContainer.appendChild(wrapper);

    createPPS(wrapper, aircraft);
    renderTrail(wrapper, aircraft, HISTORY_DOTS);

    const leader = createLeaderLine(leaderSvg);
    const tag = createDataTag(aircraft, tagLayer, radarScreen);
    updateLeaderForAircraft(aircraft, tag, leader);
    enableTagDragging(tag, aircraft, leader, radarScreen);
  }

  function generate() {
    clearScene();
    const rect = radarScreen.getBoundingClientRect();

    try {
      currentScenario = generateScenario(difficultySelect.value, {
        width: rect.width,
        height: rect.height,
      });
      currentScenario.aircraft.forEach(addAircraftToScene);
      renderScenarioBriefing(currentScenario);
    } catch (error) {
      currentScenario = null;
      showGenerationError(error instanceof Error ? error.message : "Unable to generate scenario");
    }
  }

  nextScenarioBtn.addEventListener("click", generate);
  difficultySelect.addEventListener("change", generate);
  revealSolutionBtn.addEventListener("click", () => {
    if (currentScenario) toggleSolution(currentScenario);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      generate();
    }
  });

  setupToolbar();
  renderRadarScale(scaleBar, scaleLabel, 10);
  requestAnimationFrame(generate);
});

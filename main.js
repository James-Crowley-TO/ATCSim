// Main application entry point
import { DIFFICULTIES } from "./constants.js";
import { createScaleTicks, updateObjectivesDisplay } from "./ui.js";
import {
  createLeaderLine,
  createDataTag,
  updateLeaderForAircraft,
  enableTagDragging,
  positionAircraft,
  renderTrail,
} from "./aircraft.js";
import {
  setupToolbar,
  toolState,
  handlePPSClick,
  handlePPSScroll,
  removeAllTools,
} from "./tools.js";
import {
  scenarioRandom,
  scenarioConflict,
} from "./scenarios.js";

document.addEventListener("DOMContentLoaded", () => {
  // === Radar screen & elements ===
  const radarScreen = document.getElementById("radar-screen");
  const nextScenarioBtn = document.getElementById("nextScenarioBtn");
  const aircraftContainer = document.getElementById("aircraft-container");
  const scaleBar = document.querySelector("#radar-scale .scale-bar");
  let currentScenario = { aircraft: [] };

  // Difficulty state
  let currentDifficulty = "easy"; // 'easy', 'medium', 'hard'

  // Create one SVG layer to draw leader lines
  const leaderSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  leaderSvg.classList.add("leader-layer");
  leaderSvg.setAttribute("width", "100%");
  leaderSvg.setAttribute("height", "100%");
  leaderSvg.style.position = "absolute";
  leaderSvg.style.left = "0";
  leaderSvg.style.top = "0";
  leaderSvg.style.pointerEvents = "none";

  // Put SVG behind tags but above background
  radarScreen.appendChild(leaderSvg);

  // Create SVG layer for tools
  const toolsSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  toolsSvg.classList.add("tools-layer");
  toolsSvg.setAttribute("width", "100%");
  toolsSvg.setAttribute("height", "100%");
  toolsSvg.style.position = "absolute";
  toolsSvg.style.left = "0";
  toolsSvg.style.top = "0";
  toolsSvg.style.pointerEvents = "none";
  toolsSvg.style.zIndex = "15";
  radarScreen.appendChild(toolsSvg);

  // === Aircraft Creation ===
  function createAircraftWrapper(aircraft) {
    const wrapper = document.createElement("div");
    wrapper.className = "aircraft";
    wrapper.style.position = "absolute";
    wrapper.style.left = `${aircraft.longitude}px`;
    wrapper.style.top = `${aircraft.latitude}px`;

    aircraftContainer.appendChild(wrapper);
    return wrapper;
  }

  function createPPS(wrapper, aircraft) {
    const pps = document.createElement("div");
    pps.className = "pps";
    pps.style.position = "absolute";
    pps.style.left = "0px";
    pps.style.top = "0px";
    pps.style.transform = "translate(-50%, -50%)";
    wrapper.appendChild(pps);

    // Add click handler for tools
    pps.addEventListener("click", (e) => {
      e.stopPropagation();
      handlePPSClick(pps, aircraft, toolsSvg);
    });

    // Add right-click to remove all tools
    pps.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      removeAllTools(pps);
    });

    // Add scroll handler for PTL/Halo adjustment
    pps.addEventListener("wheel", (e) => {
      e.preventDefault();
      handlePPSScroll(pps, aircraft, e.deltaY);
    });

    return pps;
  }

  function addAircraftToScene(aircraft) {
    const aircraftWrapper = createAircraftWrapper(aircraft);
    const ppsEl = createPPS(aircraftWrapper, aircraft);
    const lineEl = createLeaderLine(leaderSvg);
    const tagEl = createDataTag(
      aircraft,
      aircraft.longitude,
      aircraft.latitude,
      radarScreen
    );

    positionAircraft(aircraftWrapper, aircraft);
    renderTrail(aircraftWrapper, aircraft, 4);
    updateLeaderForAircraft(
      aircraft.longitude,
      aircraft.latitude,
      tagEl,
      lineEl
    );
    enableTagDragging(
      tagEl,
      aircraft.longitude,
      aircraft.latitude,
      lineEl,
      radarScreen,
      180
    );

    currentScenario.aircraft.push({
      aircraftIn: aircraft,
      wrapperEl: aircraftWrapper,
      ppsEl: ppsEl,
      tagEl: tagEl,
      lineEl: lineEl,
    });
  }

  // === Difficulty-based Scene Generation ===
  function generateDifficultyScene(difficulty) {
    // Clear previous scenario
    aircraftContainer.innerHTML = "";
    leaderSvg.innerHTML = "";
    toolsSvg.innerHTML = "";
    radarScreen.querySelectorAll(".data-tag").forEach((tag) => tag.remove());
    toolState.rbls.length = 0;
    toolState.ptls.clear();
    toolState.halos.clear();
    toolState.rblFirstPPS = null;
    currentScenario = { aircraft: [] };

    let minAircraft, maxAircraft;

    switch (difficulty) {
      case "easy":
        minAircraft = 3;
        maxAircraft = 6;
        break;
      case "medium":
        minAircraft = 4;
        maxAircraft = 6;
        break;
      case "hard":
        minAircraft = 8;
        maxAircraft = 12;
        break;
    }

    const radarRangePx = radarScreen.getBoundingClientRect().width;

    // Generate sequence
    const sequence = [];

    // Generate scenarios
    let conflictCount = 
      Math.floor(Math.random() * (maxAircraft - minAircraft + 1)) + 1;
    if (conflictCount % 2 !== 0) {
      conflictCount += 1;
    }
    sequence.push({type: "conflict", count: conflictCount })

    const randomCount =
      Math.floor(Math.random() * (maxAircraft - conflictCount));
    sequence.push({ type: "random", count : randomCount});

    // Execute sequence
    console.log(`Generating ${difficulty} scenario:`, sequence);

    for (const step of sequence) {
      let placed = 0;
      switch (step.type) {
        case "random":
          placed = scenarioRandom(step.count, radarRangePx, currentScenario, addAircraftToScene);
          break;
        case "conflict":
          placed = scenarioConflict(step.count, radarRangePx, addAircraftToScene);
          break;
      }
      console.log(`  ${step.type}(${step.count}) -> placed ${placed} aircraft`);
    }

    console.log(`Total aircraft: ${currentScenario.aircraft.length}`);

    // Update objectives display
    updateObjectivesDisplay(sequence);
  }

  // === Button Setup ===
  const difficultyBtn = document.getElementById("difficultyBtn");

  // Difficulty toggle button
  difficultyBtn.addEventListener("click", () => {
    // Cycle through difficulties
    const currentIndex = DIFFICULTIES.indexOf(currentDifficulty);
    currentDifficulty = DIFFICULTIES[(currentIndex + 1) % DIFFICULTIES.length];

    // Update button text
    difficultyBtn.textContent = `${currentDifficulty.slice(0, 4).toUpperCase()}`;
  });

  // Generate scenario button
  nextScenarioBtn.addEventListener("click", () => {
    generateDifficultyScene(currentDifficulty);
  });

  setupToolbar();
  createScaleTicks(scaleBar);

  // Initial scene
  generateDifficultyScene(currentDifficulty);
});
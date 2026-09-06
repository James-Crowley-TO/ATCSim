import { DIFFICULTIES, HISTORY_DOTS, MAX_ZOOM, MIN_ZOOM } from "./constants.js";
import {
  createDataTag,
  createLeaderLine,
  enableTagDragging,
  positionAircraft,
  renderTrail,
  updateLeaderForAircraft,
} from "./aircraft.js";
import { generateScenario } from "./scenarios.js";
import { nmToPx } from "./utils.js";
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
  const radarWorld = requireElement("radar-world");
  const aircraftContainer = requireElement("aircraft-container");
  const tagLayer = requireElement("tag-layer");
  const leaderSvg = requireElement("leader-layer");
  const toolsSvg = requireElement("tools-layer");
  const difficultySelect = requireElement("difficultySelect");
  const nextScenarioBtn = requireElement("nextScenarioBtn");
  const revealSolutionBtn = requireElement("revealSolutionBtn");
  const scaleBar = radarScreen.querySelector(".scale-bar");
  const scaleLabel = radarScreen.querySelector(".scale-label");
  const flightStrips = requireElement("flight-strips");
  const airspaceBoundary = requireElement("airspace-boundary");
  const resetViewBtn = requireElement("resetViewBtn");

  let currentScenario = null;
  const camera = { x: 0, y: 0, zoom: 1 };
  let pan = null;
  const worldBounds = { width: 760, height: 760 };
  const fitZoom = () => Math.min(radarScreen.clientWidth / worldBounds.width, radarScreen.clientHeight / worldBounds.height);

  function screenToWorld(clientX, clientY) {
    const rect = radarScreen.getBoundingClientRect();
    return {
      x: (clientX - rect.left - radarScreen.clientLeft - camera.x) / camera.zoom,
      y: (clientY - rect.top - radarScreen.clientTop - camera.y) / camera.zoom,
    };
  }

  function renderCamera() {
    radarWorld.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
    renderRadarScale(scaleBar, scaleLabel, 10, camera.zoom);
  }

  function resetView() {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = fitZoom();
    renderCamera();
  }

  function setupViewport() {
    radarScreen.addEventListener("wheel", (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const rect = radarScreen.getBoundingClientRect();
      const pointerX = event.clientX - rect.left - radarScreen.clientLeft;
      const pointerY = event.clientY - rect.top - radarScreen.clientTop;
      const worldX = (pointerX - camera.x) / camera.zoom;
      const worldY = (pointerY - camera.y) / camera.zoom;
      const factor = Math.exp(-event.deltaY * 0.0012);
      camera.zoom = Math.max(MIN_ZOOM * fitZoom(), Math.min(MAX_ZOOM * fitZoom(), camera.zoom * factor));
      camera.x = pointerX - worldX * camera.zoom;
      camera.y = pointerY - worldY * camera.zoom;
      renderCamera();
    }, { passive: false });

    radarScreen.addEventListener("pointerdown", (event) => {
      if (pan || event.button !== 0 || event.target.closest("button, .data-tag, .rbl-line, .ptl-line, .halo-circle")) return;
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
      radarScreen.setPointerCapture(event.pointerId);
      radarScreen.classList.add("panning");
    });

    radarScreen.addEventListener("pointermove", (event) => {
      if (!pan || event.pointerId !== pan.id) return;
      camera.x = pan.cameraX + event.clientX - pan.x;
      camera.y = pan.cameraY + event.clientY - pan.y;
      renderCamera();
    });

    const endPan = (event) => {
      if (!pan || event.pointerId !== pan.id) return;
      pan = null;
      radarScreen.classList.remove("panning");
    };
    radarScreen.addEventListener("pointerup", endPan);
    radarScreen.addEventListener("pointercancel", endPan);
    radarScreen.addEventListener("lostpointercapture", endPan);
    resetViewBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      resetView();
    });
  }

  function renderAirspace(bounds) {
    const points = [
      [0.08, 0.22], [0.25, 0.07], [0.55, 0.11], [0.72, 0.04],
      [0.94, 0.27], [0.87, 0.53], [0.97, 0.76], [0.69, 0.93],
      [0.43, 0.86], [0.18, 0.96], [0.04, 0.68], [0.13, 0.45],
    ];
    airspaceBoundary.setAttribute("points", points.map(([x, y]) => `${x * bounds.width},${y * bounds.height}`).join(" "));
  }

  function centreCrossingMinutes(aircraft, bounds) {
    const radians = aircraft.heading * Math.PI / 180;
    const speedPxPerMinute = nmToPx(aircraft.speedKts / 60);
    const vx = Math.sin(radians) * speedPxPerMinute;
    const vy = -Math.cos(radians) * speedPxPerMinute;
    const dx = aircraft.x - bounds.width / 2;
    const dy = aircraft.y - bounds.height / 2;
    return -(dx * vx + dy * vy) / (vx * vx + vy * vy);
  }

  function renderFlightStrips(aircraft, bounds) {
    const sorted = aircraft.map((plane, index) => ({
      plane,
      index,
      crossing: centreCrossingMinutes(plane, bounds),
    })).sort((a, b) => a.crossing - b.crossing);

    flightStrips.replaceChildren(...sorted.map(({ plane, index, crossing }) => {
      const strip = document.createElement("div");
      strip.className = "flight-strip";
      const eta = `T${crossing < 0 ? "−" : "+"}${Math.abs(crossing).toFixed(1)} min`;
      strip.title = "Time of closest approach to the original radar centre; negative means already passed.";
      strip.innerHTML = `<strong>${plane.callsign}</strong><span class="strip-eta">${eta}</span>` +
        `<span>FL${plane.flightLevel} · ${Math.round(plane.speedKts)}KT</span><span>${String(Math.round(plane.heading)).padStart(3, "0")}°</span>` +
        `<span class="strip-route">${plane.aircraftType} · ${plane.verticalRateFpm === 0 ? "LEVEL" : `${plane.verticalRateFpm > 0 ? "↑" : "↓"}${Math.abs(plane.verticalRateFpm)} FPM`}</span>`;
      return strip;
    }));
  }

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
    flightStrips.replaceChildren();
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
    enableTagDragging(tag, aircraft, leader, radarScreen, screenToWorld);
  }

  function generate() {
    clearScene();
    resetView();
    try {
      currentScenario = generateScenario(difficultySelect.value, worldBounds);
      const bounds = worldBounds;
      currentScenario.aircraft.forEach(addAircraftToScene);
      renderAirspace(bounds);
      renderFlightStrips(currentScenario.aircraft, bounds);
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
  setupViewport();
  radarWorld.style.width = `${worldBounds.width}px`;
  radarWorld.style.height = `${worldBounds.height}px`;
  new ResizeObserver(resetView).observe(radarScreen);
  resetView();
  requestAnimationFrame(generate);
});

import { confirmAction } from "./confirm-dialog.js";
import { DIFFICULTIES } from "./constants.js";
import { loadMapFiles, mapBounds, parseMap } from "./map.js";
import { generateScenario } from "./scenarios.js";
import { RadarView } from "./radar.js";
import { Session } from "./session.js";
import { SandboxTools } from "./sandbox.js";
import { AircraftEditor } from "./aircraft-editor.js";
import { MapEditor } from "./map-editor.js";
import { initializeThemeSelector } from "./utils.js";
import { hideSolution, renderFlightStrips, renderScenarioBriefing, showGenerationError, toggleSolution } from "./ui.js";

// Map-Maker downloads use this same DSL and may replace either file.
const MAP_FILES = ["./maps/new-martin-high.map"];
const FALLBACK_MAP_FILES = ["./maps/north-channel.map"];

document.addEventListener("DOMContentLoaded", async () => {
  initializeThemeSelector();
  const status = document.getElementById("tool-status");
  const difficultySelect = document.getElementById("difficultySelect");
  const buttons = [...document.querySelectorAll("[data-tool]")];
  const setStatus = message => { status.textContent = message; };
  let map, mapNotice = "";
  try { map = await loadMapFiles(MAP_FILES); }
  catch {
    try {
      map = await loadMapFiles(FALLBACK_MAP_FILES);
      mapNotice = "New Martin was unavailable; displaying North Channel.";
    } catch (error) {
      map = parseMap('MAP "Empty radar"\nSIZE 270 250', "Empty radar");
      mapNotice = `${error.message}. Load a map in Map-Maker Mode.`;
    }
  }
  const session = new Session(mapBounds(map));
  const radar = new RadarView(document.getElementById("radar-svg"), mapBounds(map), {
    map, theme: document.documentElement.dataset.theme, onStatus: setStatus,
    onToolsChange: tools => buttons.forEach(button => {
      const active = tools.selectedTool === button.dataset.tool;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    }),
  });
  document.addEventListener("themechange", event => radar.setTheme(event.detail.theme));
  const sandbox = new SandboxTools(radar.editLayer, {
    onChange: () => {
      radar.schedule();
      document.querySelectorAll("[data-sandbox-tool]").forEach(button => {
        const active = sandbox.selectedTool === button.dataset.sandboxTool;
        button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
      });
      radar.svg.classList.toggle("placing", session.mode === "sandbox" && Boolean(sandbox.selectedTool));
    },
    onStatus: setStatus,
    onPlace: point => aircraftEditor.open(point, true),
  });
  const aircraftEditor = new AircraftEditor(session, {
    onPreview: aircraft => { sandbox.draft = aircraft; radar.schedule(); },
    onSave: aircraft => {
      radar.tools.startUtcSeconds = session.startUtcSeconds;
      radar.syncAircraft(aircraft);
      hideSolution(); refreshSessionUI();
      setStatus(`${aircraft.callsign || "Incomplete aircraft"} saved. Right-click its PPS to edit again.`);
    },
  });
  const mapEditor = new MapEditor(radar, map, {
    onStatus: setStatus,
    onChange: nextMap => { map = nextMap; refreshSessionUI(); },
  });

  function refreshSessionUI() {
    renderFlightStrips(session.stripContext, session.referenceBounds, session.warningIds);
    if (session.scenario) renderScenarioBriefing(session.scenario, map.name);
    else {
      document.getElementById("scenario-meta").textContent = `${map.name.toUpperCase()} · FREE SESSION · ${session.aircraft.length} aircraft`;
      document.getElementById("scenario-objective").textContent = "Enter Sandbox Mode to place or edit aircraft, or generate a new scenario.";
    }
    document.getElementById("aircraft-change-notice").hidden = !session.answerStale;
    document.getElementById("answer-edit-message").textContent = "Aircraft have changed. The generated answer is out of date; recalculate it from the saved traffic before revealing. Incomplete aircraft must be completed first.";
    document.getElementById("revealSolutionBtn").disabled = !session.scenario || session.answerStale;
  }

  async function switchMode(next) {
    if (next === session.mode) return;
    if (session.mode === "mapmaker" && !await mapEditor.leave()) return;
    aircraftEditor.cancel();
    if (session.mode === "sandbox") sandbox.reset();
    session.setMode(next);
    const interactions = next === "sandbox" ? {
      onClick: point => sandbox.click(point), onMove: point => sandbox.move(point),
      onEdit: aircraft => aircraftEditor.open(aircraft), onCancel: () => sandbox.cancel(),
      render: camera => sandbox.render(camera),
    } : next === "mapmaker" ? {
      onClick: point => mapEditor.click(point), onMove: point => mapEditor.move(point),
      onCancel: () => mapEditor.cancel(), render: camera => mapEditor.render(camera),
    } : null;
    radar.setMode(next, interactions);
    document.body.dataset.mode = next;
    document.getElementById("toolbar").hidden = next !== "normal";
    document.getElementById("sandbox-toolbar").hidden = next !== "sandbox";
    document.getElementById("map-toolbar").hidden = next !== "mapmaker";
    document.getElementById("map-inspector").hidden = next !== "mapmaker";
    document.querySelectorAll(".mode-btn").forEach(button => {
      const active = button.dataset.mode === next;
      button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
      button.textContent = button.dataset.mode === "sandbox" && active ? "Exit Sandbox Mode" :
        button.dataset.mode === "mapmaker" && active ? "Exit Map-Maker Mode" :
          { normal: "Normal Mode", sandbox: "Sandbox Mode", mapmaker: "Map-Maker Mode" }[button.dataset.mode];
    });
    document.getElementById("mode-help").textContent = {
      normal: "Static scenario · Practice conflict recognition",
      sandbox: "Session edits are retained · Measurements are temporary",
      mapmaker: "Map coordinates in NM · Applied edits are retained on exit",
    }[next];
    document.querySelector("h1").textContent = next === "mapmaker" ? "Map-Maker" : "Conflict Recognition Trainer";
    radar.svg.setAttribute("aria-label", next === "mapmaker" ? "Editable radar map" : "Radar scenario display");
    radar.svg.classList.remove("placing");
    if (next === "sandbox") sandbox.status();
    else if (next === "mapmaker") mapEditor.enter();
    else setStatus("Normal Mode · Select a target tool. Drag to pan; wheel to zoom.");
  }

  async function generate() {
    if (session.mode === "mapmaker") return;
    if (session.hasAircraftEdits && !await confirmAction("Generate a new scenario and replace the aircraft edits in this session?")) return;
    try {
      const scenario = generateScenario(difficultySelect.value, mapBounds(map));
      session.replaceScenario(scenario, mapBounds(map));
      aircraftEditor.cancel(); sandbox.clear();
      hideSolution(); radar.setScenario(scenario); refreshSessionUI();
      if (session.mode === "sandbox") sandbox.status();
    } catch (error) {
      setStatus(`Scenario not changed: ${error.message}`);
      if (!session.scenario) showGenerationError(error.message);
    }
  }

  for (const difficulty of DIFFICULTIES) difficultySelect.add(new Option(difficulty[0].toUpperCase() + difficulty.slice(1), difficulty));
  difficultySelect.value = "easy";
  buttons.forEach(button => button.addEventListener("click", () => {
    if (session.mode === "normal") radar.tools.select(button.dataset.tool);
  }));
  document.querySelectorAll("[data-clear-tool]").forEach(button => button.addEventListener("click", () => {
    if (session.mode === "normal") radar.tools.clear(button.dataset.clearTool || undefined);
  }));
  document.querySelectorAll(".mode-btn").forEach(button => button.addEventListener("click", () => {
    const requested = button.dataset.mode;
    switchMode(requested === session.mode ? (requested === "mapmaker" ? session.returnMode : "normal") : requested);
  }));
  document.querySelectorAll("[data-sandbox-tool]").forEach(button => button.addEventListener("click", () => sandbox.select(button.dataset.sandboxTool)));
  document.querySelectorAll("[data-map-tool]").forEach(button => button.addEventListener("click", () => mapEditor.selectTool(button.dataset.mapTool)));
  document.getElementById("cancelMeasurementBtn").addEventListener("click", () => sandbox.cancel());
  document.getElementById("clearMeasurementsBtn").addEventListener("click", () => sandbox.clear());
  document.getElementById("cancelMapPlacementBtn").addEventListener("click", () => mapEditor.cancel());
  document.getElementById("nextScenarioBtn").addEventListener("click", generate);
  difficultySelect.addEventListener("change", generate);
  document.getElementById("emptySessionBtn").addEventListener("click", async () => {
    if (session.mode === "mapmaker") return;
    if (session.aircraft.length && !await confirmAction("Start an empty session? This removes the current aircraft and scenario.")) return;
    session.replaceScenario(null, mapBounds(map));
    sandbox.clear(); hideSolution(); radar.setScenario(null); refreshSessionUI();
  });
  document.getElementById("revealSolutionBtn").addEventListener("click", () => {
    if (session.scenario && !session.answerStale && session.mode !== "mapmaker") toggleSolution(session.scenario, session.warningIds);
  });
  document.getElementById("recalculateAnswerBtn").addEventListener("click", () => {
    try {
      session.recalculateAnswer(); hideSolution(); refreshSessionUI();
      setStatus("Answer recalculated from the saved aircraft using the existing look-ahead and separation model. Aircraft and warning selections are unchanged.");
    } catch (error) { document.getElementById("answer-edit-message").textContent = error.message; }
  });
  document.getElementById("resetViewBtn").addEventListener("click", () => radar.resetView());
  document.getElementById("zoomInBtn").addEventListener("click", () => radar.zoom(1.25));
  document.getElementById("zoomOutBtn").addEventListener("click", () => radar.zoom(1 / 1.25));
  document.addEventListener("keydown", event => {
    if (document.querySelector("dialog[open]") || event.ctrlKey || event.metaKey || event.altKey ||
        event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key === "Escape") {
      radar.cancelNavigation();
      if (session.mode === "sandbox") sandbox.cancel();
      else if (session.mode === "mapmaker") mapEditor.cancel();
      else radar.tools.cancelSelection();
    }
    if (event.key === "Delete" && session.mode === "mapmaker") mapEditor.deleteSelected();
    if (event.key.toLowerCase() === "n" && !event.repeat && session.mode === "normal") generate();
  });
  // Static snapshots have no simulation timer. Only explicit generation changes
  // scenario time; map mode also blocks all scenario commands and shortcuts.
  refreshSessionUI();
  requestAnimationFrame(() => {
    if (session.mode === "normal" && !session.aircraft.length) generate();
    if (mapNotice) setStatus(mapNotice);
  });
});

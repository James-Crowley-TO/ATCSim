import { DEFAULT_HALO_NM, DEFAULT_PTL_MINUTES } from "./constants.js";
import {
  bearingDegrees,
  distanceNm,
  nmToPx,
  projectPoint,
  round,
  setSvgLine,
} from "./utils.js";

export const toolState = {
  selectedTool: null,
  rblFirstPPS: null,
  rbls: [],
  ptls: new Map(),
  halos: new Map(),
};

function ppsPosition(pps) {
  const wrapper = pps.parentElement;
  return {
    x: parseFloat(wrapper.style.left),
    y: parseFloat(wrapper.style.top),
  };
}

function svgElement(name, className) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  element.classList.add(className);
  return element;
}

export function createRBL(pps1, pps2, toolsSvg) {
  const line = svgElement("line", "rbl-line");
  const label = svgElement("text", "rbl-label");
  toolsSvg.append(line, label);

  const rbl = { pps1, pps2, line, label };
  toolState.rbls.push(rbl);
  line.addEventListener("click", (event) => {
    event.stopPropagation();
    removeRBL(rbl);
  });
  updateRBL(rbl);
  return rbl;
}

export function updateRBL(rbl) {
  const a = ppsPosition(rbl.pps1);
  const b = ppsPosition(rbl.pps2);
  setSvgLine(rbl.line, a.x, a.y, b.x, b.y);

  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  rbl.label.setAttribute("x", midX);
  rbl.label.setAttribute("y", midY - 7);
  rbl.label.textContent = `${round(distanceNm(a, b), 1)} NM / ${Math.round(bearingDegrees(a, b))}°`;
}

export function removeRBL(rbl) {
  rbl.line.remove();
  rbl.label.remove();
  const index = toolState.rbls.indexOf(rbl);
  if (index >= 0) toolState.rbls.splice(index, 1);
}

export function createPTL(pps, aircraft, toolsSvg, minutes = DEFAULT_PTL_MINUTES) {
  if (toolState.ptls.has(pps)) return toolState.ptls.get(pps);

  const line = svgElement("line", "ptl-line");
  const label = svgElement("text", "ptl-label");
  toolsSvg.append(line, label);

  const ptl = { line, label, minutes, aircraft };
  toolState.ptls.set(pps, ptl);
  line.addEventListener("click", (event) => {
    event.stopPropagation();
    removePTL(pps);
  });
  updatePTL(pps, ptl);
  return ptl;
}

export function updatePTL(pps, ptl) {
  const start = ppsPosition(pps);
  const end = projectPoint(start.x, start.y, ptl.aircraft.heading, ptl.aircraft.speedKts, ptl.minutes);
  setSvgLine(ptl.line, start.x, start.y, end.x, end.y);

  ptl.label.setAttribute("x", (start.x + end.x) / 2);
  ptl.label.setAttribute("y", (start.y + end.y) / 2 - 7);
  ptl.label.textContent = `${ptl.minutes} min`;
}

export function removePTL(pps) {
  const ptl = toolState.ptls.get(pps);
  if (!ptl) return;
  ptl.line.remove();
  ptl.label.remove();
  toolState.ptls.delete(pps);
}

export function createHalo(pps, toolsSvg, radiusNm = DEFAULT_HALO_NM) {
  if (toolState.halos.has(pps)) return toolState.halos.get(pps);

  const circle = svgElement("circle", "halo-circle");
  const label = svgElement("text", "halo-label");
  toolsSvg.append(circle, label);

  const halo = { circle, label, radiusNm };
  toolState.halos.set(pps, halo);
  circle.addEventListener("click", (event) => {
    event.stopPropagation();
    removeHalo(pps);
  });
  updateHalo(pps, halo);
  return halo;
}

export function updateHalo(pps, halo) {
  const position = ppsPosition(pps);
  const radiusPx = nmToPx(halo.radiusNm);
  halo.circle.setAttribute("cx", position.x);
  halo.circle.setAttribute("cy", position.y);
  halo.circle.setAttribute("r", radiusPx);
  halo.label.setAttribute("x", position.x);
  halo.label.setAttribute("y", position.y - radiusPx - 7);
  halo.label.textContent = `${halo.radiusNm} NM`;
}

export function removeHalo(pps) {
  const halo = toolState.halos.get(pps);
  if (!halo) return;
  halo.circle.remove();
  halo.label.remove();
  toolState.halos.delete(pps);
}

export function removeAllToolsForPPS(pps) {
  [...toolState.rbls]
    .filter((rbl) => rbl.pps1 === pps || rbl.pps2 === pps)
    .forEach(removeRBL);
  removePTL(pps);
  removeHalo(pps);
}

export function clearAllTools() {
  [...toolState.rbls].forEach(removeRBL);
  [...toolState.ptls.keys()].forEach(removePTL);
  [...toolState.halos.keys()].forEach(removeHalo);
  if (toolState.rblFirstPPS) toolState.rblFirstPPS.classList.remove("rbl-selected");
  toolState.rblFirstPPS = null;
}

export function resetToolState() {
  clearAllTools();
  toolState.selectedTool = null;
  document.querySelectorAll(".tool-btn.active").forEach((button) => button.classList.remove("active"));
}

function setActiveTool(tool, button, buttons) {
  if (toolState.rblFirstPPS) {
    toolState.rblFirstPPS.classList.remove("rbl-selected");
    toolState.rblFirstPPS = null;
  }

  const turningOff = button.classList.contains("active");
  buttons.forEach((candidate) => candidate.classList.remove("active"));
  toolState.selectedTool = turningOff ? null : tool;
  if (!turningOff) button.classList.add("active");
}

export function setupToolbar() {
  const toolButtons = [...document.querySelectorAll(".tool-btn")];
  toolButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTool(button.dataset.tool, button, toolButtons));
  });

  document.getElementById("clear-all-ptl").addEventListener("click", () => {
    [...toolState.ptls.keys()].forEach(removePTL);
  });
  document.getElementById("clear-all-rbl").addEventListener("click", () => {
    [...toolState.rbls].forEach(removeRBL);
  });
  document.getElementById("clear-all-halo").addEventListener("click", () => {
    [...toolState.halos.keys()].forEach(removeHalo);
  });
  document.getElementById("clear-all-tools").addEventListener("click", clearAllTools);
}

export function handlePPSClick(pps, aircraft, toolsSvg) {
  if (toolState.selectedTool === "rbl") {
    if (!toolState.rblFirstPPS) {
      toolState.rblFirstPPS = pps;
      pps.classList.add("rbl-selected");
    } else if (toolState.rblFirstPPS === pps) {
      pps.classList.remove("rbl-selected");
      toolState.rblFirstPPS = null;
    } else {
      createRBL(toolState.rblFirstPPS, pps, toolsSvg);
      toolState.rblFirstPPS.classList.remove("rbl-selected");
      toolState.rblFirstPPS = null;
    }
    return;
  }

  if (toolState.selectedTool === "ptl") createPTL(pps, aircraft, toolsSvg);
  if (toolState.selectedTool === "halo") createHalo(pps, toolsSvg);
}

export function handlePPSScroll(pps, deltaY) {
  const direction = deltaY > 0 ? -1 : 1;

  if (toolState.selectedTool === "halo" && toolState.halos.has(pps)) {
    const halo = toolState.halos.get(pps);
    halo.radiusNm = Math.max(1, Math.min(20, halo.radiusNm + direction));
    updateHalo(pps, halo);
    return true;
  }

  if (toolState.selectedTool === "ptl" && toolState.ptls.has(pps)) {
    const ptl = toolState.ptls.get(pps);
    ptl.minutes = Math.max(1, Math.min(12, ptl.minutes + direction));
    updatePTL(pps, ptl);
    return true;
  }

  if (toolState.ptls.has(pps) && !toolState.halos.has(pps)) {
    const ptl = toolState.ptls.get(pps);
    ptl.minutes = Math.max(1, Math.min(12, ptl.minutes + direction));
    updatePTL(pps, ptl);
    return true;
  }

  if (toolState.halos.has(pps) && !toolState.ptls.has(pps)) {
    const halo = toolState.halos.get(pps);
    halo.radiusNm = Math.max(1, Math.min(20, halo.radiusNm + direction));
    updateHalo(pps, halo);
    return true;
  }

  return false;
}

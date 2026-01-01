// Radar tools: RBL, PTL, Halo
import { pxToNm, nmToPx, headingToUnitVector } from "./utils.js";

// Tool state
export const toolState = {
  selectedTool: null,
  rblFirstPPS: null,
  rbls: [], // Array of {pps1, pps2, line, label}
  ptls: new Map(), // Map<pps, {line, label, minutes}>
  halos: new Map(), // Map<pps, {circle, label, radius}>
};

function getPPSPosition(pps) {
  const wrapper = pps.parentElement;
  const x = parseFloat(wrapper.style.left);
  const y = parseFloat(wrapper.style.top);
  return { x, y };
}

// === RBL Functions ===
export function createRBL(pps1, pps2, toolsSvg) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("rbl-line");
  line.style.cursor = "pointer";
  line.style.pointerEvents = "auto";

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.classList.add("rbl-label");

  toolsSvg.appendChild(line);
  toolsSvg.appendChild(label);

  const rbl = { pps1, pps2, line, label };
  toolState.rbls.push(rbl);

  // Add click to remove
  line.addEventListener("click", (e) => {
    e.stopPropagation();
    removeRBL(rbl);
  });

  updateRBL(rbl);
  return rbl;
}

export function updateRBL(rbl) {
  const pos1 = getPPSPosition(rbl.pps1);
  const pos2 = getPPSPosition(rbl.pps2);

  rbl.line.setAttribute("x1", pos1.x);
  rbl.line.setAttribute("y1", pos1.y);
  rbl.line.setAttribute("x2", pos2.x);
  rbl.line.setAttribute("y2", pos2.y);

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distance = Math.round(pxToNm(Math.hypot(dx, dy)));
  const angle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);

  const midX = (pos1.x + pos2.x) / 2;
  const midY = (pos1.y + pos2.y) / 2;

  rbl.label.setAttribute("x", midX);
  rbl.label.setAttribute("y", midY - 5);
  rbl.label.textContent = `${distance} / ${angle}`;
}

export function removeRBL(rbl) {
  rbl.line.remove();
  rbl.label.remove();
  const index = toolState.rbls.indexOf(rbl);
  if (index > -1) toolState.rbls.splice(index, 1);
}

// === PTL Functions ===
export function createPTL(pps, aircraft, toolsSvg, minutes = 1) {
  // Remove halo if exists
  if (toolState.halos.has(pps)) {
    removeHalo(pps);
  }

  // Do nothing if there is a ptl
  if (toolState.ptls.has(pps)) {
    return;
  }

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("ptl-line");
  line.style.cursor = "pointer";
  line.style.pointerEvents = "auto";

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.classList.add("ptl-label");

  toolsSvg.appendChild(line);
  toolsSvg.appendChild(label);

  const ptl = { line, label, minutes, aircraft };
  toolState.ptls.set(pps, ptl);

  // Add click to remove
  line.addEventListener("click", (e) => {
    e.stopPropagation();
    removePTL(pps);
  });

  updatePTL(pps, ptl);
  return ptl;
}

export function updatePTL(pps, ptl) {
  const pos = getPPSPosition(pps);
  const { vx, vy } = headingToUnitVector(ptl.aircraft.heading);

  // Calculate distance traveled in n minutes
  // speed is in knots (per hour), convert to pixels per minute
  const nmPerMin = ptl.aircraft.speed / 6;
  const pixelsPerMinute = nmToPx(nmPerMin);
  const distance = pixelsPerMinute * ptl.minutes;

  const endX = pos.x + vx * distance;
  const endY = pos.y + vy * distance;

  ptl.line.setAttribute("x1", pos.x);
  ptl.line.setAttribute("y1", pos.y);
  ptl.line.setAttribute("x2", endX);
  ptl.line.setAttribute("y2", endY);

  const midX = (pos.x + endX) / 2;
  const midY = (pos.y + endY) / 2;

  ptl.label.setAttribute("x", midX);
  ptl.label.setAttribute("y", midY - 5);
  ptl.label.textContent = `${Math.round(pxToNm(distance))} / ${ptl.minutes}min`;
}

export function removePTL(pps) {
  const ptl = toolState.ptls.get(pps);
  if (ptl) {
    ptl.line.remove();
    ptl.label.remove();
    toolState.ptls.delete(pps);
  }
}

// === Halo Functions ===
export function createHalo(pps, toolsSvg, radius = 50) {
  // Remove PTL if exists
  if (toolState.ptls.has(pps)) {
    removePTL(pps);
  }

  // One halo only
  if (toolState.halos.has(pps)) {
    return;
  }

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  circle.classList.add("halo-circle");
  circle.setAttribute("stroke", "#ff00ff");
  circle.setAttribute("stroke-width", "2");
  circle.setAttribute("fill", "none");
  circle.style.cursor = "pointer";
  circle.style.pointerEvents = "auto";

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.classList.add("halo-label");
  label.setAttribute("fill", "#ff00ff");
  label.setAttribute("font-size", "12");
  label.setAttribute("text-anchor", "middle");

  toolsSvg.appendChild(circle);
  toolsSvg.appendChild(label);

  const halo = { circle, label, radius };
  toolState.halos.set(pps, halo);

  // Add click to remove
  circle.addEventListener("click", (e) => {
    e.stopPropagation();
    removeHalo(pps);
  });

  updateHalo(pps, halo);
  return halo;
}

export function updateHalo(pps, halo) {
  const pos = getPPSPosition(pps);

  halo.circle.setAttribute("cx", pos.x);
  halo.circle.setAttribute("cy", pos.y);
  halo.circle.setAttribute("r", halo.radius);

  halo.label.setAttribute("x", pos.x);
  halo.label.setAttribute("y", pos.y - halo.radius - 5);

  halo.label.textContent = `${pxToNm(halo.radius)} `;
}

export function removeHalo(pps) {
  const halo = toolState.halos.get(pps);
  if (halo) {
    halo.circle.remove();
    halo.label.remove();
    toolState.halos.delete(pps);
  }
}

// === Remove All Tools ===
export function removeAllTools(pps) {
  // Remove all RBLs connected to this PPS
  const rblsToRemove = toolState.rbls.filter(
    (rbl) => rbl.pps1 === pps || rbl.pps2 === pps
  );
  rblsToRemove.forEach((rbl) => removeRBL(rbl));

  // Remove PTL
  removePTL(pps);

  // Remove Halo
  removeHalo(pps);
}

// === Toolbar Setup ===
export function setupToolbar() {
  const toolButtons = document.querySelectorAll(".tool-btn");

  function setActiveTool(tool, btn) {
    if (btn.classList.contains("active")) {
      btn.classList.remove("active");
      toolState.selectedTool = null;
    } else {
      toolState.selectedTool = tool;
      toolButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
  }

  document.getElementById("rbl-tool").addEventListener("click", (e) => {
    toolState.rblFirstPPS = null;
    setActiveTool("rbl", e.currentTarget);
  });

  document.getElementById("ptl-tool").addEventListener("click", (e) => {
    setActiveTool("ptl", e.currentTarget);
  });

  document.getElementById("halo-tool").addEventListener("click", (e) => {
    setActiveTool("halo", e.currentTarget);
  });

  document.getElementById("clear-all-ptl").addEventListener("click", () => {
    [...toolState.ptls.keys()].forEach((pps) => removePTL(pps));
  });

  document.getElementById("clear-all-rbl").addEventListener("click", () => {
    [...toolState.rbls].forEach((rbl) => removeRBL(rbl));
  });

  document.getElementById("clear-all-halo").addEventListener("click", () => {
    [...toolState.halos.keys()].forEach((pps) => removeHalo(pps));
  });

  document.getElementById("clear-all-tools").addEventListener("click", () => {
    [...toolState.rbls].forEach(removeRBL);
    [...toolState.ptls.keys()].forEach(removePTL);
    [...toolState.halos.keys()].forEach(removeHalo);
  });
}

// === PPS Interaction Handlers ===
export function handlePPSClick(pps, aircraft, toolsSvg) {
  if (toolState.selectedTool === "rbl") {
    if (!toolState.rblFirstPPS) {
      toolState.rblFirstPPS = pps;
      pps.classList.add("rbl-selected");
    } else if (toolState.rblFirstPPS !== pps) {
      createRBL(toolState.rblFirstPPS, pps, toolsSvg);
      toolState.rblFirstPPS.classList.remove("rbl-selected");
      toolState.rblFirstPPS = null;
    }
  } else if (toolState.selectedTool === "ptl") {
    createPTL(pps, aircraft, toolsSvg, 1);
  } else if (toolState.selectedTool === "halo") {
    createHalo(pps, toolsSvg, 50);
  }
}

export function handlePPSScroll(pps, aircraft, deltaY) {
  if (toolState.ptls.has(pps)) {
    const ptl = toolState.ptls.get(pps);
    ptl.minutes = Math.max(1, ptl.minutes + (deltaY > 0 ? -1 : 1));
    updatePTL(pps, ptl);
  } else if (toolState.halos.has(pps)) {
    const halo = toolState.halos.get(pps);
    halo.radius = Math.max(10, halo.radius + (deltaY > 0 ? -10 : 10));
    updateHalo(pps, halo);
  }
}
// UI utilities and helpers

export function createScaleTicks(scaleBar, tickSpacing = 10) {
  scaleBar.querySelectorAll(".tick").forEach((t) => t.remove());
  const barWidth = scaleBar.offsetWidth;

  // Add left endpoint
  const leftTick = document.createElement("div");
  leftTick.className = "tick end";
  leftTick.style.left = `0px`;
  scaleBar.appendChild(leftTick);

  // Add right endpoint
  const rightTick = document.createElement("div");
  rightTick.className = "tick end";
  rightTick.style.left = `${barWidth - 1}px`; // -1 to stay inside the bar
  scaleBar.appendChild(rightTick);

  // Add intermediate ticks
  for (let x = tickSpacing; x < barWidth - 1; x += tickSpacing) {
    const tick = document.createElement("div");
    tick.className = "tick mid";
    tick.style.left = `${x}px`;
    scaleBar.appendChild(tick);
  }
}

export function updateObjectivesDisplay(sequence) {
  const objectivesList = document.getElementById("objectives-list");
  objectivesList.innerHTML = "";

  // Collect all non-random scenarios
  const objectives = [];
  for (const step of sequence) {
    if (step.type !== "random") {
      objectives.push(step);
    }
  }

  if (objectives.length === 0) {
    objectivesList.innerHTML =
      '<div class="objective-item"><span class="objective-type">Random Traffic</span></div>';
    return;
  }

  // Display all objectives
  const item = document.createElement("div");
  item.className = "objective-item";
  let displayName = "";
  let iconClass = "";

  objectives.forEach((step) => {
    switch (step.type) {
      case "conflict":
        displayName = "Potential Conflict";
        iconClass = "fa-solid fa-triangle-exclamation";
        break;
    }
    item.innerHTML += `
      <span class="objective">
        <i class="${iconClass}"></i>
        ${displayName}
      </span>
    `;
  });
  objectivesList.appendChild(item);
}
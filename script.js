document.addEventListener('DOMContentLoaded', () => {
    // === Radar screen & elements ===
    const radarScreen = document.getElementById('radar-screen');
    const nextScenarioBtn = document.getElementById('nextScenarioBtn');
    const aircraftContainer = document.getElementById('aircraft-container')
    const scaleBar = document.querySelector('#radar-scale .scale-bar');
    let currentScenario = {aircraft: []};

    // Tool state
    let selectedTool = null;
    let rblFirstPPS = null;
    const rbls = []; // Array of {pps1, pps2, line, label}
    const ptls = new Map(); // Map<pps, {line, label, minutes}>
    const halos = new Map(); // Map<pps, {circle, label, radius}>

    // Create one SVG layer to draw leader lines
    const leaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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

    // Constants
    const minSpeed = 25;
    const minAlt = 29
    const PX_TO_NM = 0.1;

    // === Aircraft type & performance maps ===
    const aircraftTypes = {
        A320: createAircraft("A320", 46, 41),
        B744: createAircraft("B744", 51, 45),
        B738: createAircraft("B738", 48, 41),
        C550: createAircraft("C550", 39, 45),
    };
    
    const callsignOperators = [
        "AAL",
        "ACA",
        "BAW",
        "DLH",
        "JAL",
        "UPS",
        "FDX",
        "WJA",
        "MAL",
    ];
    // === Scale Bar ===
    function createScaleTicks(scaleBar, tickSpacing = 10) {
        scaleBar.querySelectorAll('.tick').forEach(t => t.remove());
        const barWidth = scaleBar.offsetWidth;
        
        // Add left endpoint
        const leftTick = document.createElement('div');
        leftTick.className = 'tick end';
        leftTick.style.left = `0px`;
        scaleBar.appendChild(leftTick);

        // Add right endpoint
        const rightTick = document.createElement('div');
        rightTick.className = 'tick end';
        rightTick.style.left = `${barWidth - 1}px`; // -1 to stay inside the bar
        scaleBar.appendChild(rightTick);

        // Add intermediate ticks
        for (let x = tickSpacing; x < barWidth - 1; x += tickSpacing) {
            const tick = document.createElement('div');
            tick.className = 'tick mid';
            tick.style.left = `${x}px`;
            scaleBar.appendChild(tick);
        }
    }

    // === Tool Functions ===
    function createRBL(pps1, pps2) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add("rbl-line");
        line.setAttribute("stroke", "#00ff00");
        line.setAttribute("stroke-width", "2");
        line.style.cursor = "pointer";
        line.style.pointerEvents = "auto";
        
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.classList.add("rbl-label");
        
        toolsSvg.appendChild(line);
        toolsSvg.appendChild(label);
        
        const rbl = { pps1, pps2, line, label };
        rbls.push(rbl);
        
        // Add click to remove
        line.addEventListener('click', (e) => {
            e.stopPropagation();
            removeRBL(rbl);
        });
        
        updateRBL(rbl);
        return rbl;
    }

    function updateRBL(rbl) {
        const pos1 = getPPSPosition(rbl.pps1);
        const pos2 = getPPSPosition(rbl.pps2);
        
        rbl.line.setAttribute("x1", pos1.x);
        rbl.line.setAttribute("y1", pos1.y);
        rbl.line.setAttribute("x2", pos2.x);
        rbl.line.setAttribute("y2", pos2.y);
        
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.round(pxToNm(Math.hypot(dx, dy)));
        const angle = Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360);
        
        const midX = (pos1.x + pos2.x) / 2;
        const midY = (pos1.y + pos2.y) / 2;
        
        rbl.label.setAttribute("x", midX);
        rbl.label.setAttribute("y", midY - 5);
        rbl.label.textContent = `${distance} / ${angle}`;
    }

    function removeRBL(rbl) {
        rbl.line.remove();
        rbl.label.remove();
        const index = rbls.indexOf(rbl);
        if (index > -1) rbls.splice(index, 1);
    }

    function createPTL(pps, aircraft, minutes = 1) {
        // Remove halo if exists
        if (halos.has(pps)) {
            removeHalo(pps);
        }

        // Do nothing if there is a ptl
        if (ptls.has(pps)) {
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
        ptls.set(pps, ptl);
        
        // Add click to remove
        line.addEventListener('click', (e) => {
            e.stopPropagation();
            removePTL(pps);
        });
        
        updatePTL(pps, ptl);
        return ptl;
    }

    function updatePTL(pps, ptl) {
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

    function removePTL(pps) {
        const ptl = ptls.get(pps);
        if (ptl) {
            ptl.line.remove();
            ptl.label.remove();
            ptls.delete(pps);
        }
    }

    function createHalo(pps, radius = 50) {
        // Remove PTL if exists
        if (ptls.has(pps)) {
            removePTL(pps);
        }

        // One halo only
        if (halos.has(pps)) {
            return;
        }
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
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
        halos.set(pps, halo);
        
        // Add click to remove
        circle.addEventListener('click', (e) => {
            e.stopPropagation();
            removeHalo(pps);
        });
        
        updateHalo(pps, halo);
        return halo;
    }

    function updateHalo(pps, halo) {
        const pos = getPPSPosition(pps);
        
        halo.circle.setAttribute("cx", pos.x);
        halo.circle.setAttribute("cy", pos.y);
        halo.circle.setAttribute("r", halo.radius);
        
        halo.label.setAttribute("x", pos.x);
        halo.label.setAttribute("y", pos.y - halo.radius - 5);

        halo.label.textContent = `${pxToNm(halo.radius)} `;
    }

    function removeHalo(pps) {
        const halo = halos.get(pps);
        if (halo) {
            halo.circle.remove();
            halo.label.remove();
            halos.delete(pps);
        }
    }

    function getPPSPosition(pps) {
        const wrapper = pps.parentElement;
        const x = parseFloat(wrapper.style.left);
        const y = parseFloat(wrapper.style.top);
        return { x, y };
    }

    function removeAllTools(pps) {
        // Remove all RBLs connected to this PPS
        const rblsToRemove = rbls.filter(rbl => rbl.pps1 === pps || rbl.pps2 === pps);
        rblsToRemove.forEach(rbl => removeRBL(rbl));
        
        // Remove PTL
        removePTL(pps);
        
        // Remove Halo
        removeHalo(pps);
    }

    // === Toolbar Setup ===
    function setupToolbar() {
        const toolButtons = document.querySelectorAll('.tool-btn');
        
        function setActiveTool(tool, btn) {
            if (btn.classList.contains('active')) {
                btn.classList.remove('active');
                selectedTool = null;
            } else {
                selectedTool = tool;
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        }

        document.getElementById('rbl-tool').addEventListener('click', e => {
            rblFirstPPS = null;
            setActiveTool('rbl', e.currentTarget);
        });

         document.getElementById('ptl-tool').addEventListener('click', e => {
            setActiveTool('ptl', e.currentTarget);
        });

        document.getElementById('halo-tool').addEventListener('click', e => {
            setActiveTool('halo', e.currentTarget);
        });

        document.getElementById('clear-all-ptl').addEventListener('click', () => {
            [...ptls.keys()].forEach(pps => removePTL(pps));
        });

        document.getElementById('clear-all-rbl').addEventListener('click', () => {
            [...rbls].forEach(rbl => removeRBL(rbl));
        });

        document.getElementById('clear-all-halo').addEventListener('click', () => {
            [...halos.keys()].forEach(pps => removeHalo(pps));
        });

        document.getElementById('clear-all-tools').addEventListener('click', () => {
            [...rbls].forEach(removeRBL);
            [...ptls.keys()].forEach(removePTL);
            [...halos.keys()].forEach(removeHalo);
        });

    }

    // Helper functions
    function pxToNm(px) {
        return px * PX_TO_NM;
    }

    function nmToPx(nm) {
        return nm / PX_TO_NM;
    }


    function createAircraft(type, maxSpeed, maxAlt) {
        return { type, maxSpeed, maxAlt };
    }

    function randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function isTooClose(a, b, minNm = 5) {
        const dx = a.longitude - b.longitude;
        const dy = a.latitude - b.latitude;
        return Math.hypot(dx, dy) < nmToPx(minNm);
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function headingToUnitVector(deg) {
        const rad = deg * Math.PI / 180;
        const vx = Math.sin(rad);
        const vy = -Math.cos(rad);
        return { vx, vy };
    }

    function speedToTrailSpacingPx(speed) {
        return nmToPx(speed / 120);
    }

    function getClosestPointOnRect(rectX, rectY, rectWidth, rectHeight, targetX, targetY) {
        // Calculate center of rectangle
        const centerX = rectX + rectWidth / 2;
        const centerY = rectY + rectHeight / 2;
        
        // Vector from center to target
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        
        // Check if target is inside the rectangle
        if (targetX >= rectX && targetX <= rectX + rectWidth &&
            targetY >= rectY && targetY <= rectY + rectHeight) {
            // Target is inside, find closest edge
            const distToLeft = targetX - rectX;
            const distToRight = (rectX + rectWidth) - targetX;
            const distToTop = targetY - rectY;
            const distToBottom = (rectY + rectHeight) - targetY;
            
            const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
            
            if (minDist === distToLeft) return { x: rectX, y: targetY };
            if (minDist === distToRight) return { x: rectX + rectWidth, y: targetY };
            if (minDist === distToTop) return { x: targetX, y: rectY };
            return { x: targetX, y: rectY + rectHeight };
        }
        
        // Target is outside, project onto edges
        let closestPoint = { x: centerX, y: centerY };
        let minDistance = Infinity;
        
        // Top edge
        if (dy < 0) {
            const pointX = clamp(targetX, rectX, rectX + rectWidth);
            const dist = Math.hypot(pointX - targetX, rectY - targetY);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = { x: pointX, y: rectY };
            }
        }
        
        // Bottom edge
        if (dy > 0) {
            const pointX = clamp(targetX, rectX, rectX + rectWidth);
            const dist = Math.hypot(pointX - targetX, rectY + rectHeight - targetY);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = { x: pointX, y: rectY + rectHeight };
            }
        }
        
        // Left edge
        if (dx < 0) {
            const pointY = clamp(targetY, rectY, rectY + rectHeight);
            const dist = Math.hypot(rectX - targetX, pointY - targetY);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = { x: rectX, y: pointY };
            }
        }
        
        // Right edge
        if (dx > 0) {
            const pointY = clamp(targetY, rectY, rectY + rectHeight);
            const dist = Math.hypot(rectX + rectWidth - targetX, pointY - targetY);
            if (dist < minDistance) {
                minDistance = dist;
                closestPoint = { x: rectX + rectWidth, y: pointY };
            }
        }
        
        return closestPoint;
    }

    function setLine(lineEl, x1, y1, x2, y2) {
        lineEl.setAttribute("x1", x1);
        lineEl.setAttribute("y1", y1);
        lineEl.setAttribute("x2", x2);
        lineEl.setAttribute("y2", y2);
    }

    function createLeaderLine() {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add("leader-line");
        leaderSvg.appendChild(line);
        return line;
    }

    function createDataTag(aircraft, aircraftX, aircraftY) {
        const tag = document.createElement("div");
        tag.className = "data-tag";

        tag.textContent = `${aircraft.callsign}\n${aircraft.altitude}  ${aircraft.speed}\n${aircraft.aircraftModel}`;

        tag.style.position = "absolute";
        
        const radarWidth = radarScreen.getBoundingClientRect().width;
        const radarHeight = radarScreen.getBoundingClientRect().height;
        const tagWidth = 100;
        const tagHeight = 50;
        
        let initialX = aircraftX + 40;
        let initialY = aircraftY - 20;
        
        initialX = clamp(initialX, 10, radarWidth - tagWidth - 10);
        initialY = clamp(initialY, 10, radarHeight - tagHeight - 10);
        
        tag.style.left = `${initialX}px`;
        tag.style.top = `${initialY}px`;

        radarScreen.appendChild(tag);

        return tag;
    }

    function updateLeaderForAircraft(aircraftX, aircraftY, tagEl, lineEl) {
        const tagX = parseFloat(tagEl.style.left);
        const tagY = parseFloat(tagEl.style.top);
        const tagWidth = tagEl.offsetWidth;
        const tagHeight = tagEl.offsetHeight;

        // Get the closest point on the tag's edge to the aircraft
        const closestPoint = getClosestPointOnRect(
            tagX, 
            tagY, 
            tagWidth, 
            tagHeight, 
            aircraftX, 
            aircraftY
        );

        setLine(lineEl, aircraftX, aircraftY, closestPoint.x, closestPoint.y);
    }

    function generateCallsign() {
        const prefix = randomChoice(callsignOperators);
        const number = Math.floor(Math.random() * 900) + 100;
        return `${prefix}${number}`;
    }

    function renderTrail(wrapper, aircraft, numDots = 4) {
        wrapper.querySelectorAll('.trail-dot').forEach(d => d.remove());

        const { vx, vy } = headingToUnitVector(aircraft.heading);
        const spacing = speedToTrailSpacingPx(aircraft.speed);

        for (let i = 1; i <= numDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'trail-dot';

            const x = -vx * spacing * i;
            const y = -vy * spacing * i;

            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;

            wrapper.appendChild(dot);
        }
    }

    function enableTagDragging(tag, anchorX, anchorY, lineEl, maxDist = 180) {
        let dragging = false;
        let offsetX, offsetY;
        
        const radarRect = radarScreen.getBoundingClientRect();

        tag.addEventListener('mousedown', e => {
            dragging = true;
            const tagRect = tag.getBoundingClientRect();
            offsetX = e.clientX - tagRect.left;
            offsetY = e.clientY - tagRect.top;
            tag.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;

            let x = e.clientX - radarRect.left - offsetX;
            let y = e.clientY - radarRect.top - offsetY;

            const dx = x - anchorX;
            const dy = y - anchorY;
            const dist = Math.hypot(dx, dy);
            
            if (dist > maxDist) {
                const s = maxDist / dist;
                x = anchorX + dx * s;
                y = anchorY + dy * s;
            }

            const tagWidth = tag.offsetWidth;
            const tagHeight = tag.offsetHeight;
            x = clamp(x, 0, radarRect.width - tagWidth);
            y = clamp(y, 0, radarRect.height - tagHeight);

            tag.style.left = `${x}px`;
            tag.style.top = `${y}px`;
            
            updateLeaderForAircraft(anchorX, anchorY, tag, lineEl);
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                tag.style.cursor = 'grab';
            }
        });
    }

    function positionAircraft(wrapper, aircraft) {
        wrapper.style.left = `${aircraft.longitude}px`;
        wrapper.style.top = `${aircraft.latitude}px`;
    }

    function createAircraftInstance(radarRangePx, pad) {
        const modelName = randomChoice(Object.keys(aircraftTypes));
        const modelData = aircraftTypes[modelName];

        const latitude = Math.round(Math.random() * (radarRangePx - pad * 2)) + pad;
        const longitude = Math.round(Math.random() * (radarRangePx - pad * 2)) + pad;

        const heading = 
            Math.floor(Math.random() * 360 + 1)
        
        let altitude = 
            Math.round(Math.random() * (modelData.maxAlt - minAlt - 1) + minAlt + 1);
        
        const eastbound = heading < 180;
        const isOdd = altitude % 2 !== 0;

        if (eastbound && !isOdd) altitude += 1;
        if (!eastbound && isOdd) altitude += 1;

        const speed =
            Math.round(Math.random() * (modelData.maxSpeed - minSpeed) + minSpeed);

        return {
            id: crypto.randomUUID(),
            callsign: generateCallsign(),
            aircraftModel: modelName,
            modelData: modelData,
            latitude: latitude,
            longitude: longitude,
            altitude: altitude,
            speed: speed,
            heading: heading,
        };
    }

    function createAircraftWrapper(aircraft) {
        const wrapper = document.createElement('div');
        wrapper.className = 'aircraft';
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${aircraft.longitude}px`;
        wrapper.style.top = `${aircraft.latitude}px`;

        aircraftContainer.appendChild(wrapper);
        return wrapper;
    }

    function createPPS(wrapper, aircraft) {
        const pps = document.createElement('div');
        pps.className = 'pps';
        pps.style.position = 'absolute';
        pps.style.left = '0px';
        pps.style.top = '0px';
        pps.style.transform = 'translate(-50%, -50%)';
        wrapper.appendChild(pps);
        
        // Add click handler for tools
        pps.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePPSClick(pps, aircraft);
        });
        
        // Add right-click to remove all tools
        pps.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            removeAllTools(pps);
        });
        
        // Add scroll handler for PTL/Halo adjustment
        pps.addEventListener('wheel', (e) => {
            e.preventDefault();
            handlePPSScroll(pps, aircraft, e.deltaY);
        });
        
        return pps;
    }

    function handlePPSClick(pps, aircraft) {
        if (selectedTool === 'rbl') {
            if (!rblFirstPPS) {
                rblFirstPPS = pps;
                pps.classList.add('rbl-selected');
            } else if (rblFirstPPS !== pps) {
                createRBL(rblFirstPPS, pps);
                rblFirstPPS.classList.remove('rbl-selected');
                rblFirstPPS = null;
            }
        } else if (selectedTool === 'ptl') {
            createPTL(pps, aircraft, 1);
        } else if (selectedTool === 'halo') {
            createHalo(pps, 50);
        }
    }

    function handlePPSScroll(pps, aircraft, deltaY) {
        if (ptls.has(pps)) {
            const ptl = ptls.get(pps);
            ptl.minutes = Math.max(1, ptl.minutes + (deltaY > 0 ? -1 : 1));
            updatePTL(pps, ptl);
        } else if (halos.has(pps)) {
            const halo = halos.get(pps);
            halo.radius = Math.max(10, halo.radius + (deltaY > 0 ? -10 : 10));
            updateHalo(pps, halo);
        }
    }

    function generateScenario(count = 1) {
        const radarRangePx = radarScreen.getBoundingClientRect().width;
        const pad = 50;

        // Clear previous scenario and all tools
        aircraftContainer.innerHTML = '';
        leaderSvg.innerHTML = '';
        toolsSvg.innerHTML = '';
        radarScreen.querySelectorAll('.data-tag').forEach(tag => tag.remove());
        rbls.length = 0;
        ptls.clear();
        halos.clear();
        rblFirstPPS = null;
        currentScenario = { aircraft: [] };

        for (let i = 0; i < count; i++) {
            let aircraftIn;
            let safe;
            let attempts = 0;
            
            do {
                aircraftIn = createAircraftInstance(radarRangePx, pad);
                safe = currentScenario.aircraft.length === 0 || currentScenario.aircraft.every(
                    a => !isTooClose(a.aircraftIn, aircraftIn)
                );
                attempts++;
                if (attempts > 100) {
                    console.warn('Could not place all aircraft safely, placed ' + i + ' aircraft');
                    return;
                }
            } while (!safe);
            
            const aircraftWrapper = createAircraftWrapper(aircraftIn);
            
            const ppsEl = createPPS(aircraftWrapper, aircraftIn);
            const lineEl = createLeaderLine();
            const tagEl = createDataTag(aircraftIn, aircraftIn.longitude, aircraftIn.latitude);

            positionAircraft(aircraftWrapper, aircraftIn);
            renderTrail(aircraftWrapper, aircraftIn, 4);
            updateLeaderForAircraft(aircraftIn.longitude, aircraftIn.latitude, tagEl, lineEl);

            enableTagDragging(tagEl, aircraftIn.longitude, aircraftIn.latitude, lineEl, 180);

            currentScenario.aircraft.push({
                aircraftIn: aircraftIn,
                wrapperEl: aircraftWrapper,
                ppsEl: ppsEl,
                tagEl: tagEl,
                lineEl: lineEl
            });
        }
        
        console.log(`Generated ${currentScenario.aircraft.length} aircraft`);
    }

    // Set up the buttons
    nextScenarioBtn.addEventListener('click', () => {
        const count = Math.floor(Math.random() * 8) + 3;
        generateScenario(count);
    });
    
    setupToolbar();
    createScaleTicks(scaleBar);
    generateScenario(5);
});
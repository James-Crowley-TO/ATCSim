# ATC Conflict Recognition Trainer

A dependency-free browser application for practising conflict recognition with static en-route radar snapshots. Each scenario contains validated intentional conflicts and background traffic.

## Running

Extract the entire ZIP into a folder, then serve that folder:

```bash
python -m http.server 8000
```

Open http://localhost:8000 in a browser. JavaScript modules require a local server; opening `index.html` directly is not supported. No package installation or build step is required.

## Radar and navigation

The initial view covers a fictitious 76 NM square. Drag empty radar space to pan; wheel zoom is centred on the cursor. The +/− buttons also zoom. Reset view restores the initial coverage. Resizing preserves the world point at the viewport centre and the relative zoom.

One SVG renders the radar. Its viewBox matches the display dimensions, so one SVG unit equals one CSS pixel. The camera converts world positions to screen positions explicitly. Text, target symbols, history dots and stroke widths remain constant in screen size; map geometry and measured distances expand with zoom. No CSS-scaled parent, raster layer or `will-change: transform` is used.

Rendering is scheduled once per animation frame when something changes. SVG elements are reused, text is measured only when a new tag is created, and scale ticks are retained. Nothing redraws continuously while the scenario is idle.

Drag data tags to reposition them. Their offsets remain in screen pixels at every zoom level. The closed sector outline and centre cross are fictitious visual references.

At most one background aircraft begins outside the opening view. Each eligible placement has a 16% off-screen chance; the aircraft points towards the centre and still passes conflict validation. Most aircraft, including intentional conflict pairs, start in view.

## Clock and flight strips

The clock above the grey flight strips is a random UTC time, fixed for the lifetime of the static scenario. It is not a live clock. New scenario generates a new time.

Strips show each aircraft's UTC time of closest approach to the original radar centre, even when its track does not pass exactly through that point. They are sorted by the full signed time offset, not their formatted time strings. Panning, zooming and resizing do not alter the reference or reorder the strips.

Times include seconds and a Z suffix for UTC. Estimates across midnight show `(+1d)` or `(−1d)`. Every aircraft has a strip, including off-screen aircraft; use the strips to guide your radar scan.

## Cleared levels

An aircraft changing altitude always has a valid cleared flight level in the direction of travel and within its simplified performance envelope. The clearance appears in purple above the callsign on both its radar tag and its flight strip:

```text
360
CFC2841
410 ↓10 46
A343
```

This represents FL410 descending at 1,000 ft/min, cleared to FL360, at a displayed speed code of 46 (460 kt). The strip and radar use the same formatting function. Level aircraft omit the extra clearance row.

Conflict predictions stop a climb or descent at the assigned clearance. They do not extrapolate vertical speed beyond the level-off.

## Tools

| Tool | Selection | Display |
| --- | --- | --- |
| PTL | One target | Projected track for an adjustable 1–12 minutes. |
| RBL | Two targets | Current horizontal range and bearing from the first target to the second. |
| Halo | One target | Adjustable 1–20 NM distance ring. |
| PIV | Two targets | Both projected vectors to their simultaneous future closest approach. |

Scroll over a target to adjust its active PTL or halo; this takes priority over camera zoom. If both tools exist, select the one to adjust. Right-click a target to clear all its tools. Click a tool line to remove that tool. Clear buttons remove a tool category or every tool.

PIV first checks that the two **forward tracks intersect**, including collinear head-on or overtaking traffic. It then calculates the exact common future time that minimises horizontal distance:

```text
r = positionB − positionA
v = velocityB − velocityA
tCPA = −dot(r, v) / dot(v, v)
```

This is not either aircraft's independent arrival time at the geometric crossing. Each vector ends at its aircraft's position at tCPA. Distances flown appear along the respective vectors; a dashed connector shows the endpoint separation; the UTC CPA time appears at the end of the longer vector. The two endpoints need not coincide.

No PIV is drawn for non-intersecting forward tracks, a closest approach already passed, or equal velocities with no unique future intercept. A status message explains unsuccessful selections. Near-parallel cases use numerical tolerances. PIV is horizontal geometry and has no separation threshold or scenario look-ahead cap; an intercept can be vertically separated or outside the assessment window.

## Controls

- New scenario: button or N.
- Pair selection: click two targets; click the first again or press Escape to cancel.
- Radar navigation: drag, wheel, +/− buttons, Reset view.
- With radar focused: arrow keys pan, +/− zoom, Home resets.
- With a target focused: Enter or Space applies the selected tool.
- Reveal answer: show the validated conflict pairs, loss times and CPA separation.

## Separation model

A conflict requires simultaneous separation below 5 NM horizontally and 1,000 ft vertically within the assessment window. Horizontal speed and heading are constant; vertical motion stops at the clearance. The conflict predictor samples every three seconds. PIV's horizontal CPA is analytic, so its time can differ slightly from the sampled answer.

| Difficulty | Aircraft | Intentional conflicts | Look-ahead |
| --- | ---: | ---: | ---: |
| Easy | 4–6 | 1 | 8 min |
| Medium | 7–9 | 2 | 10 min |
| Hard | 10–13 | 3 | 12 min |

## Tests

With Node.js installed:

```bash
npm test
```

The tests cover unequal crossing times, exact intersections, head-on and overtaking cases, non-intercepts, midnight wraparound, clearance level-offs, camera invariants, tool selection/clearing, and generated scenario validity. The SVG sink in tool tests checks emitted geometry and controller state; it is not a browser layout engine.

## Files

- `main.js`: application setup and scenario lifecycle.
- `radar.js`: SVG elements, display coordinates, navigation, tag dragging and frame scheduling.
- `camera.js`: pure camera coordinate transformations.
- `tools.js`: PTL, RBL, halo and PIV state and SVG geometry.
- `aircraft.js`: aircraft generation, cleared levels and shared display rows.
- `scenarios.js`: bounded scenario generation and conflict validation.
- `utils.js`: geometry, time formatting, projection, level-off and SVG helpers.
- `ui.js`: clock, strips, briefing and answer panel.
- `constants.js`: units, performance envelopes and exercise settings.
- `index.html`, `style.css`, `pps.css`: shell, layout and SVG symbology.
- `tests/`: calculation and tool-state checks.

This is a geometric training aid. Performance envelopes are approximate, the boundary is decorative, and the model does not include turns, wind, acceleration, surveillance uncertainty, procedural separation or real operational clearance handling.


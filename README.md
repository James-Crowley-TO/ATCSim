# ATC Conflict Recognition Trainer

A dependency-free browser application that generates static en-route radar snapshots for practising ATC conflict recognition and problem solving.

The project is intentionally **not** a full ATC simulator. It presents a traffic picture, gives the user familiar geometric aids, and asks a narrower question: **which aircraft pairs will lose separation if nobody acts?** That keeps the exercise focused on scanning, projection, geometry, prioritisation, and verification.

## What the trainer does

- Generates a fresh radar snapshot at **Easy**, **Medium**, or **Hard** difficulty.
- Places a known number of intentional future conflicts and then adds background traffic.
- Rejects background aircraft that would create accidental extra conflicts.
- Validates the completed scene before showing it, so the hidden answer agrees with the generated geometry.
- Uses explicit internal units: knots, flight levels, feet per minute, nautical miles, pixels, and minutes.
- Provides three interactive aids:
  - **PTL** — projected track line. Scroll over the target to change projection time.
  - **RBL** — range/bearing line between two targets.
  - **Halo** — adjustable distance ring. Scroll over the target to change radius.
- Keeps the answer hidden until **Reveal answer** is selected. The answer lists the conflicting callsigns, approximate start of loss of separation, and closest point of approach (CPA).
- Supports cursor-centred wheel zoom, click-and-drag panning, and a one-click viewport reset.
- Occasionally generates traffic beyond the opening viewport, with every aircraft represented in a flight-strip bay sorted by its projected centre-crossing time.
- Draws a fictitious sector boundary in world coordinates so it remains aligned while the radar is moved.

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


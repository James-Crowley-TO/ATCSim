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

## Radar navigation and strips

The initial view covers a fixed 76 NM square, fitted to the available display. Wheel zoom is cursor-centred; drag empty radar space to pan. Reset view (also applied on resize and new scenarios) restores the original coverage. Existing PTL/halo wheel adjustment takes priority over zoom.

At most one background aircraft starts outside the initial view. Each eligible background placement has a 16% chance of being off-screen; these tracks point towards the centre and still pass conflict validation. Intentional conflict pairs remain initially visible.

Strips are ordered by signed time of closest approach to the original centre, not literal passage through that point: most arbitrary tracks do not intersect it. Negative times indicate passage already occurred. Times use minutes relative to the static snapshot; panning does not change their order. The closed sector outline is fictitious and decorative, not an operational boundary.

## Conflict calculation

A conflict is predicted when two linearly projected tracks come within both:

- **5 NM horizontally**, and
- **1,000 ft vertically**

inside the difficulty's look-ahead window. The predictor samples trajectories every three seconds. Aircraft performance envelopes are deliberately approximate; they exist to keep generated traffic plausible, not to model certified aircraft performance.

## Difficulty

| Level | Aircraft | Intentional conflicts | Look-ahead |
| --- | ---: | ---: | ---: |
| Easy | 4–6 | 1 | 8 min |
| Medium | 7–9 | 2 | 10 min |
| Hard | 10–13 | 3 | 12 min |

Conflict counts are not shown until the answer is revealed.

## Running locally

Because the application uses JavaScript modules, serve the folder through a local web server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

No build step or third-party package is required.

## Controls

1. Choose a difficulty.
2. Drag empty radar space to pan, use the mouse wheel to zoom around the cursor, or select **Reset view**.
3. Scan the flight-strip bay; an aircraft listed there may initially be outside the visible area.
4. Select **PTL**, **RBL**, or **Halo**.
5. Click aircraft targets to apply the selected tool. RBL requires two targets.
6. Scroll over a target to adjust an active PTL or halo. Right-click a target to clear all tools attached to it.
7. Select **Reveal answer** only after you have identified the conflicts.
8. Select **New scenario** or press **N** for another exercise.

## Project structure

- `index.html` — accessible application shell and radar layers.
- `constants.js` — units, separation standards, aircraft envelopes, and difficulty settings.
- `utils.js` — geometry, randomisation, conversion, and projection helpers.
- `aircraft.js` — aircraft creation and radar-target rendering.
- `scenarios.js` — bounded scenario generation, conflict prediction, rejection sampling, and validation.
- `tools.js` — PTL, RBL, halo, and toolbar state.
- `ui.js` — briefing, scale, answer, and error rendering.
- `main.js` — application orchestration.
- `style.css` / `pps.css` — layout and radar symbology.

## Design scope

This is a training aid for geometric reasoning, not an operational ATC system. It does not model wind, acceleration, turns, sector boundaries, wake turbulence, surveillance uncertainty, procedural separation, route structure, coordination, clearances, or jurisdiction-specific rules. Those omissions are deliberate so the project remains small, understandable, and useful for repeated problem-solving practice.

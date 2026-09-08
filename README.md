# ATC Conflict Recognition Trainer

A dependency-free browser application for practising conflict recognition with static en-route radar snapshots. Each scenario contains validated intentional conflicts and background traffic.

## Running

Extract the entire ZIP into a folder, then serve that folder:

```bash
python -m http.server 8000
```

Open http://localhost:8000 in a browser. JavaScript modules require a local server; opening `index.html` directly is not supported. No package installation or build step is required.


Also hosted here:
https://james-crowley-to.github.io/ATCSim/

## Radar and navigation

The included North Channel map covers a fictitious 76 NM square. Drag empty radar space to pan; wheel zoom is centred on the cursor. The +/− buttons also zoom. Reset view restores the initial coverage. Resizing preserves the world point at the viewport centre and the relative zoom.

One SVG renders the radar. Its viewBox matches the display dimensions, so one SVG unit equals one CSS pixel. The camera converts world positions to screen positions explicitly. Text, target symbols, history dots and stroke widths remain constant in screen size; map geometry and measured distances expand with zoom. No CSS-scaled parent, raster layer or `will-change: transform` is used.

Rendering is scheduled once per animation frame when something changes. SVG elements are reused, text is measured only when a new tag is created, and scale ticks are retained. Nothing redraws continuously while the scenario is idle.

Drag data tags to reposition them. Their offsets remain in screen pixels at every zoom level. All map geometry beneath the traffic comes from `maps/north-channel.map` rather than being hard-coded in the renderer.

At most one background aircraft begins outside the opening view. Each eligible placement has a 16% off-screen chance; the aircraft points towards the centre and still passes conflict validation. Most aircraft, including intentional conflict pairs, start in view.

## Map DSL

Maps are ordinary text files. The DSL is deliberately small: one command per line, whitespace-separated values, and `key=value` style options. Blank lines and lines beginning with `#` or `//` are ignored. Quotation marks allow labels and map names to contain spaces.

Coordinates and radii are in nautical miles. `(0, 0)` is the upper-left corner, X increases eastward, and Y increases southward. Arc bearings are degrees clockwise from north. Stroke widths, point sizes and hash dimensions are screen pixels, so symbology remains legible at every zoom level.

```text
MAP "Example Sector"
SIZE 76 76

LAYER routes
STYLE color=#75a9ba opacity=0.4 width=1 pattern=dashed
LINE 8 60 38 38
ARC 38 38 20 220 40 pattern=hashed hash-spacing=16 hash-length=6
CIRCLE 38 38 10 pattern=dotted

LAYER fixes
STYLE color=#9ad9e8 opacity=0.85 width=1.2 shape=triangle size=5
POINT 38 38 label="CENTRE" filled=true
POINT 54 27 label=EAST shape=square rotation=45
```

| Command | Arguments | Purpose |
| --- | --- | --- |
| `MAP` | name | Declares the map name. |
| `SIZE` | width height | Sets map dimensions in NM. |
| `LAYER` | name | Selects or creates a named drawing layer. |
| `STYLE` | options | Changes defaults for subsequent features in that layer. |
| `LINE` | x1 y1 x2 y2 | Draws a straight segment. |
| `ARC` | centreX centreY radius start end | Draws a clockwise circular arc. |
| `CIRCLE` | centreX centreY radius | Draws a complete circle. |
| `POINT` | x y | Draws a point marker and optional label. |

Every drawing command may override the active style. Lines, arcs and circles support `pattern=solid`, `dashed`, `dotted`, or `hashed`; hashed geometry receives real perpendicular tick marks. Shared options are `color`, `opacity`, and `width`. Points additionally support `shape=circle`, `square`, `triangle`, `diamond`, or `cross`, plus `size`, `rotation`, `filled`, and `label`. Hashed geometry accepts `hash-spacing` and `hash-length`.

To use another base map, change `MAP_FILES` in `main.js`. Additional files in that list are loaded as overlays in list order. Overlay files use the same `SIZE`; layers with the same name are combined. Parser errors identify the offending filename and line number.

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

The tests cover the map grammar, style inheritance and overrides, overlay merging, geometry rendering, map-file loading and parser error reporting.

## Files

- `main.js`: application setup and scenario lifecycle.
- `map.js`: map DSL parser, overlay merger and reusable SVG renderer.
- `maps/north-channel.map`: editable map geometry and symbology.
- `radar.js`: traffic SVG elements, display coordinates, navigation, tag dragging and frame scheduling.
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

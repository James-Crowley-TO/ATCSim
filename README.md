# ATC Conflict Recognition Trainer — Sandbox Update

A dependency-free extension of the supplied JavaScript/SVG application. Normal Mode, Sandbox Mode and Map-Maker share the existing camera, aircraft objects, themes, map DSL and renderer.

## Run Online

https://james-crowley-to.github.io/ATCSim/

## Install and run

Extract the complete bundle and run it from its `atc-sandbox` directory. When updating an existing checkout, copy **all** files in this directory, including the new JavaScript modules and the `maps/` directory. Preserve any additional custom maps you already have.

With Node.js:

```bash
npm run dev
```

Then open `http://localhost:8000`. Alternatively, serve this directory with `python -m http.server 8000`. No package installation or build step is needed. Opening `index.html` directly with `file://` does not support the application's module imports and map loading.

The included New Martin map loads by default, with North Channel as a fallback. Both supplied map files are included at the paths expected by `main.js`. If neither file loads, an empty map remains available so the editing modes still work.

## Modes

Use the labelled mode buttons above the radar. Clicking **Exit Sandbox Mode** returns to Normal. **Exit Map-Maker Mode** returns to the mode used before entering Map-Maker. You can also select Normal or Sandbox explicitly.

Mode switches preserve aircraft objects, saved edits, warning selections, scenario time, answer state, camera view and data-tag offsets. Entering Map-Maker from Sandbox exits Sandbox and clears its measurements. Applied map edits stay in the session when Map-Maker is closed.

The supplied trainer uses static snapshots: there is no aircraft-motion or scenario-progression timer. Map-Maker blocks scenario controls and the N shortcut. New scenarios are generated only by explicit normal scenario actions, including the existing initial generation on page startup.

**Empty session** removes the current traffic and scenario after confirmation. This provides an empty radar for building traffic in Sandbox. New scenario and difficulty changes retain their original generation behavior; replacing saved aircraft edits requires confirmation. Failed generation preserves the current session.

## Sandbox tools

| Tool | Placement | Result |
| --- | --- | --- |
| Ruler | Click the start, then the endpoint. | Distance in NM, shown to two decimal places. |
| Protractor | Click the vertex, a point on ray 1, then a point on ray 2. | Clockwise angle from ray 1 to ray 2, from 0° up to 360°, displayed to one decimal place. North-to-east is 90°; east-to-north is 270°. |
| Place aircraft | Click the desired radar position. | A draft PPS and aircraft editor. Save commits it; Cancel or Escape removes the draft. |

Multiple measurements coexist without an application limit. They use world coordinates, so panning and zooming do not change their values. They measure fixed positions; they are not attached to aircraft.

The active tool is highlighted, and the status line explains the next click. **Cancel placement**, Escape, or right-clicking empty radar space cancels the current unfinished placement. **Clear measurements** removes completed measurements too. Selecting the active sandbox tool again deselects it. All measurements and previews disappear when leaving Sandbox.

Drag the radar to pan, including while a placement tool is selected. A movement threshold distinguishes a click from a drag; dragging never places a measurement or element. The wheel zooms around the cursor in the editing modes. Data tags can still be dragged independently in Sandbox. Normal PTL/halo wheel adjustment resumes in Normal Mode.

## Aircraft editor

In Sandbox, right-click an aircraft PPS to edit it. A focused PPS can also be edited with Enter or Space. Existing values are populated; IDs are displayed read-only.

The editor exposes every editable field in the supplied aircraft model:

- Callsign and supported aircraft type.
- X/east and Y/south position, presented in nautical miles.
- Heading, clockwise from north; 360° is normalized to 000°.
- Speed in knots, flight level, vertical rate in feet/minute, and cleared flight level.

A strip requires callsign, aircraft type, position, heading, speed, flight level, vertical rate and a reachable cleared level. Blank optional fields may be saved as incomplete traffic. Such an aircraft has a dashed PPS, an **INCOMPLETE** tag, and no flight strip. Once all fields are supplied, Save creates exactly one strip. At zero vertical rate, clearance is derived from the current flight level and is read-only. For climbing or descending aircraft, clearance must be in the correct direction.

Validation uses the existing simplified type envelopes. The editor displays speed, altitude and vertical-rate limits for the chosen type. It rejects duplicate callsigns, invalid numbers, unsupported types, and unreachable clearances. Errors leave entered values intact. Cancel never changes an existing aircraft, and cancelling initial placement adds no aircraft to the session.

Saved edits immediately refresh the PPS, shared tag/strip rows, history dots, centre-crossing estimate and affected target-tool geometry. Repeated saves update the same aircraft ID. Existing warning selections and dragged tag offsets remain. If an aircraft becomes incomplete, its strip is removed until it is complete again; its warning selection remains associated with its ID.

## Scenario answers after aircraft changes

Generated conflict pairs and CPA values describe the original aircraft geometry. A saved aircraft addition or change marks that answer **out of date**, hides any revealed result and disables Reveal answer. A visible notice explains why.

**Recalculate answer** explicitly runs the existing conflict predictor on the saved aircraft using the same scenario look-ahead and separation rules. It does not regenerate traffic, overwrite edits, clear warnings, reset the view or change the clock. Every aircraft must be complete first. Free sessions without a generated scenario have no answer to grade.

The original warning workflow remains: all required aircraft marked means a pass, and additional warnings are allowed. If recalculation produces zero conflicts, there are no required warning marks. Normal PTL, RBL and halo geometry follows saved aircraft values. PIV predictions are refreshed after edits; an existing PIV is removed if its forward tracks no longer have a valid future intercept. Tools for incomplete traffic are removed.

## Map-Maker

Only map geometry and map/navigation controls are displayed. Aircraft, tags, strips, scenario briefing, answer panel, warning notice and aircraft tools are hidden while their session state is retained.

| Tool | Click order |
| --- | --- |
| Select | Click an element near its stroke or marker. The element list can select crowded or overlapping features precisely. |
| Line | Start, endpoint. |
| Circle | Centre, radius endpoint. |
| Arc | Centre, start point (sets radius and start bearing), end bearing. The arc sweeps clockwise. |
| Point | Position. |

Choose the layer for new elements before placement. Add a layer with a name beginning with a letter, followed by letters, digits, underscores or hyphens. An empty map can be edited by adding its first layer.

After placement, review the cyan preview and use **Apply element** to commit it. The inspector also edits selected elements. Geometry inputs use NM; bearings use degrees clockwise from north. The supported properties are colour, opacity, line width, line pattern, hash spacing/length, point shape, size, rotation, fill and label, where applicable. The element's layer can be changed. **Delete element** or Delete with the radar focused removes the selection. Cancel/Escape discards unapplied element changes.

The **Map name and dimensions** section edits MAP/SIZE metadata. Changing size changes coverage for future scenarios and Reset view, without changing aircraft coordinates or the original centre reference of an existing scenario. Panning and zooming work throughout selection and placement.

Applied edits are retained when leaving Map-Maker. Unapplied inspector changes prompt before being discarded; choose **Keep changes** to stay and apply them. Exiting never requires downloading a file.

### Save and load

**Save Map** downloads a `.map` file. Apply or cancel outstanding form changes first. The download contains the current applied map, its name and size, layers, layer defaults, geometry, and effective feature styles. The map remains editable after downloading.

**Load Map** opens a local file picker. Parsing completes before replacement. Invalid files show a filename and line-number error without replacing the map. Replacing a map with unsaved changes requires confirmation: **Keep changes** cancels replacement, while **Continue** replaces it. A late file read is ignored after leaving Map-Maker.

The saved DSL is compatible with the normal application. Copy a saved map into `maps/` and update `MAP_FILES` in `main.js` to make it the startup map. Loading through Map-Maker also makes it the current normal-mode map immediately, without a reload.

Serialization preserves supported content rather than exact source formatting. Comments are retained together at the top; STYLE declarations are materialized per feature to preserve style changes within a layer. Layer defaults are also retained. Empty maps and empty layers are valid so deleting the last element still produces a reloadable map. Source filenames and original line numbers remain diagnostic information, not map metadata.

## Existing map DSL

```text
MAP "Example sector"
SIZE 100 100

LAYER routes
STYLE color=#75a9ba opacity=0.6 width=1.2 pattern=dashed
LINE 10 80 50 50
ARC 50 50 20 220 40 pattern=hashed hash-spacing=16 hash-length=6
CIRCLE 50 50 10 pattern=dotted

LAYER fixes
STYLE color=#9ad9e8 opacity=0.85 shape=triangle size=5
POINT 50 50 label="CENTRE" filled=true
```

Coordinates and radii are in NM; origin is the upper-left corner, with X increasing east and Y south. Widths, marker sizes and hash dimensions are screen pixels. Patterns: solid, dashed, dotted, hashed. Point shapes: circle, square, triangle, diamond, cross. Colours accept browser CSS colours. Arc sweeps must be nonzero; use CIRCLE for a full circle.

## Implementation and files

`Session` is the authoritative aircraft/scenario state. Editing existing aircraft mutates the shared object only after validation, so tool references, tags and strips cannot fork into independent aircraft copies. The radar owns one set of navigation handlers and dispatches clicks to the active mode. Switching modes cancels pointer capture and pending tools without calling scenario regeneration or camera reset.

New modules:

- `session.js`: session, mode, aircraft identity and explicit answer recalculation.
- `sandbox.js`: world-anchored measurements and placement previews.
- `aircraft-editor.js`: draft editing and Save/Cancel lifecycle.
- `map-editor.js`: placement, selection, inspector and atomic file load/save.
- `map-document.js`: DSL serialization, placement geometry and camera-aware hit testing.
- `editor-ui.js`, `confirm-dialog.js`: labelled fields, errors and themed confirmations.
- `dev-server.js`: optional dependency-free local server.
- `tests/`: model, geometry, serialization and controller regression tests.

Changed existing files: `aircraft.js`, `assessment.js`, `constants.js`, `index.html`, `main.js`, `map.js`, `package.json`, `pps.css`, `radar.js`, `README.md`, `style.css`, `tools.js`, and `ui.js`.

The supplied `assessment.js` contained test code. It is restored as the intended production assessment module, shared by `ui.js`; the stray assessment copy in `constants.js` is removed. The supplied `scenarios.js`, `camera.js`, `theme.js`, `utils.js`, and both map files otherwise remain unchanged.

## Tests and limits

Run `npm test`, or `node --test tests/*.test.js`. 

Blue, Black and Light use the existing theme tokens; new controls, errors, confirmations and measurements follow them. Aircraft and map edits persist for the current session only, as requested. The existing sampled conflict model, aircraft envelopes, camera zoom bounds and static scenario semantics remain in place. This update does not add physics, live motion or a new scenario catalogue.

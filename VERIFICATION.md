# Sandbox Update — verification

Verified against the supplied project files. All **22 automated tests passed** under Node.js 24. JavaScript module syntax and local asset/import paths were also checked.

## Acceptance coverage

| Requirement | Result and evidence |
| --- | --- |
| Sandbox on a loaded scenario | Browser: entered without changing aircraft IDs or PPS coordinates. |
| Sandbox with no scenario | Controller test: initial placement, cancellation, incomplete save, completion and repeated editing all work with an empty Session. |
| Multiple measurements after pan/zoom | Browser: two rulers (63.60 NM and 31.80 NM) and a 90.0° clockwise angle retained their values after dragging and wheel zoom. Automated tests cover camera inverses, resize and 161 simultaneous measurements. |
| Placement at clicked coordinates | Controller and geometry tests cover coordinate conversion; aircraft position is stored in existing world units. |
| Saved edits update all displays | Browser: callsign and speed edits refreshed the tag and strip; six aircraft and six strips remained. Controller test checks one PPS, one tag and one strip across repeated saves. |
| Strip appears only when complete | Controller test: incomplete traffic has no strip; supplying its missing speed creates one, with no duplicates after subsequent edits. |
| Invalid inputs and cancellation | Browser: invalid speed showed its type limit without discarding the callsign edit. Controller tests cover initial cancel, existing cancel, partial saves, validation errors and protected IDs. |
| Exit retains edits and clears measurements | Browser: measurement count became zero, saved traffic remained and normal tools reappeared. Automated reset and mode tests also pass. |
| Repeated mode switching | Controller test: 20 repeated sandbox/map/normal cycles; one action per click, no placements during drag/cancel, unchanged navigation-listener counts. |
| Existing scenario and answer behavior | Generated easy/medium/hard scenarios remain valid. Warning tests cover missed and complete selections. Browser: marking all strips and revealing produced the existing pass feedback after explicit recalculation. |
| Map-Maker hides traffic and scenario UI | Browser: targets, strip bay and briefing were hidden; map and map tools were visible. Controller test checks layer restoration. |
| Map-Maker preserves session | Model/controller tests cover the same aircraft/scenario references, warning IDs, UTC, reference bounds and camera transform across modes. No timer exists in the supplied static trainer. |
| Add/select/edit/delete DSL elements | Browser: placed line, circle, arc and point; edited geometry and style; deleted the selected point. Controller tests cover all types, layer moves, cancelled placement and direct selection; geometric hit tests cover map selection at several zoom levels. |
| Map editing remains accurate with camera changes | Camera and map-placement/hit-test checks pass at multiple zoom levels and offsets. |
| Save/reload preserves DSL content | Both supplied maps round-trip with identical semantic geometry, effective styles, layer defaults, empty layers, name, size and comments. Controller test intercepts the actual Save Map Blob, parses its bytes and loads those same bytes through MapEditor. |
| Invalid files retain current map | Browser: negative-radius file produced a filename/line error and retained all 51 current features. Automated tests cover additional invalid syntax and atomic loading. |
| Unsaved edits are protected | Controller test: replacement opens the themed confirmation; cancel preserves the exact map object and dirty state, accept replaces it. Late reads after mode exit are ignored. |
| Themes and dialog controls | New controls, confirmations, labels and SVG measurements use existing theme variables. Colour adaptation tests pass; original Blue layout and new Map-Maker layout were visually inspected. |

## Defects found and fixed during verification

- Map-Maker's pointer cleanup could receive a false value instead of an absent tag record. This prevented placement. The record is now explicitly nullable, and repeated click/drag/cancel coverage guards it.
- Creating a layer while editing an element could rebuild the form and lose unapplied values. New layer options are now appended without rebuilding the form; a regression test covers this.
- The supplied assessment file contained misplaced test code. Production warning evaluation now lives in `assessment.js`, with regression tests in `tests/`.
- Confirmations now use themed application dialogs. Completion listeners remove themselves, and controller tests verify their cancellation behavior and cleanup.

## Remaining verification limitations

The browser connection became unresponsive during a native map-replacement confirmation. Recovery attempts did not restore it. Consequently, the final themed confirmation implementation, the empty-session flow, repeated mode cycles, and full Black/Light visual checks were not rerun in that browser; their state and event behavior are covered by automated controller/model tests and theme-token inspection.

The browser download-event capture also timed out. The Save Map code completed without an application error, but receipt of the file by the browser's download manager was not confirmed end to end. The automated controller test verifies the exact emitted Blob and reloads its DSL content successfully.

No known failing implementation test remains. Browser testing was partial, not a complete cross-browser or mobile visual certification. The two supplied maps and the legacy scenario generator remain unchanged; features from other, unattached versions of the project were not reconstructed.

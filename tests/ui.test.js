import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMap, MapRenderer, mapBounds, loadMapFiles } from "../map.js";
import { Camera } from "../camera.js";
import { mapColor } from "../theme.js";
import { installDocument } from "./dom-fixture.js";

test("all map geometry and labels change tone without changing source styles or camera", t => {
  const { document } = installDocument(t);
  const source = `MAP "Theme test"
SIZE 270 250
LAYER sids
STYLE color=#88ccff opacity=0.65 pattern=dotted
LINE 0 10 100 50
LAYER stars
STYLE color=#ff9900 opacity=0.72 pattern=dotted
ARC 100 100 30 20 150
LAYER rings
CIRCLE 100 100 10 color=#ddd pattern=hashed
LAYER fixes
POINT 100 50 color=#88ccff shape=triangle filled=true label=FIX
POINT 80 50 color=#ff9900 shape=cross filled=true`;
  const map = parseMap(source);
  const original = JSON.stringify(map);
  const root = document.createElementNS("", "g");
  const renderer = new MapRenderer(root, map);
  const camera = new Camera(mapBounds(map));
  camera.resize(700, 640);
  renderer.render(camera);
  const geometry = renderer.records.map(record => (record.stroke ?? record.marker).getAttribute("d"));
  const originalCamera = JSON.stringify(camera);
  for (const theme of ["black", "light", "blue"]) {
    renderer.setTheme(theme);
    for (const record of renderer.records) {
      assert.equal(record.group.getAttribute("color"), mapColor(record.feature.style.color, theme));
      assert.equal(record.group.getAttribute("opacity"), String(record.feature.style.opacity));
      if (record.label) assert.equal(record.label.getAttribute("fill"), "currentColor");
      if (record.hashes) assert.equal(record.hashes.getAttribute("stroke"), "currentColor");
    }
    assert.deepEqual(renderer.records.map(record => (record.stroke ?? record.marker).getAttribute("d")), geometry);
    assert.equal(JSON.stringify(map), original);
    assert.equal(JSON.stringify(camera), originalCamera);
  }
  assert.equal(renderer.records[3].marker.getAttribute("fill"), "currentColor");
  assert.equal(renderer.records[4].marker.getAttribute("fill"), "none");
});

test("the supplied map text parses as North Channel and can be loaded normally", async () => {
  const source = readFileSync(new URL("../maps/north-channel.map", import.meta.url), "utf8");
  const map = await loadMapFiles(["fixture.map"], async () => ({ ok: true, text: async () => source }));
  assert.equal(map.name, "North Channel");
  assert.ok(map.layers.length > 0);
  assert.ok(map.layers.some(layer => layer.features.some(feature => feature.kind === "point")));
});

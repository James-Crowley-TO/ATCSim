import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
    MapRenderer,
    MapSyntaxError,
    loadMapFiles,
    mapBounds,
    mergeMaps,
    parseMap,
} from "../map.js";

const SIMPLE_MAP = `
MAP "Test Sector"
SIZE 20 10
LAYER routes
STYLE color=#123456 opacity=0.4 width=2 pattern=dashed
LINE 1 2 8 2
ARC 10 5 3 270 90 pattern=hashed hash-spacing=10 hash-length=4
CIRCLE 10 5 2 pattern=dotted
LAYER fixes
STYLE color=cyan shape=triangle size=5
POINT 10 5 label="CENTRE FIX" filled=true rotation=30
`;

test("parser applies layer defaults and per-feature overrides", () => {
    const map = parseMap(SIMPLE_MAP, "test.map");
    assert.equal(map.name, "Test Sector");
    assert.deepEqual(mapBounds(map), { width: 200, height: 100 });
    assert.deepEqual(map.layers.map(layer => layer.name), ["routes", "fixes"]);

    const [line, arc, circle] = map.layers[0].features;
    assert.equal(line.kind, "line");
    assert.equal(line.style.color, "#123456");
    assert.equal(line.style.pattern, "dashed");
    assert.equal(arc.style.pattern, "hashed");
    assert.equal(arc.style.hashSpacing, 10);
    assert.equal(circle.style.pattern, "dotted");

    const [point] = map.layers[1].features;
    assert.equal(point.style.label, "CENTRE FIX");
    assert.equal(point.style.shape, "triangle");
    assert.equal(point.style.filled, true);
    assert.equal(point.style.rotation, 30);
});

test("parser reports the source line for invalid DSL", () => {
    assert.throws(
        () => parseMap("MAP Bad\nSIZE 10 10\nPOINT 2 2 opacity=1.5", "bad.map"),
        error => error instanceof MapSyntaxError &&
            error.message === "bad.map:3: opacity must be between 0 and 1"
    );
    assert.throws(
        () => parseMap("MAP Bad\nSIZE 10 10\nARC 5 5 2 0 360", "bad.map"),
        /bad\.map:3: ARC bearings must describe a non-zero clockwise sweep/
    );
});

test("maps and overlays merge layers without changing their order", () => {
    const base = parseMap("MAP Base\nSIZE 10 10\nLAYER common\nLINE 0 0 1 1", "base.map");
    const overlay = parseMap(
        "MAP Overlay\nSIZE 10 10\nLAYER common\nPOINT 2 2\nLAYER weather\nCIRCLE 5 5 2",
        "overlay.map"
    );
    const merged = mergeMaps([base, overlay]);
    assert.equal(merged.name, "Base");
    assert.deepEqual(merged.layers.map(layer => layer.name), ["common", "weather"]);
    assert.deepEqual(merged.layers.map(layer => layer.features.length), [2, 1]);
    assert.deepEqual(merged.sources, ["base.map", "overlay.map"]);
});

test("map files load through an injected fetch implementation", async () => {
    const files = new Map([
        ["base.map", "MAP Base\nSIZE 10 10\nLINE 0 0 10 10"],
        ["overlay.map", "MAP Overlay\nSIZE 10 10\nPOINT 5 5"],
    ]);
    const fakeFetch = async url => ({
        ok: files.has(url),
        status: files.has(url) ? 200 : 404,
        text: async () => files.get(url),
    });
    const map = await loadMapFiles(["base.map", "overlay.map"], fakeFetch);
    assert.equal(map.layers[0].features.length, 2);
});

class FakeSvgElement {
    constructor(tag) {
        this.tag = tag;
        this.attributes = {};
        this.children = [];
        this.textContent = "";
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    append(...children) {
        this.children.push(...children);
    }
}

test("renderer emits paths, hash marks, point shapes and labels", () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElementNS: (_namespace, tag) => new FakeSvgElement(tag),
    };

    try {
        const root = new FakeSvgElement("g");
        const renderer = new MapRenderer(root, parseMap(SIMPLE_MAP));
        renderer.render({ zoom: 1, toScreen: point => point });

        const line = renderer.records.find(record => record.feature.kind === "line");
        assert.equal(line.stroke.attributes.d, "M 10 20 L 80 20");
        assert.equal(line.stroke.attributes["stroke-dasharray"], "8 6");

        const arc = renderer.records.find(record => record.feature.kind === "arc");
        assert.match(arc.stroke.attributes.d, /^M /);
        assert.match(arc.hashes.attributes.d, / L /);

        const point = renderer.records.find(record => record.feature.kind === "point");
        assert.match(point.marker.attributes.d, /^M /);
        assert.equal(point.marker.attributes.transform, "rotate(30 100 50)");
        assert.equal(point.label.textContent, "CENTRE FIX");
        assert.equal(point.label.attributes.x, "110");
    } finally {
        globalThis.document = originalDocument;
    }
});

test("the included North Channel map uses every primitive and line pattern", async () => {
    const source = await fs.readFile(new URL("../maps/north-channel.map", import.meta.url), "utf8");
    const map = parseMap(source, "north-channel.map");
    const features = map.layers.flatMap(layer => layer.features);
    assert.equal(features.length, 47);
    assert.deepEqual(new Set(features.map(feature => feature.kind)), new Set(["line", "arc", "circle", "point"]));
    assert.deepEqual(
        new Set(features.filter(feature => feature.kind !== "point").map(feature => feature.style.pattern)),
        new Set(["solid", "dashed", "dotted", "hashed"])
    );
    assert.deepEqual(
        new Set(features.filter(feature => feature.kind === "point").map(feature => feature.style.shape)),
        new Set(["circle", "square", "triangle", "diamond", "cross"])
    );
});
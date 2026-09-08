import test from 'node:test';
import assert from 'node:assert/strict';
import { RadarTools } from '../tools.js';
import { Camera } from '../camera.js';

// Minimal SVG sink: tests controller state and emitted geometry without a
// browser or layout engine. This intentionally does not claim visual coverage.
class SvgSink {
  constructor(name) { this.name = name; this.attributes = {}; this.children = []; this.events = {}; this.textContent = ''; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(type, callback) { this.events[type] = callback; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
const a = { id: 'a', callsign: 'AAA1', x: 0, y: 0, heading: 90, speedKts: 360 };
const b = { id: 'b', callsign: 'BBB2', x: 300, y: -300, heading: 180, speedKts: 180 };

function withTools(run) {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, name) => new SvgSink(name) };
  try {
    const layer = new SvgSink('g');
    const messages = [];
    const tools = new RadarTools(layer, () => { }, message => messages.push(message));
    tools.reset({ startUtcSeconds: 86280 });
    run(tools, layer, messages);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('PIV creates two vectors and a connector at one UTC CPA; zoom changes geometry only', () => withTools((tools, layer) => {
  tools.select('piv'); tools.handleTarget(a); tools.handleTarget(b);
  assert.equal(tools.records.length, 1);
  const p = tools.records[0];
  const camera = new Camera({ width: 760, height: 760 });
  tools.render(camera);
  assert.equal(p.timeLabel.textContent, 'CPA 00:04:00Z (+1d)');
  assert.equal(p.labelA.textContent, '36.0 NM'); assert.equal(p.labelB.textContent, '18.0 NM');
  assert.equal(p.separationLabel.textContent, 'SEP 13.4 NM');
  const oldX = Number(p.lineA.attributes.x2);
  camera.zoomAt({ x: 0, y: 0 }, 2);
  tools.render(camera);
  assert.ok(Math.abs(Number(p.lineA.attributes.x2) - oldX * 2) < 1e-8);
  assert.equal(p.timeLabel.textContent, 'CPA 00:04:00Z (+1d)');
  assert.ok(!JSON.stringify(layer.attributes).includes('scale'));
  tools.handleTarget(b); tools.handleTarget(a); // reversed duplicate
  assert.equal(tools.records.length, 1);
  p.group.events.click({ stopPropagation() { } });
  assert.equal(tools.records.length, 0); assert.equal(layer.children.length, 0);
}));

test('non-intercept produces feedback without adding vectors; selection resets correctly', () => withTools((tools, layer, messages) => {
  tools.select('piv'); tools.handleTarget(a);
  tools.handleTarget({ ...b, heading: 90 });
  assert.equal(layer.children.length, 0); assert.equal(tools.pending, null);
  assert.match(messages.at(-1), /no future intercept/);
  tools.handleTarget(a); tools.handleTarget(a);
  assert.equal(tools.pending, null);
  tools.handleTarget(a); tools.select('rbl');
  assert.equal(tools.pending, null);
  tools.handleTarget(a); tools.clear('rbl');
  assert.equal(tools.pending, null);
}));

test('PTL/halo wheel priority, per-aircraft clearing, and scenario reset remain intact', () => withTools((tools, layer) => {
  tools.select('ptl'); tools.handleTarget(a);
  assert.equal(tools.handleScroll(a, -100), true);
  assert.equal(tools.records[0].minutes, 4);
  tools.select('halo'); tools.handleTarget(a);
  tools.handleScroll(a, -100);
  assert.equal(tools.records[1].radiusNm, 6);
  tools.select('piv'); tools.handleTarget(a); tools.handleTarget(b);
  assert.equal(tools.handleScroll(a, -100), false); // both adjustable, neither selected
  tools.clearForAircraft(b);
  assert.equal(tools.records.length, 2);
  tools.select('rbl'); tools.handleTarget(a);
  tools.reset({ startUtcSeconds: 12300 });
  assert.equal(layer.children.length, 0); assert.equal(tools.pending, null);
  assert.equal(tools.selectedTool, null); assert.equal(tools.startUtcSeconds, 12300);
}));

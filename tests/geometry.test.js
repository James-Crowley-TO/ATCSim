import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../camera.js';
import { aircraftTagRows, createAircraft } from '../aircraft.js';
import { altitudeFeetAt, projectedIntercept, utcTime, centreCrossingMinutes, distanceNm, projectPoint } from '../utils.js';
import { generateScenario, predictConflict } from '../scenarios.js';
import { AIRCRAFT_TYPES } from '../constants.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const plane = (x, y, heading, speedKts = 360) => ({ x, y, heading, speedKts });

test('PIV uses simultaneous CPA, not either crossing time', () => {
  const a = plane(0, 0, 90), b = plane(300, -300, 180, 180);
  const p = projectedIntercept(a, b);
  close(p.timeMinutes, 6); // Geometric intersection is reached at 5 and 10 min.
  close(p.endA.x, 360); close(p.endB.y, -120);
  close(p.distanceANm, 36); close(p.distanceBNm, 18);
  close(p.separationNm, Math.sqrt(180));
  for (const t of [5.99, 6.01]) {
    assert.ok(distanceNm(projectPoint(a.x, a.y, a.heading, a.speedKts, t), projectPoint(b.x, b.y, b.heading, b.speedKts, t)) > p.separationNm);
  }
  const swapped = projectedIntercept(b, a);
  close(swapped.timeMinutes, p.timeMinutes); close(swapped.distanceANm, p.distanceBNm);
});

test('PIV supports exact crossing, head-on and same-track overtaking', () => {
  const crossing = projectedIntercept(plane(0, 300, 90), plane(300, 0, 180));
  close(crossing.timeMinutes, 5); close(crossing.separationNm, 0);
  close(projectedIntercept(plane(0, 0, 90), plane(600, 0, 270)).timeMinutes, 5);
  close(projectedIntercept(plane(0, 0, 90, 360), plane(300, 0, 90, 180)).timeMinutes, 10);
});

test('PIV rejects diverging, parallel, stationary-relative and rearward intersections', () => {
  assert.equal(projectedIntercept(plane(0, 0, 270), plane(600, 0, 90)), null);
  assert.equal(projectedIntercept(plane(0, 0, 90), plane(300, 100, 90, 180)), null);
  assert.equal(projectedIntercept(plane(0, 0, 90), plane(300, 0, 90)), null);
  assert.equal(projectedIntercept(plane(0, 0, 90), plane(-100, -300, 180)), null);
  assert.equal(projectedIntercept(plane(0, 0, 90), plane(0, 0, 180)), null);
});

test('UTC estimates wrap midnight in both directions and include seconds', () => {
  assert.deepEqual(utcTime(86340, 2), { text: '00:01:00', dayOffset: 1, label: '00:01:00Z (+1d)' });
  assert.equal(utcTime(60, -2).label, '23:59:00Z (−1d)');
  assert.equal(utcTime(36000, 5.5).label, '10:05:30Z');
  assert.equal(utcTime(0, -15.3).label, '23:44:42Z (−1d)');
});

test('clearance is above callsign and caps the future altitude', () => {
  const a = createAircraft({ width: 760, height: 760 }, 56, { callsign: 'CFC2841', aircraftType: 'A343', flightLevel: 410, verticalRateFpm: -1000, clearedFlightLevel: 360, speedKts: 460 });
  assert.deepEqual(aircraftTagRows(a).map(row => row.text), ['360', 'CFC2841', '410 ↓10 46', 'A343']);
  close(altitudeFeetAt(a, 2), 39000); close(altitudeFeetAt(a, 5), 36000); close(altitudeFeetAt(a, 20), 36000);
  const climbing = { ...a, flightLevel: 330, verticalRateFpm: 1000, clearedFlightLevel: 350 };
  close(altitudeFeetAt(climbing, 10), 35000);
  const higher = { ...climbing, flightLevel: 370, verticalRateFpm: 0, clearedFlightLevel: 370 };
  assert.equal(predictConflict(climbing, higher, 8).willConflict, false);
  assert.throws(() => createAircraft({ width: 760, height: 760 }, 56, { aircraftType: 'A343', flightLevel: 410, verticalRateFpm: -1000, clearedFlightLevel: 420 }));
});

test('camera preserves cursor world position, inverse coordinates, and resize coverage', () => {
  const camera = new Camera({ width: 760, height: 760 });
  camera.resize(600, 600);
  camera.x += 80; camera.y -= 50;
  const cursor = { x: 225, y: 175 };
  const before = camera.toWorld(cursor);
  camera.zoomAt(cursor, 1.8);
  close(camera.toWorld(cursor).x, before.x); close(camera.toWorld(cursor).y, before.y);
  const p = { x: -250, y: 1234 }, roundtrip = camera.toWorld(camera.toScreen(p));
  close(roundtrip.x, p.x); close(roundtrip.y, p.y);
  const centre = camera.toWorld({ x: 300, y: 300 });
  camera.resize(400, 400);
  close(camera.toWorld({ x: 200, y: 200 }).x, centre.x);
  close(camera.toWorld({ x: 200, y: 200 }).y, centre.y);
  camera.reset();
  close(camera.toScreen({ x: 380, y: 380 }).x, 200);
  close(centreCrossingMinutes(plane(0, 380, 90), { x: 380, y: 380 }), 380 / 60);
});

test('generated scenarios preserve conflicts, valid clearances, clock and mostly visible traffic', () => {
  let changing = 0;
  for (const difficulty of ['easy', 'medium', 'hard']) for (let i = 0; i < 40; i++) {
    const s = generateScenario(difficulty, { width: 760, height: 760 });
    assert.equal(s.conflicts.length, { easy: 1, medium: 2, hard: 3 }[difficulty]);
    assert.equal(new Set(s.aircraft.map(a => a.callsign)).size, s.aircraft.length);
    assert.ok(s.startUtcSeconds >= 0 && s.startUtcSeconds < 86400);
    assert.ok(s.aircraft.filter(a => a.x < 0 || a.y < 0 || a.x > 760 || a.y > 760).length <= 1);
    for (const a of s.aircraft) {
      assert.ok(a.clearedFlightLevel >= 180 && a.clearedFlightLevel <= AIRCRAFT_TYPES[a.aircraftType].maxFlightLevel);
      if (a.verticalRateFpm) {
        changing++;
        assert.ok((a.clearedFlightLevel - a.flightLevel) * a.verticalRateFpm > 0);
        close(altitudeFeetAt(a, 60), a.clearedFlightLevel * 100);
      } else assert.equal(a.clearedFlightLevel, a.flightLevel);
    }
  }
  assert.ok(changing > 0);
});

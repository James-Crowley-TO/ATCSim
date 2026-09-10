import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAircraft, createAircraftDraft, isAircraftComplete, validateAircraftInput, aircraftTagRows } from '../aircraft.js';
import { Camera } from '../camera.js';
import { Session } from '../session.js';
import { SandboxTools, clockwiseAngle } from '../sandbox.js';
import { DEFAULT_STYLE, parseMap, mergeMaps, mapBounds } from '../map.js';
import { serializeMap, hitTestMap, placementFeature } from '../map-document.js';
import { generateScenario, findPredictedConflicts } from '../scenarios.js';
import { evaluateWarnings } from '../assessment.js';
import { distanceNm, nmToPx, pxToNm, projectPoint, mapColor } from '../utils.js';

const bounds = { width: 2700, height: 2500 };
const completeInput = { callsign:'TEST123', aircraftType:'A320', x:'25', y:'35', heading:'90', speedKts:'400', flightLevel:'300', verticalRateFpm:'0', clearedFlightLevel:'300' };
const make = () => validateAircraftInput(completeInput, createAircraftDraft({x:250,y:350})).aircraft;
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const semantic = map => ({name:map.name,widthNm:map.widthNm,heightNm:map.heightNm,comments:map.comments,
  layers:map.layers.map(layer=>({name:layer.name,defaults:layer.defaults,features:layer.features.map(({sourceLine,...feature})=>feature)}))});

test('aircraft validation supports complete and partial traffic without invented data', () => {
  const draft=createAircraftDraft({x:250,y:350});
  const complete=validateAircraftInput(completeInput,draft);
  assert.equal(complete.valid,true); assert.equal(isAircraftComplete(complete.aircraft),true);
  assert.equal(complete.aircraft.id,draft.id); near(complete.aircraft.x,250); near(complete.aircraft.y,350);
  const partial=validateAircraftInput({...completeInput,callsign:'',speedKts:''},draft);
  assert.equal(partial.valid,true); assert.equal(isAircraftComplete(partial.aircraft),false);
  assert.ok(aircraftTagRows(partial.aircraft).some(row=>row.text==='INCOMPLETE'));
  assert.equal(draft.callsign,'');
});

test('validation preserves input, protects IDs, and rejects duplicate callsigns and nonfinite values', () => {
  const aircraft=make(); const before={...aircraft};
  const values={...completeInput,id:'tampered',speedKts:'Infinity',heading:'361',x:'bad'};
  const result=validateAircraftInput(values,aircraft);
  assert.equal(result.valid,false);
  assert.ok(result.errors.speedKts && result.errors.heading && result.errors.x);
  assert.deepEqual(aircraft,before); assert.equal(values.speedKts,'Infinity'); assert.equal(result.aircraft.id,aircraft.id);
  const another={...aircraft,id:'another'};
  assert.ok(validateAircraftInput(completeInput,aircraft,[another]).errors.callsign);
  assert.equal(validateAircraftInput(completeInput,aircraft,[aircraft]).valid,true);
});

test('aircraft envelope and reachable clearances are enforced', () => {
  const original=make();
  for (const change of [{speedKts:'200'}, {flightLevel:'500'}, {verticalRateFpm:'3000'}, {flightLevel:'300.5'}])
    assert.equal(validateAircraftInput({...completeInput,...change},original).valid,false);
  assert.equal(validateAircraftInput({...completeInput,verticalRateFpm:'1000',clearedFlightLevel:'280'},original).valid,false);
  assert.equal(validateAircraftInput({...completeInput,verticalRateFpm:'-1000',clearedFlightLevel:'320'},original).valid,false);
  const climb=validateAircraftInput({...completeInput,verticalRateFpm:'1000',clearedFlightLevel:'320'},original);
  assert.equal(climb.valid,true); assert.equal(aircraftTagRows(climb.aircraft)[0].text,'320');
  const level=validateAircraftInput({...completeInput,heading:'360',clearedFlightLevel:'garbage'},original);
  assert.equal(level.aircraft.heading,0); assert.equal(level.aircraft.clearedFlightLevel,300);
});

test('one authoritative aircraft object survives edits and mode switches, with no duplicate strips', () => {
  const session=new Session(bounds); const aircraft=make();
  session.saveAircraft(aircraft);
  for(let i=0;i<30;i++) {
    session.setMode('sandbox'); session.saveAircraft({...aircraft,heading:i}); session.setMode('mapmaker'); session.setMode('normal');
  }
  assert.equal(session.aircraft.length,1); assert.equal(session.aircraft[0],aircraft);
  assert.equal(session.stripContext.aircraft,session.aircraft);
  assert.equal(session.aircraft.filter(isAircraftComplete).length,1);
  const partial=validateAircraftInput({...completeInput,speedKts:''},aircraft).aircraft;
  session.saveAircraft(partial); assert.equal(session.aircraft.filter(isAircraftComplete).length,0);
  session.saveAircraft(validateAircraftInput(completeInput,aircraft).aircraft);
  assert.equal(session.aircraft.filter(isAircraftComplete).length,1);
});

test('mode changes preserve warnings, scenario, reference bounds, UTC and aircraft', () => {
  const session=new Session(bounds); const scenario=generateScenario('easy',bounds);
  session.replaceScenario(scenario,bounds); session.warningIds.add(scenario.aircraft[0].id);
  const originalTime=session.startUtcSeconds, aircraft=session.aircraft, original=JSON.stringify(scenario);
  for(const mode of ['sandbox','mapmaker','sandbox','normal','mapmaker','normal']) session.setMode(mode);
  assert.equal(session.scenario,scenario); assert.equal(session.aircraft,aircraft);
  assert.equal(JSON.stringify(scenario),original); assert.equal(session.warningIds.size,1);
  assert.equal(session.startUtcSeconds,originalTime); assert.deepEqual(session.referenceBounds,bounds);
});

test('saved edits invalidate predictions; explicit recalculation preserves traffic and warning selection', () => {
  const session=new Session(bounds); session.replaceScenario(generateScenario('easy',bounds),bounds);
  const aircraft=session.aircraft[0], oldConflicts=session.scenario.conflicts;
  session.saveAircraft({...aircraft,heading:(aircraft.heading+30)%360});
  session.warningIds.add(aircraft.id);
  assert.equal(session.answerStale,true); assert.equal(session.scenario.conflicts,oldConflicts);
  assert.equal(session.recalculateAnswer(),true); assert.equal(session.answerStale,false);
  assert.deepEqual(session.scenario.conflicts,findPredictedConflicts(session.aircraft,session.scenario.lookaheadMinutes));
  assert.equal(session.warningIds.has(aircraft.id),true);
  session.saveAircraft(createAircraftDraft({x:200,y:200}));
  assert.throws(()=>session.recalculateAnswer(),/Complete every aircraft/);
});

test('coordinates and measurements remain accurate under pan, zoom and viewport resize', () => {
  const camera=new Camera(bounds); camera.resize(850,700);
  const a={x:300,y:400}, b={x:600,y:800};
  near(distanceNm(a,b),50);
  for (const factor of [1.3,0.7,1.8]) {
    camera.x+=37; camera.y-=25; camera.zoomAt({x:250,y:220},factor);
    near(camera.toWorld(camera.toScreen(a)).x,a.x); near(camera.toWorld(camera.toScreen(b)).y,b.y);
    near(distanceNm(camera.toScreen(a),camera.toScreen(b))/camera.zoom,50);
  }
  const centre=camera.toWorld({x:camera.width/2,y:camera.height/2});
  camera.resize(500,700); near(camera.toWorld({x:250,y:350}).x,centre.x);
});

test('unlimited coexisting ruler and clockwise protractor measurements cancel and clear cleanly', () => {
  const sandbox=new SandboxTools({replaceChildren(){}},{onChange(){},onStatus(){},onPlace(){}});
  sandbox.select('ruler');
  for(let i=0;i<160;i++) { sandbox.click({x:i,y:0}); sandbox.click({x:i+300,y:400}); }
  sandbox.select('angle'); sandbox.click({x:0,y:0}); sandbox.click({x:0,y:-100}); sandbox.click({x:100,y:0});
  assert.equal(sandbox.measurements.length,161); near(clockwiseAngle(sandbox.measurements.at(-1).points),90);
  near(clockwiseAngle([{x:0,y:0},{x:100,y:0},{x:0,y:-100}]),270);
  sandbox.click({x:0,y:0}); sandbox.move({x:20,y:30}); sandbox.cancel();
  assert.equal(sandbox.points.length,0); assert.equal(sandbox.hover,null); assert.equal(sandbox.measurements.length,161);
  sandbox.reset(); assert.equal(sandbox.measurements.length,0); assert.equal(sandbox.selectedTool,null);
});

for (const name of ['new-martin-high','north-channel']) test(`${name} map round-trips without loss of effective styles, layers, geometry or metadata`,async()=>{
  const source=await readFile(new URL(`../maps/${name}.map`,import.meta.url),'utf8');
  const map=parseMap(source,`${name}.map`); const serialized=serializeMap(map); const loaded=parseMap(serialized);
  assert.deepEqual(semantic(loaded),semantic(map)); assert.deepEqual(mapBounds(loaded),mapBounds(map));
});

test('DSL serializer preserves quoted strings, defaults changes, empty layers and empty maps', () => {
  const source='MAP "Names with \\"quotes\\" and \\\\ paths"\nSIZE 90 80\nLAYER empty\nSTYLE color="rgb(10, 20, 30)"\nLAYER shapes\nSTYLE opacity=0.3\nPOINT 10 20 label="A \\"B\\"" shape=diamond filled=true rotation=45\nSTYLE opacity=0.8\nARC 30 40 10 350 20 pattern=hashed hash-spacing=19 hash-length=8\nLINE 1 2 3 4\nCIRCLE 3 5 20';
  const map=parseMap(source); assert.deepEqual(semantic(parseMap(serializeMap(map))),semantic(map));
  map.layers.forEach(layer=>layer.features=[]);
  assert.deepEqual(semantic(parseMap(serializeMap(map))),semantic(map));
  const empty=parseMap('MAP "Empty"\nSIZE 100 100'); assert.equal(parseMap(serializeMap(empty)).layers.length,0);
});

test('invalid DSL fails with useful source and line errors and does not mutate existing map', () => {
  const map=parseMap('MAP "Original"\nSIZE 90 90\nPOINT 1 2'); const before=serializeMap(map);
  for(const source of ['SIZE 10 10\nPOINT 1 2','MAP "x"\nSIZE -1 20','MAP "x"\nSIZE 1 1\nCIRCLE 0 0 0',
    'MAP "x"\nSIZE 1 1\nARC 0 0 1 0 360','MAP "x"\nSIZE 1 1\nLINE 1 2 3 4 opacity=2',
    'MAP "x"\nSIZE 1 1\nPOINT 1 2 shape=bad','MAP "x"\nSIZE 1 1\nPOINT 1 2 width=NaN']) {
    assert.throws(()=>parseMap(source,'bad.map'),/bad\.map:\d+:/);
    assert.equal(serializeMap(map),before);
  }
});

test('map placement and hit testing use map coordinates at every zoom', () => {
  const points=[{x:20,y:30},{x:20,y:20},{x:30,y:30}];
  const arc=placementFeature('arc',points); near(arc.radius,10); near(arc.startBearing,0); near(arc.endBearing,90);
  const camera=new Camera(bounds); camera.resize(850,700);
  const map=parseMap('MAP "Hit tests"\nSIZE 270 250\nLINE 10 10 20 10\nARC 50 50 10 350 90\nCIRCLE 90 90 10\nPOINT 120 120 shape=triangle');
  for(const zoom of [0.2,0.55,1]) {
    camera.zoom=zoom; camera.x=50; camera.y=-20;
    for(const [x,y,kind] of [[15,10,'line'],[60,50,'arc'],[100,90,'circle'],[120,120,'point']]) {
      const world=camera.toWorld(camera.toScreen({x:nmToPx(x),y:nmToPx(y)}));
      assert.equal(hitTestMap(map,world,camera)?.feature.kind,kind);
    }
    assert.equal(hitTestMap(map,{x:nmToPx(40),y:nmToPx(50)},camera),null);
  }
});

test('overlay merging preserves layer order, effective styles and base map dimensions', () => {
  const a=parseMap('MAP "A"\nSIZE 10 10\nLAYER same\nSTYLE color=red\nPOINT 1 2');
  const b=parseMap('MAP "B"\nSIZE 10 10\nLAYER same\nSTYLE color=blue\nPOINT 3 4');
  const merged=mergeMaps([a,b]);
  assert.equal(merged.layers.length,1); assert.equal(merged.layers[0].features.length,2);
  assert.equal(merged.layers[0].features[0].style.color,'red'); assert.equal(merged.layers[0].defaults.color,'blue');
  assert.deepEqual(semantic(parseMap(serializeMap(merged))),semantic(merged));
});

test('normal scenarios, warning assessment and theme adaptation remain intact',()=>{
  for(const difficulty of ['easy','medium','hard']) {
    const scenario=generateScenario(difficulty,bounds);
    assert.ok(scenario.aircraft.every(isAircraftComplete)); assert.ok(scenario.conflicts.length>0);
    assert.equal(evaluateWarnings(scenario,new Set()).passed,false);
    const warnings=new Set(scenario.aircraft.map(a=>a.id)); assert.equal(evaluateWarnings(scenario,warnings).passed,true);
  }
  assert.equal(mapColor('#42c8e9','blue'),'#42c8e9');
  assert.notEqual(mapColor('#42c8e9','black'),mapColor('#42c8e9','light'));
});

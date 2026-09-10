import test from 'node:test';
import assert from 'node:assert/strict';
import { installDocument, Node } from './dom-fixture.js';
import { Session } from '../session.js';
import { RadarView } from '../radar.js';
import { AircraftEditor } from '../aircraft-editor.js';
import { MapEditor } from '../map-editor.js';
import { renderFlightStrips, toggleSolution, hideSolution } from '../ui.js';
import { createAircraftDraft, validateAircraftInput, isAircraftComplete } from '../aircraft.js';
import { parseMap } from '../map.js';
import { serializeMap } from '../map-document.js';

const bounds={width:1000,height:1000};
const input={callsign:'TST123',aircraftType:'A320',x:30,y:40,heading:90,speedKts:400,flightLevel:300,verticalRateFpm:0,clearedFlightLevel:300};
const make=()=>validateAircraftInput(input,createAircraftDraft({x:300,y:400})).aircraft;
const originalMap=()=>parseMap('MAP "Original"\nSIZE 100 100\nLAYER routes\nLINE 10 10 20 20 pattern=hashed\nPOINT 20 20');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('radar click, pan, cancellation and mode switching dispatch once with no listener accumulation',t=>{
  installDocument(t); const svg=new Node('svg'); const radar=new RadarView(svg,bounds,{map:originalMap()});
  let clicks=0, edits=0; const actions={onClick(){clicks++;},onMove(){},onEdit(){edits++;},onCancel(){},render(){}};
  const fire=(type,x,y)=>svg.fire(type,{button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y});
  const counts=()=>[...svg.listeners].map(([name,list])=>[name,list.length]); const initial=counts();
  for(let i=0;i<20;i++){
    radar.setMode('sandbox',actions); radar.setMode('mapmaker',actions);
    fire('pointerdown',100,100);fire('pointerup',100,100);
    fire('pointerdown',100,100);fire('pointermove',150,130);fire('pointerup',150,130);
    fire('pointerdown',100,100);fire('pointercancel',100,100);
    radar.setMode('normal');
  }
  assert.equal(clicks,20);assert.equal(radar.drag,null);assert.deepEqual(counts(),initial);
  const aircraft=make();radar.setScenario({aircraft:[aircraft],startUtcSeconds:40000});
  const oldView={x:radar.camera.x,y:radar.camera.y,zoom:radar.camera.zoom};
  radar.setMode('sandbox',actions);
  radar.records.get(aircraft.id).target.fire('contextmenu'); assert.equal(edits,1);
  radar.setMode('mapmaker',actions); assert.equal(radar.layers.targets.style.display,'none');
  radar.setMode('normal'); assert.equal(radar.layers.targets.style.display,'');
  assert.deepEqual({x:radar.camera.x,y:radar.camera.y,zoom:radar.camera.zoom},oldView);
});

test('initial aircraft cancel leaves no aircraft; invalid save retains values; repeated saves update one PPS, tag and strip',t=>{
  installDocument(t); const session=new Session(bounds),radar=new RadarView(new Node('svg'),bounds,{map:originalMap()});
  let preview=null;
  const editor=new AircraftEditor(session,{onPreview(value){preview=value;},onSave(aircraft){radar.syncAircraft(aircraft);renderFlightStrips(session.stripContext,bounds,session.warningIds);}});
  editor.open({x:300,y:400},true);assert.ok(preview);editor.cancel();
  assert.equal(session.aircraft.length,0);assert.equal(preview,null);
  editor.open({x:300,y:400},true);
  for(const [key,value] of Object.entries(input))editor.controls[key].value=String(value);
  editor.controls.speedKts.value='999';editor.save();
  assert.equal(editor.dialog.open,true);assert.equal(session.aircraft.length,0);assert.equal(editor.controls.speedKts.value,'999');
  editor.controls.speedKts.value='';editor.save();
  assert.equal(session.aircraft.length,1);assert.equal(isAircraftComplete(session.aircraft[0]),false);
  assert.equal(document.getElementById('flight-strips').children.length,0);assert.equal(radar.records.size,1);
  const aircraft=session.aircraft[0];editor.open(aircraft);editor.controls.speedKts.value='400';editor.save();
  assert.equal(document.getElementById('flight-strips').children.length,1);
  for(let i=0;i<5;i++){editor.open(aircraft);editor.controls.callsign.value=`EDIT${i}`;editor.save();}
  assert.equal(session.aircraft.length,1);assert.equal(radar.records.size,1);
  assert.equal(radar.layers.targets.children.length,1);assert.equal(radar.layers.tags.children.length,1);
  assert.match(radar.layers.tags.textContent,/EDIT4/);assert.match(document.getElementById('flight-strips').textContent,/EDIT4/);
  editor.open(aircraft);editor.controls.heading.value='180';editor.cancel();assert.equal(aircraft.heading,90);
});

test('normal strip warnings and answer reveal retain their pass/missing behavior after re-render',t=>{
  installDocument(t);const a=make(),b={...make(),id:'b',callsign:'TST456'};
  const scenario={aircraft:[a,b],startUtcSeconds:86300,conflicts:[{aircraftA:a,aircraftB:b,firstLossMinutes:2,cpaHorizontalNm:0,cpaVerticalFt:0,cpaMinutes:3}]};
  const warnings=new Set();renderFlightStrips(scenario,bounds,warnings);hideSolution();
  document.getElementById('flight-strips').children[0].click();
  assert.equal(toggleSolution(scenario,warnings).passed,false);hideSolution();
  document.getElementById('flight-strips').children[1].click();assert.equal(toggleSolution(scenario,warnings).passed,true);
  renderFlightStrips(scenario,bounds,warnings);assert.equal(warnings.size,2);
  assert.ok(document.getElementById('flight-strips').children.every(strip=>strip.getAttribute('aria-pressed')==='true'));
});

function mapEditor(t){
  installDocument(t);const map=originalMap();const radar=new RadarView(new Node('svg'),bounds,{map});radar.setMode('mapmaker');
  return new MapEditor(radar,map,{onChange(){},onStatus(){}});
}

test('map controller adds, edits, moves between layers, cancels and deletes each supported geometry',async t=>{
  const editor=mapEditor(t);editor.enter();
  const placements={point:[{x:500,y:500}],line:[{x:500,y:500},{x:600,y:500}],circle:[{x:500,y:500},{x:600,y:500}],arc:[{x:500,y:500},{x:500,y:400},{x:600,y:500}]};
  for(const [kind,points] of Object.entries(placements)){
    await editor.selectTool(kind);for(const point of points)await editor.click(point);
    assert.equal(editor.draft.feature.kind,kind);assert.equal(editor.map.layers[0].features.length,2);
    editor.controls.opacity.value='2';assert.equal(editor.applyElement(),false);assert.equal(editor.controls.opacity.value,'2');
    editor.controls.opacity.value='0.7';assert.equal(editor.applyElement(),true);assert.equal(editor.map.layers[0].features.length,3);
    editor.controls.color.value='#f0aacc';assert.equal(editor.applyElement(),true);assert.equal(editor.map.layers[0].features.length,3);
    editor.deleteSelected();assert.equal(editor.map.layers[0].features.length,2);
  }
  await editor.selectTool('line');await editor.click({x:500,y:500});editor.cancel();assert.equal(editor.points.length,0);
  document.getElementById('new-map-layer').value='approaches';editor.addLayer();assert.equal(editor.map.layers.length,2);
  editor.selectFeature({layer:editor.map.layers[0],feature:editor.map.layers[0].features[0]});
  editor.controls.layer.value='approaches';editor.applyElement();assert.equal(editor.map.layers[0].features.length,1);assert.equal(editor.map.layers[1].features.length,1);
});

test('file loading is atomic, protects dirty maps, and ignores a late read after leaving Map-Maker',async t=>{
  const editor=mapEditor(t);const original=editor.map;const fixture={name:'valid.map',text:async()=> 'MAP "Replacement"\nSIZE 120 90\nCIRCLE 30 40 10'};
  await editor.loadFile({name:'bad.map',text:async()=> 'MAP "Bad"\nSIZE 1 1\nARC 2 3 -5 0 90'});
  assert.equal(editor.map,original);assert.match(editor.errors.textContent,/radius/);
  editor.dirty=true;
  let loading=editor.loadFile(fixture);await flush();
  const dialog=document.getElementById('confirm-dialog');assert.equal(dialog.open,true);dialog.close('cancel');await loading;
  assert.equal(editor.map,original);assert.equal(editor.dirty,true);
  loading=editor.loadFile(fixture);await flush();dialog.close('accept');await loading;
  assert.equal(editor.map.name,'Replacement');assert.equal(editor.dirty,false);
  const replacement=editor.map;let finishRead;
  loading=editor.loadFile({name:'late.map',text:()=>new Promise(resolve=>{finishRead=resolve;})});
  await editor.leave();editor.radar.setMode('normal');finishRead('MAP "Late"\nSIZE 5 5');await loading;
  assert.equal(editor.map,replacement);
});

test('Save Map emits valid DSL bytes containing applied edits, then that same file loads into the editor',async t=>{
  const editor=mapEditor(t);editor.enter();await editor.selectTool('point');await editor.click({x:550,y:650});
  editor.controls.label.value='Quoted "fix"';editor.controls.filled.value='true';editor.applyElement();
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;let savedBlob;
  URL.createObjectURL=blob=>{savedBlob=blob;return 'blob:test';};URL.revokeObjectURL=()=>{};
  t.after(()=>{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;});
  editor.save();assert.ok(savedBlob instanceof Blob);assert.equal(editor.dirty,false);
  const source=await savedBlob.text();assert.equal(source,serializeMap(editor.map));
  await editor.loadFile({name:'saved.map',text:async()=>source});
  assert.equal(editor.map.layers[0].features.at(-1).style.label,'Quoted "fix"');
  assert.equal(editor.map.layers[0].features.at(-1).style.filled,true);
  assert.equal(editor.map.layers[0].features.at(-1).x,55);
});


test('layer creation preserves unapplied field values and modal cancellation resolves once',async t=>{
  const editor=mapEditor(t);editor.enter();
  editor.selectFeature({layer:editor.map.layers[0],feature:editor.map.layers[0].features[0]});
  editor.controls.color.value='#123456';editor.formDirty=true;
  document.getElementById('new-map-layer').value='newlayer';editor.addLayer();
  assert.equal(editor.controls.color.value,'#123456');assert.equal(editor.formDirty,true);
  let leaving=editor.leave();await flush();const dialog=document.getElementById('confirm-dialog');
  dialog.close('cancel');assert.equal(await leaving,false);assert.equal(editor.formDirty,true);
  leaving=editor.leave();await flush();dialog.close('accept');assert.equal(await leaving,true);
  assert.equal((dialog.listeners.get('close')||[]).length,0);
});

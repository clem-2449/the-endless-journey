import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Transpile only: the engine must load in Node without a DOM, React or Phaser.
const source = readFileSync(new URL('../src/core/simulation.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
}});
const {Simulation} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const createState = (speed = 1) => ({time: 0, speed, logs: [], food: 0, foodCapacity: 100, greenhouse: {workerId: null, position: {x:1,y:0}, area:{x:1,y:0,w:2,h:2}}, crew: [{
  id: 'maya', name: 'Maya', color: 0, selected: true,
  position: {x: 0, y: 0}, path: Array.from({length: 20}, (_, x) => ({x: x + 1, y: 0}))
}]});

for (const speed of [1, 2, 4]) {
  test(`speed ×${speed} advances time and movement together`, () => {
    const state = createState(speed);
    new Simulation(state).advance(1000);
    assert.equal(state.time, speed);
    assert.deepEqual(state.crew[0].position, {x: 4 * speed, y: 0});
  });
}
test('pause preserves partial time and movement, including speed changes', () => {
  const state = createState();
  const simulation = new Simulation(state);
  simulation.advance(125);
  state.speed = 0;
  simulation.advance(10000);
  assert.equal(state.time, 0);
  assert.equal(state.crew[0].position.x, 0);
  state.speed = 2;
  simulation.advance(62.5);
  assert.equal(state.crew[0].position.x, 1);
  simulation.advance(375);
  assert.equal(state.time, 1);
  assert.equal(state.crew[0].position.x, 4);
});
test('frame partitioning does not change simulation results', () => {
  const a = createState(), b = createState();
  new Simulation(a).advance(1375);
  const simulation = new Simulation(b);
  for (let i = 0; i < 55; i++) simulation.advance(25);
  assert.deepEqual(a, b);
});
test('arrival consumes the path and notifies immediately before the next second', () => {
  const state = createState();
  state.crew[0].path = [{x: 1, y: 0}];
  let notifications = 0;
  const simulation = new Simulation(state, () => notifications++);
  simulation.advance(250);
  assert.equal(state.time, 0);
  assert.equal(state.crew[0].path.length, 0);
  assert.equal(state.crew[0].position.x, 1);
  assert.equal(notifications, 1);
  simulation.advance(250);
  assert.equal(notifications, 1);
});
test('invalid elapsed times do not corrupt state', () => {
  const state = createState(), before = structuredClone(state);
  const simulation = new Simulation(state);
  for (const elapsed of [NaN, Infinity, -100, 0]) simulation.advance(elapsed);
  assert.deepEqual(state, before);
});

test('food consumption scales with crew size and game speed; pause freezes food', () => {
  const state = createState(2);
  state.food = 30;
  state.crew[0].path = [];
  const simulation = new Simulation(state);
  simulation.advance(1000);
  assert.ok(Math.abs(state.food - 29.9) < 1e-9);
  state.speed = 0;
  simulation.advance(100000);
  assert.ok(Math.abs(state.food - 29.9) < 1e-9);
});
test('serre requires assignment, arrival and an idle worker inside its area', () => {
  const state = createState();
  state.food = 30;
  state.greenhouse.workerId = 'maya';
  state.crew[0].path = [{x:1,y:0}];
  const simulation = new Simulation(state);
  simulation.advance(250);
  assert.ok(Math.abs(state.food - 29.9875) < 1e-9, 'no production during travel');
  simulation.advance(250);
  assert.ok(Math.abs(state.food - 30.05) < 1e-9, 'production after arrival');
  state.greenhouse.workerId = null;
  simulation.advance(250);
  assert.ok(Math.abs(state.food - 30.0375) < 1e-9, 'no production without assignment');
  state.greenhouse.workerId = 'maya';
  state.crew[0].position = {x:10,y:10};
  simulation.advance(250);
  assert.ok(Math.abs(state.food - 30.025) < 1e-9, 'no production outside greenhouse');
});
test('food is bounded and shortage alerts are emitted once per crossing', () => {
  const state = createState();
  state.food = 5.01;
  state.crew[0].path = [];
  const simulation = new Simulation(state);
  simulation.advance(250);
  assert.equal(state.logs.length,1);
  simulation.advance(200000);
  assert.equal(state.food,0);
  assert.equal(state.logs.length,2);
  simulation.advance(200000);
  assert.equal(state.logs.length,2);
  state.greenhouse.workerId = 'maya';
  state.crew[0].position = {x:1,y:0};
  simulation.advance(1000);
  assert.ok(state.food>0, 'production recovers from empty stock');
  state.food = 99.99;
  simulation.advance(1000);
  assert.equal(state.food,100);
});
test('resource results are independent of frame partitioning, including arrival', () => {
  const a=createState(), b=createState();
  for (const state of [a,b]) {state.food=30;state.greenhouse.workerId='maya';state.crew[0].path=[{x:1,y:0}];}
  new Simulation(a).advance(3125);
  const simulation=new Simulation(b);
  for(let i=0;i<125;i++)simulation.advance(25);
  assert.deepEqual(a,b);
});

test('each crew member consumes food and ×4 scales resources with time', () => {
  const state=createState(4);
  state.food=30;
  state.crew=Array.from({length:3},(_,i)=>({...state.crew[0],id:String(i),path:[]}));
  new Simulation(state).advance(1000);
  assert.ok(Math.abs(state.food-29.4)<1e-9);
  assert.equal(state.time,4);
});

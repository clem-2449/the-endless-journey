import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function loadModule(path){
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const {captureSave,decodeSave}=await loadModule('../src/persistence/format.ts');
const {Simulation}=await loadModule('../src/core/simulation.ts');
function world(){return {time:100,speed:1,food:30,foodCapacity:100,logs:['Une partie'],
 rooms:[{id:'room-greenhouse',name:'SERRES',x:2,y:2,w:7,h:5,color:0x235c49,accessible:true}],
 crew:[{id:'maya',name:'Maya',color:0,position:{x:5,y:7},path:[{x:5,y:6},{x:5,y:5},{x:5,y:4}],selected:true}],
 greenhouse:{id:'greenhouse',roomId:'room-greenhouse',workerId:'maya',position:{x:5,y:4},area:{x:3,y:3,w:5,h:3}}
};}
const initial=()=>captureSave(world(),{accumulator:0,clockAccumulator:0},1);

test('save round trip retains every entity, assignment, path and simulation fraction',()=>{
 const state=world(), simulation=new Simulation(state);
 simulation.advance(875);
 const save=captureSave(state,simulation.progress,3);
 const result=decodeSave(JSON.parse(JSON.stringify(save)));
 assert.deepEqual(result.world,state);
 assert.deepEqual(result.simulation,{accumulator:125,clockAccumulator:750});
 state.food=0;
 assert.notEqual(result.world.food,state.food,'save must be detached from running state');
});
test('restored simulation continues exactly, without applying saved wall-clock time',()=>{
 const a=world(), uninterrupted=new Simulation(a);
 uninterrupted.advance(875);
 const save=captureSave(a,uninterrupted.progress,1);
 save.savedAt='2000-01-01T00:00:00.000Z';
 const restored=decodeSave(save);
 const resumed=new Simulation(restored.world,()=>{},restored.simulation);
 assert.deepEqual(restored.world,a,'opening an old save advances nothing');
 resumed.advance(125);
 uninterrupted.advance(125);
 assert.deepEqual(restored.world,a);
 assert.deepEqual(resumed.progress,uninterrupted.progress);
});
for(const [name,change] of [
 ['future version',s=>s.version=999],
 ['unknown format',s=>s.format='other'],
 ['duplicate entity ID',s=>s.world.crew.push({...s.world.crew[0]})],
 ['missing assigned worker',s=>s.world.greenhouse.workerId='ghost'],
 ['missing room',s=>s.world.greenhouse.roomId='ghost'],
 ['negative food',s=>s.world.food=-1],
 ['food over capacity',s=>s.world.food=101],
 ['nonfinite food',s=>s.world.food=NaN],
 ['discontinuous path',s=>s.world.crew[0].path=[{x:15,y:9}]],
 ['path through a wall',s=>s.world.crew[0].path=[{x:4,y:7},{x:3,y:7},{x:2,y:7},{x:2,y:6}]],
 ['invalid clock fraction',s=>s.simulation.clockAccumulator=100],
 ['invalid substep fraction',s=>s.simulation.accumulator=250]
])test(`rejects ${name} without modifying input`,()=>{
 const save=initial();change(save);const before=structuredClone(save);
 assert.throws(()=>decodeSave(save));
 assert.deepEqual(save,before);
});

import {findPath} from "./pathfinding";
import type {Crew,GameState,Room} from "./types";
export const TILE=32,WIDTH=30,HEIGHT=20;
export const rooms:Room[]=[
 {id:"room-greenhouse",accessible:true,name:"SERRES",x:2,y:2,w:7,h:5,color:0x235c49},
 {id:"room-laboratory",accessible:true,name:"LABORATOIRE",x:11,y:2,w:7,h:5,color:0x285476},
 {id:"room-generator",accessible:true,name:"GÉNÉRATEUR",x:20,y:2,w:8,h:5,color:0x72542b},
 {id:"room-quarters",accessible:true,name:"QUARTIERS",x:2,y:11,w:7,h:6,color:0x464a74},
 {id:"room-storage",accessible:true,name:"ENTREPÔT",x:11,y:11,w:7,h:6,color:0x6c5b37},
 {id:"room-unknown",accessible:false,name:"SECTEUR INCONNU",x:20,y:11,w:8,h:6,color:0x47364e}
];
export const blocked=new Set<string>();
export function rebuildCollision(){
blocked.clear();
// Outside the accessible hull is blocked. Room walls are solid except designated doors.
for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(x===0||y===0||x===WIDTH-1||y===HEIGHT-1)blocked.add(`${x},${y}`);
for(const r of rooms){for(let x=r.x;x<r.x+r.w;x++){blocked.add(`${x},${r.y}`);blocked.add(`${x},${r.y+r.h-1}`)}
for(let y=r.y;y<r.y+r.h;y++){blocked.add(`${r.x},${y}`);blocked.add(`${r.x+r.w-1},${y}`)}
if(r.accessible)blocked.delete(`${r.x+Math.floor(r.w/2)},${r.y<10?r.y+r.h-1:r.y}`);
}
}
rebuildCollision();
export const walkable=(x:number,y:number)=>x>=0&&y>=0&&x<WIDTH&&y<HEIGHT&&!blocked.has(`${x},${y}`);
const crew:Crew[]=[
 {id:"maya",name:"Maya Chen",color:0x7fcfff,position:{x:5,y:9},path:[],selected:true},
 {id:"idris",name:"Idris Kane",color:0xffc67c,position:{x:13,y:9},path:[],selected:true},
 {id:"elena",name:"Elena Voss",color:0xc6a0ff,position:{x:22,y:9},path:[],selected:true}
];
export const state:GameState={time:8*3600+30*60,speed:1,crew,rooms,food:30,foodCapacity:100,greenhouse:{id:"installation-greenhouse",roomId:"room-greenhouse",workerId:null,position:{x:5,y:4},area:{x:3,y:3,w:5,h:3}},logs:["Prototype opérationnel.","Cliquez sur un membre ou dessinez un rectangle de sélection.","Clic droit : déplacement de l'équipe."]};
export function addLog(message:string){state.logs=[message,...state.logs].slice(0,8);notify()}
export function snapshot(){return {time:state.time,speed:state.speed,selected:state.crew.filter(c=>c.selected).map(c=>c.name),logs:[...state.logs],food:state.food}}
const listeners = new Set<() => void>();
export function subscribe(listener: () => void) {
 listeners.add(listener);
 return () => { listeners.delete(listener); };
}
export function notify(){for(const listener of listeners)listener()}

export function assignGreenhouse(workerId: string | null) {
 const worker = state.crew.find(c => c.id === workerId);
 if (workerId !== null && !worker) return;
 const destination = state.greenhouse.position;
 const path = worker ? findPath(worker.position,destination,walkable,WIDTH,HEIGHT) : [];
 if (worker && !path.length && (worker.position.x !== destination.x || worker.position.y !== destination.y)) {
  addLog("La serre est inaccessible pour ce membre.");return;
 }
 const previous = state.crew.find(c => c.id === state.greenhouse.workerId);
 if (previous) previous.path = [];
 state.greenhouse.workerId = workerId;
 if (worker) worker.path = path;
 addLog(worker ? `${worker.name} affecté à la serre.` : "Poste de la serre libéré.");
}

/** Replace loaded entities before creating the renderer. */
export function restoreWorld(saved: GameState) {
 const restored=structuredClone(saved);
 rooms.splice(0,rooms.length,...restored.rooms);
 Object.assign(state,restored,{rooms});
 rebuildCollision();
 notify();
}

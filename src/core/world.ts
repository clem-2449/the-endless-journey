import type {Crew,GameState} from "./types";
export const TILE=32,WIDTH=30,HEIGHT=20;
export const rooms=[
 {name:"SERRES",x:2,y:2,w:7,h:5,color:0x235c49},
 {name:"LABORATOIRE",x:11,y:2,w:7,h:5,color:0x285476},
 {name:"GÉNÉRATEUR",x:20,y:2,w:8,h:5,color:0x72542b},
 {name:"QUARTIERS",x:2,y:11,w:7,h:6,color:0x464a74},
 {name:"ENTREPÔT",x:11,y:11,w:7,h:6,color:0x6c5b37},
 {name:"SECTEUR INCONNU",x:20,y:11,w:8,h:6,color:0x47364e}
];
export const blocked=new Set<string>();
// Outside the accessible hull is blocked. Room walls are solid except designated doors.
for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(x===0||y===0||x===WIDTH-1||y===HEIGHT-1)blocked.add(`${x},${y}`);
for(const r of rooms){for(let x=r.x;x<r.x+r.w;x++){blocked.add(`${x},${r.y}`);blocked.add(`${x},${r.y+r.h-1}`)}
for(let y=r.y;y<r.y+r.h;y++){blocked.add(`${r.x},${y}`);blocked.add(`${r.x+r.w-1},${y}`)}
if(r.name!=="SECTEUR INCONNU")blocked.delete(`${r.x+Math.floor(r.w/2)},${r.y<10?r.y+r.h-1:r.y}`);
}
export const walkable=(x:number,y:number)=>x>=0&&y>=0&&x<WIDTH&&y<HEIGHT&&!blocked.has(`${x},${y}`);
const crew:Crew[]=[
 {id:"maya",name:"Maya Chen",color:0x7fcfff,position:{x:5,y:9},path:[],selected:true},
 {id:"idris",name:"Idris Kane",color:0xffc67c,position:{x:13,y:9},path:[],selected:true},
 {id:"elena",name:"Elena Voss",color:0xc6a0ff,position:{x:22,y:9},path:[],selected:true}
];
export const state:GameState={time:8*3600+30*60,speed:1,crew,logs:["Prototype opérationnel.","Cliquez sur un membre ou dessinez un rectangle de sélection.","Clic droit : déplacement de l'équipe."]};
export function addLog(message:string){state.logs=[message,...state.logs].slice(0,8);window.dispatchEvent(new Event("hardship-update"))}
export function snapshot(){return {time:state.time,speed:state.speed,selected:state.crew.filter(c=>c.selected).map(c=>c.name),logs:[...state.logs]}}
export function notify(){window.dispatchEvent(new Event("hardship-update"))}

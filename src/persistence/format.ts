import type {GameState,SimulationProgress,Point,Room,Crew} from '../core/types';

export type SaveGame = {
  format: 'hard-ship';
  version: 1;
  revision: number;
  savedAt: string;
  world: GameState;
  simulation: SimulationProgress;
};

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Sauvegarde invalide : ${message}.`);
}
function object(value: unknown): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'objet attendu');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, integer = false): number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max &&
    (!integer || Number.isInteger(value)), 'nombre hors limites');
  return value;
}
function text(value: unknown, max = 200): string {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= max, 'texte incorrect');
  return value;
}
function flag(value: unknown): boolean {
  requireValue(typeof value === 'boolean', 'booléen attendu');
  return value;
}
function list(value: unknown, max: number): unknown[] {
  requireValue(Array.isArray(value) && value.length <= max, 'liste incorrecte');
  return value;
}
function point(value: unknown): Point {
  const p = object(value);
  return {x:number(p.x,1,28,true),y:number(p.y,1,18,true)};
}

/** Version dispatch is the migration boundary for future save formats. */
export function decodeSave(value: unknown): SaveGame {
  const root = object(value);
  requireValue(root.format === 'hard-ship', 'ce fichier ne provient pas de Hard Ship');
  if (root.version !== 1) throw new Error('Version de sauvegarde non prise en charge. La partie existante est conservée.');
  const revision = number(root.revision,0,Number.MAX_SAFE_INTEGER,true);
  const savedAt = text(root.savedAt);
  requireValue(Number.isFinite(Date.parse(savedAt)), 'date incorrecte');
  const w = object(root.world), g = object(w.greenhouse), progress = object(root.simulation);
  const rooms:Room[] = list(w.rooms,100).map(value => {
    const r=object(value);
    const room={id:text(r.id),name:text(r.name),x:number(r.x,1,28,true),y:number(r.y,1,18,true),
      w:number(r.w,3,28,true),h:number(r.h,3,18,true),color:number(r.color,0,0xffffff,true),accessible:flag(r.accessible)};
    requireValue(room.x+room.w<=29 && room.y+room.h<=19, 'salle hors de la carte');
    return room;
  });
  requireValue(rooms.length>0, 'aucune salle');
  const crew:Crew[] = list(w.crew,100).map(value => {
    const c=object(value);
    const position=point(c.position), path=list(c.path,600).map(point);
    let previous=position;
    for(const next of path){
      requireValue(Math.abs(previous.x-next.x)+Math.abs(previous.y-next.y)===1,'trajet discontinu');
      previous=next;
    }
    return {id:text(c.id),name:text(c.name),color:number(c.color,0,0xffffff,true),position,path,selected:flag(c.selected)};
  });
  const area=object(g.area);
  const greenhouse={id:text(g.id),roomId:text(g.roomId),workerId:g.workerId===null?null:text(g.workerId),
    position:point(g.position),area:{x:number(area.x,1,28,true),y:number(area.y,1,18,true),
      w:number(area.w,1,28,true),h:number(area.h,1,18,true)}};
  const ids=[...crew.map(c=>c.id),...rooms.map(r=>r.id),greenhouse.id];
  requireValue(new Set(ids).size===ids.length, 'identifiants dupliqués');
  requireValue(greenhouse.workerId===null || crew.some(c=>c.id===greenhouse.workerId),'affectation inconnue');
  const room=rooms.find(r=>r.id===greenhouse.roomId);
  requireValue(room && room.accessible,'salle de la serre inconnue');
  requireValue(greenhouse.area.x>room.x && greenhouse.area.y>room.y &&
    greenhouse.area.x+greenhouse.area.w<room.x+room.w &&
    greenhouse.area.y+greenhouse.area.h<room.y+room.h,'zone de travail hors de sa salle');
  requireValue(greenhouse.position.x>=greenhouse.area.x && greenhouse.position.y>=greenhouse.area.y &&
    greenhouse.position.x<greenhouse.area.x+greenhouse.area.w &&
    greenhouse.position.y<greenhouse.area.y+greenhouse.area.h,'poste hors de la serre');
  const blocked=new Set<string>();
  for(const r of rooms){
    for(let x=r.x;x<r.x+r.w;x++){blocked.add(`${x},${r.y}`);blocked.add(`${x},${r.y+r.h-1}`);}
    for(let y=r.y;y<r.y+r.h;y++){blocked.add(`${r.x},${y}`);blocked.add(`${r.x+r.w-1},${y}`);}
    if(r.accessible)blocked.delete(`${r.x+Math.floor(r.w/2)},${r.y<10?r.y+r.h-1:r.y}`);
  }
  for(const c of crew)for(const p of [c.position,...c.path]){
    requireValue(!blocked.has(`${p.x},${p.y}`),'personnage ou trajet dans un mur');
  }
  const foodCapacity=number(w.foodCapacity,0.01,1e9);
  const speed=number(w.speed,0,4,true);
  requireValue([0,1,2,4].includes(speed),'vitesse inconnue');
  const accumulator=number(progress.accumulator,0,250);
  const clockAccumulator=number(progress.clockAccumulator,0,750,true);
  requireValue(accumulator<250 && clockAccumulator%250===0,'fraction de temps incorrecte');
  return {format:'hard-ship',version:1,revision,savedAt,world:{
    time:number(w.time,0,Number.MAX_SAFE_INTEGER,true),speed:speed as GameState['speed'],crew,rooms,
    logs:list(w.logs,8).map(v=>text(v,1000)),food:number(w.food,0,foodCapacity),foodCapacity,greenhouse
  },simulation:{accumulator,clockAccumulator}};
}

export function captureSave(world: GameState, simulation: SimulationProgress, revision: number): SaveGame {
  // Decode also strips unknown fields and checks snapshots before writing anything.
  return decodeSave({format:'hard-ship',version:1,revision,savedAt:new Date().toISOString(),world,simulation});
}

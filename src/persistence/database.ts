import {decodeSave} from './format';
import type {SaveGame} from './format';

export const DATABASE_NAME = 'hard-ship';
const STORES = ['world','crew','rooms','installations','resources'] as const;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,1);
    request.onupgradeneeded=()=>{
      // Increment the database version here when adding stores or indexes.
      for(const store of STORES)request.result.createObjectStore(store,{keyPath:'id'});
    };
    request.onerror=()=>reject(request.error ?? new Error('IndexedDB indisponible.'));
    request.onblocked=()=>reject(new Error('Fermez les autres onglets Hard Ship puis réessayez.'));
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
  });
}

export async function loadGame(db: IDBDatabase): Promise<SaveGame|null> {
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction([...STORES],'readonly');
    const requests=STORES.map(store=>transaction.objectStore(store).getAll());
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error ?? new Error('Lecture interrompue.'));
    transaction.oncomplete=()=>{
      try {
        const [worlds,crew,rooms,installations,resources]=requests.map(r=>r.result);
        if(worlds.length===0){
          if(crew.length || rooms.length || installations.length || resources.length)throw new Error('Base incomplète ; aucune donnée n’a été écrasée.');
          resolve(null);return;
        }
        if(worlds.length!==1 || worlds[0].id!=='solo' || installations.length!==1 || resources.length!==1 || resources[0].id!=='food'){
          throw new Error('Base incohérente ; aucune donnée n’a été écrasée.');
        }
        const meta=worlds[0], food=resources[0];
        const ordered=(rows:Record<string,unknown>[],ids:unknown)=>{
          if(!Array.isArray(ids) || ids.length!==rows.length || new Set(ids).size!==ids.length){
            throw new Error('Ordre des entités incohérent.');
          }
          const byId=new Map(rows.map(row=>[row.id,row]));
          return ids.map(id=>byId.get(id));
        };
        resolve(decodeSave({...meta,world:{time:meta.time,speed:meta.speed,logs:meta.logs,
          crew:ordered(crew,meta.crewIds),rooms:ordered(rooms,meta.roomIds),greenhouse:installations[0],food:food.amount,foodCapacity:food.capacity}}));
      }catch(error){reject(error);}
    };
  });
}

export function saveGame(db: IDBDatabase, value: SaveGame): Promise<void> {
  const save=decodeSave(value);
  return new Promise((resolve,reject)=>{
    // All entity stores commit together: never a new crew with an old resource stock.
    const transaction=db.transaction([...STORES],'readwrite');
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(transaction.error ?? new Error('Sauvegarde interrompue.'));
    transaction.onerror=()=>reject(transaction.error);
    try {
    for(const store of STORES)transaction.objectStore(store).clear();
    const {world, ...metadata}=save;
    transaction.objectStore('world').put({...metadata,id:'solo',time:world.time,speed:world.speed,logs:world.logs,
      crewIds:world.crew.map(c=>c.id),roomIds:world.rooms.map(r=>r.id)});
    for(const c of world.crew)transaction.objectStore('crew').put(c);
    for(const r of world.rooms)transaction.objectStore('rooms').put(r);
    transaction.objectStore('installations').put(world.greenhouse);
    transaction.objectStore('resources').put({id:'food',amount:world.food,capacity:world.foodCapacity});
    }catch(error){transaction.abort();reject(error);}
  });
}

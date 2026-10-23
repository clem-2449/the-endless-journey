import {state,restoreWorld,notify,subscribe} from '../core/world';
import {Simulation} from '../core/simulation';
import {captureSave,decodeSave} from './format';
import {loadGame,openDatabase,saveGame} from './database';
import type {SaveGame} from './format';

const CHECKPOINT_KEY='hard-ship-checkpoint-v1';
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);

async function lockWorld():Promise<()=>void>{
  if(!navigator.locks)throw new Error('Ce navigateur ne permet pas de protéger la partie entre plusieurs onglets. Utilisez un navigateur récent sur localhost ou HTTPS.');
  return new Promise((resolve,reject)=>{
    navigator.locks.request('hard-ship-solo',{ifAvailable:true},async lock=>{
      if(!lock){reject(new Error('Une partie est déjà ouverte dans un autre onglet. Fermez-le puis réessayez.'));return;}
      await new Promise<void>(release=>resolve(release));
    }).catch(reject);
  });
}

export class GameSession {
  private simulation:Simulation;
  private revision:number;
  private previous=performance.now();
  private dirty=false;
  private suspended=false;
  private importing=false;
  private queue:Promise<void>=Promise.resolve();
  private statusListeners=new Set<()=>void>();
  status='Sauvegarde automatique active';
  renderVersion=0;

  private constructor(private db:IDBDatabase, saved:SaveGame|null){
    this.revision=saved?.revision??0;
    this.simulation=new Simulation(state,notify,saved?.simulation);
  }

  static async open(replacement?:SaveGame):Promise<GameSession>{
    const release=await lockWorld();
    let db:IDBDatabase|undefined;
    try{
      db=await openDatabase();
      let saved:SaveGame|null;
      let checkpoint:string|null=null;
      try{checkpoint=localStorage.getItem(CHECKPOINT_KEY);}catch{/* IndexedDB may still be usable. */}
      if(replacement){
        // Only a user-selected, validated import can replace an unreadable save.
        let revision=replacement.revision;
        try{revision=Math.max(revision,(await loadGame(db))?.revision??0);}catch{}
        if(checkpoint){try{revision=Math.max(revision,decodeSave(JSON.parse(checkpoint)).revision);}catch{}}
        saved={...decodeSave(replacement),revision:revision+1,savedAt:new Date().toISOString()};
        await saveGame(db,saved);
      }else{
        saved=await loadGame(db);
        if(checkpoint){
          const candidate=decodeSave(JSON.parse(checkpoint));
          if(!saved || candidate.revision>saved.revision){
            await saveGame(db,candidate);
            saved=candidate;
          }
        }
      }
      if(saved)restoreWorld(saved.world);
      const session=new GameSession(db,saved);
      await session.save();
      session.start();
      return session;
    }catch(error){db?.close();release();throw error;}
  }

  subscribeStatus=(listener:()=>void)=>{
    this.statusListeners.add(listener);
    return ()=>{this.statusListeners.delete(listener);};
  };

  private message(text:string){
    this.status=text;
    for(const listener of this.statusListeners)listener();
  }

  private capture():SaveGame{
    return captureSave(state,this.simulation.progress,++this.revision);
  }

  private checkpoint(save:SaveGame):boolean{
    try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify(save));return true;}
    catch{return false;}
  }

  private persist(save:SaveGame):Promise<void>{
    const checkpointOK=this.checkpoint(save);
    this.message('Sauvegarde en cours…');
    const operation=this.queue.then(()=>saveGame(this.db,save));
    this.queue=operation.catch(()=>{});
    return operation.then(()=>{
      this.message(checkpointOK?'Partie sauvegardée':'Partie sauvegardée ; protection à la fermeture indisponible');
    },error=>{
      this.dirty=true;
      this.message(`Échec de sauvegarde : ${errorText(error)}`);
      throw error;
    });
  }

  save=():Promise<void>=>{
    if(this.importing)return Promise.reject(new Error("Import en cours."));
    this.dirty=false;
    return this.persist(this.capture());
  };

  export=():void=>{
    const blob=new Blob([JSON.stringify(this.capture(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download='hard-ship-partie.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  import=async(file:File):Promise<void>=>{
    if(this.importing)return;
    this.importing=true;
    const previousSuspended=this.suspended;
    this.suspended=true;
    try{
      if(file.size>5_000_000)throw new Error('Fichier trop volumineux (5 Mo maximum).');
      const save=decodeSave(JSON.parse(await file.text()));
      // Finish older writes, validate first, then atomically replace the stored world.
      await this.queue;
      save.revision=++this.revision;
      save.savedAt=new Date().toISOString();
      await saveGame(this.db,save);
      const checkpointOK=this.checkpoint(save);
      restoreWorld(save.world);
      this.simulation=new Simulation(state,notify,save.simulation);
      this.renderVersion++;
      this.dirty=false;
      this.message(checkpointOK?'Partie importée et sauvegardée':'Partie importée ; protection à la fermeture indisponible');
    }catch(error){
      this.message(`Import impossible : ${errorText(error)}`);
      throw error;
    }finally{
      this.previous=performance.now();
      this.suspended=previousSuspended;
      this.importing=false;
    }
  };

  private start(){
    subscribe(()=>{this.dirty=true;});
    window.setInterval(()=>{
      const now=performance.now();
      if(!this.suspended && !this.importing && !document.hidden)this.simulation.advance(Math.min(now-this.previous,100));
      this.previous=now;
    },16);
    window.setInterval(()=>{
      if(this.dirty && !this.importing)void this.save().catch(()=>{});
    },2000);
    const suspend=()=>{
      this.suspended=true;
      // Synchronous checkpoint: IndexedDB completion cannot be awaited at tab closure.
      if(!this.importing)void this.save().catch(()=>{});
    };
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)suspend();
      else{this.previous=performance.now();this.suspended=false;}
    });
    window.addEventListener('pagehide',suspend);
    window.addEventListener('pageshow',()=>{this.previous=performance.now();this.suspended=false;});
  }
}

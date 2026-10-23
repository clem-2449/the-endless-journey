import React,{useEffect,useState,useRef} from "react";
import{createRoot}from"react-dom/client";
import Phaser from "phaser";
import{ShipScene}from"./render/ShipScene";
import{state,snapshot,notify,subscribe,assignGreenhouse}from"./core/world";
import {greenhouseWorking,FOOD_PER_CREW_SECOND,GREENHOUSE_FOOD_PER_SECOND} from "./core/simulation";
import type{Snapshot}from"./core/types";
import "./style.css";
import {GameSession} from "./persistence/session";
import {decodeSave} from "./persistence/format";
function App({session}:{session:GameSession}){
 const [snap,setSnap]=useState<Snapshot>(snapshot());
 const [saveStatus,setSaveStatus]=useState(session.status);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>session.subscribeStatus(()=>{setSaveStatus(session.status);setSnap(snapshot());}),[session]);
 useEffect(()=>{
  const game=new Phaser.Game({type:Phaser.AUTO,parent:"game",width:960,height:640,backgroundColor:"#0b1421",scene:[ShipScene],scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH}});
  const unsubscribe=subscribe(()=>setSnap(snapshot()));
  return()=>{unsubscribe();game.destroy(true)}
 },[session.renderVersion]);
 const worker=state.crew.find(c=>c.id===state.greenhouse.workerId);
 const producing=greenhouseWorking(state);
 const consumption=state.crew.length*FOOD_PER_CREW_SECOND*60;
 const production=producing?GREENHOUSE_FOOD_PER_SECOND*60:0;
 const crewStatus=(id:string,pathLength:number)=>id===state.greenhouse.workerId
  ? (producing?"Travaille à la serre":"Rejoint la serre") : (pathLength?"En déplacement":"Disponible");
 const h=String(Math.floor(snap.time/3600)%24).padStart(2,"0"),m=String(Math.floor(snap.time/60)%60).padStart(2,"0"),s=String(snap.time%60).padStart(2,"0");
 return <div className="shell">
  <header><div><strong>HARD-SHIP</strong><small>SECTEUR HABITABLE — PROTOTYPE 0.1</small></div><div className="clock">{h}:{m}:{s}</div><div className="speed">{([0,1,2,4] as const).map(v=><button className={snap.speed===v?"active":""} onClick={()=>{state.speed=v;notify()}} key={v}>{v===0?"Ⅱ":`×${v}`}</button>)}</div></header>
  <main><div id="game"></div><aside><h3>PARTIE SOLO</h3>
  <p className="muted" role="status">{saveStatus}</p>
  <div className="save-actions">
   <button onClick={()=>{void session.save().catch(()=>{});}}>Sauvegarder</button>
   <button onClick={()=>session.export()}>Exporter</button>
   <button onClick={()=>fileInput.current?.click()}>Importer</button>
   <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Importer une partie" hidden onChange={e=>{
    const file=e.target.files?.[0];e.target.value="";
    if(file)void session.import(file).catch(()=>{});
   }}/>
  </div>
  <p className="muted">Sauvegarde locale automatique. Le temps se fige quand le jeu est fermé ou masqué. Importer remplace la partie : exportez-la pour en garder une copie.</p>
  <h3>ÉQUIPAGE</h3>{state.crew.map(c=><div className={"crew "+(snap.selected.includes(c.name)?"on":"")} key={c.id}><span style={{color:"#"+c.color.toString(16).padStart(6,"0")}}>●</span> {c.name}<small>{crewStatus(c.id,c.path.length)}</small></div>)}<h3>ÉTAT DU VAISSEAU</h3><div className="stat">Oxygène <b>94 %</b></div><div className="stat">Énergie <b>87 %</b></div><div className="stat">Nourriture <b data-testid="food">{snap.food.toFixed(1)} / {state.foodCapacity}</b></div>
  <p className="muted">Rations · consommation : {consumption.toFixed(0)}/min de jeu.<br/>Production : {production.toFixed(0)}/min · bilan : {(production-consumption).toFixed(0)}/min.</p>
  {snap.food<=5&&<p className="food-warning" role="status">{snap.food===0?"Nourriture épuisée !":"Réserves de nourriture faibles."}</p>}
  <h3>SERRE</h3>
  <label className="muted" htmlFor="greenhouse-worker">Membre affecté</label>
  <select id="greenhouse-worker" value={worker?.id??""} onChange={e=>assignGreenhouse(e.target.value||null)}>
   <option value="">Aucun</option>
   {state.crew.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
  </select>
  <p className="muted">{producing?"En production":worker?"En attente de l’arrivée du membre":"Inactive : affectez un membre"}. Un poste · production : {(GREENHOUSE_FOOD_PER_SECOND*60).toFixed(0)} rations/min de jeu.</p>
  <p className="muted">L’oxygène et l’énergie restent des valeurs de démonstration. La faim et ses conséquences viendront ensuite.</p><h3>JOURNAL</h3>{snap.logs.map((l,i)=><p className="log" key={i}>{l}</p>)}</aside></main>
  <footer><span>CLIC GAUCHE : sélectionner · GLISSER : sélection multiple · MAJ : ajouter</span><span>CLIC DROIT : déplacer · ZQSD : caméra · MOLETTE : zoom · ESPACE : pause</span></footer>
 </div>
}
const root=createRoot(document.getElementById("root")!);
async function boot(file?:File){
 root.render(<div className="startup">Chargement de la partie…</div>);
 try{
  if(file && file.size>5_000_000)throw new Error("Fichier trop volumineux (5 Mo maximum).");
  const replacement=file?decodeSave(JSON.parse(await file.text())):undefined;
  const session=await GameSession.open(replacement);
  root.render(<React.StrictMode><App session={session}/></React.StrictMode>);
 }catch(error){
  root.render(<div className="startup" role="alert"><h1>Impossible de charger la partie</h1>
   <p>{error instanceof Error?error.message:String(error)}</p>
   <p>Le jeu est arrêté pour protéger vos données. Réessayez ou importez une copie valide de votre partie. Importer remplace la sauvegarde existante.</p>
   <label>Restaurer un fichier de sauvegarde <input type="file" accept=".json,application/json" onChange={e=>{
    const file=e.target.files?.[0];if(file)void boot(file);
   }}/></label>
   <button onClick={()=>location.reload()}>Réessayer</button></div>);
 }
}
void boot();

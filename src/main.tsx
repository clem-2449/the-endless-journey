import React,{useEffect,useState} from "react";
import{createRoot}from"react-dom/client";
import Phaser from "phaser";
import{ShipScene}from"./render/ShipScene";
import{state,snapshot,notify}from"./core/world";
import type{Snapshot}from"./core/types";
import "./style.css";
function App(){
 const [snap,setSnap]=useState<Snapshot>(snapshot());
 useEffect(()=>{
  const game=new Phaser.Game({type:Phaser.AUTO,parent:"game",width:960,height:640,backgroundColor:"#0b1421",scene:[ShipScene],scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH}});
  const update=()=>setSnap(snapshot());window.addEventListener("hardship-update",update);
  return()=>{window.removeEventListener("hardship-update",update);game.destroy(true)}
 },[]);
 const h=String(Math.floor(snap.time/3600)%24).padStart(2,"0"),m=String(Math.floor(snap.time/60)%60).padStart(2,"0"),s=String(snap.time%60).padStart(2,"0");
 return <div className="shell">
  <header><div><strong>HARD-SHIP</strong><small>SECTEUR HABITABLE — PROTOTYPE 0.1</small></div><div className="clock">{h}:{m}:{s}</div><div className="speed">{([0,1,2,4] as const).map(v=><button className={snap.speed===v?"active":""} onClick={()=>{state.speed=v;notify()}} key={v}>{v===0?"Ⅱ":`×${v}`}</button>)}</div></header>
  <main><div id="game"></div><aside><h3>ÉQUIPAGE</h3>{state.crew.map(c=><div className={"crew "+(snap.selected.includes(c.name)?"on":"")} key={c.id}><span style={{color:"#"+c.color.toString(16).padStart(6,"0")}}>●</span> {c.name}<small>{c.path.length?"En déplacement":"Disponible"}</small></div>)}<h3>ÉTAT DU VAISSEAU</h3><div className="stat">Oxygène <b>94 %</b></div><div className="stat">Énergie <b>87 %</b></div><div className="stat">Nourriture <b>63 %</b></div><p className="muted">Valeurs de démonstration : la gestion des ressources arrive au prochain jalon.</p><h3>JOURNAL</h3>{snap.logs.map((l,i)=><p className="log" key={i}>{l}</p>)}</aside></main>
  <footer><span>CLIC GAUCHE : sélectionner · GLISSER : sélection multiple · MAJ : ajouter</span><span>CLIC DROIT : déplacer · ZQSD : caméra · MOLETTE : zoom · ESPACE : pause</span></footer>
 </div>
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);

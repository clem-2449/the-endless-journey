import Phaser from "phaser";
import {TILE,WIDTH,HEIGHT,rooms,blocked,walkable,state,notify,addLog} from "../core/world";
import {findPath} from "../core/pathfinding";
import type {Point} from "../core/types";
export class ShipScene extends Phaser.Scene{
 private graphics!:Phaser.GameObjects.Graphics;
 private labels:Phaser.GameObjects.Text[]=[];
 private people=new Map<string,Phaser.GameObjects.Container>();
 private dragStart:Phaser.Math.Vector2|null=null;
 private dragRect!:Phaser.GameObjects.Rectangle;
 private keys!:Record<string,Phaser.Input.Keyboard.Key>;
 constructor(){super("ShipScene")}
 create(){
  this.cameras.main.setBackgroundColor("#0b1421");
  this.graphics=this.add.graphics();this.drawWorld();
  this.dragRect=this.add.rectangle(0,0,0,0,0x7fd4ff,.12).setStrokeStyle(1,0x7fd4ff).setOrigin(0).setDepth(30).setVisible(false);
  for(const c of state.crew){
   const halo=this.add.circle(0,0,12,0xffe4a1,0).setStrokeStyle(2,0xffe4a1);
   const body=this.add.circle(0,0,7,c.color).setStrokeStyle(1,0xffffff);
   const label=this.add.text(0,-20,c.name.split(" ")[0],{fontSize:"10px",color:"#eaf4ff"}).setOrigin(.5);
   const node=this.add.container((c.position.x+.5)*TILE,(c.position.y+.5)*TILE,[halo,body,label]).setDepth(20);
   this.people.set(c.id,node);
  }
  this.input.mouse?.disableContextMenu();
  this.input.on("pointerdown",(p:Phaser.Input.Pointer)=>{
   if(p.rightButtonDown()){this.commandMove(p.worldX,p.worldY);return}
   this.dragStart=new Phaser.Math.Vector2(p.worldX,p.worldY);
  });
  this.input.on("pointermove",(p:Phaser.Input.Pointer)=>{
   if(!this.dragStart||!p.isDown)return;
   const x=Math.min(this.dragStart.x,p.worldX),y=Math.min(this.dragStart.y,p.worldY);
   const w=Math.abs(p.worldX-this.dragStart.x),h=Math.abs(p.worldY-this.dragStart.y);
   this.dragRect.setPosition(x,y).setSize(w,h).setVisible(w>6||h>6);
  });
  this.input.on("pointerup",(p:Phaser.Input.Pointer)=>{
   if(!this.dragStart||p.rightButtonReleased())return;
   const a=this.dragStart;this.dragStart=null;this.dragRect.setVisible(false);
   const box=new Phaser.Geom.Rectangle(Math.min(a.x,p.worldX),Math.min(a.y,p.worldY),Math.abs(a.x-p.worldX),Math.abs(a.y-p.worldY));
   const shift=p.event.shiftKey;
   if(!shift)state.crew.forEach(c=>c.selected=false);
   if(box.width>8||box.height>8){for(const c of state.crew){const pos=this.people.get(c.id)!;if(box.contains(pos.x,pos.y))c.selected=true}}
   else{const closest=state.crew.find(c=>{const pos=this.people.get(c.id)!;return Phaser.Math.Distance.Between(pos.x,pos.y,p.worldX,p.worldY)<15});if(closest)closest.selected=true}
   notify();
  });
  this.input.on("wheel",(_p:unknown,_g:unknown,_dx:number,dy:number)=>{const z=this.cameras.main.zoom;this.cameras.main.setZoom(Phaser.Math.Clamp(z-dy*.001,0.65,2))});
  this.keys=this.input.keyboard!.addKeys("W,A,S,D,Z,Q,UP,DOWN,LEFT,RIGHT,SPACE") as Record<string,Phaser.Input.Keyboard.Key>;
  this.input.keyboard!.on("keydown-SPACE",()=>{state.speed=state.speed===0?1:0;notify()});
  this.cameras.main.centerOn(
  WIDTH * TILE / 2,
  HEIGHT * TILE / 2);
  this.scale.on("resize", () => {
  this.centerCamera();
  });
  this.centerCamera();
 }
 private drawWorld(){
  const g=this.graphics;g.clear();
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
   g.fillStyle(blocked.has(`${x},${y}`)?0x526172:0x1a2b3c,1);g.fillRect(x*TILE,y*TILE,TILE,TILE);
   g.lineStyle(1,0x2d4050,.45);g.strokeRect(x*TILE,y*TILE,TILE,TILE);
  }
  for(const r of rooms){
   g.fillStyle(r.color,.75);g.fillRect((r.x+1)*TILE,(r.y+1)*TILE,(r.w-2)*TILE,(r.h-2)*TILE);
   this.labels.push(this.add.text((r.x+r.w/2)*TILE,(r.y+r.h/2)*TILE,r.name,{fontSize:"12px",color:"#e0eaf3",fontStyle:"bold"}).setOrigin(.5));
  }
  g.fillStyle(0x304655,1);g.fillRect(TILE,8*TILE,(WIDTH-2)*TILE,3*TILE);
  g.lineStyle(1,0x5b7685,.5);g.strokeRect(TILE,8*TILE,(WIDTH-2)*TILE,3*TILE);
  for(const r of rooms){if(r.name==="SECTEUR INCONNU")continue;
   const doorX=(r.x+Math.floor(r.w/2))*TILE,doorY=(r.y<10?r.y+r.h-1:r.y)*TILE;
   g.fillStyle(0x83b5c6,1);g.fillRect(doorX,doorY,TILE,TILE);
  }
 }
 private commandMove(wx:number,wy:number){
  const target={x:Math.floor(wx/TILE),y:Math.floor(wy/TILE)};
  if(!walkable(target.x,target.y)){addLog("Destination inaccessible.");return}
  const selected=state.crew.filter(c=>c.selected);
  if(selected.some(c=>c.id===state.greenhouse.workerId)){
   state.greenhouse.workerId=null;
   addLog("Affectation à la serre interrompue par un ordre de déplacement.");
  }
  selected.forEach((c,i)=>{
   const candidates:Point[]=[target,...[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))];
   const dest=candidates[i%candidates.length];
   c.path=findPath(c.position,walkable(dest.x,dest.y)?dest:target,walkable,WIDTH,HEIGHT);
  });
  if(selected.length)addLog(`Déplacement ordonné à ${selected.length} membre(s).`);
 }

private centerCamera() {
  const camera = this.cameras.main;

  const mapWidth = WIDTH * TILE;
  const mapHeight = HEIGHT * TILE;

  // Calcul du zoom pour faire tenir la carte
  const zoomX = camera.width / mapWidth;
  const zoomY = camera.height / mapHeight;

  const zoom = Math.min(zoomX, zoomY) * 0.90;

  camera.setZoom(zoom);

  // Désactive les limites de déplacement
  camera.removeBounds();

  // Centre la carte dans la zone visible
  camera.centerOn(
    mapWidth / 2,
    mapHeight / 2
  );
}

 update(_time:number,delta:number){
  const dt=Math.min(delta,100);
  for(const c of state.crew){const node=this.people.get(c.id)!;node.setPosition((c.position.x+.5)*TILE,(c.position.y+.5)*TILE);(node.list[0] as Phaser.GameObjects.Arc).setVisible(c.selected)}
  const pan=dt*.5/this.cameras.main.zoom;
  if(this.keys.A.isDown||this.keys.Q.isDown||this.keys.LEFT.isDown)this.cameras.main.scrollX-=pan;
  if(this.keys.D.isDown||this.keys.RIGHT.isDown)this.cameras.main.scrollX+=pan;
  if(this.keys.W.isDown||this.keys.Z.isDown||this.keys.UP.isDown)this.cameras.main.scrollY-=pan;
  if(this.keys.S.isDown||this.keys.DOWN.isDown)this.cameras.main.scrollY+=pan;
 }
}

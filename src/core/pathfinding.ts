import type {Point} from "./types";
export function findPath(start:Point,end:Point,walkable:(x:number,y:number)=>boolean,width:number,height:number):Point[]{
 const key=(p:Point)=>`${p.x},${p.y}`;
 if(!walkable(end.x,end.y))return [];
 const open:Point[]=[start], came=new Map<string,Point>(),g=new Map([[key(start),0]]),f=new Map([[key(start),Math.abs(start.x-end.x)+Math.abs(start.y-end.y)]]),closed=new Set<string>();
 while(open.length){
  open.sort((a,b)=>(f.get(key(a))??Infinity)-(f.get(key(b))??Infinity));
  const cur=open.shift()!;if(cur.x===end.x&&cur.y===end.y){const path:Point[]=[];let p=cur;while(key(p)!==key(start)){path.unshift(p);p=came.get(key(p))!}return path}
  closed.add(key(cur));
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const next={x:cur.x+dx,y:cur.y+dy},k=key(next);
   if(next.x<0||next.y<0||next.x>=width||next.y>=height||!walkable(next.x,next.y)||closed.has(k))continue;
   const tentative=(g.get(key(cur))??Infinity)+1;
   if(tentative<(g.get(k)??Infinity)){came.set(k,cur);g.set(k,tentative);f.set(k,tentative+Math.abs(next.x-end.x)+Math.abs(next.y-end.y));if(!open.some(p=>key(p)===k))open.push(next)}
  }
 }
 return [];
}

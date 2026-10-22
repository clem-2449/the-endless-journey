export type Point={x:number;y:number};
export type Crew={id:string;name:string;color:number;position:Point;path:Point[];selected:boolean};
export type GameState={time:number;speed:0|1|2|4;crew:Crew[];logs:string[]};
export type Snapshot={time:number;speed:0|1|2|4;selected:string[];logs:string[]};

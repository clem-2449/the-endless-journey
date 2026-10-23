export type Point={x:number;y:number};
export type Crew={id:string;name:string;color:number;position:Point;path:Point[];selected:boolean};
export type Greenhouse={workerId:string|null;position:Point;area:{x:number;y:number;w:number;h:number}};
export type GameState={time:number;speed:0|1|2|4;crew:Crew[];logs:string[];food:number;foodCapacity:number;greenhouse:Greenhouse};
export type Snapshot={time:number;speed:0|1|2|4;selected:string[];logs:string[];food:number};

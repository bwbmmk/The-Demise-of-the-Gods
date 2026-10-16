import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Read-only review of the external pack. This validates only its basic obstacles with
// the current input policy; new wind/tide/sleep/weave/Boss mechanics are not simulated.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pack=process.argv[2]||'C:/Users/MR/Desktop/music';
const input=await import(pathToFileURL(path.join(pack,'extension/levels-v2.js')));
const original=await readFile(path.join(root,'src/physics.js'),'utf8');
const report={scope:'Current Runner and the existing automated input policy; basic obstacles only',results:[]};
for(const chapter of input.CHAPTERS_V2){
  const terrain=chapter.terrain,obstacles=input.buildObstacles(chapter.id,chapter.layout);
  const prelude=`const WORLD=${JSON.stringify({...input.WORLD_V2,end:terrain.at(-1)[0]})};
const TERRAIN=${JSON.stringify(terrain)},OBSTACLES=${JSON.stringify(obstacles)},SHARDS=[],SPRINGS=[],RINGS=[];
const CHAPTERS=[{at:0,speed:310},{at:9200,speed:345},{at:18400,speed:375}];
const groundAt=(${input.makeGroundAt.toString()})(TERRAIN,WORLD.ground);
const chapterAt=x=>CHAPTERS.reduce((i,c,j)=>x>=c.at?j:i,0);
const hazardBounds=o=>(${input.hazardBoundsFor.toString()})(o,groundAt);
`;
  const {Runner}=await import('data:text/javascript;base64,'+Buffer.from(prelude+original.replace(/^import .*;\r?\n/, '')).toString('base64'));
  const game=new Runner(),triggered=new Set();let doubleAt=null,firstIssue=null;
  for(let frame=0;frame<120*140&&game.state==='running';frame++){
    const next=obstacles.find(o=>!triggered.has(o.id)&&o.x>game.x-100);
    if(next){const lead=next.type==='beam'?48:next.type==='gap'?30:100;
      if(game.x>=next.x-lead){triggered.add(next.id);if(next.type==='beam')game.slide();else{game.jump();if(next.type==='gap'&&next.width>=280)doubleAt=game.elapsed+.38;}}
    }
    if(doubleAt!==null&&game.elapsed>=doubleAt){game.jump();doubleAt=null;}
    const beforeX=game.x,beforeY=game.y;game.update(1/120);
    if(game.health<3){firstIssue={xBeforeDamage:Math.round(beforeX),yBeforeDamage:Math.round(beforeY),events:game.drainEvents().filter(e=>['hit','respawn','dead'].includes(e.type))};break;}
    game.drainEvents();
  }
  report.results.push({id:chapter.id,name:chapter.name,obstacles:obstacles.length,
    basicRoutePassed:game.state==='won'&&game.health===3,firstIssue});
}
await writeFile(path.join(root,'docs/music-pack-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

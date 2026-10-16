import test from 'node:test';
import assert from 'node:assert/strict';
import { LANTERN } from '../src/level-lantern.js';
import { LEVELS, validateLevel, jumpReach } from '../src/level.js';
import { Runner } from '../src/physics.js';
import { Narrative } from '../src/narrative.js';
import { Encounter } from '../src/narrative-act1.js';
import { CHAPTER_STORIES } from '../src/chapter-scenes.js';
import { ProgressStore } from '../src/progress.js';

function runLantern({checkpoint=0,leadOffset=0}={}){
  const g=new Runner(LANTERN),handled=new Set(),events=[];let doubleAt=null;
  if(checkpoint){g.checkpoint=checkpoint;g.restoreCheckpoint(true);for(const o of LANTERN.obstacles)if(o.x<checkpoint)handled.add(o.id);}
  for(let i=0;i<120*120&&g.state==='running';i++){
    const next=LANTERN.obstacles.find(o=>!handled.has(o.id));
    if(next){const lead=(next.type==='beam'?48:next.type==='gap'?30:100)+leadOffset;if(g.x>=next.x-lead){
      handled.add(next.id);if(next.type==='beam')g.slide();else{g.jump();if(next.type==='gap'&&next.width>jumpReach(LANTERN.chapters[g.chapter].speed)-12)doubleAt=g.elapsed+.38;}
    }}
    if(doubleAt!==null&&g.elapsed>=doubleAt){g.jump();doubleAt=null;}
    g.update(1/120);events.push(...g.drainEvents());
  }
  return {g,events};
}
test('lamp route remains an internal template and its ending closes act one',()=>{
  assert.equal(LEVELS.lantern,undefined);assert.deepEqual(validateLevel(LANTERN),[]);
  assert.equal(CHAPTER_STORIES.lantern,undefined);assert.equal(CHAPTER_STORIES.district.ending.length,3);
});
test('chapter two has a clean route with input tolerance and all lamps lit',()=>{
  for(const leadOffset of [-8,0,8]){const {g,events}=runLantern({leadOffset});
    assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);
    assert.equal(events.filter(e=>e.type==='hit').length,0);assert.equal(g.litLamps.size,3);assert.equal(g.items.size,3);
    assert.ok(g.elapsed>95&&g.elapsed<110);
  }
});
test('cold fog hurts without a lamp and warmth is a simulation timer',()=>{
  const g=new Runner(LANTERN);g.x=5000;g.y=g.groundAt(g.x);g.prevY=g.y;
  g.update(1/120);assert.equal(g.health,2);
  g.invulnerable=0;g.warmth=1;g.update(.5);assert.equal(g.health,2);assert.equal(g.warmth,.5);
  g.update(.51);assert.equal(g.warmth,0);assert.equal(g.health,1);
  const warm=g.warmth;g.state='paused';g.update(10);assert.equal(g.warmth,warm);
});
test('each checkpoint has safe access to fresh fuel and keeps earlier lamps',()=>{
  for(const checkpoint of LANTERN.checkpoints){const {g,events}=runLantern({checkpoint});assert.equal(g.state,'won');assert.equal(g.litLamps.size,3);assert.equal(events.filter(e=>e.type==='hit').length,0);}
  const g=new Runner(LANTERN);g.checkpoint=22000;g.warmth=9;g.restoreCheckpoint(true);assert.equal(g.warmth,0);assert.deepEqual([...g.litLamps],['lamp-0','lamp-1']);
});
test('all necessary discoveries unlock without optional memories',()=>{
  const {g,events}=runLantern(),n=new Narrative(),encounter=new Encounter();n.unlock('b0',false);
  for(const e of events)if(e.type==='flag'){n.event(e.event);if(encounter.begin(e.event)){const before=JSON.stringify({x:g.x,time:g.elapsed,health:g.health,warmth:g.warmth});while(encounter.active)encounter.next();assert.equal(JSON.stringify({x:g.x,time:g.elapsed,health:g.health,warmth:g.warmth}),before);}}
  n.event('lantern-complete');for(let i=0;i<6;i++)assert.ok(n.unlocked.has('b'+i));assert.ok(!n.unlocked.has('br0'));
});
test('chapter two checkpoint save can be restored with lamp state derived from the route',()=>{
  const data=new Map(),store=new ProgressStore({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});
  const g=new Runner(LANTERN);g.checkpoint=22000;g.restoreCheckpoint(true);store.save(g);
  const restored=new Runner(LANTERN);store.restore(restored,store.load(LANTERN));assert.equal(restored.x,22000);assert.equal(restored.warmth,0);assert.deepEqual([...restored.litLamps],['lamp-0','lamp-1']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { COVENANT } from '../src/level-covenant.js';
import { DISTRICT, NORTH_BANK } from '../src/level-district.js';
import { LEVELS, validateLevel } from '../src/level.js';
import { Runner } from '../src/physics.js';
import { Narrative } from '../src/narrative.js';
import { CHAPTER_STORIES, INTERMISSION_PANELS } from '../src/chapter-scenes.js';
import { routeInput } from './runner-input.mjs';

export function runCovenant(checkpoint=0){
  const g=new Runner(COVENANT),events=[],landings=[],state={handled:new Set(),doubleAt:null};
  if(checkpoint){g.checkpoint=checkpoint;g.restoreCheckpoint(true);for(const o of COVENANT.obstacles)if(o.x<checkpoint)state.handled.add(o.id);}
  for(let i=0;i<120*230&&g.state==='running';i++){
    routeInput(g,state);g.update(1/120);
    for(const e of g.drainEvents()){events.push(e);if(e.type==='land'&&g.platformAt(g.x))landings.push(g.platformAt(g.x).id);}
  }
  return {g,events,landings};
}
test('published acts end cleanly; the north bank is an illustrated intermission',()=>{
  assert.equal(LEVELS.district,DISTRICT);assert.equal(LEVELS.covenant,COVENANT);assert.equal(LEVELS.lantern,undefined);
  assert.equal(DISTRICT.world.end,NORTH_BANK);assert.equal(DISTRICT.lamps,undefined);assert.equal(INTERMISSION_PANELS.length,5);
  assert.equal(CHAPTER_STORIES.district.interlude,undefined);assert.equal(CHAPTER_STORIES.district.ending.length,3);
  assert.deepEqual(validateLevel(COVENANT),[]);assert.equal(CHAPTER_STORIES.covenant.opening.length,2);assert.equal(CHAPTER_STORIES.covenant.ending.length,2);
});
test('act two is completable without damage and really lands on both temporary platforms',()=>{
  const {g,events,landings}=runCovenant();
  assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);
  assert.deepEqual(events.filter(e=>e.type==='hit'),[]);assert.deepEqual(landings,['dream-1','dream-2']);
  assert.equal(events.filter(e=>e.type==='chain-impact'&&e.connected).length,3);assert.equal(g.boss.hits,3);assert.equal(g.boss.ward,false);
  assert.ok(g.elapsed>135&&g.elapsed<160);
});
test('each act two checkpoint offers a fresh no-damage route through its remaining mechanics',()=>{
  for(const cp of COVENANT.checkpoints){const {g,events}=runCovenant(cp);assert.equal(g.state,'won',`cp ${cp}`);assert.equal(g.respawns,cp?1:0);assert.deepEqual(events.filter(e=>e.type==='hit'),[],`cp ${cp}`);}
});
test('wind changes actual airborne displacement and cannot accelerate grounded movement',()=>{
  const a=new Runner(COVENANT),b=new Runner({...COVENANT,windZones:[]});
  for(const g of [a,b]){g.x=2900;g.y=606;g.jump();for(let i=0;i<60;i++)g.update(1/120);}
  assert.ok(a.x>b.x+40);assert.ok(a.y<b.y-40);
  const c=new Runner(COVENANT);c.x=2900;c.update(.1);assert.equal(c.x,2933);
});
test('high water sends rushing players to shore; braking waits while the tide moves',()=>{
  const g=new Runner(COVENANT),z=COVENANT.tidalChannels[0];g.checkpoint=15000;g.restoreCheckpoint(true);g.x=z.x-80;g.elapsed=4;
  g.setBrake(true);const x=g.x;for(let i=0;i<120;i++)g.update(1/120);assert.equal(g.x,x);assert.ok(g.elapsed>4.9);
  g.setBrake(false);for(let i=0;i<30;i++)g.update(1/120);assert.equal(g.health,2);assert.ok(g.x<15100);
});
test('wood supports first landing, collapses only after contact, and resets on retry',()=>{
  const g=new Runner(COVENANT),p=COVENANT.platforms[0];g.checkpoint=30000;g.restoreCheckpoint(true);
  g.x=p.x-200;g.setBrake(true);for(let i=0;i<600;i++)g.update(1/120);assert.ok(g.mechanismActive(p));assert.equal(g.mechanismStates.get(p.id).started,false);
  g.x=p.x+30;g.y=p.y;g.setBrake(true);for(let i=0;i<100;i++)g.update(1/120);assert.equal(g.mechanismStates.get(p.id).done,true);assert.equal(g.grounded,false);
  g.restoreCheckpoint(true);assert.ok(g.mechanismActive(p));assert.equal(g.mechanismStates.get(p.id).started,false);
});
test('pausing freezes water, chain targeting and collapse clocks',()=>{
  const g=new Runner(COVENANT);g.checkpoint=42000;g.restoreCheckpoint(true);for(let i=0;i<240;i++)g.update(1/120);
  g.state='paused';const before=JSON.stringify([g.elapsed,g.boss,[...g.mechanismStates],g.tidalState(COVENANT.tidalChannels[0])]);g.update(10);
  assert.equal(JSON.stringify([g.elapsed,g.boss,[...g.mechanismStates],g.tidalState(COVENANT.tidalChannels[0])]),before);
});
test('merely dodging cannot break chains; failed aim offers another attempt',()=>{
  const g=new Runner(COVENANT);g.checkpoint=42000;g.restoreCheckpoint(true);let misses=0;
  for(let i=0;i<120*45;i++){
    if(g.boss.phase==='impact'&&g.grounded&&.8-g.boss.age>.1&&.8-g.boss.age<.32)g.jump();
    g.update(1/120);for(const e of g.drainEvents())if(e.type==='chain-impact'&&!e.connected)misses++;
  }
  assert.ok(misses>=5);assert.equal(g.boss.hits,0);assert.equal(g.health,3);assert.equal(g.state,'running');
});
test('chain damage occurs at hammer impact, never on targeting or elapsed time alone',()=>{
  const g=new Runner(COVENANT);g.checkpoint=42000;g.restoreCheckpoint(true);const s={handled:new Set()};
  while(g.boss.phase!=='locked'){routeInput(g,s);g.update(1/120);}
  assert.equal(g.boss.hits,0);assert.ok(Math.abs(g.boss.targetX-g.boss.anchorX)<=55);
  g.setBrake(false);for(let i=0;i<100;i++)g.update(1/120);assert.equal(g.boss.hits,0);
  for(let i=0;i<22;i++)g.update(1/120);assert.equal(g.boss.hits,1);assert.equal(g.health,3);
  g.restoreCheckpoint(true);assert.equal(g.boss.hits,0);assert.equal(g.braking,false);
});
test('all act two discoveries come from the route and ending without optional resonance',()=>{
  const {events}=runCovenant(),n=new Narrative();n.unlock('c0',false);
  for(const e of events)if(e.type==='flag')n.event(e.event);n.event('covenant-sword');n.event('covenant-complete');
  for(let i=0;i<9;i++)assert.ok(n.unlocked.has('c'+i));assert.ok(!n.unlocked.has('cr0'));
});
test('mechanism validation rejects missing landings and unreadable timings',()=>{
  assert.ok(validateLevel({...COVENANT,platforms:[]}).some(p=>p.includes('踏板')));
  assert.ok(validateLevel({...COVENANT,tides:[{...COVENANT.tides[0],warning:0}]}).some(p=>p.includes('预警')));
  assert.ok(validateLevel({...COVENANT,platforms:[{...COVENANT.platforms[0],life:.3}]}).some(p=>p.includes('踏板')));
});

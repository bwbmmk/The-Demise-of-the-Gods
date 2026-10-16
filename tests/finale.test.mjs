import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../src/physics.js';
import {FINALE,FINAL_BOSS_PRACTICE} from '../src/level-finale.js';
import {DAWN} from '../src/level-dawn.js';
import {validateLevel} from '../src/level.js';
import {FINAL_CHOICES,FINAL_ENDINGS} from '../src/story-finale.js';
import {CHAPTER_STORIES,INTERMISSION_PANELS} from '../src/chapter-scenes.js';
import {ALL_ENTRIES} from '../src/narrative.js';
import {ProgressStore,COMPLETION_KEY,PROGRESS_KEY} from '../src/progress.js';
import {DISTRICT_ENCOUNTERS} from '../src/narrative-act1.js';
import {COVENANT_ENCOUNTERS} from '../src/narrative-covenant.js';
import {FATE_ENCOUNTERS} from '../src/narrative-fate.js';
import {DAWN_ENCOUNTERS} from '../src/narrative-dawn.js';
import {routeInput} from './runner-input.mjs';

function until(g,condition,max=180){const input={handled:new Set(),doubleAt:null};for(let i=0;i<max*120&&!condition(g)&&g.state!=='dead';i++){routeInput(g,input);g.update(1/120);g.drainEvents();}return g;}
function gate(cp=0){const g=new Runner(FINALE);g.checkpoint=cp;g.restoreCheckpoint(true);g.respawns=0;until(g,g=>g.state==='choosing');return g;}
test('all final-act checkpoints reach an explicit choice with no damage and without opening the gate',()=>{
  assert.deepEqual(validateLevel(FINALE),[]);assert.deepEqual(validateLevel(FINAL_BOSS_PRACTICE),[]);
  for(const cp of FINALE.checkpoints){const g=gate(cp);assert.equal(g.state,'choosing');assert.equal(g.health,3);assert.equal(g.respawns,0);assert.equal(g.doorOpen,false);assert.equal(g.finalChoice,null);assert.equal(g.finalDuel.phase,'idle');}
});
test('the three choices are available with zero collection; only the good path requires the final duel',()=>{
  assert.deepEqual(FINAL_CHOICES.map(c=>c.id),['throne','night','embers']);
  for(const id of ['throne','night','embers']){
    const g=gate(10400);g.collected.clear();g.rings.clear();assert.equal(g.chooseFinalPath(id),true);assert.equal(g.chooseFinalPath(id),false);
    assert.equal(g.doorOpen,id!=='throne');assert.equal(g.finalChoice,id);
    if(id==='embers'){assert.equal(g.state,'running');until(g,g=>g.state==='won');assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.finalDuel.hits,9);}
    else{assert.equal(g.state,'won');assert.equal(g.finalDuel.hits,0);}
  }
});
test('only a chosen and completed ending can be recorded; gate and combat retry reset choice and attacks',()=>{
  const g=gate(10400);assert.equal(g.flag.has('ending-embers'),false);
  g.chooseFinalPath('embers');for(let i=0;i<120;i++)g.update(1/120);
  g.restoreCheckpoint(true);assert.equal(g.finalChoice,null);assert.equal(g.doorOpen,false);assert.equal(g.finalDuel.phase,'idle');assert.equal(g.finalDuel.entities.length,0);assert.equal(g.flag.has('ending-embers'),false);
  until(g,g=>g.state==='choosing');g.chooseFinalPath('night');assert.ok(g.flag.has('ending-night'));assert.equal(g.flag.has('ending-throne'),false);
});
test('final duel practice starts at the actual arena, completes without damage, and requires hold then release',()=>{
  const g=new Runner(FINAL_BOSS_PRACTICE);g.x=g.prevX=11000;g.y=g.prevY=606;until(g,g=>g.state==='won');assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.finalDuel.hits,9);assert.ok(g.elapsed>85&&g.elapsed<130);
  const avoid=new Runner(FINAL_BOSS_PRACTICE);avoid.x=avoid.prevX=11000;avoid.y=606;
  const input={handled:new Set(),doubleAt:null};for(let i=0;i<120*24&&avoid.state==='running';i++){routeInput(avoid,input);avoid.finalDuel.setHeld(false);avoid.update(1/120);}
  assert.equal(avoid.finalDuel.hits,0,'dodging alone cannot win');
});
test('holding a caught memory too long overloads; missing one grants another opportunity',()=>{
  const g=new Runner(FINAL_BOSS_PRACTICE);g.x=g.prevX=11000;g.y=606;g.finalDuel.phase='holding';g.finalDuel.orb={x:g.x,y:570};g.finalDuel.held=true;
  for(let i=0;i<200;i++){g.finalDuel.setHeld(true);g.update(1/120);}
  assert.equal(g.health,2);assert.equal(g.finalDuel.hits,0);
  const retry=new Runner(FINAL_BOSS_PRACTICE);retry.x=retry.prevX=11000;retry.y=606;
  let missed=false;const input={handled:new Set(),doubleAt:null};
  for(let i=0;i<120*160&&retry.state==='running';i++){
    routeInput(retry,input);if(!missed)retry.finalDuel.setHeld(false);retry.update(1/120);
    for(const e of retry.drainEvents())if(e.type==='final-memory-missed')missed=true;
  }
  assert.ok(missed);assert.equal(retry.state,'won');assert.equal(retry.health,3);
});
test('completed collection remains available for later-act hearts after the active checkpoint is cleared',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const store=new ProgressStore(storage),g=new Runner(DAWN);
  g.collected=new Set(DAWN.shards.map(s=>s.id));g.state='won';store.complete(g);
  assert.ok(data.has(COMPLETION_KEY));assert.equal(store.load(DAWN),null);assert.ok(store.tallyHearts(['dawn']).total>0);
  const snapshot=data.get(COMPLETION_KEY);g.level={...DAWN,previewOnly:true};store.complete(g);store.save(g);assert.equal(data.get(COMPLETION_KEY),snapshot);assert.deepEqual(JSON.parse(data.get(PROGRESS_KEY)).levels,{});
});
test('all existing published story text remains exactly equal to the baseline',()=>{
  const baseline=JSON.parse(readFileSync(new URL('./fixtures/published-copy-0.13.0.json',import.meta.url),'utf8'));
  for(const [id,story] of Object.entries(baseline.stories))assert.deepEqual(CHAPTER_STORIES[id],story,id);
  assert.deepEqual(INTERMISSION_PANELS,baseline.intermission);
  assert.deepEqual(ALL_ENTRIES.slice(0,baseline.entries.length).filter(e=>e.id!=='w6'),baseline.entries.filter(e=>e.id!=='w6'));
  assert.deepEqual([DISTRICT_ENCOUNTERS,COVENANT_ENCOUNTERS,FATE_ENCOUNTERS],baseline.encounters.slice(0,3));
  const all=JSON.stringify(FINAL_ENDINGS);assert.match(all,/自愿交/);assert.match(all,/找回.*过去的力量/);assert.match(all,/献祭.*自身/);assert.match(all,/逐渐走向灭亡/);
});

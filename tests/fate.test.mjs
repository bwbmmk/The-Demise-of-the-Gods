import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../src/physics.js';
import {validateLevel} from '../src/level.js';
import {FATE} from '../src/level-fate.js';
import {FATE_ENTRIES,FATE_ENCOUNTERS} from '../src/narrative-fate.js';
import {Narrative} from '../src/narrative.js';
import {Encounter} from '../src/narrative-act1.js';
import {ProgressStore} from '../src/progress.js';
import {STORY_REELS} from '../src/story-theater.js';
import {STORY_PANELS} from '../src/story.js';
import {Renderer} from '../src/renderer.js';
import {routeInput} from './runner-input.mjs';

function runFate(g,input={handled:new Set(),doubleAt:null}){
  const events=[],landings=new Set(),switches=[];let last=g.echoLight;
  for(let i=0;i<120*150&&g.state==='running';i++){
    routeInput(g,input);if(last!==g.echoLight){switches.push(g.x);last=g.echoLight;}
    g.update(1/120);events.push(...g.drainEvents());
    const p=g.platformAt(g.x);if(g.grounded&&p)landings.add(p.id);
  }
  return {events,landings,switches};
}
function checkpointRunner(cp){
  const g=new Runner(FATE);g.checkpoint=cp;
  g.checkpointFlags=new Set(FATE.flags.filter(f=>!f.manual&&f.x<cp).map(f=>f.id));
  g.checkpointItems=new Set(FATE.items.filter(i=>i.x<cp).map(i=>i.id));g.restoreCheckpoint(true);g.respawns=0;return g;
}

test('third act adds usable light bridges, single then double memory walls and three real rescues',()=>{
  assert.deepEqual(validateLevel(FATE),[]);assert.equal(FATE.boss,undefined);
  const g=new Runner(FATE),r=runFate(g);
  assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);assert.equal(g.savedPeople,3);
  assert.ok(g.elapsed>120&&g.elapsed<130);assert.ok(r.landings.size>=21);
  assert.equal(r.events.filter(e=>e.type==='rescue').length,3);assert.equal(r.events.filter(e=>e.event==='fate-sacrifice').length,1);
  assert.ok(r.switches.length>=25);assert.ok(!r.events.some(e=>e.type==='hit'));
});
test('all third-act checkpoints offer fresh no-damage completion with the correct banked evidence',()=>{
  for(const cp of FATE.checkpoints){const g=checkpointRunner(cp);runFate(g);assert.equal(g.state,'won',String(cp));assert.equal(g.health,3,String(cp));assert.equal(g.savedPeople,3);assert.equal(g.respawns,0);}
});
test('both constant darkness and constant light fail: the new mechanic changes route decisions',()=>{
  const dark=new Runner(FATE);dark.x=2400;dark.y=531;dark.grounded=true;dark.update(1/120);assert.equal(dark.grounded,false);
  const lit=new Runner(FATE);lit.setEcho(true);lit.x=FATE.echoWalls[0].x;lit.y=430;lit.grounded=false;lit.update(1/120);assert.equal(lit.health,2);
  const unlit=new Runner(FATE);unlit.x=FATE.echoWalls[0].x;unlit.y=430;unlit.grounded=false;unlit.update(1/120);assert.equal(unlit.health,3);
  assert.equal(lit.platformAt(FATE.echoPlatforms[0].x).id,FATE.echoPlatforms[0].id);
  assert.equal(unlit.platformAt(FATE.echoPlatforms[0].x),undefined);
});
test('rescue waits for actual held-light input; walking past and reading do not spend the memory ember',()=>{
  const g=checkpointRunner(31000);g.x=31439;g.prevX=g.x;
  for(let i=0;i<240;i++)g.update(1/120);
  assert.equal(g.x,31440);assert.equal(g.savedPeople,0);assert.equal(g.greyFront,null);assert.ok(!g.flag.has('ember-spent'));
  g.setEcho(true);for(let i=0;i<60;i++)g.update(1/120);assert.ok(g.rescueProgress>0);assert.equal(g.savedPeople,0);
  g.setEcho(false);for(let i=0;i<60;i++)g.update(1/120);assert.equal(g.rescueProgress,0);
  g.setEcho(true);for(let i=0;i<133;i++)g.update(1/120);assert.equal(g.savedPeople,1);assert.ok(g.flag.has('ember-spent'));assert.ok(g.greyFront<g.x);
});
test('gray tide is a real pursuit, freezing and restoring only at actual checkpoints',()=>{
  const g=checkpointRunner(31000);g.x=31440;g.setEcho(true);for(let i=0;i<133;i++)g.update(1/120);
  g.setBrake(true);const front=g.greyFront;for(let i=0;i<60;i++)g.update(1/120);assert.ok(g.greyFront>front+159);
  g.state='paused';const before=JSON.stringify([g.x,g.elapsed,g.chaseAge,g.rescueProgress,[...g.flag]]);g.update(1);assert.equal(JSON.stringify([g.x,g.elapsed,g.chaseAge,g.rescueProgress,[...g.flag]]),before);
  g.state='running';for(let i=0;i<300&&g.respawns===0;i++)g.update(1/120);assert.equal(g.respawns,1);assert.equal(g.health,2);assert.equal(g.savedPeople,0);assert.equal(g.greyFront,null);
  assert.ok(g.items.has('memory-ember'));assert.ok(g.flag.has('f-lock'));assert.ok(!g.flag.has('ember-spent'));
});
test('third-act saves resume the final route with its ember and evidence, without premature rescued flags',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},store=new ProgressStore(storage),g=checkpointRunner(31000);
  store.save(g);const data=store.load(FATE);assert.ok(data);const restored=new Runner(FATE);store.restore(restored,data);
  assert.equal(restored.x,31000);assert.ok(restored.items.has('memory-ember'));assert.ok(restored.flag.has('f-lock'));assert.equal(restored.savedPeople,0);
  runFate(restored);assert.equal(restored.health,3);assert.equal(restored.state,'won');
});
test('route evidence tells the voluntary choices in order; no optional resonance unlock is needed',()=>{
  const g=new Runner(FATE),r=runFate(g),n=new Narrative(),enc=new Encounter();n.event('fate-enter');
  for(const e of r.events)if(e.type==='flag'||e.type==='item'){n.event(e.event);if(enc.begin(e.event))n.unlock(enc.finish().entry,false);}
  assert.ok(!n.unlocked.has('f10'));n.event('fate-complete');
  assert.ok(FATE_ENTRIES.every(e=>n.unlocked.has(e.id)));assert.ok(!n.unlocked.has('fr0'));
  const order=r.events.filter(e=>e.type==='flag').map(e=>e.event);
  assert.ok(order.indexOf('fate-war')<order.indexOf('fate-close'));assert.ok(order.indexOf('fate-close')<order.indexOf('fate-sun'));assert.ok(order.indexOf('fate-sun')<order.indexOf('fate-pyre'));
  assert.match(FATE_ENTRIES.find(e=>e.id==='f3').body,/知道.*选择关门/);
  assert.match(FATE_ENTRIES.find(e=>e.id==='f4').body,/从背后.*没有被控制.*没有.*幻觉/);
  assert.match(FATE_ENTRIES.find(e=>e.id==='f5').body,/主动|当时不肯再面对/);
  assert.match(FATE_ENTRIES.find(e=>e.id==='f7').body,/没有说原谅.*另外三个人/);
  assert.match(FATE_ENTRIES.find(e=>e.id==='f9').body,/这一次.*机会.*用掉.*门后的记忆仍在/);
});
test('pure-story third act reuses all seven encounters and keeps the final two acts out of the reader',()=>{
  const reel=STORY_REELS.find(r=>r.id==='fate');for(const encounter of Object.values(FATE_ENCOUNTERS)){
    const pages=reel.pages.filter(p=>p.kind==='dialogue'&&p.recordIds.includes(encounter.entry));assert.deepEqual(pages.map(p=>p.body),encounter.pages.map(p=>p.text));
  }
  assert.ok(!STORY_REELS.some(r=>r.id==='sleep'));
});
test('opening restores original epic headings and main-menu copy without the outdated remembered promise',()=>{
  assert.equal(STORY_PANELS[0].title,'人们献出记忆，\n换来白昼。');assert.equal(STORY_PANELS[3].title,'为逝去的神，\n走完最后一程。');
  assert.doesNotMatch(JSON.stringify(STORY_PANELS),/还记得一个承诺|弑日者|我关了门/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/众神已死，长夜未尽。<br>你是最后的送葬者。<br>带着一颗尚未熄灭的神之心，跑向世界尽头。/);
});
test('fate landmarks never copy the three bridge helpers and Miya stops appearing after the parting',()=>{
  const renderer=Object.create(Renderer.prototype),actors=[],c=new Proxy({},{get:()=>()=>{}});
  renderer.view={level:FATE,groundAt:()=>606};renderer.npc=(ctx,x,y,kind)=>actors.push(kind);renderer.mia=()=>actors.push('mia');
  const g=new Runner(FATE);renderer.landmarks(c,0,1440,0,g);assert.deepEqual(actors,['bell','mia']);
  actors.length=0;g.flag.add('f-miya');renderer.landmarks(c,29000,1440,0,g);assert.deepEqual(actors,['bell']);
  actors.length=0;renderer.landmarks(c,12400,1440,0,g);assert.deepEqual(actors,[]);
});

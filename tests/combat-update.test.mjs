import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/physics.js';
import {Renderer} from '../src/renderer.js';
import {COVENANT_BOSS_PRACTICE} from '../src/level-covenant.js';
import {BOSS_PRACTICE} from '../src/level-district.js';
import {placeInBossArena} from '../src/boss-channels.js';
import {CombatHints} from '../src/combat-hints.js';
import {bossInput,routeInput} from './runner-input.mjs';

test('giant combines two new projectile attacks with five waves and still has a clean route',()=>{
  const g=placeInBossArena(new Runner(COVENANT_BOSS_PRACTICE)),events=[],input={handled:new Set()};
  for(let i=0;i<120*60&&g.state==='running';i++){routeInput(g,input);g.update(1/120);events.push(...g.drainEvents());}
  assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);
  assert.deepEqual(events.filter(e=>e.type==='boss-cast').map(e=>e.kind),['low','high']);
  assert.deepEqual(events.filter(e=>e.type==='chain-wave').map(e=>e.height),[45,45,60,45,140]);
  assert.equal(events.filter(e=>e.type==='chain-impact'&&e.connected).length,3);
});
test('giant low blade needs jumping and the high curtain needs sliding, not jumping',()=>{
  for(const [index,actions] of [[1,[['stand',2],['jump',3],['slide',2]]],[2,[['stand',2],['jump',2],['slide',3]]]])for(const [action,hp] of actions){
    const g=placeInBossArena(new Runner(COVENANT_BOSS_PRACTICE));Object.assign(g.boss,{phase:'guard',age:.99,patternIndex:index,hits:index,charged:false});
    let acted=false;
    for(let i=0;i<90;i++){
      const shot=g.bossShots[0];
      if(!acted&&shot&&shot.x-g.x<(365+shot.speed)*.23){if(action!=='stand')g[action]();acted=true;}
      g.update(1/120);
    }
    assert.equal(g.health,hp,`round ${index}: ${action}`);
  }
});
test('final high wave requires the second airborne jump and is not passed by repeating single jumps',()=>{
  for(const double of [false,true]){
    const g=placeInBossArena(new Runner(COVENANT_BOSS_PRACTICE));Object.assign(g.boss,{phase:'impact',age:0,patternIndex:2,hits:3,connected:true});
    for(let i=0;i<120*3&&g.state==='running';i++){const action=bossInput(g);if(action&&(double||g.grounded))g[action]();g.update(1/120);}
    assert.equal(g.health,double?3:2);assert.equal(g.state,'won');
  }
});
test('officer regrows his shield at relic impact and keeps it through recovery, charge and volley',()=>{
  const g=placeInBossArena(new Runner(BOSS_PRACTICE));
  for(let i=0;i<120*30&&g.boss.phase!=='counter';i++){const a=bossInput(g);if(a)g[a]();g.update(1/120);g.drainEvents();}
  assert.equal(g.boss.phase,'counter');assert.equal(g.boss.stunned,true);
  while(g.boss.phase==='counter')g.update(1/120);
  assert.equal(g.boss.phase,'recover');assert.equal(g.boss.stunned,false);assert.equal(g.boss.shieldAge,0);
  assert.equal(g.drainEvents().filter(e=>e.type==='boss-shield').length,1);
  const visited=new Set();
  while(g.boss.phase!=='shield'){visited.add(g.boss.phase);assert.equal(g.boss.stunned,false);const a=bossInput(g);if(a)g[a]();g.update(1/120);}
  assert.deepEqual([...visited],['recover','charge','volley']);assert.ok(g.boss.shieldAge>4);
  while(!g.boss.stunned)g.update(1/120);
  assert.equal(g.boss.phase,'shield');assert.equal(g.drainEvents().filter(e=>e.type==='boss-broken').length,1);
});
test('attack teaching is shown once per type across retries and replays; reading the timer is inert',()=>{
  const hints=new CombatHints();assert.equal(hints.show('fall',10),true);
  const first=hints.current(10);assert.equal(hints.show('fall',11),false);assert.equal(hints.current(12),first);
  assert.equal(hints.current(14),null);hints.clearActive();assert.equal(hints.show('fall',0),false);
  assert.equal(hints.show('high',0),true);assert.equal(hints.seen.size,2);
});
function renderContext(run){
  const old=globalThis.window;globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  const gradient={addColorStop(){}},paths=[];
  const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,
    moveTo(x,y){this.lastMove=[x,y];},quadraticCurveTo(...args){paths.push([this.lastMove,...args]);}},
    {get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const r=new Renderer({getContext:()=>ctx,getBoundingClientRect:()=>({width:1440,height:810})});
  try{run(r,ctx,paths);}finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}
}
test('rendered chain begins at the active lock socket for all three rounds and keeps it on impact',()=>{
  renderContext((r,c,paths)=>{
    const g=placeInBossArena(new Runner(COVENANT_BOSS_PRACTICE));r.view=r.viewFor(g);
    for(let index=0;index<3;index++)for(const phase of ['aim','impact'])for(const camera of [42000,42016]){
      Object.assign(g.boss,{phase,patternIndex:index,hits:index+(phase==='impact'?1:0),connected:phase==='impact',x:43000,anchorX:42600,targetX:42600,age:0});
      paths.length=0;r.chainWarden(c,camera,1440,0,g);
      assert.deepEqual(paths[0][0],[43000-camera-52+index*52,360]);
      assert.deepEqual(paths[0].slice(-2),[42600-camera,589]);
    }
  });
});
test('consuming Han’s ward disconnects its rendered tether and no idle rope replaces that line',()=>{
  renderContext((r,c,paths)=>{
    const g=placeInBossArena(new Runner(BOSS_PRACTICE));g.update(1/120);r.view=r.viewFor(g);
    r.bossStations(c,39500,1440,0,g);assert.equal(paths.length,1);
    g.hurt();assert.equal(g.boss.ward,false);paths.length=0;r.bossStations(c,39500,1440,0,g);assert.equal(paths.length,0);
  });
});

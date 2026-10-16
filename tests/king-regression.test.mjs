import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/physics.js';
import {DAWN_BOSS_PRACTICE} from '../src/level-dawn.js';
import {routeInput} from './runner-input.mjs';
import {Renderer} from '../src/renderer.js';

function arena(){
  const g=new Runner(DAWN_BOSS_PRACTICE);
  g.checkpoint=4600;g.restoreCheckpoint(true);
  g.x=g.prevX=4900;g.y=g.prevY=g.groundAt(g.x);g.grounded=true;g.braking=true;
  g.invulnerable=0;g.dawn.phase='charge';g.dawn.x=g.x+520;g.drainEvents();
  return g;
}

test('all king windups are harmless, frozen geometry with full lifetime after arming',()=>{
  for(const id of Object.keys(DAWN_BOSS_PRACTICE.dawn.moves).filter(id=>id!=='hammer')){
    const g=arena();g.dawn.chain=[id];g.dawnStartNextInChain(g.level.dawn);
    const entities=JSON.stringify(g.dawnEntities);
    for(let i=0;i<100;i++){g.updateDawnBoss(1/120);g.updateDawnEntities(1/120);}
    assert.equal(g.health,3,id);
    assert.equal(JSON.stringify(g.dawnEntities),entities,id+' warning must not move or expire');
    assert.ok(g.dawnAimLeft>.2&&g.dawnAimLeft<.23);
    for(let i=0;i<28;i++){g.updateDawnBoss(1/120);g.updateDawnEntities(1/120);}
    assert.equal(g.dawn.phase,'impact');
    assert.ok(g.dawnEntities.every(e=>!e.telegraph&&e.age<.03),id);
  }
});

function impactHealth(id,action){
  const g=arena();g.dawn.phase='impact';g.dawn.move=id;
  g.dawnFireMove(g.level.dawn,id,false);
  // Stationary player reads and reacts to the actual visible moving body.
  for(let i=0;i<360;i++){
    const shot=g.dawnEntities[0];
    if(shot){
      const d=shot.x-g.x;
      if(action==='slide'&&d<145&&d>0&&g.grounded&&!g.slideTime)g.slide();
      if((action==='jump'||action==='double')&&d<200&&d>0&&g.grounded)g.jump();
      if(action==='double'&&d<115&&d>0&&g.jumpsLeft===1&&g.vy>-350)g.jump();
    }
    // Keep only this attack; do not permit the encounter to start a second cast.
    g.x=g.prevX=4900;g.dawn.phase='impact';g.dawn.age=0;g.update(1/120);g.drainEvents();
  }
  return g.health;
}

test('king hitboxes require distinct answers rather than blanket airborne or slide immunity',()=>{
  assert.equal(impactHealth('quake','none'),2);
  assert.equal(impactHealth('quake','slide'),2,'sliding into ground fire hurts');
  assert.equal(impactHealth('sweep','none'),2);
  assert.equal(impactHealth('sweep','slide'),3);
  assert.equal(impactHealth('sweep','jump'),2,'high blade covers the jumping body');
  assert.equal(impactHealth('pulse','jump'),2,'one jump cannot clear the tall wave');
  assert.equal(impactHealth('pulse','double'),3);
});

test('hammer locks only after tracking, misses do not break a remote wedge, and retries are possible',()=>{
 const g=arena();g.dawn.chain=['hammer'];g.dawnStartNextInChain(g.level.dawn);
 for(let i=0;i<40;i++){g.x+=1;g.updateDawnBoss(1/120);}const e=g.dawnEntities[0];assert.equal(e.x,g.x);assert.equal(e.locked,false);
 for(let i=0;i<40;i++)g.updateDawnBoss(1/120);assert.equal(e.locked,true);const locked=e.x;g.x-=200;
 for(let i=0;i<180;i++){g.updateDawnBoss(1/120);g.updateDawnEntities(1/120);}
 assert.equal(e.x,locked);assert.equal(g.dawn.broken.size,0);assert.equal(g.health,3);
 const r=arena(),input={handled:new Set()};for(let i=0;i<120*100&&r.state==='running';i++){routeInput(r,input);r.update(1/120);}assert.equal(r.state,'won');assert.equal(r.health,3);
});

test('identical king inputs produce identical state and bounded entities; defeat clears hazards',()=>{
  const play=()=>{
    const g=arena(),input={handled:new Set(),doubleAt:null};let peak=0;const casts=[];
    for(let i=0;i<120*100&&g.state==='running';i++){
      routeInput(g,input);g.update(1/120);peak=Math.max(peak,g.dawnEntities.length);
      for(const e of g.drainEvents())if(e.type==='dawn-move')casts.push(e.move);
    }
    assert.equal(g.state,'won');assert.equal(g.health,3);assert.ok(peak<=3);
    assert.equal(g.dawnEntities.length,0);
    assert.deepEqual(casts,['quake','hammer','sweep','hammer','pulse','stomp','hammer']);
    return JSON.stringify({elapsed:g.elapsed,health:g.health,broken:[...g.dawn.broken],casts});
  };
  assert.equal(play(),play());
});

test('king bodies remain visible during impact and wedge guidance has finite world coordinates',()=>{
  const before=globalThis.window;
  globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  const calls=[],gradient={addColorStop(){}};
  const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:(...args)=>{
    for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(k));
    calls.push([k,...args]);
  }});
  try{
    const renderer=new Renderer({getContext:()=>ctx,getBoundingClientRect:()=>({width:1280,height:720})});
    const g=arena();renderer.view={level:g.level,groundAt:x=>g.groundAt(x)};
    for(const move of Object.keys(g.level.dawn.moves)){
      g.dawnEntities=[];g.dawn.move=move;g.dawn.phase='impact';g.dawnFireMove(g.level.dawn,move,false);
      calls.length=0;renderer.dawnKing(ctx,4600,1280,0,g);
      const withAttack=calls.length;
      g.dawnEntities=[];calls.length=0;renderer.dawnKing(ctx,4600,1280,0,g);
      assert.ok(withAttack>calls.length,move+' active attack must be rendered');
    }
  }finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}
});
test('fourth-act moving bodies follow their caster during warning and cannot damage before release',()=>{
 const g=arena();g.dawn.chain=['pulse'];g.dawnStartNextInChain(g.level.dawn);g.braking=false;
 for(let i=0;i<100;i++){g.update(1/120);assert.equal(g.health,3);assert.equal(g.dawnEntities[0].x,g.x+520);}
 assert.ok(g.dawnAimLeft>.2);
});

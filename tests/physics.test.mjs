import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, playerBounds, intersects } from '../src/physics.js';
import { WORLD, OBSTACLES, SHARDS, SPRINGS, RINGS, groundAt, hazardBounds } from '../src/level.js';

const advance=(game,seconds)=>{for(let i=0;i<seconds*120;i++)game.update(1/120);};
test('first jump, double jump, no third jump, and landing recharge',()=>{
  const game=new Runner();game.jump();assert.equal(game.jumpsLeft,1);assert.ok(game.vy<0);
  advance(game,.2);const firstY=game.y;game.jump();assert.equal(game.jumpsLeft,0);
  advance(game,.2);assert.ok(game.y<firstY);const vy=game.vy;game.jump();assert.equal(game.vy,vy);
  advance(game,1);assert.equal(game.grounded,true);assert.equal(game.jumpsLeft,2);
});
test('slide clears hanging beam, standing collides; slide expires',()=>{
  const beam=OBSTACLES.find(o=>o.type==='beam'),game=new Runner();game.x=beam.x+40;
  assert.ok(intersects(playerBounds(game),hazardBounds(beam)));game.slide();
  assert.equal(intersects(playerBounds(game),hazardBounds(beam)),false);
  advance(game,.45);assert.equal(game.health,3);advance(game,.4);assert.equal(game.slideTime,0);
});
test('damage protection avoids repeated damage from one obstacle',()=>{
  const game=new Runner();game.x=1590;advance(game,.28);assert.equal(game.health,2);
  assert.ok(game.invulnerable>0);game.hurt();assert.equal(game.health,2);
});
test('falling costs one health, restores checkpoint and rolls back unbanked shards',()=>{
  const game=new Runner();game.x=4050;game.collected.add('unbanked');advance(game,.8);
  assert.equal(game.health,2);assert.equal(game.respawns,1);assert.equal(game.collected.size,0);assert.ok(game.x<500);
});
test('checkpoint banks shards, heals one, and retry cannot farm shards',()=>{
  const game=new Runner();game.x=9199;game.health=1;game.collected.add(SHARDS[0].id);advance(game,.02);
  assert.equal(game.checkpoint,9200);assert.equal(game.health,2);
  game.collected.add('later');game.health=0;game.state='dead';game.restoreCheckpoint(true);
  assert.equal(game.health,3);assert.equal(game.x,9200);assert.equal(game.collected.size,1);assert.equal(game.state,'running');
});
test('coyote jump and landing input buffer tolerate edge timing',()=>{
  const game=new Runner();game.x=4002;game.update(1/120);assert.equal(game.grounded,false);
  game.jump();assert.equal(game.jumpsLeft,1);assert.equal(game.vy,WORLD.firstJump);
  const buffered=new Runner();buffered.y=WORLD.ground-8;buffered.grounded=false;buffered.coyote=0;buffered.jumpsLeft=0;buffered.vy=200;
  buffered.jump();advance(buffered,.06);assert.equal(buffered.grounded,false);assert.ok(buffered.vy<0);assert.equal(buffered.jumpsLeft,1);
});
test('air slide accelerates descent and queues a grounded slide',()=>{
  const game=new Runner();game.jump();advance(game,.15);game.slide();assert.ok(game.vy>=900);advance(game,.2);assert.ok(game.slideTime>0);assert.equal(game.grounded,true);
});
test('authored route can be completed without taking damage at 120Hz',()=>{
  const game=new Runner(),triggered=new Set();let doubleAt=null;
  for(let frame=0;frame<120*110&&game.state==='running';frame++) {
    const next=OBSTACLES.find(o=>!triggered.has(o.id)&&o.x>game.x-100);
    if(next) {
      const lead=next.type==='beam'?48:next.type==='gap'?30:100;
      if(game.x>=next.x-lead) {
        triggered.add(next.id);
        if(next.type==='beam')game.slide();else{game.jump();if(next.type==='gap'&&next.width>=280)doubleAt=game.elapsed+.38;}
      }
    }
    if(doubleAt!==null&&game.elapsed>=doubleAt){game.jump();doubleAt=null;}
    game.update(1/120);
    assert.equal(game.health,3,`damage at ${game.x.toFixed(0)}; events=${JSON.stringify(game.events.slice(-4))}`);
  }
  assert.equal(game.state,'won');assert.equal(game.respawns,0);assert.ok(game.collected.size>15);
});
test('slopes share collision height; running climbs and descending lands cleanly',()=>{
  const game=new Runner();game.x=9470;game.chapter=1;game.y=groundAt(game.x);
  advance(game,.65);assert.equal(game.y,groundAt(game.x));assert.ok(game.y<WORLD.ground);assert.equal(game.grounded,true);
  const descending=new Runner();descending.x=11240;descending.chapter=1;descending.y=groundAt(descending.x);descending.jump();advance(descending,.95);
  assert.equal(descending.grounded,true);assert.equal(descending.y,groundAt(descending.x));assert.equal(descending.health,3);
});
test('wind sigil launches only once per pass and leaves one air jump',()=>{
  const game=new Runner();game.x=SPRINGS[0].x-2;game.y=groundAt(game.x);game.update(1/120);
  assert.equal(game.grounded,false);assert.equal(game.jumpsLeft,1);assert.ok(game.vy< -700);assert.equal(game.usedSprings.size,1);
  game.jump();assert.equal(game.jumpsLeft,0);game.restoreCheckpoint();assert.equal(game.usedSprings.size,0);
});
test('resonance heals once; checkpoint banks rings and rolls back later rings',()=>{
  const game=new Runner(),ring=RINGS[0];game.x=ring.x;game.y=ring.y+36;game.grounded=false;game.health=1;game.coyote=0;
  game.update(1/120);assert.equal(game.health,2);assert.equal(game.rings.size,1);game.update(1/120);assert.equal(game.health,2);
  game.x=9199;game.y=WORLD.ground;game.grounded=true;game.update(1/120);assert.equal(game.checkpointRings.size,1);
  game.rings.add(RINGS[1].id);game.restoreCheckpoint();assert.equal(game.rings.size,1);
});
test('memory combo times out and is broken by damage',()=>{
  const game=new Runner();game.combo=5;game.comboTime=.02;advance(game,.03);assert.equal(game.combo,0);
  game.combo=4;game.comboTime=2;game.hurt();assert.equal(game.combo,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/physics.js';
import {FINAL_BOSS_PRACTICE} from '../src/level-finale.js';
import {DAWN_BOSS_PRACTICE} from '../src/level-dawn.js';
import {FINAL_PHASES,FinalDuel} from '../src/final-boss.js';
import {FINAL_ENDINGS} from '../src/story-finale.js';
import {routeInput} from './runner-input.mjs';
function arena(){const g=new Runner(FINAL_BOSS_PRACTICE);g.x=g.prevX=11000;g.y=g.prevY=606;return g;}
test('finale has three escalation thresholds, new spatial attacks and a no-damage route',()=>{
 const g=arena(),input={handled:new Set()},stages=[],seen=new Set();let lo=g.x,hi=g.x;
 for(let i=0;i<120*150&&g.state==='running';i++){
  routeInput(g,input);g.update(1/120);lo=Math.min(lo,g.x);hi=Math.max(hi,g.x);
  for(const e of g.drainEvents()){if(e.type==='final-phase')stages.push([e.stage,g.finalDuel.hits]);if(e.type==='final-cast')seen.add(e.attack);}
 }
 assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);assert.equal(g.finalDuel.hits,9);
 assert.deepEqual(stages,[[1,3],[2,6]]);assert.ok(hi-lo>65);assert.ok(seen.has('lance')&&seen.has('eruption'));
 assert.ok(FINAL_PHASES[2].speed>FINAL_PHASES[1].speed&&FINAL_PHASES[1].speed>FINAL_PHASES[0].speed);
 assert.ok(FINAL_PHASES.every(p=>p.warning>=.7));
 assert.equal(seen.size,13,'the full duel exercises thirteen distinct casts');
 for(const id of ['crossfire','hunt','sweepfire','edict','siege','cage','sunfall'])assert.ok(seen.has(id));
});

test('every lost health segment tightens telegraphs, casting gaps, recovery and projectile travel',()=>{
 const d=new FinalDuel();let previous=d.spec;
 for(let hits=1;hits<9;hits++){
  d.hits=hits;d.stage=Math.floor(hits/3);const next=d.spec;
  for(const key of ['warning','chargeGap','linkGap','recovery','fall'])assert.ok(next[key]<previous[key],key+' at '+hits);
  assert.ok(next.speed>previous.speed);assert.ok(next.warning>=.69);previous=next;
 }
 assert.ok(d.spec.chargeGap<=.17&&d.spec.linkGap<.08);
 assert.ok(FINAL_PHASES[2].plans.every(plan=>plan.length>=5));
 const durations=[0,4,8].map(hits=>{
  const g=arena(),duel=g.finalDuel;duel.hits=hits;duel.stage=Math.floor(hits/3);duel.startAttack(g,'low');duel.chain=['low'];
  let time=0;for(let i=0;i<120*8;i++){duel.update(g,1/120);time+=1/120;if(duel.attack==='low'&&duel.phase==='aim'&&duel.chain.length===0)break;}
  return time;
 });
 assert.ok(durations[0]>durations[1]&&durations[1]>durations[2],'actual repeat-cast interval shrinks, including travel and link time');
});
test('opposing blades move in both directions and a blade from behind actually hurts',()=>{
 const g=arena(),d=g.finalDuel;d.startAttack(g,'crossfire');d.phase='attack';
 const left=d.entities.find(e=>e.dir===1),right=d.entities.find(e=>e.dir===-1);
 assert.ok(left&&right);const a=left.x,b=right.x;
 for(const e of d.entities){e.age=e.delay+.01;e.warning=false;}d.update(g,1/120);
 assert.ok(left.x>a&&right.x<b);left.x=g.x;left.age=left.delay+.01;g.invulnerable=0;d.update(g,1/120);assert.equal(g.health,2);
});
test('later pursuit spears track independently then stay locked before their falling bodies activate',()=>{
 const g=arena(),d=g.finalDuel;d.startAttack(g,'hunt');d.phase='attack';
 const last=d.entities[2];g.x+=80;d.update(g,.1);assert.equal(last.x,g.x);assert.equal(last.warning,true);
 d.update(g,.72);const lock=last.x;g.x-=100;d.update(g,.08);assert.equal(last.x,lock);assert.equal(last.warning,true);
});
test('full arena royal edict requires a grounded slide; jumping cannot avoid it',()=>{
 for(const posture of ['standing','jumping','sliding']){
  const g=arena(),d=g.finalDuel;d.startAttack(g,'edict');d.phase='attack';
  if(posture==='jumping')g.y-=100;if(posture==='sliding')g.slideTime=.5;
  d.update(g,1/120);assert.equal(g.health,posture==='sliding'?3:2,posture);
 }
});
test('siege and cage combine spatial denial with a real moving blade, and delayed warnings do not hurt',()=>{
 for(const id of ['siege','cage','sunfall']){
  const g=arena(),d=g.finalDuel;d.startAttack(g,id);
  assert.ok(d.entities.some(e=>e.kind==='low'));assert.ok(d.entities.some(e=>!e.speed));
  for(let i=0;i<100;i++)d.update(g,1/120);assert.equal(g.health,3,'global telegraph '+id);
 }
 const g=arena(),d=g.finalDuel;d.startAttack(g,'sweepfire');d.phase='attack';
 const e=d.entities.find(e=>e.delay>.8);d.entities=[e];g.x=e.x;d.update(g,.1);assert.equal(g.health,3);assert.equal(e.warning,true);
});
test('waves leave no fixed lifetime wait after clearing the arena',()=>{
 // 波形的出场边界跟着场地走，所以这里也从 d.left 派生，
 // 别再写死 arena-330——场地一改它就会正好卡在新边界上而"测不出场"。
 const g=arena(),d=g.finalDuel;d.startAttack(g,'low');d.phase='attack';d.entities[0].x=d.left-80;
 d.update(g,1/120);assert.equal(d.entities.length,0);assert.equal(d.phase,'recall');
});
test('falling fire collides in the air, while warning columns are harmless',()=>{
 const g=arena(),d=g.finalDuel;d.startAttack(g,'rain');const lock=d.entities.map(e=>e.x);
 for(let i=0;i<100;i++)d.update(g,1/120);assert.equal(g.health,3);assert.deepEqual(d.entities.map(e=>e.x),lock);
 d.phase='attack';d.age=0;d.entities=d.entities.filter(e=>e.x===g.x);const e=d.entities[0];e.warning=false;e.age=.2;
 const body=d.body(e);g.y=(body.top+body.bottom)/2+20;g.invulnerable=0;d.update(g,1/120);
 assert.equal(g.health,2,'the descending projectile, not only the floor, hurts');
});
test('finale directional movement is bounded, and idle input cannot beat the boss',()=>{
 // 边界从关卡数据取，不写死数值：场地宽度是按横扫地火的缝隙反推出来的，
 // 写死的话场地一改，这条断言就退化成"记录了一个历史数值"而不是"检查行为"。
 const spec=FINAL_BOSS_PRACTICE.finalBoss;
 const g=arena();g.finalDuel.setMove(-1);for(let i=0;i<200;i++)g.update(1/120);
 assert.equal(g.x,spec.arena+spec.left);
 // 右侧也要有界：横扫地火两端都留了安全余量，靠的就是这条钳制。
 const r=arena();r.finalDuel.setMove(1);for(let i=0;i<240;i++)r.update(1/120);
 assert.equal(r.x,spec.arena+spec.right);
 const idle=arena();for(let i=0;i<120*90&&idle.state==='running';i++)idle.update(1/120);assert.equal(idle.finalDuel.hits,0);assert.ok(idle.health<3);
});
test('standing in the marked fourth-act hammer hurts even when it breaks the wedge',()=>{
 const g=new Runner(DAWN_BOSS_PRACTICE),w=g.level.dawn.wedges[0];g.x=g.prevX=w.x-40;g.y=g.prevY=606;g.dawn.phase='impact';g.dawn.move='hammer';g.invulnerable=0;
 g.dawnFireMove(g.level.dawn,'hammer',false);g.updateDawnEntities(1/120);
 assert.equal(g.dawn.broken.size,1);assert.equal(g.health,2);
});
test('the epilogue explains voluntary transfer, recovered life, personal cost and human self-sufficiency in order',()=>{
 const p=FINAL_ENDINGS.embers;assert.equal(p.length,8);
 assert.match(p[1].body,/答应过/);assert.match(p[2].body,/自愿交/);assert.match(p[3].body,/想活下去/);
 assert.match(p[4].body,/手指.*光/);assert.match(p[5].quote,/名字/);assert.match(p[6].body,/献祭自身/);assert.match(p[7].body,/不再靠献出记忆/);
});

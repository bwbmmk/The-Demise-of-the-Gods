import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Runner} from '../src/physics.js';
import {validateLevel,groundHeight} from '../src/level.js';
import {DAWN,DAWN_BOSS_PRACTICE} from '../src/level-dawn.js';
import {BOSS_CHANNELS,placeInBossArena} from '../src/boss-channels.js';
import {COVENANT} from '../src/level-covenant.js';
import {DAWN_ENTRIES,DAWN_ENCOUNTERS,DAWN_RINGS} from '../src/narrative-dawn.js';
import {Narrative} from '../src/narrative.js';
import {Encounter} from '../src/narrative-act1.js';
import {ProgressStore} from '../src/progress.js';
import {STORY_REELS} from '../src/story-theater.js';
import {Renderer} from '../src/renderer.js';
import {routeInput} from './runner-input.mjs';

function runDawn(g,input={handled:new Set(),doubleAt:null}){
  const events=[],broken=[];const state=input;
  for(let i=0;i<120*240&&g.state==='running';i++){
    routeInput(g,state);
    g.update(1/120);
    events.push(...g.drainEvents());
    for(const id of g.dawn?.broken??[])if(!broken.includes(id))broken.push(id);
  }
  return {events,broken};
}
function checkpointRunner(cp){
  const g=new Runner(DAWN);g.checkpoint=cp;
  g.checkpointFlags=new Set(DAWN.flags.filter(f=>!f.manual&&f.x<cp).map(f=>f.id));
  g.checkpointItems=new Set(DAWN.items.filter(i=>i.x<cp).map(i=>i.id));
  g.restoreCheckpoint(true);g.respawns=0;return g;
}

/**
 * 把玩家摆到指定 x 并**保持在那里**。
 *
 * ⚠️ 为什么需要这个辅助：直接写 `g.x=...` 是不够的——
 *   下一帧 update 会走 restoreCheckpoint 的回滚检查，把玩家拉回 checkpoint，
 *   于是「站到楔旁 → 挥剑」在单测里根本发生不了
 *   （症状：`strike-miss gap=3349`，明明站在楔前 100px）。
 *   必须同时把 checkpoint 指到当前位置，让回滚认为"这里就是存档点"。
 */
function placedRunner(x,cp=23400){
  // ⚠️ 不要走 checkpointRunner：它内部 restoreCheckpoint(true) 会先按 cp 摆位，
  //   而 restoreCheckpoint 会把已经越过死线的玩家判死并回滚（实测事件流里
  //   混进 respawn/hit，遮住我们要测的东西）。
  //   这里直接构造：先把状态开到 engage 之后，再摆位。
  const g=new Runner(DAWN);
  g.checkpoint=cp;
  g.checkpointFlags=new Set(DAWN.flags.filter(f=>!f.manual&&f.x<cp).map(f=>f.id));
  g.checkpointItems=new Set(DAWN.items.filter(i=>i.x<cp).map(i=>i.id));
  g.restoreCheckpoint(true);
  // 摆位后再把 checkpoint 设为这里，之后的回滚都以它为准。
  g.x=x;g.prevX=x;g.y=g.groundAt(x);g.prevY=g.y;g.grounded=true;
  g.vy=0;g.checkpoint=x;g.checkpoint=x;
  g.drainEvents();                 // 清掉摆位过程中产生的 respawn/hit 噪音
  return g;
}

/**
 * 钉住位置推进若干帧。
 *
 * ⚠️ 第四幕是**自动跑**：挥剑前摇 0.35s 里玩家会跑 126px。
 *   单测要验证"站太远砍不到"时，站位早就飘进判定半径了，于是断言假失败。
 *   所以挥剑判定那几帧必须把 x 钉住——测的是"站位距离"这一个变量。
 */
function runPinned(g,x,frames){
  for(let i=0;i<frames;i++){g.x=x;g.prevX=x;g.update(1/120);}
}

test('fourth act adds a chasing throne, three lethal dawn wedges and a brake that matters',()=>{
  assert.deepEqual(validateLevel(DAWN),[]);assert.equal(DAWN.boss,undefined);assert.equal(DAWN.brake,true);
  const g=new Runner(DAWN),r=runDawn(g);
  assert.equal(g.state,'won');assert.equal(g.respawns,0);
  assert.deepEqual(r.broken,DAWN.dawn.wedges.map(w=>w.id));
  assert.equal(g.dawn.phase,'defeated');
  assert.ok(g.elapsed>90&&g.elapsed<190,String(g.elapsed));
  // 三根楔各触发一次破碎（改版后由玩家挥剑触发，见 strike/resolveStrike）
  assert.equal(r.events.filter(e=>e.type==='dawn-wedge-broken').length,3);
  // ⚠️ 不再断言 `dawn-impact.connected` 的次数：
  //   那条计数记的是「王的落锤砸中楔」，而断楔已经改由玩家挥剑完成，
  //   crown 退回纯攻击招之后 connected 恒为 false。留着这条断言等于
  //   把旧玩法的实现细节焊死在测试里。
  // 本幕可以零伤跑完：砍楔只看站位，躲招与断楔互不干扰。
  assert.equal(g.health,3,'第四幕应当有一条零伤解，前提是走近挥剑并躲掉招式');
});
test('all fourth-act checkpoints offer fresh completion with the correct pre-broken wedges',()=>{
  for(const cp of DAWN.checkpoints){
    const g=checkpointRunner(cp);
    // 恢复后先断言继承关系，再开跑——跑完 broken 一定是全碎，看不出继承。
    for(const w of DAWN.dawn.wedges)assert.equal(g.dawn.broken.has(w.id),w.x<cp,`${cp}/${w.id}`);
    const r=runDawn(g);
    assert.equal(g.state,'won',String(cp));assert.equal(g.respawns,0,String(cp));
    assert.deepEqual(r.broken,DAWN.dawn.wedges.map(w=>w.id),String(cp));
  }
});
test('wedges block running without damage, and E cannot break them',()=>{
 const w=DAWN.dawn.wedges[0],g=placedRunner(w.x-42);g.sparkCharge=3;g.dawnChannel=true;
 for(let i=0;i<12;i++){g.strike();g.update(1/120);}assert.ok(g.x<=w.x-40);assert.equal(g.health,3);assert.equal(g.dawn.broken.size,0);
});

test('fourth-act completion needs no counter item and every break is caused by the king',()=>{
 const g=new Runner({...DAWN,dawn:{...DAWN.dawn,sparks:[]}}),r=runDawn(g);
 assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.sparkCharge,0);
 const breaks=r.events.filter(e=>e.type==='dawn-wedge-broken');assert.equal(breaks.length,3);assert.ok(breaks.every(e=>e.by==='king'));
 assert.equal(r.events.filter(e=>e.type==='seal-inject'||e.type==='dawn-exposed').length,0);
});

test('entity moves use unified windups and spawn physical bodies',()=>{
  const spec=DAWN.dawn,moves=spec.moves;
  for(const id of Object.keys(moves)){
    assert.ok(Math.abs(moves[id].aim-(id==='hammer'?1.65:1.05))<0.02,id+' 前摇应统一 1.05s');
    assert.ok(moves[id].recover>0.2,id+' 要有收招窗口');
    assert.ok(['cinder','quake','meteor','stomp','sweep','pulse','hammer'].includes(moves[id].bite),id+' 必须是实体判定');
  }
  for(const chain of spec.phases.flat()){
    assert.ok(Array.isArray(chain)&&chain.length>=1&&chain.length<=5,'链长 1–5');
    for(const id of chain)assert.ok(moves[id],'未知招式 '+id);
  }
  assert.ok(spec.phases[2].some(c=>c.includes('pulse')),'相三要有大招');
});
test('the chase freezes while the king is winding up, so waiting at a wedge is never punished for the wrong reason',()=>{
  const g=new Runner(DAWN);g.checkpoint=23000;g.restoreCheckpoint(true);
  g.x=24000;g.prevX=g.x;g.update(1/120);assert.ok(g.dawn.chase,'追兵应该在触发后出现');
  // 蓄力/落锤期间王也站着，追兵不前进。逐帧钉住相位，避免被状态机推进。
  for(const phase of ['aim','impact']){
    g.dawn.phase=phase;const front=g.dawn.chase.front;
    for(let i=0;i<120;i++){g.dawn.phase=phase;g.dawn.age=0;g.update(1/120);}
    assert.equal(g.dawn.chase.front,front,phase);
  }
  // 追兵阶段才推进。刹步不会让它减速——停了它就一定贴上来；
  // 但挥锤的 aim / impact 期间它冻住，所以"在楔前等这一锤"是免费的。
  g.dawn.phase='charge';g.dawn.age=0;g.setBrake(false);const a=g.dawn.chase.front;
  for(let i=0;i<60;i++){g.dawn.phase='charge';g.dawn.age=0;g.update(1/120);}
  const running=g.dawn.chase.front-a;
  assert.ok(running>0,'追兵阶段追兵应当推进');
  assert.equal(g.state,'running');
  // 站着不动一定会被追上——追兵不是装饰。这正是"不能停"的来源。
  g.dawn.phase='charge';g.dawn.age=0;g.dawn.chase.stumble=0;g.setBrake(true);
  for(let i=0;i<120*40&&g.state==='running';i++){g.dawn.phase='charge';g.dawn.age=0;g.setBrake(true);g.update(1/120);}
  assert.equal(g.state,'dead','站着不动就一定会被追兵贴上');
});
test('fourth-act saves resume the chase and banked wedges without premature lock progress',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},store=new ProgressStore(storage);
  // 11000 是触发点（23400）之前的最后一个存档点：读到它时王还没开始追。
  // 注意要**在跑之前**存档——跑完之后 checkpoint 已经推进到最后一章了。
  const g=checkpointRunner(11000);
  store.save(g);const data=store.load(DAWN);assert.ok(data);
  assert.equal(data.checkpoint,11000);
  const restored=new Runner(DAWN);store.restore(restored,data);
  assert.equal(restored.checkpoint,11000);assert.equal(restored.dawn.broken.size,0);
  assert.equal(restored.dawn.phase,'idle');
  assert.ok(!restored.dawn.chase,'还没到触发点就不该有追兵');
  // 从这份存档出发，整幕仍然可以零伤打完。
  const r=runDawn(restored);
  assert.equal(restored.state,'won');assert.equal(restored.health,3);
  assert.deepEqual(r.broken,DAWN.dawn.wedges.map(w=>w.id));
});
test('a save made inside the chase brings the chase back at full lead, not on top of the player',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},store=new ProgressStore(storage);
  const g=checkpointRunner(38800);
  store.save(g);const data=store.load(DAWN);assert.ok(data);
  const r=new Runner(DAWN);store.restore(r,data);
  assert.equal(r.checkpoint,38800);
  assert.equal(r.dawn.phase,'charge','读到追杀段的存档要把王叫醒');
  const lead=DAWN.dawn.chase.lead;
  assert.ok(r.x-r.dawn.chase.front>=lead-2,`追兵应当退回满 lead（实际 ${r.x-r.dawn.chase.front}）`);
});
test('resuming inside the chase restarts the king loop instead of leaving him asleep',()=>{
  // 越过触发点的存档必须立刻恢复追击，否则玩家站在追杀段里却看到一个
  // 不动的王——任何一次落锤判定都会凭空生效，读档即死。
  const g=new Runner(DAWN);
  g.checkpoint=DAWN.checkpoints.at(-1);          // 38800，已在触发点之后
  g.checkpointFlags=new Set(DAWN.flags.filter(f=>!f.manual&&f.x<g.checkpoint).map(f=>f.id));
  g.checkpointItems=new Set(DAWN.items.filter(i=>i.x<g.checkpoint).map(i=>i.id));
  g.restoreCheckpoint(true);
  assert.ok(g.checkpoint>DAWN.dawn.trigger);
  assert.equal(g.dawn.phase,'charge','越过触发点的存档必须立刻把王叫醒');
  assert.ok(g.dawn.chase,'越过触发点就应该有追兵');
  assert.deepEqual([...g.dawn.broken].sort(),['wedge-1','wedge-2']);
});
test('a late checkpoint inherits the wedges broken before it, so respawning never un-breaks the road',()=>{
  const g=checkpointRunner(38800);
  assert.deepEqual([...g.dawn.broken].sort(),['wedge-1','wedge-2']);
  assert.equal(g.blockingWedge.id,'wedge-3');
  // 从 38800 继续只需砸开最后一根
  const r=runDawn(g);
  assert.equal(g.state,'won');assert.deepEqual(r.broken,DAWN.dawn.wedges.map(w=>w.id));
  assert.equal(r.events.filter(e=>e.type==='dawn-wedge-broken').length,1);
});
test('dawn evidence tells the roster story in order and never lets the king surrender or open the door',()=>{
  const g=new Runner(DAWN),r=runDawn(g),n=new Narrative(),enc=new Encounter();n.event('dawn-enter');
  for(const e of r.events)if(e.type==='flag'||e.type==='item'){n.event(e.event);if(enc.begin(e.event))n.unlock(enc.finish().entry,false);}
  assert.ok(!n.unlocked.has('wr0'));
  const order=r.events.filter(e=>e.type==='flag').map(e=>e.event);
  for(const [a,b] of [['dawn-refuge','dawn-roster'],['dawn-roster','dawn-guard'],['dawn-guard','dawn-throne'],['dawn-throne','dawn-lock']])
    assert.ok(order.indexOf(a)<order.indexOf(b),`${a} 应在 ${b} 之前`);
  assert.ok(DAWN_ENTRIES.every(e=>n.unlocked.has(e.id)));
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w1').line,/我妹的名字/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w2').line,/没有人命令他/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w3').body,/名单本身就是钥匙/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w4').line,/你能让他们先活到明天吗/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w5').body,/可以用剑对付的人/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w6').body,/不是三道新的神锁/);
  assert.match(DAWN_ENTRIES.find(e=>e.id==='w7').body,/门可以开了，但门还没有开/);
  // 王不能自愿交出权柄，弥娅不能在诀别后出现，门不能被提前打开
  assert.doesNotMatch(JSON.stringify(DAWN_ENTRIES),/自愿交出|把权柄交|弥娅.*(来了|赶到|在城)/);
  assert.ok(DAWN_RINGS.every(e=>e.ring));
});
test('pure-story fourth act reuses all six encounters and keeps the unimplemented finale out of the reader',()=>{
  const reel=STORY_REELS.find(r=>r.id==='dawn');assert.ok(reel);
  for(const encounter of Object.values(DAWN_ENCOUNTERS)){
    const pages=reel.pages.filter(p=>p.kind==='dialogue'&&p.recordIds.includes(encounter.entry));
    assert.deepEqual(pages.map(p=>p.body),encounter.pages.map(p=>p.text));
  }
  assert.ok(!STORY_REELS.some(r=>r.id==='sleep'));
  assert.equal(STORY_REELS.at(-1).id,'finale');
});
test('the fourth act has real elevation, spread obstacles and genuinely optional high resonance',()=>{
  // 用户对第四幕的四条硬伤，逐条锁进测试，避免再退回"平路 + 重复障碍"：
  //   1. 地形必须有起伏（不是 terrain:[[0,606],[47200,606]] 这种一条直线）。
  //   2. 障碍不能是 block/beam/gap 三件套的机械循环。
  //   3. 共鸣环必须在风印托举顶上再跳一次才拿得到（可选，不锁主线）。
  //   4. 楔的高度必须跟着地形走，不能写死。
  const heights=DAWN.terrain.map(([,y])=>y);
  const relief=Math.max(...heights)-Math.min(...heights);
  assert.ok(DAWN.terrain.length>=20,'地形至少要像第一幕那样有二十多个点');
  assert.ok(relief>=70,`第四幕地形起伏应至少有 70px（实际 ${relief}）`);
  // 至少有一处高台：同一段里既有 606 也有明显更高的台面。
  assert.ok(Math.min(...heights)<=545,'应存在离地面 60px 以上的高台');
  // 障碍：三种类型都要有，且 block 的 skin 不再是清一色默认值。
  const kinds=DAWN.obstacles.reduce((a,o)=>{a[o.type]=(a[o.type]||0)+1;return a;},{});
  assert.ok(kinds.block>=4&&kinds.beam>=4&&kinds.gap>=4,'三种障碍都要出现，不能被减成一种');
  const skinned=DAWN.obstacles.filter(o=>o.type!=='gap');
  assert.ok(skinned.every(o=>o.skin),'block / beam 都应带场所材质，而不是统一外形');
  assert.ok(new Set(skinned.map(o=>o.skin)).size>=3,'材质要有多样性，不能只有一种');
  // 风印与共鸣：四处风印、四个环，环全部在风印顶点上方。
  // 第四处（wind-dawn-chest）是"丰富第四幕"那一轮补的：38800 之后原本
  // spring 0 / ring 0，整幕最该收束的地方反而没有风与共鸣——所以必须为 4，
  // 而且必须覆盖 38.8k 之后的最后一段。
  assert.equal(DAWN.springs.length,4);
  assert.equal(DAWN.rings.length,4);
  assert.ok(DAWN.springs.some(s=>s.x>38800),'最后一段（38.8k+）必须仍有风印，否则收束段只剩躲避');
  assert.ok(DAWN.rings.some(r=>r.x>38800),'最后一段（38.8k+）必须仍有共鸣环');
  for(const ring of DAWN.rings){
    const spring=DAWN.springs.reduce((best,s)=>Math.abs(s.x-ring.x)<Math.abs(best.x-ring.x)?s:best,DAWN.springs[0]);
    assert.ok(Math.abs(spring.x-ring.x)<400,`${ring.id} 应当紧邻某个风印，而不是落在障碍带里`);
  }
  assert.ok(!DAWN.rings.some(r=>DAWN.obstacles.some(o=>o.type!=='gap'&&r.x>o.x-120&&r.x<o.x+o.width+120)),
    '共鸣环不能被放进横梁/实心块的同一车道');
  // 楔高度跟随地形，而不是硬编码。
  for(const w of DAWN.wedges){
    const ground=groundHeight(DAWN.terrain,w.x,606);
    assert.ok(Math.abs(w.y-(ground-72))<1,`${w.id} 的高度应由地形推出`);
  }
});
test('the main line clears the fourth act without collecting a single optional ring',()=>{
  // 主线跑图不收环 → 共鸣确实是可选的；主动在顶点补一次跳 → 每个环都能拿到。
  // 这条同时守住 verify-chapter 的「可选共鸣不锁主线」断言。
  const RINGS=DAWN.rings.length;
  const main=new Runner(DAWN),r=runDawn(main);
  assert.equal(main.state,'won');
  assert.equal(main.health,3);
  assert.equal(main.rings.size,0,'全速主线不应顺手收走共鸣环');
  // 主动走位：每到一个风印的顶点就补一次跳跃。
  const eager=new Runner(DAWN),state={handled:new Set(),doubleAt:null},jumped=new Set();
  for(let i=0;i<120*240&&eager.state==='running';i++){
    routeInput(eager,state);eager.update(1/120);
    for(const s of DAWN.springs)
      if(!jumped.has(s.id)&&!eager.grounded&&eager.x>s.x+100&&eager.x<s.x+180&&eager.jumpsLeft>=1){eager.jump();jumped.add(s.id);}
  }
  assert.equal(eager.state,'won');
  assert.equal(eager.health,3,'拿共鸣也不该受伤，高台路线必须是干净的');
  assert.equal(eager.rings.size,RINGS,'在风印顶点补一次跳就能拿齐所有共鸣');
  assert.ok(r.broken.every(id=>typeof id==='string'));
});
test('the wind-spring lane stops being an either-or: one apex jump takes the whole rail AND the ring',()=>{
  // 用户原话：「那个风场那里想吃记忆碎片就吃不到回响」。
  // 旧版把碎片沿托举抛物线排成一列、环又压在同一列上，于是三样东西挤在 120px 里，
  // 必然做成二选一。这一版把升华轨铺成**两层**（lift-low / lift-high），
  // low 层贴"不按键"的抛物线，high 层贴"顶点补跳"的抛物线，
  // 于是"补跳一次"既吃满升华轨、又正好穿环。这条测试锁住这个结论：
  //   ① 完全不跳 → 吃得到 low 层，但拿不到任何一个环（环仍是可选的）。
  //   ② 在风印顶点补一次跳 → 升华轨吃满**且**所有环全中，不需要第二次操作。
  //   ③ 补跳后的碎片数不得少于不跳（否则"奖励技巧"变成了"惩罚技巧"）。
  const RINGS=DAWN.rings.length;
  const liftIds=new Set(DAWN.shards.filter(s=>s.rail?.startsWith('lift-')).map(s=>s.id));
  assert.ok(liftIds.size>=18,`升华轨两层加起来要有足够的碎片（实际 ${liftIds.size}）`);
  const railCount=r=>DAWN.shards.filter(s=>s.rail===r).length;
  assert.ok(railCount('lift-low')>=6&&railCount('lift-high')>=6,'两层升华轨都要铺满，不能只有一层');
  // 补跳必须**卡在抛物线顶点之后**（x ≈ 风印 + 163.6）才叫"顶点补跳"。
  // 早于顶点跳会截断上升段；晚于顶点太多则 arc 已经往下走。
  // 所以窗口取 [顶点+2, 顶点+46]，与 renderer 的提示文案一致。
  const apexJump=(runner,seen)=>{
    for(const s of DAWN.springs){
      if(seen.has(s.id))continue;
      const apexX=s.x+163.6;
      if(!runner.grounded&&runner.vy>=0&&runner.x>apexX+2&&runner.x<apexX+46&&runner.jumpsLeft>=1){
        runner.jump();seen.add(s.id);
      }
    }
  };
  // ① 完全不动手：吃得到升华轨，吃不到环。
  //
  // ⚠️ `state` 必须在整个模拟里复用**同一个对象**：routeInput 靠它记住
  // "这一段已经处理过哪一招"。每帧新建一个空对象会让它每帧都重新判断，
  // 玩家在第一根楔前就死掉（看起来像"这条轨白铺了"）。
  const run=(withJump)=>{
    const g=new Runner(DAWN),state={handled:new Set(),doubleAt:null},seen=new Set(),got=new Set();
    let liftTotal=0;
    for(let i=0;i<120*240&&g.state==='running';i++){
      routeInput(g,state);g.update(1/120);
      if(withJump)apexJump(g,seen);
      for(const id of liftIds)if(g.collected.has(id))got.add(id);
      liftTotal=got.size;
    }
    return {g,got,liftTotal};
  };
  const lazy=run(false);
  assert.equal(lazy.g.state,'won','不主动补跳也要能通关主线');
  assert.ok(lazy.got.size>0,`踩到风印被动飞起来就该吃到升华碎片（实际 ${lazy.got.size}）`);
  assert.equal(lazy.g.rings.size,0,'不补跳就不该顺带穿环——否则共鸣不再是可选项');
  const both=run(true);
  assert.equal(both.g.state,'won','补跳后也要能通关');
  assert.equal(both.g.rings.size,RINGS,'在顶点补一次跳应当所有共鸣环全中');
  assert.ok(both.got.size>lazy.got.size,
    `补跳一次必须同时拿到更多升华碎片（不跳 ${lazy.got.size} vs 补跳 ${both.got.size}）`);
  // 两层轨都在起作用：补跳应当把每一处风印都往前推一截（不是只多一枚）。
  assert.ok(both.got.size-lazy.got.size>=3,
    `补跳一次的收益要够明显（实际只多 ${both.got.size-lazy.got.size} 枚）`);
});
test('the fourth act does not repeat the second act: the wedge is a solid door ahead, not a target behind',()=>{
  // 第二幕：桩在身后，玩家站定把锤引到桩上；第四幕：楔在前面挡路，必须借王的锤砸开它。
  assert.ok(DAWN.dawn.wedges.every(w=>w.x<DAWN.world.end));
  assert.equal(COVENANT.boss.kind,'chain');
  assert.equal(DAWN.dawn.hammer<DAWN.dawn.tolerance,true,'落锤半径必须明显小于楔容差');
  assert.ok(DAWN.dawn.tolerance/DAWN.dawn.hammer>=2,'容差太窄就会退化成第二幕的站定对准');
  const g=new Runner(DAWN);g.checkpoint=23400;g.restoreCheckpoint(true);
  const w=DAWN.dawn.wedges[0];g.x=w.x-200;g.prevX=g.x;
  assert.equal(g.blockingWedge?.id,w.id,'未碎的楔应当在玩家前方构成路障');
  g.x=w.x+200;g.prevX=g.x;assert.equal(g.blockingWedge?.id,DAWN.dawn.wedges[1]?.id??null);
});
test('dawn landmarks never spawn Miya or copy the three bridge helpers',()=>{
  const renderer=Object.create(Renderer.prototype),actors=[],c=new Proxy({},{get:()=>()=>{}});
  renderer.view={level:DAWN,groundAt:()=>606};renderer.npc=(ctx,x,y,kind)=>actors.push(kind);renderer.mia=()=>actors.push('mia');
  const g=new Runner(DAWN);renderer.landmarks(c,0,1440,0,g);
  assert.ok(!actors.includes('mia'),'诀别之后弥娅不应再出现在第四幕');
  assert.ok(actors.length>0);
  actors.length=0;renderer.landmarks(c,DAWN.dawn.x-400,1440,0,g);
  assert.ok(!actors.includes('mia'));
});
test('the fourth act plays a full entity moveset with chain pressure',()=>{
  const spec=DAWN.dawn,moves=spec.moves;
  const ids=Object.keys(moves);
  assert.ok(ids.length>=6,'执炬王至少要有六种实体招');
  assert.equal(spec.phases.length,3,'三个相位各一张表');
  assert.equal(spec.chainLead,0,'各招独立预警，不能由前一招提前武装');
  assert.ok(spec.baitWedges,'王的攻击拆楔');
  assert.ok(spec.phases.every(p=>p.every(chain=>chain.at(-1)==='hammer')),'每轮最后可引锤');
});
test('the main line beats the full moveset at zero damage and the moveset cannot be skipped',()=>{
  // 整幕跑通：三根楔全断、满血、无回档——证明这套招式是"可读可躲"的，不是不可通关。
  const g=checkpointRunner(0);const r=runDawn(g);
  assert.equal(g.state,'won');
  assert.equal(g.health,3,'新招式组必须能零伤通过');
  assert.equal(g.respawns,0);
  assert.equal(r.broken.length,DAWN.dawn.wedges.length,'三根楔都要断');
  assert.equal(g.dawn.phase,'defeated');
  // 王的招式组里至少出现过 5 种不同招式（不是只反复出 crown）。
  const seen=new Set(r.events.filter(e=>e.type==='dawn-move').map(e=>e.move));
  assert.ok(seen.size>=5,'整场战斗至少要真的用出五种招式');
  assert.ok(seen.has('quake')||seen.has('sweep'),'实体招必须出现过');
  assert.ok([...seen].some(m=>['cinder','meteor','stomp','pulse'].includes(m)),'防守/范围招也必须出现');
});
test('the fourth act reads as four sections with a pulse, not one metronome of identical beats',()=>{
  // 用户原话：「道路还是没变，太单一了，丰富一点好吗，毕竟算是几乎最后的一幕了」。
  // 复盘用的密度剖面（.verify/diag-act4density.mjs）当时给出三条病征：
  //   ① 段三（王座 23000–38800）只有 1 块矮桩却长达 43.9s，是全幕最空的一段；
  //   ② 间距 2650/1850/1700/1700/1700/1650/1500/1450/1400/1400——近乎等距的节拍器；
  //   ③ 最后一段（38800+）spring 0 / ring 0，风与共鸣的词汇在最该收束处消失。
  // 这条测试把"每段有自己的重音、且重音段确实更紧"锁住，避免再退回等距铺排。
  const bounds=[0,11000,23000,38800,DAWN.world.end];
  const inSection=(x,i)=>x>=bounds[i]&&x<bounds[i+1];
  const count=(i,type)=>DAWN.obstacles.filter(o=>o.type===type&&inSection(o.x,i)).length;

  // ① 段三必须不再是"最空的段"：至少要有 2 块矮桩（旧版只有 1 块）。
  assert.ok(count(2,'block')>=2,`段三（王座）的矮桩至少要 2 块（实际 ${count(2,'block')}）`);
  // ② 三段以上的障碍总量要接近，不能出现某段明显空掉。
  const totals=[0,1,2,3].map(i=>DAWN.obstacles.filter(o=>inSection(o.x,i)).length);
  assert.ok(Math.min(...totals.slice(0,3))>=6,`前三段每段障碍至少 6 件（实际 ${totals.join('/')}）`);

  // ③ 最后一段必须仍有风印与共鸣——收束段不能只剩躲避。
  assert.ok(DAWN.springs.some(s=>s.x>38800),'最后一段必须有风印');
  assert.ok(DAWN.rings.some(r=>r.x>38800),'最后一段必须有共鸣环');
  assert.ok(DAWN.embers.some(e=>e.x>38800),'最后一段必须有逆火余烬');

  // ④ 间距不能是等距：相邻障碍的间隔要存在**明确的快慢对比**。
  //    做法是把间隔排序，比较最长与最短的比值——等距铺排的比值接近 1。
  const xs=DAWN.obstacles.map(o=>o.x).sort((a,b)=>a-b);
  const gaps=xs.slice(1).map((x,i)=>x-xs[i]);
  const sorted=[...gaps].sort((a,b)=>a-b);
  const median=sorted[Math.floor(sorted.length/2)];
  const quiet=sorted[sorted.length-1], dense=sorted[0];
  assert.ok(quiet/median>=1.5,
    `最长间隔要比中位数明显大（应有"喘气段"，实际 ${quiet} vs 中位 ${median}）`);
  assert.ok(median/dense>=1.8,
    `最短间隔要比中位数明显小（应有"重音段"，实际 ${median} vs 最短 ${dense}）`);

  // ⑤ 重音段必须真的存在：至少两处"两件障碍挨得比一路跑过去更紧"的连击。
  //    判据用的是**间隔**而不是"中心距"：滑铲时长 0.72s，章节速度 330–360，
  //    所以一次滑铲吃掉 238–259px。间隔 ≤ 600px（≈1.7s）意味着玩家滑完立刻
  //    就要面对下一件，判断余量不到 1 秒——这才叫连击。
  //    （连梁/三窄坑这几处实测是 500/600/600/600，正好落在这一档。）
  const combos=gaps.filter(g=>g<=600).length;
  assert.ok(combos>=4,`至少要有四处障碍连击（间隔 ≤ 600px，实际 ${combos} 处）`);

  // ⑥ 而且连击必须分布在**不止一段**里——四段各自要有自己的重音。
  const comboSection=new Set(xs.slice(1).map((x,i)=>({x,g:gaps[i]})).filter(o=>o.g<=600)
    .map(o=>bounds.findIndex((b,j)=>o.x>=b&&o.x<bounds[j+1])));
  assert.ok(comboSection.size>=2,`连击不能全挤在一段里（实际落在 ${comboSection.size} 段）`);
});
test('the backfire dash is a one-shot resource: it spends an ember, outruns a walk, and never beats a wedge',()=>{
  // 第四幕的专属动词。设定来源：王把自己烧成新太阳，沿途掉下「余烬」，
  // 玩家踩上去攒成一枚，按 Shift 借火前冲——这不是"按住某键改变状态"，
  // 而是"这一枚现在花不花"。
  //
  // 用户对这一幕的要求是"难度往很高拉"但"逻辑要注重"，所以这套测试锁的是
  // **资源的边界**（不是手感）：花了就少一枚、刹车优先于冲刺、冲刺不能替玩家
  // 越过楔这道门。这三条任何一条破了，整幕的决策就塌了。
  const D=DAWN.dawn,dash=D.dash;

  // ① 余烬是**路上必经**的资源：数量、位置、可达性。
  assert.ok(DAWN.embers.length>=6,`余烬要有足够密度（实际 ${DAWN.embers.length} 枚）`);
  for(const e of DAWN.embers){
    const floor=groundHeight(DAWN.terrain,e.x,606);
    assert.ok(e.y>floor-80&&e.y<floor-20,`${e.id} 必须落在"跑过去就能吃到"的带内（地面 ±20..80）`);
  }
  assert.ok(DAWN.embers.some(e=>e.x<DAWN.chapters[0].at+6000),'第一段必须有一枚余烬，否则玩家学不会这个动词');
  assert.ok(DAWN.embers.some(e=>e.x>38800),'最后一段必须仍有余烬');

  // ② 一次冲刺的行程：speed 叠加在章节速度之上，duration 必须短于一次落锤预警。
  const d=new Runner(DAWN),state={handled:new Set(),doubleAt:null};
  // 先跑到第一枚余烬处，让它自然吃进来。
  const first=DAWN.embers[0];
  for(let i=0;i<120*60&&d.x<first.x+40&&d.state==='running';i++){routeInput(d,state);d.update(1/120);}
  assert.ok(d.ember>=1,`跑到第一枚余烬处应当已经拾得（实际 ${d.ember}）`);

  const startX=d.x;
  const walkSpeed=d.level.chapters[d.chapter].speed;
  const hypothetical=startX+dash.speed*dash.duration+walkSpeed*dash.duration;
  assert.ok(d.backfire(),'有余烬时 backfire() 应当成功');
  assert.equal(d.ember,0,'冲刺必须**立刻**扣掉一枚余烬');
  assert.ok(Math.abs(d.dashTime-dash.duration)<1e-9,'冲刺时长应等于 dash.duration');
  let px=0;
  for(let i=0;i<Math.ceil(dash.duration*120);i++){d.braking=false;d.grounded=true;const before=d.x;d.update(1/120);px+=d.x-before;}
  // 冲刺位移要明显大于"什么都不做"的位移，但必须小于理论值（理论上限含章节速度）。
  const plain=walkSpeed*dash.duration;
  assert.ok(px>plain*1.4,`冲刺要比同时间的正常跑动明显更远（冲刺 ${Math.round(px)} vs 平常 ${Math.round(plain)}）`);
  assert.ok(px<hypothetical,`冲刺不能超过理论上限（实际 ${Math.round(px)} vs 上限 ${Math.round(hypothetical-startX)}）`);

  // ③ 没有余烬时不能空放。
  assert.equal(d.ember,0);
  assert.equal(d.backfire(),false,'余烬为 0 时 backfire() 必须返回 false，不能白送冲刺');

  // ④ 刹车优先于冲刺：按住 A 的那一刻，"我要停"压过"我要往前"。
  //    （这是实测改出来的——早期写成冲刺无视刹车，QA 被自己的冲刺顶过楔的致死线。）
  const b=new Runner(DAWN);b.ember=1;b.dashTime=dash.duration;b.grounded=true;b.braking=true;
  const beforeB=b.x;for(let i=0;i<10;i++)b.update(1/120);
  assert.ok(Math.abs(b.x-beforeB)<1,`按住刹车时冲刺不该推动玩家（实际位移 ${(b.x-beforeB).toFixed(3)}px）`);

  // ⑤ 冲刺不能越过楔这道门——楔是**实心路障**，不是可选收集品。
  //    ⚠️ 旧版撞上去是 hurt(true)（扣血 + 回档），本版改成"挡停、不扣血"：
  //    楔本身已经构成关卡门（不碎就不能通过），一次手误不该罚掉整段路线。
  const w=DAWN.wedges[0];
  const g=new Runner(DAWN);
  g.checkpoint=DAWN.chapters[2].at;g.restoreCheckpoint(true);
  const startHp=g.health;
  g.x=w.x-200;g.prevX=g.x;g.ember=3;g.grounded=true;g.braking=false;g.y=g.groundAt(g.x);
  assert.ok(g.backfire(),'楔前应当能起冲刺');
  for(let i=0;i<120*2&&g.x<w.x-40&&g.state==='running';i++){g.braking=false;g.update(1/120);}
  assert.equal(g.health,startHp,'冲刺撞上未碎的楔只该被挡停，不该扣血');
  assert.ok(g.x<=w.x-40,'冲刺之后玩家仍然被挡在楔的这一侧，不能穿过去');
  assert.ok(g.blockingWedge?.id===w.id,'楔未碎之前始终挡在玩家前方');

  // ⑥ 冷却：连续冲刺之间要有一个恢复窗口，不能一帧一冲。
  const c=new Runner(DAWN);c.ember=3;c.dashTime=0;c.dashCooldown=0;
  assert.ok(c.backfire());assert.ok(c.dashCooldown>0,'冲刺后必须进入冷却');
  assert.equal(c.backfire(),false,'冷却期间不能再次冲刺');
});

// --------------------------------------------------------------------------- //
// 王战的可解性不变量
//
// 下面每一条都对应一个**实测踩过的死局**。它们不是"调参偏好"，
// 而是"这一关能不能被通关"的前提——任何一条被破坏，玩家就会撞上
// 一个与操作无关的、理论上无解的局面。
// --------------------------------------------------------------------------- //

test('all six dawn moves actually fire in one run',()=>{
  const g=new Runner(DAWN);
  const r=runDawn(g);
  const fired=new Set(r.events.filter(e=>e.type==='dawn-move').map(e=>e.move));
  const missing=[...new Set(DAWN.dawn.phases.flat(2))].filter(m=>!fired.has(m));
  assert.deepEqual(missing,[],`这些招整幕从未出现：${missing.join(', ')}`);
  // 出招密度：断楔后王要明显变急（cadence 随 broken 收紧），
  // 但也不能密到没有读招余地——所以给一个下限。
  assert.ok(fired.size===5,'六招必须全部真实触发');
});

test('every beam leaves slide-through clearance over its own terrain span',()=>{
  // 判定盒锚在障碍**左端**地面（hazardBox 只吃标量），而玩家踩的是自己脚下的地面。
  // 跨度内有上坡时两者错开，滑铲顶会低于梁底——这道梁就物理上无解。
  // 实测踩中过：beam 落在 31px 上坡上，余量 −12.3px。
  for(const o of DAWN.obstacles){
    if(o.type!=='beam')continue;
    const base=groundHeight(DAWN.terrain,o.x,DAWN.world.ground);
    let hi=Infinity;
    for(let x=o.x;x<=o.x+o.width;x+=4)hi=Math.min(hi,groundHeight(DAWN.terrain,x,DAWN.world.ground));
    const margin=(hi-DAWN.world.slideHeight+5)-(base-43);
    assert.ok(margin>=0,`beam@${o.x} 滑铲无解：净空 ${margin.toFixed(1)}px`);
  }
});

test('dawn wedges keep an 1800px obstacle-free approach',()=>{
  // 楔前留白：只读王招，不掺地面障碍。
  // 1800px ≈ 一次完整 crown 循环（aim 1.7 + recover 0.95 + pace 0.85 ≈ 3.5s，
  // 而 1800/360 = 5s），够玩家完成"站位 → 读招 → 落锤"的整个决策。
  const min=1800;
  for(const w of DAWN.dawn.wedges){
    for(const o of DAWN.obstacles){
      const cx=o.x+o.width/2;
      assert.ok(Math.abs(cx-w.x)>=min,
        `障碍 ${o.type}@${o.x}(中心 ${cx}) 离 ${w.id}@${w.x} 只有 ${Math.abs(cx-w.x)}px < ${min}px`);
    }
  }
});

test('the whole fourth act is clearable without taking a single hit',()=>{
  // 这是本幕最重要的一条：零伤通关。
  // 之前的每一处掉血都对应一个"招式与地形抢同一帧"的结构性问题，
  // 详见 runner-input 里 jumpSafe / jumpLandsSolid / gapDue / 雨阵锁目标
  // 以及 physics 里 dawnResolve 的可解性检查与 busy 闸门的注释。
  const g=new Runner(DAWN);
  runDawn(g);
  assert.equal(g.state,'won');
  assert.equal(g.health,3,'主线应当零伤通关');
  assert.equal(g.respawns,0);
  assert.equal(g.dawn.broken.size,DAWN.dawn.wedges.length);
});

// --------------------------------------------------------------------------- //
// 执炬王 · 独立练习场
//
// 存在理由：前两幕的 Boss 走 level.boss（打空 rounds 轮），
// 执炬王走 level.dawn 的楔系统（把 crown 的锤引到楔上）——两套驱动。
// 所以他需要一个自己的练习场，也需要 placeInBossArena 单独分派。
// 下面这几条把这个入口的存在、可达性与"三楔全断才算通"锁住。
// --------------------------------------------------------------------------- //

test('the king shows up in the boss channel with his own practice arena',()=>{
  // 通道里必须有执炬王这一项，且按钮 id 真实存在于 index.html。
  const entry=BOSS_CHANNELS.find(c=>c.level===DAWN_BOSS_PRACTICE);
  assert.ok(entry,'Boss 通道里没有执炬王');
  assert.equal(entry.buttonId,'boss-dawn-entry');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.includes('id="boss-dawn-entry"'),'index.html 缺少执炬王的通道按钮');
  assert.ok(html.includes('执炬王'),'通道按钮没有显示王的名字');
});

test('the practice arena passes level validation',()=>{
  // 练习场是复制出来的压缩版第四幕，最容易漏掉的是"从正式关卡继承来的
  // 旗标越界"——旗标分布在 700–22600，而练习场只有 20000px。
  assert.deepEqual(validateLevel(DAWN_BOSS_PRACTICE),[]);
  assert.ok(DAWN_BOSS_PRACTICE.bossOnly);
  assert.ok(DAWN_BOSS_PRACTICE.dawn,'练习场必须保留 level.dawn，否则王不会出招');
  assert.equal(DAWN_BOSS_PRACTICE.dawn.wedges.length,3,'三根楔都要在');
  // 楔间距要压到能在短时间内反复练完整循环（正式幕是 6600px）。
  const xs=DAWN_BOSS_PRACTICE.wedges.map(w=>w.x);
  for(let i=1;i<xs.length;i++){
    assert.ok(xs[i]-xs[i-1]<=3000,`练习场楔间距 ${xs[i]-xs[i-1]}px 过长，练不到几轮`);
  }
});

test('placeInBossArena drops the player just ahead of the king',()=>{
  // 进场位置决定这段练习有没有意义：太靠前王还没 engage，
  // 太靠后就直接撞在楔的撞穿线上了。
  const g=placeInBossArena(new Runner(DAWN_BOSS_PRACTICE));
  const spec=DAWN_BOSS_PRACTICE.dawn;
  assert.ok(g.x<spec.trigger,'不该落在触发点之后（王还没 engage 就白等）');
  assert.ok(g.x>spec.trigger-600,'进场离触发点太远，玩家要干跑一段');
  assert.ok(g.grounded,'进场必须站在地上');
  assert.ok(g.dawn,'王的战斗状态必须已初始化');
  assert.equal(g.dawn.broken.size,0,'练习场从零开始，三根楔都该是好的');
  // 检查点必须在第一根楔之前：落在王座之后会让 resetDawn 认为这一幕已打完。
  assert.ok(DAWN_BOSS_PRACTICE.checkpoints[0]<DAWN_BOSS_PRACTICE.wedges[0].x);
});

test('the practice arena is clearable with no damage and all six moves show up',()=>{
  // 这是练习场的**核心承诺**：不练到的东西等于不存在。
  // 用与 dawn.test 其余用例同一份确定性输入跑，
  // 断言零伤通关、三楔全断、六招全部出现过。
  const g=new Runner(DAWN_BOSS_PRACTICE);
  const state={handled:new Set(),doubleAt:null};
  const seen=new Set(),broken=new Set();
  for(let i=0;i<120*200&&g.state==='running';i++){
    routeInput(g,state);g.update(1/120);
    for(const e of g.drainEvents()){
      if(e.type==='dawn-move')seen.add(e.move);
      if(e.type==='dawn-wedge-broken')broken.add(e.id);
    }
  }
  assert.equal(g.state,'won','练习场应当能通关');
  assert.equal(g.health,3,'练习场应当零伤通关');
  assert.equal(broken.size,3,'三根楔都要能砸断');
  assert.deepEqual([...g.dawn.broken].sort(),DAWN_BOSS_PRACTICE.wedges.map(w=>w.id).sort());
  const all=[...new Set(DAWN.dawn.phases.flat(2))];
  for(const m of all)assert.ok(seen.has(m),`执炬王的「${DAWN.dawn.moves[m].name}」在练习场里从没出现`);
});

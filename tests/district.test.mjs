import {bossInput} from './runner-input.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner } from '../src/physics.js';
import { LEVELS, validateLevel, jumpReach, doubleJumpReach, safeDoubleJumpReach, groundHeight } from '../src/level.js';
import { DISTRICT, BOSS_PRACTICE } from '../src/level-district.js';

/**
 * 回放策略：像玩家一样看着下一个障碍，提前起跳/滑铲。
 * 二段跳在宽缺口上延后到接近滞空末端——射程随按键时机单调上升，
 * 这是既有序章通关测试用的同一套时机策略。
 *
 * 记名桥的机关 Boss 加入后，策略还要会读 Boss 的法术：
 * 军官始终飞在玩家前方 lead px 处，法术贴地齐射而来，
 * 和守灯人的灰弹一样跳跃躲过；反击器物落在前方的必经跑道上，
 * 玩家边跑边顺手拾起——不需要任何专门的操作键。
 */
function play(level, { dodgeLead = .19 } = {}) {
  const game = new Runner(level);
  const handled = new Set();
  const failed = [];
  let doubleAt = null;
  const dt = 1 / 120;
  for (let frame = 0; frame < 120 * 300 && game.state === 'running'; frame++) {
    const next = (level.obstacles || []).find((o) => !handled.has(o.id) && o.x > game.x - 100);
    if (next) {
      const lead = next.type === 'beam' ? 48 : next.type === 'gap' ? 30 : 100;
      if (game.x >= next.x - lead) {
        handled.add(next.id);
        if (next.type === 'beam') game.slide();
        else {
          game.jump();
          // 只有单跳射程确实不够时才用二段跳，且要等到射程足够时才按。
          // 这与既有序章通关测试是同一套时机策略。
          const speed = level.chapters[chapterOf(level, next.x)].speed;
          if (next.type === 'gap' && next.width > jumpReach(speed) - 12) {
            doubleAt = game.elapsed + 0.38;
          }
        }
      }
    }
    // 主线物品不吃跳跃，走过去就能拿；不需要额外操作
    if (doubleAt !== null && game.elapsed >= doubleAt) { game.jump(); doubleAt = null; }
    if(game.grounded&&game.projectiles.some(p=>p.x>game.x&&p.x-game.x<(game.level.chapters[game.chapter].speed+p.speed)*dodgeLead)){game.jump();}
    // Boss 法术与灰弹同理：贴地飞来，在身前一小段时起跳。
    {const action=bossInput(game);if(action)game[action]();}
    const before = game.health;
    game.update(dt);
    if (game.health < before && !failed.length) {
      failed.push(`x=${game.x.toFixed(0)} 处受伤（未处理的障碍）`);
    }
    if (game.state === 'dead') { failed.push(`x=${game.x.toFixed(0)} 坠亡`); break; }
  }
  return { game, failed };
}

function chapterOf(level, x) {
  return level.chapters.reduce((i, c, j) => (x >= c.at ? j : i), 0);
}

test('district level registers and passes validation', () => {
  assert.equal(LEVELS.district, DISTRICT);
  assert.deepEqual(validateLevel(DISTRICT), []);
});

test('purple falling seals require a second jump, rather than a single jump at the same cue',()=>{
  for(const double of [false,true]){
    const g=new Runner(BOSS_PRACTICE),speed=320;g.x=40000;g.prevX=g.x;g.boss.phase='charge';g.boss.age=-2;g.boss.ward=false;
    g.bossShots=[{id:'seal-test',kind:'fall',x:g.x+speed*1.05,y:584,speed:0,age:0,warning:1.05}];let jumps=0;
    for(let i=0;i<150;i++){
      const action=bossInput(g);if(action==='jump'&&(double||jumps===0)){g.jump();jumps++;}
      g.update(1/120);
    }
    assert.equal(g.health,double?3:2);assert.equal(jumps,double?2:1);
  }
});

test('boss practice is a direct arena and ends when the warden is defeated', () => {
  assert.equal(LEVELS['boss-practice'], BOSS_PRACTICE);
  assert.deepEqual(validateLevel(BOSS_PRACTICE), []);
  const game=new Runner(BOSS_PRACTICE),speed=BOSS_PRACTICE.chapters[0].speed;
  game.x=BOSS_PRACTICE.boss.trigger-speed/120;game.prevX=game.x;
  game.y=game.groundAt(game.x);game.prevY=game.y;game.checkpoint=BOSS_PRACTICE.checkpoints[0];game.resetBoss();
  runBossFight(game);
  assert.equal(game.boss.phase,'defeated');
  game.update(1/120);
  assert.equal(game.state,'won','练习场应在 Boss 击退后立即结束');
});

test('district can be completed without taking damage at 120Hz', () => {
  const { game, failed } = play(DISTRICT);
  assert.deepEqual(failed, [], `回放失败：${failed.join('；')}`);
  assert.equal(game.state, 'won');
  assert.equal(game.respawns, 0, '无伤通关意味着不该重生');
});

test('all three name plates are on the completable path', () => {
  const { game } = play(DISTRICT);
  assert.equal(DISTRICT.items.filter(i=>i.kind!=='coal'&&game.items.has(i.id)).length,3);
  assert.equal(game.litLamps.size,0,'北岸送灯只在幕间剧情中出现');
  for (const item of DISTRICT.items) {
    assert.ok(game.items.has(item.id), `未取得铜片 ${item.id}`);
  }
});

test('magic dodge has a timing window, including the final double volley',()=>{
  for(const dodgeLead of [.14,.24]){
    const {game,failed}=play(DISTRICT,{dodgeLead});assert.deepEqual(failed,[]);assert.equal(game.state,'won');
    assert.equal([...game.enemyStates.values()].reduce((n,s)=>n+s.fired,0),6);
  }
});

test('magic is warned, damages standing runners, can be jumped, and resets at checkpoints',()=>{
  for(const dodge of [false,true]){
    const game=new Runner(DISTRICT),enemy=DISTRICT.enemies[0];game.x=enemy.trigger;game.y=game.groundAt(game.x);
    let chargeTime=null,shotTime=null,hits=0;
    while(game.x<enemy.x+20){
      if(dodge&&game.grounded&&game.projectiles.some(p=>p.x>game.x&&p.x-game.x<100))game.jump();
      game.update(1/120);
      for(const event of game.drainEvents()){
        if(event.type==='enemy-charge')chargeTime=game.elapsed;
        if(event.type==='enemy-shot')shotTime=game.elapsed;
        if(event.type==='hit')hits++;
      }
    }
    assert.ok(shotTime-chargeTime>=.73,'先蓄力，再发射');assert.equal(hits,dodge?0:1);
    game.checkpoint=13000;game.restoreCheckpoint(true);
    assert.deepEqual(game.projectiles,[]);assert.ok(game.enemyStates.get(enemy.id).done);
    assert.equal(game.enemyStates.get(DISTRICT.enemies[1].id).active,false);
    game.reset();assert.ok(!game.enemyStates.get(enemy.id).done);
  }
});

test('invalid enemy schedules are rejected before simulation',()=>{
  assert.ok(validateLevel({...DISTRICT,enemies:[{...DISTRICT.enemies[0],shots:Infinity}]}).some(p=>p.includes('弹幕')));
  assert.ok(validateLevel({...DISTRICT,enemies:[{...DISTRICT.enemies[0],windup:0}]}).some(p=>p.includes('预警')));
});

test('full act one includes a 2.5-3.5 minute action route; reading is outside simulation time', () => {
  const { game } = play(DISTRICT);
  const minutes = game.elapsed / 60;
  assert.ok(minutes >= 2.5&&minutes<=3.5,`第一幕动作段 ${minutes.toFixed(2)} 分钟`);
});

test('each plate sits in a distinct location with its own checkpoint span', () => {
  const xs = DISTRICT.items.map((i) => i.x).sort((a, b) => a - b);
  // 三处地点分属不同的章节段落
  for (const item of DISTRICT.items) {
    const chapter = DISTRICT.chapters[chapterOf(DISTRICT, item.x)];
    assert.ok(chapter, `铜片 ${item.id} 落在关卡内`);
  }
  // 彼此拉开距离，不会连着拿而失去「三个地方」的分量
  assert.ok(xs[1] - xs[0] > 4000, '前两枚铜片距离过近');
  assert.ok(xs[2] - xs[1] > 4000, '后两枚铜片距离过近');
});

test('plates are reachable without relying on double-jump limits', () => {
  // 主线铜片不该需要极限操作：设计表要求「不设极端操作门槛」
  for (const item of DISTRICT.items) {
    const ground = groundHeight(DISTRICT.terrain, item.x, DISTRICT.world.ground);
    const rise = ground - item.y;
    assert.ok(rise <= 60, `铜片 ${item.id} 高出地面 ${rise}px，应平放在地面附近`);
  }
});

test('district gaps stay within safe double-jump reach', () => {
  for (const gap of DISTRICT.obstacles.filter((o) => o.type === 'gap')) {
    const speed = DISTRICT.chapters[chapterOf(DISTRICT, gap.x)].speed;
    assert.ok(
      gap.width <= safeDoubleJumpReach(speed) - 12,
      `断桥 ${gap.id} 宽 ${gap.width}，速度 ${speed} 的可靠射程只有 ${safeDoubleJumpReach(speed).toFixed(0)}`
    );
    // 也不该宽到必须靠二段跳极限
    assert.ok(gap.width <= doubleJumpReach(speed) * 0.8, `断桥 ${gap.id} 过于接近极限`);
  }
});

test('checkpoint retry cannot farm plates or shards', () => {
  const game = new Runner(DISTRICT);
  // 走到第一个检查点，途中已取得第一枚铜片
  for (const item of DISTRICT.items) {
    if (item.x < DISTRICT.checkpoints[0]) {
      game.x = item.x; game.y = game.groundAt(item.x);
      game.update(1 / 120);
    }
  }
  assert.equal(game.items.size, 1);
  const shardsBefore = game.collected.size;
  game.restoreCheckpoint(true);
  assert.equal(game.items.size, 0, '回到检查点后主线铜片应回滚，避免读档重刷');
  assert.ok(game.collected.size <= shardsBefore);
});

test('district has three checkpoints worth of segments and one exit', () => {
  assert.equal(DISTRICT.checkpoints.length, DISTRICT.chapters.length - 1);
  assert.equal(DISTRICT.exits.length, 1);
  // 每个章节起点就是一个检查点
  for (const cp of DISTRICT.checkpoints) {
    assert.ok(DISTRICT.chapters.some((c) => c.at === cp), `检查点 ${cp} 应与章节起点重合`);
  }
});

// --------------------------------------------------------------------------- //
// 记名桥机关 Boss
// 三条验收来自交付要求：可无伤通过、道具漏捡可恢复、失败能重试且不丢轮次。
// --------------------------------------------------------------------------- //

/** 把角色推进到 Boss 触发点，返回一个可以逐步驱动的 game。 */
function atBoss(){
  const game=new Runner(DISTRICT),boss=DISTRICT.boss;
  game.x=boss.trigger-40;game.y=game.groundAt(game.x);
  game.chapter=chapterOf(DISTRICT,game.x);
  game.prevX=game.x;
  return game;
}
/** 驱动到某个阶段出现为止；超时抛错，避免死循环掩盖问题。 */
function advanceUntil(game,predicate,{limit=120*80,dodge=true}={}){
  for(let i=0;i<limit;i++){
    if(predicate(game))return true;
    if(dodge){const action=bossInput(game);if(action)game[action]();}
    game.update(1/120);
    if(game.state!=='running')return predicate(game);
  }
  return false;
}
/** 一边躲法术一边向前跑，直到 Boss 被击败或不再运行。返回战斗期间采集的观测。 */
function runBossFight(game,{dodge=true,limit=120*80}={}){
  const seen=[];
  const leads=[];
  for(let i=0;i<limit&&game.state==='running';i++){
    if(dodge){const action=bossInput(game);if(action)game[action]();}
    game.update(1/120);
    const B=game.boss;
    if(B&&B.phase!=='idle'&&B.phase!=='defeated')leads.push(B.x-game.x);
    for(const event of game.drainEvents())seen.push(event.type);
    if(B&&B.phase==='defeated')break;
  }
  return {seen,leads};
}

test('bridge warden runs three readable rounds and is defeated without taking damage',()=>{
  const game=atBoss(),boss=DISTRICT.boss;
  const {seen,leads}=runBossFight(game);
  assert.equal(game.health,3,'三轮都躲开法术就不该掉血');
  assert.equal(game.boss.phase,'defeated');
  assert.equal(game.boss.hits,3,'三轮各反击一次');
  // 每一轮都必须走完"预警 → 齐射 → 护盾 → 破盾 → 窗口 → 反击"
  for(const type of ['boss-enter','boss-cast','boss-shield','boss-broken','boss-window','boss-struck','boss-defeated']){
    assert.ok(seen.includes(type),`缺少阶段事件 ${type}`);
  }
  assert.equal(seen.filter(t=>t==='boss-cast').length,12,'三轮逐次增加攻击，共十二发');
  assert.equal(seen.filter(t=>t==='boss-broken').length,3,'常晚应破盾三次');
  assert.equal(seen.filter(t=>t==='boss-struck').length,3,'反击应命中三次');
  // 追逐关系的核心断言：整场战斗军官始终停在玩家前方 lead 附近，
  // 既不会贴到身上（旧 bug），也不会跑出屏幕（读不到预警）。
  assert.ok(leads.length>0,'战斗期间应采集到相对距离');
  for(const lead of leads){
    assert.ok(lead>=boss.lead-2&&lead<=boss.lead+2,`军官应恒在玩家前方 ${boss.lead}px，实测 ${lead.toFixed(0)}`);
  }
  // 过桥只是中点，北岸送灯还未完成，不能提前结算第一幕。
  assert.equal(game.state,'running');assert.ok(game.x<DISTRICT.world.end);
});

test('gunfire must be dodged: standing still in the volley kills the runner',()=>{
  // 不躲法术：玩家会在齐射里被连续打中。
  const standing=atBoss();
  const {seen}=runBossFight(standing,{dodge:false});
  assert.ok(standing.health<3,`不躲法术必须掉血，实际 ${standing.health}`);
  assert.ok(seen.filter(t=>t==='boss-cast').length>=3,'不躲也会吃满法术');
  // 同一段战斗，躲法术就能无伤——对照证明伤害来自法术而不是别的。
  const dodging=atBoss();
  runBossFight(dodging,{dodge:true});
  assert.equal(dodging.health,3,'躲开法术则应保持满血');
});

test('the runner never catches the officer: distance stays pinned to lead',()=>{
  const game=atBoss(),boss=DISTRICT.boss;
  // 全程不做任何额外操作，只躲法术。军官与玩家同速，距离不应被拉近。
  const {leads}=runBossFight(game);
  const min=Math.min(...leads),max=Math.max(...leads);
  assert.ok(min>=boss.lead-2,`军官被追上过：最近只有 ${min.toFixed(0)}px`);
  assert.ok(max<=boss.lead+2,`军官拉开了距离：最远 ${max.toFixed(0)}px`);
  // 旧实现把玩家焊在军官身前 120px（封锁线），现在必须明显更远。
  assert.ok(min>boss.lead*.9,`不应回到"贴脸"距离，实际 ${min.toFixed(0)}`);
});

test('a missed counter relic comes back instead of soft-locking the fight',()=>{
  const game=atBoss(),boss=DISTRICT.boss;
  // 推进到第一轮反击窗口出现
  assert.ok(advanceUntil(game,()=>game.boss.phase==='window'),'应进入反击窗口');
  assert.ok(game.bossRelic,'窗口出现时应有反击器物');
  // 器物落在玩家前方 relicLead 的跑道上——先确认这一点。
  assert.ok(game.bossRelic.x>game.x,`器物应在玩家前方，实际 ${(game.bossRelic.x-game.x).toFixed(0)}px`);
  assert.ok(game.bossRelic.x-game.x<=boss.relicLead+40,'器物应在跑道前方的可及范围内');
  // 主动不捡：一直把角色按在器物后面，等它超时
  const missed=[];
  for(let i=0;i<120*12&&game.state==='running';i++){
    if(game.bossRelic&&game.x>game.bossRelic.x-boss.relicLead){game.x=Math.max(0,game.bossRelic.x-boss.relicLead-120);}
    game.update(1/120);
    for(const event of game.drainEvents())if(event.type==='boss-relic-missed')missed.push(event.round);
  }
  assert.ok(missed.length>=1,'漏捡必须被记录，才能给出提示');
  assert.ok(game.bossRelic,'漏捡后器物应重新出现，而不是让玩家卡住');
  assert.equal(game.boss.round,0,'漏捡不算进度');
});

test('pausing or skipping the fight does not advance the boss state at all',()=>{
  const running=atBoss(),frozen=atBoss();
  // 一个正常推进
  for(let i=0;i<120*3;i++)running.update(1/120);
  const snapshot=JSON.stringify({phase:running.boss.phase,round:running.boss.round,shots:running.bossShots,relic:running.bossRelic,hits:running.boss.hits});
  // 另一个"暂停"三秒——即不调用 update
  assert.equal(JSON.stringify({phase:frozen.boss.phase,round:frozen.boss.round,shots:frozen.bossShots,relic:frozen.bossRelic,hits:frozen.boss.hits}),JSON.stringify({phase:'idle',round:0,shots:[],relic:null,hits:0}));
  // 然后从暂停点继续同样的帧数，结果必须一致
  for(let i=0;i<120*3;i++)frozen.update(1/120);
  assert.equal(JSON.stringify({phase:frozen.boss.phase,round:frozen.boss.round,shots:frozen.bossShots,relic:frozen.bossRelic,hits:frozen.boss.hits}),snapshot,'暂停不改变战斗数值');
});

test('retrying the boss resets its rounds with the checkpoint, so deaths cannot be farmed',()=>{
  const game=atBoss();
  // 打到第二轮
  let reached=false;
  for(let i=0;i<120*60;i++){
    {const action=bossInput(game);if(action)game[action]();}
    game.update(1/120);
    game.drainEvents();
    if(game.boss.round>=2){reached=true;break;}
    if(game.state!=='running')break;
  }
  assert.ok(reached,`应能推进到第二轮，实际 phase=${game.boss.phase} round=${game.boss.round}`);
  game.restoreCheckpoint(true);
  assert.equal(game.boss.round,0,'重试必须把轮数清零');
  assert.equal(game.boss.phase,'idle');
  assert.deepEqual(game.bossShots,[]);
  assert.equal(game.bossRelic,null);
  assert.equal(game.boss.hits,0);
  // 检查点本身在 Boss 之前，所以回档后重新入场是干净的
  assert.ok(game.checkpoint<DISTRICT.boss.x);
});

test('boss schema rejects unwinnable or unreadable designs',()=>{
  const base=DISTRICT.boss;
  const problemsFor=patch=>validateLevel({...DISTRICT,boss:{...base,...patch}});
  assert.ok(problemsFor({windup:.3}).some(p=>p.includes('预警过短')));
  assert.ok(problemsFor({rounds:1}).some(p=>p.includes('轮数')));
  assert.ok(problemsFor({rounds:9}).some(p=>p.includes('轮数')));
  assert.ok(problemsFor({trigger:base.x+100}).some(p=>p.includes('触发点')));
  assert.ok(problemsFor({relics:base.relics.slice(0,1)}).some(p=>p.includes('反击器物数量')));
  assert.ok(problemsFor({stations:base.stations.filter(s=>s.kind!=='bell')}).some(p=>p.includes('缺少协同点')));
  // 追逐模型的两条新硬约束：前方距离过小会退回"贴脸"，过大则军官出屏。
  assert.ok(problemsFor({lead:120}).some(p=>p.includes('前方距离')));
  assert.ok(problemsFor({lead:900}).some(p=>p.includes('前方距离')));
  // 齐射至少两发，间隔不能短到读不出招。
  assert.ok(problemsFor({volley:1}).some(p=>p.includes('齐射发数')));
  assert.ok(problemsFor({gap:.2}).some(p=>p.includes('齐射间隔')));
  // 器物必须落在玩家前方，且不能超过军官所在处。
  assert.ok(problemsFor({relicLead:60}).some(p=>p.includes('器物投放距离')));
  assert.ok(problemsFor({relicLead:base.lead+200}).some(p=>p.includes('器物投放距离')));
});

test('counter requires jumping, has flight time, and missed pickups cannot bypass the boss',()=>{
  const game=atBoss();
  assert.ok(advanceUntil(game,()=>game.boss.phase==='window'));
  const before=game.boss.hits;
  for(let i=0;i<120*2;i++)game.update(1/120);
  assert.equal(game.boss.hits,before,'地面直跑不应自动反击');
  assert.ok(game.bossRelic.x>game.x,'漏捡后在前方重投');
  assert.ok(advanceUntil(game,()=>game.boss.phase==='counter'));
  assert.equal(game.boss.hits,before,'拾到时不提前扣 Boss 血');
  for(let i=0;i<60;i++)game.update(1/120);
  assert.equal(game.boss.hits,before,'飞行尚未结束');
  for(let i=0;i<20;i++)game.update(1/120);
  assert.equal(game.boss.hits,before+1);
  game.x=DISTRICT.world.end+100;game.prevX=game.x;
  game.update(1/120);assert.equal(game.state,'running','不能跑过 Boss 直接结算');
  assert.ok(advanceUntil(game,()=>game.boss.phase==='defeated'));
  assert.equal(game.state,'won','延展桥段上仍能拾印并完成');
});

test('Han Hui blocks one hit per fight and a clean route does not consume her ward',()=>{
  const game=atBoss();game.update(.2);assert.ok(game.inBossFight);
  game.hurt();assert.equal(game.health,3);assert.equal(game.boss.ward,false);
  game.invulnerable=0;game.hurt();assert.equal(game.health,2);
  game.restoreCheckpoint(true);assert.equal(game.boss.ward,true);
  const clean=atBoss();runBossFight(clean);assert.equal(clean.boss.ward,true,'无伤回放不能靠护身遮掩受击');
  assert.ok(clean.elapsed>38&&clean.elapsed<50,'战斗约四十秒，三轮有喘息和反击');
});

test('high blades require crouching and falling seals hurt only after their warning',()=>{
  for(const slide of [false,true]){
    const game=atBoss();game.update(.2);game.boss.ward=false;
    game.bossShots=[{x:game.x+3,y:544,speed:0,kind:'high',age:0}];
    if(slide)game.slide();game.update(1/120);assert.equal(game.health,slide?3:2);
  }
  for(const height of [80,180,320,600]){
    const airborne=atBoss();airborne.update(.2);airborne.boss.ward=false;
    airborne.y-=height;airborne.grounded=false;airborne.vy=0;
    airborne.bossShots=[{x:airborne.x+3,speed:0,kind:'high',age:0}];
    airborne.update(1/120);assert.equal(airborne.health,2,`高位法术覆盖跳跃高度 ${height}`);
  }
  const game=atBoss();game.update(.2);game.boss.ward=false;
  game.bossShots=[{x:game.x+3,speed:0,kind:'fall',age:0,warning:1.05}];
  game.update(1/120);assert.equal(game.health,3);
  game.bossShots[0].x=game.x+3;game.bossShots[0].age=1.05;game.update(1/120);assert.equal(game.health,2);
});


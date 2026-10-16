import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, WORLD, registerLevel, validateLevel,
  jumpReach, doubleJumpReach, safeDoubleJumpReach, speedAt,
  groundHeight, hazardBox, chapterIndex,
} from '../src/level.js';
import { Runner } from '../src/physics.js';
import { Narrative } from '../src/narrative.js';

/** 造一个只有一段速度的最小关卡，用来单独测试断桥宽度判定。 */
const stub=(speed,gapWidth)=>({
  id:'stub', title:'stub', world:{...WORLD,end:9000},
  chapters:[{at:0,title:'A',speed}],
  terrain:[[0,606],[9000,606]],
  obstacles:[{id:'g1',type:'gap',x:4300,width:gapWidth}],
  springs:[], rings:[], shards:[], checkpoints:[],
  exits:[{id:'e',x:9000,event:'departure'}],
});

/** 用真实 Runner 跑一次跳跃，返回水平射程。airAt 为二段跳按键时刻（秒）。 */
function simulate(speed,airAt){
  const game=new Runner();
  game.level={...game.level,chapters:game.level.chapters.map((c,i)=>i===0?{...c,speed}:c)};
  game.x=960; game.prevX=960; game.y=game.groundAt(960); game.grounded=true; game.chapter=0;
  let jumped=false, doubled=false, t=0;
  while(t<3){
    t+=1/120;
    if(!jumped){game.jump();jumped=true;}
    else if(!doubled&&t>=airAt){game.jump();doubled=true;}
    game.update(1/120);
    if(game.state==='dead')break;
    // 落地即结束；airAt 给得足够大时就是单跳
    if(game.grounded&&t>.2)break;
  }
  return game.x-960;
}

test('prologue level passes its own validation',()=>{
  assert.deepEqual(validateLevel(LEVELS.prologue),[]);
});

test('reach formulas match the real 120Hz simulation',()=>{
  for(const speed of [310,345,375]){
    // 单跳：公式必须与模拟逐像素一致，否则校验就是在拿理论值骗自己
    assert.ok(Math.abs(jumpReach(speed)-simulate(speed,9))<1.5,
      `单跳射程公式 ${jumpReach(speed).toFixed(1)} 与模拟 ${simulate(speed,9).toFixed(1)} 不符`);
    // 二段跳可靠射程必须保守（不超过实际能跳出的距离）
    const safe=safeDoubleJumpReach(speed);
    let best=0,bestAt=1/120;
    for(let a=1/120;a<.9;a+=1/120){const r=simulate(speed,a);if(r>best){best=r;bestAt=a;}}
    const atSafe=simulate(speed,Math.max(1/120,bestAt-.12));
    assert.ok(safe<=atSafe+1,
      `可靠射程 ${safe.toFixed(0)} 应保守于实际 ${atSafe.toFixed(0)}`);
    // 极限射程是上限，可靠射程必须留出余量
    assert.ok(safe<doubleJumpReach(speed),'可靠射程应小于极限射程');
  }
});

test('slower segments have shorter reach; a wider gap is not always crossable',()=>{
  // 这正是旧素材包的核心错误：拿最高速的射程去要求所有路段
  assert.ok(jumpReach(310)<jumpReach(345)&&jumpReach(345)<jumpReach(375));
  assert.ok(safeDoubleJumpReach(310)<safeDoubleJumpReach(375));
  const reachableAt310=stub(310,300), reachableAt375=stub(375,300);
  assert.deepEqual(validateLevel(reachableAt310),[]);
  assert.deepEqual(validateLevel(reachableAt375),[]);
  // 超出低速段可靠射程的宽度必须被拒
  const tooWide=stub(310,doubleJumpReach(310)+20);
  assert.ok(validateLevel(tooWide).some(p=>p.includes('断桥不可通过')));
});

test('illegal obstacle ids and types are rejected',()=>{
  const dup=stub(310,100);
  dup.obstacles=[{id:'same',type:'block',x:100,width:40,height:60},
                 {id:'same',type:'block',x:300,width:40,height:60}];
  assert.ok(validateLevel(dup).some(p=>p.includes('障碍 id 重复')));

  const badType=stub(310,100);
  badType.obstacles=[{id:'x',type:'spike',x:100,width:40}];
  assert.ok(validateLevel(badType).some(p=>p.includes('障碍类型非法')));

  const noId=stub(310,100);
  noId.obstacles=[{type:'block',x:100,width:40,height:60}];
  assert.ok(validateLevel(noId).some(p=>p.includes('障碍缺少 id')));
});

test('structural errors are reported: terrain, chapters, checkpoints, exits, collectibles',()=>{
  const bad=stub(310,100);
  bad.terrain=[[0,606],[4000,606],[2000,550]];
  assert.ok(validateLevel(bad).some(p=>p.includes('地形 x 未递增')));

  const chapters=stub(310,100);
  chapters.chapters=[{at:0,title:'A',speed:310},{at:0,title:'B',speed:300}];
  assert.ok(validateLevel(chapters).some(p=>p.includes('章节 at 未递增')));

  const zeroSpeed=stub(310,100);
  zeroSpeed.chapters=[{at:0,title:'A',speed:0}];
  assert.ok(validateLevel(zeroSpeed).some(p=>p.includes('章节速度非法')));

  const cp=stub(310,100);
  cp.checkpoints=[5000,3000];
  assert.ok(validateLevel(cp).some(p=>p.includes('检查点')));

  const outOfRange=stub(310,100);
  outOfRange.checkpoints=[999999];
  assert.ok(validateLevel(outOfRange).some(p=>p.includes('检查点')));

  const noExitEvent=stub(310,100);
  noExitEvent.exits=[{id:'e',x:9000}];
  assert.ok(validateLevel(noExitEvent).some(p=>p.includes('缺少 event')));

  const shardOut=stub(310,100);
  shardOut.shards=[{id:'s0',x:999999,y:500}];
  assert.ok(validateLevel(shardOut).some(p=>p.includes('碎片')));
});

test('registerLevel refuses invalid data and accepts valid data',()=>{
  const bad=stub(310,doubleJumpReach(310)+40);
  assert.throws(()=>registerLevel(bad),/校验未通过/);
  assert.equal(LEVELS[bad.id],undefined,'非法关卡不得进入目录');

  const good={...stub(310,200)};
  registerLevel(good);
  assert.equal(LEVELS[good.id],good);
  delete LEVELS[good.id];
});

test('Runner loads a level and rejects incomplete data',()=>{
  const game=new Runner();
  assert.equal(game.level,LEVELS.prologue);
  const custom=stub(345,200);
  game.loadLevel(custom);
  assert.equal(game.level,custom);
  assert.equal(game.groundAt(500),606,'地面查询应走当前关卡地形');
  assert.throws(()=>game.loadLevel({id:'x'}),/关卡数据不完整/);
  assert.throws(()=>game.loadLevel(null),/关卡数据不完整/);
});

test('level helpers are pure functions over level data',()=>{
  const terrain=[[0,600],[1000,600],[2000,500]];
  assert.equal(groundHeight(terrain,500,606),600);
  assert.equal(groundHeight(terrain,1500,606),550);
  assert.equal(groundHeight(terrain,9999,606),606,'超出地形应回落到默认地面');
  assert.equal(chapterIndex([{at:0},{at:100},{at:200}],150),1);
  assert.equal(speedAt([{at:0,speed:310},{at:100,speed:345}],150),345);
  // gap 没有实体碰撞盒
  assert.equal(hazardBox({type:'gap',x:0,width:10},600),null);
  const box=hazardBox({type:'block',x:100,width:60,height:80},600);
  assert.equal(box.top,525);
});

test('quest lookup survives null and empty quest lists',()=>{
  // 序章路径会显式传 null（该关没有自己的任务表），曾经在这里崩掉主循环
  const narrative=new Narrative();
  assert.doesNotThrow(()=>narrative.quest(1000,null));
  assert.doesNotThrow(()=>narrative.quest(1000,undefined));
  assert.doesNotThrow(()=>narrative.quest(1000,[]));
  assert.equal(narrative.quest(0,null).label,'与弥娅携心离开灰城');
  assert.equal(narrative.quest(999999,null).label,'抵达无名之门遗址');
  // 有任务表时按表走
  const quests=[{at:0,label:'A'},{at:100,label:'B'}];
  assert.equal(narrative.quest(150,quests).label,'B');
});

import {bossInput} from './runner-input.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {Runner} from '../src/physics.js';
import {Cinematic,SCENE_DURATIONS} from '../src/cinematics.js';
import {groundAt, jumpReach, LEVELS} from '../src/level.js';
import {DISTRICT} from '../src/level-district.js';

// Canvas test double checks runtime branches, not pixel appearance (browser QA covers that).
function withFakeDom(run){
  const oldWindow=globalThis.window;globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  const gradient={addColorStop(){}};
  const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:1440,height:810})};
  try{return run(new Renderer(canvas));}
  finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
}

test('renderer completes populated trails, all biomes, transitions and cinematic frames',()=>{
  withFakeDom((renderer)=>{
    const p=new Runner();
    for(const [chapter,x] of [[0,2300],[1,9300],[1,12900],[2,18500],[2,22200],[2,27600]]){
      p.chapter=chapter;renderer.trail=[];
      for(let i=0;i<90;i++){p.x=x+i;p.prevX=p.x-1;p.y=p.prevY=groundAt(p.x);p.elapsed+=1/120;renderer.sample(p);}
      assert.doesNotThrow(()=>renderer.render(1/60,p,'running',.5));
      renderer.reducedMotion=true;assert.doesNotThrow(()=>renderer.render(1/60,p,'running'));renderer.reducedMotion=false;
    }
    for(const type of Object.keys(SCENE_DURATIONS)){
      const scene=new Cinematic();scene.begin(type);
      for(let i=0;i<10;i++){scene.update(SCENE_DURATIONS[type]/10);assert.doesNotThrow(()=>renderer.render(1/60,p,type,1,scene.sample()));}
    }
  });
});

test('renderer draws a non-prologue level from its own data',()=>{
  withFakeDom((renderer)=>{
    const game=new Runner(DISTRICT);
    // 走遍三个地点、铜片、缺口与出口，确认新关卡每个绘制分支都跑得到
    for(const x of [500,11500,14750,16500,24600,28600,31200,37700,39800,42000,45000,47200]){
      game.x=x;game.prevX=x-1;game.y=game.groundAt(x);game.prevY=game.y;
      game.chapter=DISTRICT.chapters.reduce((i,c,j)=>x>=c.at?j:i,0);
      game.elapsed+=1/120;renderer.trail=[];renderer.sample(game);
      assert.doesNotThrow(()=>renderer.render(1/60,game,'running',.5));
      assert.equal(renderer.view.level,DISTRICT,'renderer 应使用当前关卡数据');
      // 地面查询必须走新关卡地形，而不是序章
      assert.equal(renderer.view.groundAt(x),game.groundAt(x));
    }
    // 主线铜片被取走后不应再画
    game.x=37700;game.y=game.groundAt(37700);game.items.add('plate-ferry');
    assert.doesNotThrow(()=>renderer.render(1/60,game,'running',1));
  });
});

test('district declares its own scenery per chapter',()=>{
  // 失名街区不该继续借用序章那三套远景：它是有人住的街区，不是死城。
  assert.ok(Array.isArray(DISTRICT.scenery),'失名街区应按章节声明远景');
  assert.equal(DISTRICT.scenery.length,DISTRICT.chapters.length,'远景数量应与章节数一致');
  for(const name of DISTRICT.scenery) assert.equal(typeof name,'string');
  // 序章没有 scenery，保持原样（老关卡的默认表现不能被改动）
  assert.equal(LEVELS.prologue.scenery,undefined);
});

test('renderer draws each district scene without falling back to the prologue',()=>{
  withFakeDom((renderer)=>{
    const game=new Runner(DISTRICT);
    for(const [index,name] of DISTRICT.scenery.entries()){
      const x=DISTRICT.chapters[index].at+700;
      game.x=x;game.prevX=x-1;game.y=game.groundAt(x);game.prevY=game.y;
      game.chapter=index;game.elapsed+=1/120;renderer.trail=[];renderer.sample(game);
      assert.doesNotThrow(()=>renderer.render(1/60,game,'running',.5));
      assert.deepEqual(renderer.view.scenery,DISTRICT.scenery,'渲染器应读到关卡自带的远景');
    }
    // 章节交叠的 500px 内会同时画旧景与新景，这一带也必须画得出来
    const at=DISTRICT.chapters[1].at;
    for(const x of [at-500,at-260,at,at+120]){
      game.x=x;game.prevX=x-1;game.y=game.groundAt(x);game.prevY=game.y;
      assert.doesNotThrow(()=>renderer.render(1/60,game,'running',.4));
    }
  });
});

test('renderer produces finite geometry across the whole district',()=>{
  withFakeDom((renderer)=>{
    const game=new Runner(DISTRICT);
    const seen=[];
    // 用真实回放采样，确保轨迹、粒子与飘带都不产生 NaN
    const handled=new Set();let doubleAt=null;
    for(let frame=0;frame<120*260&&game.state==='running';frame++){
      const next=DISTRICT.obstacles.find(o=>!handled.has(o.id)&&o.x>game.x-100);
      if(next){const lead=next.type==='beam'?48:next.type==='gap'?30:100;
        if(game.x>=next.x-lead){handled.add(next.id);
          if(next.type==='beam')game.slide();
          else{game.jump();
            // 与序章/失名街区的回放策略一致：单跳不够时延后到 0.38s 再跃
            const speed=DISTRICT.chapters[DISTRICT.chapters.reduce((i,c,j)=>next.x>=c.at?j:i,0)].speed;
            if(next.type==='gap'&&next.width>jumpReach(speed)-12)doubleAt=game.elapsed+.38;}}}
      if(doubleAt!==null&&game.elapsed>=doubleAt){game.jump();doubleAt=null;}
      if(game.grounded&&game.projectiles.some(p=>p.x>game.x&&p.x-game.x<(game.level.chapters[game.chapter].speed+p.speed)*.19)){game.jump();}
      {const action=bossInput(game);if(action)game[action]();}
      game.update(1/120);renderer.sample(game);
      if(frame%7===0){
        assert.doesNotThrow(()=>renderer.render(1/60,game,'running',.5));
        seen.push(game.x);
        for(const p of renderer.particles){
          assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`粒子坐标非法 @${game.x.toFixed(0)}`);
        }
        for(const point of renderer.trail){
          assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y),`轨迹坐标非法 @${game.x.toFixed(0)}`);
        }
      }
    }
    assert.ok(seen.length>100,'应采样到足够多的帧');
    assert.equal(game.state,'won');
  });
});

test('ground grass roots stay anchored to the world across camera positions',()=>{
  // 回归：草曾用屏幕序号 j 当噪声序号（floor(worldStart/32)+j），
  // 而位置用 left+j*32。worldStart 不是 32 整数倍时两者错位，
  // 同一世界位置的草会换成另一株——看上去整片草沿地面滑动。
  // 这里直接抽取草根描线，换算回世界坐标后比较两次不同镜头的结果。
  const oldWindow=globalThis.window;
  globalThis.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  const grassRoots=(worldStart,left)=>{
    const roots=[];
    // 只关心草那几条描线：它们从草根 (x,y) 出发
    const ctx={globalAlpha:1,
      createLinearGradient:()=>({addColorStop(){}}),
      createRadialGradient:()=>({addColorStop(){}}),
      fillRect(){},beginPath(){},closePath(){},fill(){},arc(){},ellipse(){},rect(){},
      clip(){},save(){},restore(){},bezierCurveTo(){},quadraticCurveTo(){},
      fillText(){},translate(){},rotate(){},setTransform(){},scale(){},
      measureText:()=>({width:0}),stroke(){},
      moveTo(x,y){ctx._p=[[x,y]];},
      lineTo(x,y){ctx._p.push([x,y]);},
      stroke(){ // 4 点折线 = 草
        if(ctx._p&&ctx._p.length===4) roots.push(ctx._p[0][0]);
      },
    };
    const r=new Renderer({getContext:()=>ctx,getBoundingClientRect:()=>({width:1440,height:810})});
    r.view={level:{id:'prologue'},world:{ground:600},terrain:[[0,600],[99999,600]],
      chapters:[{at:0}],obstacles:[],groundAt:()=>600};
    r.groundSegment(ctx,left,left+600,600,worldStart,1.5);
    // 屏幕坐标换算回世界坐标
    return roots.map(sx=>sx+worldStart-left);
  };
  const a=grassRoots(40000,0);
  const b=grassRoots(40016,0);      // 镜头推移 16px（32 的整数倍之外）
  assert.ok(a.length>3,`应采到足够多的草，实际 ${a.length}`);
  // 两根草之间必然存在"同一世界坐标在两次采样中都有草"的情况；
  // 若草随镜头漂移，这组世界坐标会完全对不上。
  const setA=[...new Set(a)].sort((x,y)=>x-y);
  const setB=[...new Set(b)].sort((x,y)=>x-y);
  assert.deepEqual(setA,setB,'不同镜头下草根的世界坐标必须一致');
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
});

test('bridge and support rendering never duplicate the three companions',()=>{
  withFakeDom(renderer=>{
    const game=new Runner(DISTRICT);game.x=39900;game.y=606;renderer.view=renderer.viewFor(game);
    renderer.bridgeMemory=3;
    for(const phase of ['idle','charge','window','defeated']){
      const people=[];renderer.npc=(c,x,y,kind)=>people.push(kind);
      game.boss.phase=phase;renderer.landmarks(renderer.ctx,39500,1400,0,game);renderer.bossStations(renderer.ctx,39500,1400,0,game);
      assert.deepEqual(people.sort(),['bell','ferry','healer'],phase+' 只画三个同行者');
    }
  });
});

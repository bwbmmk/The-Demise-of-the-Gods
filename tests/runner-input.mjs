import {chainPattern} from '../src/chain-boss.js';
// Deterministic QA input: react only to visible shots and collectibles.
export function bossInput(game,lead=.19){
  if(game.level.boss?.kind==='chain'&&game.inBossFight){
    const B=game.boss;game.setBrake(B.phase==='aim'&&game.x>=B.anchorX-10);
    const shot=(game.bossShots||[]).find(s=>s.x>game.x&&s.x-game.x<(game.level.chapters[game.chapter].speed+s.speed)*.23);
    if(shot&&game.grounded)return shot.kind==='high'?'slide':'jump';
    if(B.phase==='impact'){
      const wave=chainPattern(game.level.boss,B).waves.find(w=>w.at>B.age);
      if(wave){const left=wave.at-B.age;
        if(game.grounded&&left>.1&&left<.32)return 'jump';
        if(wave.height>120&&!game.grounded&&game.jumpsLeft===1&&left>.1&&left<.2)return 'jump';
      }
    }
    return null;
  }
  const speed=game.level.chapters[game.chapter].speed;
  const fall=(game.bossShots||[]).find(s=>s.kind==='fall'&&s.x>game.x-50&&s.x-game.x<speed*.55);
  if(fall){
    if(game.grounded)return 'jump';
    if(game.jumpsLeft===1&&game.vy>-160)return 'jump';
  }
  if(!game.grounded)return null;
  const shot=(game.bossShots||[]).filter(s=>s.x>game.x&&s.x-game.x<(speed+s.speed)*(s.kind==='wave'?.32:lead)).sort((a,b)=>a.x-b.x)[0];
  if(shot)return shot.kind==='high'?'slide':'jump';
  const relic=game.bossRelic;
  if(relic&&!relic.gone&&relic.x>game.x&&relic.x-game.x<speed*.29)return 'jump';
  return null;
}
// React to authored obstacle cues and visible mechanism states, never grant immunity.
export function routeInput(game,state){
  const L=game.level,speed=L.chapters[game.chapter].speed;
  // 复活/回滚后玩家会退回起点，但 handled 仍记着上一轮的障碍——
  // 于是同一个坑不会被再跳一次，QA 会莫名其妙"掉进已经处理过的坑"。
  // 这里清掉落在玩家身后的记录，让 QA 每次经过都重新决策。
  // 雨阵的锁定目标同样要清：它按 round 缓存，不清的话回滚后会拿着
  // 上一个 round 的站位（可能远在身后），于是"前进"变成"永远到不了"。
  if(state.lastX!=null&&game.x<state.lastX-400){state.handled.clear();state.rainGoal=null;state.rainRound=null;}
  state.lastX=game.x;
  const duel=game.finalDuel;
  if(duel&&!['idle','defeated'].includes(duel.phase)){
    game.setBrake(true);
    duel.setMove(0);
    duel.setHeld(duel.phase==='recall');
    if(['aim','attack'].includes(duel.phase)){
      const columns=duel.entities.filter(e=>e.kind==='rain'||e.kind==='eruption');
      if(columns.length){
        // 候选站位沿用 arena-250..arena+100（71 个点）。
        // ⚠️ 试过把它放宽到场地真实边界（arena-300..arena+140），结果**更差**：
        //   零伤路线从"擦线过关"恶化成"必掉一血"。
        //   原因是 QA 会挑最近的安全点，一旦两端可选，它更容易被吸引到贴墙位置，
        //   而贴墙对后续的追踪型招式（hunt / 横波）是**死角**，退无可退。
        //   所以范围不是越大越好：这个窄范围把 QA 天然地留在场地中段，
        //   反而是它零伤通关的一部分。真玩家比 QA 灵活，不受这个限制。
        const positions=Array.from({length:71},(_,i)=>duel.arena-250+i*5);
        // ⚠️ hunt 必须单独处理，不能走下面那套"找最近安全点"。
        //
        //   原因（实测逐帧抓到的）：hunt 的三根矛**会跟着你走**（trackUntil），
        //   它们的 x 恒等于玩家当前 x。于是 `|e.x - 候选点| > 46` 这条约束，
        //   相对玩家而言永远是"离我 46px 以上"——左右各有一个最近的格子，
        //   而"取最近"会随玩家位置在两者之间反复翻：
        //     x=10795 → 选左边 → 走 2.5px → x=10798 → 选右边 → 又走回来 …
        //   实测就是一个 3px 的极限环，QA 原地抖动，矛锁在原地，落下即中（掉一血）。
        //
        //   hunt 的正确读法是**朝一个方向一直跑**：三根矛分别在 0 / 0.2 / 0.82s
        //   锁定，跑起来它们就依次落在身后。真人玩家就是这么躲的。
        const huntTracking=duel.attack==='hunt'&&duel.phase==='attack'
          &&columns.some(e=>e.trackUntil&&e.age<e.trackUntil);
        if(huntTracking){
          // 朝空间更大的一侧跑，避免把自己逼到墙角（贴墙后没地方可跑）。
          if(!state.huntDir)state.huntDir=(game.x-duel.left)>(duel.right-game.x)?-1:1;
          duel.setMove(state.huntDir);
        }else{
          state.huntDir=0;
          const safe=positions.filter(x=>columns.every(e=>Math.abs(e.x-x)>e.width/2+(['sweepfire','hunt'].includes(duel.attack)?17:25)));
          const target=safe.sort((a,b)=>Math.abs(a-game.x)-Math.abs(b-game.x))[0];
          if(target!==undefined&&Math.abs(target-game.x)>2)duel.setMove(Math.sign(target-game.x));
        }
      }
      if(duel.attack==='crossfire'&&duel.phase==='aim'){
        const target=duel.arena-80;if(Math.abs(target-game.x)>3)duel.setMove(Math.sign(target-game.x));
      }
      if(duel.attack==='edict'&&(duel.phase==='attack'||duel.spec.warning-duel.age<.19)&&!game.slideTime)game.slide();
    }
    for(const e of duel.entities){
      if(e.warning||e.age<e.delay||!e.speed)continue;
      const time=(e.x-game.x)/(-(e.dir||-1)*e.speed);
      if(time<0)continue;
      if(e.kind==='high'){
        if(time<.23&&game.grounded&&!game.slideTime)game.slide();
      }else if(e.kind==='tall'){
        if(time<.54&&game.grounded)game.jump();
        else if(time<.34&&game.jumpsLeft===1&&game.vy>-350)game.jump();
      }else if(time<.3&&game.grounded)game.jump();
    }
    if(duel.phase==='recall'&&duel.orb){
      const d=duel.orb.x-game.x;
      if(duel.orb.height>90&&d<145&&d>0&&game.grounded)game.jump();
      if(duel.orb.height>160&&d<65&&d>0&&game.jumpsLeft===1&&game.vy>-360)game.jump();
    }
    return;
  }
  if(L.echo){
    const wall=L.echoWalls.find(w=>game.x>w.x-40&&game.x<w.x+w.width+35);
    game.setEcho(!wall);
  }
  if(L.brake&&!game.inBossFight){
    const z=(L.tidalChannels||[]).find(z=>game.x>=z.x-100&&game.x<z.x-25);
    const tide=z&&game.tidalState(z);game.setBrake(!!z&&(!tide.open||tide.left<(z.width+150)/speed));
    // 第四幕 · 实体连段：躲实体 + 捡星火 + 门闩注入。
    const D=game.dawn;
    if(D&&!['idle','defeated'].includes(D.phase)){
      const wedge=game.blockingWedge;
      const near=wedge&&wedge.x-game.x<300;
      game.setBrake(L.dawn.baitWedges?false:!!near&&D.phase!=='stagger');
      const hammer=game.dawnEntities.find(e=>e.kind==='hammer');
      if(hammer?.locked&&game.x>hammer.x-hammer.radius-45)game.setBrake(true);
      else if(hammer?.locked&&D.phase!=='stagger')game.setBrake(false);
      if(D.phase==='exposed'&&near&&game.grounded)game.strike();
      for(const e of game.dawnEntities||[]){
        if(e.telegraph||!e.armed)continue;
        if(e.kind==='hammer')continue;
        if(e.kind==='cinder'||e.kind==='meteor'){
          if(Math.abs(game.x-e.x)<e.radius+20&&e.landIn-e.age<.22&&game.grounded)game.jump();
        }else{
          const dist=e.x-game.x;
          if(e.age<(e.delay||0))continue;
          if(e.kind==='sweep'){
            if(dist<145&&dist>-90&&game.grounded&&!game.slideTime)game.slide();
          }else if(e.kind==='pulse'){
            if(dist<340&&dist>0&&game.grounded)game.jump();
            else if(dist<195&&dist>0&&game.jumpsLeft===1&&game.vy>-350)game.jump();
          }else if(dist<145&&dist>0&&game.grounded)game.jump();
        }
      }

    }
  }
  const next=L.obstacles.find(o=>!state.handled.has(o.id)&&o.x>game.x-100);
  if(next&&game.x>=next.x-(next.type==='beam'?48:next.type==='gap'?30:100)){
    // ⚠️ beam 要等**落地**才滑（实测 x=42755 撞穿 beam@42760）。
    //   physics.slide 在空中的语义是"下砸"（vy=max(vy,900)），不是滑铲——
    //   于是玩家还在上一道梁的滞空里就请求第二次滑铲，得到的不是滑铲而是加速下坠，
    //   从 y=361 一路砸到 y=488，正好撞进第二道梁。
    //   而且这里提前 state.handled.add 会把障碍"记成处理过"，
    //   落地后就不会再补一次滑铲——双重失误。
    //   正确做法：空中只**记账**，落地那一刻再真的滑。
    if(next.type==='beam'&&!game.grounded){
      // ⚠️ 空中**什么都不做**，注释与代码曾经相反过，这是实测 x=42794 的元凶。
      //   旧代码在这里 `state.handled.add(next.id)`，于是：
      //     ① 障碍被记成"处理过" → 落地后 line341 的 find 跳过它，不再补滑铲；
      //     ② 更糟的是它同时让 line171 的 jumpBlocksBeam 失效——
      //        那一行是 `beam && !handled.has(o.id) && o.x-game.x<speed*.78`，
      //        障碍一旦被提前记账，"前方有梁所以别起跳"的保护就整个消失。
      //   于是玩家在 42722 仍然起跳（还在上升 vy=-213），
      //   站着撞进 beam@42800 的判定盒 {top:322,bottom:479}，掉一血。
      //   正确语义：空中保持未处理，落地那一刻才真的滑。
      //   （若已在前一道梁的滑铲中，slideTime>0，落地后由下面 else 分支处理。）
    }else{
      state.handled.add(next.id);
      if(next.type==='beam')game.slide();
      else{
        game.jump();
        const wind=(L.windZones||[]).some(z=>next.x>=z.from&&next.x<=z.to);
        if(next.type==='gap'&&!next.steps&&!wind&&next.width>speed*.73-12)state.doubleAt=game.elapsed+.38;
      }
    }
  }
  const p=game.platformAt(game.x);
  if(p&&game.grounded&&game.x>=p.x+p.width-45&&!state.handled.has(p.id)){
    state.handled.add(p.id);game.jump();state.doubleAt=game.elapsed+.38;
  }
  if(state.doubleAt!=null&&game.elapsed>=state.doubleAt){game.jump();state.doubleAt=null;}
  if(game.grounded&&(L.tides||[]).some(t=>!game.mechanismStates.get(t.id).done&&t.x>game.x&&t.x-game.x<135))game.jump();
  if(game.grounded&&game.projectiles.some(p=>p.x>game.x&&p.x-game.x<(speed+p.speed)*.19))game.jump();
  const action=bossInput(game);if(action)game[action]();
}



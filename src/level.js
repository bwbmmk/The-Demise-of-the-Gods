// 所有距离、速度和高度均使用逻辑像素，与设备像素密度无关。
//
// 0.4 起本文件从「单关常量」改为「关卡目录 + schema」。
// 序章仍是默认关卡，数据与 0.3.1 完全一致，保证回归通过。
//
// 关键约束：跳跃射程必须按**该段实际速度**计算。
// 310 速度下单跳水平射程约 229px，375 速度下约 277px；
// 早期外部关卡草案用最高速统一估算，导致低速段断桥实际不可通过。
// validateLevel 会按每段速度重算射程并拒绝不可达的设计。

export const WORLD = Object.freeze({
  ground: 606, gravity: 1760, firstJump: -650, airJump: -605,
  runHeight: 70, slideHeight: 29, playerHalfWidth: 13,
  coyoteTime: .11, jumpBuffer: .14, slideDuration: .72, slideCooldown: .16,
  end: 27600,
});

// 风印（spring）的弹射参数。
//
// 起因：这段 vy=-800 原本硬编码在 physics.js 的弹板分支里，
// 而"弹射走廊会不会撞上横梁"这类校验又需要用到它——
// 同一份物理参数存在两个来源，就迟早会对不上（实测第四幕 x=42794）。
// 现在物理与校验都从这里读，改一处即可。
export const SPRING_LAUNCH_VY = -800;
// 横梁判定盒的净空高度，见 hazardBox：top = ground - 200。
// 弹板跃起高度 SPRING_LAUNCH_VY²/(2g) ≈ 182px < 200px，
// 也就是说**被风印托起的人飞不过横梁**，只能滑铲过去。
// 因此弹射走廊内不能有任何横梁——这是构建期硬规则。
export const BEAM_CLEAR_HEIGHT = 200;

export const CHAPTERS = [
  { at: 0, title: '灰烬之城', subtitle: 'I · THE CITY OF ASH', numeral: 'I', speed: 310, line: '北面的街道还在。跟弥娅去无名之门。' },
  { at: 9200, title: '无声圣所', subtitle: 'II · THE SILENT SANCTUARY', numeral: 'II', speed: 345, line: '神死了，连着神殿的回路还在收取记忆。' },
  { at: 18400, title: '神骸之桥', subtitle: 'III · THE BRIDGE OF BONES', numeral: 'III', speed: 375, line: '门就在桥后。里面或许有烬的名字。' },
];

// 连续坡面：视觉和碰撞共用这一条高度曲线，绝不使用"假台阶"。
export const TERRAIN = [[0,606],[6000,606],[6270,550],[7000,550],[7290,606],[9450,606],[9740,528],[11200,528],[11480,606],[12300,606],[12600,565],[14300,565],[14600,606],[15700,606],[16000,520],[17700,520],[18000,606],[19800,606],[20100,545],[21850,545],[22150,606],[23300,606],[23600,565],[25200,565],[25500,606],[27600,606]];
export function groundAt(x) { return groundHeight(TERRAIN, x, WORLD.ground); }
export const SPRINGS=[{id:'wind-0',x:6100,width:100},{id:'wind-1',x:24420,width:100}];
export const RINGS=[{id:'ring-0',x:6870,y:350},{id:'ring-1',x:15240,y:390},{id:'ring-2',x:24650,y:380}];

// 手工编排的序章。block=跳跃，beam=滑铲，gap=断桥。
const layout = [
  ['block', 1600, 58, 65], ['beam', 2770, 140], ['gap', 4000, 180],
  ['gap', 5400, 320], ['block', 6760, 68, 80], ['beam', 7750, 155], ['block', 8590, 62, 72],
  ['beam', 9970, 170], ['block', 10860, 70, 85], ['gap', 11800, 280],
  ['beam', 13040, 180], ['block', 14080, 80, 90], ['gap', 15100, 340],
  ['beam', 16380, 180], ['block', 17440, 80, 75],
  ['gap', 19280, 290], ['beam', 20500, 185], ['block', 21540, 90, 92],
  ['gap', 22600, 365], ['beam', 23900, 195], ['block', 24960, 95, 90],
  ['gap', 26050, 345],
];

export const OBSTACLES = layout.map(([type,x,width,height], index) => ({ id:`hazard-${index}`, type,x,width, height:height || 0 }));
export const SHARDS = [];
function shard(x, y) { SHARDS.push({ id:`memory-${SHARDS.length}`, x, y }); }
for (let x = 780; x < WORLD.end - 700; x += 470) {
  if (!OBSTACLES.some(o => x > o.x - 170 && x < o.x + o.width + 180)) shard(x, WORLD.ground - 45);
}
for (const o of OBSTACLES) {
  if (o.type === 'block') { shard(o.x - 38, WORLD.ground - 125); shard(o.x + o.width + 30, WORLD.ground - 140); }
  if (o.type === 'gap') {
    for (let i = 0; i < 3; i++) shard(o.x + o.width * (i + .5) / 3, WORLD.ground - 115 - Math.sin((i+.5)/3*Math.PI)*48);
  }
  if (o.type === 'beam') shard(o.x + o.width / 2, WORLD.ground - 18);
}
for(const s of SHARDS) s.y+=groundAt(s.x)-WORLD.ground;
for(const spring of SPRINGS) for(let i=0;i<5;i++) shard(spring.x+60+i*60,groundAt(spring.x+60+i*60)-75-Math.sin(i/5*Math.PI)*100);
export const TUTORIALS = [
  { from: 0, to: 600, text: '你会自动前行 · 携余火穿过长夜' },
  { from: 950, to: 1740, text: '残碑挡路 · 按 空格 / ↑ 跃过' },
  { from: 2200, to: 2940, text: '神骸低垂 · 按 ↓ / S 滑铲穿过' },
  { from: 3440, to: 4180, text: '前方断桥 · 在边缘起跳' },
  { from: 4730, to: 5790, text: '更宽的深渊 · 跃起后，再按一次跳跃' },
  { from: 5830, to: 6500, text: '踏上青色风印，会被托向高处 · 可在空中再跃' },
  { from: 6500, to: 7100, text: '高处的共鸣环 · 穿环可补充余火，地面路线仍可通过' },
];
export function chapterAt(distance) { return chapterIndex(CHAPTERS, distance); }

/**
 * 在指定地形上求地面高度。地形不足两点时回落到该关卡的默认地面。
 * 所有查询都走这个纯函数，level 数据本身不携带方法，便于序列化与校验。
 */
export function groundHeight(terrain, x, fallback) {
  for (let i = 1; i < terrain.length; i++) if (x < terrain[i][0]) {
    const [ax, ay] = terrain[i - 1], [bx, by] = terrain[i];
    return ay + (by - ay) * Math.max(0, (x - ax) / (bx - ax));
  }
  return fallback;
}

/** 障碍的碰撞盒。gap 没有实体碰撞盒，返回 null。 */
export function hazardBox(o, ground) {
  if (o.type === 'block') return { left: o.x + 5, right: o.x + o.width - 5, top: ground - o.height + 5, bottom: ground };
  if (o.type === 'beam') return { left: o.x + 6, right: o.x + o.width - 6, top: ground - 200, bottom: ground - 43 };
  return null;
}

export function hazardBounds(o) { return hazardBox(o, groundAt(o.x)); }

// --------------------------------------------------------------------------- //
// 0.4 · 关卡 schema 与校验
// --------------------------------------------------------------------------- //

/**
 * 单跳水平射程。逐帧复刻物理层的积分顺序（先加重力、再位移），
 * 因此结果就是玩家真能跳出的距离，而不是连续近似的理论值。
 */
export function jumpReach(speed) {
  const dt = 1 / 120;
  const { gravity, firstJump } = WORLD;
  let y = 0, vy = firstJump, t = 0;
  while (t < 3) {
    t += dt; vy += gravity * dt; y += vy * dt;
    if (y >= 0 && vy >= 0) break;
  }
  return t * speed;
}

/**
 * 二段跳水平射程：取最优按键时机的结果，是这套物理的射程上限。
 */
export function doubleJumpReach(speed) {
  const dt = 1 / 120;
  const { gravity, firstJump, airJump } = WORLD;
  let best = 0;
  for (let trigger = dt; trigger < 0.9; trigger += dt) {
    let y = 0, vy = firstJump, t = 0, fired = false;
    while (t < 3) {
      t += dt; vy += gravity * dt; y += vy * dt;
      if (!fired && t >= trigger) { vy = airJump; fired = true; }
      if (y >= 0 && vy >= 0) break;
    }
    if (t * speed > best) best = t * speed;
  }
  return best;
}

/**
 * 可靠射程：留出 tolerance 秒的时机容差后仍能达到的距离。
 *
 * 二段跳的射程随按键时机单调上升，所以「最晚按」就是极限，
 * 而玩家实际是在空中观察落点后按键。把容差加在极限之前，
 * 得到的就是一个技术合格的玩家稳定能跳出的距离。
 * 极限值本身不可依赖——它要求精确到帧的时机。
 */
export function safeDoubleJumpReach(speed, tolerance = 0.12) {
  const dt = 1 / 120;
  const { gravity, firstJump, airJump } = WORLD;
  const reach = (trigger) => {
    let y = 0, vy = firstJump, t = 0, fired = false;
    while (t < 3) {
      t += dt; vy += gravity * dt; y += vy * dt;
      if (!fired && t >= trigger) { vy = airJump; fired = true; }
      if (y >= 0 && vy >= 0) break;
    }
    return t * speed;
  };
  // 先找到最优时机，再往前挪 tolerance 作为可靠时机。
  let bestT = dt, best = 0;
  for (let trigger = dt; trigger < 0.9; trigger += dt) {
    const r = reach(trigger);
    if (r > best) { best = r; bestT = trigger; }
  }
  return reach(Math.max(dt, bestT - tolerance));
}

/** 找出距离 x 最近的段落速度。 */
export function speedAt(chapters, x) {
  return chapters[chapterIndex(chapters, x)].speed;
}
/** 找出距离 x 落在哪一段。chapters 需按 at 递增。 */
export function chapterIndex(chapters, x) {
  return chapters.reduce((index, chapter, i) => x >= chapter.at ? i : index, 0);
}

/**
 * 校验关卡数据。返回问题数组，空数组表示通过。
 * 目的是让「结构看起来合理但实际不可通关」的草案在合并前就被拦下。
 */
export function validateLevel(level) {
  const problems = [];
  const { id, world, chapters, terrain, obstacles, springs = [], rings = [], shards = [], exits = [] } = level;

  if (!id) problems.push('缺少关卡 id');
  if (!Array.isArray(terrain) || terrain.length < 2) problems.push('地形至少需要两个点');
  if (!Array.isArray(chapters) || !chapters.length) problems.push('缺少章节分段');

  // 地形必须严格按 x 递增，否则 groundAt 会静默算错
  for (let i = 1; i < (terrain || []).length; i++) {
    if (terrain[i][0] <= terrain[i - 1][0]) {
      problems.push(`地形 x 未递增：索引 ${i}（${terrain[i - 1][0]} → ${terrain[i][0]}）`);
      break;
    }
  }

  // 障碍 ID 唯一且类型合法
  const seen = new Set();
  const legalTypes = new Set(['block', 'beam', 'gap']);
  for (const o of obstacles || []) {
    if (!o.id) problems.push(`障碍缺少 id（x=${o.x}）`);
    else if (seen.has(o.id)) problems.push(`障碍 id 重复：${o.id}`);
    else seen.add(o.id);
    if (!legalTypes.has(o.type)) problems.push(`障碍类型非法：${o.id} = ${o.type}`);
  }

  // 核心检查：按每段实际速度验证断桥是否真的跳得过去
  for (const o of obstacles || []) {
    if (o.type !== 'gap') continue;
    const speed = speedAt(chapters, o.x);
    const single = jumpReach(speed);
    const safe = safeDoubleJumpReach(speed);
    if(level.echo){
      const stones=(level.echoPlatforms||[]).filter(p=>p.x>o.x&&p.x<o.x+o.width).sort((a,b)=>a.x-b.x);
      if(!stones.length)problems.push(`照忆桥缺少落脚石：${o.id}`);
      let edge=o.x;
      for(const p of stones){if(p.x-edge>safe-70)problems.push(`照忆桥石台不可达：${p.id}`);edge=p.x+p.width;}
      if(o.x+o.width-edge>safe-40)problems.push(`照忆桥出口不可达：${o.id}`);
      continue;
    }
    if(o.steps){
      const platforms=(level.platforms||[]).filter(p=>p.x>o.x&&p.x+p.width<o.x+o.width).sort((a,b)=>a.x-b.x);
      if(!platforms.length)problems.push(`梦桥 ${o.id} 缺少落脚踏板`);
      let edge=o.x;
      for(const p of platforms){if(p.x-edge>safe-40)problems.push(`梦桥踏板不可达：${p.id}`);edge=p.x+p.width;}
      if(o.x+o.width-edge>safe-40)problems.push(`梦桥出口不可达：${o.id}`);
      continue;
    }
    // 起跳需要提前量：从边缘起跳最理想，额外留 12px 容差。
    // 用「可靠射程」而非理论极限——极限值要求逐帧精确按键，实际做不到。
    if (o.width > safe - 12) {
      problems.push(
        `断桥不可通过：${o.id} 宽 ${o.width}px，该段速度 ${speed} 下可靠二段跳射程仅 ${safe.toFixed(0)}px` +
        `（单跳 ${single.toFixed(0)}px，极限二段跳 ${doubleJumpReach(speed).toFixed(0)}px 不可依赖）`
      );
    } else if (o.width > single - 12) {
      // 需要二段跳是允许的设计，但要确认不是宽到必须极限操作
      if (o.width > safe * 0.94) {
        problems.push(`断桥 ${o.id} 宽 ${o.width}px 接近可靠二段跳射程 ${safe.toFixed(0)}px，缺少容错`);
      }
    }
  }

  // 障碍判定盒 vs 地形起伏。
  //
  // ⚠️ 这条检查对应一个真实的死局，值得写清楚：
  // hazardBox 只吃**一个标量** ground，调用方一律传 groundAt(障碍左端)。
  // 玩家踩的却是 groundAt(自己 x)。只要障碍跨度内有上坡，这两者就会错开——
  // 上坡让右侧地面升高，玩家的滑铲顶跟着升高，而梁底还停在左端的高度，
  // 于是滑铲顶会**低于**梁底。这道梁就物理上无解了：滑没用，跳更没用。
  //
  // 第四幕实测踩中过：beam@35600 落在 31px 上坡上，余量 -12.3px。
  // 所以这类错配不能靠"摆数据时注意"，必须在构建期就被拦下来。
  {
    const gAt = (x) => groundHeight(terrain, x, world?.ground ?? 0);
    const slideTop = -(WORLD.slideHeight - 5);   // 滑铲时头顶相对脚下
    for (const o of obstacles || []) {
      if (o.type !== 'beam' && o.type !== 'block') continue;
      const base = gAt(o.x);
      let hi = Infinity, lo = -Infinity;
      for (let x = o.x; x <= o.x + o.width; x += 4) {
        const s = gAt(x);
        if (s < hi) hi = s;
        if (s > lo) lo = s;
      }
      if (o.type === 'beam') {
        // 通行高度 43（见 hazardBox）；玩家在最高地面点滑铲时头顶 = hi + slideTop
        const margin = (hi + slideTop) - (base - 43);
        if (margin < 0) {
          problems.push(
            `横梁无解：${o.id} @${o.x} 跨度内地面抬升 ${(base - hi).toFixed(1)}px，` +
            `滑铲顶比梁底还低 ${(-margin).toFixed(1)}px（判定盒锚在左端 ${base.toFixed(1)}，` +
            `右端地面已到 ${hi.toFixed(1)}）——请把梁挪到平缓段`
          );
        } else if (margin < 6) {
          problems.push(`横梁余量不足：${o.id} @${o.x} 滑铲净空仅 ${margin.toFixed(1)}px，需要操作零误差`);
        }
      } else {
        // 实心块：右侧地面下坠会让块底悬空，玩家可以从缝里钻过去——
        // 那就等于这个块不存在。块底锚在左端，所以下坠量就是悬空量。
        const drop = lo - base;
        if (drop > 6) {
          problems.push(`实心块悬空：${o.id} @${o.x} 右侧地面下坠 ${drop.toFixed(1)}px，块底与地面之间出现可钻的缝`);
        }
        // 最低地面点上，块顶相对脚下更高，跳跃必须够得到
        const need = drop + o.height;
        const reach = Math.abs(world?.firstJump ?? 650) ** 2 / (2 * (world?.gravity ?? 1760));
        if (need > reach - 20) {
          problems.push(
            `实心块跳不过去：${o.id} @${o.x} 最低点净空需求 ${need.toFixed(1)}px，` +
            `跳跃净高仅 ${reach.toFixed(1)}px`
          );
        }
      }
    }
  }

  // 风印（spring）走廊校验。
  //
  // 起因：第四幕实测掉血 @x=42794。上一版把重音连滑放在 beam@42800，
  // 而 wind-dawn-chest 弹板就在 [42600,42700]——玩家滑完前一道梁落地即踩上弹板，
  // 被 physics.js:1014 强制 `vy = -800` 托起，滞空 0.909s × 360px/s ≈ 327px，
  // 落点约 42927，正好横穿 beam@42800 的判定盒，站着撞死。
  //
  // 为什么这在设计上是**无解**而不是"操作失误"：
  //   1. 弹板是自动触发、不可取消的（`grounded && x∈[x, x+width]` 就弹，没有冷却）；
  //   2. 弹板的跃起高度只有 vy²/(2g) = 800²/(2×1760) ≈ 182px，
  //      而横梁判定盒从 ground-200 起——**被托起的人物理上飞不过横梁**，只能滑铲；
  //   3. 于是"过梁"与"上弹板"在走廊内互斥，没有任何操作能同时满足。
  // 所以这类冲突必须在构建期就拦下，不能靠摆数据时注意。
  if (springs.length) {
    const g0 = world?.gravity ?? 1760;
    const speedAt = (x) => {
      let v = chapters?.[0]?.speed ?? 330;
      for (const c of chapters || []) if (x >= c.at) v = c.speed;
      return v;
    };
    for (const s of springs) {
      const v = speedAt(s.x + (s.width || 0) / 2);
      const air = 2 * Math.abs(SPRING_LAUNCH_VY) / g0;         // 滞空时间
      const reach = air * v;                                     // 水平射程
      // ⚠️ 走廊是**单向**的：弹板只把人往 +x 抛（横向速度恒为正），
      //   所以只有右侧的射程区间需要检查。
      //   早先写成对称的 [x−reach, x+width+reach]，结果把序章 wind-1 误判成冲突：
      //   那道梁 hazard-19@23900 在弹板**左侧** 400px，玩家先滑完梁、
      //   再跑过弹板才被抛飞，落点 [24761,24861] 根本碰不到它。
      //   方向搞反的校验比没有校验更糟——它会逼着你去改本来正确的布局。
      const lo = s.x, hi = s.x + (s.width || 0) + reach;
      for (const o of obstacles || []) {
        if (o.type !== 'beam') continue;                         // 只有横梁是无解（见上）
        if (o.x < hi && o.x + o.width > lo) {
          problems.push(
            `横梁落在风印走廊内：${o.id} @${o.x} 落在 ${s.id} 的弹射走廊 ` +
            `[${lo}, ${hi.toFixed(0)}] 内（滞空射程 ${reach.toFixed(0)}px @${v}px/s，向右）。` +
            `弹板跃起仅 ${(Math.abs(SPRING_LAUNCH_VY) ** 2 / (2 * g0)).toFixed(1)}px，` +
            `低于横梁判定盒的 ${BEAM_CLEAR_HEIGHT}px，飞不过去——请把梁挪出走廊`
          );
        }
      }
      // 滑铲出口也不能压在触发区间上：滑完梁就必然踩上弹板。
      // 玩家在 x - 48 起滑，滑铲覆盖 slideDuration 秒。
      for (const o of obstacles || []) {
        if (o.type !== 'beam') continue;
        const out = (o.x - 48) + (world?.slideDuration ?? 0.72) * v;
        if (out >= s.x && o.x + o.width <= s.x) {
          problems.push(
            `风印触发区间被滑铲出口覆盖：${o.id} @${o.x} 的滑铲出口在 ${out.toFixed(0)}，` +
            `已在 ${s.id} 的 [${s.x}, ${s.x + (s.width || 0)}] 内——` +
            `玩家滑完这道梁就必然被强制托飞。请把梁左移或缩短滑铲覆盖`
          );
        }
      }

    }
  }

  // 章节分段：at 递增、落在关卡内、速度为正
  const end = world?.end ?? terrain?.at(-1)?.[0];
  for (let i = 0; i < (chapters || []).length; i++) {
    const c = chapters[i];
    if (i > 0 && c.at <= chapters[i - 1].at) problems.push(`章节 at 未递增：${c.title}`);
    if (c.at < 0) problems.push(`章节 at 为负：${c.title}`);
    if (end && c.at >= end) problems.push(`章节起点超出关卡末端：${c.title} @ ${c.at} ≥ ${end}`);
    if (!(c.speed > 0)) problems.push(`章节速度非法：${c.title} = ${c.speed}`);
    if (!c.title) problems.push(`章节缺少标题：@ ${c.at}`);
  }

  // 检查点：必须在关卡内且递增
  for (let i = 1; i < (level.checkpoints || []).length; i++) {
    if (level.checkpoints[i] <= level.checkpoints[i - 1]) {
      problems.push(`检查点未递增：${level.checkpoints[i]} ≤ ${level.checkpoints[i - 1]}`);
    }
  }
  for (const cp of level.checkpoints || []) {
    if (end && (cp < 0 || cp >= end)) problems.push(`检查点越界：${cp}`);
  }
  // 检查点不能落在障碍里。复活时玩家被直接放到 checkpoint 上，
  // 如果那里正是断桥或实心块，就会「一读档就掉下去」——而且因为不经过
  // 任何输入，测试里表现为莫名的死亡，很难追。这条是硬约束。
  for (const cp of level.checkpoints || []) {
    for (const o of obstacles || []) {
      if (o.type === 'gap') {
        if (cp > o.x + 3 && cp < o.x + o.width - 3) problems.push(`检查点 ${cp} 落在断桥 ${o.id} 上，复活即坠落`);
      } else if (cp > o.x - 20 && cp < o.x + o.width + 20) {
        problems.push(`检查点 ${cp} 落在障碍 ${o.id}（${o.type}）内，复活即受击`);
      }
    }
  }
  // 检查点与章节起点必须对齐（physics 用 chapters[n].at 推进 checkpoint）。
  // 检查点可以少，但每一个都必须正好落在某个章节起点上；否则会出现
  // "存档点永远到不了"的隐性错位。章节起点不必都是检查点：第 0 章就是起点本身。
  // Boss 练习场只有一个入场点、没有章节推进，不适用这条。
  if (!level.bossOnly) for (const cp of level.checkpoints || []) {
    if (!chapters.some(c => Math.abs(c.at - cp) < 0.5)) problems.push(`检查点不在任何章节起点上：${cp}`);
  }

  // 收集物与机制元素必须落在关卡内
  for (const s of springs) if (s.x < 0 || (end && s.x > end)) problems.push(`风印越界：${s.id}`);
  for (const r of rings) if (r.x < 0 || (end && r.x > end)) problems.push(`共鸣环越界：${r.id}`);
  for (const s of shards) if (s.x < 0 || (end && s.x > end)) problems.push(`碎片越界：${s.id}`);

  // 主线物品：既要落在关卡内，也必须不需要极限操作就能拿到。
  // 「写在可完成路径上」是可验证的——高度超过安全跳跃上限就意味着要靠二段跳极限。
  const items = level.items || [];
  const itemIds = new Set();
  for (const it of items) {
    if (!it.id) { problems.push(`物品缺少 id（x=${it.x}）`); continue; }
    if (itemIds.has(it.id)) problems.push(`物品 id 重复：${it.id}`);
    itemIds.add(it.id);
    if (it.x < 0 || (end && it.x > end)) { problems.push(`物品越界：${it.id}`); continue; }
    const ground = groundHeight(terrain || [], it.x, world?.ground);
    const rise = ground - it.y;
    if (rise < 0) {
      problems.push(`物品埋在地面下：${it.id}（y=${it.y} 高于地面 ${ground}）`);
    } else if (!it.required && rise > WORLD.firstJump*WORLD.firstJump/(2*WORLD.gravity)-10) {
      problems.push(
        `主线物品取不到：${it.id} 高出地面 ${rise.toFixed(0)}px，` +
        `该段单跳射程仅 ${jumpReach(speedAt(chapters || [], it.x)).toFixed(0)}px`
      );
    }
    // 主线物品不能压在障碍里，否则玩家必须先受伤
    for (const o of obstacles || []) {
      if (it.x > o.x - 20 && it.x < o.x + o.width + 20) {
        problems.push(`物品 ${it.id} 与障碍 ${o.id} 重叠，可能无法无伤取得`);
      }
    }
  }

  // 出口：必须在关卡末端附近，且声明触发点
  for (const e of exits) {
    if (end && Math.abs(e.x - end) > 400) problems.push(`出口 ${e.id} 距关卡末端过远：${e.x} vs ${end}`);
    if (!e.event) problems.push(`出口 ${e.id} 缺少 event`);
  }

  // 物品本身发出 item 事件；无需再放同名旗标重复解锁剧情。
  const flagIds = new Set();
  const flagEvents = new Set();
  for (const flag of level.flags || []) {
    if (!flag.id) { problems.push(`旗标缺少 id（x=${flag.x}）`); continue; }
    if (flagIds.has(flag.id)) problems.push(`旗标 id 重复：${flag.id}`);
    flagIds.add(flag.id);
    if (!flag.event) problems.push(`旗标 ${flag.id} 缺少 event`);
    if (flag.x < 0 || (end && flag.x > end)) problems.push(`旗标越界：${flag.id}`);
    if (flag.event) flagEvents.add(flag.event);
  }
  for (const it of items) if(!it.event)problems.push(`物品 ${it.id} 缺少 event`);

  const enemyIds=new Set();
  for(const enemy of level.enemies||[]){
    if(!enemy.id||enemyIds.has(enemy.id))problems.push('守灯人 id 缺失或重复');
    enemyIds.add(enemy.id);
    if(!Number.isFinite(enemy.x)||!Number.isFinite(enemy.trigger)||enemy.trigger<0||enemy.x>=end||enemy.trigger>=enemy.x)problems.push(`守灯人位置非法：${enemy.id}`);
    if(!Number.isFinite(enemy.windup)||enemy.windup<.6||!Number.isFinite(enemy.speed)||enemy.speed<=0||!Number.isInteger(enemy.shots)||enemy.shots<1||enemy.shots>2||!Number.isFinite(enemy.interval)||enemy.interval<.5)problems.push(`守灯人预警或弹幕非法：${enemy.id}`);
  }

  // 机制 Boss：与守灯人分开建模，因为规则完全不同——
  // 守灯人是一发就散的街道危险，Boss 有三轮可读阶段、必须给玩家预警窗口，
  // 而且它的成败由 NPC 协同机制（敲钟破盾 / 缆绳送道具 / 护身）决定。
  // 复用 enemies 数组会把这些差异压平成同一条校验线。
  const boss=level.boss;
  if(boss){
    if(!boss.id)problems.push('Boss 缺少 id');
    if(!Number.isFinite(boss.x)||boss.x<=0||(end&&boss.x>end))problems.push(`Boss 位置越界：${boss.id}`);
    if(!Number.isFinite(boss.trigger)||boss.trigger<0)problems.push(`Boss 触发点非法：${boss.id}`);
    // 触发点必须在 Boss 身前，玩家先看见军官再进入战斗；
    if(Number.isFinite(boss.trigger)&&Number.isFinite(boss.x)&&boss.trigger>=boss.x)problems.push(`Boss 触发点应在 Boss 之前：${boss.id}`);
    if(!Number.isInteger(boss.rounds)||boss.rounds<2||boss.rounds>4)problems.push(`Boss 轮数应为 2–4：${boss.id}`);
    if(boss.kind==='chain'&&(!level.brake||boss.rounds!==3||!Number.isFinite(boss.lead)||boss.lead<300||boss.lead>400))problems.push('巨像需要刹步、三条锁链与可见站位');
    if(boss.kind==='chain'){
      if(!Array.isArray(boss.patterns)||boss.patterns.length!==3)problems.push('巨像需要三轮明确的攻击配置');
      else for(const p of boss.patterns){
        if(![p.aim,p.lock,p.tolerance].every(Number.isFinite)||p.aim<1.8||p.lock<.65||p.tolerance<40||!['low','high',null].includes(p.attack)||!Array.isArray(p.waves)||!p.waves.length||p.waves.some((v,i)=>!Number.isFinite(v.at)||!Number.isFinite(v.height)||v.at<.6||v.height<40||v.height>160||(i>0&&v.at-p.waves[i-1].at<.75)))problems.push('巨像招式预警或震波间隔不可读');
      }
    }
    if(boss.kind!=='chain'){
    // 每轮预警必须足够长，玩家能读到预兆再起跳躲开。
    // 0.9 秒是下限：比守灯人的 0.6 秒更宽松，因为 Boss 的法术是本关最重的判定。
    if(!Number.isFinite(boss.windup)||boss.windup<.9)problems.push(`Boss 预警过短：${boss.id}`);
    if(!Number.isFinite(boss.cast)||boss.cast<.6)problems.push(`Boss 法术时长非法：${boss.id}`);
    if(!Number.isFinite(boss.speed)||boss.speed<=0)problems.push(`Boss 弹速非法：${boss.id}`);
    if(!Number.isFinite(boss.shield)||boss.shield<=0)problems.push(`Boss 护盾时长非法：${boss.id}`);
    // 追逐关系：军官会飞、与玩家同速，靠 lead 自然停在玩家前方。
    // lead 太小会退回"贴着 Boss 打"，太大则军官跑出屏幕、玩家看不见预警。
    if(!Number.isFinite(boss.lead)||boss.lead<240||boss.lead>680)problems.push(`Boss 前方距离应在 240–680：${boss.id}`);
    // 齐射：至少 2 发才有"连续躲"的压力；间隔太短会变成无法读招的弹幕。
    if(!Number.isInteger(boss.volley)||boss.volley<2||boss.volley>5)problems.push(`Boss 齐射发数应为 2–5：${boss.id}`);
    if(!Number.isFinite(boss.gap)||boss.gap<.5)problems.push(`Boss 齐射间隔过短：${boss.id}`);
    // 反击器物必须落在玩家前方够远、但仍能在跑到之前看清的位置。
    if(!Number.isFinite(boss.relicLead)||boss.relicLead<120||boss.relicLead>boss.lead)problems.push(`Boss 器物投放距离非法：${boss.id}`);
    // 反击器物：每轮一件，且必须能被拾取再补发。
    // 位置在运行时由 relicLead 决定，所以这里不再要求静态 x/y。
    if(!Array.isArray(boss.patterns)||boss.patterns.length!==boss.rounds||boss.patterns.some(p=>!Array.isArray(p)||p.length<2||p.length>5||p.some(k=>!['low','high','fall','wave'].includes(k))))problems.push('Boss 攻击组合非法');
    const relics=boss.relics||[];
    if(relics.length!==boss.rounds)problems.push(`Boss 反击器物数量应与轮数一致：${boss.id}`);
    const relicIds=new Set();
    for(const relic of relics){
      if(!relic.id||relicIds.has(relic.id))problems.push(`Boss 反击器物 id 缺失或重复：${boss.id}`);
      relicIds.add(relic.id);
      if(!Number.isFinite(relic.life)||relic.life<3)problems.push(`Boss 反击器物存在时间过短：${relic.id}`);
    }
    // NPC 协同点：敲钟、缆绳、护身都必须在玩家与 Boss 之间，且互相错开，
    // 否则玩家会在同一屏里同时处理两件协同，失去"依次轮到谁"的节奏。
    const stations=boss.stations||[];
    const kinds=new Set();
    const xs=[];
    for(const station of stations){
      if(!['bell','rope','ward'].includes(station.kind))problems.push(`Boss 协同点类型非法：${boss.id}/${station.kind}`);
      if(kinds.has(station.kind))problems.push(`Boss 协同点重复：${station.kind}`);
      kinds.add(station.kind);
      if(!Number.isFinite(station.x)||station.x<0||(end&&station.x>end))problems.push(`Boss 协同点越界：${station.kind}`);
      xs.push(station.x);
    }
    for(const kind of ['bell','rope','ward'])if(!kinds.has(kind))problems.push(`Boss 缺少协同点：${kind}`);
    xs.sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)if(Math.abs(xs[i]-xs[i-1])<80)problems.push(`Boss 协同点过近，无法依次处理：${boss.id}`);
  }
  }
  const mechanisms=[...(level.tides||[]),...(level.platforms||[])],mechanismIds=new Set();
  for(const m of mechanisms){
    if(!m.id||mechanismIds.has(m.id))problems.push('路线机关 id 缺失或重复');mechanismIds.add(m.id);
    if(![m.x,m.trigger,m.warning,m.life].every(Number.isFinite)||!(m.x>m.trigger&&m.trigger>=0&&m.x<end&&m.warning>=.5&&m.life>=.3))problems.push(`路线机关预警或位置非法：${m.id}`);
  }
  for(const p of level.platforms||[])if(!(p.width>=100&&Number.isFinite(p.y)&&p.y<world.ground&&p.life>=3))problems.push(`梦桥踏板非法：${p.id}`);
  for(const w of level.windZones||[])if(!(w.from>=0&&w.to>w.from&&w.to<=end&&w.lift>=.5&&w.lift<=1&&w.push>=0&&w.push<=120))problems.push(`风域参数非法：${w.id}`);
  for(const z of level.tidalChannels||[]){
    if(!z.id||mechanismIds.has(z.id))problems.push('水道 id 缺失或重复');mechanismIds.add(z.id);
    const speed=(level.chapters.filter(c=>c.at<=z.x).at(-1)||level.chapters[0]).speed;
    if(!level.brake||![z.x,z.width,z.period,z.open,z.offset||0].every(Number.isFinite)||z.x<100||z.width<200||z.x+z.width>end||z.period<=z.open+1||z.open<(z.width+150)/speed)problems.push(`水道位置或退潮窗口不可通行：${z.id}`);
  }
  for(const p of level.platforms||[])if(p.collapse!=null&&(!Number.isFinite(p.collapse)||p.collapse<.45))problems.push(`木桥断裂预警过短：${p.id}`);
  if(level.echo){
    const echoIds=new Set();
    for(const p of level.echoPlatforms||[]){
      if(!p.id||echoIds.has(p.id)||![p.x,p.y,p.width].every(Number.isFinite)||p.x<0||p.x+p.width>end||p.width<120||p.y<world.ground-100||p.y>=world.ground)problems.push('照忆石台位置非法');echoIds.add(p.id);
    }
    for(const wall of level.echoWalls||[]){
      if(!wall.id||echoIds.has(wall.id)||![wall.x,wall.width,wall.top,wall.bottom].every(Number.isFinite)||wall.x<0||wall.x+wall.width>end||wall.width<20||wall.top>=world.ground-200||wall.bottom<world.ground)problems.push('照忆封墙位置非法');echoIds.add(wall.id);
      if((level.echoPlatforms||[]).some(p=>wall.x<p.x+p.width+35&&wall.x+wall.width>p.x-35))problems.push('照忆封墙必须留出空中收光与再照亮的距离');
    }
    for(const r of level.rescues||[])if(!r.id||!level.flags?.some(f=>f.id===r.id&&f.manual)||!Number.isFinite(r.x)||r.x<0||r.x>end||r.seconds<.8||r.seconds>2)problems.push('救援点与手动旗标不匹配');
    const z=level.greyChase;if(!z||!level.brake||!Number.isFinite(z.speed)||z.speed<=0||z.speed>=speedAt(chapters,z.trigger)||z.lead<500)problems.push('灰潮追逐必须留出救援和移动余量');
  }
  // 第四幕：追逐式王座。与第二幕「站定对准唯一的桩」必须机制不同，
  // 校验的重点是这几条能不能保证它是一个**可读、可解、有代价**的决策：
  //   · 楔是**实心路障** → 不砸开就过不去；撞上去只是被挡停，不再回档（第四幕存档点太远）
  //   · 断楔靠**举火引锤** → 王被引到楔上落锤，锤替玩家开路；引锤半径要够宽，
  //     因为玩家已经被楔挡停在 w.x−40，站位不该退化成像素级对准
  //   · 落锤锁点 + 判伤半径 → 不挪窝才挨打；挪窝安全但楔不断，代价是明确的
  //   · 追兵只在王收锤时逼近 → 在楔前等锤是安全的，只有磨蹭才被惩罚
  const dawn=level.dawn;
  if(dawn){
    const wedges=dawn.wedges||[];
    if(!Number.isFinite(dawn.x)||dawn.x<=0||(end&&dawn.x>end))problems.push(`黎明王位置越界：${dawn.x}`);
    if(!Number.isFinite(dawn.trigger)||dawn.trigger<0||dawn.trigger>dawn.x)problems.push('黎明王触发点应在王座之前');
    if(!(wedges.length>=3&&wedges.length<=3))problems.push(`黎明楔应为三根：${wedges.length}`);
    const wedgeIds=new Set();
    for(const w of wedges){
      if(!w.id||wedgeIds.has(w.id))problems.push('黎明楔 id 缺失或重复');wedgeIds.add(w.id);
      if(![w.x,w.y].every(Number.isFinite)||w.x<=dawn.trigger||(end&&w.x>end))problems.push(`黎明楔位置非法：${w.id}`);
    }
    for(let i=1;i<wedges.length;i++)if(wedges[i].x-wedges[i-1].x<600)problems.push('黎明楔过近，玩家来不及在两次落锤之间走位');
    if(!level.brake)problems.push('第四幕需要地面刹步，否则玩家无法主动停在楔前');
    const bait=dawn.strike||{};
    // 引锤半径：楔会把玩家挡停在 w.x−40，所以 reach 只要为正就一定够得着；
    // 但太宽会让"走到楔前"这件事失去意义，太窄则挥火也引不到。
    if(!Number.isFinite(bait.reach)||bait.reach<120||bait.reach>560)problems.push(`引锤半径应在 120–560：${bait.reach}`);
    if(!Number.isFinite(dawn.aim)||dawn.aim<0.9)problems.push(`黎明王读条过短：${dawn.aim}`);
    // 容差是"锤能覆盖多宽的带"，落锤半径是"打中人的范围"。
    // 两者必须拉开明显差距，玩家才有"站在带上、但不在锤下"的位置可站，
    // 否则对准楔和挨打会变成同一件事，整幕退化成必吃伤害。
    if(!Number.isFinite(dawn.tolerance)||dawn.tolerance<180||dawn.tolerance>320)problems.push(`黎明楔容差应在 180–320：${dawn.tolerance}`);
    if(!Number.isFinite(dawn.hammer)||dawn.hammer<60||dawn.hammer>140)problems.push(`落锤半径应在 60–140：${dawn.hammer}`);
    if(Number.isFinite(dawn.tolerance)&&Number.isFinite(dawn.hammer)&&dawn.tolerance<dawn.hammer*1.15)problems.push('黎明楔容差必须明显大于落锤半径，否则对准楔就等于挨打');
    // 楔是致命路障：它必须比触发点靠后、且必须在终点之前，否则玩家可以绕过。
    const lastWedge=wedges.length?wedges[wedges.length-1].x:0;
    if(end&&lastWedge>=end-600)problems.push('最后一根楔离终点太近，砸开后没有落脚距离');
    const chase=dawn.chase||{};
    const dawnSpeed=(chapters.filter(c=>c.at<=dawn.trigger).at(-1)||chapters[0]).speed;
    // 追兵慢于玩家——它靠的是"你该跑却磨蹭时它不停"，而不是硬追。
    // 一次完整连段链的等待成本 = aim + recover + chainRest。
    const cycle=(Number.isFinite(dawn.aim)?dawn.aim:0)+(Number.isFinite(dawn.recover)?dawn.recover:0)
      +(Number.isFinite(dawn.chainRest)?dawn.chainRest:0.5)+(Number.isFinite(dawn.cadence)?dawn.cadence:0.35);
    if(!Number.isFinite(chase.speed)||chase.speed<=0)problems.push('追兵速度缺失');
    if(!Number.isFinite(chase.lead)||chase.lead<420||chase.lead>1100)problems.push(`追兵初始距离应在 420–1100：${chase.lead}`);
    if(!Number.isFinite(dawn.stumble)||dawn.stumble<.8)problems.push(`砸中楔后的喘息窗口过短：${dawn.stumble}`);
    if(!dawn.counterWindow&&Number.isFinite(chase.speed)&&chase.speed>0&&Number.isFinite(chase.lead)&&cycle>0){
      const waits=chase.lead/(chase.speed*cycle);
      // 付不起一次等待 → 本幕无解；能连等三次以上 → 磨蹭没有代价。
      if(waits<1.2)problems.push(`追兵太快：一次落锤循环就会贴上（只够 ${waits.toFixed(2)} 次等待）`);
      if(waits>3.2)problems.push(`追兵太慢：连等三次都不出事，磨蹭没有代价（够 ${waits.toFixed(2)} 次）`);
    }
    if(dawn.counterWindow&&(!Number.isFinite(dawn.counterWindow)||dawn.counterWindow<1.8))problems.push('反灌窗口不足以完成两次注入');
    for(const phase of dawn.phases||[])for(const chain of phase){
      if(!Array.isArray(chain)||chain.length<1||chain.length>6||chain.some(id=>!dawn.moves?.[id]))problems.push('执炬王连招包含未知招式或长度非法');
    }
    if(Number.isFinite(chase.lead)&&Number.isFinite(dawn.hammer)&&chase.lead<dawn.hammer*4)problems.push('追兵初始距离过小，一次失误就必死');
    // 仪式星火：门闩充能资源，必须够每道门闩注入 sealCost 次。
    const sparks=dawn.sparks||[];
    const sealNeed=(dawn.sealCost??2)*3;
    if(!dawn.baitWedges&&sparks.length<sealNeed)problems.push(`仪式星火太少（${sparks.length} < ${sealNeed}），门闩充不满`);
    const sparkIds=new Set();
    for(const s of sparks){
      if(!s.id||sparkIds.has(s.id))problems.push('仪式星火 id 缺失或重复');sparkIds.add(s.id);
      if(!Number.isFinite(s.x)||s.x<dawn.trigger||(end&&s.x>end))problems.push(`仪式星火位置非法：${s.id}`);
    }
    // 逆火余烬：这一幕的专属资源，校验重点是"它是资源而不是摆设"——
    // 太少就没有决策空间，太多就变成无脑冲；而且必须全在主路上，
    // 否则拿不到资源等于削掉整幕的核心动词。
    const embers=level.embers||[];
    if(embers.length<4)problems.push(`逆火余烬太少（${embers.length}），攒不出决策空间`);
    if(embers.length>9)problems.push(`逆火余烬太多（${embers.length}），冲刺会变成无脑操作`);
    const emberIds=new Set();
    for(const e of embers){
      if(!e.id||emberIds.has(e.id))problems.push('逆火余烬 id 缺失或重复');emberIds.add(e.id);
      if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||(end&&e.x>end))problems.push(`逆火余烬位置非法：${e.id}`);
      // 余烬必须**跑过去就吃得到**（胸前在地面上方 ~36px，判定半径 46）。
      // 允许区间取 −20～−80，比"能吃到"略宽一点，留给地形起伏。
      const floor=groundHeight(level.terrain,e.x,world.ground);
      if(!(e.y<floor-20&&e.y>floor-80))problems.push(`逆火余烬不在可拾取高度：${e.id}`);
      if(level.obstacles.some(o=>o.type!=='gap'&&e.x>o.x-30&&e.x<o.x+o.width+30))problems.push(`逆火余烬落进了实心障碍：${e.id}`);
    }
    const dashSpec=dawn.dash||{};
    if(!Number.isFinite(dashSpec.speed)||dashSpec.speed<120||dashSpec.speed>400)problems.push(`逆火冲刺速度应在 120–400：${dashSpec.speed}`);
    // 冲刺时长必须短于一次出招预警，否则可以靠冲刺硬吃一锤，
    // "停步等锤"这个核心决策就消失了。
    if(!Number.isFinite(dashSpec.duration)||dashSpec.duration<=0||dashSpec.duration>=dawn.aim)problems.push(`逆火冲刺时长必须短于出招预警（${dawn.aim}s）`);
    if(!Number.isFinite(dashSpec.max)||dashSpec.max<1||dashSpec.max>4)problems.push(`逆火余烬上限应在 1–4：${dashSpec.max}`);
  }
  if(level.finalBoss){
    const duel=level.finalBoss;
    if(!Number.isFinite(duel.trigger)||duel.trigger<0||duel.trigger>=end)problems.push('最终战触发点非法');
    if(!Number.isFinite(duel.arena)||duel.arena<duel.trigger+50||duel.arena>=end)problems.push('最终战场地非法或没有选择缓冲');
    if((level.obstacles||[]).some(o=>o.x+o.width>=duel.trigger))problems.push('最终战区必须保持净空');
  }
  return problems;
}

/**
 * 关卡目录。序章保持 0.3.1 原样，作为回归基准。
 * 后续关卡由各自模块导出后注册。
 */
export const LEVELS = {
  prologue: {
    id: 'prologue',
    title: '序章 · 灰烬之城',
    world: WORLD,
    chapters: CHAPTERS,
    terrain: TERRAIN,
    obstacles: OBSTACLES,
    springs: SPRINGS,
    rings: RINGS,
    shards: SHARDS,
    tutorials: TUTORIALS,
    checkpoints: [9200, 18400],
    exits: [{ id: 'threshold-1', x: WORLD.end, event: 'departure' }],
  },
};

export function registerLevel(level) {
  const problems = validateLevel(level);
  if (problems.length) {
    throw new Error(`关卡 ${level.id} 校验未通过:\n  - ${problems.join('\n  - ')}`);
  }
  LEVELS[level.id] = level;
  return level;
}

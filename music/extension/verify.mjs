// 扩展关卡数据自检：确保新章节数据在结构上可用，而不是"看起来合理"。
//
// 检查项
// ------
// 1. 地形单调递增（groundAt 依赖折线按 x 升序，乱序会静默算错高度）
// 2. 障碍全部落在地形范围内，且高度不超出上界
// 3. 相邻障碍间隔足够完成一次动作（避免出现物理上过不去的组合）
// 4. 每个新增机制都有对应的预告素材
// 5. 危险色与收集色不冲突
import {
  CHAPTERS_V2, makeGroundAt, buildObstacles,
  LUNG_SPRINGS, LUNG_BANNERS, TIDE_STEPS, SURGES,
  SHROUDS, BREATH_RINGS, WEAVES, PYRES, GRASPS, BOSS_PHASES,
  WORLD_V2,
} from './levels-v2.js';
import { HAZARDS, COLLECTIBLES, RELICS, validateHazards } from './hazards-and-items.js';

const problems = [];
const note = (chapter, msg) => problems.push(`[${chapter}] ${msg}`);

// 一次跳跃在最高速下能跨越的水平距离（保守估计）
// t_air ≈ 2 * |firstJump| / gravity ≈ 0.739s；速度取各章上限 375
const MAX_SPEED = 375;
const JUMP_AIRTIME = 2 * Math.abs(WORLD_V2.firstJump) / WORLD_V2.gravity;
const REACH = MAX_SPEED * JUMP_AIRTIME;          // 单跳水平射程
const DOUBLE_REACH = REACH * 1.55;                // 二段跳的保守加成

for (const chapter of CHAPTERS_V2) {
  const { id, terrain, layout } = chapter;

  // 1) 地形单调
  for (let i = 1; i < terrain.length; i++) {
    if (terrain[i][0] <= terrain[i - 1][0]) {
      note(id, `地形 x 未递增：索引 ${i} (${terrain[i - 1][0]} → ${terrain[i][0]})`);
    }
  }

  const groundAt = makeGroundAt(terrain);
  const obstacles = buildObstacles(id, layout);

  // 2) 障碍在地形范围内，高度合理
  const last = terrain.at(-1)[0];
  for (const o of obstacles) {
    if (o.x < 0 || o.x + o.width > last) note(id, `障碍越界：${o.id} @ ${o.x}`);
    if (o.type === 'block' && (o.height < 30 || o.height > 200)) {
      note(id, `残碑高度异常：${o.id} = ${o.height}（应 30–200）`);
    }
    if (o.type === 'beam' && (o.width < 120 || o.width > 320)) {
      note(id, `悬棺宽度异常：${o.id} = ${o.width}（应 120–320）`);
    }
  }

  // 3) 相邻障碍可完成：gap 的宽度必须落在单跳或二段跳射程内
  const gaps = obstacles.filter(o => o.type === 'gap');
  for (const gap of gaps) {
    if (gap.width > DOUBLE_REACH) {
      note(id, `断桥过宽无法通过：${gap.id} = ${gap.width}px（上限 ${DOUBLE_REACH.toFixed(0)}px）`);
    }
  }
  // 相邻动作间隔：两次动作之间至少留出 0.55s 的判断时间
  const sorted = [...obstacles].sort((a, b) => a.x - b.x);
  const minSpacing = MAX_SPEED * 0.55;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].x + sorted[i - 1].width;
    const spacing = sorted[i].x - prevEnd;
    if (spacing < minSpacing) {
      note(id, `动作间隔过密：${sorted[i - 1].id} → ${sorted[i].id} 仅 ${spacing.toFixed(0)}px（建议 ≥ ${minSpacing.toFixed(0)}px）`);
    }
  }
  chapter._obstacles = obstacles;
  chapter._groundAt = groundAt;
}

// 4) 机制与预告素材配对
const pairing = [
  ['风印', LUNG_SPRINGS.length, '风向预告', LUNG_BANNERS.length],
  ['潮汐台阶', TIDE_STEPS.length, '逆潮', SURGES.length],
  ['睡眠幕', SHROUDS.length, '呼吸环', BREATH_RINGS.length],
];
for (const [mech, a, cue, b] of pairing) {
  if (a > 0 && b === 0) problems.push(`机制「${mech}」有 ${a} 处，但缺少预告素材「${cue}」`);
}
if (WEAVES.length && !WEAVES.every(w => w.upper && w.lower)) problems.push('线织桥缺少上下两条线路定义');
if (PYRES.length < 3) problems.push(`烛台仅 ${PYRES.length} 个，不足以构成章末目标`);
if (GRASPS.some(g => !g.warning || g.warning < 0.7)) problems.push('巨神之手预警短于一个动作窗口');
if (BOSS_PHASES.length !== 3) problems.push(`Boss 段数应为 3，实际 ${BOSS_PHASES.length}`);

// 5) 颜色不冲突：危险为暗红系，收集为旧金系
const hazardWarm = HAZARDS.filter(h => ['memory-shard', 'resonance-ring'].includes(h.id));
if (hazardWarm.length) problems.push('敌方素材误用了收集物 ID');
const colorProblems = validateHazards();

const report = {
  chapters: CHAPTERS_V2.length,
  obstacles: CHAPTERS_V2.reduce((n, c) => n + c._obstacles.length, 0),
  reach: { single: Math.round(REACH), double: Math.round(DOUBLE_REACH) },
  mechanics: {
    windSprings: LUNG_SPRINGS.length, banners: LUNG_BANNERS.length,
    tideSteps: TIDE_STEPS.length, surges: SURGES.length,
    shrouds: SHROUDS.length, breathRings: BREATH_RINGS.length,
    weaves: WEAVES.length, pyres: PYRES.length, grasps: GRASPS.length,
  },
  collectibles: COLLECTIBLES.length,
  relics: RELICS.length,
  problems: [...problems, ...colorProblems],
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`章节 ${report.chapters} · 障碍 ${report.obstacles}`);
  console.log(`跳跃射程：单跳 ${report.reach.single}px · 二段跳 ${report.reach.double}px`);
  console.log('机制与预告：', report.mechanics);
  console.log(`收集物 ${report.collectibles} · 遗物 ${report.relics}`);
  if (report.problems.length) {
    console.log(`\n发现 ${report.problems.length} 个问题：`);
    for (const p of report.problems) console.log('  · ' + p);
    process.exitCode = 1;
  } else {
    console.log('\n全部检查通过。');
  }
}

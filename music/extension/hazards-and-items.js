// 《神之殇》扩展素材 · 敌人 · 收集物 · 道具 · 遗物
//
// 设计原则（严格遵守 docs/design-bible.md）
// ------------------------------------------
// 1. 本作是跑酷，不是战斗游戏。没有"敌人血量"与"攻击键"。
//    "敌方"一律是环境威胁：不可击杀，只能读懂并绕过。
//    这与 design-bible「胜利来自读懂环境，不是站桩削血」一致。
// 2. 危险色只用暗红系（#8a4640 / #bf7263），且必须有明确轮廓语言。
// 3. 收集物用旧金（#c7a978）小面积暖色，与危险的体积和颜色同时区分。
// 4. 遗物只预留一个装备槽，且必须"改变路线选择"而非"提高数值"。
//    明确排除：多层稀有度、数值付费、无限刷材料（见 design-bible 第 7 节）。

// --------------------------------------------------------------------------- //
// 一 · 敌方（环境威胁）
// --------------------------------------------------------------------------- //
// 每项描述：轮廓语言（玩家在远处能读到的形状）、预警时间、判定方式、出现章节。
// warning 单位为秒，全部满足 design-bible「预兆至少提前一个完整动作窗口」。
export const HAZARDS = [
  {
    id: 'godrend-ward', name: '残碑', nameEn: 'Shattered Ward', chapter: [0, 1, 2, 3, 4, 5],
    silhouette: '向上突起的断口，顶点有赤色菱形刻痕',
    action: 'jump', warning: 1.6,
    rule: '实体碰撞，站立撞上扣一格余火',
    readAt: '1400',      // 逻辑像素：玩家在此距离可辨认刻痕
    note: '序章已实现的三种危险之一，保持完全一致，不重新设计。',
  },
  {
    id: 'godrend-coffin', name: '低垂悬棺', nameEn: 'Hanging Coffin', chapter: [0, 1, 2, 3, 4, 5],
    silhouette: '从上方下垂的棺体，下缘一条赤色横线标记通行高度',
    action: 'slide', warning: 1.4,
    rule: '通行高度 43px，滑铲身高 29px；站立撞上扣血',
    readAt: '1200',
    note: '序章已实现。赤色下缘是唯一判读依据。',
  },
  {
    id: 'broken-span', name: '断桥', nameEn: 'Broken Span', chapter: [0, 1, 2, 3, 4, 5],
    silhouette: '地面被切开，两侧断面有暖色边缘',
    action: 'jump', warning: 1.8,
    rule: '脚点落入缺口即坠落，扣一格并回检查点',
    readAt: '1600',
    note: '序章已实现。宽断口需要二段跳。',
  },
  {
    id: 'pyre-wisp', name: '祭火残焰', nameEn: 'Pyre Wisp', chapter: [1, 2],
    silhouette: '贴地漂浮的赤色火团，轮廓比收集物更扁更宽',
    action: 'jump', warning: 1.3,
    rule: '周期上下浮动，碰到扣血；不追人，只守固定区间',
    readAt: '1100',
    motion: { type: 'sine', amplitude: 46, period: 2.4 },
    note: '用"宽扁"与金色碎片的"窄菱"区分，避免误判。',
  },
  {
    id: 'tide-hands', name: '祈祷之手', nameEn: 'Praying Hands', chapter: [3],
    silhouette: '从潮水中伸出的石手，指节间有赤色缝隙',
    action: 'jump', warning: 1.5,
    rule: '仅在退潮相位露出水面，涨潮时被淹没且无判定',
    readAt: '1300',
    gatedBy: { type: 'tide', openWhen: 'low' },
    note: '危险随潮汐开闭，玩家只需读懂周期，不需要额外操作。',
  },
  {
    id: 'sleep-lash', name: '梦魇鞭影', nameEn: 'Nightmare Lash', chapter: [4],
    silhouette: '横贯画面的细长赤色鞭痕，两端有源点',
    action: 'slide', warning: 1.2,
    rule: '只在睡眠幕显形相位出现；滑铲可穿过',
    readAt: '1200',
    gatedBy: { type: 'shroud', openWhen: 'visible' },
    note: '与睡眠幕共用相位，不引入第二套时间规则。',
  },
  {
    id: 'loom-thread', name: '断线', nameEn: 'Severed Thread', chapter: [5],
    silhouette: '竖直的赤色丝线，上下有绷断的散股',
    action: 'switch', warning: 1.7,
    rule: '踩空后本段线路消失，需提前切换；不直接扣血，但会掉入下层',
    readAt: '1500',
    note: '惩罚是"路线变化"而非"扣血"，符合本作对失误的处理方式。',
  },
  {
    id: 'torch-grasp', name: '巨神之手', nameEn: 'Grasp of the Titan', chapter: [6],
    silhouette: '背景巨掌，举起时指缝漏光，落下时遮蔽上半屏',
    action: 'jump', warning: 1.6,
    rule: '落下阶段掌心区域即死判定；举起阶段可自由通过',
    readAt: '2000',
    phases: [
      { name: '举起', duration: 1.6, danger: false, cue: '指缝亮起，投下长影' },
      { name: '悬停', duration: .35, danger: false, cue: '手掌完全张开' },
      { name: '落下', duration: .5, danger: true, cue: '掌心阴影覆盖跑道' },
      { name: '抬起', duration: .9, danger: false, cue: '扬尘，指影收回' },
    ],
    note: '本作唯一的"即死"机制，因此给足 1.6 秒预警且每 3 次循环才出现 1 次。',
  },
  {
    id: 'edge-hollow', name: '虚空裂隙', nameEn: 'Hollow Edge', chapter: [6],
    silhouette: '深渊底部的暗红微光，随时间增亮',
    action: 'jump', warning: 0,
    rule: '掉入即扣一格并回检查点，与序章断桥同规则',
    readAt: '1600',
    note: '沿用断桥判定，不改物理，避免破坏序章的无伤路线验收。',
  },
];

// --------------------------------------------------------------------------- //
// 二 · 收集物
// --------------------------------------------------------------------------- //
export const COLLECTIBLES = [
  {
    id: 'memory-shard', name: '记忆碎片', nameEn: 'Memory Shard',
    color: '#e0bf7b', shape: '窄菱形（宽 10 × 高 18）',
    effect: '无直接收益；连续收集形成「连忆」，中断 2.4 秒清空',
    settle: '结算展示最长连忆',
    note: '序章已实现。金色窄菱是本作的收集物识别基准。',
  },
  {
    id: 'true-name', name: '真名铜片', nameEn: 'True-Name Tablet',
    color: '#e8cc92', shape: '方形铜片（22 × 26），表面有刻痕',
    effect: '解锁一段必然剧情，决定故事完整度',
    restriction: '不可通过重复挑战刷取；每章固定三枚',
    mainline: false,
    note: 'design-bible 明确：真名不是另一种货币，而是叙事开关。必要情报由通关自动获得，不锁在真名里。',
  },
  {
    id: 'resonance-ring', name: '共鸣环', nameEn: 'Resonance Ring',
    color: '#dbb775', shape: '椭圆环（27 × 43），带缓慢旋转的光点',
    effect: '恢复一格余火，并解锁一条人物侧写',
    restriction: '地面主路线不要求全收集，可完全绕过',
    mainline: false,
    note: '序章已实现 3 个。后续各章维持 3–4 个，全部可选。',
  },
  {
    id: 'ember-mote', name: '余火星屑', nameEn: 'Ember Mote',
    color: '#f9ce73', shape: '极小的跳动光点（3 × 3）',
    effect: '仅在余火已满时转化为连忆加成；不满时被吸收但不回血',
    note: '防止"残血时靠攒星屑一次性回满"破坏余火的稀缺感。',
  },
];

// --------------------------------------------------------------------------- //
// 三 · 道具与遗物
// --------------------------------------------------------------------------- //
// design-bible 第 7 节：先只预留一个装备槽，候选为余息铃 / 渡鸦羽 / 静誓环。
// 下面在保留这三件原设的基础上，补足每件的机制细节与路线影响。
export const RELICS = [
  {
    id: 'ember-bell', name: '余息铃', nameEn: 'Ember Bell', slot: '唯一装备槽',
    effect: '离地宽限从 110ms 延长到 210ms',
    routeImpact: '让"边缘起跳"路线变为稳定选择，但不改变任何跳跃高度',
    tradeoff: '铃响会掩盖风吹动机，使飘带预警需要更早观察',
    chapter: 2,
    note: '原设已列出。属于"降低操作门槛"而非"提高数值"。',
  },
  {
    id: 'raven-feather', name: '渡鸦羽', nameEn: 'Raven Feather', slot: '唯一装备槽',
    effect: '二段跳的横向位移增加 18%，空中转向更灵敏',
    routeImpact: '解锁需要横向位移的高空支路；不增加垂直高度',
    tradeoff: '落点更难精确，窄平台风险上升',
    chapter: 2,
    note: '原设已列出。横纵分离，避免变成"更强的二段跳"。',
  },
  {
    id: 'still-oath', name: '静誓环', nameEn: 'Still Oath Ring', slot: '唯一装备槽',
    effect: '滑铲可穿过特定影壁（原本必须绕行）',
    routeImpact: '开启滑铲支线，把"绕行"换成"直穿"',
    tradeoff: '滑铲结束后的 160ms 冷却不变，连穿过密影壁区仍需计时',
    chapter: 3,
    note: '原设已列出。改变的是路线可达性，不是伤害或速度。',
  },
  {
    id: 'ashen-lantern', name: '灰灯', nameEn: 'Ashen Lantern', slot: '唯一装备槽',
    effect: '睡眠幕在本体周围 90px 内始终显形，不受相位影响',
    routeImpact: '让第四幕的明灭平台从"计时挑战"变为"路线选择"',
    tradeoff: '灯的光会吸引梦魇鞭影，危险出现频率上升',
    chapter: 4,
    note: '新增候选。把"看相位"换成"用光影换安全"，是有代价的交易。',
  },
  {
    id: 'nameless-needle', name: '无名针', nameEn: 'Nameless Needle', slot: '唯一装备槽',
    effect: '线织桥的两条线在三秒内同时可见，之后才收敛',
    routeImpact: '允许先观察再决定，而不是被迫即时切换',
    tradeoff: '三秒后收敛会强制选定；犹豫过久反而失去优选路线',
    chapter: 5,
    note: '新增候选。服务"命运是被删去其他可能后的历史"这一主题。',
  },
];

// 通用道具（非装备槽，关卡内一次性）
export const CONSUMABLES = [
  { id: 'clay-cup', name: '陶杯', effect: '在火祭碑多恢复一格余火（上限仍为三格）', chapter: [1, 2, 3] },
  { id: 'wax-stub', name: '烛尾', effect: '点亮最近的烛台，略过一段跑动', chapter: [6] },
  { id: 'name-thread', name: '记名绳', effect: '把一条已解锁的手记固定显示在 HUD 上', chapter: [1, 2, 3, 4, 5] },
];

// --------------------------------------------------------------------------- //
// 四 · 计分与结算扩展（不引入付费或抽卡，见 design-bible 第 7 节禁止清单）
// --------------------------------------------------------------------------- //
export const SCORING = {
  keep: ['记忆碎片数', '最长连忆', '共鸣数量', '余火剩余', '重燃次数'],
  add: [
    { id: 'no-hit-segments', label: '无伤段数', note: '每个检查点之间未受伤则记一段，用于鼓励稳定而非速通' },
    { id: 'true-names', label: '真名铜片', note: '决定故事完整度，不计入分数排行' },
    { id: 'relic-route', label: '遗物路线', note: '记录本局使用的遗物，不同遗物的路线不可直接比较成绩' },
  ],
  forbid: ['每日任务', '抽卡', '数值付费', '无限刷材料', '多层装备稀有度'],
};

// --------------------------------------------------------------------------- //
// 五 · 校对表：确保每个敌方素材都有明确的"可读轮廓"
// --------------------------------------------------------------------------- //
export function validateHazards(list = HAZARDS) {
  const problems = [];
  for (const hazard of list) {
    if (!hazard.silhouette) problems.push(`${hazard.id} 缺少轮廓语言`);
    if (!hazard.action) problems.push(`${hazard.id} 缺少要求的动作`);
    if (hazard.warning === undefined) problems.push(`${hazard.id} 缺少预警时间`);
    // design-bible：预兆至少提前一个完整动作窗口（跳跃约 0.7s）
    if (typeof hazard.warning === 'number' && hazard.warning > 0 && hazard.warning < 0.7) {
      problems.push(`${hazard.id} 预警 ${hazard.warning}s 短于一个动作窗口`);
    }
  }
  return problems;
}

export function summarize() {
  return {
    hazards: HAZARDS.length,
    collectibles: COLLECTIBLES.length,
    relics: RELICS.length,
    consumables: CONSUMABLES.length,
    problems: validateHazards(),
  };
}

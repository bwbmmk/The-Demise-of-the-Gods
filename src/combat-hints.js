export const ATTACK_HINTS={
  'final-low':'赤色贴地焰刃 · 跳跃越过 ↑',
  'final-high':'高位赤刃 · 滑铲通过 ↓',
  'final-tall':'紫色高浪 · 二段跳 ↑ ↑',
  'final-double':'双重焰刃 · 落地后再跳',
  'final-rain':'火雨贯穿空中 · A / D 移出红圈，别向上迎着跳',
  'final-lance':'王权投枪 · 落点固定后左右避让',
  'final-eruption':'地火将升起 · A / D 走进两道光柱之间',
  'final-crossfire':'两侧焰刃夹击 · 看两边的箭头，连续跳跃越过',
  'final-hunt':'三连追身枪 · 后两枪还会追踪，变红锁定后继续走位',
  'final-sweepfire':'地火逐道扫过 · 看亮起顺序，移入已熄灭的位置',
  'final-edict':'王令横扫整个上方 · 落地滑铲 ↓，别起跳',
  'final-siege':'落火封路 + 贴地刃 · 先走进缝隙，再跳过焰刃',
  'final-cage':'火牢夹住两侧 · 留在缝里，跳过正面焰刃',
  'final-sunfall':'日核坠落 · 移出大红印，随后跳过追来的焰刃',
  'dawn-hammer':'金圈追踪 → 引到楔前 → 变红后按住 A 后撤',
  'final-recall':'金色记忆 · 按住 E 接住，松开 E 发还；高处需要跳跃',
  low:'贴地光刃 · 靠近时跳跃 ↑',
  high:'高位光幕 · 滑铲通过 ↓，跳跃躲不开',
  fall:'紫色落印 · 先起跳，再在空中跃一次 ↑ ↑',
  counter:'青色回火印 · 跳起接住，余火自动反击 ↑',
  'chain-hammer':'黄圈引到金桩 · 按住 A；变红立即松开，离开落锤位置',
  'chain-wave':'落锤后有贴地震波 · 看地面预警起跳 ↑',
  'chain-high-wave':'紫色高震波 · 起跳后再跃一次 ↑ ↑',
  // 第四幕实体连段：答案动词与画布一致。
  'dawn-cinder':'跑开→ 熔渣落石 · 离开红圈，或站进缝里',
  'dawn-quake':'跳↑ 贴地冲击波 · 波体有厚度，跳过去',
  'dawn-meteor':'火雨 · 红圈锁定落点，跑开或跳过残焰',
  'dawn-stomp':'双重践踏 · 两道贴地焰刃，落地后再跳',
  'dawn-sweep':'悬空炬刃 · 滑铲通过 ↓，跳跃躲不开',
  'dawn-pulse':'日冕高浪 · 起跳后再跃一次 ↑ ↑',
  'dawn-strike':'躲过连招 · 王收势时靠近楔，按 E 两次反灌星火',
};
export class CombatHints{
  constructor(){this.seen=new Set();this.active=null;}
  show(kind,elapsed){
    const text=ATTACK_HINTS[kind];if(!text||this.seen.has(kind))return false;
    this.seen.add(kind);this.active={kind,text,until:elapsed+3.2};return true;
  }
  current(elapsed){return this.active&&elapsed<this.active.until?this.active:null;}
  clearActive(){this.active=null;}
}

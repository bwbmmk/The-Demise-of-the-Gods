// ============================================================================ //
// 心源 · 四心系统
// ============================================================================ //
//
// **要解决的问题**：原设计里余火（生命）上限硬编码为 3，而记忆碎片散在五幕里
// （序章 90 / 第一幕 89 / 第二幕 18 / 第三幕 16 / 第四幕 143 枚）。
// 玩家在每一幕拼命捡碎片，捡到的数量**完全不影响任何事**——它只是计数。
// 于是「探索」在数值上没有任何回报，玩家也没有理由去捡。
//
// **新规则**：把「余火上限」本身变成收集的奖励。
//   · 每一幕在**结算时**独立计算这一幕的心源（由该幕的碎片收集率决定）；
//   · 带着前三幕的心源进入执炬王时，上限 = 3 + 已获得的心源（最高 4 颗）；
//   · 换句话说：**前三幕多捡碎片，就是为最终战多留一条命**。
//
// 为什么上限是 4 而不是无限：余火同时是「命数」和「资源」——
// 磨蹭没有代价，磨蹭就没有紧张感。三是基线，四是「你确实认真探索了」的奖励，
// 再多就破坏节奏（.verify 的追兵校验 `waits ∈ [1.2,3.2]` 也依赖这个尺度）。
//
// **档位设计**：每幕按收集率分三档，避免「差一枚就掉档」的挫败感。
//   0%（一都没捡）  → 0 心
//   ≥45%           → 1 心
//   ≥75%           → 2 心
// 序章→第一幕→第二幕→第三幕最多 4 幕，理论上限 3+4=7，超出部分不再叠加。
// 实际取：前三幕心源和 `≤1`（因为 4 颗封顶需要每幕都满档，留一点余量给选择）。

/** 一幕能产出的心源上限（四心封顶用不到更多）。 */
export const MAX_HEARTS=4;
/** 余火的基础上限（与原设计一致：不探索也有三条命）。 */
export const BASE_HEALTH=3;
/**
 * 余火的**绝对**上限 = 4。
 * 「多一条命」的价值在于稀缺，所以无论前面收集得多好都不超过 4 颗。
 */
export const MAX_HEALTH=BASE_HEALTH+1;

/** 档位阈值（可被创作者通道覆盖，见 setThresholds）。 */
export const DEFAULT_T1=0.45;
export const DEFAULT_T2=0.75;
let T1=DEFAULT_T1, T2=DEFAULT_T2;
/**
 * 四心系统的总开关（创作者通道用）。
 * 关掉之后心源恒为 0、余火恒 3 —— 用来对比"有/无心源"的难度差。
 */
let ENABLED=true;
export function setHeartsEnabled(on){ENABLED=!!on;}
export function heartsEnabled(){return ENABLED;}

/**
 * 创作者通道用：调整两档阈值。
 * 会做单调性检查——T1 必须小于 T2，否则会出现"收集更多反而更少心"的荒谬结果。
 * @returns {boolean} 是否接受
 */
export function setThresholds(t1,t2){
  const a=Math.max(0,Math.min(1,Number(t1)||0));
  const b=Math.max(0,Math.min(1,Number(t2)||1));
  if(a>=b)return false;
  T1=a;T2=b;return true;
}
/**
 * 读回当前阈值。名字带前缀是为了避免在打包产物里撞名——
 * 构建脚本会整行剥掉 import 语句，别名不会被保留（见 main.js 的说明）。
 */
export function heartsThresholds(){return {t1:T1,t2:T2,enabled:ENABLED};}

/**
 * 收集率 → 该幕心源数。
 * @param {number} collected 这一幕收集到的碎片数
 * @param {number} total     这一幕的碎片总数
 * @returns {0|1|2}
 */
export function heartsFromRate(collected,total){
  if(!total||collected<=0)return 0;
  const rate=collected/total;
  if(rate>=T2)return 2;
  if(rate>=T1)return 1;
  return 0;
}

/**
 * 逐幕结算心源。
 * @param {Array<{id:string,collected:number,total:number}>} acts 按顺序的前置幕成绩
 * @returns {{total:number, breakdown:Array}}
 */
export function tallyHearts(acts){
  if(!ENABLED)return {total:0,breakdown:acts.map(a=>({...a,hearts:0}))};
  const breakdown=acts.map(a=>({...a,hearts:heartsFromRate(a.collected,a.total)}));
  const total=Math.min(MAX_HEARTS,breakdown.reduce((s,a)=>s+a.hearts,0));
  return {total,breakdown};
}

/**
 * 余火上限 = 基础 3 + 心源（**硬封顶 4 颗**）。
 * 第四幕专用：前三幕带进来的心在这里兑现成多一条命。
 *
 * ⚠️ 这里必须硬封顶在 MAX_HEARTS，不能让 `3 + 心源` 直接相加：
 *   四幕满档会算出 3+2×4 = 11 颗，余火太多就不是奖励而是改动难度了。
 *   「多一条命」的价值在于**它稀缺**；给到 7 颗就变成了另一种平衡，
 *   而且追兵校验（waits ∈ [1.2,3.2]）的尺度也会跟着崩。
 */
export function healthCapFor(hearts){
  return Math.min(MAX_HEALTH, BASE_HEALTH+Math.max(0,hearts|0));
}
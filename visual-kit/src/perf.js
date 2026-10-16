/**
 * 性能层。
 *
 * 现代 Canvas 2D 的瓶颈不在"画了多少像素"，而在**路径构建与状态切换的次数**。
 * 这个渲染器每帧要重建几十条地形/远景/草丛路径，即使它们的内容几乎没变。
 * 所以这里的三个缓存各自针对一类重复劳动：
 *
 *   TileCache    远景视差——一条循环贴图，滚动只在边界重画
 *   StripCache   世界空间静态几何（地面、桥墩）——只在离开缓存窗口时重画
 *   QualityGovernor 帧时间超预算时逐级降档；特效变少，但操作不变卡
 *
 * 外加 DynamicResolution：真正撑不住时降内部分辨率——这是最有效的一档。
 */

import { clamp, lerp, damp } from './core.js';

/** 帧时间统计（EMA + 分位近似），输出给 HUD 与基准测试。 */
export class FrameStats {
  constructor(window = 120) {
    this.buf = new Float32Array(window);
    this.i = 0;
    this.n = 0;
    this.ema = 16.7;
    this.max = 16.7;
    this._sorted = null;
  }
  push(ms) {
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
    this.ema = this.ema * 0.9 + ms * 0.1;
    this._sorted = null;
    return this;
  }
  get fps() { return this.ema > 0 ? 1000 / this.ema : 0; }
  get avg() {
    if (!this.n) return 0;
    let s = 0;
    for (let i = 0; i < this.n; i++) s += this.buf[i];
    return s / this.n;
  }
  /** 近似 p95：把样本排序取 95 分位。仅在显式调用时排序。 */
  percentile(p) {
    if (!this._sorted) {
      this._sorted = Array.from(this.buf.slice(0, this.n)).sort((a, b) => a - b);
    }
    const s = this._sorted;
    if (!s.length) return 0;
    return s[clamp(Math.floor(s.length * p), 0, s.length - 1)];
  }
  reset() { this.i = 0; this.n = 0; this.ema = 16.7; this._sorted = null; }
}

/**
 * 循环贴图缓存。用于视差远景：内容在贴图内是周期性的，
 * 只有滚动到边界时才把贴图整体平移重画一次。
 */
export class TileCache {
  constructor(tileW, h) {
    this.canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(Math.max(2, Math.ceil(tileW)), Math.max(2, Math.ceil(h)))
      : Object.assign(document.createElement('canvas'), { width: Math.max(2, Math.ceil(tileW)), height: Math.max(2, Math.ceil(h)) });
    this.ctx = this.canvas.getContext('2d');
    this.tileW = tileW;
    this.tileH = h;
    this.h = h;
    // 计数器：用来验证"贴图只烘一次、之后全是 blit"。
    // 没有这两个数字就只能靠"看起来没卡"来判断，那不算证据。
    this.repaints = 0;
    this.blits = 0;
  }
  /** 用 painter 重画整张贴图。painter(ctx, tileW, h)。 */
  repaint(painter) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.tileW, this.h);
    painter(this.ctx, this.tileW, this.h);
    this.repaints++;
  }
  /** 把贴图铺满 [0,w]，按 offset 平移。offset 任意大小都可以，内部会取模。 */
  blit(ctx, offset, w, y = 0) {
    const o = ((offset % this.tileW) + this.tileW) % this.tileW;
    let x = -o;
    while (x < w) {
      ctx.drawImage(this.canvas, x, y);
      x += this.tileW;
      this.blits++;
    }
  }
}

/**
 * 世界空间长条缓存。用于"位置固定、只随相机平移"的静态几何。
 *
 * 用法：
 *   const strip = new StripCache(startX, width, height);
 *   strip.ensure(ctx, camera - 200, camera + w + 200, (g, x0, x1) => { ...画地面... });
 *   strip.draw(ctx, camera);
 *
 * 只要相机还在缓存窗口内就直接 blit；出去才重画一次。
 * `ensure` 的重画成本是摊还的，帧率因此平稳。
 */
export class StripCache {
  constructor(width, height, pad = 400) {
    this.pad = pad;
    const w = Math.max(2, Math.ceil(width));
    const h = Math.max(2, Math.ceil(height));
    this.canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    this.ctx = this.canvas.getContext('2d');
    this.width = w;
    this.height = h;
    this.originX = 0;      // 缓存左端对应的世界 x
    this.valid = false;
    this.repaints = 0;
    this.blits = 0;
  }
  /** 保证 [from,to] 落在缓存窗口内；不在就重画。 */
  ensure(from, to, painter) {
    if (this.valid && from >= this.originX && to <= this.originX + this.width) return false;
    // 以请求区间为中心对齐重画，避免每帧都刚好越界一点点
    const span = to - from;
    const half = Math.floor((this.width - span) / 2);
    this.originX = Math.floor(from - Math.max(0, half));
    this.ctx.setTransform(1, 0, 0, 1, -this.originX, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    painter(this.ctx, this.originX, this.originX + this.width);
    this.valid = true;
    this.repaints++;
    return true;
  }
  /** 把可见窗口贴到主画布。 */
  draw(ctx, camera) {
    if (!this.valid) return;
    this.blits++;
    ctx.drawImage(this.canvas, 0, 0, this.width, this.height,
      this.originX - camera, 0, this.width, this.height);
  }
  invalidate() { this.valid = false; }
}

/**
 * 画质调度。根据帧时间在 0–3 档之间移动，并带滞回，避免在两档之间抖。
 *
 * 档位含义（可在 opts 里覆盖）：
 *   3 满配：全部后处理 + 全部粒子
 *   2 标准：跳过最贵的后处理
 *   1 精简：粒子减半、跳过后处理
 *   0 保底：粒子 1/4、关闭后处理与速度线
 */
export class QualityGovernor {
  constructor({ targetMs = 13.5, minLevel = 0, maxLevel = 3 } = {}) {
    this.target = targetMs;
    this.min = minLevel;
    this.max = maxLevel;
    this.level = maxLevel;
    this._bad = 0;
    this._good = 0;
    this.locked = false;    // 锁定后不再自动调整（基准测试用）
  }
  /**
   * @param frameMs 上一帧实际耗时
   * @returns 是否发生了档位变化
   */
  step(frameMs) {
    if (this.locked) return false;
    const before = this.level;
    if (frameMs > this.target * 1.25) {
      this._bad++; this._good = 0;
      // 连续 3 帧超支才降档：单帧毛刺（比如切场景）不该触发
      if (this._bad >= 3 && this.level > this.min) { this.level--; this._bad = 0; }
    } else if (frameMs < this.target * 0.72) {
      this._good++; this._bad = 0;
      // 连续 30 帧富余才升档：升得慢，避免来回抖
      if (this._good >= 30 && this.level < this.max) { this.level++; this._good = 0; }
    } else {
      this._bad = 0; this._good = 0;
    }
    return this.level !== before;
  }
  /** 各系统的预算，由 level 派生。 */
  get budgets() {
    const l = this.level;
    return {
      level: l,
      particles: [120, 300, 650, 900][l],
      speedLines: l >= 3,
      bloom: l >= 3,
      aberration: l >= 3,
      grain: l >= 1,
      smearCount: [0, 1, 3, 4][l],
      grassStep: [3, 2, 1, 1][l],   // 草丛抽稀步长
      shadowBlur: l >= 2,
    };
  }
}

/**
 * 动态分辨率。真正的保命档：帧时间持续超预算时降低内部渲染分辨率，
 * 之后帧率恢复再升回。视觉上先是略微变软，接着才是掉帧——
 * 对跑酷游戏，前者远比后者可接受。
 */
export class DynamicResolution {
  constructor({ min = 0.6, max = 1, settleMs = 900 } = {}) {
    this.min = min;
    this.max = max;
    this.scale = max;
    this.settleMs = settleMs;
    this._hold = 0;
    this.enabled = true;
  }
  step(frameMs, targetMs = 13.5, dtMs = 16.7) {
    if (!this.enabled) return this.scale;
    this._hold = Math.max(0, this._hold - dtMs);
    if (this._hold > 0) return this.scale;
    const before = this.scale;
    if (frameMs > targetMs * 1.2) {
      this.scale = clamp(this.scale - 0.05, this.min, this.max);
    } else if (frameMs < targetMs * 0.6) {
      this.scale = clamp(this.scale + 0.03, this.min, this.max);
    }
    if (this.scale !== before) this._hold = this.settleMs;
    return this.scale;
  }
}

/**
 * 一个把上面全部串起来的门面。挂到任意 renderer 上即可。
 */
export class PerfKit {
  constructor(opts = {}) {
    this.stats = new FrameStats();
    this.quality = new QualityGovernor(opts.governor);
    this.dynres = new DynamicResolution(opts.dynres);
    this.enabled = true;
    this._t0 = 0;
  }
  begin() {
    if (!this.enabled) return;
    this._t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }
  end() {
    if (!this.enabled) return 16.7;
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = t1 - this._t0;
    this.stats.push(ms);
    this.quality.step(ms);
    this.dynres.step(ms, this.quality.target);
    return ms;
  }
  get budgets() { return this.quality.budgets; }
}

/**
 * 特效引擎（VFX）。
 *
 * 设计要点，全部服务于"直接可用 + 不掉帧"：
 *  1. **固定对象池**。粒子一次性分配、复用，运行期零 GC。
 *     原实现在 `burst()` 里 `push` 新对象、在每帧 `filter` 重建数组，
 *     连续爆特效时会持续分配/回收内存，正是掉帧的来源之一。
 *  2. **按类型批量绘制**。同类型的粒子走同一条路径设置，减少 canvas 状态切换。
 *  3. **确定性**。粒子初始速度来自确定性伪随机（seed 可传入），
 *     所以同一段回放能截出一模一样的图，便于自动化验收。
 *  4. **预算自适应**。`budget` 由 perf 层下发；超预算时新粒子被丢弃，
 *     而不是让整帧变慢——"特效变少"比"操作变卡"体验好得多。
 */

import { VK_TAU, rand, hash32, clamp, lerp, noise1 } from './core.js';

/** 粒子类型表：颜色、重力、阻尼、是否加色。 */
export const PARTICLE_TYPES = {
  dust:   { color: '#8a9887', gravity: 40,  drag: 2.2, additive: false, fade: 1 },
  ember:  { color: '#e8a34e', gravity: -14, drag: 0.9, additive: true,  fade: 1 },
  spark:  { color: '#ffd9a0', gravity: 180, drag: 0.6, additive: true,  fade: 1 },
  ash:    { color: '#6e7a76', gravity: 12,  drag: 1.6, additive: false, fade: 1 },
  smoke:  { color: '#3c4a4c', gravity: -6,  drag: 1.2, additive: false, fade: 1 },
  splash: { color: '#9fc4c8', gravity: 320, drag: 0.4, additive: true,  fade: 1 },
  gold:   { color: '#f4ce85', gravity: 60,  drag: 1.4, additive: true,  fade: 1 },
  jade:   { color: '#8ad0b4', gravity: 40,  drag: 1.6, additive: true,  fade: 1 },
  blood:  { color: '#a5574d', gravity: 210, drag: 1.0, additive: false, fade: 1 },
};

/** 固定容量的粒子池。 */
export class ParticlePool {
  constructor(capacity = 900) {
    this.cap = capacity;
    this.n = 0;            // 活跃数量（活跃粒子永远排在前面）
    this.budget = capacity;
    // 结构体数组：每个字段一条 TypedArray，缓存友好。
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.kind = new Uint16Array(capacity);
    this.seed = 0;
    // 定义表 = 内置类型 + 运行期注册的自定义颜色。
    // 保留自定义颜色是为了让 kit 能**原样复刻**调用方传入的颜色，
    // 而不是强行归并到内置调色板——池化不应该改变画面。
    this.types = Object.keys(PARTICLE_TYPES);
    this.defs = this.types.map((k) => PARTICLE_TYPES[k]);
    this.colorIndex = new Map(this.types.map((k, i) => [k, i]));
  }

  /** 注册（或复用）一个自定义颜色，返回定义下标。 */
  defineColor(color, opts = {}) {
    const hit = this.colorIndex.get(color);
    if (hit !== undefined) return hit;
    const i = this.defs.length;
    this.defs.push({
      color,
      gravity: opts.gravity ?? 46,
      drag: opts.drag ?? 1.8,
      additive: opts.additive ?? false,
      fade: 1,
    });
    this.colorIndex.set(color, i);
    return i;
  }

  /**
   * 把内置类型名或任意颜色字符串解析成定义下标。
   * 一次 Map 查找即可——colorIndex 同时覆盖内置类型与注册过的自定义颜色。
   */
  resolve(key, opts) {
    const hit = this.colorIndex.get(key);
    if (hit !== undefined) return hit;
    return this.defineColor(key, opts);
  }

  /**
   * 投放一个粒子。`type` 可以是内置类型名、任意颜色字符串，
   * **也可以是一个已解析好的定义下标**（number）。
   *
   * 允许传下标很重要：批量投放时若每个粒子都去做一次 Map 查找，
   * 热路径上会被这点开销吃掉——微基准里实测能拖慢一倍。
   * 所以 `burst()` 先解析一次，再循环传下标。
   */
  spawn(type, x, y, vx, vy, life, size, spin = 0) {
    if (this.n >= Math.min(this.cap, this.budget)) return false;
    const i = this.n++;
    const k = typeof type === 'number' ? type : this.resolve(type);
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.rot[i] = hash32((this.seed + i) | 0) * VK_TAU;
    this.spin[i] = spin;
    this.kind[i] = k;
    return true;
  }

  /**
   * 在半径内确定性爆开一团粒子。
   * 定义下标只解析一次——否则每个粒子都要查一次 Map。
   */
  burst(type, x, y, count, speed, power = 1, life = 0.6, size = 2.4) {
    const k = typeof type === 'number' ? type : this.resolve(type);
    let made = 0;
    for (let i = 0; i < count; i++) {
      // 用整数哈希而不是 Math.sin：这里每颗粒子要抽 5 个随机数，
      // 是整个系统最热的一段，三角函数会被放大成实打实的毫秒。
      this.seed = (this.seed + 1) | 0;
      const s0 = hash32(this.seed * 3 + 1);
      const s1 = hash32(this.seed * 5 + 2);
      const s2 = hash32(this.seed * 7 + 3);
      const s3 = hash32(this.seed * 11 + 4);
      const s4 = hash32(this.seed * 13 + 5);
      const a = s0 * VK_TAU;
      const sp = speed * (0.35 + s1 * 0.9);
      if (!this.spawn(k, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 20 * power,
        life * (0.6 + s2 * 0.7), size * (0.6 + s3 * 0.9), (s4 - 0.5) * 6)) break;
      made++;
    }
    return made;
  }

  /**
   * 推进一帧。用"就地压缩"代替 filter：
   * 死掉的粒子与数组末尾的活跃粒子交换，然后 n--。
   * O(活跃数)、零分配。
   */
  update(dt) {
    // 把字段数组取到局部变量：热循环里少解引用十几次，JIT 也更容易向量化。
    const { x, y, vx, vy, life, max, size, rot, spin, kind, defs } = this;
    let i = 0;
    let n = this.n;
    while (i < n) {
      life[i] -= dt;
      if (life[i] <= 0) {
        const j = --n;
        if (j !== i) {
          x[i] = x[j]; y[i] = y[j];
          vx[i] = vx[j]; vy[i] = vy[j];
          life[i] = life[j]; max[i] = max[j];
          size[i] = size[j]; rot[i] = rot[j];
          spin[i] = spin[j]; kind[i] = kind[j];
        }
        continue; // 不递增 i：换过来的粒子还没检查
      }
      const def = defs[kind[i]];
      const drag = Math.exp(-def.drag * dt);
      vx[i] *= drag;
      vy[i] = vy[i] * drag + def.gravity * dt;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      rot[i] += spin[i] * dt;
      i++;
    }
    this.n = n;
  }

  clear() { this.n = 0; }
}

/** 冲击波环。数量很少，用普通数组即可。 */
export class Shockwaves {
  constructor(cap = 24) {
    this.cap = cap;
    this.list = [];
  }
  add(x, y, { max = 0.55, radius = 95, squash = 0.16, color = '#dfbd7a', width = 2, air = false } = {}) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({ x, y, life: 0, max, radius, squash, color, width, air });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      w.life += dt;
      if (w.life >= w.max) this.list.splice(i, 1);
    }
  }
  draw(ctx, camera) {
    for (const w of this.list) {
      const q = w.life / w.max;
      const r = 10 + q * w.radius;
      ctx.save();
      ctx.globalAlpha = (1 - q) * 0.7;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width * (1 - q) + 0.5;
      ctx.beginPath();
      ctx.ellipse(w.x - camera, w.y, r, w.air ? r * 0.75 : r * w.squash, 0, 0, VK_TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  clear() { this.list.length = 0; }
}

/**
 * 速度线：屏幕空间（不随相机滚动）的横向拖影，速度越高越明显。
 * 这是"跑得很快"最廉价也最有效的视觉语言。
 */
export class SpeedLines {
  constructor(max = 42) {
    this.max = max;
    this.lines = [];
    this.acc = 0;
  }
  update(dt, { speed = 0, active = true, w = 1280, h = 720, reduced = false } = {}) {
    // 使用与物理解耦的生成率，且由 dt 驱动，帧率无关
    const rate = active ? clamp((speed - 280) / 90, 0, 1) * (reduced ? 5 : 26) : 0;
    this.acc += rate * dt;
    while (this.acc >= 1 && this.lines.length < this.max) {
      this.acc -= 1;
      this.lines.push({
        y: Math.random() * h,
        len: 40 + Math.random() * 120,
        x: w + 60,
        v: 900 + Math.random() * 1400,
        a: 0.05 + Math.random() * 0.14,
      });
    }
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.x -= l.v * dt;
      if (l.x + l.len < -40) this.lines.splice(i, 1);
    }
  }
  draw(ctx, w) {
    if (!this.lines.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lines) {
      const g = ctx.createLinearGradient(l.x, 0, l.x + l.len, 0);
      g.addColorStop(0, 'rgba(220,235,235,0)');
      g.addColorStop(0.5, `rgba(220,235,235,${l.a})`);
      g.addColorStop(1, 'rgba(220,235,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(l.x, l.y, l.len, 1.2);
    }
    ctx.restore();
  }
  clear() { this.lines.length = 0; }
}

/**
 * 运动残影：在身体后方叠若干半透明副本。
 * 比原实现的"按时间抽帧"更稳——这里按**距离**抽帧，
 * 因为高速时相邻物理帧的距离才是可见拖影的成因。
 */
export function drawSmear(ctx, camera, samples, draw, { strength = 0.6, count = 4, distance = 26 } = {}) {
  if (!samples.length || strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  let last = samples[samples.length - 1];
  for (let k = 0; k < count; k++) {
    // 从队尾往前找，每隔 distance 像素取一个样本
    let picked = null;
    for (let i = samples.length - 1; i >= 0; i--) {
      if (last.x - samples[i].x >= distance * (k + 1)) { picked = samples[i]; break; }
    }
    if (!picked) break;
    ctx.globalAlpha = strength * (0.16 - k * 0.03);
    draw(ctx, picked.x - camera, picked.y, picked);
  }
  ctx.restore();
}

/**
 * 把上面这些拼成一个开箱即用的特效层。
 * 集成方法见 index.js 的 install()：它会把这一层挂到任意 Renderer 实例上。
 */
export class VFXLayer {
  constructor({ capacity = 900 } = {}) {
    this.particles = new ParticlePool(capacity);
    this.waves = new Shockwaves();
    this.lines = new SpeedLines();
    this.shake = 0;
    this.flash = 0;
    this.goldFlash = 0;
    this.samples = [];       // 身体采样，供残影使用
    this.footPrev = [null, null];
    this._typeIndex = this.particles.types;
  }

  /** 记录一次身体位置采样（由 render 每帧调用）。 */
  sampleBody(x, y, extra) {
    this.samples.push({ x, y, ...extra });
    while (this.samples.length > 64) this.samples.shift();
  }

  update(dt, ctx = {}) {
    this.particles.budget = ctx.budget ?? this.particles.cap;
    this.particles.update(dt);
    this.waves.update(dt);
    this.lines.update(dt, ctx);
    this.shake = Math.max(0, this.shake - dt * 38);
    this.flash = Math.max(0, this.flash - dt);
    this.goldFlash = Math.max(0, this.goldFlash - dt);
  }

  /** 足底扬尘。用 IK 解出的真实脚点，落在哪就在哪扬灰。 */
  footfall(feet, grounded, dt) {
    if (!grounded) { this.footPrev = [null, null]; return; }
    feet.forEach((f, i) => {
      const prev = this.footPrev[i];
      if (prev && prev[1] > -6 && f[1] <= -1 && Math.abs(f[0] - prev[0]) < 30) {
        // 脚从空中落到地面 → 一次落尘
        this.particles.burst('dust', f[0], f[1] - 1, 5, 46, 0.5, 0.45, 1.6);
      }
      this.footPrev[i] = [f[0], f[1]];
    });
  }

  /** 按类型批量绘制粒子。 */
  draw(ctx, camera) {
    const P = this.particles;
    if (!P.n) return;
    const defs = P.defs;
    // 先画非加色（尘土/血/烟），再加色（火星/金/玉），避免加色被压在下面
    for (const additive of [false, true]) {
      ctx.save();
      if (additive) ctx.globalCompositeOperation = 'lighter';
      for (let ti = 0; ti < defs.length; ti++) {
        const def = defs[ti];
        if (!!def.additive !== additive) continue;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        // 只遍历一遍：命中的直接入 path，没命中的几乎零成本。
        // （早期版本为了"提前跳过空类型"先扫一遍统计，结果变成两趟遍历，
        //   类型一多反而更慢——这类"优化"必须以实测为准。）
        let hit = false;
        for (let i = 0; i < P.n; i++) {
          if (P.kind[i] !== ti) continue;
          const q = P.life[i] / P.max[i];
          const s = P.size[i] * (def.fade ? q : 1);
          if (s <= 0.05) continue;
          const px = P.x[i] - camera, py = P.y[i];
          // 用一个小菱形代替圆：视觉上一样、比 arc() 快数倍
          ctx.moveTo(px + s, py);
          ctx.lineTo(px, py + s);
          ctx.lineTo(px - s, py);
          ctx.lineTo(px, py - s);
          hit = true;
        }
        if (hit) ctx.fill();
      }
      ctx.restore();
    }
  }

  clear() {
    this.particles.clear();
    this.waves.clear();
    this.lines.clear();
    this.samples.length = 0;
    this.footPrev = [null, null];
    this.shake = 0; this.flash = 0; this.goldFlash = 0;
  }
}

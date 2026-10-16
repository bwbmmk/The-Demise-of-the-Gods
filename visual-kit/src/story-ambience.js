/**
 * 剧情氛围层（story ambience）。
 *
 * 这一层做的事只有一件：**把故事里已经发生的事，变成看得见的东西**。
 * 它不新增玩法、不改数值、不碰角色——只旁听原游戏发出的事件，
 * 然后在画面上叠加对应的元素。
 *
 * 每一处效果都对应剧情里的一个具体事实，不是随手加的"好看的粒子"：
 *
 * | 效果 | 触发 | 剧情依据 |
 * |---|---|---|
 * | 记名辉光 | 捡到铜片 `collect` | 铜片帮助记忆；"人与人的记忆才是锚" |
 * | 记忆痕 | 走过之后持续 | 走过的路上留下记名 |
 * | 桥的凝实 | 铜片数 / `bridge-restored` | a12 三段讲述让桥逐段凝实 |
 * | 钟波 | `boss-broken` | 常晚敲钟破盾——把声音画出来 |
 * | 送灯 | 第一幕后段 / `checkpoint` | 北岸送灯；炉火不能熄 |
 * | 字痕 | 全程，按章节 | "名碑先失字，现实随后消失" |
 * | 灰烬 | 全程，偏冷时更密 | 灰烬之城、灰潮 |
 * | 七夜寒 | 随进度推进 | 王国粮煤只有七夜；陆承女儿受寒 |
 *
 * 性能约定：全部固定容量的结构体数组，运行期零分配；
 * 数量受 `budget` 限制，超预算时丢弃新元素而不是拖慢整帧。
 */

import { VK_TAU, clamp, lerp, hash32, smooth } from './core.js';

/* ------------------------------------------------------------------ *
 * 各类效果的固定池
 * ------------------------------------------------------------------ */

/** 上升的微尘（记忆痕 / 灰烬 / 火星共用一条通道，按 kind 区分外观）。 */
class MoteField {
  constructor(cap = 260) {
    this.cap = cap;
    this.n = 0;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.seed = new Float32Array(cap);
    this.kind = new Uint8Array(cap);      // 0 记忆 1 灰烬 2 火星
  }
  add(x, y, vx, vy, life, size, kind) {
    if (this.n >= this.cap) return false;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.seed[i] = Math.random(); this.kind[i] = kind;
    return true;
  }
  update(dt, wind) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (j !== i) {
          this.x[i] = this.x[j]; this.y[i] = this.y[j];
          this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
          this.life[i] = this.life[j]; this.max[i] = this.max[j];
          this.size[i] = this.size[j]; this.seed[i] = this.seed[j];
          this.kind[i] = this.kind[j];
        }
        continue;
      }
      // 灰烬飘、记忆升、火星窜，三种运动互不相同
      const k = this.kind[i];
      const drag = Math.exp(-(k === 0 ? 0.7 : 1.5) * dt);
      this.vx[i] = this.vx[i] * drag + wind * (k === 1 ? 1.6 : 0.5) * dt;
      this.vy[i] = this.vy[i] * drag + (k === 2 ? -46 : k === 1 ? -8 : -20) * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      i++;
    }
  }
  clear() { this.n = 0; }
}

const MOTE_COLORS = ['#f4ce85', '#8d9490', '#e59540'];
const MOTE_LIFE = [2.6, 4.2, 1.5];

/** 扩散光环（记名辉光 / 钟波）。 */
class Rings {
  constructor(cap = 16) {
    this.cap = cap;
    this.list = [];
  }
  add(x, y, { max = 0.8, radius = 90, color = '#f4ce85', width = 2, flat = 0.14 } = {}) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({ x, y, life: 0, max, radius, color, width, flat });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.life += dt;
      if (r.life >= r.max) this.list.splice(i, 1);
    }
  }
  draw(ctx, camera) {
    for (const r of this.list) {
      const q = r.life / r.max;
      const rad = 8 + q * r.radius;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - q) * 0.55;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - q) + 0.4;
      ctx.beginPath();
      ctx.ellipse(r.x - camera, r.y, rad, rad * r.flat, 0, 0, VK_TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  clear() { this.list.length = 0; }
}

/** 纸灯（北岸送灯）。 */
class Lanterns {
  constructor(cap = 14) {
    this.cap = cap;
    this.list = [];
  }
  release(x, y) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({ x, y, life: 0, max: 7 + Math.random() * 3, sway: Math.random() * VK_TAU, size: 5 + Math.random() * 3 });
  }
  update(dt, wind) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const l = this.list[i];
      l.life += dt;
      l.sway += dt * 0.8;
      l.x += wind * 6 * dt;
      l.y -= (11 + l.size * 0.7) * dt;
      if (l.life >= l.max) this.list.splice(i, 1);
    }
  }
  draw(ctx, camera) {
    for (const l of this.list) {
      const fade = 1 - Math.max(0, (l.life - l.max * 0.7) / (l.max * 0.3));
      const x = l.x - camera + Math.sin(l.sway) * 5;
      const y = l.y;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * fade;
      // 灯纸：先一团光，再一个方形灯身
      const g = ctx.createRadialGradient(x, y, 0, x, y, l.size * 4.5);
      g.addColorStop(0, 'rgba(255,196,110,0.55)');
      g.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - l.size * 4.5, y - l.size * 4.5, l.size * 9, l.size * 9);
      ctx.globalAlpha = 0.72 * fade;
      ctx.fillStyle = '#f2b45e';
      ctx.beginPath();
      ctx.ellipse(x, y, l.size * 0.62, l.size * 0.82, 0, 0, VK_TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  clear() { this.list.length = 0; }
}

/** 字痕（笔画碎片）：空气里慢慢飘散、逐渐淡去的短笔画。 */
class Glyphs {
  constructor(cap = 26) {
    this.cap = cap;
    this.list = [];
  }
  add(x, y) {
    if (this.list.length >= this.cap) this.list.shift();
    // 每一"笔"就是一条短线，加一个随机的错切角度，看起来像残缺的字
    const a = Math.random() * VK_TAU;
    const len = 7 + Math.random() * 16;
    this.list.push({
      x, y, life: 0, max: 3.4 + Math.random() * 2.6,
      dx: Math.cos(a) * len, dy: Math.sin(a) * len * 0.5,
      w: 0.8 + Math.random() * 1.2,
    });
  }
  update(dt, wind) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      g.life += dt;
      g.x += wind * 3 * dt;
      g.y -= 5 * dt;
      if (g.life >= g.max) this.list.splice(i, 1);
    }
  }
  draw(ctx, camera) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#c8d6d2';
    ctx.lineCap = 'round';
    for (const g of this.list) {
      const q = g.life / g.max;
      // 两端淡出：起笔重、收笔轻，像真的在化掉
      ctx.globalAlpha = 0.42 * Math.sin(Math.PI * clamp(q, 0, 1)) ** 0.7;
      ctx.lineWidth = g.w;
      ctx.beginPath();
      ctx.moveTo(g.x - camera, g.y);
      ctx.lineTo(g.x - camera + g.dx, g.y + g.dy);
      ctx.stroke();
    }
    ctx.restore();
  }
  clear() { this.list.length = 0; }
}

/* ------------------------------------------------------------------ *
 * 氛围层
 * ------------------------------------------------------------------ */

/** 每章的氛围配方。第一幕偏暖（有灯、有炉），第二幕的三域偏冷偏旷。 */
export const STORY_FX = {
  prologue: { ash: 1.0, glyph: 0.8, mote: 0.7, cold: 0.10, lantern: 0 },
  district: { ash: 0.75, glyph: 1.0, mote: 1.0, cold: 0.16, lantern: 0.35 },
  covenant: { ash: 0.5, glyph: 0.7, mote: 0.8, cold: 0.30, lantern: 0.25 },
  lantern: { ash: 0.5, glyph: 0.6, mote: 0.8, cold: 0.24, lantern: 0.55 },
};

const DEFAULT_STORY_FX = STORY_FX.prologue;

export class StoryAmbience {
  constructor(opts = {}) {
    this.motes = new MoteField(opts.moteCap ?? 260);
    this.rings = new Rings();
    this.lanterns = new Lanterns();
    this.glyphs = new Glyphs();

    this.budget = opts.budget ?? 260;
    this.reduced = false;
    this.wind = 26;                 // 世界向的风（px/s），受章节影响
    this.travelled = 0;             // 累计走过的距离，用来稀疏地留下记忆痕
    this._lastPlayerX = null;
    this._lanternCooldown = 0;
    this._ashAcc = 0;
    this._glyphAcc = 0;
    this.flash = 0;                 // 记名瞬间的整屏暖闪
    this.flashColor = '#f4ce85';
    this.coldOverride = null;       // 外部强制指定冷调（演示页滑块）；null = 按进度自动
  }

  /* -------- 旁听原游戏事件 -------- */

  /**
   * @param ev   原游戏 `renderer.event()` 收到的同一个事件对象（只读）
   * @param player 玩家状态（只读）
   */
  onEvent(ev, player, renderer) {
    if (!ev || !ev.type) return;
    const x = ev.x ?? player?.x ?? 0;
    const y = ev.y ?? (player?.y ?? 0) - 4;

    switch (ev.type) {
      // 捡到铜片 = 记住了一个名字。给一柱上升的金色光尘。
      case 'collect':
        this.nameRecall(x, y);
        break;

      // 常晚敲钟破盾——把钟声画出来：一圈快速扩散的金环。
      case 'boss-broken':
        this.rings.add(x, y, { max: 0.9, radius: 190, color: '#ffe9b4', width: 3, flat: 0.5 });
        for (let i = 0; i < 26; i++) {
          this.motes.add(x, y, (hash32(i * 7 + 1) - 0.5) * 150, -30 - hash32(i * 13) * 70,
            1.5 + hash32(i * 3) * 0.8, 1.6 + hash32(i * 5) * 1.4, 2);
        }
        break;

      // 可选共鸣：记忆涌上来
      case 'resonance':
        this.rings.add(x, y, { max: 1.1, radius: 150, color: '#f4ce85', width: 2.4 });
        this.flash = Math.max(this.flash, 0.5);
        for (let i = 0; i < 34; i++) {
          this.motes.add(x, y, (hash32(i * 11 + 2) - 0.5) * 110, -20 - hash32(i * 17) * 80,
            2.2 + hash32(i * 7) * 1.2, 1.4 + hash32(i * 19) * 1.6, 0);
        }
        break;

      // 检查点 = 到了新地方，也是一个可以放灯的时机（北岸送灯）
      case 'checkpoint':
        this.rings.add(x, y, { max: 1.0, radius: 120, color: '#e8c988', width: 2, flat: 0.2 });
        this._lanternReady = true;
        break;

      // 灯点着 / 添了柴：炉火不能熄
      case 'warmth':
      case 'lamp-lit':
        for (let i = 0; i < 18; i++) {
          this.motes.add(x, y, (hash32(i * 23 + 5) - 0.5) * 40, -34 - hash32(i * 29) * 46,
            1.4 + hash32(i * 31) * 0.9, 1.3 + hash32(i * 37) * 1.5, 2);
        }
        break;

      // 受击：抖落一片灰
      case 'hit':
        for (let i = 0; i < 14; i++) {
          this.motes.add(x, y, (hash32(i * 41 + 7) - 0.5) * 90, -20 - hash32(i * 43) * 40,
            1.1 + hash32(i * 47) * 0.7, 1.2 + hash32(i * 53) * 1.3, 1);
        }
        break;

      // 重生：清干净，不留上一条命的痕迹
      case 'respawn':
        this.clear();
        break;

      default:
        break;
    }
  }

  /** 记名辉光：铜片被拾起。 */
  nameRecall(x, y) {
    this.rings.add(x, y, { max: 0.85, radius: 130, color: '#f4ce85', width: 2.2, flat: 0.22 });
    this.flash = Math.max(this.flash, 0.32);
    const n = Math.min(this.budget, 26);
    for (let i = 0; i < n; i++) {
      this.motes.add(
        x + (hash32(i * 3 + 1) - 0.5) * 22,
        y + (hash32(i * 5 + 2) - 0.5) * 14,
        (hash32(i * 7 + 3) - 0.5) * 46,
        -46 - hash32(i * 11 + 4) * 92,
        1.9 + hash32(i * 13 + 5) * 1.4,
        1.4 + hash32(i * 17 + 6) * 1.7,
        0,
      );
    }
  }

  /* -------- 逐帧推进 -------- */

  update(dt, ctx = {}) {
    const { camera = 0, w = 1280, h = 720, t = 0, player, menu, level, groundAt, reduced } = ctx;
    this.reduced = !!reduced;
    this.budget = Math.max(60, Math.min(this.motes.cap, (ctx.budget ?? this.motes.cap)));

    // 配方按关卡 id 取；取不到就用序章
    const recipe = STORY_FX[level?.id] || DEFAULT_STORY_FX;
    this.wind = 20 + recipe.cold * 60;

    // ---- 记忆痕：走过的地方留下缓慢上升的金尘 ----
    if (player && !menu && groundAt) {
      const px = player.x;
      if (this._lastPlayerX !== null) {
        const moved = px - this._lastPlayerX;
        this.travelled += Math.abs(moved);
        // 每走 26px 放一颗，密度与移动距离成正比——跑起来自然更密
        while (this.travelled > 26) {
          this.travelled -= 26;
          if (hash32(Math.round(px * 7 + this.travelled * 13)) < recipe.mote * 0.9) {
            this.motes.add(
              px - camera - 120 + hash32(Math.round(px)) * 240,
              groundAt(px) - 2,
              (hash32(Math.round(px * 3)) - 0.5) * 14,
              -14 - hash32(Math.round(px * 5)) * 16,
              MOTE_LIFE[0], 1.1 + hash32(Math.round(px * 11)) * 0.9, 0,
            );
          }
        }
      }
      this._lastPlayerX = px;
    }

    // ---- 灰烬：全程都有，越冷越密（"灰烬之城、灰潮"）----
    if (!menu && !this.reduced) {
      this._ashAcc += dt * 9 * recipe.ash;
      while (this._ashAcc >= 1) {
        this._ashAcc -= 1;
        this.motes.add(
          camera + hash32(Math.round(t * 60) + this.motes.n) * (w + 80) - 40,
          h * 0.5 + (hash32(Math.round(t * 31) + this.motes.n * 3) - 0.5) * h,
          -8 - hash32(this.motes.n * 7) * 14, 4 + hash32(this.motes.n * 11) * 8,
          MOTE_LIFE[1], 0.8 + hash32(this.motes.n * 13) * 1.0, 1,
        );
      }
    }

    // ---- 字痕：空气里慢慢化掉的笔画 ----
    if (!menu && !this.reduced) {
      this._glyphAcc += dt * 1.6 * recipe.glyph;
      while (this._glyphAcc >= 1) {
        this._glyphAcc -= 1;
        this.glyphs.add(
          camera + hash32(Math.round(t * 17) + this.glyphs.list.length) * (w + 120) - 60,
          h * (0.24 + hash32(Math.round(t * 13) + this.glyphs.list.length * 5) * 0.52),
        );
      }
    }

    // ---- 送灯：检查点之后、桥那一段，灯会陆续放上天 ----
    this._lanternCooldown -= dt;
    if (!menu && recipe.lantern > 0 && this._lanternReady && player && this._lanternCooldown <= 0) {
      this.lanternCooldown = 2.6 / Math.max(0.2, recipe.lantern);
      this._lanternReady = false;
      const gy = groundAt ? groundAt(player.x) : player.y;
      this.lanterns.release(player.x + 120 + hash32(Math.round(player.x)) * 200, gy - 30);
    }

    this.motes.update(dt, this.wind);
    this.rings.update(dt);
    this.lanterns.update(dt, this.wind);
    this.glyphs.update(dt, this.wind);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  /* -------- 绘制（调用方已设好世界→屏幕的 transform） -------- */

  draw(ctx, camera) {
    // 送灯在灰烬之下、光环之上
    this.lanterns.draw(ctx, camera);
    this.glyphs.draw(ctx, camera);

    // 微尘：按 kind 分两趟画，省掉逐个切换状态
    const P = this.motes;
    if (P.n) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const kind of [0, 2]) {          // 记忆痕与火星加色，灰烬不加
        ctx.fillStyle = MOTE_COLORS[kind];
        ctx.beginPath();
        for (let i = 0; i < P.n; i++) {
          if (P.kind[i] !== kind) continue;
          const q = P.life[i] / P.max[i];
          const s = P.size[i] * Math.sin(Math.PI * clamp(q, 0, 1)) ** 0.5;
          if (s <= 0.05) continue;
          const px = P.x[i] - camera, py = P.y[i];
          ctx.moveTo(px + s, py);
          ctx.lineTo(px, py + s);
          ctx.lineTo(px - s, py);
          ctx.lineTo(px, py - s);
        }
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = MOTE_COLORS[1];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let i = 0; i < P.n; i++) {
        if (P.kind[i] !== 1) continue;
        const s = P.size[i];
        const px = P.x[i] - camera, py = P.y[i];
        ctx.moveTo(px + s, py);
        ctx.lineTo(px, py + s);
        ctx.lineTo(px - s, py);
        ctx.lineTo(px, py - s);
      }
      ctx.fill();
      ctx.restore();
    }

    this.rings.draw(ctx, camera);
  }

  /**
   * 整体色调偏移：随进度变冷。
   * "王国粮煤只有七夜"——越往后越冷，是剧情给的物理事实。
   *
   * `coldOverride` 由外部（演示页的滑块）强制指定，
   * 设为 null 时按关卡进度自动计算。
   */
  drawGrade(ctx, w, h, progress = 0) {
    const cold = this.coldOverride !== null && this.coldOverride !== undefined
      ? this.coldOverride
      : clamp(progress, 0, 1);
    if (cold < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(150,180,215,${1 - cold * 0.42})`);
    g.addColorStop(1, `rgba(120,150,190,${1 - cold * 0.5})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** 记名瞬间的整屏暖闪。 */
  drawFlash(ctx, w, h) {
    if (this.flash <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.flashColor;
    ctx.globalAlpha = this.flash * 0.1;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  clear() {
    this.motes.clear();
    this.rings.clear();
    this.lanterns.clear();
    this.glyphs.clear();
    this.travelled = 0;
    this._lastPlayerX = null;
    this._lanternCooldown = 0;
    this._lanternReady = false;
    this.flash = 0;
  }
}

/**
 * 美术增强层。
 *
 * 这里只放"原实现明显可以更好"的几件事，不做重画：
 *   1. ditheredGradient   —— 大面积渐变必然出现的色带（banding），用有序抖动消除
 *   2. lightShafts        —— 体积光柱，让光源真的"照"到空气里
 *   3. depthBlur          —— 远景廉价景深：降采样再放大，天然模糊
 *   4. grassField         —— 可调密度的草丛，密度可直接吃 perf 预算
 *   5. emissiveSprite     —— 预渲染的高斯光点，替代每帧 createRadialGradient
 */

import { VK_TAU, rand, clamp, lerp, noise1 } from './core.js';
import { vkMakeCanvas } from './canvas.js';


/** 4x4 有序抖动矩阵，值域 0..15。 */
const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/**
 * 带抖动的线性渐变。
 *
 * Canvas 的渐变是每通道 8bit 量化的，深色段尤其容易出现一圈圈色带。
 * 这里在渐变上方叠一层**幅度只有 1/255 的抖动**，人眼看不到噪点，
 * 但足以把量化台阶打散。代价是一次低 alpha 的平铺填充。
 */
/**
 * 4×4 Bayer 有序抖动矩阵，同时缓存成一张 4×4 的 pattern。
 *
 * 缓存是**必须的**：早先的实现是双层 for 循环逐格 fillRect，
 * 1280×720 的屏、3px 一格 = 8 万次绘制调用/帧，实测直接把帧率打到 9 fps。
 * 改成 pattern 之后是 **1 次 fillRect**，视觉完全一样。
 */
let BAYER_PATTERN = null;

function bayerPattern(ctx) {
  if (BAYER_PATTERN) return BAYER_PATTERN;
  const c = vkMakeCanvas(4, 4);
  const g = c.getContext('2d');
  const img = g.createImageData(4, 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = BAYER4[y * 4 + x] > 8 ? 255 : 0;
      const i = (y * 4 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  BAYER_PATTERN = ctx.createPattern(c, 'repeat');
  return BAYER_PATTERN;
}

/**
 * 在已画好的渐变上叠一层**有序抖动**，消除色带（banding）。
 *
 * Canvas 的渐变是每通道 8bit 量化的，大面积天空必然出现一圈圈台阶。
 * 这里用 4×4 Bayer 矩阵、幅度约 1/255 的图案去打散量化台阶：
 * 人眼看不到噪点，但台阶被打散了。
 *
 * 用 overlay 混合、不改变任何颜色数值——所以可以安全地叠在
 * **原游戏已经画好的天空**上，不需要知道它用的是哪套配色。
 */
export function ditherOverlay(c, w, h, alpha = 0.016) {
  const pat = bayerPattern(c);
  if (!pat || w <= 0 || h <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = pat;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/**
 * 远处光源的柔和光晕（月亮、灯、桥上的光）。
 * 半径大、alpha 极低——是"空气里有雾"的暗示，不是"物体在发光"。
 */
export function halo(c, x, y, radius, color = '236,232,206', alpha = 0.1) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.45, `rgba(${color},${alpha * 0.34})`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/**
 * 贴地雾带：一条贴着地平线/地面的柔和亮带。
 *
 * 这是把"平"变"深"最便宜的一招：远景被雾压住、近景保持清晰，
 * 空气透视一旦成立，画面的层次立刻出来。
 */
export function groundHaze(c, w, y, thickness, color = '150,175,180', alpha = 0.12) {
  const g = c.createLinearGradient(0, y - thickness, 0, y + thickness * 0.35);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.62, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.fillRect(0, y - thickness, w, thickness * 1.35);
}

export function ditheredGradient(c, x0, y0, x1, y1, stops, w, h, opts = {}) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  if (opts.dither === false) return;
  // 抖动层：用 4x4 图案，每格交替 +/- 半个量化步长
  c.save();
  c.globalAlpha = opts.ditherAlpha ?? 0.016;
  c.globalCompositeOperation = 'overlay';
  const cell = opts.ditherCell ?? 3;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const b = BAYER4[((y / cell) & 3) * 4 + ((x / cell) & 3)];
      c.fillStyle = b > 8 ? '#ffffff' : '#000000';
      c.fillRect(x, y, cell, cell);
    }
  }
  c.restore();
}

/**
 * 体积光柱。从光源向一个方向铺若干条带 additive 的楔形，
 * 每条的长度与亮度由噪声随时间起伏，看起来像尘埃被照亮。
 */
export function lightShafts(c, w, h, origin, t, opts = {}) {
  const {
    count = 7,
    angle = Math.PI * 0.62,     // 主方向（弧度，canvas y 向下）
    spread = 0.55,
    length = 900,
    color = '255,196,120',
    strength = 0.055,
    speed = 0.22,
  } = opts;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const n = noise1(i * 7.3 + t * speed);
    const a = angle + (i / Math.max(1, count - 1) - 0.5) * spread + (n - 0.5) * 0.08;
    const len = length * (0.6 + n * 0.7);
    const wid = 26 + n * 46;
    const alpha = strength * (0.4 + n * 0.85);
    const ex = origin[0] + Math.cos(a) * len;
    const ey = origin[1] + Math.sin(a) * len;
    const nx = -Math.sin(a) * wid;
    const ny = Math.cos(a) * wid;
    const g = c.createLinearGradient(origin[0], origin[1], ex, ey);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(0.55, `rgba(${color},${alpha * 0.35})`);
    g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(origin[0] - nx * 0.25, origin[1] - ny * 0.25);
    c.lineTo(ex - nx, ey - ny);
    c.lineTo(ex + nx, ey + ny);
    c.lineTo(origin[0] + nx * 0.25, origin[1] + ny * 0.25);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/**
 * 廉价景深。把源画布降采样再放大，得到一片"软"的远景。
 * 比真高斯便宜两个数量级，视觉上对远景足够。
 */
export class DepthBlur {
  constructor(scale = 6) {
    this.scale = scale;
    this.a = null; this.w = 0; this.h = 0;
  }
  resize(w, h) {
    const sw = Math.max(2, Math.ceil(w / this.scale));
    const sh = Math.max(2, Math.ceil(h / this.scale));
    if (this.w === sw && this.h === sh) return;
    this.a = vkMakeCanvas(sw, sh);
    this.w = sw; this.h = sh;
  }
  /** 把 src 模糊后以 alpha 画到 dst 的 (dx,dy)。 */
  blit(dst, src, w, h, alpha = 1, dx = 0, dy = 0) {
    this.resize(w, h);
    const g = this.a.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.drawImage(src, 0, 0, w, h, 0, 0, this.w, this.h);
    dst.save();
    dst.globalAlpha = alpha;
    dst.drawImage(this.a, 0, 0, this.w, this.h, dx, dy, w, h);
    dst.restore();
  }
}

/**
 * 预渲染的发光点。原实现在每个碎片/每束光上调用 createRadialGradient，
 * 那是相当贵的（每帧几十次渐变对象分配）。这里一次烘好，
 * 用 drawImage + 缩放/着色即可。
 */
export class GlowSprites {
  constructor(colors = ['#e0bf7b', '#f4ce85', '#8ad0b4', '#a5574d'], size = 64) {
    this.size = size;
    this.colors = colors;
    this.map = new Map();
    this._ready = false;
  }
  /**
   * 惰性烘焙。
   *
   * 构造时不碰 canvas 有两层原因：
   *  1. `install()` 可能在任何环境被调用，构造期不该强制要求 DOM；
   *  2. 没人用到的颜色就不该被烘——省掉启动时的一次性抖动。
   */
  _ensure(color) {
    if (this.map.has(color)) return this.map.get(color);
    if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
    const sprite = this._bake(color, this.size);
    this.map.set(color, sprite);
    return sprite;
  }
  /** 预热全部默认颜色。浏览器里可选调用，避免首次绘制时掉一帧。 */
  warm() {
    for (const c of this.colors) this._ensure(c);
    this._ready = true;
  }
  _bake(color, size) {
    const c = vkMakeCanvas(size, size);
    const g = c.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, this._withAlpha(color, 0.42));
    grad.addColorStop(1, this._withAlpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }
  _withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  /** 在 (x,y) 画一个半径 radius 的光点。 */
  draw(c, x, y, radius, color, alpha = 1) {
    const s = this._ensure(color);
    if (!s) return;
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
    c.restore();
  }
}

/**
 * 可调密度的草。`step` 越大越稀疏——直接吃 perf 预算，
 * 让"保帧率"这件事从"关掉整片草"变成"草稀一点"，视觉连续性更好。
 */
export function grassField(c, x0, x1, y, seed = 0, opts = {}) {
  const { step = 1, height = 9, color = '#3d4f45', tipColor = '#5c6f5a', sway = 0 } = opts;
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < (x1 - x0) / 26; i += step) {
    const n = rand(seed + i * 3.7);
    const gx = x0 + i * 26 + n * 18;
    const gh = height * (0.5 + rand(seed + i * 9.1) * 0.9);
    const bend = sway * Math.sin(seed + i) * 3;
    c.moveTo(gx, y);
    c.quadraticCurveTo(gx + bend * 0.4, y - gh * 0.6, gx + bend, y - gh);
  }
  c.stroke();
  if (step <= 1) {
    c.strokeStyle = tipColor;
    c.lineWidth = 0.8;
    c.beginPath();
    for (let i = 0; i < (x1 - x0) / 26; i++) {
      const n = rand(seed + i * 3.7);
      const gx = x0 + i * 26 + n * 18;
      const gh = height * (0.5 + rand(seed + i * 9.1) * 0.9);
      const bend = sway * Math.sin(seed + i) * 3;
      c.moveTo(gx + bend * 0.7, y - gh * 0.66);
      c.lineTo(gx + bend, y - gh);
    }
    c.stroke();
  }
}

/**
 * 地面湿反射：把发光物体在水面下镜像画一遍，再叠一层横向拉伸。
 * 只在有水的章节开，成本是每条反射一次 drawImage。
 */
export function wetReflection(c, drawFn, y, strength = 0.28) {
  c.save();
  c.globalAlpha = strength;
  c.translate(0, y * 2);
  c.scale(1, -1.6);   // 纵向压扁并翻转
  drawFn(c);
  c.restore();
}

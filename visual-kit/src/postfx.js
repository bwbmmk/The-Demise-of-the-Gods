/**
 * 后处理。
 *
 * 原则：**每一档都能单独关掉**，且全部走离屏缓冲，不改动主画布的像素格式。
 * 后处理是最容易把帧率吃光的东西，所以每一道的成本都写在这里，
 * 由 perf 的 QualityGovernor 决定开到哪一档。
 *
 *   Bloom      1 次降采样 + 1 次平方（阈值近似）+ 1 次放大合成
 *   ChromaticAberration  2 次全屏过滤绘制（仅满配档）
 *   Grain      1 次平铺绘制（贴图预生成，运行期零成本）
 *   Vignette   1 次渐变填充
 */

import { clamp } from './core.js';
import { vkMakeCanvas } from './canvas.js';


/**
 * 廉价 bloom。
 *
 * 经典做法是"亮度阈值 → 高斯模糊 → 叠加"，在 Canvas 2D 上没有 shader，
 * 全屏高斯太贵。这里的近似是：
 *   1. 降采样到 1/4（同时起到模糊作用）
 *   2. 用 multiply 把图像与自身相乘 → 平方亮度曲线
 *      （暗部趋近 0，亮部保留 → 天然的 soft threshold）
 *   3. 放大回全屏、lighter 叠加
 * 效果接近真 bloom，成本约为其 1/6。
 */
export class BloomPass {
  constructor(scale = 4, threshold = 0.62, strength = 0.55) {
    this.scale = scale;
    this.threshold = threshold;
    this.strength = strength;
    this.a = null;
    this.b = null;
    this.w = 0; this.h = 0;
    this.enabled = true;
  }
  resize(w, h) {
    const sw = Math.max(2, Math.ceil(w / this.scale));
    const sh = Math.max(2, Math.ceil(h / this.scale));
    if (this.w === sw && this.h === sh) return;
    this.a = vkMakeCanvas(sw, sh); this.a.getContext('2d');
    this.b = vkMakeCanvas(sw, sh); this.b.getContext('2d');
    this.w = sw; this.h = sh;
  }
  /** @param src 已画好整帧的 canvas */
  apply(dst, src, w, h, dt) {
    if (!this.enabled) return;
    this.resize(w, h);
    const ca = this.a.getContext('2d');
    const cb = this.b.getContext('2d');
    ca.setTransform(1, 0, 0, 1, 0, 0);
    ca.globalCompositeOperation = 'source-over';
    ca.clearRect(0, 0, this.w, this.h);
    ca.drawImage(src, 0, 0, w, h, 0, 0, this.w, this.h);

    // 平方亮度：暗部压到接近 0，亮部留住 → 近似阈值
    cb.setTransform(1, 0, 0, 1, 0, 0);
    cb.globalCompositeOperation = 'source-over';
    cb.clearRect(0, 0, this.w, this.h);
    cb.drawImage(this.a, 0, 0);
    cb.globalCompositeOperation = 'multiply';
    cb.drawImage(this.a, 0, 0);
    // 再补一次自身叠加，把高光推到溢出，形成光晕核心
    cb.globalCompositeOperation = 'lighter';
    cb.globalAlpha = clamp(this.threshold, 0, 1) * 0.5;
    cb.drawImage(this.a, 0, 0);
    cb.globalAlpha = 1;

    dst.save();
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = clamp(this.strength * (dt ? clamp(dt * 60, 0, 2) : 1), 0, 1);
    dst.drawImage(this.b, 0, 0, this.w, this.h, 0, 0, w, h);
    dst.restore();
  }
}

/**
 * 胶片颗粒。噪声贴图只在构造时生成一次，
 * 之后每帧只做一次平铺绘制 + 随机偏移，几乎零成本。
 */
export class GrainPass {
  constructor(tile = 160, strength = 0.05) {
    this.tile = tile;
    this.strength = strength;
    this.enabled = true;
    this.pattern = null;
    this.canvasPattern = null;   // 缓存好的 CanvasPattern
    this._matrix = null;
    if (typeof document !== 'undefined') this._build();
  }
  _build() {
    const c = vkMakeCanvas(this.tile, this.tile);
    const g = c.getContext('2d');
    const img = g.createImageData(this.tile, this.tile);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // 三角分布：比均匀分布更像真实胶片颗粒（中间调多、极值少）
      const v = 128 + (Math.random() + Math.random() - 1) * 150;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (typeof document !== 'undefined' && document.createElement) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = this.tile;
      tile.getContext('2d').drawImage(c, 0, 0);
      this.pattern = tile;
    } else {
      this.pattern = c;
    }
  }
  /**
   * 一次性把颗粒铺满全屏。
   *
   * 早期实现是双层 for 循环逐块 drawImage —— 1280×720 用 160px 贴图
   * 就是 40 次 drawImage，每帧 40 次调用足以吃掉好几毫秒。
   * 改成 CanvasPattern + 单次 fillRect：同样是那张贴图，
   * 但只有 1 次绘制调用，代价从 O(屏幕面积/贴图²) 降到 O(1)。
   */
  apply(dst, w, h, frame = 0) {
    if (!this.enabled || !this.pattern) return;
    // 用帧序号驱动偏移，确定性、可复现
    const ox = (frame * 7) % this.tile;
    const oy = (frame * 13) % this.tile;
    dst.save();
    dst.globalCompositeOperation = 'overlay';
    dst.globalAlpha = this.strength;
    let painted = false;
    if (!this.canvasPattern) {
      try {
        this.canvasPattern = dst.createPattern(this.pattern, 'repeat');
      } catch (_) { this.canvasPattern = null; }
    }
    if (this.canvasPattern) {
      try {
        if (typeof DOMMatrix !== 'undefined') {
          if (!this._matrix) this._matrix = new DOMMatrix();
          this._matrix.e = -ox;
          this._matrix.f = -oy;
          this.canvasPattern.setTransform(this._matrix);
        }
        dst.fillStyle = this.canvasPattern;
        dst.fillRect(0, 0, w, h);
        painted = true;
      } catch (_) { painted = false; }
    }
    if (!painted) {
      // 退化路径：环境不支持 pattern 变换时仍然铺满，只是调用次数多些
      for (let y = -oy; y < h; y += this.tile) {
        for (let x = -ox; x < w; x += this.tile) dst.drawImage(this.pattern, x, y);
      }
    }
    dst.restore();
  }
}

/**
 * 色差。仅满配档开启——它要额外两次全屏过滤绘制。
 * 通过一次性注入的 SVG feColorMatrix 分离通道，然后错位叠加。
 */
export class ChromaticAberrationPass {
  constructor(offset = 1.2, filtersReady = false) {
    this.offset = offset;
    this.enabled = false;   // 由 install() 在确认可用后打开
    this.ready = filtersReady;
  }
  /** 注入 SVG 滤镜定义。返回是否成功。 */
  installFilters(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || this.ready) return this.ready;
    if (doc.getElementById('vk-ca-filters')) { this.ready = true; return true; }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg');
    svg.id = 'vk-ca-filters';
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    const defs = doc.createElementNS(NS, 'defs');
    // 只留红 / 只留蓝两张矩阵
    for (const [id, r, g, b] of [['vk-ca-r', 1, 0, 0], ['vk-ca-b', 0, 0, 1]]) {
      const f = doc.createElementNS(NS, 'filter');
      f.id = id;
      const m = doc.createElementNS(NS, 'feColorMatrix');
      m.setAttribute('type', 'matrix');
      m.setAttribute('values', `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`);
      f.appendChild(m);
      defs.appendChild(f);
    }
    svg.appendChild(defs);
    doc.body.appendChild(svg);
    this.ready = true;
    return true;
  }
  /** @param src 全帧来源；本 pass 直接往 dst 叠两条通道。 */
  apply(dst, src, w, h) {
    if (!this.enabled || !this.ready) return;
    const o = this.offset;
    dst.save();
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = 0.5;
    try {
      dst.filter = 'url(#vk-ca-r)';
      dst.drawImage(src, -o, 0);
      dst.filter = 'url(#vk-ca-b)';
      dst.drawImage(src, o, 0);
      dst.filter = 'none';
    } catch (_) {
      // 某些环境不支持 filter url()：静默跳过，不影响其余画面
    }
    dst.restore();
  }
}

/** 暗角。用缓存的径向渐变，避免每帧重建。 */
export class VignettePass {
  constructor(inner = 0.25, outer = 0.8, alpha = 0.22) {
    this.inner = inner; this.outer = outer; this.alpha = alpha;
    this.enabled = true;
    this._grad = null;
    this._key = '';
  }
  apply(dst, w, h) {
    if (!this.enabled) return;
    const key = `${w}x${h}`;
    if (this._key !== key) {
      const g = dst.createRadialGradient(w * 0.52, h * 0.43, h * this.inner, w * 0.52, h * 0.43, Math.max(w * 0.72, h * this.outer));
      g.addColorStop(0, 'rgba(2,9,12,0)');
      g.addColorStop(1, `rgba(2,9,12,${this.alpha})`);
      this._grad = g;
      this._key = key;
    }
    dst.fillStyle = this._grad;
    dst.fillRect(0, 0, w, h);
  }
}

/** 把四道后处理合成一个可开关的栈。 */
export class PostStack {
  constructor(opts = {}) {
    this.bloom = new BloomPass(opts.bloomScale ?? 4, opts.bloomThreshold ?? 0.62, opts.bloomStrength ?? 0.5);
    this.grain = new GrainPass(opts.grainTile ?? 160, opts.grainStrength ?? 0.05);
    this.ca = new ChromaticAberrationPass(opts.caOffset ?? 1.2);
    this.vignette = new VignettePass();
    this.frame = 0;
  }
  /** 依据 perf 预算开关各道。 */
  configure(budgets) {
    if (!budgets) return;
    this.bloom.enabled = !!budgets.bloom;
    this.grain.enabled = !!budgets.grain;
    this.vignette.enabled = true;
    this.ca.enabled = !!budgets.aberration && this.ca.ready;
  }
  setEnabled(on) {
    this.bloom.enabled = on;
    this.grain.enabled = on;
    this.vignette.enabled = on;
    this.ca.enabled = on && this.ca.ready;
  }
}

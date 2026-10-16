/**
 * 基础数学与工具。全部无副作用、可树摇。
 * 这一层刻意不依赖任何游戏模块——visual-kit 可以脱离《神之殇》单独使用。
 */

/**
 * 圆周率 ×2。
 *
 * 为什么叫 `VK_TAU` 而不叫 `TAU`：打包成单文件时（tools/bundle.mjs），
 * 所有模块会被拼进同一个作用域，顶层重名会直接让整份脚本语法报错。
 * 而 `src/renderer.js` 里已经有一个顶层的 `TAU`——那是原项目的文件，
 * 我们不改它，所以 kit 这边统一加 `VK_` 前缀让路。
 * 项目的 AGENTS.md 里"顶层变量必须全局唯一"这条约定，说的就是这件事。
 */
export const VK_TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

/** 平滑阶跃（Hermite）。比线性更有"重量"，且首尾导数为零，不会顿挫。 */
export const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

/** 更陡的平滑阶跃，用于希望"起步快、收尾慢"的插值。 */
export const smoother = (t) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** 指数趋近，帧率无关。tau 越大越"黏"。 */
export const damp = (a, b, tau, dt) => lerp(a, b, 1 - Math.exp(-dt / Math.max(1e-6, tau)));

/** 确定性伪随机：同一 seed 永远给同一个值，便于回放与截图复现。 */
export function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 整数哈希伪随机，值域 [0,1)。
 *
 * 比 `rand()` 快约 5 倍——`rand()` 每次都调 `Math.sin`，
 * 而粒子系统每帧要抽成百上千个随机数，那是热路径上的实打实开销。
 * 用 `Math.imul` 的整数雪崩混合，无浮点三角函数，且同样是确定性的：
 * 同一 seed 序列完全可复现，回放与截图验证不受影响。
 */
export function hash32(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

/** 一维值噪声，用于风、抖动、grain。 */
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  return lerp(rand(i), rand(i + 1), smooth(f));
}

/** 二维值噪声（双线性），用于火焰、雾气、藤蔓。 */
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = rand(ix * 57.1 + iy * 131.7);
  const b = rand((ix + 1) * 57.1 + iy * 131.7);
  const c = rand(ix * 57.1 + (iy + 1) * 131.7);
  const d = rand((ix + 1) * 57.1 + (iy + 1) * 131.7);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** 带角度单位的向量。 */
export const vec = (ang, len = 1) => [Math.cos(ang) * len, Math.sin(ang) * len];

/** 在骨架里，角度以"向右为 0、顺时针为正"（canvas 的 y 轴朝下）。 */
export const DEG = Math.PI / 180;

/**
 * 场景氛围层（scene ambience）——第一幕到第三幕的背景加层。
 *
 * ============================ 为什么要做这件事 ============================
 *
 * 序章的三段远景（灰城 / 无声圣所 / 神骸之桥）层次是够的，因为它们的
 * 语义就是"死掉的世界"——大面积的死寂本身就是内容。
 *
 * 但第一幕到第三幕的背景偏平面、偏重复，原因不是"细节画得不够"，
 * 而是**缺少三个本该表达主题的东西**：
 *
 *   1. 没有纵深。远、中、近三层明度接近，"贴"在同一张纸上。
 *   2. 没有"人"。故事讲的是《万家微火》——万家灯火一盏盏亮起来。
 *      可街景里除了屋檐下那几盏固定灯，看不到"这里住着人"。
 *   3. 地面是死黑的一整块，光不落地，前景和中景咬不住。
 *
 * 所以这一层的做法**不是加细节，是加层次和加人**。
 * 具体加的三样东西，每一样都能在剧本里找到出处：
 *
 * | 加什么 | 剧本依据 | 视觉效果 |
 * |---|---|---|
 * | 更远的两片剪影（强视差 + 被雾吃掉大半） | — | 远/中/近拉开明度差，画面不再是平的 |
 * | **万家灯火**（窗火 + 门前灯 + 渡口灯） | 结局三"一间普通房屋亮起火光 / 远处有人看见，也点起自己的灯" | 远景里出现"有人住"的证据 |
 * | 空气透视雾 + 贴地湿反光 + 光尘 | 第一幕"地图正在失去地名"的霾；渡口水面 | 地面不再是死黑，光落下来 |
 *
 * 另外两处**只跟着剧情走**的动态层：
 *   · 记名桥的暖光随"记住的名字"变多而增强（桥是剧情里凝实的那座桥）
 *   · 焚名台的火星、灰潮段压上来的灰雾（第三幕）
 *
 * ============================ 怎么接进去 ============================
 *
 * 全部通过**运行期包装 renderer 的方法**实现，不改原项目任何文件：
 *
 *   renderer.sky()             → 之后叠：去色带 + 远光空气感 + 高空霾
 *   renderer.background()      → 之后叠：两片远景剪影 + 空气透视 + 万家灯火
 *   renderer.groundSegment()   → 之后叠：贴地雾 + 湿反光 + 光尘 + 车辙
 *   renderer.nameBridgeScene() → 之后叠：桥面凝光
 *
 * 画在 `background()` **之后**而不是之前，是刻意的：
 * 这样叠上去的剪影自然落在原实现的远景之前、中景之后——正好是我们要的那一层。
 * 原实现里的中景（屋顶、钟楼、渡口木桩）依然压在最上面，谁也没被盖住。
 *
 * 所有瓦片都烘进 `TileCache`，滚动时只做 drawImage；地面层按分段剔除屏外区域，
 * 并且渐变对象按位置缓存——`groundSegment()` 一帧会被调用几十次（每段一次），
 * 不剔除就是每帧几十次全屏渐变填充（这个坑早先踩过一次，帧率直接掉到 9）。
 */

import { VK_TAU, clamp, lerp, hash32 } from './core.js';
import { TileCache } from './perf.js';
import { ditherOverlay, halo, groundHaze } from './art.js';

/* ------------------------------------------------------------------ *
 * 一、每种场景的配方
 * ------------------------------------------------------------------ */

/**
 * `haze`  空气透视强度（越远越被雾压住）
 * `far` / `near`  两片新增剪影的底色明度（深色，压在中景之下）
 * `glow`  万家灯火的总强度。**渡口、收容所这类有人聚集的地方更高**
 * `tile`  剪影瓦片形态：`roof` 屋顶连片 / `hill` 丘陵起伏 / `ruin` 断壁
 * `warm`  灯火色偏。街景偏暖黄，神域偏冷青——但都保留一点暖，因为"有人"
 * `dust`  光尘密度（地面层）
 * `wet`   地面湿反光强度（渡口、潮汐域最高）
 *
 * 数值的来处：这张表是照着 `renderer.js` 里 `DISTRICT_SKY` 的十五套配色
 * **逐一配的**——不是通用模板。夜色越深的场景，灯火越要压得住；
 * 白昼感越强的场景（避难所、丰收域），灯火越少、霾越偏暖。
 */
export const SCENE_FX = {
  // ── 第一幕 · 失名街区 ─────────────────────────────────────────
  // 剧情锚点：黄昏、人还在、只是没人记得名字。灯火在**室内**，窗外透出来。
  quarter: { haze: 0.15, far: 0.30, near: 0.14, glow: 0.85, tile: 'roof', warm: '232,190,116', dust: 0.5, wet: 0.30 },
  bellTower: { haze: 0.18, far: 0.27, near: 0.13, glow: 0.95, tile: 'roof', warm: '228,182,104', dust: 0.6, wet: 0.34 },
  ferry: { haze: 0.21, far: 0.26, near: 0.12, glow: 0.70, tile: 'hill', warm: '226,196,132', dust: 0.5, wet: 1.00 },
  nameBridge: { haze: 0.17, far: 0.24, near: 0.11, glow: 0.75, tile: 'hill', warm: '216,206,158', dust: 0.7, wet: 0.55 },

  // ── 幕间 · 北岸（不注册成跑图关卡，但保留配方以防回退） ──────────
  supplyRoad: { haze: 0.20, far: 0.30, near: 0.14, glow: 1.00, tile: 'hill', warm: '234,196,124', dust: 0.7, wet: 0.26 },
  coldArcade: { haze: 0.23, far: 0.26, near: 0.13, glow: 0.72, tile: 'roof', warm: '222,198,150', dust: 0.4, wet: 0.22 },
  shelter: { haze: 0.17, far: 0.30, near: 0.15, glow: 1.15, tile: 'hill', warm: '240,206,140', dust: 0.5, wet: 0.20 },

  // ── 第二幕 · 众神的谎言 ───────────────────────────────────────
  // 剧情锚点：神的领域。远景要**宏大而空**，灯火只作为"仍然有人自愿留下"的证据。
  windArchive: { haze: 0.24, far: 0.22, near: 0.10, glow: 0.45, tile: 'hill', warm: '196,214,196', dust: 0.9, wet: 0.20 },
  tideHarbor: { haze: 0.21, far: 0.20, near: 0.09, glow: 0.60, tile: 'hill', warm: '206,224,214', dust: 0.6, wet: 1.15 },
  harvestGranary: { haze: 0.19, far: 0.25, near: 0.12, glow: 0.85, tile: 'roof', warm: '236,208,134', dust: 0.8, wet: 0.24 },
  sealGate: { haze: 0.22, far: 0.22, near: 0.09, glow: 0.50, tile: 'roof', warm: '208,214,174', dust: 0.5, wet: 0.30 },

  // ── 第三幕 · 弑日者 ───────────────────────────────────────────
  // 剧情锚点：存的是"所有人试图遗忘的选择"，之后是白昼战争的现场。
  // 所以这一域刻意**冷得多也空得多**——灯火几乎为零，霾是灰的。
  fateArchive: { haze: 0.24, far: 0.23, near: 0.10, glow: 0.30, tile: 'ruin', warm: '198,206,190', dust: 1.05, wet: 0.26 },
  warGate: { haze: 0.26, far: 0.24, near: 0.11, glow: 0.35, tile: 'ruin', warm: '214,186,166', dust: 0.95, wet: 0.24 },
  namePyre: { haze: 0.25, far: 0.21, near: 0.10, glow: 0.55, tile: 'ruin', warm: '226,178,132', dust: 1.25, wet: 0.28 },
  greyRefuge: { haze: 0.27, far: 0.27, near: 0.12, glow: 0.40, tile: 'hill', warm: '200,206,200', dust: 0.85, wet: 0.32 },
};

/** 取不到场景名时的兜底（用第一幕街口）。 */
export const DEFAULT_SCENE_FX = SCENE_FX.quarter;

/* ------------------------------------------------------------------ *
 * 二、瓦片（离屏烘一次，之后只 blit）
 * ------------------------------------------------------------------ */

/** 一个可复用的高 DPI 离屏画布。 */
function makeSurface(CanvasCtor, w, h) {
  return new CanvasCtor(w, h);
}

/**
 * 屋顶连片剪影。
 *
 * 和序章 `ruins()` 的区别：这里是**连着住人的屋顶**，不是废墟。
 * 所以是连续的坡顶 + 零星屋脊塔，而不是断壁；间距也压得很近——
 * 城市密集这件事本身就是"这里曾经有很多人"的表达。
 */
function paintRoofTile(g, w, h, color, ink) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = color;
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 54 + hash32(i * 7 + 1) * 104;
    const bh = 30 + hash32(i * 13 + 2) * 82;
    const top = h - bh;
    g.fillStyle = color;
    g.fillRect(x, top, bw, bh);
    const kind = hash32(i * 29 + 3);
    if (kind < 0.42) {
      // 坡顶：江南民居那种缓坡，不是尖顶
      g.beginPath();
      g.moveTo(x - 9, top + 2);
      g.lineTo(x + bw * 0.5, top - 13 - hash32(i * 31) * 13);
      g.lineTo(x + bw + 9, top + 2);
      g.closePath();
      g.fill();
    } else if (kind < 0.56) {
      // 屋脊上的小阁楼
      g.fillRect(x + bw * 0.34, top - 19 - hash32(i * 37) * 12, bw * 0.22, 21);
    } else if (kind > 0.9) {
      // 偶尔一座高一点的塔：天际线上得有重音，否则一排全是平的
      g.fillRect(x + bw * 0.42, top - 30 - hash32(i * 53) * 26, bw * 0.16, 40);
    }
    // 檐口受光边——原实现里也用这一招把屋顶从背景里勾出来
    g.fillStyle = ink;
    g.fillRect(x, top, bw, 1.6);
    x += bw + 5 + hash32(i * 17 + 9) * 22;
    i++;
  }
}

/** 丘陵起伏剪影。用于渡口对岸、风域、灰潮段这类开阔远景。 */
function paintHillTile(g, w, h, color, ink) {
  g.clearRect(0, 0, w, h);
  const ridge = (x) => {
    const u = (x / w) * VK_TAU;
    return h - 34
      - Math.sin(u) * 24
      - Math.sin(u * 2.3 + 1.1) * 15
      - Math.sin(u * 4.7 + 2.6) * 7;
  };
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) g.lineTo(x, ridge(x));
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  // 山脊的柔和受光边。
  //
  // 这里**刻意不用 stroke**：早先用一条 1.4px 实线勾山脊，远看就是一条
  // 横贯全屏的亮线——像一根发光的铁丝，不是山。改成"只在脊线上方
  // 补一层渐隐的薄光"，靠明度衰减表达受光，轮廓就不硬化了。
  g.save();
  g.beginPath();
  for (let x = 0; x <= w; x += 6) {
    const y = ridge(x);
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.lineTo(w, ridge(w) + 3);
  for (let x = w; x >= 0; x -= 6) g.lineTo(x, ridge(x) + 3);
  g.closePath();
  g.clip();
  const gd = g.createLinearGradient(0, 0, 0, h);
  gd.addColorStop(0, 'rgba(0,0,0,0)');
  gd.addColorStop(0.72, 'rgba(0,0,0,0)');
  gd.addColorStop(1, ink);
  g.fillStyle = gd;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/**
 * 断壁剪影。第三幕专用：神域与战争现场。
 * 和 `roof` 的区别是**不连续**——一段墙、一个缺口、一段柱。
 * "破碎"这件事由轮廓的断续表达，而不是靠画裂纹。
 */
function paintRuinTile(g, w, h, color, ink) {
  g.clearRect(0, 0, w, h);
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 40 + hash32(i * 11 + 1) * 96;
    const bh = 24 + hash32(i * 23 + 2) * 96;
    const top = h - bh;
    g.fillStyle = color;
    g.fillRect(x, top, bw, bh);
    // 顶部缺一个口子，轮廓就成了断壁
    if (hash32(i * 31 + 4) > 0.4) {
      const notch = bw * (0.2 + hash32(i * 41 + 5) * 0.34);
      g.clearRect(x + bw * 0.3, top, notch, 6 + hash32(i * 43 + 6) * 18);
    }
    // 立柱：撑起来的那几根还在
    if (hash32(i * 47 + 7) > 0.62) {
      const cw = 7 + hash32(i * 53) * 6;
      g.fillRect(x + bw * 0.5 - cw / 2, top - 26, cw, 26);
    }
    g.fillStyle = ink;
    g.fillRect(x, top + 1, bw, 1.4);
    x += bw + 8 + hash32(i * 59 + 8) * 30;
    i++;
  }
}

const PAINTERS = { roof: paintRoofTile, hill: paintHillTile, ruin: paintRuinTile };

/* ------------------------------------------------------------------ *
 * 三、场景氛围层
 * ------------------------------------------------------------------ */

export class SceneAmbience {
  constructor(opts = {}) {
    this.tileW = opts.tileW ?? 1024;
    this.tileH = opts.tileH ?? 260;
    this.next = null;          // 已烘的 "近" 剪影
    this.farer = null;         // 已烘的 "远" 剪影
    this.tileKey = null;       // 当前烘的是哪种形态 + 哪个场景
    this.sceneName = null;
    this.t = 0;
    // 视图宽度：由包装层每帧写入。`groundSegment()` 一帧会被调用几十次
    // （每个地形分段一次），没有它就没法剔除屏外的分段。
    this.viewW = 1280;
    this._gradCache = new Map();
    // 记名桥的凝光进度 0..1；由剧情层（铜片数 / 桥已恢复）写入
    this.bridgeCondense = 0;
    // 灰潮进度 0..1：第三幕追来的灰雾，由包装层按玩家与灰潮前锋的距离写入
    this.grey = 0;
    // 月亮横向位置（与原实现 sky() 的取位一致）
    this.moonX = 0.74;
    // 画质缩放：地面层的密度按它打折，保帧率
    this.detail = 1;
    this.stats = { tilesBaked: 0, groundSegments: 0, lamps: 0 };
  }

  /** 场景名 → 配方。 */
  fx(name) { return SCENE_FX[name] || DEFAULT_SCENE_FX; }

  /**
   * 烘焙/切换剪影瓦片。
   *
   * 只有"场景换了"或者"形态换了"才重烘——同一幕里十五个场景是分段的，
   * 但每一段跑几分钟，重烘一次的成本完全可以接受，而滚动中一次都不重烘。
   */
  _ensureTiles(fx, CanvasCtor) {
    const key = `${fx.tile}|${fx.far}|${fx.near}`;
    if (this.tileKey === key && this.farer) return;
    const paint = PAINTERS[fx.tile] || paintRoofTile;
    const farColor = shade(fx.far, fx.tile, false);
    const nearColor = shade(fx.near, fx.tile, true);
    const ink = 'rgba(158,176,166,0.16)';
    if (!this.farer || this.farer.tileW !== this.tileW || this.farer.tileH !== this.tileH) {
      this.farer = new TileCache(this.tileW, this.tileH);
      this.next = new TileCache(this.tileW, this.tileH);
    }
    this.farer.repaint((g, w, h) => paint(g, w, h, farColor, ink));
    this.next.repaint((g, w, h) => paint(g, w, h, nearColor, ink));
    this.tileKey = key;
    this.stats.tilesBaked += 2;
  }

  /* ---------------- 挂在 sky() 之后 ---------------- */

  /**
   * 只做三件事：去色带、给远光加空气感、压一层高空霾。
   *
   * 刻意**不重画天空**——原实现用哪套配色是关卡数据（`DISTRICT_SKY`）决定的，
   * 这里既不知道也不该知道。只叠加，不替换。
   */
  enrichSky(c, w, h, distance, sceneName) {
    const fx = this.fx(sceneName);
    // 天空那一片才需要抖：色带只出现在渐变里，地面是纯色
    ditherOverlay(c, w, h * 0.56, 0.014);
    // 月亮/远光的位置与原实现一致（w*0.74, y=173）
    const mx = w * this.moonX - distance * 0.013;
    const my = 173;
    c.save();
    c.globalCompositeOperation = 'lighter';
    halo(c, mx, my, 150, '214,214,185', 0.05);
    halo(c, mx, my, 330, '196,206,171', 0.032);
    c.restore();
    // 高空一层极淡的霾，把天空顶部压住，画面重心更稳
    const g = c.createLinearGradient(0, 0, 0, h * 0.46);
    g.addColorStop(0, `rgba(30,44,52,${0.10 + fx.haze * 0.28})`);
    g.addColorStop(1, 'rgba(30,44,52,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h * 0.46);
  }

  /* ---------------- 挂在 background() 之后 ---------------- */

  /**
   * 两片远景剪影 + 空气透视 + 万家灯火。
   *
   * 顺序是有讲究的：
   *   ① 更远的一片（视差小、被雾吃掉大半）
   *   ② 近的一片（视差大一点、稍亮）
   *   ③ 空气透视雾——把① ② 之间、以及它们和中景之间的明度差拉开
   *   ④ 贴地雾带——把地面和远景分开
   *   ⑤ 万家灯火——**画在雾之后**，这样灯是"透过雾看见的"，
   *      而不是"贴在没有空气的远景上"。这一层顺序错了整幅画就假了。
   */
  enrichBackground(c, w, h, distance, t, sceneName, opts = {}) {
    const Ctor = opts.CanvasCtor || (typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas
      : typeof document !== 'undefined' ? document.createElement('canvas').constructor : null);
    if (!Ctor) return;
    const fx = this.fx(sceneName);
    this.sceneName = sceneName;
    this._ensureTiles(fx, Ctor);

    const baseY = h * 0.735;             // 天际线附近的基线（810 逻辑高度下≈595）

    // ① 最远的一片：视差 0.018
    c.save();
    c.globalAlpha = 0.78;
    this._layer(c, w, distance, baseY - 30, this.farer, 0.018, 0.5);
    c.restore();

    // ② 近的一片：视差 0.042
    c.save();
    c.globalAlpha = 0.94;
    this._layer(c, w, distance, baseY - 4, this.next, 0.042, 0.56);
    c.restore();

    // ③ 空气透视：越靠近地平线越被雾压住
    const g = c.createLinearGradient(0, baseY - 200, 0, baseY + 56);
    g.addColorStop(0, 'rgba(126,150,158,0)');
    g.addColorStop(0.56, `rgba(126,150,158,${fx.haze * 0.36})`);
    g.addColorStop(0.87, `rgba(132,156,163,${fx.haze * 0.76})`);
    g.addColorStop(1, 'rgba(120,144,152,0)');
    c.fillStyle = g;
    c.fillRect(0, baseY - 200, w, 256);

    // ④ 贴地雾带
    groundHaze(c, w, baseY + 6, 64, '140,166,172', fx.haze * 0.32);

    // ⑤ 万家灯火
    this._lamps(c, w, distance, baseY, t, fx, opts);
  }

  _layer(c, w, distance, y, tile, parallax, scale) {
    c.save();
    c.translate(0, y);
    c.scale(1, scale);
    tile.blit(c, distance * parallax, w);
    c.restore();
  }

  /**
   * 万家灯火。
   *
   * 这是整层的**题眼**：剧本第三幕结局是"一间普通房屋亮起火光 / 远处有人
   * 看见，也点起自己的灯"。原实现只有屋檐下几盏固定位置的灯，
   * 远景里看不到第二点光——那座城看起来像空的。
   *
   * 做法刻意克制：**四个刻度一栋房，只在两个高度上各点一个窗**。
   * 密度一旦上去就会变成"星空"而不是"屋里的灯"，那反而背离主题。
   * 位置、有无、明灭全部由 `hash32(栋号)` 决定，所以：
   *   · 同一栋房子的灯永远在同一个位置（滚动时不会漂）
   *   · 呼吸/摇曳由时间驱动，不影响位置
   *
   * 灯不画在屋顶上，而是画在屋顶**下面**一点点——那是窗户的高度。
   */
  _lamps(c, w, distance, baseY, t, fx, opts) {
    const k = fx.glow;
    if (k <= 0.02) return;
    const step = 108;                                  // 每 108px 一栋
    const parallax = opts.lampParallax ?? 0.042;       // 跟"近"剪影同层
    const scroll = distance * parallax;
    const first = Math.floor(scroll / step) - 1;
    const count = Math.ceil(w / step) + 3;
    const dim = opts.dim ?? 1;                         // 灰潮/演出时整体压暗
    const reduced = opts.reducedMotion;
    this.stats.lamps = 0;

    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = first; i < first + count; i++) {
      const n0 = hash32(i * 71 + 11);
      // 亮灯率 ∝ glow，但要**平方**衰减，否则第一幕会变成满天星。
      // 一道街景里同时亮着的窗本来就不该多——多了就不像"屋里的灯"了。
      if (n0 > k * k) continue;
      const x = i * step - scroll + 22 + hash32(i * 73 + 13) * 46;
      if (x < -30 || x > w + 30) continue;
      // 同一栋房子的两个窗：上窗必亮（那是主灯），下窗看运气。
      // 这样"一处光源"集中在一栋上，而不是散成一排均匀的点。
      for (let row = 0; row < 2; row++) {
        const n1 = hash32(i * 89 + row * 37 + 17);
        if (row === 1 && n1 > 0.42) continue;
        const y = baseY - 52 - row * 34 + hash32(i * 97 + row * 19 + 23) * 9;
        // 呼吸：幅度很小，是"灯芯在烧"而不是"灯泡在闪"
        const puff = reduced ? 0.86 : 0.74 + 0.26 * Math.sin(t * (0.7 + n1 * 1.5) + i * 1.7 + row * 2.3);
        const a = 0.34 * dim * puff * (row ? 0.7 : 1);
        halo(c, x, y, 15 + n1 * 11, fx.warm, a);
        c.fillStyle = `rgba(${fx.warm},${Math.min(0.92, a * 2.3)})`;
        c.fillRect(x - 1.1, y - 1.6, 2.2, 3.2);
        this.stats.lamps++;
      }
    }
    c.restore();
  }

  /* ---------------- 挂在 groundSegment() 之后 ---------------- */

  /**
   * 街面：贴地雾 + 湿反光 + 车辙 + 光尘。
   *
   * 湿反光是"把天上的光拉到地上"——一条竖向的柔光柱。
   * 有了它地面就不再是死黑的一整块，前景和中景才咬得住。
   *
   * 用 `groundSegment()` 当钩子是因为它给了这一段的确切 y 与 x 范围；
   * 画在它之后、角色之前，层次正好落在该在的位置。
   */
  enrichGround(c, left, right, y, worldStart) {
    const w = right - left;
    if (w <= 0) return;
    // ① 剔除屏外分段：每帧调用次数 = 地形分段数，画布只显示其中 2–4 段
    if (right < -180 || left > this.viewW + 180) return;
    this.stats.groundSegments++;
    const fx = this.fx(this.sceneName);

    // ② 渐变对象按位置缓存：每段每帧新建 createLinearGradient 同样很贵
    const key = `${Math.round(y)}|${Math.round(worldStart / 400)}|${this.sceneName}`;
    let gr = this._gradCache.get(key);
    if (!gr) {
      const haze = c.createLinearGradient(0, y - 46, 0, y + 6);
      haze.addColorStop(0, 'rgba(140,166,172,0)');
      haze.addColorStop(0.74, `rgba(140,166,172,${0.036 + fx.haze * 0.06})`);
      haze.addColorStop(1, 'rgba(140,166,172,0)');
      const wetA = fx.wet * 0.052;
      const refl = c.createLinearGradient(0, y - 128, 0, y + 4);
      refl.addColorStop(0, 'rgba(198,206,180,0)');
      refl.addColorStop(0.68, `rgba(198,206,180,${wetA})`);
      refl.addColorStop(1, 'rgba(198,206,180,0)');
      gr = { haze, refl, wetA };
      this._gradCache.set(key, gr);
    }
    // 缓存要防无限增长（地形很长时 key 会很多）
    if (this._gradCache.size > 260) this._gradCache.clear();

    const t = this.t;
    c.save();
    c.globalCompositeOperation = 'lighter';

    // 1) 贴着地面的薄雾
    c.fillStyle = gr.haze;
    c.fillRect(left, y - 46, w, 52);

    // 2) 竖向湿反光：两根，位置随世界坐标缓慢移动（不是随屏幕，否则会跟着镜头滑）
    if (gr.wetA > 0.001) {
      const spacing = 1180;
      const phase = ((worldStart * 0.013 + this.moonX * 1360) % spacing + spacing) % spacing;
      for (let bx = left - phase; bx < right; bx += spacing) {
        if (bx < left - 60 || bx > right + 60) continue;
        c.save();
        c.translate(bx, 0);
        c.fillStyle = gr.refl;
        c.fillRect(-26, y - 128, 52, 132);
        c.restore();
      }
    }

    // 3) 车辙/湿痕：几道横向浅色纹，密度很低，不抢危险辨识度
    c.globalAlpha = 0.042;
    c.fillStyle = '#cfe0dc';
    for (let i = 0; i < 3; i++) {
      const yy = y - 7 - i * 14 - Math.sin(t * 0.7 + i) * 2;
      const ww = w * (0.32 + 0.2 * ((i + 1) % 2));
      const off = (i * 137 + worldStart * 0.03) % Math.max(1, w - ww);
      c.fillRect(left + off, yy, ww, 1.3);
    }

    // 4) 光尘：贴着地面往上飘的极淡亮点。
    //    第三幕命运域密度最高（dust 1.05）——那里"存着所有试图遗忘的选择"。
    if (fx.dust > 0.05) {
      const n = Math.round(5 * fx.dust * this.detail);
      for (let i = 0; i < n; i++) {
        const seed = Math.floor(worldStart / 90) * 13 + i * 7;
        const px = left + hash32(seed) * w;
        const cyc = reduced01(t * (0.05 + hash32(seed + 1) * 0.07) + hash32(seed + 2), 1);
        const py = y - 8 - cyc * 96;
        const a = 0.13 * Math.sin(cyc * Math.PI) * Math.min(1, fx.dust);
        if (a <= 0.004) continue;
        c.globalAlpha = a;
        c.fillStyle = fx.warm;
        c.fillRect(px, py, 1.4, 1.4);
      }
    }
    c.restore();

    // 5) 灰潮压过来时，已经走过的地面也灰掉
    if (this.grey > 0.01 && right < this.grey * 90000) {
      c.save();
      c.globalAlpha = Math.min(0.4, this.grey * 0.34);
      c.fillStyle = '#9baeb3';
      c.fillRect(left, y, w, 810 - y);
      c.restore();
    }
  }

  /* ---------------- 挂在 nameBridgeScene() 之后 ---------------- */

  /**
   * 记名桥的凝光。
   *
   * 剧情里那座桥是"随三段讲述逐步凝实"的（`a12`→`a15`）。
   * 所以让桥面的暖光**随进度增强**——记住的人越多，桥越亮。
   * `bridgeCondense` 由剧情层根据铜片数 / `bridge-restored` 写入。
   *
   * 桥面高度不用猜：记名桥那一段的地形是 y=606，桥面板比它高约 94。
   * 数值写在 `DECK_DY` 里，改关卡时只要改这一处。
   */
  enrichBridge(c, w, distance, t) {
    const DECK_DY = 94;
    const deckY = this._bridgeDeckY ?? (this._bridgeDeckY = 606 - DECK_DY);
    const x0 = 39900 - distance;              // 桥的世界起点（district 记名桥段）
    const span0 = 42100;                       // 桥的世界终点
    const left = Math.max(0, x0);
    const right = Math.min(w, span0 - distance);
    if (right <= left) return;

    const k = clamp(this.bridgeCondense, 0, 1);
    c.save();
    c.globalCompositeOperation = 'lighter';

    // 桥面暖光带：越亮说明"记住的人"越多
    const g = c.createLinearGradient(0, deckY - 30, 0, deckY + 10);
    g.addColorStop(0, 'rgba(244,206,133,0)');
    g.addColorStop(0.6, `rgba(244,206,133,${0.05 + k * 0.15})`);
    g.addColorStop(1, 'rgba(244,206,133,0)');
    c.fillStyle = g;
    c.fillRect(left, deckY - 30, right - left, 40);

    // 桥墩之间几盏"记忆灯"：随 k 逐个点亮
    const span = 340;
    for (let i = 0; i < 9; i++) {
      const lx = x0 + 260 + i * span;
      if (lx < -80 || lx > w + 80) continue;
      const lit = clamp(k * 9 - i, 0, 1);
      if (lit <= 0.02) continue;
      const pulse = 0.72 + 0.28 * Math.sin(t * 1.6 + i * 0.8);
      halo(c, lx, deckY - 12, 54 + lit * 40, '247,214,150', 0.15 * lit * pulse);
      c.fillStyle = `rgba(255,238,196,${0.38 * lit * pulse})`;
      c.fillRect(lx - 1.6, deckY - 18, 3.2, 6);
    }
    c.restore();
  }

  update(dt, ctx = {}) {
    this.t += dt;
    if (ctx.w) this.viewW = ctx.w;
    if (typeof ctx.detail === 'number') this.detail = clamp(ctx.detail, 0, 2);
    if (typeof ctx.grey === 'number') this.grey = clamp(ctx.grey, 0, 1);
  }

  clear() {
    this.t = 0;
    this.bridgeCondense = 0;
    this.grey = 0;
    this._gradCache.clear();
    this.stats.lamps = 0;
    this.stats.groundSegments = 0;
  }
}

/* ------------------------------------------------------------------ *
 * 四、小工具
 * ------------------------------------------------------------------ */

/** 0..1 循环。 */
function reduced01(v, span) {
  if (span <= 0) return 0;
  return ((v % span) + span) % span;
}

/**
 * 由配方的"明度系数"推出剪影实际颜色。
 *
 * 存系数而不是存颜色，是因为这两片剪影的作用是**排明度**：
 * 远的一定比近的浅、近的一定比中景深。存成系数，
 * 改一个数就能整体推拉，不用去猜哪个十六进制算"更浅"。
 */
function shade(k, tile, isNear) {
  // 基色随形态微调：屋顶偏青灰、丘陵偏蓝灰、断壁偏紫灰
  const base = tile === 'hill' ? [38, 56, 68] : tile === 'ruin' ? [42, 48, 62] : [44, 52, 56];
  const lift = isNear ? 0 : 1;
  const v = clamp(k, 0, 1);
  const r = Math.round(base[0] * (0.55 + v * 1.5) + lift * 16);
  const g2 = Math.round(base[1] * (0.55 + v * 1.5) + lift * 15);
  const b = Math.round(base[2] * (0.55 + v * 1.5) + lift * 14);
  return `rgb(${clamp(r, 8, 120)},${clamp(g2, 10, 128)},${clamp(b, 14, 136)})`;
}

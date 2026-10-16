/**
 * visual-kit 总装入口。
 *
 * 目标：**一行接入，原源码零改动**。
 *
 *   import { install } from './visual-kit/src/index.js';
 *   const kit = install(renderer);
 *
 * install() 做的是"运行期接管"，不是改文件：
 *   · renderer.burst   → 换成功率池化的粒子系统（零 GC、可预算）
 *   · renderer.event   → 旁听剧情事件，交给氛围层
 *   · renderer.render  → 外面包一层：帧计时 + 画质调度 + 剧情氛围层 + 后处理
 *   · renderer.resize  → 外面包一层：让各层缓存在尺寸变化时失效
 *
 * 因为全部是**包装**，所以任一子系统都可以单独关：
 *   install(renderer, { story: false })   只加粒子与后处理
 *   install(renderer, { post: false })    只加粒子与剧情氛围
 *   kit.setEnabled(false)                一键回到原版（原函数仍被保留）
 *
 * ⚠ 角色**不在本 kit 的管辖范围内**。
 * 早期版本曾用骨骼绑定 + IK 重写跑步动作，结果既像关节人偶、又出了膝反弯。
 * 那条路已整个撤掉：`src/rig.js`、`src/clips.js`、`src/hero-rig.js` 均已删除，
 * 角色绘制完全沿用原项目的 `hero()`，这里一行都不碰。
 */

import { PerfKit } from './perf.js';
import { VFXLayer } from './vfx.js';
import { PostStack } from './postfx.js';
import { StoryAmbience } from './story-ambience.js';
import { SceneAmbience } from './scene-ambience.js';
import { DepthBlur, GlowSprites } from './art.js';
import { vkMakeCanvas } from './canvas.js';

export const VERSION = '1.2.0';

export { PerfKit } from './perf.js';
export { VFXLayer, ParticlePool, Shockwaves, SpeedLines, drawSmear } from './vfx.js';
export { PostStack, BloomPass, GrainPass, VignettePass, ChromaticAberrationPass } from './postfx.js';
export { StoryAmbience, STORY_FX } from './story-ambience.js';
export { SceneAmbience, SCENE_FX } from './scene-ambience.js';
export * from './art.js';

const clampIdx = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 从玩家的关卡数据里取当前章节速度。 */
function speedOf(renderer, player) {
  const chapters = renderer.view?.level?.chapters;
  if (!chapters) return 320;
  return chapters[clampIdx(player?.chapter ?? 0, chapters.length)]?.speed ?? 320;
}

/**
 * 灰潮压进度 0..1。
 *
 * 第三幕的追逐战里 `greyFront` 是灰潮前锋的世界 x；它从 0 一路推到玩家身后。
 * 这里把它归一化成"已经吞掉多少路程"，地面层据此把走过的地方压灰。
 * 拿不到数据（非第三幕）就返回 0——这一层在别的关卡完全不存在。
 */
function greyProgress(player) {
  const front = player?.greyFront;
  if (typeof front !== 'number' || !isFinite(front) || front <= 0) return 0;
  return clamp01(front / 41400);
}

/**
 * 把 visual-kit 装到任意 Renderer 实例上。
 * @returns kit 句柄；重复调用会返回已有句柄（幂等）。
 */
export function install(renderer, options = {}) {
  if (renderer.__visualKit) return renderer.__visualKit;

  const opts = {
    particles: true,
    post: true,
    story: true,
    scene: true,
    speedLines: true,
    showStats: false,
    ...options,
  };

  const kit = {
    version: VERSION,
    renderer,
    enabled: true,
    opts,
    perf: new PerfKit(options.perf),
    vfx: new VFXLayer({ capacity: options.capacity ?? 900 }),
    post: new PostStack(options.postOpts),
    story: new StoryAmbience(options.story),
    scene: new SceneAmbience(options.scene),
    depthBlur: new DepthBlur(options.depthBlurScale ?? 6),
    glow: new GlowSprites(),
    frame: null,
    frameCtx: null,
    frameW: 0,
    frameH: 0,
    frames: 0,
    _orig: {},
  };

  /* ---------------- 场景纵深（背景美化） ---------------- */
  //
  // 全部是**包装**：先调原方法，再在它之后叠加。
  // 挂这几个点是因为它们正好是画面从远到近的顺序：
  //   sky() → background() → groundSegment() → 角色 → foreground()
  // 在 sky 之后叠天空修饰，在 background 之后叠空气透视与远景，
  // 在 groundSegment 之后叠贴地雾——层次就自然插进原结构里。
  //
  // 角色绘制（hero / motionTrail）不在此列，一行都不碰。
  const wrap = (name, after) => {
    const orig = renderer[name];
    if (typeof orig !== 'function') return;
    kit._orig[name] = orig;
    renderer[name] = function (...args) {
      const out = orig.apply(this, args);
      if (kit.enabled && opts.scene) {
        try { after.call(this, args, this); } catch { /* 场景层永远不该弄坏画面 */ }
      }
      return out;
    };
  };

  // 场景名：`background()`/`districtScene()` 都按"章节序号"取 scenery。
  // 包一层是为了在 sky()/groundSegment() 这些拿不到场景名的地方也能取到。
  const sceneNameAt = (self, chapter) => {
    const scenery = self.view?.scenery;
    if (!scenery) return null;
    return scenery[clampIdx(chapter ?? 0, scenery.length)] ?? scenery[0];
  };

  wrap('sky', (args, self) => {
    // sky(c, w, h, distance, t, biome)：biome 此时已经是配色数组或序号，
    // 真正的场景名要从 view.scenery 按章节取。
    const chapter = self.view?.level?.id === 'prologue' ? 0 : (self.__vkChapter ?? 0);
    kit.scene.enrichSky(self.ctx, args[2], args[3], args[4], sceneNameAt(self, chapter));
  });
  wrap('background', (args, self) => {
    const [c, w, h, distance, t, chapter] = args;
    const name = sceneNameAt(self, chapter);
    if (name !== null) self.__vkChapter = chapter ?? self.__vkChapter ?? 0;
    kit.scene.enrichBackground(c, w, h, distance, t, name, {
      reducedMotion: self.reducedMotion,
      // 画质档越低，光尘越稀；灯与雾不抽（它们是构图的一部分，不是装饰）
      dim: 1,
    });
  });
  wrap('groundSegment', (args, self) => {
    const [c, left, right, y, worldStart] = args;
    kit.scene.enrichGround(c, left, right, y, worldStart);
  });
  wrap('nameBridgeScene', (args, self) => {
    const [c, w, distance, t] = args;
    if (self.view?.level?.id !== 'district') return;
    kit.scene.enrichBridge(c, w, distance, t);
  });

  /* ---------------- 粒子 ---------------- */
  if (opts.particles) {
    kit._orig.burst = renderer.burst;
    renderer.burst = function burst(x, y, count, color, power = 1) {
      if (!kit.enabled) return kit._orig.burst.apply(this, arguments);
      // 不再往原数组 push：原渲染循环仍会遍历它，但现在是空的，
      // 于是既保留原逻辑（零改动），又拿到池化的零 GC 收益。
      kit.vfx.particles.burst(color, x, y, count, 34 + 118 * power, power, 0.62, 2.1);
    };
  }

  /* ---------------- 剧情事件 → 氛围层 ---------------- */
  // 只**旁听**原游戏已经发出的事件，不新增事件、不修改任何玩法数值。
  if (typeof renderer.event === 'function') {
    const origEvent = renderer.event;
    kit._orig.event = origEvent;
    renderer.event = function event(ev, player) {
      if (kit.enabled && opts.story) kit.story.onEvent(ev, player, this);
      return origEvent.apply(this, arguments);
    };
  }

  /* ---------------- 主渲染 ---------------- */
  const origRender = renderer.render;
  kit._orig.render = origRender;
  renderer.render = function render(dt, player, mode, alpha = 1, scene = null) {
    if (!kit.enabled) return origRender.apply(this, arguments);

    const speed = speedOf(this, player);
    const menu = mode === 'menu' || mode === 'intro';
    const camera = (menu ? this.time * 22 : (player?.x ?? 0)) - this.heroX;

    kit.perf.begin();
    const out = origRender.apply(this, arguments);

    const budgets = kit.perf.budgets;
    const w = this.width, h = this.height;

    // 1) 剧情氛围层：跟着事件与进度走的画面元素
    kit.story.update(dt, {
      camera, w, h, t: this.time, mode, player, menu,
      level: this.view?.level, groundAt: this.view?.groundAt,
      speed, reduced: this.reducedMotion,
    });
    // 桥的凝光强度直接由"记住了多少个名字"决定
    if (opts.story && opts.scene && this.view?.level?.id === 'district') {
      const got = player?.items?.size ?? 0;
      const restored = player?.flag?.has?.('bridge-restored') ? 1 : 0;
      kit.scene.bridgeCondense = clamp01(got / 3) * 0.6 + restored * 0.4;
    }
    kit.scene.update(dt, {
      w: this.width,
      // 画质档 → 光尘密度。灯与雾不抽，它们是构图的一部分。
      detail: [0.4, 0.6, 0.85, 1][budgets.level] ?? 1,
      // 第三幕灰潮段：地面越跑越灰。灰潮前锋由关卡数据给出，这里只做表现。
      grey: greyProgress(player),
    });

    // 2) 特效层：先推进、再补投放、最后绘制
    kit.vfx.update(dt, {
      budget: budgets.particles,
      speed,
      active: mode === 'running' && player?.grounded !== false,
      w, h, reduced: this.reducedMotion,
    });
    if (mode === 'running') {
      const c = this.ctx;
      c.save();
      c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      kit.vfx.draw(c, camera);
      kit.vfx.waves.draw(c, camera);
      if (opts.speedLines) kit.vfx.lines.draw(c, w);
      // 剧情氛围层画在世界坐标系里（要跟着相机滚）
      if (opts.story) kit.story.draw(c, camera);
      c.restore();

      // 色调与整屏闪光在屏幕坐标系里
      if (opts.story) {
        const end = this.view?.level?.world?.end || 0;
        const progress = end > 0 ? clamp01((player?.x ?? 0) / end) : 0;
        const cw = this.canvas.width, chh = this.canvas.height;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        kit.story.drawGrade(c, cw, chh, progress);
        kit.story.drawFlash(c, cw, chh);
        c.restore();
      }
    }

    // 3) 后处理
    if (opts.post) {
      kit.post.configure(budgets);
      kit.applyPost(dt);
    }

    kit.frames++;
    kit.perf.end();

    if (opts.showStats) kit.drawStats(this.ctx, w, h);
    return out;
  };

  /* ---------------- 尺寸变化 ---------------- */
  kit._orig.resize = renderer.resize;
  renderer.resize = function resize() {
    const out = kit._orig.resize.apply(this, arguments);
    kit.frame = null;               // 让下一帧按新尺寸重建后处理缓冲
    return out;
  };

  /* ---------------- 公共方法 ---------------- */

  /** 把当前帧拷进离屏缓冲，再依次跑后处理。 */
  kit.applyPost = function applyPost(dt) {
    const canvas = this.renderer.canvas;
    const cw = canvas.width, ch = canvas.height;
    if (!this.frame || this.frameW !== cw || this.frameH !== ch) {
      this.frame = vkMakeCanvas(cw, ch);
      this.frameCtx = this.frame.getContext('2d');
      this.frameW = cw; this.frameH = ch;
    }
    this.frameCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.frameCtx.globalCompositeOperation = 'source-over';
    this.frameCtx.clearRect(0, 0, cw, ch);
    this.frameCtx.drawImage(canvas, 0, 0);

    const c = this.renderer.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.post.bloom.apply(c, this.frame, cw, ch, dt);
    this.post.vignette.apply(c, cw, ch);
    this.post.grain.apply(c, cw, ch, this.frames);
    c.restore();
  };

  /** 画一个轻量性能 HUD。默认关闭，基准测试与调试时开。 */
  kit.drawStats = function drawStats(c, w, h) {
    const s = this.perf.stats;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = '12px ui-monospace, monospace';
    c.fillStyle = 'rgba(4,10,14,0.66)';
    c.fillRect(8, 8, 208, 62);
    c.fillStyle = '#d9e6e0';
    c.fillText(`FPS  ${s.fps.toFixed(1)}`, 16, 26);
    c.fillText(`avg  ${s.avg.toFixed(2)}ms   p95 ${s.percentile(0.95).toFixed(1)}ms`, 16, 42);
    c.fillText(`quality L${this.perf.budgets.level}   particles ${this.vfx.particles.n}/${this.vfx.particles.budget}`, 16, 58);
    c.restore();
  };

  kit.setEnabled = function setEnabled(on) {
    this.enabled = !!on;
    if (!on) {
      this.vfx.clear();
      this.story.clear();
      this.scene.clear();
      this.renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return this;
  };

  /** 卸载：把原函数全部还原。 */
  kit.uninstall = function uninstall() {
    for (const [key, fn] of Object.entries(this._orig)) {
      if (fn) this.renderer[key] = fn;
    }
    this.renderer.__visualKit = null;
    return this;
  };

  renderer.__visualKit = kit;
  return kit;
}

/** 便捷：从全局拿到已安装的 kit。 */
export function kitOf(renderer) {
  return renderer?.__visualKit ?? null;
}

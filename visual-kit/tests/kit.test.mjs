/**
 * visual-kit 自检。用 `node --test visual-kit/tests/kit.test.mjs` 运行。
 *
 * 重点验证三类"说不清楚就一定会出错"的东西：
 *   1. 剧情氛围层 —— 旁听事件不改变原行为，且各池有界、不泄漏
 *   2. 缓存语义   —— StripCache 真的只在越界时重画，而不是每帧重画
 *   3. 装卸契约   —— install() 能原地接管，uninstall() 能完整还原
 *
 * ⚠ 这里**没有**角色/骨骼相关的测试：那条路（rig.js + clips.js + hero-rig.js）
 * 已整体撤掉，角色绘制完全沿用原项目的 hero()，kit 不再触碰它。
 * （曾经做过一版：膝盖方向写反成了反关节，而当时那条"不反关节"的测试
 *   用的法线恰好指向反方向，等于把 bug 焊死，还在 README 里写了句假话。
 *   撤掉这套东西时，连同那条不可信的断言一起消失了。）
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ParticlePool, Shockwaves, SpeedLines, VFXLayer } from '../src/vfx.js';
import { QualityGovernor, DynamicResolution, FrameStats, StripCache, TileCache } from '../src/perf.js';
import { StoryAmbience, STORY_FX } from '../src/story-ambience.js';
import { SceneAmbience, SCENE_FX } from '../src/scene-ambience.js';
import { install, VERSION } from '../src/index.js';

/* ------------------------------------------------------------------ *
 * 假 DOM：让依赖 canvas 的模块能在 Node 里被验证
 * ------------------------------------------------------------------ */

function makeStubCtx() {
  const rec = { calls: {}, gradients: 0, draws: 0 };
  const bump = (k) => { rec.calls[k] = (rec.calls[k] || 0) + 1; };
  const grad = () => { rec.gradients++; return { addColorStop() {} }; };
  return {
    canvas: { width: 1280, height: 720 },
    save: () => bump('save'), restore: () => bump('restore'),
    beginPath: () => bump('beginPath'), closePath: () => bump('closePath'),
    moveTo: () => bump('moveTo'), lineTo: () => bump('lineTo'),
    arc: () => bump('arc'), ellipse: () => bump('ellipse'),
    quadraticCurveTo: () => bump('quad'), bezierCurveTo: () => bump('bezier'),
    fill: () => bump('fill'), stroke: () => bump('stroke'),
    clip: () => bump('clip'), rect: () => bump('rect'),
    fillRect: () => bump('fillRect'), clearRect: () => bump('clearRect'),
    fillText: () => bump('fillText'),
    translate: () => bump('translate'), scale: () => bump('scale'), rotate: () => bump('rotate'),
    setTransform: () => bump('setTransform'), transform: () => bump('transform'),
    createLinearGradient: grad, createRadialGradient: grad,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => bump('putImageData'),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    drawImage: () => { rec.draws++; },
    measureText: () => ({ width: 10 }),
    set filter(v) { bump('filter'); }, get filter() { return 'none'; },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '10px sans-serif', textAlign: 'left', imageSmoothingEnabled: true,
  };
}

/** 极简 OffscreenCanvas 替身，供缓存类使用。 */
function installStubCanvas() {
  const prev = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return makeStubCtx(); }
  };
  return () => { if (prev === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = prev; };
}

/* ------------------------------------------------------------------ *
 * 1. 剧情氛围层
 * ------------------------------------------------------------------ */

test('剧情氛围层：旁听事件不修改事件对象本身', () => {
  const layer = new StoryAmbience();
  const ev = { type: 'collect', x: 100, y: -40 };
  const before = JSON.stringify(ev);
  layer.onEvent(ev, { x: 0, y: 0 }, null);
  assert.equal(JSON.stringify(ev), before, '氛围层不得改动原事件对象');
  assert.ok(layer.motes.n > 0, '捡到铜片应当产生光尘');
  assert.equal(layer.rings.list.length, 1, '应当产生一圈扩散光环');
});

test('剧情氛围层：每个已知事件都被接住，不抛异常', () => {
  const layer = new StoryAmbience();
  const types = ['jump', 'double', 'land', 'slide', 'collect', 'hit', 'respawn', 'checkpoint',
    'launch', 'resonance', 'warmth', 'lamp-lit', 'boss-enter', 'boss-cast', 'boss-broken',
    'boss-struck', 'boss-ward', 'boss-defeated', 'boss-relic-missed', 'chain-impact',
    '完全不存在的事件'];
  for (const type of types) {
    assert.doesNotThrow(() => layer.onEvent({ type, x: 100, y: -30 }, { x: 0, y: 0, grounded: true }, null), type);
  }
  assert.doesNotThrow(() => layer.onEvent(null, null, null));
  assert.doesNotThrow(() => layer.onEvent({}, undefined, undefined));
});

test('剧情氛围层：重生事件清空所有池（不留上一条命的痕迹）', () => {
  const layer = new StoryAmbience();
  layer.onEvent({ type: 'collect', x: 10, y: -20 }, {}, null);
  layer.onEvent({ type: 'boss-broken', x: 10, y: -20 }, {}, null);
  layer.lanterns.release(0, 0);
  layer.glyphs.add(0, 0);
  assert.ok(layer.motes.n > 0 || layer.rings.list.length > 0);
  layer.onEvent({ type: 'respawn' }, {}, null);
  assert.equal(layer.motes.n, 0);
  assert.equal(layer.rings.list.length, 0);
  assert.equal(layer.lanterns.list.length, 0);
  assert.equal(layer.glyphs.list.length, 0);
});

test('剧情氛围层：微尘池有界，长时间运行不无限增长', () => {
  const layer = new StoryAmbience();
  for (let i = 0; i < 300; i++) layer.onEvent({ type: 'collect', x: i, y: -20 }, {}, null);
  assert.equal(layer.motes.n, layer.motes.cap, `应被容量上限截断，实际 ${layer.motes.n}`);
  for (let i = 0; i < 600; i++) {
    layer.update(1 / 60, { camera: 0, w: 1280, h: 720, t: i / 60, menu: false, level: { id: 'district' } });
  }
  assert.ok(layer.motes.n <= layer.motes.cap, 'update 后不得超过容量');
});

test('剧情氛围层：光环与纸灯都有上限', () => {
  const layer = new StoryAmbience();
  for (let i = 0; i < 200; i++) layer.onEvent({ type: 'resonance', x: i, y: 0 }, {}, null);
  assert.ok(layer.rings.list.length <= 16, `光环应有上限，实际 ${layer.rings.list.length}`);
  for (let i = 0; i < 200; i++) layer.lanterns.release(i, 0);
  assert.ok(layer.lanterns.list.length <= 14, `纸灯应有上限，实际 ${layer.lanterns.list.length}`);
});

test('剧情氛围层：走过的路会留下记忆痕（与移动距离挂钩）', () => {
  const layer = new StoryAmbience();
  const groundAt = () => 0;
  for (let i = 0; i < 120; i++) {
    layer.update(1 / 60, {
      camera: 0, w: 1280, h: 720, t: i / 60,
      player: { x: i * 10, y: 0 }, groundAt, level: { id: 'district' },
    });
  }
  const memories = [...layer.motes.kind.slice(0, layer.motes.n)].filter((k) => k === 0).length;
  assert.ok(memories > 0, `走过的路应当留下记忆痕，实际 ${memories}`);
});

test('剧情氛围层：reduced-motion 下不生成灰烬与字痕', () => {
  const layer = new StoryAmbience();
  for (let i = 0; i < 200; i++) {
    layer.update(1 / 60, { camera: 0, w: 1280, h: 720, t: i / 60, menu: false, reduced: true, level: { id: 'district' } });
  }
  const ash = [...layer.motes.kind.slice(0, layer.motes.n)].filter((k) => k === 1).length;
  assert.equal(ash, 0, '减少动态效果时不应生成灰烬');
  assert.equal(layer.glyphs.list.length, 0, '减少动态效果时不应生成字痕');
});

test('剧情氛围层：章节配方齐全，冷调随剧情推进加深', () => {
  for (const id of ['prologue', 'district', 'covenant', 'lantern']) {
    const r = STORY_FX[id];
    assert.ok(r, `缺少 ${id} 的配方`);
    for (const k of ['ash', 'glyph', 'mote', 'cold', 'lantern']) {
      assert.equal(typeof r[k], 'number', `${id}.${k} 应是数字`);
    }
  }
  assert.ok(STORY_FX.district.cold < STORY_FX.covenant.cold, '第二幕应比第一幕更冷');
});

test('剧情氛围层：绘制不抛异常，且 clear 幂等', () => {
  const layer = new StoryAmbience();
  layer.onEvent({ type: 'collect', x: 0, y: 0 }, {}, null);
  layer.update(1 / 60, {
    camera: 0, w: 800, h: 600, t: 1,
    player: { x: 0, y: 0 }, groundAt: () => 0, level: { id: 'district' },
  });
  const ctx = makeStubCtx();
  assert.doesNotThrow(() => layer.draw(ctx, 0));
  assert.doesNotThrow(() => layer.drawGrade(ctx, 800, 600, 0.5));
  assert.doesNotThrow(() => layer.drawFlash(ctx, 800, 600));
  assert.doesNotThrow(() => layer.clear());
  assert.doesNotThrow(() => layer.clear());
});

/* ------------------------------------------------------------------ *
 * 2. 粒子与特效
 * ------------------------------------------------------------------ */

test('粒子池严格遵守容量，不越界、不泄漏', () => {
  const pool = new ParticlePool(64);
  for (let i = 0; i < 5000; i++) pool.spawn('dust', 0, 0, 0, 0, 1, 1);
  assert.equal(pool.n, 64, '活跃数不应超过容量');
  pool.update(10);
  assert.equal(pool.n, 0);
  pool.spawn('ember', 0, 0, 0, 0, 1, 1);
  assert.equal(pool.n, 1);
});

test('粒子预算生效：超预算时丢弃而不是拖慢整帧', () => {
  const pool = new ParticlePool(500);
  pool.budget = 20;
  for (let i = 0; i < 200; i++) pool.spawn('ash', 0, 0, 0, 0, 5, 1);
  assert.equal(pool.n, 20);
});

test('自定义颜色被原样保留（池化不改变画面配色）', () => {
  const pool = new ParticlePool(16);
  const idx = pool.defineColor('#3fa9c8', { gravity: 10, additive: true });
  pool.spawn('#3fa9c8', 0, 0, 10, 0, 1, 2);
  assert.equal(pool.kind[0], idx);
  assert.equal(pool.defs[idx].color, '#3fa9c8');
  assert.equal(pool.defs[idx].additive, true);
  assert.equal(pool.defineColor('#3fa9c8'), idx, '重复注册必须复用下标');
});

test('就地压缩回收后，剩下的粒子字段完整（不会串数据）', () => {
  const pool = new ParticlePool(8);
  pool.spawn('dust', 1, 2, 3, 4, 0.1, 5);
  pool.spawn('gold', 10, 20, 30, 40, 9, 6);
  pool.update(0.2);
  assert.equal(pool.n, 1);
  assert.ok(Math.abs(pool.x[0] - 10) < 6, `回收后 x 应保留长寿粒子，实际 ${pool.x[0]}`);
  assert.equal(pool.defs[pool.kind[0]].color, '#f4ce85');
});

test('冲击波与速度线都有上限，且会被回收', () => {
  const w = new Shockwaves(6);
  for (let i = 0; i < 50; i++) w.add(i, 0);
  assert.equal(w.list.length, 6);

  const lines = new SpeedLines(20);
  lines.update(0.5, { speed: 200, active: true, w: 1280, h: 720 });
  assert.equal(lines.lines.length, 0, '低速不该出速度线');
  for (let i = 0; i < 60; i++) lines.update(1 / 60, { speed: 520, active: true, w: 1280, h: 720 });
  assert.ok(lines.lines.length > 0 && lines.lines.length <= 20);
  for (let i = 0; i < 400; i++) lines.update(1 / 60, { speed: 520, active: true, w: 1280, h: 720 });
  assert.ok(lines.lines.length <= 20);
});

test('VFX 层能被清空（切场景/重生时不残留）', () => {
  const layer = new VFXLayer({ capacity: 64 });
  layer.particles.burst('dust', 0, 0, 30, 100);
  layer.waves.add(0, 0);
  layer.sampleBody(0, 0, {});
  assert.ok(layer.particles.n > 0);
  layer.clear();
  assert.equal(layer.particles.n, 0);
  assert.equal(layer.waves.list.length, 0);
  assert.equal(layer.samples.length, 0);
});

/* ------------------------------------------------------------------ *
 * 3. 性能层
 * ------------------------------------------------------------------ */

test('帧时间统计给出正确的 avg / p95', () => {
  const s = new FrameStats(100);
  for (let i = 0; i < 100; i++) s.push(i < 95 ? 10 : 40);
  assert.ok(Math.abs(s.avg - 11.5) < 1e-6);
  assert.ok(s.percentile(0.95) >= 10);
  assert.equal(s.percentile(1), 40, '最大样本应为 40');
});

test('画质调度：持续超支才降档，长时间富余才升档，锁定后不动', () => {
  const g = new QualityGovernor({ targetMs: 10, minLevel: 0, maxLevel: 3 });
  assert.equal(g.level, 3);
  g.step(100);
  assert.equal(g.level, 3, '单帧毛刺不应降档');
  for (let i = 0; i < 40; i++) g.step(100);
  assert.ok(g.level < 3 && g.level >= 0, `持续超支后应降档，实际 L${g.level}`);

  for (let i = 0; i < 400; i++) g.step(4);
  assert.ok(g.level > 0, '富余后应升档');

  const locked = new QualityGovernor({ targetMs: 10 });
  locked.locked = true;
  for (let i = 0; i < 100; i++) locked.step(200);
  assert.equal(locked.level, 3, '锁定后不应变化');
});

test('画质档位派生出的预算单调：档越高粒子越多', () => {
  const g = new QualityGovernor({});
  const seen = [];
  for (let l = 0; l <= 3; l++) { g.level = l; seen.push(g.budgets.particles); }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1]);
});

test('动态分辨率在持续超支时下降、富余时回升', () => {
  const d = new DynamicResolution({ min: 0.6, max: 1, settleMs: 0 });
  for (let i = 0; i < 50; i++) d.step(40, 13.5, 16.7);
  assert.ok(d.scale < 1 && d.scale >= 0.6);
  for (let i = 0; i < 200; i++) d.step(4, 13.5, 16.7);
  assert.ok(d.scale > 0.6);
});

test('StripCache 只在相机离开缓存窗口时才重画', () => {
  const restore = installStubCanvas();
  try {
    const strip = new StripCache(2000, 720);
    const painter = () => {};
    strip.ensure(0, 1280, painter);
    for (let i = 0; i < 50; i++) strip.ensure(i * 5, i * 5 + 1280, painter);
    assert.equal(strip.repaints, 1, `窗口内移动不该重画，实际 ${strip.repaints} 次`);
    strip.ensure(50000, 51280, painter);
    assert.ok(strip.repaints >= 2, '离开窗口必须重画');
  } finally { restore(); }
});

test('TileCache 平铺时按余数取模，长时间滚动不漂移', () => {
  const restore = installStubCanvas();
  try {
    const tile = new TileCache(512, 720);
    let paints = 0;
    tile.repaint(() => { paints++; });
    assert.equal(paints, 1);
    const target = () => ({ n: 0, drawImage() { this.n++; } });
    const a = target(); tile.blit(a, 0, 1280);
    const b = target(); tile.blit(b, 512, 1280);
    const c = target(); tile.blit(c, 512 * 1000000, 1280);
    assert.equal(a.n, b.n, '整数圈与零偏移的铺贴次数应相同');
    assert.equal(b.n, c.n, '超大偏移取模后应与小偏移一致');
  } finally { restore(); }
});

/* ------------------------------------------------------------------ *
 * 4. 集成契约
 * ------------------------------------------------------------------ */

/** 造一个行为可预测的假 renderer，用来验证包装/还原。 */
function makeFakeRenderer() {
  const calls = { burst: 0, render: 0, resize: 0, event: 0, sky: 0, background: 0, groundSegment: 0, nameBridgeScene: 0 };
  const canvas = { width: 1280, height: 720, getContext: () => makeStubCtx() };
  return {
    renderer: {
      canvas,
      ctx: makeStubCtx(),
      width: 1280, height: 720, scale: 1, heroX: 285,
      time: 0, particles: [], waves: [], trail: [],
      hero() {}, motionTrail() {}, sample() {},
      sky() { calls.sky++; },
      background() { calls.background++; },
      groundSegment() { calls.groundSegment++; },
      nameBridgeScene() { calls.nameBridgeScene++; },
      view: {
        level: { id: 'district', chapters: [{ speed: 320 }], world: { end: 47000 } },
        groundAt: () => 0,
        scenery: ['quarter', 'bellTower', 'ferry', 'nameBridge'],
      },
      burst() { calls.burst++; this.particles.push({}); },
      event() { calls.event++; },
      render(dt, player, mode) {
        calls.render++;
        const p = player || { x: 0, y: 0, elapsed: 0, grounded: true };
        this.sky(this.ctx, this.width, this.height, p.x, 1, 0);
        this.background(this.ctx, this.width, this.height, p.x, 1, 0);
        this.groundSegment(this.ctx, 0, 1280, 600, p.x, 1);
        this.nameBridgeScene(this.ctx, this.width, p.x, 1);
        this.hero(this.ctx, this.heroX, p.y, p, p.elapsed, mode === 'running');
        this.motionTrail(this.ctx, 0, p);
        return 'rendered';
      },
      resize() { calls.resize++; },
    },
    calls,
  };
}

test('install() 原地接管 burst / event / render / resize', () => {
  const { renderer } = makeFakeRenderer();
  const original = { burst: renderer.burst, render: renderer.render, event: renderer.event };
  const kit = install(renderer);
  assert.equal(kit.version, VERSION);
  for (const k of Object.keys(original)) {
    assert.notEqual(renderer[k], original[k], `${k} 应被替换`);
  }
  assert.equal(kit, install(renderer), '重复 install 应返回同一句柄');
});

test('⚠ install() 不再触碰角色绘制', () => {
  const { renderer } = makeFakeRenderer();
  const hero = renderer.hero;
  const motionTrail = renderer.motionTrail;
  const kit = install(renderer);
  assert.equal(renderer.hero, hero, '角色绘制函数必须原样保留');
  assert.equal(renderer.motionTrail, motionTrail, '拖尾绘制必须原样保留');
  assert.equal(kit._orig.hero, undefined, '不应保存 hero 的原实现');
});

test('启用后 burst 走粒子池，原数组保持为空（不再每帧 filter 分配）', () => {
  const { renderer } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  renderer.burst(100, 200, 12, '#e8c988', 1.2);
  assert.equal(renderer.particles.length, 0, '原数组应保持为空');
  assert.ok(kit.vfx.particles.n > 0, '粒子应进入池');
  assert.equal(kit.vfx.particles.defs[kit.vfx.particles.kind[0]].color, '#e8c988', '颜色应原样保留');
});

test('氛围层旁听事件，但原 event 仍然被调用', () => {
  const { renderer, calls } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  renderer.event({ type: 'collect', x: 5, y: -5 }, { x: 0, y: 0 });
  assert.equal(calls.event, 1, '原 event 必须照常执行');
  assert.ok(kit.story.motes.n > 0, '氛围层应收到事件');
});

test('setEnabled(false) 后完全回到原版行为', () => {
  const { renderer } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  kit.setEnabled(false);
  renderer.burst(0, 0, 3, '#fff', 1);
  assert.equal(renderer.particles.length, 1, '关闭后应回到原数组路径');
  assert.equal(kit.vfx.particles.n, 0, '关闭后不该再往池里放');
});

test('uninstall() 完整还原所有被替换的方法', () => {
  const { renderer } = makeFakeRenderer();
  const originals = {
    burst: renderer.burst, event: renderer.event,
    render: renderer.render, resize: renderer.resize,
  };
  const kit = install(renderer);
  kit.uninstall();
  for (const [k, fn] of Object.entries(originals)) {
    assert.equal(renderer[k], fn, `${k} 未被还原`);
  }
  assert.equal(renderer.__visualKit, null);
});

test('render 包装层不改变返回值，且原 render 一定被调用', () => {
  const { renderer, calls } = makeFakeRenderer();
  install(renderer, { post: false });
  const out = renderer.render(1 / 60, { x: 0, y: 0, elapsed: 1, grounded: true }, 'running', 1, null);
  assert.equal(out, 'rendered', '包装层不能吞掉返回值');
  assert.equal(calls.render, 1);
});

test('后处理关闭时不创建离屏缓冲（零额外内存）', () => {
  const { renderer } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  renderer.render(1 / 60, { x: 0, y: 0, elapsed: 1, grounded: true }, 'running', 1, null);
  assert.equal(kit.frame, null, '关闭后处理就不该申请整帧缓冲');
});

/* ------------------------------------------------------------------ *
 * 5. 场景纵深层
 * ------------------------------------------------------------------ */

test('场景层：包装 sky / background / groundSegment / nameBridgeScene，且原方法都还���被调用', () => {
  const { renderer, calls } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  for (const name of ['sky', 'background', 'groundSegment', 'nameBridgeScene']) {
    assert.equal(typeof renderer[name], 'function', `${name} 应仍是函数`);
  }
  renderer.render(1 / 60, { x: 0, y: 0, elapsed: 1, grounded: true }, 'running', 1, null);
  assert.ok(calls.sky > 0, '原 sky 必须被调用');
  assert.ok(calls.background > 0, '原 background 必须被调用');
  assert.ok(calls.groundSegment > 0, '原 groundSegment 必须被调用');
  assert.ok(calls.nameBridgeScene > 0, '原 nameBridgeScene 必须被调用');
  assert.equal(calls.hero, undefined, '角色绘制不参与本层的包装');
});

test('场景层：叠加出问题也不能弄坏画面（包装层吞掉异常）', () => {
  const { renderer } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  // 让场景层在无 DOM 的桩 ctx 上跑：它必须自己兜住，而不是把异常抛到渲染循环里
  assert.doesNotThrow(() => {
    renderer.sky(renderer.ctx, 1280, 720, 100, 1, 0);
    renderer.background(renderer.ctx, 1280, 720, 100, 1, 0);
    renderer.groundSegment(renderer.ctx, 0, 1280, 600, 100, 1);
    renderer.nameBridgeScene(renderer.ctx, 1280, 100, 1);
  });
});

test('场景层：关闭后不再叠加，但原方法照常执行', () => {
  const { renderer, calls } = makeFakeRenderer();
  const before = { sky: renderer.sky, background: renderer.background };
  const kit = install(renderer, { post: false });
  kit.setEnabled(false);
  const c0 = calls.sky + calls.background;
  renderer.sky(renderer.ctx, 1280, 720, 0, 1, 0);
  renderer.background(renderer.ctx, 1280, 720, 0, 1, 0);
  assert.equal(calls.sky + calls.background, c0 + 2, '关闭后原方法仍要照常跑');
  assert.ok(before.sky && before.background, '原实现始终保留');
});

test('场景配方：覆盖全部四关 scenery，且每项都齐全', () => {
  // 四个关卡在 level-*.js 里声明的 scenery（见 level-district/lantern/covenant/fate.js）
  const REQUIRED = [
    'quarter', 'bellTower', 'ferry', 'nameBridge',
    'supplyRoad', 'coldArcade', 'shelter',
    'windArchive', 'tideHarbor', 'harvestGranary', 'sealGate',
    'fateArchive', 'warGate', 'namePyre', 'greyRefuge',
  ];
  for (const id of REQUIRED) {
    assert.ok(SCENE_FX[id], `缺少配方的场景：${id}`);
  }
  for (const [id, r] of Object.entries(SCENE_FX)) {
    for (const k of ['haze', 'far', 'near', 'glow', 'dust', 'wet']) {
      assert.equal(typeof r[k], 'number', `${id}.${k} 应是数字`);
    }
    assert.ok(['roof', 'hill', 'ruin'].includes(r.tile), `${id}.tile 取值不对：${r.tile}`);
    assert.ok(/^\d+,\d+,\d+$/.test(r.warm), `${id}.warm 应是 "r,g,b"：${r.warm}`);
    assert.ok(r.haze > 0 && r.haze < 0.4, `${id}.haze 应在 (0,0.4)：${r.haze}`);
    // far 是"更远"的那片，必须比 near 浅（否则纵深的明度序就反了）
    assert.ok(r.far >= r.near, `${id}: far(${r.far}) 应不浅于 near(${r.near})`);
  }
});

test('第一幕的灯火比第三幕多（"有人住"与"神域"要分得开）', () => {
  const act1 = (SCENE_FX.quarter.glow + SCENE_FX.bellTower.glow + SCENE_FX.shelter.glow) / 3;
  const act3 = (SCENE_FX.fateArchive.glow + SCENE_FX.warGate.glow + SCENE_FX.greyRefuge.glow) / 3;
  assert.ok(act1 > act3 * 1.5, `第一幕平均灯火(${act1.toFixed(2)}) 应显著高于第三幕(${act3.toFixed(2)})`);
});

test('桥的凝光随"记住的名字"增多而增强', () => {
  const { renderer } = makeFakeRenderer();
  const kit = install(renderer, { post: false });
  const render = (items, restored) => {
    renderer.render(1 / 60, {
      x: 40500, y: 600, elapsed: 1, grounded: true,
      items: new Set(items), flag: new Set(restored ? ['bridge-restored'] : []),
    }, 'running', 1, null);
    return kit.scene.bridgeCondense;
  };
  const a = render([], false);
  const b = render(['p1', 'p2'], false);
  const c = render(['p1', 'p2', 'p3'], false);
  const d = render(['p1', 'p2', 'p3'], true);
  assert.ok(b > a, `拿到铜片后应更亮：${a} → ${b}`);
  assert.ok(c > b, `铜片越多应越亮：${b} → ${c}`);
  assert.ok(d > c, `桥恢复后应最亮：${c} → ${d}`);
  assert.ok(d <= 1, '不应超过 1');
});

test('场景层的远景瓦片只烘一次（滚动时不该反复重画）', () => {
  const restore = installStubCanvas();
  try {
    const scene = new SceneAmbience();
    const ctx = makeStubCtx();
    const opts = { CanvasCtor: globalThis.OffscreenCanvas };
    scene.enrichBackground(ctx, 1280, 720, 0, 0, 'quarter', opts);
    const first = scene.farer.blits;
    for (let i = 0; i < 30; i++) scene.enrichBackground(ctx, 1280, 720, i * 137, i, 'quarter', opts);
    assert.equal(scene.farer.repaints, 1, `远景瓦片应只烘一次，实际 ${scene.farer.repaints}`);
    assert.equal(scene.next.repaints, 1, `近景瓦片应只烘一次，实际 ${scene.next.repaints}`);
    assert.ok(scene.farer.blits > first, '后续帧应走 blit 而不是重画');
  } finally { restore(); }
});

test('切换场景形态才重烘瓦片（同形态同明度不重烘，形态变了才重烘）', () => {
  const restore = installStubCanvas();
  try {
    const scene = new SceneAmbience();
    const ctx = makeStubCtx();
    const opts = { CanvasCtor: globalThis.OffscreenCanvas };
    scene.enrichBackground(ctx, 1280, 720, 0, 0, 'quarter', opts);     // roof 0.30/0.14
    const baked = scene.farer.repaints;
    // 未知名 → 落到 DEFAULT（quarter），键完全相同，不该重烘
    scene.enrichBackground(ctx, 1280, 720, 9999, 1, '不存在的场景', opts);
    assert.equal(scene.farer.repaints, baked, '同 tile+同明度不该重烘');
    // ferry 是 hill，形态变了 → 必须重烘
    scene.enrichBackground(ctx, 1280, 720, 19999, 2, 'ferry', opts);
    assert.ok(scene.farer.repaints > baked, '形态变了才该重烘');
    // 同形态但明度不同（bellTower 也是 roof，far/near 与 quarter 不同）→ 也该重烘
    const after = scene.farer.repaints;
    scene.enrichBackground(ctx, 1280, 720, 29999, 3, 'bellTower', opts);
    assert.ok(scene.farer.repaints > after, '同形态但明度不同也要重烘，否则层次会串');
  } finally { restore(); }
});

test('地面层的渐变缓存有上限，长距离跑图不会无限增长', () => {
  const restore = installStubCanvas();
  try {
    const scene = new SceneAmbience();
    const ctx = makeStubCtx();
    for (let i = 0; i < 900; i++) {
      scene.enrichGround(ctx, i * 400 - 200, i * 400 + 200, 606, i * 400);
    }
    assert.ok(scene._gradCache.size <= 260, `缓存应被限制，实际 ${scene._gradCache.size}`);
  } finally { restore(); }
});

test('屏外的地面分段被剔除（不做无用的全屏填充）', () => {
  const restore = installStubCanvas();
  try {
    const scene = new SceneAmbience();
    scene.viewW = 1280;
    const ctx = makeStubCtx();
    const before = ctx ? null : null;
    scene.enrichGround(ctx, 0, 400, 606, 0);
    const inside = scene.stats.groundSegments;
    scene.enrichGround(ctx, 9000, 9400, 606, 9000);
    assert.equal(scene.stats.groundSegments, inside, '屏外分段不该进入绘制');
  } finally { restore(); }
});

test('灰潮进度会让已走过的地面变灰，clear() 能复位', () => {
  const restore = installStubCanvas();
  try {
    const scene = new SceneAmbience();
    const ctx = makeStubCtx();
    assert.equal(scene.grey, 0);
    scene.update(1 / 60, { grey: 0.6 });
    assert.ok(Math.abs(scene.grey - 0.6) < 1e-9);
    scene.update(1 / 60, { grey: 5 });     // 越界要夹住
    assert.equal(scene.grey, 1);
    scene.clear();
    assert.equal(scene.grey, 0);
  } finally { restore(); }
});

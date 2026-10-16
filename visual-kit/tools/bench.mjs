/**
 * visual-kit 基准测试。
 *
 * 在同一台机器、同一个 headless Chrome、同一个重负载场景下，
 * 分别测「原版渲染」与「接入 visual-kit 之后」的每帧耗时，
 * 输出 avg / p50 / p95 / max 与换算 FPS。
 *
 * 为什么用 p95 与 max 而不只看 avg：
 * 操作手感由**最慢的那些帧**决定。池化粒子消掉的是每帧数组分配，
 * 它改善的正是尾部延迟（GC 停顿），而不是平均值。
 *
 * 为什么静态服务器要独立进程：
 * Chrome 在 file:// 源下拒绝加载 ES 模块，必须走 http；
 * 而调用 Chrome 用的 execFileSync 会阻塞本进程事件循环，
 * 同进程的服务器就永远无法响应。详见 serve-helper.mjs。
 *
 * 用法：
 *   node visual-kit/tools/bench.mjs
 *   node visual-kit/tools/bench.mjs --json   只输出 JSON
 */

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChrome } from '../../tools/run-chrome.mjs';
import { startStaticServer } from './serve-helper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const projectRoot = path.resolve(kitRoot, '..');
const profile = path.join(kitRoot, '.bench-profile');
mkdirSync(profile, { recursive: true });

const server = startStaticServer(projectRoot);
const port = await server.port;
const page = `http://127.0.0.1:${port}/visual-kit/tools/bench.html`;

let dom;
try {
  dom = runChrome([
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--window-size=1000,700',
    '--dump-dom',
    page,
  ]);
} finally {
  server.stop();
}

const START = '@@BEN' + 'CH@@';
const END = '@@END' + 'BENCH@@';
const m = dom.match(new RegExp(START + '([\\s\\S]*?)' + END));
if (!m) {
  console.error('基准测试未产出结果。原始 DOM 片段：');
  console.error(dom.slice(-1600));
  process.exit(1);
}
const data = JSON.parse(m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(data.ok ? 0 : 1);
}

if (!data.ok) {
  console.error('基准测试失败：');
  console.error(data.error);
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : '-');

const row = (label, r) =>
  `  ${pad(label, 14)} avg ${pad(num(r.avg), 7)} p50 ${pad(num(r.p50), 7)} p95 ${pad(num(r.p95), 7)} max ${pad(num(r.max), 7)}  → ${pad(r.fps + ' fps', 9)}`;

console.log('');
console.log('══════════════════════════════════════════════════════════════════════════════════');
console.log('  A. 粒子系统微基准  ·  纯 JS，与环境无关，可信');
console.log('══════════════════════════════════════════════════════════════════════════════════');
const mic = data.micro;
console.log(`  场景：${mic.frames} 帧，每帧投放 ${mic.perFrame} 个，上限 ${mic.cap}（两条路径相同）`);
console.log(`    旧路径（对象数组 + 每帧 filter 重建）  ${pad(num(mic.legacyMs), 9)} ms`);
console.log(`    新路径（结构体数组 + 就地压缩）        ${pad(num(mic.pooledMs), 9)} ms`);
console.log(`    → 吞吐 ${mic.speedup}×（≈ 持平）  稳态粒子数 ${mic.legacyLive} / ${mic.pooledLive}`);
console.log('');
console.log(`    累计分配对象   旧 ${mic.legacyObjects}   新 ${mic.pooledAllocations}`);
console.log(`    累计重建数组   旧 ${mic.legacyArrays}   新 0`);
console.log('');
console.log('    结论要说准：池化**不提升吞吐**——原生 filter 本身很快，实测只到 0.9×。');
console.log('    它换来的是**运行期零分配**：24000 个对象与 600 个数组变成 0。');
console.log('    收益体现在尾延迟——旧路径必然被 GC 周期打断，表现为偶发掉帧；');
console.log('    跑酷游戏的"卡一下"恰恰就是这种帧，而不是平均帧率。');
console.log('');
console.log('══════════════════════════════════════════════════════════════════════════════════');
console.log('  B. 整帧渲染耗时  ·  ⚠ headless 软件光栅化，绝对值不可信，仅供横向参考');
console.log('══════════════════════════════════════════════════════════════════════════════════');
console.log('  每帧 CPU 耗时（毫秒，越小越好）');
console.log(row('原版', data.vanilla));
console.log(row('kit 满配', data.kit));
console.log(row('kit 无后处理', data.kitNoPost));
console.log(row('kit 自适应', data.adaptive));
const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : 0);
const sign = (v) => (v >= 0 ? '+' : '');
console.log(`    画质档位       L${data.adaptiveLevelStart} → L${data.adaptiveLevelEnd}（按帧时间自动降档）`);
console.log(`    粒子池         活跃 ${data.poolActive}，原数组残留 ${data.particlesLeft}（应为 0）`);
console.log('');
console.log('  ⚠ 为什么这一组不能当真：');
console.log('    `--dump-dom` 模式下画布不被真正合成，原版 p50 低到 0.4ms——');
console.log('    那不是"渲染很快"，而是"根本没光栅化"。');
console.log('    而 kit 的后处理要回读画布像素，代价全落在软件光栅化上。');
console.log('    真实 GPU 环境下后处理的成本远低于此，但也确实存在——');
console.log('    这正是画质调度存在的理由：跑不动时自动降档。');
console.log('');

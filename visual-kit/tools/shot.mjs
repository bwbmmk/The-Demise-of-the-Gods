/**
 * 演示页截图与冒烟检查。
 *
 * 做两件事：
 *   1. 在真实浏览器里跑 demo.html，确认 visual-kit 真的装载成功、没有报错、FPS 非零
 *   2. 导出画布并合成截图，供人眼确认画面
 *
 * 为什么要分两遍：
 * 这套 headless 组合里 `--screenshot` 截不到 canvas 像素（页面内 getImageData 正常），
 * 所以画布由页面自己 `toDataURL()` 导出，HUD 层交给 chrome 截，最后用 Pillow 贴回去。
 *
 * 用法：
 *   node visual-kit/tools/shot.mjs            跑检查 + 出图
 *   node visual-kit/tools/shot.mjs --check    只跑检查
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChrome } from '../../tools/run-chrome.mjs';
import { startStaticServer } from './serve-helper.mjs';
import { findPython, composeWithPillow, cropZoom } from './py.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const projectRoot = path.resolve(kitRoot, '..');
const outDir = path.join(kitRoot, 'screenshots');
const tmpDir = path.join(kitRoot, '.shot');
await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

const server = startStaticServer(projectRoot);
const port = await server.port;

const args = [
  '--headless=new', '--disable-gpu', '--no-first-run',
  `--user-data-dir=${path.join(tmpDir, 'profile')}`,
  '--hide-scrollbars', '--window-size=1120,720',
  // 不加 --virtual-time-budget：页面在截图模式下是同步跑固定帧数的，
  // 没有待决的 rAF 回调，不需要（也不该）用虚拟时间去推进。
];

let dom;
try {
  dom = runChrome([...args, '--dump-dom', `http://127.0.0.1:${port}/visual-kit/demo.html?shot=1`]);
} catch (e) {
  server.stop();
  throw e;
}

const decode = (s) => s.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');

// ---- 冒烟检查 ----
const checks = [];
const ok = (name, cond, detail = '') => checks.push({ name, pass: !!cond, detail });

const metaRaw = dom.match(/data-shot-meta="([^"]*)"/);
let meta = null;
if (metaRaw) { try { meta = JSON.parse(decode(metaRaw[1])); } catch { meta = null; } }

ok('演示页已就绪', /data-demo-ready="1"/.test(dom));
ok('画布已导出', /data-shot-ready="1"/.test(dom));
ok('导出主角定位信息', !!meta, meta ? `heroX=${meta.heroX?.toFixed(0)} scale=${meta.scale?.toFixed(3)}` : '无');

const shotMatch = dom.match(/data-shot="data:image\/png;base64,([^"]+)"/);
ok('取到画布像素', !!shotMatch, shotMatch ? `${Math.round(shotMatch[1].length / 1024)}KB base64` : '未取到');


const fps = dom.match(/id="h-fps"[^>]*>([\d.]+)</);
ok('FPS 读数有效', fps && Number(fps[1]) > 0, fps ? `${fps[1]} fps` : '读不到');

const q = dom.match(/id="h-q"[^>]*>L(\d)</);
ok('画质档位已下发', !!q, q ? `L${q[1]}` : '读不到');

const parts = dom.match(/id="h-p"[^>]*>(\d+) \/ (\d+)</);
ok('粒子预算生效', !!parts, parts ? `${parts[1]}/${parts[2]}` : '读不到');

// 页面内的错误处理器会把未捕获错误写进 DOM 与 data 属性，这里把内容一起报出来。
//
// ⚠ 必须先剥掉 <script> 内容再搜：--dump-dom 会把脚本源码原样吐出来，
// 而错误处理器自己就写着 'Uncaught'、'SyntaxError' 这些字面量，
// 直接搜整份 DOM 必然误报——之前就踩过这个坑（探针标记串被源码命中）。
const domNoScript = dom.replace(/<script[\s\S]*?<\/script>/g, '<script></script>');
const jsErr = (domNoScript.match(/data-js-error="([^"]*)"/) || [])[1]
  || (domNoScript.match(/脚本出错：([^<]*)/) || [])[1]
  || (/Uncaught[^<"\n]{0,160}|SyntaxError[^<"\n]{0,160}|TypeError[^<"\n]{0,160}/.exec(domNoScript) || [])[0]
  || '';
ok('页面无未捕获错误', !jsErr, jsErr ? jsErr.slice(0, 200) : '');

const failed = checks.filter((c) => !c.pass);
console.log('');
for (const c of checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? '  · ' + c.detail : ''}`);
console.log('');

if (failed.length) {
  server.stop();
  console.error(`冒烟检查失败 ${failed.length} 项`);
  process.exit(1);
}

if (process.argv.includes('--check')) { server.stop(); process.exit(0); }

// ---- 合成截图 ----
// 注意：服务器要留到第二遍截完才能关。
const canvasFile = path.join(tmpDir, 'canvas.png');
await writeFile(canvasFile, Buffer.from(shotMatch[1], 'base64'));
const overlay = path.join(tmpDir, 'overlay.png');
runChrome([...args, `--screenshot=${overlay}`, `http://127.0.0.1:${port}/visual-kit/demo.html?shot=1`]);
server.stop();

const py = findPython();
if (!py) {
  console.error('找不到带 Pillow 的 Python，跳过合成。');
  console.error('画布已导出到：' + canvasFile + '（可直接打开查看）');
  console.error('可设 QA_PYTHON 指向可用解释器后重跑。');
  process.exit(0);
}
const finalShot = path.join(outDir, 'kit-demo.png');
// 演示页布局：画布占上部，底部是控制栏（约 54px）
composeWithPillow(py.exe, { overlay, canvas: canvasFile, out: finalShot, rect: 'full', bottomBar: 54 });
console.log(`整屏截图：${finalShot}`);

// 主角特写：主角在设备像素下的位置 = 逻辑坐标 × renderer.scale
if (meta && Number.isFinite(meta.heroX) && Number.isFinite(meta.scale)) {
  const heroDevX = meta.heroX * meta.scale;
  // 角色脚底在 playerY，身体向上约 85px；取脚上方 40px 作为裁剪中心
  const heroDevY = (meta.playerY - 40) * meta.scale;
  const closeup = path.join(outDir, 'kit-closeup.png');
  cropZoom(py.exe, { src: canvasFile, out: closeup, centerX: heroDevX, centerY: heroDevY, half: 96, zoom: 4 });
  console.log(`角色特写：${closeup}`);
}
console.log(`（合成用 ${py.exe} / Python ${py.version}）\n`);

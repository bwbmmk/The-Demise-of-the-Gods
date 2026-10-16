/**
 * 沿关卡拍一组"原版 / 增强版"对照图，拼成一张联络表（contact sheet）。
 *
 * 为什么需要它：背景美化最容易变成"我觉得挺好"的自说自话。
 * 只有把**同一段路、同一个位置**的开/关两版并排放在一起，
 * 才看得出到底加了什么、值不值、会不会挡视线。
 *
 * 用法：
 *   node visual-kit/tools/backgrounds.mjs                 # 默认机位
 *   node visual-kit/tools/backgrounds.mjs --at 3000,12000  # 自定义机位
 *   node visual-kit/tools/backgrounds.mjs --layers 1,0,1,0
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChrome } from '../../tools/run-chrome.mjs';
import { startStaticServer } from './serve-helper.mjs';
import { findPython } from './py.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const projectRoot = path.resolve(kitRoot, '..');
const tmpDir = path.join(kitRoot, '.shot');
const outDir = path.join(kitRoot, 'screenshots');
await mkdir(tmpDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const argv = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : def;
};

/** 失名街区值得看的几个位置：街口、医者旧屋、钟楼、渡口、记名桥、桥心。 */
const DEFAULT_SPOTS = [2200, 10600, 23800, 30000, 37600, 41200];
const SPOTS = argv('--at', DEFAULT_SPOTS.join(',')).split(',').map(Number).filter(Boolean);
const HAD_AT = process.argv.includes('--at');
/**
 * 对照图默认**只留背景加层**：粒子/剧情氛围/后处理/速度线全部关掉。
 * 理由很直接——这张图要回答的是"背景多出了什么层次"，
 * 如果粒子后处理也一起开着，就分不清哪部分是哪一层加的，
 * 那这张图就变成"我觉得挺好看"，不算证据。
 */
const LAYERS = argv('--layers', '1,0,0,0,0');
const LEVEL = argv('--level', 'district');
/** 各关卡的默认机位：每一幕挑三个能代表该幕风格的位置。 */
const SPOTS_BY_LEVEL = {
  district: [2200, 10600, 23800, 30000, 37600, 41200],
  lantern: [2200, 9000, 17000, 25000, 30000],
  covenant: [3000, 11000, 18800, 26000, 34000, 44000],
  fate: [1600, 7000, 13500, 21000, 27500, 35000],
};
const spots = HAD_AT ? SPOTS : (SPOTS_BY_LEVEL[LEVEL] || DEFAULT_SPOTS);

const server = startStaticServer(projectRoot);
const port = await server.port;
const profile = path.join(tmpDir, 'bg-profile');

/** 抓一张：返回该页 canvas 导出的 PNG（base64 解码后） */
function grab(query) {
  const dom = runChrome([
    '--headless=new', '--disable-gpu', '--no-first-run',
    `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--window-size=1000,620',
    '--dump-dom',
    `http://127.0.0.1:${port}/visual-kit/demo.html?shot=1&${query}`,
  ]);
  const noScript = dom.replace(/<script[\s\S]*?<\/script>/g, '<script></script>');
  const err = (noScript.match(/data-js-error="([^"]*)"/) || [])[1] || '';
  if (err) throw new Error(`${query} → ${err}`);
  const m = dom.match(/data-shot="data:image\/png;base64,([^"]+)"/);
  if (!m) throw new Error(`${query} → 未取到画布`);
  return Buffer.from(m[1], 'base64');
}

const rows = [];
try {
  for (const x of spots) {
    const off = await grab(`level=${LEVEL}&at=${x}&layers=0,0,0,0`);
    const on = await grab(`level=${LEVEL}&at=${x}&layers=${LAYERS}`);
    const a = path.join(tmpDir, `bg-${LEVEL}-off-${x}.png`);
    const b = path.join(tmpDir, `bg-${LEVEL}-on-${x}.png`);
    await writeFile(a, off);
    await writeFile(b, on);
    rows.push({ x, off: a, on: b });
    console.log(`  已拍 ${LEVEL} x=${x}`);
  }
} finally {
  server.stop();
}

const py = findPython();
if (!py) {
  console.error('找不到带 Pillow 的 Python，原始图已留在 ' + tmpDir);
  process.exit(0);
}

const sheet = path.join(outDir, `kit-background-compare-${LEVEL}.png`);
const manifest = path.join(tmpDir, 'bg-manifest.json');
await writeFile(manifest, JSON.stringify(rows), 'utf8');

const composeScript = [
  "import json, sys",
  "from PIL import Image, ImageDraw",
  "rows = json.load(open(sys.argv[1], encoding='utf8'))",
  "imgs = [(r['x'], Image.open(r['off']).convert('RGB'), Image.open(r['on']).convert('RGB')) for r in rows]",
  "w, h = imgs[0][1].size",
  "LABEL = 26",
  "sheet = Image.new('RGB', (w * 2 + 12, (h + LABEL) * len(imgs) + 8), (10, 18, 24))",
  "d = ImageDraw.Draw(sheet)",
  "for i, (x, left, right) in enumerate(imgs):",
  "    y = 4 + i * (h + LABEL)",
  "    d.text((6, y + 7), 'x=%d  ORIG' % x, fill=(150, 170, 165))",
  "    d.text((w + 12, y + 7), 'x=%d  KIT' % x, fill=(216, 228, 224))",
  "    sheet.paste(left, (0, y + LABEL))",
  "    sheet.paste(right, (w + 12, y + LABEL))",
  "sheet.save(sys.argv[2])",
  "print(sys.argv[2])",
].join('\n');

execFileSync(py.exe, ['-c', composeScript, manifest, sheet], {
  stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
});

console.log(`\n对照图：${sheet}`);
console.log(`机位：${SPOTS.join(', ')}   子系统：${LAYERS}`);

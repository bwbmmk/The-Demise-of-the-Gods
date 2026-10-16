/**
 * 找到一台带 Pillow 的 Python。
 *
 * 为什么需要这层探测：
 * 截图合成必须用 Pillow（这套 headless 的 chrome --screenshot 不含 canvas 像素，
 * 只能靠 Pillow 把页面导出的画布贴回截图里）。
 * 而机器上可能有多套 Python，PATH 上那套不一定装了 Pillow。
 *
 * 所以：按优先级逐个试，包括 WorkBuddy 的隔离 venv（那里有 Pillow），
 * 并允许通过 QA_PYTHON 显式指定。
 * 探测时对 EBUSY 做一次重试——这台机器上安全软件会短暂独占可执行文件，
 * 偶发失败不该被当成"没装"。
 */

import { execFileSync } from 'node:child_process';

const MANAGED_VENV = 'C:\\Users\\MR\\.workbuddy\\binaries\\python\\envs\\default\\Scripts\\python.exe';

export const PY_CANDIDATES = [
  process.env.QA_PYTHON,
  MANAGED_VENV,
  'python',
  'python3',
  'py',
].filter(Boolean);

const TEST = 'from PIL import Image; import sys; print(sys.version.split()[0])';

function tryOnce(exe) {
  try {
    return execFileSync(exe, ['-c', TEST], {
      stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 20000,
    }).trim();
  } catch {
    return null;
  }
}

/** 返回 { exe, version } 或 null。 */
export function findPython() {
  for (const exe of PY_CANDIDATES) {
    let v = tryOnce(exe);
    // 一次重试：EBUSY/杀软扫描是这台机器上已知的偶发噪声
    if (!v) v = tryOnce(exe);
    if (v) return { exe, version: v };
  }
  return null;
}

/**
 * 裁出主角附近的区域并放大，用来人眼复核骨骼与跑姿。
 * @param centerX,centerY 主角在**设备像素**下的位置
 * @param half            裁剪半径（设备像素）
 * @param zoom            放大倍数
 */
export function cropZoom(exe, { src, out, centerX, centerY, half = 110, zoom = 4 }) {
  const script = `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
out = sys.argv[2]
cx, cy, half, zoom = float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
W, H = im.size
box = (max(0, int(cx - half)), max(0, int(cy - half)),
       min(W, int(cx + half)), min(H, int(cy + half)))
crop = im.crop(box)
crop = crop.resize((crop.width * zoom, crop.height * zoom), Image.NEAREST)
crop.save(out)
print(out)
`;
  return execFileSync(exe, ['-c', script, src, out, String(centerX), String(centerY), String(half), String(zoom)], {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  }).trim();
}

/**
 * 用 Pillow 把 canvas 贴回 overlay 截图的指定区域。
 * @param rect 'full'（整幅贴合到除底栏外的区域）或 'left,top,width,height,dpr'
 */
export function composeWithPillow(exe, { overlay, canvas, out, rect, bottomBar = 0 }) {
  const script = `
import sys
from PIL import Image
overlay = Image.open(sys.argv[1]).convert('RGB')
canvas  = Image.open(sys.argv[2]).convert('RGB')
out     = sys.argv[3]
mode    = sys.argv[4]
bar     = int(sys.argv[5])

W, H = overlay.size
if mode == 'full':
    box = (0, 0, W, H - bar)
else:
    left, top, width, height, dpr = [float(v) for v in mode.split(',')]
    box = (round(left * dpr), round(top * dpr),
           round((left + width) * dpr), round((top + height) * dpr))

size = (box[2] - box[0], box[3] - box[1])
if canvas.size != size:
    canvas = canvas.resize(size, Image.LANCZOS)
overlay.paste(canvas, box)
overlay.save(out)
print(out)
`;
  return execFileSync(exe, ['-c', script, overlay, canvas, out, rect, String(bottomBar)], {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  }).trim();
}

/**
 * 离屏画布工厂。
 *
 * 单独一个模块，而不是在 postfx / art / index 里各写一份：
 * 打包成单文件时所有模块共享同一作用域，三份同名函数会直接让脚本语法报错
 * （见 tools/bundle.mjs 的冲突检测）。放在这里既消掉重复，也消掉冲突。
 *
 * 优先用 `OffscreenCanvas`（不占 DOM、可离线线程绘制），
 * 退化时才创建普通 canvas。
 */

export function vkMakeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document === 'undefined') {
    throw new Error('vkMakeCanvas: 当前环境既没有 OffscreenCanvas 也没有 document');
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

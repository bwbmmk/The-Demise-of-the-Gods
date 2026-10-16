/**
 * 把 demo 打成**单文件 HTML**，双击即可打开。
 *
 * 为什么需要它：
 * Chrome 拒绝在 `file://` 源下加载 ES 模块（origin 为 null），
 * 所以直接双击 `demo.html` 是打不开的——必须先起服务器。
 * 项目自带的 `神之殇-demo.html` 之所以能双击，是因为它把全部模块
 * 拼成了同一个 `<script>`，没有跨文件 import。
 *
 * 拼接方案有三个坑，都是我在做的过程中撞出来的，这里都处理了：
 *
 *  1. **顶层重名**。所有模块共享一个作用域，任何重名的顶层
 *     const/let/function/class 都会让整份脚本直接语法报错。
 *     AGENTS.md 里"顶层变量必须全局唯一"这条约定说的就是它。→ 自动检测。
 *
 *  2. **别名导入**。`import { run as clipRun }` 剥掉后 `clipRun` 没有来源，
 *     运行期 `ReferenceError`。→ 自动生成 `const clipRun = run;`。
 *
 *  3. **命名空间导入**。`import * as clips` 同理，需要把目标模块的导出
 *     物化成一个对象。→ 自动生成 `const clips = { run, slide, ... };`。
 *
 * 后两个坑特别难查：语法检查能过，页面只是"什么都不发生"。
 * 所以构建期一律挡住，运行期再兜一层错误显示。
 *
 * 用法：
 *   node visual-kit/tools/bundle.mjs
 *   node visual-kit/tools/bundle.mjs --check   只做检查，不写文件
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const projectRoot = path.resolve(kitRoot, '..');

const OUT = path.join(kitRoot, '神之殇-视觉增强版.html');
const DEMO = path.join(kitRoot, 'demo.html');

/* ---------------- import / export 解析 ---------------- */

/**
 * 匹配一条完整的 import 语句（可跨行）。group1 = 子句，group2 = 相对路径。
 *
 * 路径部分必须写成 `\.\.?\/` 而不是 `\.\/`：
 * demo.html 引用的是 `../src/renderer.js`（两级向上），
 * 只认单级 `./` 会让整个游戏侧模块一个都收不进来——
 * 而且构建会"成功"，只是产物小了一圈、运行期才炸。
 */
const IMPORT_STMT = /^[ \t]*import\b([\s\S]*?)['"](\.\.?\/[^'"]+)['"][ \t]*;?[ \t]*$/gm;

/** 匹配再导出：export * / export * as X / export { … } 后面接 from。 */
const REEXPORT_STMT = /^[ \t]*export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"][ \t]*;?[ \t]*$/gm;

/** 解析 import 子句，返回 { kind, names, ns } 或 null。 */
function parseClause(raw) {
  let c = (raw || '').trim();
  c = c.replace(/\s*from\s*$/, '').trim();       // 去掉结尾的 from
  if (!c) return { kind: 'side-effect' };
  if (c.startsWith('*')) {
    const m = c.match(/^\*\s+as\s+([\w$]+)$/);
    return m ? { kind: 'namespace', ns: m[1] } : null;
  }
  if (c.startsWith('{')) {
    const inner = c.slice(c.indexOf('{') + 1, c.lastIndexOf('}'));
    const names = inner.split(',')
      .map((s) => s.trim()).filter(Boolean)
      .map((s) => {
        const m = s.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        return m ? { orig: m[1], local: m[2] || m[1] } : null;
      })
      .filter(Boolean);
    return { kind: 'named', names };
  }
  const m = c.match(/^([\w$]+)$/);
  return m ? { kind: 'default', local: m[1] } : null;
}

/** 收集一个模块导出的名字（供命名空间导入物化用）。 */
function exportNamesOf(source) {
  const names = new Set();
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  for (const m of clean.matchAll(/^[ \t]*export\s+(?:const|let|var|function|class)\s+([\w$]+)/gm)) {
    names.add(m[1]);
  }
  for (const m of clean.matchAll(/^[ \t]*export\s*\{([\s\S]*?)\}/gm)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p) continue;
      const mm = p.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (mm) names.add(mm[2] || mm[1]);
    }
  }
  return names;
}

/* ---------------- 依赖图 ---------------- */

const seen = new Map();   // 绝对路径 -> { id, source, deps }

async function collect(file) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return abs;
  const source = await readFile(abs, 'utf8');
  const deps = [];
  for (const m of source.matchAll(IMPORT_STMT)) deps.push(path.resolve(path.dirname(abs), m[2]));
  seen.set(abs, { id: path.relative(projectRoot, abs).replaceAll('\\', '/'), source, deps });
  for (const dep of deps) await collect(dep);
  return abs;
}

/** 拓扑排序：被依赖的排前面。 */
function topoSort() {
  const order = [];
  const state = new Map();
  const visit = (abs) => {
    const s = state.get(abs) || 0;
    if (s === 2 || s === 1) return;      // 1 = 正在访问，遇到环就跳过
    state.set(abs, 1);
    for (const dep of seen.get(abs).deps) visit(dep);
    state.set(abs, 2);
    order.push(abs);
  };
  for (const abs of seen.keys()) visit(abs);
  return order;
}

/* ---------------- 顶层声明冲突检测 ---------------- */

function topLevelDecls(source) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const names = [];
  const re = /^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(clean))) names.push(m[1]);
  return names;
}

function findConflicts(order) {
  const owner = new Map();
  const conflicts = [];
  for (const abs of order) {
    const { id, source } = seen.get(abs);
    for (const name of topLevelDecls(source)) {
      if (owner.has(name) && owner.get(name) !== id) {
        conflicts.push({ name, a: owner.get(name), b: id });
      } else if (!owner.has(name)) {
        owner.set(name, id);
      }
    }
  }
  return conflicts;
}

/* ---------------- 拼接 ---------------- */

/**
 * 把模块源码摊平。
 * import 语句不是简单删掉，而是**替换成绑定修复代码**——
 * 别名与命名空间导入在扁平作用域里没有天然对应物，必须显式物化。
 */
function flatten(abs) {
  return flattenSource(seen.get(abs).source, abs);
}

/** 摊平一段源码。`abs` 只用来解析相对路径与报错定位。 */
function flattenSource(source, abs) {
  let out = source.replace(REEXPORT_STMT, '');
  out = out.replace(IMPORT_STMT, (whole, clause, rel) => {
    const dep = seen.get(path.resolve(path.dirname(abs), rel));
    const parsed = parseClause(clause);
    if (!parsed) return `/* 未能解析的 import：${whole.trim()} */`;
    if (parsed.kind === 'side-effect') return '';
    if (parsed.kind === 'default') {
      // 本项目没有默认导出；真有的话摊平后名字无法对上，明确报错好过静默出错
      throw new Error(`不支持默认导入：${whole.trim()}（位于 ${seen.get(abs).id}）`);
    }
    if (parsed.kind === 'named') {
      // 只有发生改名时才需要修复代码；同名导入在扁平作用域里本来就能对上
      const aliases = parsed.names.filter((n) => n.orig !== n.local);
      if (!aliases.length) return '';
      return aliases.map((n) => `const ${n.local} = ${n.orig};`).join(' ');
    }
    // namespace：把目标模块的导出物化成一个对象
    const names = [...(dep ? exportNamesOf(dep.source) : [])];
    if (!names.length && dep) {
      throw new Error(`命名空间导入的目标没有可识别的导出：${rel}`);
    }
    return `const ${parsed.ns} = { ${names.join(', ')} };`;
  });
  return out.replace(/^export\s+default\s+/gm, 'const __default__ = ')
    .replace(/^export\s+/gm, '');
}

/* ---------------- 主流程 ---------------- */

const demoHtml = await readFile(DEMO, 'utf8');
const scriptMatch = demoHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('demo.html 里找不到 <script type="module">');
const demoScript = scriptMatch[1];

await collect(DEMO);
for (const m of demoScript.matchAll(IMPORT_STMT)) {
  await collect(path.resolve(kitRoot, m[2]));
}

const order = topoSort().filter((abs) => abs !== path.resolve(DEMO));

const conflicts = findConflicts(order);
if (conflicts.length) {
  console.error('\n✗ 顶层命名冲突（拼接后会导致语法错误）：\n');
  for (const c of conflicts) {
    console.error(`  ${c.name}`);
    console.error(`      ${c.a}`);
    console.error(`      ${c.b}`);
  }
  console.error('\n请把其中一个改名（AGENTS.md：顶层变量必须全局唯一）。\n');
  process.exit(1);
}

// 先摊平，摊平过程本身会抛出无法处理的导入形式
const banner = (id) => `\n// ${'─'.repeat(64)}\n// ${id}\n// ${'─'.repeat(64)}\n`;
const body = order.map((abs) => {
  const { id } = seen.get(abs);
  return banner(id) + flatten(abs);
}).join('\n');

// 自检：产物里不能再残留任何跨文件引用（file:// 下会让整个模块静默不执行）
const leftover = [
  ...body.matchAll(/^[ \t]*(?:import|export)[^\n]*from\s+['"][^'"]+['"]/gm),
  ...body.matchAll(/^[ \t]*import\s+['"]/gm),
];
if (leftover.length) {
  console.error('\n✗ 产物里仍残留跨文件引用：\n');
  for (const m of leftover.slice(0, 10)) console.error('  ' + m[0].trim());
  console.error('');
  process.exit(1);
}

if (process.argv.includes('--check')) {
  console.log(`✓ 检查通过：${order.length} 个模块，无顶层命名冲突、无无法处理的导入。`);
  process.exit(0);
}

// 注意：只能摊平 demo 的 **脚本内容**，不能摊平整个 HTML 文件——
// 否则 <!doctype html> 会被当成 JS 塞进 <script> 里，报"Unexpected token '<'"。
const flatDemo = flattenSource(demoScript, path.resolve(DEMO));

const script = `<!--
  《神之殇》视觉增强版 · 单文件离线预览
  由 visual-kit/tools/bundle.mjs 生成，共 ${order.length} 个模块拼成同一作用域。
  双击即可打开，不需要服务器、不需要联网。
  需修改请改 demo.html 与 visual-kit/src/*.js，然后重跑 bundle.mjs。
-->
<script>
// 离线单文件里，最怕的是"白屏且没有任何提示"——双击打开时用户没法看控制台。
// 所以把未捕获错误直接写到页面上。
window.addEventListener('error', function (e) {
  var msg = (e && (e.message || (e.error && e.error.message))) || '未知错误';
  var where = e && e.lineno ? ' @ 第 ' + e.lineno + ' 行' : '';
  document.body.dataset.jsError = msg + where;
  var box = document.getElementById('vk-error');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'vk-error';
    box.style.cssText = 'position:fixed;left:12px;bottom:70px;z-index:99;max-width:70vw;'
      + 'padding:10px 12px;border-radius:8px;background:#2a1417;border:1px solid #6b3038;'
      + 'color:#ffd9d9;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  box.textContent = '脚本出错：' + msg + where;
});
<\/script>
<script type="module">
${body}

// ${'─'.repeat(64)}
// 演示页逻辑（来自 demo.html）
// ${'─'.repeat(64)}
${flatDemo}
<\/script>`;

const outHtml = demoHtml.replace(/<script type="module">[\s\S]*?<\/script>/, () => script);
const finalHtml = outHtml.replace(
  /<title>([^<]*)<\/title>/,
  (_, t) => `<title>${t} · 单文件离线版</title>`,
);

await writeFile(OUT, finalHtml, 'utf8');
console.log(`✓ 已构建：${path.relative(projectRoot, OUT).replaceAll('\\', '/')}`);
console.log(`  ${order.length} 个模块，顶层命名无冲突。双击即可打开。`);

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// 顺序即依赖顺序：被 import 的模块必须排在前面，
// 因为构建时会把所有模块拼成同一个作用域并剥掉 import/export 语句。
// ⚠️ 加新模块必须同时加进这个列表，漏了不会报错——
//   只是它的导出在产物里不存在，表现为 `xxx is not defined` 在运行时才炸。
//   （踩过：hearts 没列进来，main.js 里 import 了 setThresholds，产物直接挂掉。）
//   依赖：progress → hearts；physics → hearts。
const modules=['chain-boss','combat-hints','hearts','level','narrative-lantern','narrative-covenant','narrative-fate','narrative-dawn','narrative-finale','narrative-act1','level-lantern','level-district','level-covenant','level-fate','level-dawn','level-finale','boss-channels','final-boss','physics','progress','animation','cinematics','narrative','ribbon','background-depth','renderer','music','audio-clips','audio','story','story-fate','story-dawn','story-finale','ending-media','chapter-scenes','story-editor','story-theater','lore','main'];
const [html,css,...sources]=await Promise.all([
  readFile(path.join(root,'index.html'),'utf8'),
  readFile(path.join(root,'styles.css'),'utf8'),
  ...modules.map(name=>readFile(path.join(root,'src',`${name}.js`),'utf8')),
]);
const selectedManifest=JSON.parse(await readFile(path.join(root,'assets/music/selected/manifest.json'),'utf8'));
// 保险：检查每个模块 import 的本地模块都在列表里。
// 漏列不会让构建失败，只会让产物在运行时炸（xxx is not defined），
// 那类问题排查起来很慢，所以在构建期就拦下来。
{
  const listed=new Set(modules);
  const missing=new Set();
  for(const [i,name] of modules.entries()){
    for(const m of sources[i].matchAll(/from\s+'\.\/([\w-]+)\.js'/g)){
      if(!listed.has(m[1]))missing.add(`${name} → ${m[1]}`);
    }
  }
  if(missing.size){
    console.error('构建中止：以下 import 的模块没列进 modules 列表：');
    for(const x of missing)console.error('  '+x);
    process.exit(1);
  }
}
const embedded={};
for(const clip of selectedManifest)embedded[clip.id]=(await readFile(path.join(root,'assets/music/selected',clip.file))).toString('base64');
const endingMedia={};
for(const id of ['transfer','embers','gate'])endingMedia[id]='data:image/jpeg;base64,'+(await readFile(path.join(root,'assets/ending',id+'.jpg'))).toString('base64');
endingMedia.epilogue='data:video/webm;base64,'+(await readFile(path.join(root,'assets/ending/epilogue.webm'))).toString('base64');
const script=sources.map((source,index)=>`// ---- ${modules[index]}.js ----\n`+source.replace('export const ENDING_MEDIA = null;',()=> 'export const ENDING_MEDIA = '+JSON.stringify(endingMedia)+';').replace('export const EMBEDDED_AUDIO = null;',()=>`export const EMBEDDED_AUDIO = ${JSON.stringify(embedded)};`).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n\n');
const output=html.replace('<link rel="stylesheet" href="styles.css">',()=>`<style>\n${css}\n</style>`).replace('<script type="module" src="src/main.js"></script>',()=>`<script type="module">\n${script}\n</script>`);
await writeFile(path.join(root,'神之殇-demo.html'),output,'utf8');
console.log('已构建：神之殇-demo.html（双击即可离线试玩）');

import { ALL_ENTRIES } from './narrative.js';
import { DISTRICT_ENCOUNTERS } from './narrative-act1.js';
import { LANTERN_ENCOUNTERS } from './narrative-lantern.js';
import { COVENANT_ENCOUNTERS } from './narrative-covenant.js';
import { FATE_ENCOUNTERS } from './narrative-fate.js';
import { DAWN_ENCOUNTERS } from './narrative-dawn.js';
import { CHAPTER_STORIES, INTERMISSION_PANELS } from './chapter-scenes.js';
import { FINAL_CHOICES } from './story-finale.js';
import { heartsThresholds,setThresholds,setHeartsEnabled } from './hearts.js';

// 这是本地创作者工具的门槛，不是服务器权限。离线单文件没有后端，
// 文本覆盖保存在当前浏览器的 localStorage 中，并由主线与纯享版共用。
export const CREATOR_PASSWORD='76971585';
export const STORY_EDIT_KEY='requiem.creator.text.v1';

// Boss 战的纯享摘要也挂在共享数据上。这样改过的摘要会同步到幕末结算文案。
export const CREATOR_SUMMARIES={
  'district-boss':{title:'钟声越过了桥。\n盾在火里裂开。',body:'常晚敲响手钟，军官的盾裂开。岑渡把回火印送向烬，韩蕙的灯护住他的身后。\n烬在法术之间接过回火印，一次次将火送回。军官收起剑，退到了桥边。',quote:'韩蕙：「都还在吗？叫一声。」'},
  'covenant-boss':{title:'锤落下。\n三根链先后断了。',body:'烬站到金桩旁，等巨像的目光停住，随后离开。锤砸进桩里，震波贴着地面涌来。\n他跃过震波，随后躲过贴地光刃，俯身滑过蓝色光幕，再走向下一根。最后一道紫光升起时，他在空中又跃了一次。风、潮汐、丰收的链断尽，巨像终于垂下手臂。弥娅在门边展开领还册。',quote:'弥娅：「可以领回记忆了。先叫她的名字。」'},
};

const storage=()=>{try{return window.localStorage;}catch{return null;}};
const clone=value=>JSON.parse(JSON.stringify(value));
const stripQuote=value=>String(value??'').replace(/^.*?：「/,'').replace(/」$/,'');
const targets=new Map();
const defaults=new Map();

function register(key,kind,target){
  if(!target||targets.has(key))return;
  const read=kind==='record'
    ?()=>({title:target.title,body:target.body,quote:`${target.speaker}：「${stripQuote(target.line)}」`})
    :kind==='encounter'
      ?()=>({title:target.speaker,body:target.text,quote:target.aside})
      :()=>({title:target.title,body:target.body,quote:target.quote??''});
  const write=values=>{
    target.title=String(values.title??'');target.body=String(values.body??'');
    if(kind==='record')target.line=stripQuote(values.quote);
    else if(kind==='encounter'){target.speaker=String(values.title??'');target.text=String(values.body??'');target.aside=String(values.quote??'');}
    else target.quote=String(values.quote??'');
  };
  const entry={key,kind,target,read,write};targets.set(key,entry);defaults.set(key,clone(read()));
}

for(const [level,phases] of Object.entries(CHAPTER_STORIES))for(const [phase,panels] of Object.entries(phases))panels.forEach((panel,index)=>register(`scene:${level}:${phase}:${panel.editSlot??index}`,'scene',panel));
INTERMISSION_PANELS.forEach((panel,index)=>register(`scene:intermission:intermission:${index}`,'scene',panel));
for(const entry of ALL_ENTRIES)register(`record:${entry.id}`,'record',entry);
for(const encounters of [DISTRICT_ENCOUNTERS,LANTERN_ENCOUNTERS,COVENANT_ENCOUNTERS,FATE_ENCOUNTERS,DAWN_ENCOUNTERS])for(const scene of Object.values(encounters))scene.pages.forEach((page,index)=>register(`encounter:${scene.entry}:${index}`,'encounter',page));
for(const [key,summary] of Object.entries(CREATOR_SUMMARIES))register(`summary:${key}`,'summary',summary);
for(const choice of FINAL_CHOICES)register(`choice:${choice.id}`,'scene',choice);
export const CREATOR_TUNING_KEY='requiem.creator.tuning.v1';
export function saveCreatorTuning(){try{storage()?.setItem(CREATOR_TUNING_KEY,JSON.stringify(heartsThresholds()));}catch{}}
try{const tuning=JSON.parse(storage()?.getItem(CREATOR_TUNING_KEY)||'null');if(tuning&&Number.isFinite(tuning.t1)&&Number.isFinite(tuning.t2)&&setThresholds(tuning.t1,tuning.t2))setHeartsEnabled(tuning.enabled!==false);}catch{}

function readOverrides(){try{const parsed=JSON.parse(storage()?.getItem(STORY_EDIT_KEY)||'{}');return parsed&&typeof parsed==='object'?parsed:{ };}catch{return { };}}
const overrides=readOverrides();
const creatorUndoStack=[];
for(const [key,values] of Object.entries(overrides)){
  const entry=targets.get(key);if(entry&&values&&typeof values==='object')entry.write(values);
}

export function creatorPasswordMatches(value){return String(value??'')===CREATOR_PASSWORD;}
export function editorValues(key){return targets.get(key)?.read()||null;}
export function editorDefaultValues(key){return defaults.has(key)?clone(defaults.get(key)):null;}
export function editorTargetExists(key){return targets.has(key);}
export function saveStoryText(key,values){
  const entry=targets.get(key);if(!entry)return false;
  const clean={title:String(values?.title??''),body:String(values?.body??''),quote:String(values?.quote??'')};
  creatorUndoStack.push({key,values:clone(entry.read()),override:overrides[key]?clone(overrides[key]):null});if(creatorUndoStack.length>40)creatorUndoStack.shift();
  entry.write(clean);overrides[key]=clean;
  try{storage()?.setItem(STORY_EDIT_KEY,JSON.stringify(overrides));}catch{}
  return true;
}
export function resetStoryText(key){
  const entry=targets.get(key),original=defaults.get(key);if(!entry||!original)return false;
  creatorUndoStack.push({key,values:clone(entry.read()),override:overrides[key]?clone(overrides[key]):null});if(creatorUndoStack.length>40)creatorUndoStack.shift();
  entry.write(clone(original));delete overrides[key];
  try{storage()?.setItem(STORY_EDIT_KEY,JSON.stringify(overrides));}catch{}
  return true;
}
export function editorPageValues(page){return page?.editKey?editorValues(page.editKey):null;}
export function listEditedStoryText(){return Object.keys(overrides);}
export function allCreatorTargets(){return [...targets.values()].map(e=>({key:e.key,kind:e.kind,edited:Object.hasOwn(overrides,e.key),...e.read()}));}
export function undoCreatorSave(){
  const previous=creatorUndoStack.pop();if(!previous)return false;
  targets.get(previous.key).write(previous.values);
  if(previous.override)overrides[previous.key]=previous.override;else delete overrides[previous.key];
  try{storage()?.setItem(STORY_EDIT_KEY,JSON.stringify(overrides));}catch{}
  return previous.key;
}
export function exportCreatorProject(){return {format:'requiem-creator',version:1,texts:clone(overrides),tuning:heartsThresholds()};}
export function inspectCreatorImport(value){
  if(!value||value.format!=='requiem-creator'||value.version!==1||!value.texts||typeof value.texts!=='object'||Array.isArray(value.texts))throw new Error('这不是本游戏的创作者备份');
  const texts={};let skipped=0;
  for(const [key,values] of Object.entries(value.texts)){
    if(!targets.has(key)){skipped++;continue;}
    if(!values||['title','body','quote'].some(field=>typeof values[field]!=='string'||values[field].length>100000))throw new Error('备份中有不完整的文本字段');
    texts[key]={title:values.title,body:values.body,quote:values.quote};
  }
  const t=value.tuning;
  if(t&&(!Number.isFinite(t.t1)||!Number.isFinite(t.t2)||t.t1<0||t.t2>1||t.t1>=t.t2||typeof t.enabled!=='boolean'))throw new Error('备份中的心源参数不合法');
  return {texts,tuning:t?clone(t):null,count:Object.keys(texts).length,skipped};
}
export function importCreatorProject(value){
  const plan=inspectCreatorImport(value);
  for(const [key,values] of Object.entries(plan.texts))saveStoryText(key,values);
  if(plan.tuning){setThresholds(plan.tuning.t1,plan.tuning.t2);setHeartsEnabled(plan.tuning.enabled);saveCreatorTuning();}
  return plan;
}
export function escapeStoryText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

import { ALL_ENTRIES } from './narrative.js';
import { DISTRICT_ENCOUNTERS } from './narrative-act1.js';
import { COVENANT_ENCOUNTERS } from './narrative-covenant.js';
import { FATE_ENCOUNTERS } from './narrative-fate.js';
import { DAWN_ENCOUNTERS } from './narrative-dawn.js';
import { CHAPTER_STORIES, INTERMISSION_PANELS, chapterStoryArt, encounterPortrait, encounterKind } from './chapter-scenes.js';
import { CREATOR_SUMMARIES,escapeStoryText } from './story-editor.js';
import { FINAL_CHOICES } from './story-finale.js';

// 纯享版只组合已发布正文，不持有 Runner、存储或正式归档对象。
const theaterPicture=(level,phase,index)=>({level,phase,index});
const theaterRecord=id=>ALL_ENTRIES.find(e=>e.id===id);
function theaterScenes(level,phase,records=[]){
  return CHAPTER_STORIES[level][phase].map((panel,index)=>({...panel,kind:'scene',editKey:`scene:${level}:${phase}:${panel.editSlot??index}`,picture:theaterPicture(level,phase,index),recordIds:records[index]||[]}));
}
function theaterMemory(id,picture){
  const e=theaterRecord(id);
  if(!e)throw new Error('缺少剧情记录：'+id);
  return {kind:'record',editKey:`record:${id}`,title:e.title,kicker:'烬的手记',body:e.body,quote:e.speaker+'：「'+e.line.replace(/^“|”$/g,'')+'」',picture,recordIds:[id]};
}
function theaterDialogue(scene,picture){
  return scene.pages.map((p,index)=>({kind:'dialogue',editKey:`encounter:${scene.entry}:${index}`,kicker:scene.place,title:p.speaker,body:p.text,quote:p.aside,portrait:encounterKind(scene,p),picture,recordIds:[scene.entry]}));
}
const theaterStreet=theaterPicture('district','opening',0),theaterBridge=theaterPicture('district','opening',2);
const theaterWind=theaterPicture('covenant','opening',0),theaterDomains=theaterPicture('covenant','opening',1);
const theaterRefuge=theaterPicture('dawn','evidence',0),theaterThrone=theaterPicture('dawn','evidence',5);

export const STORY_REELS=[
  {id:'prologue',name:'序章 · 灰烬之城',buttonId:'story-pick-prologue',pages:[
    ...theaterScenes('prologue','opening',[['p0']]),
    ...['p1','p2','p3','p4'].map(id=>theaterMemory(id,theaterPicture('prologue','opening',1))),
    theaterMemory('p5',theaterPicture('prologue','opening',2)),
    theaterMemory('p7',theaterPicture('prologue','opening',3)),
    theaterMemory('p6',theaterPicture('prologue','ending',0)),
    ...theaterScenes('prologue','ending',[[],['p8']]),
  ]},
  {id:'district',name:'第一幕 · 被遗忘者的国度',buttonId:'story-pick-district',pages:[
    ...theaterScenes('district','opening',[['a0']]),
    theaterMemory('a1',theaterStreet),
    ...theaterDialogue(DISTRICT_ENCOUNTERS['plate-healer'],theaterStreet),
    theaterMemory('a5',theaterStreet),
    ...theaterDialogue(DISTRICT_ENCOUNTERS['plate-bell'],theaterStreet),
    theaterMemory('a9',theaterBridge),
    ...theaterDialogue(DISTRICT_ENCOUNTERS['plate-ferry'],theaterBridge),
    ...theaterDialogue(DISTRICT_ENCOUNTERS['quarter-bridge'],theaterBridge),
    ...theaterDialogue(DISTRICT_ENCOUNTERS['quarter-warden'],theaterBridge),
    {kind:'scene',editKey:'summary:district-boss',kicker:'记名桥 · 交战',...CREATOR_SUMMARIES['district-boss'],picture:theaterBridge,recordIds:[]},
    ...theaterScenes('district','ending',[['a15'],[],['a13']]),
  ]},
  {id:'intermission',name:'幕间 · 北岸的一夜',buttonId:'intermission-entry',pages:INTERMISSION_PANELS.map((panel,index)=>({...panel,kind:'scene',editKey:`scene:intermission:intermission:${index}`,picture:theaterPicture('intermission','intermission',index),recordIds:index===0?['b0','b1']:index===1?['b2','b3']:index===2?['b4']:index===3?['b5']:[]}))},
  {id:'covenant',name:'第二幕 · 众神的谎言',buttonId:'story-pick-covenant',pages:[
    ...theaterScenes('covenant','opening',[['c0']]),
    ...theaterDialogue(COVENANT_ENCOUNTERS['covenant-wind'],theaterWind),
    theaterMemory('c2',theaterWind),
    ...theaterDialogue(COVENANT_ENCOUNTERS['covenant-sea'],theaterDomains),
    theaterMemory('c4',theaterDomains),
    ...theaterDialogue(COVENANT_ENCOUNTERS['covenant-harvest'],theaterDomains),
    ...theaterDialogue(COVENANT_ENCOUNTERS['covenant-gate'],theaterDomains),
    {kind:'scene',editKey:'summary:covenant-boss',kicker:'三域封门 · 交战',...CREATOR_SUMMARIES['covenant-boss'],picture:theaterDomains,recordIds:[]},
    ...theaterScenes('covenant','ending',[['c8'],['c6']]),
  ]},
  {id:'fate',name:'第三幕 · 弑日者',buttonId:'story-pick-fate',pages:[
    ...theaterScenes('fate','opening',[['f0']]),
    ...['fate-archive','fate-war','fate-close','fate-sun','fate-pyre'].flatMap((event,i)=>theaterDialogue(FATE_ENCOUNTERS[event],theaterPicture('fate','evidence',i))),
    theaterMemory('f6',theaterPicture('fate','evidence',2)),
    ...theaterDialogue(FATE_ENCOUNTERS['fate-miya'],theaterPicture('fate','evidence',5)),
    ...theaterDialogue(FATE_ENCOUNTERS['fate-ember'],theaterPicture('fate','evidence',6)),
    theaterMemory('f9',theaterPicture('fate','ending',0)),
    ...theaterScenes('fate','ending',[[],['f10']]),
  ]},
  // 第四幕：与第三幕并列成为"已发布正文"。纯享版只收已实现的一幕，
  // 第五幕与三个结局尚未实现，因此这里绝不能提前收录。
  {id:'dawn',name:'第四幕 · 最后的神谕',buttonId:'story-pick-dawn',pages:[
    ...theaterScenes('dawn','opening',[['w0','w1']]),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-refuge'],theaterRefuge),
    theaterMemory('w3',theaterRefuge),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-roster'],theaterPicture('dawn','evidence',1)),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-guard'],theaterPicture('dawn','evidence',2)),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-supply'],theaterPicture('dawn','evidence',4)),
    theaterMemory('w6',theaterThrone),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-throne'],theaterThrone),
    ...theaterDialogue(DAWN_ENCOUNTERS['dawn-lock'],theaterPicture('dawn','evidence',6)),
    theaterMemory('w7',theaterPicture('dawn','ending',1)),
    ...theaterScenes('dawn','ending',[[],[]]),
  ]},
  {id:'finale',name:'第五幕 · 凡人的黎明',buttonId:'story-pick-finale',pages:[
    ...theaterScenes('finale','opening',[['v0'],['v1']]),
    theaterMemory('v0',theaterPicture('finale','opening',0)),
    theaterMemory('v1',theaterPicture('finale','opening',1)),
    ...FINAL_CHOICES.map(choice=>({kind:'scene',editKey:`choice:${choice.id}`,kicker:'无名之门 · 选择',title:choice.title,body:choice.body,quote:'',picture:theaterPicture('finale','opening',1),recordIds:[]})),
    ...theaterScenes('finale','throne',[['v-throne'],[]]),
    theaterMemory('v-throne',theaterPicture('finale','throne',1)),
    ...theaterScenes('finale','night',[['v-night'],[]]),
    theaterMemory('v-night',theaterPicture('finale','night',1)),
    ...theaterScenes('finale','embers',[[],[],[],[],[],[],['v-embers'],[]]),
    theaterMemory('v-embers',theaterPicture('finale','embers',7)),
  ]},
];

export function storyTheaterArt(page){
  const p=page.picture;
  const base=chapterStoryArt(p.level,p.phase,p.index);
  return page.portrait?base+`<div class="theater-portrait" role="img" aria-label="${escapeStoryText(page.title)}">${encounterPortrait(page.portrait)}</div>`:base;
}

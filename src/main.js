import { Runner } from './physics.js';
import { CombatHints } from './combat-hints.js';
import { Renderer } from './renderer.js';
import { Soundscape } from './audio.js';
import { CHAPTERS, TUTORIALS, WORLD, OBSTACLES, LEVELS } from './level.js';
import { DISTRICT, BOSS_PRACTICE, NORTH_BANK, NORTH_SCALE } from './level-district.js';
import { COVENANT } from './level-covenant.js';
import { FATE } from './level-fate.js';
import { FATE_QUESTS } from './narrative-fate.js';
import { FINALE } from './level-finale.js';
import { FINALE_QUESTS } from './narrative-finale.js';
import { FINAL_CHOICES, FINAL_ENDINGS } from './story-finale.js';
import { endingAsset } from './ending-media.js';
import { DAWN } from './level-dawn.js';
import { DAWN_QUESTS } from './narrative-dawn.js';
import { BOSS_CHANNELS, placeInBossArena } from './boss-channels.js';
import { COVENANT_QUESTS } from './narrative-covenant.js';
import { LANTERN_QUESTS } from './narrative-lantern.js';
import { LORE } from './lore.js';
import { STORY_PANELS, storyArt } from './story.js';
import { Cinematic } from './cinematics.js';
import { Narrative, ALL_ENTRIES, ACT_ONE_QUESTS } from './narrative.js';
import { Encounter } from './narrative-act1.js';
import { CHAPTER_STORIES, INTERMISSION_PANELS, chapterStoryArt, encounterPortrait, encounterKind } from './chapter-scenes.js';
import { STORY_REELS, storyTheaterArt } from './story-theater.js';
import { CREATOR_SUMMARIES, creatorPasswordMatches, editorPageValues, saveStoryText, resetStoryText, editorValues, allCreatorTargets, listEditedStoryText, undoCreatorSave, exportCreatorProject, inspectCreatorImport, importCreatorProject, saveCreatorTuning, escapeStoryText } from './story-editor.js';
import { ProgressStore } from './progress.js';
// ⚠️ 这里不能用 `thresholds as heartsThresholds` 这样的重命名别名：
//   构建脚本用 `/^import .*;\r?\n/gm` 整行剥掉 import 语句，
//   别名（以及未重命名的名字）在产物里都会变成未定义。
//   代价： hearts.js 的 thresholds 名字太通用，改为专名导出。
import { setThresholds, heartsThresholds, tallyHearts, healthCapFor, setHeartsEnabled } from './hearts.js';

const $=id=>document.getElementById(id);
const game=new Runner(),renderer=new Renderer($('game')),audio=new Soundscape();
const cinematic=new Cinematic(),combatHints=new CombatHints();
const encounter=new Encounter();
let journalStorage=null;try{journalStorage=window.localStorage;}catch{}
const narrative=new Narrative(journalStorage);
const progressStore=new ProgressStore(journalStorage);
let resumeMode='running',memoryTimer=0,lastJournalCount=-1;
const cinematicModes=['arrival','defeat','departure'];
let mode='menu',previousTime=0,accumulator=0,chapterTimer=0,subtitleTimer=0,lastTutorial='',dialogPaused=false;
let storyIndex=0,soundTouched=false,soundBusy=false;
let intermissionRead=false,intermissionReturn='menu';
let storyPhase='opening',storyPanels=CHAPTER_STORIES.prologue.opening;
let theaterReel=0;
let creatorMode=false,creatorLaunchPending=false;
const creatorDrafts=new Map();let creatorImportPending=null,creatorPreviewReturn=null;
let entryElapsed=0,entryAction=null;
let echoHeld=false;
function setEchoHeld(held){echoHeld=held;if(mode==='running')game.setEcho(held);}
const step=1/120;
// 当前关卡。它的数据决定进度条、章节表、教学提示与任务文案，
// 换关卡只需要换这个对象，不需要改其余代码。
let currentLevel=LEVELS.prologue;
let currentQuests=null;
let selectedChapter=0;
const isDistrictLevel=level=>level?.id==='district'||level?.id==='boss-practice';
const screens={menu:$('menu'),intro:$('intro-panel'),encounter:$('encounter-panel'),paused:$('pause-panel'),dead:$('death-panel'),won:$('win-panel'),choice:$('final-choice-panel')};
// 余火格子数 = 上限（3 或 4），随关卡的心源变化，所以要能重建而不是一次性取快照。
// 早先写成 `[...$('health').children]` 取固定三项，四心系统下第四颗永远画不出来。
let healthNodes=[];
function syncHealthNodes(){
  const cap=game?game.healthCap():3;
  const box=$('health');
  if(box.children.length!==cap){
    box.innerHTML='<i></i>'.repeat(cap);
    healthNodes=[...box.children];
  }
}

function setMode(next) {
  if(next==='menu'){entryAction=null;$('battle-transition').classList.add('hidden');}
  if(['menu','intro'].includes(next))cinematic.cancel();
  if(next==='menu')audio.resetPresentation();
  mode=next;accumulator=0;globalThis.speechSynthesis?.cancel();if(next==='menu')audio.setFinalScore(null);if(next!=='running'){game.setBrake(false);game.dawnChannel=false;game.finalDuel?.setMove(0);if(next!=='paused')game.finalDuel?.setHeld(false);}
  if(next==='running')game.setEcho(echoHeld);
  $('touch-brake').classList.toggle('hidden',!currentLevel.brake);
  // 第四幕复用同一个"动作键"按钮：E 在这一幕是反灌星火。
  const echoBtn=$('touch-echo');
  echoBtn.classList.toggle('hidden',!(currentLevel.echo||currentLevel.finalBoss));
  if(currentLevel.finalBoss){echoBtn.setAttribute('aria-label','按住接忆，松开发还');echoBtn.lastElementChild.textContent='接忆 / 发还';}
  else if(currentLevel.dawn){echoBtn.setAttribute('aria-label','反灌星火');echoBtn.lastElementChild.textContent='反灌星火';}
  else{echoBtn.setAttribute('aria-label','按住照忆，松开收光');echoBtn.lastElementChild.textContent='按住照忆';}
  // 第四幕专属：逆火冲刺按钮只在带 dawn 数据的关卡出现，
  // 与 touch-brake / touch-echo 同一套开关逻辑，避免在别的幕露出来。
  $('touch-dash').classList.toggle('hidden',!(currentLevel.dawn||currentLevel.finalBoss));
  $('touch-dash').lastElementChild.textContent=currentLevel.finalBoss?'向右':'冲刺';
  $('touch-brake').lastElementChild.textContent=currentLevel.finalBoss?'向左':currentLevel.dawn?'后撤 / 刹步':'刹步';
  $('ember-meter').classList.toggle('hidden',!currentLevel.dawn||!['running','paused','encounter'].includes(next));
  $('echo-status').classList.toggle('hidden',!currentLevel.echo||next!=='running');
  document.body.dataset.mode=next;
  const readingTheater=next==='intro'&&storyPhase==='theater';
  document.body.dataset.creator=String(readingTheater&&creatorMode);
  $('intro-panel').classList.toggle('story-theater',readingTheater);$('story-theater-nav').classList.toggle('hidden',!readingTheater);
  $('creator-mode-label').classList.toggle('hidden',!(readingTheater&&creatorMode));$('creator-exit').classList.toggle('hidden',!(readingTheater&&creatorMode));$('creator-editor').classList.toggle('hidden',!(readingTheater&&creatorMode));
  // 心源调参面板与文本编辑器同时显隐
  const heartsPanel=$('creator-hearts');
  $('creator-workbench').classList.toggle('hidden',!(readingTheater&&creatorMode));$('creator-preview-return').classList.toggle('hidden',!currentLevel.previewOnly);
  if(heartsPanel){heartsPanel.classList.toggle('hidden',!(readingTheater&&creatorMode));if(readingTheater&&creatorMode)syncHeartsPanel();}
  $('story-key-hint').textContent=readingTheater?(creatorMode?'使用按钮与目录翻页 · 创作者通道已禁用游戏快捷键':'SPACE / → 下一页 · ← 上一页 · ESC 返回菜单'):'SPACE / → 下一幅 · ESC 跳过';
  const compact=!['menu','intro'].includes(next);
  if(document.body.classList.contains('playing')!==compact){document.body.classList.toggle('playing',compact);renderer.resize();}
  for(const [name,element] of Object.entries(screens)) element.classList.toggle('hidden',name!==next);
  $('hud').classList.toggle('hidden',next==='menu'||next==='intro');
  $('boss-guide').classList.add('hidden');
  $('scene-label').classList.toggle('hidden',next!=='menu');
  $('ability').classList.toggle('hidden',next!=='running');
  $('touch-controls').classList.toggle('hidden',next!=='running');
  $('warmth-meter').classList.toggle('hidden',!currentLevel.coldZones||game.x<NORTH_BANK||!['running','paused','encounter'].includes(next));
  $('scene-caption').classList.toggle('hidden',!cinematicModes.includes(next));
  $('memory-toast').classList.toggle('hidden',next!=='running'||memoryTimer<=0);
  if(next!=='running') {
    $('tutorial').classList.add('hidden');$('subtitle').classList.add('hidden');$('chapter-banner').classList.add('hidden');
  }
  audio.pause(!['running','menu','intro',...cinematicModes].includes(next),['dead','won'].includes(next));
  audio.setJournal(next==='encounter'||readingTheater);
  if(next==='running') $('game').focus({preventScroll:true});
  if(next==='paused') $('resume').focus({preventScroll:true});
  if(next==='dead') $('retry').focus({preventScroll:true});
  if(next==='won') (nextPlayableChapter()?$('next-chapter'):$('replay')).focus({preventScroll:true});
  if(next==='menu') $('start').focus({preventScroll:true});
  if(next==='intro')$('intro-next').focus({preventScroll:true});
  if(next==='choice')$('choice-throne').focus({preventScroll:true});
  if(next==='encounter')$('encounter-next').focus({preventScroll:true});
  if(cinematicModes.includes(next))$('game').focus({preventScroll:true});
}
/**
 * 载入关卡。所有入口都走这里，保证 Runner、任务表与文案同步切换。
 * 任务表按关卡 id 取，失名街区用第一幕文案，其余回落到序章。
 */
function loadLevel(level) {
  audio.setFinalScore(null);
  currentLevel=level;
  document.body.dataset.level=level.id;
  currentQuests=level.id==='finale'?FINALE_QUESTS:level.id==='dawn'?DAWN_QUESTS:level.id==='fate'?FATE_QUESTS:level.id==='covenant'?COVENANT_QUESTS:isDistrictLevel(level)?ACT_ONE_QUESTS:null;
  // 第四幕：把前三幕的记忆碎片换算成余火上限（3 或 4）。
  // 这就是四心系统的兑现点——**提醒但不阻拦**：没达标只是少一条命，
  // 三颗余火照样能通关，不存在"必须收集才能进"。
  if(['dawn','finale'].includes(level.id)&&!level.bossOnly){
    const {total}=progressStore.tallyHearts(['prologue','district','covenant','fate']);
    level={...level,hearts:total};
    currentLevel=level;
  }
  game.loadLevel(level);
}
function start(level=currentLevel) {
  if(level.previewOnly){startCreatorPreview(level,level.previewCheckpoint||0);return;}
  echoHeld=false;
  combatHints.clearActive();
  if(level.bossOnly){startBossPractice(level);return;}
  audio.resetPresentation();
  loadLevel(level);progressStore.clear(level.id);
  game.reset();renderer.particles=[];renderer.trail=[];renderer.waves=[];renderer.flash=0;renderer.goldFlash=0;renderer.shake=0;lastTutorial='';audio.setChapter(0);audio.setSection(0);
  narrative.resetRun();encounter.reset();memoryTimer=0;beginScene('arrival');updateHUD();
}
// 入场演出只走 UI 时钟。揭幕结束前 Runner 不更新，重复点击也不会启动两次。
function beginBattleEntry(action){
  if(mode==='battle-entry'||entryAction)return;
  entryElapsed=0;entryAction=action;setMode('battle-entry');
  $('battle-transition').classList.remove('hidden');$('live-announcement').textContent='余火点燃，进入旅途。';
  if(renderer.reducedMotion)finishBattleEntry();
}
function finishBattleEntry(){const action=entryAction;entryAction=null;$('battle-transition').classList.add('hidden');if(action)action();}
function beginScene(type,falling=false){
  cinematic.begin(type,{falling,reducedMotion:renderer.reducedMotion});renderer.trail=[];setMode(type);
  // 转场文案按关卡区分：失名街区的开场不是抵达神骸之桥，而是踏进一个还住着人的街区
  const district=isDistrictLevel(currentLevel);
  const captions=currentLevel.id==='finale'?{
    arrival:['THE MORTAL DAWN','无名之门','沿着灯路，走完最后一程。'],
    defeat:['THE LAST EMBER','余火未尽','从门前的火祭碑重新出发。'],
    departure:['THE LAST CHOICE','凡人的黎明','选择已经作出。'],
  }:currentLevel.id==='dawn'?{
    arrival:['THE LAST ORACLE','第四幕 · 最后的神谕','烬：「这一次，不是他一个人在建。」'],
    defeat:['THE EMBER FADES','余火熄灭了。','回到最近的火祭碑，重新走这一段。'],
    departure:['UNSEALED, NOT OPENED','门可以开了。','烬：「门还没有开。这一次，得由所有人一起决定。」'],
  }:currentLevel.id==='fate'?{
    arrival:['THE RECORD OF CHOICES','第三幕 · 弑日者','弥娅：「记录就在里面。我们一起去看。」'],
    defeat:['THE EMBER FADES','余火熄灭了。','回到最近的火祭碑，重新走这一段。'],
    departure:['THE NAMELESS BEARER','无名者举火。','烬：「提好灯，沿亮着的路走。」'],
  }:currentLevel.id==='covenant'?{
    arrival:['THE LIES OF GODS','第二幕 · 众神的谎言','弥娅：「沿风、潮汐、丰收三域，去找原契和神锁。」'],
    defeat:['THE EMBER FADES','余火熄灭了。','回到最近的火祭碑，重新走这一段。'],
    departure:['AN OPEN EXIT','领还通道打开了。','弥娅：「按名册来，别漏了谁。」'],
  }:district?{
    arrival:['THE FORGOTTEN KINGDOM','第一幕 · 被遗忘者的国度','烬：「这里的人还在。」'],
    defeat:['THE EMBER FADES','余火熄灭了。','回到最近的火祭碑，重新走这一段。'],
    departure:['THE BRIDGE REMEMBERS','他们都过了桥。','韩蕙：「药箱给我吧。」'],
  }:{
    arrival:['THE LAST BEARER','烬 · 失去本名的人','弥娅：「把神心送到门前。我带你找名字。」'],
    defeat:['THE EMBER FADES','余火熄灭了。','回到最近的火祭碑，重新走这一段。'],
    departure:['THE FIRST THRESHOLD','门，只开了一线。','余火中的声音：「别让他们……再成为神。」'],
  };
  const [kicker,title,line]=captions[type];$('scene-kicker').textContent=kicker;$('scene-title').textContent=title;$('scene-line').textContent=line;
}
function finishScene(){
  const type=cinematic.type;cinematic.cancel();
  if(type==='arrival'){
    if(!currentLevel.previewOnly)narrative.unlock(currentLevel.id==='finale'?'v0':currentLevel.id==='dawn'?'w0':currentLevel.id==='fate'?'f0':currentLevel.id==='covenant'?'c0':isDistrictLevel(currentLevel)?'a0':'p0',false);refreshJournal();setMode('running');announceChapter(0);
  }
  if(type==='defeat'){setMode('dead');$('live-announcement').textContent='余火耗尽。可从最近的火祭碑重生。';}
  if(type==='departure'){
    if(currentLevel.id==='dawn'){
      // 第四幕完成：三楔已断，安眠锁解开，六锁已尽。
      // 但门只是"可以开"，并没有开——这一点绝不能在结算文案里演成门已开启。
      narrative.event('dawn-lock');$('live-announcement').textContent='第四幕完成。六道神锁已尽，无名之门不再被封锁；门可以开了，却还没有开。';
    }
    else if(currentLevel.id==='fate'){narrative.event('fate-complete');$('live-announcement').textContent='第三幕完成。六道神锁已解五道，三人走出灰潮。';}
    else if(currentLevel.id==='covenant'){narrative.event('covenant-sword');narrative.event('covenant-complete');$('live-announcement').textContent='第二幕完成。六道神锁已解四道，领还通道已开。';}
    else if(isDistrictLevel(currentLevel)){narrative.event('road-lock-open');narrative.event('district-bridge-complete');$('live-announcement').textContent='第一幕完成。三人平安过桥，道路神锁已解。';}
    else {narrative.unlock('p8',false);$('live-announcement').textContent='序章完成。还剩六道神锁，下一程到街区接人。';}
    refreshJournal();updateHUD();configureResult();beginComic('ending');
  }
}
function resumePlay(){setMode(resumeMode);}
function pausePlay(){if(mode==='running'||mode==='encounter'||mode==='battle-entry'||cinematicModes.includes(mode)){resumeMode=mode;setMode('paused');}}
function refreshJournal(){
  if(lastJournalCount===narrative.count)return;lastJournalCount=narrative.count;
  $('journal-count').textContent=narrative.count;
  // 按叙事顺序展示所有条目，未解锁的只显示占位——不提前剧透后续幕次
  $('lore-story').innerHTML=`<h3>旅途手记 <small>${narrative.count} / ${ALL_ENTRIES.length}</small></h3><p>线索随前行与共鸣逐条记录。已读内容不会因战败丢失；未解锁的真相保持隐藏。</p>`+ALL_ENTRIES.map((entry,i)=>narrative.unlocked.has(entry.id)?`<section class="journal-entry"><small>${entry.ring?'共鸣记忆':'主线记录'} · ${String(i+1).padStart(2,'0')}</small><h3>${escapeStoryText(entry.title)}</h3><blockquote>${escapeStoryText(entry.speaker)}：「${escapeStoryText(entry.line.replace(/^“|”$/g,''))}」</blockquote><p>${escapeStoryText(entry.body)}</p>${entry.question?`<p class="journal-question">下一条疑问 · ${escapeStoryText(entry.question)}</p>`:''}</section>`:`<section class="journal-locked"><span>◇ ${String(i+1).padStart(2,'0')}</span> ${entry.ring?'尚未听见的共鸣':'尚未抵达的回声'}</section>`).join('');
}
function openJournal(){selectTab($('tab-story'));refreshJournal();showDialog('lore-dialog','journal');}
function openArchive(){selectTab($('tab-world'));showDialog('lore-dialog','archive');}
function refreshCreatorEditor(panel){
  if(!creatorMode||storyPhase!=='theater'||!panel)return;
  const values=creatorDrafts.get(panel.editKey)||editorPageValues(panel);const editor=$('creator-editor');
  if(!values){editor.classList.add('unavailable');$('creator-editor-key').textContent='此页没有可同步的主线文本';$('creator-title').value=panel.title||'';$('creator-body').value=panel.body||'';$('creator-quote').value=panel.quote||'';return;}
  editor.classList.remove('unavailable');$('creator-editor-key').textContent=panel.editKey;$('creator-title').value=values.title;$('creator-body').value=values.body;$('creator-quote').value=values.quote;$('creator-editor-status').textContent='';
}
function syncStoryPages(editKey,values){for(const reel of STORY_REELS)for(const page of reel.pages)if(page.editKey===editKey){page.title=values.title;page.body=values.body;page.quote=values.quote;}}
function saveCreatorPage(){
  const panel=storyPanels[storyIndex],key=panel?.editKey;if(!key){$('creator-editor-status').textContent='这一页没有可同步的主线文本。';return;}
  const values={title:$('creator-title').value,body:$('creator-body').value,quote:$('creator-quote').value};
  if(!saveStoryText(key,values))return;creatorDrafts.delete(key);
  const current=editorPageValues(panel)||values;syncStoryPages(key,current);lastJournalCount=-1;showStory(storyIndex);$('creator-editor-status').textContent='已保存，并同步到主线。';
}
function resetCreatorPage(){
  const panel=storyPanels[storyIndex],key=panel?.editKey;if(!key)return;
  if(!resetStoryText(key))return;creatorDrafts.delete(key);const current=editorPageValues(panel);if(current)syncStoryPages(key,current);lastJournalCount=-1;showStory(storyIndex);$('creator-editor-status').textContent='已恢复源码文本。';
}
function showStory(index) {
  storyIndex=Math.max(0,Math.min(storyPanels.length-1,index));const panel=storyPanels[storyIndex];
  if(storyPhase==='intermission'&&storyIndex===0){narrative.unlock('br0',false);refreshJournal();}
  $('story-art').innerHTML=storyPhase==='theater'?storyTheaterArt(panel):chapterStoryArt(storyPhase==='intermission'?'intermission':currentLevel.id,currentLevel.id==='finale'&&storyPhase==='ending'?game.finalChoice:storyPhase,storyIndex);$('story-kicker').textContent=panel.kicker;$('intro-title').textContent=panel.title;
  $('story-art').dataset.kind=panel.kind||'scene';
  $('story-art').dataset.level=storyPhase==='theater'?panel.picture.level:currentLevel.id;
  $('story-body').textContent=panel.body;$('story-quote').textContent=panel.quote;$('story-page').textContent=`${String(storyIndex+1).padStart(2,'0')} / ${String(storyPanels.length).padStart(2,'0')}`;
  $('intro-prev').disabled=storyIndex===0;$('intro-next').textContent=storyIndex===storyPanels.length-1?(storyPhase==='ending'?'完成这一程 →':storyPhase==='intermission'?'读完，返回 →':'携火前行 →'):'下一幅 →';
  if(storyPhase==='theater'){
    $('story-jump').value=String(storyIndex);
    $('intro-next').textContent=storyIndex<storyPanels.length-1?'下一页 →':theaterReel<STORY_REELS.length-1?`进入${STORY_REELS[theaterReel+1].name.split(' · ')[0]} →`:'读完，返回菜单 →';
  }
  [...$('story-dots').children].forEach((dot,i)=>dot.classList.toggle('active',i===storyIndex));
  if(storyPhase==='theater'){refreshCreatorEditor(panel);if(creatorMode)refreshCreatorSearch();}
  $('live-announcement').textContent=panel.title+' '+panel.body;
  if((currentLevel.id==='finale'&&storyPhase==='ending')||(storyPhase==='theater'&&panel.picture?.level==='finale')){if(audio.journalOpen)audio.setJournal(false);audio.setFinalScore(0,true);}
  else if(storyPhase==='theater'){audio.setFinalScore(null);if(!audio.journalOpen)audio.setJournal(true);}
  refreshEndingControls(panel);
}
function startPrologue() {
  game.reset();audio.setChapter(0);audio.setSection(0);beginComic('opening');
  if(!soundTouched&&!audio.enabled)toggleSound(false);
}
function beginComic(phase){
  storyPhase=phase;storyPanels=CHAPTER_STORIES[currentLevel.id][currentLevel.id==='finale'&&phase==='ending'?game.finalChoice:phase];
  $('story-heading').textContent=`${currentLevel.id==='finale'?'ACT V / 凡人的黎明':currentLevel.id==='dawn'?'ACT IV / 最后的神谕':currentLevel.id==='fate'?'ACT III / 弑日者':currentLevel.id==='covenant'?'ACT II / 众神的谎言':isDistrictLevel(currentLevel)?'ACT I / 被遗忘者的国度':'PROLOGUE / 光熄灭之后'} · ${phase==='ending'?'幕末':phase==='interlude'?'过桥之后':'开场'}`;
  $('intro-skip').textContent=phase==='ending'?'跳过幕末 →':phase==='interlude'?'继续去北岸 →':'跳过开场 →';
  $('story-dots').innerHTML=storyPanels.map(()=>'<i></i>').join('');
  setMode('intro');showStory(0);
}
function beginIntermission(){
  intermissionReturn=mode==='won'?'won':'menu';storyPhase='intermission';storyPanels=INTERMISSION_PANELS;
  $('story-heading').textContent='幕间 · 北岸的一夜';$('intro-skip').textContent='跳过幕间 →';
  $('story-dots').innerHTML=storyPanels.map(()=>'<i></i>').join('');setMode('intro');showStory(0);
}
function completeComic(){
  if(storyPhase==='theater'){
    if(theaterReel<STORY_REELS.length-1)selectStoryReel(theaterReel+1);else exitStoryTheater();
  }else if(storyPhase==='intermission'){
    intermissionRead=true;for(const id of ['b0','b1','b2','b3','b4','b5'])narrative.unlock(id,false);
    refreshJournal();if(intermissionReturn==='won')configureResult();setMode(intermissionReturn);
  }else if(storyPhase==='ending')setMode('won');else beginBattleEntry(()=>start());
}
function selectStoryReel(index){
  const reel=STORY_REELS[index];if(!reel)return;
  theaterReel=index;storyPhase='theater';storyPanels=reel.pages;
  $('story-heading').textContent='剧情纯享 · '+reel.name;$('intro-skip').textContent='返回菜单 →';
  for(const [i,r] of STORY_REELS.entries()){$(r.buttonId).classList.toggle('selected',i===index);$(r.buttonId).setAttribute('aria-pressed',String(i===index));}
  $('story-jump').replaceChildren(...storyPanels.map((p,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1}. ${p.kind==='dialogue'?p.kicker+' · '+p.title:p.title.replace(/\n/g,'')}`;return option;}));
  $('story-dots').replaceChildren();setMode('intro');showStory(0);
}
function beginStoryTheater(asCreator=false){
  creatorMode=asCreator===true;audio.resetPresentation();selectStoryReel(0);
  if(!soundTouched&&!audio.enabled)toggleSound(false);
}
function exitStoryTheater(){creatorMode=false;storyPhase='opening';setMode('menu');}
function skipComic(){if(storyPhase==='theater')exitStoryTheater();else completeComic();}
function openCreatorGate(){
  $('creator-password').value='';$('creator-gate-status').textContent='';showDialog('creator-gate','creator');setTimeout(()=>$('creator-password').focus(),0);
}
function enterCreatorGate(){
  if(!creatorPasswordMatches($('creator-password').value)){$('creator-gate-status').textContent='密码不正确。';$('creator-password').select();return;}
  creatorLaunchPending=true;closeDialog($('creator-gate'));
}
function nextPlayableChapter(){const index=CHAPTER_PICKS.findIndex(p=>p.level.id===currentLevel.id);return index>=0?CHAPTER_PICKS[index+1]||null:null;}

// --------------------------------------------------------------------------- //
// 创作者通道 · 记忆碎片与四心参数
//
// 这是给创作者的**试玩旋钮**：直接改档位阈值，然后按"当前收集率"试算
// 「这场会给几颗心、余火上限变成几」。
//
// 为什么要有这个：四心系统的档位（45% / 75%）是设计判断，不是物理定律。
// 想知道"玩家捡到一半会怎样"时，不该去改代码重跑一遍。
// --------------------------------------------------------------------------- //
function syncHeartsPanel(){
  const t=heartsThresholds();
  const el={max:$('hearts-max'),t2:$('hearts-t2'),t1:$('hearts-t1')};
  if(!el.max)return;
  el.max.value=t.enabled?1:0;
  el.t2.value=Math.round(t.t2*100);el.t1.value=Math.round(t.t1*100);
  $('hearts-max-out').textContent=t.enabled?'开':'关';
  $('hearts-t2-out').textContent=Math.round(t.t2*100)+'%';
  $('hearts-t1-out').textContent=Math.round(t.t1*100)+'%';
}
function applyHeartsPanel(){
  const enabled=Number($('hearts-max').value)>0;
  const t2=Number($('hearts-t2').value)/100,t1=Number($('hearts-t1').value)/100;
  // 单调性：t1 必须 < t2，否则"收集更多反而更少心"。
  if(t1>=t2){
    $('hearts-preview').textContent='✗ 一心档位必须小于二心档位';
    return;
  }
  setHeartsEnabled(enabled);setThresholds(t1,t2);saveCreatorTuning();
  syncHeartsPanel();
  previewHearts();
}
function previewHearts(){
  // 按已通关各幕的实际收集率试算——这是玩家真实会遇到的情况。
  const ids=['prologue','district','covenant','fate'];
  const all={...progressStore.readAll(),...progressStore.readCompleted()};
  const acts=ids.map(id=>{
    const d=all[id];
    return {id,collected:(d?.shards||[]).length,total:d?.shardTotal??0};
  });
  const known=acts.filter(a=>a.total>0);
  if(!known.length){
    $('hearts-preview').textContent='还没有任何一幕的进度记录 —— 先跑一遍再回来试算。';
    return;
  }
  const {total,breakdown}=tallyHearts(known);
  const lines=breakdown.map(a=>`${a.id} ${a.collected}/${a.total}→${a.hearts}心`);
  $('hearts-preview').textContent=
    `${lines.join('  ')}  →  心源 ${total} · 余火上限 ${healthCapFor(total)} 颗`;
}
function configureResult(){
  const district=isDistrictLevel(currentLevel);
  if(currentLevel.previewOnly){$('win-kicker').textContent='CREATOR PREVIEW';$('win-title').textContent='试玩完成';$('win-description').textContent='此轮不写入主线进度、心源或手记。';$('win-end-line').textContent='';$('win-note').textContent='使用顶部按钮返回编辑';$('replay').textContent='重试这场 ↻';$('next-chapter').classList.add('hidden');return;}
  if(currentLevel.finalBoss&&currentLevel.bossOnly){
    $('win-kicker').textContent='FINAL DUEL PRACTICE';$('win-title').textContent='真门决战完成';$('win-description').textContent='三段王权、九次记忆反击完成。练习不会选择结局或写入主线。';$('win-end-line').textContent='';$('win-note').textContent='执炬王最终对决 · 可直接重战';$('replay').textContent='再战执炬王 ↻';$('replay').className='primary-button';$('next-chapter').classList.add('hidden');return;
  }
  if(currentLevel.id==='finale'){
    const pages=FINAL_ENDINGS[game.finalChoice],last=pages[pages.length-1];
    $('win-kicker').textContent='THE JOURNEY COMPLETE';$('win-title').textContent=pages.find(p=>p.kicker.startsWith('ENDING'))?.title||last.title;
    $('win-description').textContent=last.body;$('win-end-line').textContent=last.quote;
    $('win-note').textContent='全程完成 · 可从门前重新选择另一条路';$('replay').textContent='重走终幕 ↻';$('replay').className='secondary-button';$('next-chapter').textContent='回到门前选择 →';$('next-chapter').classList.remove('hidden');return;
  }
  if(currentLevel.bossOnly){
    // 执炬王没有 level.boss（他走 level.dawn 的楔系统），
    // 读 currentLevel.boss.kind 会直接抛错，所以这里也按驱动分派。
    const kind=currentLevel.dawn?'dawn':currentLevel.boss.kind;
    const chain=kind==='chain', dawn=kind==='dawn';
    $('win-kicker').textContent='BOSS PRACTICE COMPLETE';
    $('win-title').textContent=dawn?'执炬王的仪式中断':chain?'巨像停下了':'追索军官已退';
    $('win-description').innerHTML=dawn
      ?'三根黎明楔已断，安眠锁解开。<br>引锤拆楔练习完成。王仍活着，无名之门尚未开启。'
      :chain?'三根供能链已断，光刃、光幕与末轮高震波已躲过。<br>诱锤、离开红圈与跳震波练习完成。':'三轮读招完成。<br>你已经掌握低刃、高位光幕与落印的节奏。';
    $('win-end-line').textContent=dawn?'「再来一次，这回别让他把锤落在空处。」':chain?'「再来一次，这回把黄圈停稳。」':'「再来一次，桥还在这里。」';
    $('win-note').textContent=dawn?'执炬王练习场 · 可直接重战':chain?'守门巨像练习场 · 可直接重战':'桥心 Boss 练习场 · 可直接重战';
    $('replay').textContent=dawn?'再战执炬王 ↻':chain?'再战守门巨像 ↻':'再战追索军官 ↻';$('replay').className='primary-button';
    $('next-chapter').classList.add('hidden');
    return;
  }
  const covenant=currentLevel.id==='covenant',next=nextPlayableChapter();
  if(currentLevel.id==='dawn'){
    $('win-kicker').textContent='ACT IV COMPLETE';$('win-title').textContent='门可以开了，但它没有开';
    $('win-description').innerHTML='三根黎明楔已断，第六道安眠锁解开——六锁已尽。<br>王没有死。他倒下之前把最后一个问题留了下来。';
    $('win-end-line').textContent='「如果明天没有太阳呢？」';
    $('win-note').textContent='第四幕完 · 下一幕：凡人的黎明';$('replay').textContent='重走第四幕 ↻';$('replay').className='secondary-button';$('next-chapter').classList.remove('hidden');$('next-chapter').textContent='走进第五幕 · 凡人的黎明 →';return;
  }
  if(currentLevel.id==='fate'){
    $('win-kicker').textContent='ACT III COMPLETE';$('win-title').textContent='这一程，独行';
    $('win-description').innerHTML='命运锁已解，六道中只剩安眠。<br>三个人走出灰潮。烬携心继续，弥娅去建立记名避难所。';
    $('win-end-line').textContent='「关门的是我。总得有人把它打开。」';
    $('win-note').textContent='第三幕完 · 下一幕：最后的神谕';
    $('replay').textContent='重走第三幕 ↻';$('replay').className='secondary-button';
    $('next-chapter').classList.remove('hidden');$('next-chapter').textContent='走进第四幕 · 最后的神谕 →';return;
  }
  if(covenant){
    $('win-kicker').textContent='ACT II COMPLETE';$('win-title').textContent='离开的路打开了';
    const summary=CREATOR_SUMMARIES['covenant-boss'];$('win-description').innerHTML='六道神锁已解四道，后人开始领回祖先的记忆。<br>'+escapeStoryText(summary.body).replace(/\n/g,'<br>');
    $('win-end-line').textContent=summary.quote;
    $('win-note').textContent='第二幕完 · 下一幕：弑日者';
    $('replay').textContent='重走第二幕 ↻';$('replay').className='secondary-button';$('next-chapter').classList.remove('hidden');$('next-chapter').textContent='走进第三幕 · 弑日者 →';return;
  }
  $('win-kicker').textContent=district?'ACT I COMPLETE':'PROLOGUE COMPLETE';
  $('win-title').textContent=district?'三个人都过了桥':'门后传来了求救声';
  if(district){const summary=CREATOR_SUMMARIES['district-boss'];$('win-description').innerHTML='韩蕙、常晚、岑渡平安过桥，道路神锁已解。<br>'+summary.body.replace(/\n/g,'<br>');$('win-end-line').textContent=summary.quote;}
  else {$('win-description').innerHTML='太阳锁已毁，其余六道仍完整。<br>烬与弥娅要穿过六域，打开门、取回记忆。';$('win-end-line').textContent='「别让他们……再成为神。」';}
  $('win-note').textContent=district?'第一幕完 · 下一幕：众神的谎言':'序章完 · 下一幕：被遗忘者的国度';
  $('replay').textContent=district?'重走第一幕 ↻':'重玩序章 ↻';
  $('replay').className=next?'secondary-button':'primary-button';
  $('next-chapter').classList.toggle('hidden',!next);
  if(next)$('next-chapter').textContent=district&&!intermissionRead?'幕间 · 北岸的一夜 →':`走进${next.name} →`;
}
function beginEncounter(event){
  if(!encounter.begin(event))return;
  memoryTimer=0;renderer.trail=[];updateHUD();setMode('encounter');showEncounter();
}
function showEncounter(){
  const scene=encounter.active,page=encounter.current;if(!scene||!page)return;
  const kind=encounterKind(scene,page);
  const evidenceIndex={'f-archive-talk':0,'f-war-talk':1,'f-close-talk':2,'f-sun-talk':3,'f-pyre-talk':4,'f-miya-talk':5,'f-ember-talk':6}[scene.id];
  // 第四幕的记忆画面：与第三幕同一套「证据插图」语汇，只是换成本幕的七张。
  const dawnEvidence={'w-refuge-talk':0,'w-roster-talk':1,'w-guard-talk':2,'w-supply-talk':4,'w-throne-talk':5,'w-lock-talk':6}[scene.id];
  const showEvidence=evidenceIndex!==undefined||dawnEvidence!==undefined;
  $('encounter-panel').classList.toggle('memory-scene',showEvidence);
  $('encounter-art').innerHTML=!showEvidence?encounterPortrait(kind):chapterStoryArt(evidenceIndex!==undefined?'fate':'dawn','evidence',evidenceIndex!==undefined?evidenceIndex:dawnEvidence)+`<div class="encounter-mini">${encounterPortrait(kind)}</div>`;
  $('encounter-art').dataset.portrait=kind;$('encounter-place').textContent=scene.place;
  $('encounter-speaker').textContent=page.speaker;$('encounter-role').textContent=({烬:'失名的旅人',弥娅:'抄名人',老妇人:'粮仓门边 · 今年的欠单'}[page.speaker]||scene.role);
  $('encounter-line').textContent=page.text;$('encounter-aside').textContent=page.aside;
  $('encounter-page').textContent=`${encounter.page+1} / ${scene.pages.length}`;
  $('encounter-next').textContent=encounter.page===scene.pages.length-1?'继续前行 →':'听下去 →';
  if(scene.kind==='bridge')game.bridgeMemory=Math.min(3,encounter.page);
  $('live-announcement').textContent=page.speaker+'。'+page.text;
}
function finishEncounter(scene){
  if(!scene)return;
  if(!currentLevel.previewOnly)narrative.unlock(scene.entry,false);
  if(scene.kind==='bridge'){game.bridgeMemory=3;game.flag.add('bridge-restored');renderer.goldFlash=.5;}
  refreshJournal();setMode('running');
}
function nextEncounter(){const scene=encounter.next();if(scene)finishEncounter(scene);else showEncounter();}
/**
 * 关卡选择。只暴露已实现的关卡；徽记上标注时长与目标，
 * 让玩家知道选的是什么，而不是丢进一个陌生的跑图。
 */
const CHAPTER_PICKS=[
  {level:LEVELS.prologue,chipId:'pick-prologue',no:'01',name:'灰烬之城',en:'THE CITY OF ASH',note:'约 90 秒 · 携心换名'},
  {level:DISTRICT,chipId:'pick-district',no:'02',name:'被遗忘者的国度',en:'ACT I / THE FORGOTTEN KINGDOM',note:'约 4 分钟行动 · 过桥、追索者、送灯'},
  {level:COVENANT,chipId:'pick-covenant',no:'03',name:'众神的谎言',en:'ACT II / THE LIES OF GODS',note:'约 3 分钟行动 · 三域挑战与封门战'},
  {level:FATE,chipId:'pick-fate',no:'04',name:'弑日者',en:'ACT III / THE SUN KILLER',note:'约 2 分钟行动 · 照忆穿桥与灰潮救人'},
  {level:DAWN,chipId:'pick-dawn',no:'05',name:'最后的神谕',en:'ACT IV / THE LAST ORACLE',note:'约 2 分钟行动 · 逃出王城与三楔战'},
  {level:FINALE,chipId:'pick-finale',no:'06',name:'凡人的黎明',en:'ACT V / THE MORTAL DAWN',note:'终幕 · 真门抉择与三个结局'},
];
function selectChapter(index) {
  const pick=CHAPTER_PICKS[index];if(!pick)return;
  selectedChapter=index;
  loadLevel(pick.level);
  refreshContinue();
  for(const [i,candidate] of CHAPTER_PICKS.entries()){
    const chip=$(candidate.chipId);
    chip.classList.toggle('selected',i===index);chip.setAttribute('aria-pressed',String(i===index));
  }
  $('menu-level-no').textContent=pick.no;$('menu-level-name').textContent=pick.name;
  $('menu-level-en').textContent=pick.en;$('menu-level-note').textContent=pick.note;
  // 菜单背景要跟着所选关卡走，否则两关的美术会串
  $('scene-label').innerHTML=`<span>遗迹 / ${pick.no}</span><strong>${pick.level.id==='dawn'?'他把自己炼成了太阳。<br>你只能把锤引到楔上。':pick.level.id==='fate'?'众神不语。<br>旧日作证。':pick.level.id==='covenant'?'风从旧祠吹来。<br>沿祭道去找原契。':isDistrictLevel(pick.level)?'这里的人还在。<br>先把三个人带过桥。':'沉睡的并非群山。<br>而是神明。'}</strong><i>${pick.en}</i>`;
}
function startSelected(){
  const pick=CHAPTER_PICKS[selectedChapter]||CHAPTER_PICKS[0];
  loadLevel(pick.level);startPrologue();
}
function startBossPractice(level=BOSS_PRACTICE){
  combatHints.clearActive();
  audio.resetPresentation();loadLevel(level);placeInBossArena(game);encounter.reset();narrative.resetRun();
  renderer.particles=[];renderer.trail=[];renderer.waves=[];renderer.flash=0;renderer.goldFlash=0;renderer.shake=0;renderer.wardUntil=0;
  lastTutorial='';memoryTimer=0;audio.setChapter(0);setMode('running');announceChapter(0);
  updateHUD();$('subtitle').textContent=BOSS_CHANNELS.find(c=>c.level===level)?.guide||'';subtitleTimer=4.2;
}
function enterBossChannel(level){$('boss-hub').close();beginBattleEntry(()=>startBossPractice(level));}
function refreshContinue(){
  const saved=progressStore.load(currentLevel);
  $('continue-run').classList.toggle('hidden',!saved);
  if(saved)$('continue-run').textContent=`从 ${currentLevel.chapters.find(c=>c.at===saved.checkpoint)?.title||'火祭碑'} 继续 →`;
  $('save-note').textContent=progressStore.notice;
}
function syncEncounterProgress(){
  encounter.reset();
  for(const obj of [...(currentLevel.flags||[]),...(currentLevel.items||[])]){
    if(!(game.flag.has(obj.id)||game.items.has(obj.id)))continue;
    if(encounter.begin(obj.event))encounter.finish();
  }
}
function continueRun(){
  const data=progressStore.load(currentLevel);if(!data){refreshContinue();return;}
  cinematic.cancel();audio.resetPresentation();progressStore.restore(game,data);
  syncEncounterProgress();
  renderer.trail=[];renderer.particles=[];renderer.waves=[];narrative.resetRun();memoryTimer=0;
  audio.setChapter(game.chapter);audio.setSection(game.chapter);setMode('running');announceChapter(game.chapter);updateHUD();
}
function nextStory(){if(storyIndex<storyPanels.length-1)showStory(storyIndex+1);else completeComic();}
function announceChapter(index) {
  const chapter=currentLevel.chapters[index];$('banner-subtitle').textContent=chapter.subtitle;
  $('banner-title').textContent=chapter.title;chapterTimer=3.2;
  $('subtitle').textContent=chapter.line;subtitleTimer=5.4;
  $('live-announcement').textContent=`${chapter.title}。${chapter.line}`;
}
//
// ⚠️ 为什么必须有这个 HUD 元素：断楔是「站到楔前按 E 反灌星火」这个
//   **没有任何默认提示的主动动作**——玩家不知道能引，只能靠撞墙去试。
//   而且它有四种状态（可引 / 冷却中 / 够不着 / 锤已在路上），
//   光靠脚下的判定区高亮不够（那要玩家低头看画面）。
//   所以这里把状态直接写成人话：能不能按、为什么不能、现在该做什么。
function syncStrikeHint(){
  const box=$('strike-hint'),label=$('strike-hint-text');
  if(!box)return;
  const D=currentLevel?.dawn&&game.dawn;
  if(!D||!['charge','aim','impact','exposed'].includes(D.phase)){
    box.hidden=true;                     // 王还没登场/ 已结束：与本幕无关
    return;
  }
  const w=game.blockingWedge;
  if(w&&w.x-game.x>850){box.hidden=true;return;}
  if(!w){ box.hidden=true; return; }    // 路上没有楔：不需要提示
  box.hidden=false;
  if(currentLevel.dawn.baitWedges){box.classList.remove('cooling','blocked');label.textContent=D.move==='hammer'&&D.phase==='aim'?(D.moveAge<.65?'金圈追踪 · 靠近楔':'红圈已锁定 · 按住 A 后撤'):'借王的重击拆楔 · 不需要灌注';return;}
  const reach=currentLevel.dawn.strike?.reach??320;
  const gap=Math.abs(game.x-(w.x-40));
  const cooling=game.strikeTime>0||game.strikeCooling>0;
  const charge=game.sparkCharge??0;
  box.classList.toggle('cooling',cooling);
  box.classList.toggle('blocked',!cooling&&(D.phase!=='exposed'||gap>reach||charge<=0));
  if(game.strikeTime>0)label.textContent='注入充能中…';
  else if(game.strikeCooling>0)label.textContent='收手 · 稍等';
  else if(D.phase!=='exposed')label.textContent='先躲过连招 · 王收势时回路才敞开';
  else if(charge<=0)label.textContent='躲过下一轮，接住回落的星火';
  else if(gap>reach)label.textContent='回路已敞开 · 靠近黎明楔';
  else label.textContent=`E 反灌 · 星火 ${charge}/3 · 还需 ${Math.max(0,(currentLevel.dawn.sealCost??2)-(game.dawn?.sealHits?.[w.id]||0))} 次`;
}
function updateHUD() {
  const world=currentLevel.world, chapters=currentLevel.chapters;
  syncHealthNodes();
  healthNodes.forEach((node,i)=>node.classList.toggle('empty',i>=game.health));
  syncStrikeHint();
  $('shards').textContent=String(game.collected.size).padStart(2,'0');
  // 练习场的进度条按各自的**胜利条件**算，而不是一律读 boss.hits：
  // 前两幕是打空 rounds 轮，执炬王是砸断三根楔（走 level.dawn，没有 level.boss）。
  // 早先写成 `currentLevel.bossOnly ? boss.hits/boss.rounds : …`，
  // 在第四幕练习场上会读 undefined.rounds 直接抛错——所以这里按驱动分派。
  const percent=currentLevel.bossOnly&&currentLevel.finalBoss?game.finalDuel.hits/game.finalDuel.maxHits*100:currentLevel.bossOnly
    ? (currentLevel.dawn
        ? Math.floor(game.dawn.broken.size/Math.max(1,currentLevel.dawn.wedges.length)*100)
        : Math.floor((game.boss?.hits||0)/currentLevel.boss.rounds*100))
    : Math.min(game.inBossFight?99:100,Math.floor(game.x/world.end*100));
  $('progress').parentElement.setAttribute('aria-label',`本幕进度 ${percent}%`);
  // 进度条同样取整：未取整时 style.width 会带上长小数，视觉上抖动且难以断言
  $('progress').style.width=`${percent}%`;
  $('chapter-title').textContent=chapters[game.chapter].title;
  const locks=$('lock-progress');locks.classList.toggle('hidden',currentLevel.bossOnly||currentLevel.lockOffset===undefined);
  // 第四幕的楔**不是**三道新锁（总蓝图 §3：楔只是王座仪式的供能构件）。
  // 所以计数不能写成 5+碎楔数——那样会数到 8/6。这一章只有一道锁：
  // 三根楔全断 → 第六道安眠锁解开。断一半时仍旧显示 5/6。
  const resolved=currentLevel.id==='finale'?6:currentLevel.id==='dawn'
    ?5+((game.dawn?.broken?.size??0)>=Math.max(1,currentLevel.dawn?.wedges?.length??3)?1:0)
    :currentLevel.id==='fate'?4+Number(game.flag.has('f-lock')):currentLevel.id==='covenant'?1+(game.boss?.hits||0):narrative.unlocked.has('a15')&&game.state==='won'?1:0;
  locks.textContent=`神锁 ${resolved} / 6`;
  $('jump-one').classList.toggle('used',game.jumpsLeft<2);$('jump-two').classList.toggle('used',game.jumpsLeft<1);
  // 逆火余烬 + 仪式星火计量：只在第四幕显示。
  const emberMeter=$('ember-meter');
  if(currentLevel.dawn){
    $('ember-count').textContent=`冲 ${game.ember} / ${currentLevel.dawn.dash?.max??3}`;
    emberMeter.classList.toggle('ready',(game.ember>0)||(game.sparkCharge??0)>0);
  }
  $('ability-label').textContent=game.slideTime>0?'滑铲中':game.jumpsLeft===2?'双跃就绪':game.jumpsLeft===1?'可再跃一次':'等待落地';
  $('quest-label').textContent=currentLevel.finalBoss&&game.finalChoice==='embers'&&!['idle','defeated'].includes(game.finalDuel.phase)
    ?`接回记忆，松开 E 发还 · ${game.finalDuel.hits} / ${game.finalDuel.maxHits}`
    :currentLevel.bossOnly
    ?(currentLevel.finalBoss?'执炬王 · 接忆后松开 E 发还，九段生命 · 三阶段':currentLevel.dawn?'执炬王 · 引王落锤，拆掉三根黎明楔'
      :currentLevel.boss.kind==='chain'?'诱锤断三链 · 躲开法术与震波':'追索军官 · 三轮法术与回火反击')
    :isDistrictLevel(currentLevel)&&game.x<NORTH_BANK
    ?(game.boss&&game.boss.phase==='defeated'?'护送三人过桥 · 将神心送到道路锁前'
      :game.inBossFight?'挡下追索军官 · 借同伴之力反击'
      :game.flag.has('bridge-restored')?'赶到桥心，应付追索者'
      :narrative.quest(game.x,currentQuests).label)
    :narrative.quest(game.x,currentQuests).label;
  const bossGuide=$('boss-guide'),attackHint=combatHints.current(game.elapsed);
  bossGuide.classList.toggle('chain-guide',currentLevel.boss?.kind==='chain');
  const finalActive=game.finalDuel&&!['idle','defeated'].includes(game.finalDuel.phase);
  const kingActive=currentLevel.dawn&&game.dawn&&!['idle','defeated'].includes(game.dawn.phase);
  bossGuide.classList.toggle('hidden',!(game.inBossFight||kingActive||finalActive)||!attackHint);
  bossGuide.textContent=attackHint?.text||'';
  $('health').setAttribute('aria-label',`余火${game.health}格，火焰${(game.health>=3?'充盈':['已熄灭','微弱','减弱'][game.health])}`);
  // 铜片是主线收集物，单独计数——玩家需要随时知道还差几枚
  $('warmth-meter').classList.toggle('hidden',!currentLevel.coldZones||game.x<NORTH_BANK||!['running','paused','encounter'].includes(mode));
  if(currentLevel.coldZones){$('warmth-time').textContent=game.warmth>0?`${game.warmth.toFixed(1)} 秒`:'去炭盆续火';$('warmth-bar').style.width=`${game.warmth/currentLevel.warmthDuration*100}%`;$('lamp-count').textContent=`${game.litLamps.size} / ${currentLevel.lamps.length}`;}
  if(currentLevel.echo){
    const r=currentLevel.rescues.find(r=>r.id===game.rescueId),front=game.greyFront;
    $('echo-status').classList.toggle('lit',game.echoLight);
    const nearWall=currentLevel.echoWalls.some(w=>w.x>game.x-20&&w.x-game.x<230);
    $('echo-status').textContent=r?`按住 E 注火 · ${Math.floor(game.rescueProgress/r.seconds*100)}% · 已救 ${game.savedPeople}/3`:game.echoLight?(nearWall?'◇ 蓝色封墙靠近 · 跃离石台后松开 E':'◇ 照忆中 · 金色旧桥已显形'):'◇ 按住 E 照忆 · 金色旧桥才会承重';
    if(front!==null&&!r)$('echo-status').textContent+=game.x-front<450?' · 灰潮紧逼，继续前进':' · 灰潮在身后';
  }
  const plates=(currentLevel.items||[]).filter(i=>i.kind!=='coal');
  if(isDistrictLevel(currentLevel)&&plates.length&&game.x<NORTH_BANK){
    $('plate-count').textContent=`${plates.filter(i=>game.items.has(i.id)).length} / ${plates.length}`;
    $('plate-count').closest('.plate-tracker')?.classList.remove('hidden');
  } else $('plate-count').closest('.plate-tracker')?.classList.add('hidden');
}
function formatTime(seconds) { return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }
function processEvents() {
  for(const event of game.drainEvents()) {
    renderer.event(event,game);audio.play(event);
    if(event.type==='final-duel-enter')audio.setFinalScore(0);
    if(event.type==='final-phase'){audio.setFinalScore(event.stage);$('subtitle').textContent=event.stage===1?'执炬王：「我松手，谁来守住他们的冬天？」':'执炬王：「那就让我看见——离开这顶王冠，火还能不能亮！」';subtitleTimer=3.5;renderer.goldFlash=.5;}
    if(event.type==='checkpoint') {
      progressStore.save(game);
      audio.setChapter(event.chapter);
      // 配乐换段：同一首《葬火》按章节换演奏法（起→行→迫→决）。
      // 与 setChapter 同步调用，所以"火祭碑已点燃"的提示音和音乐转换是同一拍。
      audio.setSection(event.chapter,currentLevel.chapters?.[event.chapter]?.subtitle?.split(' / ').pop()||'');
      announceChapter(event.chapter);$('banner-subtitle').textContent+=' · 火祭碑已点燃';
    }
    if(event.type==='respawn') { syncEncounterProgress();audio.setChapter(game.chapter);audio.setSection(game.chapter);announceChapter(game.chapter);$('subtitle').textContent='从火祭碑重新前行。余火还没有熄灭。';lastTutorial=''; }
    if(event.type==='resonance'){if(!currentLevel.previewOnly)narrative.ring(event.id);refreshJournal();$('subtitle').textContent='余火共鸣 · 恢复一格余火';subtitleTimer=2.6;}
    // 关卡旗标与主线物品都走事件表解锁：文案跟着关卡走，不写死坐标
    if(event.type==='flag'||event.type==='item'){
      if(!currentLevel.previewOnly&&narrative.event(event.event))refreshJournal();
      if(event.type==='item'){renderer.goldFlash=Math.max(renderer.goldFlash,.5);$('subtitle').textContent=currentLevel.items.find(i=>i.id===event.id)?.kind==='coal'?'炭盆续火 · 暖光维持 12 秒':currentLevel.echo?'记忆余火 · 一次取回本名的机会':`拾得真名铜片 · ${event.place}`;subtitleTimer=2.8;}
      beginEncounter(event.event);
    }
    if(event.type==='rescue'){$('subtitle').textContent=`避难灯续燃 · 已救 ${game.savedPeople} / 3 · 继续向前`;subtitleTimer=2.4;renderer.goldFlash=.4;}
    if(event.type==='lamp-lit'){$('subtitle').textContent=`路灯点亮 · ${game.litLamps.size} / ${currentLevel.lamps.length} · 同伴会留下添炭`;subtitleTimer=2.8;renderer.goldFlash=.35;}
    if(event.type==='launch'){$('subtitle').textContent='风记得，你曾经拥有翅膀。';subtitleTimer=2.2;}
    // 逆火余烬：拾取是"资源到手"，冲刺是"资源花掉"。两句文案必须分开，
    // 否则玩家分不清"我攒到了"和"我用掉了"——那是冲刺机制唯一的反馈。
    if(event.type==='ember'){$('subtitle').textContent=`拾得逆火余烬 · ${event.held} 枚 · 按 Shift 借火前冲`;subtitleTimer=2.4;renderer.goldFlash=Math.max(renderer.goldFlash,.25);}
    if(event.type==='backfire'){$('subtitle').textContent=`逆火冲刺 · 借他的火往前一段（余 ${event.left} 枚）`;subtitleTimer=1.4;}
    if(event.type==='hit'&&!event.falling) { $('subtitle').textContent='余火受损。看清赤色刻痕，继续向前。';subtitleTimer=2; }
    // 操作教学按招式去重，实际法术预警和 NPC 反馈继续保留。
    if(event.type==='boss-enter')combatHints.show(currentLevel.boss.kind==='chain'?'chain-hammer':currentLevel.boss.patterns[0][0],game.elapsed);
    // 第四幕的执炬王：它没有 boss 数据、只有 level.dawn 的循环。教学必须自己接，
    // 否则玩家的第一次挨锤发生在完全没有提示的屏幕上——那正是"莫名死了"的来源。
    // 第四幕：进场时说明余火上限的来源。
    //
    // ⚠️ 这里是「提醒但不阻拦」的地方：没拿到第四心只是被告知，
    //   三颗余火照样能打通全部内容——心源是收集的奖励，不是通关条件。
    //   如果做成「不足就锁」，就等于把探索变成强制劳动，
    //   那正是这套系统想避免的（它存在的意义是让碎片有回报，不是变成门票）。
    if(event.type==='dawn-enter'){
      const cap=game.healthCap();
      const has=cap>3;
      $('subtitle').textContent=has
        ?`记忆碎片化作第四心 · 余火 ${cap} 颗`
        :`余火 ${cap} 颗 · 截断三根黎明楔，阻止仪式`;
      subtitleTimer=6.0;
      
    }
    // 第四幕：每一招都有自己的读法，所以按 move 分派提示。
    if(event.type==='dawn-exposed'){$('subtitle').textContent='王正在收势，星火回落 · 靠近黎明楔，按 E 两次反灌';subtitleTimer=3.2;renderer.goldFlash=.2;}
    if(event.type==='dawn-move'){
      const map={hammer:'dawn-hammer',cinder:'dawn-cinder',quake:'dawn-quake',meteor:'dawn-meteor',stomp:'dawn-stomp',sweep:'dawn-sweep',pulse:'dawn-pulse'};
      const hint=map[event.move];
      if(hint)combatHints.show(hint,game.elapsed);
      $('subtitle').textContent=`${event.name} · ${event.read}`;subtitleTimer=2.2;
    }
    if(event.type==='seal-inject'){
      $('subtitle').textContent=`门闩充能 ${event.hits}/${event.need} · 星火剩 ${event.charge}`;subtitleTimer=2.0;
      renderer.goldFlash=Math.max(renderer.goldFlash,.35);
    }
    if(event.type==='spark'){
      $('subtitle').textContent=`仪式星火 · 火 ${event.held} / 3 · 门前按 E 注入`;subtitleTimer=1.8;
      renderer.goldFlash=Math.max(renderer.goldFlash,.25);
    }
    if(event.type==='strike-start'){
      $('subtitle').textContent='注入充能…';subtitleTimer=1.0;
    }
    if(event.type==='strike-miss'&&event.reason==='guarded'){$('subtitle').textContent='回路仍封闭 · 先躲过这一组攻击';subtitleTimer=1.5;}
    if(event.type==='strike-miss'&&event.reason!=='guarded'){
      $('subtitle').textContent=event.charge!==undefined&&event.charge<=0&&event.gap==null
        ?'没有星火可注入 · 路上捡金色火苗'
        :event.gap!=null?`离门闩还差 ${event.gap}px · 走近再按 E`:'这里没有门闩';
      subtitleTimer=2.0;
    }
    if(event.type==='dawn-wedge-broken'){$('subtitle').textContent=`第 ${event.round+1} 道门闩碎裂 · 仪式又弱了一分`;subtitleTimer=3.0;}
    if(event.type==='dawn-defeated'){$('subtitle').textContent='三根楔全断。仪式停了——安眠锁解开。跑到前面去。';subtitleTimer=3.6;}
    if(event.type==='boss-cast'||event.type==='boss-warning')combatHints.show(event.kind,game.elapsed);
    if(event.type==='boss-broken'){$('subtitle').textContent=currentLevel.boss.kind==='seal'?'原契约拆开护盾——青色退出印即将送到前方，跳起来接。':'常晚敲钟，护盾裂了。';subtitleTimer=3.4;}
    if(event.type==='boss-window'){combatHints.show('counter',game.elapsed);$('subtitle').textContent=currentLevel.boss.kind==='seal'?`${event.from}已核对 · 跳接退出印，自动拆开一枚祈祷锁`:`${event.from}送来回火印。`;subtitleTimer=3.6;}
    if(event.type==='boss-relic-missed'){$('subtitle').textContent='器物从脚边滑过去了。别慌，前面还会再送一件。';subtitleTimer=2.8;}
    if(event.type==='boss-ward'){$('subtitle').textContent='韩蕙的护身灯挡下了这一击 · 本场已用尽';subtitleTimer=2.4;}
    if(event.type==='boss-struck'){$('subtitle').textContent=currentLevel.boss.kind==='chain'?`${['风','潮汐','丰收'][event.round]}神锁已解 · 六道中已解 ${event.round+2} 道`:currentLevel.boss.kind==='seal'?`第 ${event.round+1} 枚祈祷锁已拆`:`强化余火反击命中 · 第 ${event.round+1} 轮`;subtitleTimer=2.4;renderer.goldFlash=Math.max(renderer.goldFlash,.6);}
    if(event.type==='boss-defeated'){
      $('subtitle').textContent=currentLevel.boss.kind==='chain'?'三条供能链已断。巨像停了，归还记忆的门正在打开。':currentLevel.boss.kind==='seal'?'三枚锁已拆。退出门打开了。':'军官收剑退开，坠回桥面。桥，通了。';subtitleTimer=3.6;
      
    }
    if(event.type==='dead') {
      $('death-distance').textContent=`${Math.floor(game.x/currentLevel.world.end*100)}%`;$('death-shards').textContent=game.collected.size;
      beginScene('defeat',event.falling);
    }
    if(event.type==='final-choice'){showFinalChoice();}
    if(event.type==='final-cast'){combatHints.show('final-'+event.attack,game.elapsed);}
    if(event.type==='final-recall'){combatHints.show('final-recall',game.elapsed);$('subtitle').textContent=event.height>160?'金色记忆在高处 · 二段跳并按住 E 接住':event.height>90?'金色记忆在半空 · 起跳并按住 E 接住':'金色记忆归来 · 按住 E 接住，随后松开';subtitleTimer=2;}
    if(event.type==='final-memory-caught'){$('subtitle').textContent='记忆已接住 · 松开 E 发还，不要久握';subtitleTimer=1.6;}
    if(event.type==='final-memory-missed'){$('subtitle').textContent='这次未接住 · 下一轮仍会归来';subtitleTimer=2;}
    if(event.type==='final-memory-overload'){$('subtitle').textContent='握得太久，余火过载 · 接住后松开';subtitleTimer=2;}
    if(event.type==='won') {
      if(!currentLevel.bossOnly&&!currentLevel.previewOnly)progressStore.complete(game);
      $('win-shards').textContent=game.collected.size;$('win-time').textContent=formatTime(game.elapsed);$('win-deaths').textContent=game.respawns;
      const rings=currentLevel.rings?.length??3;
      const extra=currentLevel.coldZones?` · 路灯 ${game.litLamps.size} / ${currentLevel.lamps.length}`:currentLevel.echo?` · 救出 ${game.savedPeople} / 3`:currentLevel.items?.length?` · 铜片 ${game.items.size} / ${currentLevel.items.length}`:'';
      $('win-resonance').textContent=`共鸣 ${game.rings.size} / ${rings} · 最长连忆 ${game.bestCombo}${extra}`;
      if(currentLevel.previewOnly&&currentLevel.id==='finale'){configureResult();beginComic('ending');}
      else if(currentLevel.bossOnly||currentLevel.previewOnly){configureResult();setMode('won');}
      else if(currentLevel.id==='finale'){narrative.event('ending-'+game.finalChoice);refreshJournal();configureResult();beginComic('ending');}
      else beginScene('departure');
    }
  }
}
function frame(timestamp) {
  const dt=previousTime?Math.min((timestamp-previousTime)/1000,.08):0;previousTime=timestamp;
  if(mode==='battle-entry'){entryElapsed+=dt;if(entryElapsed>=.65)finishBattleEntry();}
  if(cinematicModes.includes(mode)){
    const finished=cinematic.update(dt);
    if(cinematic.type==='arrival'&&cinematic.takeCue('landing',.42)){renderer.event({type:'land'},game);audio.play({type:'land'});}
    if(cinematic.type==='departure'&&cinematic.takeCue('gate',.2))renderer.event({type:'checkpoint'},game);
    if(finished)finishScene();
  }
  if(mode==='running') {
    accumulator+=dt;
    while(accumulator>=step&&mode==='running') {game.update(step);processEvents();renderer.sample(game);accumulator-=step;}
    accumulator=Math.max(0,accumulator);
    updateHUD();chapterTimer=Math.max(0,chapterTimer-dt);subtitleTimer=Math.max(0,subtitleTimer-dt);
    $('chapter-banner').classList.toggle('hidden',chapterTimer<=0||mode!=='running');
    $('subtitle').classList.toggle('hidden',subtitleTimer<=0||mode!=='running');
    const tutorial=currentLevel.finalBoss&&game.finalDuel&&!['idle','defeated'].includes(game.finalDuel.phase)?null:(currentLevel.tutorials||TUTORIALS).find(item=>game.x>=item.from&&game.x<=item.to);
    if(tutorial&&mode==='running') {
      if(lastTutorial!==tutorial.text) { $('tutorial').textContent=tutorial.text;lastTutorial=tutorial.text; }
      $('tutorial').classList.remove('hidden');
    } else $('tutorial').classList.add('hidden');
    if(mode==='running'){
      if(!currentLevel.previewOnly)narrative.advance(game.x,currentLevel.id);refreshJournal();memoryTimer=Math.max(0,memoryTimer-dt);
      const enemyThreat=game.projectiles.length>0||[...game.enemyStates.values()].some(s=>s.active&&!s.done);
      const nearHazard=game.inBossFight||!!(game.finalDuel&&!['idle','defeated'].includes(game.finalDuel.phase))||enemyThreat||(currentLevel.tidalChannels||[]).some(z=>game.x>z.x-400&&game.x<z.x+z.width+80)||currentLevel.obstacles.some(o=>o.x+o.width>game.x-30&&o.x<game.x+currentLevel.chapters[game.chapter].speed*1.2);
      if(memoryTimer===0&&!tutorial&&chapterTimer===0&&!nearHazard){const entry=narrative.next();if(entry){$('memory-speaker').textContent=entry.speaker;$('memory-line').textContent=entry.line;memoryTimer=4.6;$('live-announcement').textContent=entry.speaker+'。'+entry.line;}}
      $('memory-toast').classList.toggle('hidden',memoryTimer<=0||nearHazard||!!tutorial);
    }
  }
  renderer.render(['menu','intro','running','encounter',...cinematicModes].includes(mode)?dt:0,game,mode,mode==='running'?accumulator/step:1,cinematic.sample());
  requestAnimationFrame(frame);
}
function togglePause() { if(mode==='running'||mode==='encounter'||mode==='battle-entry'||cinematicModes.includes(mode))pausePlay();else if(mode==='paused'&&!document.querySelector('dialog[open]'))resumePlay(); }
async function toggleSound(manual=true) {
  globalThis.speechSynthesis?.cancel();
  if(soundBusy)return;soundBusy=true;if(manual)soundTouched=true;
  try {
    const enabled=await audio.toggle();$('sound-state').textContent=enabled?'ON':'OFF';
    $('sound-toggle').setAttribute('aria-pressed',String(enabled));$('sound-toggle').setAttribute('aria-label',enabled?'关闭声音':'开启声音');
  } catch { $('sound-state').textContent='N/A';$('sound-toggle').setAttribute('aria-label','当前浏览器不支持声音'); }
  finally{soundBusy=false;}
}
function showDialog(id,kind='archive') {
  if(document.querySelector('dialog[open]'))return;
  dialogPaused=mode==='running'||mode==='encounter'||mode==='battle-entry'||cinematicModes.includes(mode);if(dialogPaused)pausePlay();$(id).dataset.transition=kind;$(id).classList.remove('closing');$(id).showModal();if(id==='lore-dialog')audio.setJournal(true);
  if(id==='lore-dialog'){$(id).querySelector('.archive-heading h2').textContent=kind==='journal'?'旅途手记':'世界档案';$(id).querySelector('.archive-heading>p:last-child').textContent=kind==='journal'?'已经走过的路 · 已经听见的名字':'神之殇 · 世界与玩法';}
}
function closeDialog(dialog) {
  if(dialog.classList.contains('closing'))return;
  if(renderer.reducedMotion){dialog.close();finishDialogClose(dialog);return;}
  dialog.classList.add('closing');
  const journal=dialog.dataset.transition==='journal';
  dialog.animate([{opacity:1,transform:'none'},{opacity:0,transform:journal?'perspective(1000px) rotateY(-12deg) translateX(-22px)':'translateY(16px) scale(.96)'}],{duration:210,easing:'ease-in',fill:'forwards'});
  // 即使浏览器停止合成帧（后台或离线校验），弹窗也会完成关闭。
  setTimeout(()=>{dialog.getAnimations().forEach(a=>a.cancel());dialog.close();dialog.classList.remove('closing');finishDialogClose(dialog);},210);
}
function finishDialogClose(dialog){if(document.querySelector('dialog[open]'))return;if(dialog.id==='lore-dialog')audio.setJournal(false);if(dialogPaused&&mode==='paused')resumePlay();dialogPaused=false;if(dialog.id==='creator-gate'&&creatorLaunchPending){creatorLaunchPending=false;beginStoryTheater(true);}}
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
  dialog.querySelector('.dialog-close').addEventListener('click',()=>closeDialog(dialog));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(dialog);}});
  dialog.addEventListener('close',()=>finishDialogClose(dialog));
}
for(const [id,handler] of Object.entries({start:startSelected,'boss-hub-open':()=>showDialog('boss-hub','boss'),'intro-next':nextStory,'intro-prev':()=>showStory(storyIndex-1),'intro-skip':skipComic,'scene-skip':()=>{cinematic.skip();finishScene();},'journal-open':openJournal,replay:()=>beginBattleEntry(()=>start()),'restart-pause':()=>start(),'restart-death':()=>start(),resume:resumePlay,retry:()=>{audio.resetPresentation();cinematic.cancel();game.restoreCheckpoint(true);syncEncounterProgress();setMode('running');processEvents();updateHUD();},'pause-button':togglePause,'sound-toggle':()=>toggleSound(),'lore-open':openArchive,'ending-lore':openArchive,'help-open':()=>showDialog('help-dialog'),'help-done':()=>closeDialog($('help-dialog')),'pick-prologue':()=>selectChapter(0),'pick-district':()=>selectChapter(1),'pick-covenant':()=>selectChapter(2),'pick-fate':()=>selectChapter(3),'pick-dawn':()=>selectChapter(4),'pick-finale':()=>selectChapter(5),'encounter-next':nextEncounter,'encounter-skip':()=>finishEncounter(encounter.finish()),'story-entry':beginStoryTheater,'creator-entry':openCreatorGate,'creator-enter':enterCreatorGate,'creator-cancel':()=>closeDialog($('creator-gate')),'creator-exit':()=>{creatorMode=false;setMode('intro');showStory(storyIndex);},'creator-save':saveCreatorPage,'creator-reset':resetCreatorPage,'next-chapter':()=>{if(currentLevel.id==='finale'){returnToFinalChoice();return;}if(currentLevel.id==='district'&&!intermissionRead){beginIntermission();return;}const pick=nextPlayableChapter();if(pick){selectChapter(CHAPTER_PICKS.indexOf(pick));startPrologue();}}})) $(id).addEventListener('click',handler);
for(const channel of BOSS_CHANNELS)$(channel.buttonId).addEventListener('click',()=>enterBossChannel(channel.level));
for(const [i,reel] of STORY_REELS.entries())$(reel.buttonId).addEventListener('click',()=>selectStoryReel(i));
$('story-jump').addEventListener('change',event=>{if(storyPhase==='theater')showStory(Number(event.target.value));});

document.querySelectorAll('.return-menu').forEach(button=>button.addEventListener('click',()=>{encounter.active=null;refreshContinue();setMode('menu');}));
$('home-link').addEventListener('click',event=>{event.preventDefault();encounter.active=null;refreshContinue();setMode('menu');});
$('continue-run').addEventListener('click',continueRun);
for(const [tab,content] of Object.entries(LORE)) $(`lore-${tab}`).innerHTML=content;
const tabs=[...document.querySelectorAll('[data-tab]')];
function selectTab(button) {
  tabs.forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$(`lore-${tab.dataset.tab}`).classList.toggle('hidden',!selected);});
}
tabs.forEach((button,index)=>{
  button.addEventListener('click',()=>selectTab(button));
  button.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];selectTab(next);next.focus();}});
});
selectTab(tabs[0]);
selectChapter(0);
refreshJournal();
window.addEventListener('keydown',event=>{
  // 创作者通道只使用显式按钮；打字、光标移动与输入法不能触发游戏。
  if(creatorMode&&mode==='intro'&&storyPhase==='theater')return;
  if(event.target instanceof Element&&event.target.closest('input,textarea,[contenteditable="true"]'))return;
  if(document.querySelector('dialog[open]')){if(event.code==='KeyM'&&!event.repeat){event.preventDefault();toggleSound();}return;}
  if(mode==='battle-entry'&&event.code==='Enter'){event.preventDefault();if(!event.repeat)finishBattleEntry();return;}
  if(cinematicModes.includes(mode)&&event.code==='Enter'){event.preventDefault();if(!event.repeat){cinematic.skip();finishScene();}return;}
  if(mode==='encounter'&&['Space','Enter'].includes(event.code)){event.preventDefault();if(!event.repeat)nextEncounter();return;}
  if(mode==='intro'&&storyPhase==='theater'&&['SELECT','OPTION'].includes(event.target.tagName))return;
  if(mode==='intro'&&storyPhase==='theater'&&event.code==='Space'&&event.target instanceof Node&&$('story-theater-nav').contains(event.target))return;
  if(mode==='intro'&&['Space','ArrowRight','ArrowLeft','Escape'].includes(event.code)) {
    event.preventDefault();if(event.repeat)return;
    if(event.code==='Escape')skipComic();else if(event.code==='ArrowLeft')showStory(storyIndex-1);else nextStory();return;
  }
  if(mode==='running'&&currentLevel.finalBoss&&!['idle','defeated'].includes(game.finalDuel.phase)&&['KeyA','ArrowLeft','KeyD','ArrowRight'].includes(event.code)){event.preventDefault();game.finalDuel.setMove(['KeyA','ArrowLeft'].includes(event.code)?-1:1);return;}
  if(event.code==='KeyE'&&mode==='running'&&currentLevel.echo){event.preventDefault();setEchoHeld(true);}
  if(['KeyA','ArrowLeft'].includes(event.code)&&mode==='running'&&currentLevel.brake){event.preventDefault();game.setBrake(true);}
  // 第四幕专属：逆火冲刺。用 Shift（或 KeyD / ArrowRight）触发——
  // 这三个键在前三幕都没有绑定，所以不会和跳/滑/刹车打架；
  // 而"往前的方向键 + Shift"读起来也最接近"往前冲"这件事。
  if(['ShiftLeft','ShiftRight','KeyD','ArrowRight'].includes(event.code)&&mode==='running'&&currentLevel.dawn){
    event.preventDefault();if(event.repeat)return;game.backfire();processEvents();
  }
  // 第四幕专属：**反灌星火**（E 键）。
  //
  // ⚠️ 为什么占用 E：前三幕 E 绑的是「回忆」（`currentLevel.echo`），
  //   第四幕没有 echo 系统，所以这个键在第四幕是空的——不需要新增按键，
  //   也不会和跳/滑/刹车/冲刺任何一个冲突。
  //
  // 旧版必须精确卡在容差带里等锤、又必须同时离开落点圈，两条互斥、无解。
  if(event.code==='KeyE'&&mode==='running'&&(currentLevel.dawn||currentLevel.finalBoss)){
    event.preventDefault();if(event.repeat)return;game.dawnChannel=!!currentLevel.dawn;game.finalDuel?.setHeld(true);if(currentLevel.dawn)game.strike();processEvents();
  }
  if(['Space','ArrowUp','ArrowDown','KeyW','KeyS'].includes(event.code)&&mode==='running') {
    event.preventDefault();if(event.repeat)return;
    if(['Space','ArrowUp','KeyW'].includes(event.code))game.jump();else game.slide();processEvents();
  }
  if(event.repeat)return;
  if(['Escape','KeyP'].includes(event.code)){event.preventDefault();togglePause();}
  if(event.code==='KeyM')toggleSound();
  if(event.code==='KeyJ')openJournal();
});
// 创作者通道 · 心源调参：滑块实时改档位，按钮做试算。
for(const id of ['hearts-max','hearts-t2','hearts-t1']){
  $(id)?.addEventListener('input',()=>{ applyHeartsPanel(); });
}
$('hearts-apply')?.addEventListener('click',()=>{ applyHeartsPanel(); previewHearts(); });

for(const [id,action] of [['touch-jump',()=>game.jump()],['touch-slide',()=>game.slide()]]) {
  $(id).addEventListener('pointerdown',event=>{event.preventDefault();if(mode==='running'){action();processEvents();}});
}
window.addEventListener('keyup',event=>{if(currentLevel.finalBoss&&['KeyA','ArrowLeft','KeyD','ArrowRight'].includes(event.code))game.finalDuel?.setMove(0);if(creatorMode&&mode==='intro'&&storyPhase==='theater')return;if(['KeyA','ArrowLeft'].includes(event.code))game.setBrake(false);if(event.code==='KeyE'){setEchoHeld(false);game.dawnChannel=false;game.finalDuel?.setHeld(false);};});
$('touch-brake').addEventListener('pointerdown',event=>{event.preventDefault();if(mode==='running'){if(currentLevel.finalBoss&&!['idle','defeated'].includes(game.finalDuel.phase))game.finalDuel.setMove(-1);else game.setBrake(true);$('touch-brake').setPointerCapture(event.pointerId);}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touch-brake').addEventListener(type,()=>{game.setBrake(false);game.finalDuel?.setMove(0);});
$('touch-echo').addEventListener('pointerdown',event=>{event.preventDefault();if(mode!=='running')return;
  if(currentLevel.dawn||currentLevel.finalBoss){game.dawnChannel=!!currentLevel.dawn;game.finalDuel?.setHeld(true);$('touch-echo').setPointerCapture(event.pointerId);if(currentLevel.dawn)game.strike();processEvents();return;}
  setEchoHeld(true);$('touch-echo').setPointerCapture(event.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touch-echo').addEventListener(type,()=>{setEchoHeld(false);game.dawnChannel=false;game.finalDuel?.setHeld(false);} );
// 逆火冲刺是一次性的（不像刹车/照忆要按住），所以 pointerdown 直接触发一次。
$('touch-dash').addEventListener('pointerdown',event=>{event.preventDefault();if(mode==='running'){if(currentLevel.finalBoss){game.finalDuel.setMove(1);$('touch-dash').setPointerCapture(event.pointerId);}else game.backfire();processEvents();}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touch-dash').addEventListener(type,()=>game.finalDuel?.setMove(0));
window.addEventListener('blur',pausePlay);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pausePlay();});
new ResizeObserver(()=>renderer.resize()).observe($('stage'));
const audioSettings=document.createElement('div');audioSettings.className='audio-settings';audioSettings.innerHTML='<label for="music-volume">配乐音量</label><input id="music-volume" type="range" min="0" max="100" value="55" aria-label="配乐音量"><output id="music-volume-value">55%</output><a href="assets/music/ember-requiem.wav" target="_blank" rel="noopener">单独试听《葬火》 ↗</a>';
$('help-dialog').insertBefore(audioSettings,$('help-done'));
const musicNow=document.createElement('p');musicNow.className='help-note';musicNow.id='music-now';musicNow.textContent='当前配乐 · 声音已关闭';$('help-dialog').insertBefore(musicNow,$('help-done'));
audio.onTrackChange=title=>{musicNow.textContent='当前配乐 · '+title;};
// 第四幕的配乐换段说明：让玩家知道"同一首曲子会随段落变脸色"，
// 否则他会以为只是音量变了。
const musicSections=document.createElement('p');musicSections.className='help-note';
musicSections.textContent='《葬火》一首主题贯穿全程，但每一幕的四个章节换一次演奏法：起段只有弦垫与拨奏，行段加入鼓点，迫段添上钟声，决段全声部齐奏。旋律始终是同一条，听得出走到哪一段。';$('help-dialog').insertBefore(musicSections,$('help-done'));
$('music-volume').addEventListener('input',event=>{audio.setVolume(Number(event.target.value)/100);$('music-volume-value').textContent=event.target.value+'%';});
const brakeHelp=document.createElement('p');brakeHelp.className='help-note';brakeHelp.textContent='第二幕新增刹步：按住 A 或 ← 在地面停下，松开继续跑。等退潮时停在岸边；引巨像瞄准锁桩时停住，红圈锁定后立即松开离开。空中刹步无效。';$('help-dialog').insertBefore(brakeHelp,$('help-done'));
document.querySelector('.help-note').textContent='第一幕的守灯人会举杖蓄光，再发出贴地灰弹；靠近时起跳，连续两发可用同一次跳跃越过。踏上青色风印会自动腾空；穿过高处的金色共鸣环可补充一格余火。连续收集碎片形成连忆。跑酷时奏响《葬火》，开启声音后打开世界档案可听《抄名人之歌》；转场、共鸣与胜败使用独立音乐短段。按 M 静音，触屏使用屏幕下方按钮。';
requestAnimationFrame(frame);

const echoHelp=document.createElement('p');echoHelp.className='help-note';echoHelp.textContent='第三幕按住 E 照忆，金色旧桥才能承重，蓝色封墙也同时显形。跳离石台后松开 E 穿墙，再照亮下一台。避难灯前会自动停步，按住 E 完成注火；读剧情不会自动救人，灰潮也随暂停冻结。触屏按住照忆按钮。';
$('help-dialog').insertBefore(echoHelp,$('help-done'));
const dawnHelp=document.createElement('p');dawnHelp.className='help-note';dawnHelp.textContent='第四幕：跑向黎明楔，把王的落锤引到楔前。金圈追踪你，变红后落点固定，立刻按住 A / ← 后撤到圈外。王自己的攻击会砸断楔，不再需要灌注。沿途焰刃跳过，高刃滑铲，紫浪二段跳。第五幕：A / D 左右走位，火雨和地火必须离开标记；跳跃、滑铲避开横向攻击。按住 E 接金色记忆，松开发还。王的九段生命分三阶段，每三次命中升级攻势。';$('help-dialog').insertBefore(dawnHelp,$('help-done'));

function showFinalChoice(){
  for(const choice of FINAL_CHOICES){$('choice-'+choice.id).querySelector('b').textContent=choice.title;$('choice-'+choice.id).querySelector('span').textContent=choice.body;}
  setMode('choice');
}
function returnToFinalChoice(){
  loadLevel(FINALE);game.checkpoint=10400;game.restoreCheckpoint(true);game.respawns=0;game.events=[];
  game.x=game.prevX=FINALE.finalBoss.arena;game.y=game.prevY=game.groundAt(game.x);game.state='choosing';showFinalChoice();
}
for(const choice of FINAL_CHOICES)$('choice-'+choice.id).addEventListener('click',()=>{
  if(mode!=='choice'||!game.chooseFinalPath(choice.id))return;
  if(game.state==='running'){setMode('running');updateHUD();}
  processEvents();
});
$('choice-back').addEventListener('click',()=>setMode('menu'));

function refreshCreatorSearch(){
  const query=$('creator-search').value.trim().toLowerCase(),edited=new Set(listEditedStoryText());
  const options=[];for(const [r,reel] of STORY_REELS.entries())for(const [i,page] of reel.pages.entries()){
    const values=editorValues(page.editKey)||page;
    if($('creator-edited-only').checked&&!edited.has(page.editKey))continue;
    if(query&&![reel.name,values.title,values.body,values.quote].some(v=>String(v||'').toLowerCase().includes(query)))continue;
    const option=document.createElement('option');option.value=r+':'+i;option.textContent=(edited.has(page.editKey)?'● ':'')+reel.name+' / '+(i+1)+' '+String(values.title).replace(/\n/g,'');options.push(option);
  }
  $('creator-results').replaceChildren(...options);$('creator-search-count').textContent=options.length+' 个片段';
  $('creator-results').value=theaterReel+':'+storyIndex;
}
function syncCreatorCopies(){for(const reel of STORY_REELS)for(const page of reel.pages){const values=editorValues(page.editKey);if(values)Object.assign(page,values);}lastJournalCount=-1;}
function refreshCreatorPreview(){
  const pick=CHAPTER_PICKS[Number($('creator-test-act').value)]||CHAPTER_PICKS[0];
  $('creator-test-cp').replaceChildren(...pick.level.checkpoints.map(x=>{const op=document.createElement('option');op.value=String(x);op.textContent=pick.level.chapters.find(c=>c.at===x)?.title||String(x);return op;}));
}
function startCreatorPreview(level,checkpoint=0,ending=null){
  creatorPreviewReturn={reel:theaterReel,page:storyIndex};creatorMode=false;
  const preview={...level,previewOnly:true,previewCheckpoint:checkpoint};loadLevel(preview);game.checkpoint=checkpoint;
  game.checkpointFlags=new Set((level.flags||[]).filter(f=>!f.manual&&f.x<checkpoint).map(f=>f.id));
  game.checkpointItems=new Set((level.items||[]).filter(item=>item.x<checkpoint).map(item=>item.id));
  game.restoreCheckpoint(true);game.events=[];game.respawns=0;
  narrative.resetRun();encounter.reset();syncEncounterProgress();renderer.trail=[];renderer.particles=[];renderer.waves=[];
  setMode('running');updateHUD();
  if(ending){game.x=game.prevX=FINALE.finalBoss.arena;game.state='choosing';game.chooseFinalPath(ending);processEvents();if(game.state==='running')setMode('running');}
}
for(const field of ['title','body','quote'])$('creator-'+field).addEventListener('input',()=>{
  const key=storyPanels[storyIndex]?.editKey;if(!key)return;
  creatorDrafts.set(key,{title:$('creator-title').value,body:$('creator-body').value,quote:$('creator-quote').value});$('creator-editor-status').textContent='有未保存修改 · 切换片段会保留草稿';
});
$('creator-search').addEventListener('input',refreshCreatorSearch);$('creator-edited-only').addEventListener('change',refreshCreatorSearch);
$('creator-results').addEventListener('change',e=>{if(!e.target.value)return;const [r,i]=e.target.value.split(':').map(Number);selectStoryReel(r);showStory(i);});
$('creator-undo').addEventListener('click',()=>{const key=undoCreatorSave();if(!key){$('creator-editor-status').textContent='没有可撤销的保存';return;}creatorDrafts.delete(key);syncCreatorCopies();showStory(storyIndex);$('creator-editor-status').textContent='已撤销上一次保存 / 恢复';});
$('creator-export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(exportCreatorProject(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='神之殇-创作者备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('creator-backup-status').textContent='已导出已保存文本与心源参数；未保存草稿未包含';
});
$('creator-import').addEventListener('change',async e=>{
  try{const file=e.target.files?.[0];if(!file)return;if(file.size>4*1024*1024)throw Error('备份文件超过 4MB');const raw=JSON.parse(await file.text()),plan=inspectCreatorImport(raw);creatorImportPending=raw;$('creator-import-apply').disabled=false;$('creator-backup-status').textContent='将导入 '+plan.count+' 个片段，跳过 '+plan.skipped+' 个未知片段；点击应用后生效';}
  catch(err){creatorImportPending=null;$('creator-import-apply').disabled=true;$('creator-backup-status').textContent=err.message;}e.target.value='';
});
$('creator-import-apply').addEventListener('click',()=>{if(!creatorImportPending)return;const plan=importCreatorProject(creatorImportPending);creatorImportPending=null;$('creator-import-apply').disabled=true;creatorDrafts.clear();syncCreatorCopies();syncHeartsPanel();showStory(storyIndex);$('creator-backup-status').textContent='已导入 '+plan.count+' 个片段，并同步主线';});
for(const [i,pick] of CHAPTER_PICKS.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=pick.level.title;$('creator-test-act').append(option);}
$('creator-test-act').addEventListener('change',refreshCreatorPreview);refreshCreatorPreview();
$('creator-test-go').addEventListener('click',()=>{const pick=CHAPTER_PICKS[Number($('creator-test-act').value)];startCreatorPreview(pick.level,Number($('creator-test-cp').value));});
for(const choice of FINAL_CHOICES)$('creator-ending-'+choice.id).addEventListener('click',()=>startCreatorPreview(FINALE,10400,choice.id));
$('creator-preview-return').addEventListener('click',()=>{const back=creatorPreviewReturn||{reel:0,page:0};creatorMode=true;loadLevel(CHAPTER_PICKS[selectedChapter]?.level||LEVELS.prologue);selectStoryReel(back.reel);showStory(back.page);});

// Optional reading voice uses the edited live page, never stale prerecorded prose.
const endingControls=document.createElement('div');endingControls.className='ending-controls';
const endingVoice=document.createElement('button');endingVoice.type='button';endingVoice.textContent='朗读本页';endingControls.append(endingVoice);$('story-quote').after(endingControls);
function refreshEndingControls(panel){
  globalThis.speechSynthesis?.cancel();
  endingControls.hidden=creatorMode||!((currentLevel.id==='finale'&&storyPhase==='ending')||(storyPhase==='theater'&&panel.picture?.level==='finale'));
  endingFilm.hidden=panel.art!=='final-embers'&&!(panel.picture?.phase==='embers'&&panel.picture?.index>=6);
  endingVoice.textContent='朗读本页';
  const voice=globalThis.speechSynthesis?.getVoices().find(v=>/^zh/i.test(v.lang));endingVoice.disabled=!voice;
  endingVoice.title=voice?'使用本机中文语音朗读当前文本':'本机没有中文语音；可连接配音服务制作角色录音';
}
endingVoice.addEventListener('click',()=>{
  const synth=globalThis.speechSynthesis;if(!synth)return;synth.cancel();
  const u=new SpeechSynthesisUtterance([storyPanels[storyIndex].title,storyPanels[storyIndex].body,storyPanels[storyIndex].quote].join('。'));
  u.voice=synth.getVoices().find(v=>/^zh/i.test(v.lang));u.lang='zh-CN';u.rate=.86;u.volume=audio.enabled?audio.volume:0;
  if(!u.voice)return;synth.speak(u);endingVoice.textContent='正在朗读';u.onend=()=>endingVoice.textContent='朗读本页';
});
globalThis.speechSynthesis?.addEventListener('voiceschanged',()=>{if(mode==='intro')refreshEndingControls(storyPanels[storyIndex]);});
const endingFilm=document.createElement('button');endingFilm.type='button';endingFilm.id='ending-film-open';endingFilm.textContent='播放片尾短片 · 18 秒';endingControls.append(endingFilm);
const filmDialog=document.createElement('dialog');filmDialog.id='ending-film-dialog';filmDialog.setAttribute('aria-label','万家微火片尾短片');
const filmPlayer=document.createElement('video');filmPlayer.controls=true;filmPlayer.playsInline=true;filmPlayer.muted=true;filmPlayer.preload='none';filmPlayer.style.cssText='width:100%;max-height:70vh';filmPlayer.setAttribute('aria-label','执炬王交出火焰，烬散为余火照亮人家');
const filmClose=document.createElement('button');filmClose.textContent='返回结尾';filmClose.type='button';filmDialog.append(filmPlayer,filmClose);document.body.append(filmDialog);
endingFilm.addEventListener('click',()=>{globalThis.speechSynthesis?.cancel();filmPlayer.src=endingAsset('epilogue');filmDialog.showModal();filmPlayer.play().catch(()=>{});});
function releaseEndingFilm(){filmPlayer.pause();filmPlayer.removeAttribute('src');filmPlayer.load();endingFilm.focus();}
filmClose.addEventListener('click',()=>{releaseEndingFilm();filmDialog.close();});
filmDialog.addEventListener('cancel',releaseEndingFilm);filmDialog.addEventListener('close',()=>{if(filmPlayer.hasAttribute('src'))releaseEndingFilm();});

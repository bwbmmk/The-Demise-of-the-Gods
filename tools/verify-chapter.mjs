import {bossInput,routeInput} from '../tests/runner-input.mjs';
// 开发校验页使用真实单文件产物，在模块内驱动主流程与按钮。
// 确定性输入检查可达性；不冒充新玩家盲玩或人工无伤通关。
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {runChrome} from './run-chrome.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const qaRoot=path.resolve(import.meta.dirname,'..');
const qaDir=path.join(qaRoot,'.verify');mkdirSync(qaDir,{recursive:true});
const qaShotViews=['menu-restored','dawn-menu','dawn-opening','dawn-ending','dawn-theater','fate-opening','fate-bridge','fate-wall','fate-war','fate-sword','fate-miya','fate-rescue','fate-ending','fate-theater','fall-active','giant-low','giant-high','giant-chain2','giant-chain3','giant-highwave','ward-used','story-theater','story-elder','boss-hub','chain-practice','prologue-opening','prologue-ending','opening','healer','bell','ferry','bridge','warden','harvest-elder','ending','running','boss','bossvolley','counter','fall','high','broken','shieldgrow','intermission','covenant-opening','covenant-wind','covenant-sea','covenant-harvest','covenant-boss','covenant-ending','entry'];
const qaBundle=readFileSync(path.join(qaRoot,'神之殇-demo.html'),'utf8');
qaShotViews.push('creator-gate','creator-editor','creator-workbench','finale-opening','finale-choice','finale-boss','finale-memory','finale-return','finale-throne','finale-night','finale-embers');
qaShotViews.push('finale-crossfire','finale-edict','finale-siege','finale-hunt','finale-sweepfire','finale-storm','finale-last-sun','finale-sacrifice','finale-film','dawn-hammer-lock');
qaShotViews.push('dawn-move-quake','dawn-move-sweep','dawn-move-meteor','dawn-move-stomp','dawn-move-cinder','dawn-move-pulse','dawn-counter','dawn-active-pulse');
// 第四幕逐招截图：六招各一张，外加"高低两级地形"与"王座/日蚀场景"。
// 这些是"王不止会挥锤"这一条的可视证据，必须能一条命令复现，
// 所以它们的名字要和 combat-hints 的 dawn-* 提示一一对上。
qaShotViews.push('dawn-move-crown','dawn-move-sweep-low','dawn-move-sweep-high','dawn-move-ray','dawn-move-rain','dawn-move-nova','dawn-wedge-aim','dawn-impact','dawn-scene-refuge','dawn-scene-roster','dawn-scene-throne','dawn-relief-flat','dawn-relief-up','dawn-relief-crest','dawn-spring','dawn-throne','dawn-windrefuge','dawn-highplat','dawn-start');
const qaFixture=qaBundle.replace('<head>','<head><script>window.requestAnimationFrame=()=>0;window.__qaErrors=[];window.__qaWrites=[];window.__qaStorage={getItem:()=>null,setItem:(key,value)=>__qaWrites.push({key,value})};addEventListener("error",e=>__qaErrors.push(e.message));</script>')
  .replace('const narrative=new Narrative(journalStorage);','journalStorage=window.__qaStorage;const narrative=new Narrative(journalStorage);')
  .replace('const storage=()=>{try{return window.localStorage;}catch{return null;}};','const storage=()=>window.__qaStorage;');
const qaProbe=String.raw`
${bossInput.toString()}
${routeInput.toString()}
const qaChecks=[],qaVisits=[];
// 提示种类数直接由数据表推出：新增招式只改 combat-hints.js，校验自己跟上，不用手改数字。
const HINT_KINDS=Object.keys(ATTACK_HINTS).length;
const COVENANT_HINT_KINDS=Object.keys(ATTACK_HINTS).filter(k=>k.startsWith('chain-')||['low','high','fall','counter'].includes(k)).length;
const qaAssert=(condition,name)=>{if(!condition)throw Error(name);qaChecks.push(name);};
const qaClick=id=>document.getElementById(id).click();
const qaSnapshot=()=>JSON.stringify({x:game.x,y:game.y,health:game.health,time:game.elapsed,checkpoint:game.checkpoint,echo:game.echoLight,rescue:game.rescueProgress,rescueId:game.rescueId,chase:game.chaseAge,flags:[...game.flag],shards:[...game.collected],items:[...game.items],warmth:game.warmth,lamps:[...game.litLamps],mechanisms:[...game.mechanismStates],respawns:game.respawns,projectiles:game.projectiles,enemies:[...game.enemyStates],boss:game.boss,bossRelic:game.bossRelic,bossShots:game.bossShots});
const qaBossAlive=()=>game.boss&&game.boss.phase!=='idle'&&game.boss.phase!=='defeated';
const qaRender=()=>{if(mode==='running')updateHUD();renderer.render(1/60,game,mode,1,cinematic.sample());};
const qaViews=new URLSearchParams(location.search).get('view');
// 截图模式：主循环被冻结的 rAF 停住了，这里直接把当前这一帧画出来。
//
// 为什么还要把画布导出：这套 headless 组合里 canvas 不进合成结果——
// 页面里 getImageData 读得到正确像素，chrome --screenshot 截出来的却是黑的。
// 所以画布交给页面用 toDataURL 导出，HUD/对白/字幕仍由 chrome 截，
// 校验脚本再把两者贴回去（见 qaCompose）。
const qaShotAt=name=>{
  if(qaViews!==name)return false;
  qaRender();
  const canvas=document.getElementById('game');
  const rect=canvas.getBoundingClientRect();
  // 截取静止阅读布局；脚本快速翻页时 CSS 入场动画可能还在首帧。
  for(const animation of document.getAnimations())if(Number.isFinite(animation.effect?.getComputedTiming().endTime))animation.finish();
  document.body.dataset.qaCanvas=canvas.toDataURL('image/png');
  // DOM 图片使用实际画布的像素，保持 HUD、对白等原有叠放顺序。
  // 直接 paste 画布矩形会盖掉矩形内的 HUD，不能作为视觉验收。
  const preview=document.createElement('img');preview.src=document.body.dataset.qaCanvas;preview.alt='';preview.setAttribute('aria-hidden','true');preview.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.after(preview);
  document.body.dataset.qaCanvasRect=[rect.left,rect.top,rect.width,rect.height,window.devicePixelRatio||1].join(',');
  return true;
};
function qaReadEncounter(){
  const scene=encounter.active;qaVisits.push(scene.id);
  const before=qaSnapshot();qaClick('pause-button');qaAssert(mode==='paused','对白可暂停 / '+scene.id);
  qaClick('resume');qaAssert(mode==='encounter'&&qaSnapshot()===before,'对白暂停不改数值 / '+scene.id);
  qaClick('journal-open');qaAssert($('lore-dialog').open,'对白中打开手记 / '+scene.id);
  qaAssert($('lore-dialog').dataset.transition==='journal','手记使用翻页过渡 / '+scene.id);
  $('lore-dialog').querySelector('.dialog-close').click();
  // dialog.close 的 close 事件异步；测试在外层等待任务后继续。
  return new Promise((resolve,reject)=>setTimeout(()=>{try{
    qaAssert(mode==='encounter','关闭手记返回对白 / '+scene.id);
    const fateShots={'f-war-talk':'fate-war','f-sun-talk':'fate-sword','f-miya-talk':'fate-miya'};
    if(fateShots[scene.id]&&qaShotAt(fateShots[scene.id])){resolve(false);return;}
    if(scene.id!=='warden'&&qaShotAt(scene.id)){resolve(false);return;}
    while(encounter.active){
      const page=encounter.current;
      if(scene.id==='c-harvest'&&encounter.page===1){
        qaAssert(page.speaker==='老妇人'&&$('encounter-art').dataset.portrait==='elder','老妇人使用独立肖像');
        qaAssert($('encounter-line').textContent.includes('今年还要我缴'),'催缴记忆是实际对白');
        if(qaShotAt('harvest-elder')){resolve(false);return;}
      }
      if(scene.id==='warden'&&encounter.page===3){
        qaAssert($('encounter-art').dataset.portrait==='jin'&&/没查清之前/.test($('encounter-line').textContent),'烬自己拒交钥匙并说明疑问');
        if(qaShotAt('warden')){resolve(false);return;}
      }
      qaClick('encounter-next');
    }
    const comparable=value=>{const data=JSON.parse(value);if(scene.kind==='bridge')data.flags=data.flags.filter(id=>id!=='bridge-restored');return JSON.stringify(data);};
    qaAssert(comparable(qaSnapshot())===comparable(before),'翻页不改模拟 / '+scene.id);resolve(true);
    }catch(error){reject(error);}
  },260));
}
async function qaBossChecks(){
  // 记名桥机关的三条硬要求，逐条在真实运行环境里验证。
  // 这些检查发生在战斗进行中，用暂停/继续键与快照比较，不改动战斗本身。
  if(!qaBossAlive())return;
  const before=qaSnapshot();
  // 1) 暂停不改变战斗数值：按暂停键，快照必须完全一致。
  // 注意：这里不能用 await 等待——headless 的虚拟时间会跳过定时器，
  // 让后面的截图与断言拿不到已经排好的渲染帧。冻结是同步的，不需要等。
  qaClick('pause-button');qaAssert(mode==='paused','Boss 战可暂停');
  qaClick('resume');
  qaAssert(qaSnapshot()===before,'Boss 战暂停不改战斗数值');
  // 2) 法术有预警：charge 阶段必须明显长于一个反应窗口。
  if(game.level.boss.kind==='chain'){qaAssert(game.bossRelic===null,'巨像不投放反击道具');return;}
  qaAssert(game.level.boss.windup>=.9,'Boss 预警窗口足够读招');
  // 3) 追逐关系：军官会飞、与玩家同速，整场都停在玩家前方 lead 附近。
  qaAssert(game.level.boss.lead>=240&&game.level.boss.lead<=680,'军官前方距离在可读范围内');
  qaAssert(game.boss&&Math.abs((game.boss.x-game.x)-game.level.boss.lead)<=2,'军官恒在玩家前方固定距离');
  // 4) 齐射：每轮多发、间隔可读，玩家要在奔跑里连续躲。
  qaAssert(game.level.boss.volley>=2&&game.level.boss.volley<=5,'每轮齐射发数可读');
  qaAssert(game.level.boss.gap>=.5,'齐射间隔足够反应');
  // 5) 反击器物落在跑道前方，可顺手拾起。
  qaAssert(game.level.boss.relicLead>=120&&game.level.boss.relicLead<=game.level.boss.lead,'反击器物落在前方跑道');
  // 6) NPC 协同点齐全。
  const kinds=game.level.boss.stations.map(s=>s.kind).join(',');
  qaAssert(kinds==='bell,rope,ward','三个 NPC 各有协同点');
}
async function qaRunRoute(){
  const inputState={handled:new Set(),doubleAt:null};let checkedWarning=false,qaBossChecked=false,qaShieldChecked=false,qaEchoChecked=false,qaRescueChecked=false;const giantAttacks=new Set(),finalAttacks=new Set();
  const inputActor=new Proxy(game,{get:(g,key)=>key==='finalDuel'&&g.finalDuel?new Proxy(g.finalDuel,{get:(d,k)=>k==='setMove'?(dir)=>{if(dir!==d.move){if(d.move)window.dispatchEvent(new KeyboardEvent('keyup',{code:d.move<0?'KeyA':'KeyD',bubbles:true}));if(dir)window.dispatchEvent(new KeyboardEvent('keydown',{code:dir<0?'KeyA':'KeyD',bubbles:true}));}}:k==='setHeld'?(held)=>{if(held!==d.held)window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code:'KeyE',bubbles:true}));}:d[k]}):key==='setEcho'?(held)=>window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code:'KeyE',bubbles:true})):key==='setBrake'?(held)=>window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code:'KeyA',bubbles:true})):['jump','slide'].includes(key)?()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:key==='slide'?'ArrowDown':'Space',bubbles:true})):typeof g[key]==='function'?g[key].bind(g):g[key]});
  for(let i=0;i<120*250&&game.state==='running';i++){
    if(mode==='intro'&&storyPhase==='interlude'){
      const before=qaSnapshot();frame(1000);qaAssert(qaSnapshot()===before,'过桥分镜不推进模拟');
      qaAssert(narrative.unlocked.has('a13'),'第一幕中点明确孩子身份');qaClick('intro-skip');qaAssert(mode==='running'&&qaSnapshot()===before,'跳过中点继续原路线');
    }
    if(mode==='encounter'){if(!await qaReadEncounter())return false;}
    if(!(qaViews==='ward-used'&&currentLevel.id==='district'&&game.inBossFight))routeInput(inputActor,inputState);
    if(game.boss&&!game.boss.ward&&qaShotAt('ward-used'))return false;
    if(currentLevel.boss?.kind==='chain'){
      for(const shot of game.bossShots){giantAttacks.add(shot.kind);if(qaShotAt(shot.kind==='high'?'giant-high':'giant-low'))return false;}
      if(game.boss?.phase==='aim'&&game.boss.age>1.7&&game.boss.patternIndex>0&&qaShotAt(game.boss.patternIndex===2?'giant-chain3':'giant-chain2'))return false;
      if(game.boss?.phase==='impact'&&game.boss.patternIndex===2&&game.boss.age>1.05&&qaShotAt('giant-highwave'))return false;
    }
    if(currentLevel.finalBoss){
      const duel=game.finalDuel;
      if(duel&&!['idle','defeated'].includes(duel.phase)&&duel.attack)finalAttacks.add(duel.attack);
      if(duel?.phase==='attack'&&duel.age>.18&&['crossfire','edict','siege','hunt','sweepfire'].includes(duel.attack)&&qaShotAt('finale-'+duel.attack))return false;
      if(duel?.attack==='rain'&&duel.phase==='attack'&&duel.entities.some(e=>e.age>.25)&&qaShotAt('finale-storm'))return false;
      if(duel?.stage===2&&duel.phase==='aim'&&qaShotAt('finale-last-sun'))return false;
      if(duel?.phase==='aim'&&qaShotAt('finale-boss'))return false;
      if(duel?.phase==='recall'&&duel.orb?.x-game.x<230&&qaShotAt('finale-memory'))return false;
      if(duel?.phase==='return'&&qaShotAt('finale-return'))return false;
    }
    if(currentLevel.id==='fate'){
      if(game.x>2400&&game.grounded&&game.platformAt(game.x)&&!qaEchoChecked){
        qaEchoChecked=true;const before=qaSnapshot();qaClick('pause-button');frame(2000);qaAssert(qaSnapshot()===before,'照忆落脚时暂停冻结桥、位置和光');qaClick('resume');qaAssert(qaSnapshot()===before&&game.echoLight,'继续保留当前照忆状态');
        if(qaShotAt('fate-bridge'))return false;
      }
      if(game.x>6700&&game.x<6900&&!game.echoLight&&qaShotAt('fate-wall'))return false;
      if(game.rescueId&&game.rescueProgress>.3&&!qaRescueChecked){
        qaRescueChecked=true;const before=qaSnapshot();qaClick('pause-button');frame(2000);qaAssert(qaSnapshot()===before,'救援中暂停不推进注火或灰潮');qaClick('resume');qaAssert(qaSnapshot()===before,'继续不自动完成救援');
        if(qaShotAt('fate-rescue'))return false;
      }
    }
    if(currentLevel.id==='district'&&game.x>=5750&&qaShotAt('running'))return false;
    if(currentLevel.id==='district'&&game.x>=61000&&qaShotAt('lantern-running'))return false;
    if(currentLevel.id==='covenant'){
      if(game.x>=3260&&qaShotAt('covenant-wind'))return false;
      if(game.x>=17320&&qaShotAt('covenant-sea'))return false;
      if(game.x>=32170&&qaShotAt('covenant-harvest'))return false;
      if(game.inBossFight&&game.boss.phase==='locked'&&qaShotAt('covenant-boss'))return false;
    }
    if(currentLevel.id==='covenant-boss-practice'&&game.boss?.phase==='locked'&&qaShotAt('chain-practice'))return false;
    // 第四幕：逐招、地形与场景截图。
    // 招式图必须在"该招正在预警（phase==='aim'）"的一帧上停住，
    // 否则拍到的是一张空台——上一次 sweep-high 就拍成了 phase=defeated 的收尾帧。
    if(currentLevel.id==='dawn'){
      const D=game.dawn;
      if(D?.move==='hammer'&&D.phase==='aim'&&D.moveAge>1&&qaShotAt('dawn-hammer-lock'))return false;
      if(D?.phase==='exposed'&&qaShotAt('dawn-counter'))return false;
      if(D?.move==='pulse'&&D.phase==='impact'&&game.dawnEntities.some(e=>e.x-game.x<270)&&qaShotAt('dawn-active-pulse'))return false;
      if(D&&qaViews?.startsWith('dawn-move-')){
        const wanted=qaViews.slice(10);
        if(D.phase==='aim'&&D.move===wanted&&qaShotAt(qaViews))return false;
      }
      // 楔前引锤：玩家停在楔的安全距离、王正在报 crown。
      if(D&&D.phase==='aim'&&D.move==='crown'&&game.blockingWedge&&qaShotAt('dawn-wedge-aim'))return false;
      if(D&&D.phase==='impact'&&qaShotAt('dawn-impact'))return false;
      // 地形三态：平地 / 上坡 / 台地顶点，用来说明"王城不是一条平路"。
      if(game.x>=1000&&game.x<1200&&qaShotAt('dawn-start'))return false;
      if(game.x>=4300&&game.x<4700&&qaShotAt('dawn-relief-flat'))return false;
      if(game.x>=6100&&game.x<6600&&qaShotAt('dawn-relief-up'))return false;
      if(game.x>=8300&&game.x<8800&&qaShotAt('dawn-relief-crest'))return false;
      // 场景四态：与 scenery 数组一一对应。
      if(game.x>=900&&game.x<2600&&qaShotAt('dawn-scene-refuge'))return false;
      if(game.x>=11800&&game.x<13400&&qaShotAt('dawn-scene-roster'))return false;
      if(game.x>=23500&&game.x<25200&&qaShotAt('dawn-scene-throne'))return false;
      // 风印与高处共鸣：踩到风印、正在被托举的一帧。
      if(game.x>=6500&&game.x<=6600&&!game.grounded&&qaShotAt('dawn-spring'))return false;
      if(game.x>=6500&&game.x<=6600&&qaShotAt('dawn-windrefuge'))return false;
      if(game.x>=20500&&game.x<20900&&qaShotAt('dawn-highplat'))return false;
      if(game.x>=23300&&game.x<24500&&qaShotAt('dawn-throne'))return false;
    }
    // Boss 战开始后立刻做一次专项检查，并支持 boss 截图。
    if(!qaBossChecked&&qaBossAlive()){
      qaBossChecked=true;await qaBossChecks();
      // 截图：推进到"军官举剑蓄光"的一帧，让画面里同时有预警弧与 NPC 协同点。
      if(qaViews==='boss')while(qaBossAlive()&&game.boss.phase!=='charge'){game.update(1/120);processEvents();renderer.sample(game);}
      if(qaShotAt('boss'))return false;
      // 第二张 boss 图：停在"齐射途中 + 器物在跑道上"的一帧，读得出追逐关系。
      if(qaViews==='bossvolley'){
        while(qaBossAlive()&&game.boss.phase!=='volley'){game.update(1/120);processEvents();renderer.sample(game);}
        // 再推进到本轮第二发在空中，让画面里同时有法术与前方器物。
        for(let k=0;k<70&&qaBossAlive()&&game.boss.phase==='volley';k++){game.update(1/120);processEvents();renderer.sample(game);}
      }
      if(qaShotAt('bossvolley'))return false;
    }
    if(!checkedWarning&&game.projectiles.length){
      const before=qaSnapshot();qaClick('pause-button');qaRender();qaClick('resume');
      qaAssert(qaSnapshot()===before,'法术暂停与恢复不移动弹道');checkedWarning=true;
    }
    if(game.bossShots.some(s=>s.kind==='high')&&qaShotAt('high'))return false;
    if(game.boss?.phase==='shield'&&game.boss.stunned&&game.boss.age>1.15&&qaShotAt('broken'))return false;
    if(game.boss?.phase==='recover'&&!game.boss.stunned&&game.boss.shieldAge>.3&&game.boss.shieldAge<.6&&qaShotAt('shieldgrow'))return false;
    if(game.bossRelic&&!game.bossRelic.gone&&qaShotAt('counter'))return false;
    if(game.bossShots.some(s=>s.kind==='fall')&&qaShotAt('fall'))return false;
    if(game.bossShots.some(s=>s.kind==='fall'&&s.age>s.warning+.05)&&qaShotAt('fall-active'))return false;
    const hp=game.health;game.update(1/120);processEvents();renderer.sample(game);
    if(game.health<hp)throw Error('路线受击 / '+Math.floor(game.x));
    if(currentLevel.boss?.kind!=='chain'&&game.boss?.phase==='recover'&&game.boss.age===0)qaAssert(!game.boss.stunned&&game.boss.shieldAge===0,'回火命中立刻重新长盾');
    if(!qaShieldChecked&&currentLevel.boss?.kind!=='chain'&&game.boss?.round===1&&game.boss.phase==='volley'){qaShieldChecked=true;qaAssert(!game.boss.stunned&&game.boss.shieldAge>2,'军官带盾完成下一轮攻击');}
    if(mode==='running'){narrative.advance(game.x,currentLevel.id);updateHUD();}
    if(i%120===0)qaRender();
  }
  if(currentLevel.finalBoss&&game.finalDuel.hits===9){
    qaAssert(finalAttacks.size===13,'终战实机经历十三种招式与组合');
    qaAssert(game.finalDuel.spec.warning<.7&&game.finalDuel.spec.chargeGap<.17,'最后血量阶段真实提高攻击频率');
  }
  qaAssert(game.state==='won'||game.state==='choosing','路线完成或到达门前选择 / '+currentLevel.id);if(currentLevel.boss?.kind==='chain')qaAssert([...giantAttacks].join(',')==='low,high','巨像实际释放贴地刃和高位光幕');return true;
}
function qaReadTheater(){
  const before=qaSnapshot(),levelBefore=currentLevel.id,pickBefore=selectedChapter,writesBefore=__qaWrites.length,countBefore=narrative.count;
  qaClick('story-entry');qaAssert(mode==='intro'&&storyPhase==='theater'&&!$('story-theater-nav').classList.contains('hidden'),'纯享入口直接阅读，不开始跑图');
  for(const [reelIndex,reel] of STORY_REELS.entries()){
    qaAssert(theaterReel===reelIndex&&storyPanels===reel.pages,'纯享顺序衔接 / '+reel.id);
    for(const [pageIndex,page] of reel.pages.entries()){
      qaAssert(storyIndex===pageIndex&&$('story-body').textContent===page.body&&$('story-art').querySelector('svg, .ending-shot img')&&$('story-jump').value===String(pageIndex),'纯享完整正文、插画、页码 / '+reel.id+' / '+pageIndex);
      qaClick('intro-next');
    }
  }
  qaAssert(mode==='menu'&&qaSnapshot()===before,'纯享读完返回菜单，模拟不变');
  qaClick('story-entry');qaClick('story-pick-district');
  const refusal=storyPanels.findIndex(p=>p.portrait==='jin'&&/没查清之前/.test(p.body));
  $('story-jump').value=String(refusal);$('story-jump').dispatchEvent(new Event('change',{bubbles:true}));
  qaAssert(storyIndex===refusal&&$('story-art').querySelector('.theater-portrait svg')&&$('story-body').textContent.includes('没查清之前'),'目录直接跳到对白与烬肖像');
  if(qaShotAt('story-theater'))return false;
  $('story-jump').dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true}));
  qaAssert(storyIndex===refusal,'目录方向键不误翻正文');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',bubbles:true}));qaAssert(storyIndex===refusal-1,'纯享键盘向前翻页');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));qaAssert(storyIndex===refusal,'纯享空格向后翻页');
  qaClick('intermission-entry');qaAssert(theaterReel===2&&storyPanels.length===5,'纯享可直接选择幕间');
  qaClick('story-pick-covenant');const elder=storyPanels.findIndex(p=>p.portrait==='elder');
  $('story-jump').value=String(elder);$('story-jump').dispatchEvent(new Event('change',{bubbles:true}));
  qaAssert($('story-art').querySelector('.theater-portrait')?.getAttribute('aria-label')==='老妇人','纯享可直接选择第二幕人物戏');
  if(qaShotAt('story-elder'))return false;
  qaClick('story-pick-fate');const proof=storyPanels.findIndex(p=>p.recordIds.includes('f4'));$('story-jump').value=String(proof);$('story-jump').dispatchEvent(new Event('change',{bubbles:true}));
  qaAssert(theaterReel===4&&$('story-body').textContent.includes('背后'),'纯享可直达第三幕的实际证据');if(qaShotAt('fate-theater'))return false;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
  qaAssert(mode==='menu'&&qaSnapshot()===before&&currentLevel.id===levelBefore&&selectedChapter===pickBefore,'退出纯享保留关卡选择、数值与检查点');
  qaAssert(narrative.count===countBefore&&__qaWrites.length===writesBefore,'纯享不解锁正式手记，不写存档');
  return true;
}
async function qaWorkbenchChecks(){
  beginStoryTheater(true);$('creator-workbench').open=true;
  const writes=__qaWrites.length,count=narrative.count;
  $('creator-search').value='无神长夜';$('creator-search').dispatchEvent(new Event('input'));
  qaAssert($('creator-results').options.length>0,'创作者跨幕全文搜索能找到结局');
  $('creator-results').value=[...$('creator-results').options].find(o=>o.textContent.includes('第五幕')).value;
  $('creator-results').dispatchEvent(new Event('change'));
  qaAssert(theaterReel===6,'搜索结果直接定位终幕片段');
  const page=storyPanels[storyIndex],key=page.editKey,original=editorPageValues(page);
  $('creator-title').value='未保存草稿';$('creator-title').dispatchEvent(new Event('input'));
  qaClick('intro-next');qaClick('intro-prev');qaAssert($('creator-title').value==='未保存草稿','切换片段保留未保存草稿');
  qaClick('creator-save');qaAssert(editorValues(key).title==='未保存草稿','工作台保存同步来源');
  $('creator-search').value='';$('creator-search').dispatchEvent(new Event('input'));
  $('creator-edited-only').checked=true;$('creator-edited-only').dispatchEvent(new Event('change'));qaAssert($('creator-results').options.length>=1,'只看修改过滤已保存片段');
  qaClick('creator-undo');qaAssert(editorValues(key).title===original.title,'撤销还原上一次保存');
  $('creator-edited-only').checked=false;$('creator-search').value='';refreshCreatorSearch();
  const backup=exportCreatorProject();backup.texts[key]={...original,title:'<img src=x onerror="alert(1)">'};
  const before=editorValues(key).title;
  const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(backup)],'creator-test.json',{type:'application/json'}));$('creator-import').files=transfer.files;
  $('creator-import').dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,250));
  qaAssert(!$('creator-import-apply').disabled&&editorValues(key).title===before,'真实文件导入先预检，未应用不修改正文');
  qaClick('creator-import-apply');qaAssert(editorValues(key).title.includes('<img')&&$('intro-title').textContent.includes('<img')&&!$('intro-title').querySelector('img'),'导入按纯文本显示，不执行标记');
  qaClick('creator-reset');qaAssert(editorValues(key).title===original.title,'导入后的片段可恢复默认');
  const oldClick=HTMLAnchorElement.prototype.click;let exported=null;HTMLAnchorElement.prototype.click=function(){exported={name:this.download,url:this.href};};
  qaClick('creator-export');HTMLAnchorElement.prototype.click=oldClick;
  qaAssert(exported&&exported.name.endsWith('.json')&&exported.url.startsWith('blob:'),'导出按钮生成本地 JSON 备份');
  $('hearts-t1').value='40';$('hearts-t1').dispatchEvent(new Event('input'));qaAssert(heartsThresholds().t1===.4,'四心滑块真实交互生效');
  $('hearts-t1').value='45';$('hearts-t1').dispatchEvent(new Event('input'));
  const previewWrites=__qaWrites.length,editingPage=storyIndex;
  $('creator-test-act').value='4';$('creator-test-act').dispatchEvent(new Event('change'));$('creator-test-cp').value='38800';qaClick('creator-test-go');
  qaAssert(mode==='running'&&currentLevel.previewOnly&&game.x===38800&&game.dawn.broken.size===2,'检查点试玩直接恢复已断楔，不跑前段');
  progressStore.save(game);qaAssert(__qaWrites.length===previewWrites&&narrative.count===count,'创作者试玩与主线存档及手记隔离');
  qaClick('creator-preview-return');qaAssert(creatorMode&&theaterReel===6&&storyIndex===editingPage,'试玩后返回原编辑目录');
  qaClick('creator-ending-night');qaAssert(mode==='intro'&&currentLevel.previewOnly&&storyPanels===FINAL_ENDINGS.night,'创作者可直接检查分支结局');qaClick('intro-skip');qaClick('creator-preview-return');
  qaAssert(creatorMode&&narrative.count===count&&__qaWrites.length===previewWrites,'结局预览也不归档');
  if(qaShotAt('creator-workbench'))return false;
  exitStoryTheater();return true;
}
async function qaCreatorChecks(){
  const before=qaSnapshot(),countBefore=narrative.count;
  qaClick('story-entry');qaAssert(!creatorMode&&$('creator-editor').classList.contains('hidden'),'普通纯享入口不绕过密码门');exitStoryTheater();
  qaClick('creator-entry');qaAssert($('creator-gate').open,'创作者密码门可打开');if(qaShotAt('creator-gate'))return false;
  $('creator-password').value='76971584';qaClick('creator-enter');qaAssert($('creator-gate').open&&!creatorMode,'错误密码不进入编辑');
  $('creator-password').value='76971585';qaClick('creator-enter');await new Promise(resolve=>setTimeout(resolve,300));
  qaAssert(creatorMode&&mode==='intro'&&storyPhase==='theater'&&!$('creator-editor').classList.contains('hidden'),'正确密码进入创作者通道');
  const startIndex=storyIndex,audioBefore=audio.enabled;
  for(const target of [$('creator-title'),$('creator-body'),$('creator-quote'),window]){
    for(const code of ['KeyJ','KeyM','KeyP','KeyE','KeyA','KeyW','KeyS','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Enter']){
      const event=new KeyboardEvent('keydown',{code,bubbles:true,cancelable:true});target.dispatchEvent(event);
      target.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
      qaAssert(!event.defaultPrevented&&mode==='intro'&&creatorMode&&storyIndex===startIndex&&!document.querySelector('dialog[open]')&&audio.enabled===audioBefore&&qaSnapshot()===before,'创作者编辑不触发快捷键 / '+(target.id||'window')+' / '+code);
    }
  }
  qaAssert($('story-key-hint').textContent.includes('禁用游戏快捷键'),'创作者通道明确提示按钮导航');
  qaClick('intro-next');qaAssert(storyIndex===startIndex+1,'创作者仍能使用按钮翻页');qaClick('intro-prev');
  const panel=storyPanels[storyIndex],original=editorPageValues(panel),key=panel.editKey;
  const changed=original.body+'\nJ M P 空格与方向键正常用于文本。';$('creator-body').value=changed;qaClick('creator-save');
  qaAssert(editorPageValues(panel).body===changed&&CHAPTER_STORIES.prologue.opening[0].body===changed&&$('story-body').textContent===changed,'创作者保存实际同步纯享与主线分镜');
  qaClick('creator-reset');qaAssert(editorPageValues(panel).body===original.body&&CHAPTER_STORIES.prologue.opening[0].body===original.body,'创作者恢复默认同步正文');
  qaAssert(STORY_REELS.flatMap(reel=>reel.pages).every(page=>editorPageValues(page)!==null),'98 页纯享均有可编辑共享来源');
  qaClick('intermission-entry');const intermissionOriginal=INTERMISSION_PANELS[0].body;
  $('creator-body').value=intermissionOriginal+'\n幕间同步检查。';qaClick('creator-save');
  qaAssert(INTERMISSION_PANELS[0].body===$('story-body').textContent&&INTERMISSION_PANELS[0].body.includes('幕间同步检查'),'幕间编辑同步正式幕间与纯享');
  qaClick('creator-reset');qaAssert(INTERMISSION_PANELS[0].body===intermissionOriginal,'幕间文本可以恢复默认');qaClick('story-pick-prologue');
  qaAssert(__qaWrites.slice(-2).every(write=>write.key===STORY_EDIT_KEY)&&narrative.count===countBefore&&qaSnapshot()===before,'创作者编辑只写文本覆盖，不改进度与模拟');
  const creatorPanel=$('intro-panel'),preview=creatorPanel.querySelector('.intro-layout');
  preview.scrollTop=preview.scrollHeight;creatorPanel.scrollTop=creatorPanel.scrollHeight;
  const nextRect=$('intro-next').getBoundingClientRect(),panelRect=creatorPanel.getBoundingClientRect();
  qaAssert(nextRect.top>=panelRect.top&&nextRect.bottom<=panelRect.bottom,'创作者小窗口可滚动至翻页按钮');
  preview.scrollTop=0;creatorPanel.scrollTop=0;
  if(qaShotAt('creator-editor'))return false;
  qaClick('creator-exit');qaAssert(!creatorMode&&$('creator-editor').classList.contains('hidden'),'退出编辑返回普通纯享');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));qaAssert(storyIndex===startIndex+1,'退出创作者后纯享快捷键恢复');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));qaAssert(mode==='menu','普通纯享 Esc 返回菜单');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ',bubbles:true}));qaAssert($('lore-dialog').open,'退出创作者后手记快捷键恢复');
  $('lore-dialog').querySelector('.dialog-close').click();await new Promise(resolve=>setTimeout(resolve,260));
  return true;
}
async function qaMain(){
  // 测试页自己的存储隔离于正式 localhost 页面。
  narrative.unlocked.clear();narrative.session.clear();lastJournalCount=-1;refreshJournal();
  if(qaShotAt('menu-restored'))return;
  if(!await qaCreatorChecks())return;
  if(!qaReadTheater())return;
  if(!await qaWorkbenchChecks())return;
  qaClick('boss-hub-open');
  // 断言按 BOSS_CHANNELS 的实际条目数走，而不是写死「两场」——
  // 加进执炬王后写死的数字就会过期（这里已经过期过一次）。
  // ⚠️ 这段会被塞进 HTML 的模板字符串里，所以**不能用反引号**：
  // 内层反引号会提前闭合外层的模板字面量，报 SyntaxError。
  qaAssert($('boss-hub').open&&$('boss-hub').querySelectorAll('.boss-choice').length===BOSS_CHANNELS.length,
    'Boss 通道列出全部 '+BOSS_CHANNELS.length+' 场战斗');
  if(qaShotAt('boss-hub'))return;
  $('boss-hub').querySelector('.dialog-close').click();await new Promise(resolve=>setTimeout(resolve,260));
  const archiveBefore=qaSnapshot();qaClick('lore-open');qaAssert($('lore-dialog').dataset.transition==='archive'&&$('tab-world').getAttribute('aria-selected')==='true','世界档案使用解封过渡并进入世界观');
  $('lore-dialog').querySelector('.dialog-close').click();await new Promise(resolve=>setTimeout(resolve,260));qaAssert(mode==='menu'&&qaSnapshot()===archiveBefore,'档案关闭过渡不改变模拟');
  qaClick('pick-covenant');qaAssert(!/可以离开|拒绝献祭|卸任/.test($('scene-label').textContent),'选幕不提前揭示风域原契条款');
  qaClick('pick-prologue');qaClick('start');qaAssert(mode==='intro'&&storyPanels.length===4,'序章四幅开场');
  if(qaShotAt('prologue-opening'))return;
  qaClick('intro-skip');qaAssert(mode==='battle-entry','进入战斗有独立火门过渡');
  const entryBefore=qaSnapshot();qaRender();qaAssert(qaSnapshot()===entryBefore,'入场过渡不推进模拟');if(qaShotAt('entry'))return;
  qaClick('pause-button');qaAssert(mode==='paused','入场过渡可暂停');const ageBefore=entryElapsed;frame(1000);qaAssert(entryElapsed===ageBefore&&qaSnapshot()===entryBefore,'暂停入场不推进演出或模拟');qaClick('resume');qaAssert(mode==='battle-entry','继续恢复入场过渡');
  finishBattleEntry();qaAssert(mode==='arrival','序章开场跳过');qaClick('scene-skip');
  if(!await qaRunRoute())return;
  const prologueStats=qaSnapshot();qaClick('scene-skip');qaAssert(mode==='intro'&&storyPhase==='ending','序章章末分镜');
  if(qaShotAt('prologue-ending'))return;
  qaAssert(narrative.unlocked.has('p8'),'序章结尾手记');qaClick('intro-skip');
  qaAssert(mode==='won'&&qaSnapshot()===prologueStats,'章末跳过不改结算');
  qaAssert(document.activeElement===$('next-chapter'),'序章主按钮为下一章');
  qaClick('next-chapter');qaAssert(currentLevel.id==='district'&&mode==='intro','序章直接进入第一幕开场');
  qaAssert(storyPanels.length===3,'第一幕三幅开场');if(qaShotAt('opening'))return;
  qaClick('intro-skip');finishBattleEntry();qaClick('scene-skip');
  narrative.unlocked.clear();lastJournalCount=-1;refreshJournal();
  if(!await qaRunRoute())return;
  qaAssert(game.items.size===3&&game.flag.has('bridge-restored'),'三名铜片与记名桥回收');
  qaAssert(game.boss&&game.boss.phase==='defeated'&&game.boss.hits===3,'桥心三轮反击击退追索军官');
  qaAssert(qaVisits.join(',')==='healer,bell,ferry,bridge,warden','第一幕五处对白按路线触发');
  qaAssert(![...narrative.unlocked].some(id=>id.startsWith('p')),'第一幕不解锁序章手记');
  qaAssert(narrative.unlocked.has('a14'),'战前剧情揭示追索军身份');
  qaAssert(game.respawns===0,'第一幕无回档');
  qaAssert(!narrative.unlocked.has('a15'),'道路锁在正式幕末解开');
  const districtStats=qaSnapshot();qaClick('scene-skip');qaAssert(mode==='intro'&&storyPhase==='ending','第一幕三幅章末');
  qaAssert(storyPanels.length===3,'第一幕章末为三幅');
  qaAssert(narrative.unlocked.has('a13')&&!narrative.unlocked.has('b5'),'第一幕回收孩子身份，太阳真名留到幕间');
  qaAssert(narrative.unlocked.has('a15')&&$('lock-progress').textContent==='神锁 1 / 6','道路锁归档与当前行程计数一致');
  if(qaShotAt('ending'))return;
  qaClick('intro-next');qaClick('intro-next');qaClick('intro-next');
  qaAssert(mode==='won'&&qaSnapshot()===districtStats,'章末翻页不改结算');
  qaAssert($('win-title').textContent.includes('桥')&&!$('next-chapter').classList.contains('hidden'),'第一幕过桥结束，主按钮进入幕间');
  qaClick('next-chapter');qaAssert(storyPhase==='intermission'&&storyPanels.length===5,'两幕间有五幅独立剧情');if(qaShotAt('intermission'))return;
  const intermissionStats=qaSnapshot();frame(1000);qaAssert(qaSnapshot()===intermissionStats,'幕间不推进模拟');qaClick('intro-skip');
  qaAssert(mode==='won'&&qaSnapshot()===intermissionStats&&narrative.unlocked.has('b5'),'幕间跳过不改数值并回收太阳真名');
  qaClick('next-chapter');qaAssert(currentLevel.id==='covenant'&&mode==='intro'&&storyPanels.length===2,'第一幕直达第二幕两幅开场');if(qaShotAt('covenant-opening'))return;
  qaClick('intro-skip');finishBattleEntry();qaClick('scene-skip');
  if(!await qaRunRoute())return;
  qaAssert(game.health===3&&game.respawns===0&&game.boss.hits===3&&!game.boss.ward,'第二幕无护身无伤完成三域与三锁');
  qaAssert(qaVisits.slice(-4).join(',')==='c-wind,c-sea,c-harvest,c-gate','第二幕四处对白交代路线与行动');
  qaAssert($('lock-progress').textContent==='神锁 4 / 6','第二幕累计解四锁');
  const covenantStats=qaSnapshot();qaClick('scene-skip');qaAssert(storyPanels.length===2&&narrative.unlocked.has('c8'),'第二幕两幅幕末与剑痕回收');if(qaShotAt('covenant-ending'))return;
  for(let i=0;i<9;i++)qaAssert(narrative.unlocked.has('c'+i),'第二幕必要手记 / c'+i);
  qaAssert(!narrative.unlocked.has('cr0'),'可选共鸣不锁主线');
  qaClick('intro-skip');qaAssert(mode==='won'&&qaSnapshot()===covenantStats,'第二幕章末不改变机关和模拟');qaAssert(combatHints.seen.size===COVENANT_HINT_KINDS,'第二幕七类攻击与反击操作只教学一次');
  qaAssert(!$('next-chapter').classList.contains('hidden')&&document.activeElement===$('next-chapter'),'第二幕主按钮直接进入已实现的第三幕');
  qaClick('next-chapter');qaAssert(currentLevel.id==='fate'&&mode==='intro'&&storyPanels.length===2,'第二幕实际主按钮直达第三幕两幅开场');if(qaShotAt('fate-opening'))return;
  qaClick('intro-skip');finishBattleEntry();qaClick('scene-skip');
  qaAssert(!game.flag.has('f-lock')&&$('lock-progress').textContent==='神锁 4 / 6','第三幕开始只计已解四锁');
  if(!await qaRunRoute())return;
  qaAssert(game.health===3&&game.respawns===0&&game.savedPeople===3&&game.flag.has('ember-spent'),'实际 E 键穿桥与注火，第三幕无伤救三人');
  qaAssert(qaVisits.slice(-7).join(',')==='f-archive-talk,f-war-talk,f-close-talk,f-sun-talk,f-pyre-talk,f-miya-talk,f-ember-talk','第三幕逐步回收关门、弑日、焚名和弥娅去处');
  qaAssert($('lock-progress').textContent==='神锁 5 / 6'&&!narrative.unlocked.has('f10'),'命运锁归档于必经位置，幕末责任尚待收束');
  const fateStats=qaSnapshot();qaClick('scene-skip');qaAssert(mode==='intro'&&storyPanels.length===3&&narrative.unlocked.has('f10'),'第三幕三幅幕末，救人之后继续携心');if(qaShotAt('fate-ending'))return;
  qaClick('intro-next');qaClick('intro-next');qaClick('intro-next');qaAssert(mode==='won'&&qaSnapshot()===fateStats,'第三幕幕末翻页和结算保持模拟');
  for(let i=0;i<=10;i++)qaAssert(narrative.unlocked.has('f'+i),'第三幕必要手记 / f'+i);
  qaAssert(!narrative.unlocked.has('fr0')&&!$('next-chapter').classList.contains('hidden'),'共鸣不锁剧情，但第三幕之后主按钮指向已实现的第四幕');
  qaAssert($('next-chapter').textContent.includes('第四幕'),'第三幕结算的主按钮直接写第四幕');
  // 重玩/重开不能把 PointerEvent 当成关卡数据。
  qaClick('replay');finishBattleEntry();qaAssert(mode==='arrival'&&game.x===0,'第三幕可重玩');qaClick('scene-skip');qaClick('pause-button');qaClick('restart-pause');qaAssert(mode==='arrival','暂停可重开');
  qaClick('scene-skip');qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();
  qaAssert(mode==='menu','返回菜单');qaClick('pick-fate');qaAssert(currentLevel.id==='fate'&&selectedChapter===3,'第三幕也可从菜单直接选择');
  // ===== 第四幕 · 最后的神谕 =====
  qaClick('scene-skip');qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();
  qaClick('pick-dawn');qaAssert(currentLevel.id==='dawn'&&selectedChapter===4,'第四幕可从菜单直接选择');if(qaShotAt('dawn-menu'))return;
  qaClick('start');qaAssert(mode==='intro'&&storyPanels.length===2,'第四幕两幅开场');if(qaShotAt('dawn-opening'))return;
  qaClick('intro-skip');finishBattleEntry();qaClick('scene-skip');
  qaAssert($('lock-progress').textContent==='神锁 5 / 6'&&game.dawn.broken.size===0,'第四幕开始只计已解五锁，三楔未断');
  if(!await qaRunRoute())return;
  qaAssert(game.health===3&&game.respawns===0&&game.dawn.broken.size===3,'第四幕零伤跑完，三根黎明楔全部砸断');
  qaAssert($('lock-progress').textContent==='神锁 6 / 6','安眠锁解开，六锁已尽');
  qaAssert(qaVisits.slice(-6).join(',')==='w-refuge-talk,w-roster-talk,w-guard-talk,w-supply-talk,w-throne-talk,w-lock-talk','第四幕逐步回收避难所、名单、开门、王的问题与收束');
  const dawnStats=qaSnapshot();
  qaClick('scene-skip');qaAssert(mode==='intro'&&storyPanels.length===2&&narrative.unlocked.has('w7'),'第四幕两幅幕末：门可以开了，但还没有开');if(qaShotAt('dawn-ending'))return;
  qaClick('intro-next');qaClick('intro-next');qaAssert(mode==='won'&&qaSnapshot()===dawnStats,'第四幕幕末翻页和结算保持模拟');
  for(const id of ['w0','w1','w2','w3','w4','w5','w6','w7'])qaAssert(narrative.unlocked.has(id),'第四幕必要手记 / '+id);
  qaAssert(!narrative.unlocked.has('wr0'),'可选共鸣不锁主线');
  qaAssert(!$('next-chapter').classList.contains('hidden')&&$('next-chapter').textContent.includes('第五幕'),'第四幕主按钮进入已实现的终幕');
  qaClick('next-chapter');qaAssert(currentLevel.id==='finale'&&mode==='intro'&&storyPanels.length===2,'第四幕结算直连终幕开场');if(qaShotAt('finale-opening'))return;
  qaClick('intro-skip');finishBattleEntry();qaClick('scene-skip');const finalHp=game.health;
  if(!await qaRunRoute())return;
  qaAssert(mode==='choice'&&game.state==='choosing'&&!game.doorOpen&&game.health===finalHp,'到门前才显式选择，路线不偷偷开门');
  qaAssert(['throne','night','embers'].every(id=>!$('choice-'+id).disabled),'三个结局均开放，无收集门槛');
  const choiceBefore=qaSnapshot();frame(9000);qaAssert(qaSnapshot()===choiceBefore,'门前选择期间冻结模拟');if(qaShotAt('finale-choice'))return;
  qaClick('choice-throne');qaAssert(mode==='intro'&&game.state==='won'&&!game.doorOpen&&storyPanels===FINAL_ENDINGS.throne,'余晖王座不开门，进入对应结局图文');if(qaShotAt('finale-throne'))return;
  qaClick('intro-skip');qaAssert(mode==='won'&&narrative.unlocked.has('v-throne'),'余晖王座归档且可结算');
  qaClick('next-chapter');qaAssert(mode==='choice'&&!game.doorOpen&&game.finalChoice===null,'回到门前重置选择而不重跑');
  qaClick('choice-night');qaAssert(mode==='intro'&&game.doorOpen&&game.finalDuel.hits===0&&storyPanels===FINAL_ENDINGS.night,'无神长夜开门毁权柄，独立于好结局战斗');if(qaShotAt('finale-night'))return;
  qaClick('intro-skip');qaAssert(mode==='won'&&narrative.unlocked.has('v-night'),'无神长夜归档');
  qaClick('next-chapter');qaClick('choice-embers');qaAssert(mode==='running'&&game.doorOpen&&game.finalDuel.hits===0,'万家微火先开门，随后进行最终对决');
  qaAssert($('quest-label').textContent.includes('发还'),'最终战目标切换到接忆发还，不再提示门前选择');
  const duelFreeze=JSON.stringify(game.finalDuel);qaClick('pause-button');frame(10000);qaClick('resume');qaAssert(JSON.stringify(game.finalDuel)===duelFreeze,'最终战暂停冻结相位、实体、记忆球和命中次数');
  if(!await qaRunRoute())return;
  qaAssert(mode==='intro'&&game.finalDuel.hits===9&&game.health===3&&storyPanels===FINAL_ENDINGS.embers,'实际键盘接忆、松开发还，九次命中进入好结局');if(qaShotAt('finale-embers'))return;
  qaAssert(storyPanels[2].body.includes('自愿')&&storyPanels[3].body.includes('找回')&&storyPanels[6].body.includes('献祭'),'好结局按自愿交权、找回过去、献祭分权顺序呈现');
  const endingBefore=qaSnapshot();qaClick('intro-next');qaClick('intro-prev');qaAssert(qaSnapshot()===endingBefore,'结局翻页不改变数值');
  showStory(6);qaAssert($('story-art').querySelector('.ending-shot img')&&!endingFilm.hidden,'分火页使用生成插画并开放片尾短片');
  await new Promise(resolve=>{const img=$('story-art').querySelector('img');if(img.complete)resolve();else{img.onload=resolve;img.onerror=resolve;}});
  qaAssert($('story-art').querySelector('img').naturalWidth>1000,'离线分火插画成功解码');if(qaShotAt('finale-sacrifice'))return;
  qaClick('ending-film-open');
  await new Promise(resolve=>{if(filmPlayer.readyState>=2)resolve();else{filmPlayer.addEventListener('loadeddata',resolve,{once:true});setTimeout(resolve,4000);}});
  qaAssert(filmDialog.open&&filmPlayer.videoWidth===1280&&filmPlayer.videoHeight===720,'片尾短片在打包文件中成功解码');
  qaAssert(qaSnapshot()===endingBefore,'播放片尾短片不影响模拟或结局');if(qaShotAt('finale-film'))return;
  filmClose.click();
  qaAssert(filmPlayer.paused&&!filmPlayer.hasAttribute('src'),'关闭短片释放播放，保留结尾页');
  qaClick('intro-skip');qaAssert(mode==='won'&&narrative.unlocked.has('v-embers'),'好结局归档，全流程闭合');
  qaClick('replay');finishBattleEntry();qaAssert(mode==='arrival'&&game.x===0&&game.finalChoice===null,'终幕可以完整重玩');
  qaClick('scene-skip');qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();qaAssert(mode==='menu','终幕可返回菜单');
  // 纯享版：第四幕的可达证据
  qaClick('story-entry');qaClick('story-pick-dawn');
  const dawnProof=storyPanels.findIndex(p=>p.recordIds.includes('w5'));
  $('story-jump').value=String(dawnProof);$('story-jump').dispatchEvent(new Event('change',{bubbles:true}));
  // 取 w5（黎明王座对白）的第一页，正文应是王交出最后一点火的那句。
  qaAssert(theaterReel===5&&$('story-body').textContent.includes('城里的路是我铺的'),'纯享可直达第四幕的实际证据');if(qaShotAt('dawn-theater'))return;
  // 纯享的目录衔接：六个 reel 顺序遍历，页数与数据一致。
  for(let r=0;r<STORY_REELS.length;r++){
    qaClick(STORY_REELS[r].buttonId);
    qaAssert(theaterReel===r&&storyPanels===STORY_REELS[r].pages&&STORY_REELS[r].pages.length>0,'纯享顺序衔接 / '+STORY_REELS[r].id);
  }
  qaAssert(STORY_REELS.at(-1).id==='finale'&&!STORY_REELS.some(p=>p.id==='sleep'),'纯享版含已实现终幕与三个结局');
  const beforePractice=narrative.count,practiceWrites=__qaWrites.length;qaClick('boss-hub-open');qaClick('boss-entry');qaAssert(mode==='battle-entry'&&!$('boss-hub').open,'追索军官通道使用火门入场');finishBattleEntry();
  if(!await qaRunRoute())return;qaAssert(mode==='won'&&game.health===3&&game.boss.ward,'Boss 通道无伤结算且护身未消耗');qaAssert(narrative.count===beforePractice,'Boss 通道不解锁剧情');qaAssert($('lock-progress').classList.contains('hidden'),'Boss 练习不显示主线神锁');
  document.querySelector('#win-panel .return-menu').click();qaClick('boss-hub-open');qaClick('boss-covenant-entry');
  qaAssert(mode==='battle-entry'&&!$('boss-hub').open,'守门巨像从 Boss 合集进入火门');finishBattleEntry();
  qaAssert(mode==='running'&&currentLevel.id==='covenant-boss-practice'&&game.elapsed===0&&game.x>42496&&game.x<42500&&game.health===3,'巨像直接起于第一轮瞄准，不跑三域');
  qaAssert($('quest-label').textContent.includes('诱锤断三链'),'巨像练习显示当前战斗目标');
  if(!await qaRunRoute())return;
  qaAssert(mode==='won'&&game.boss.hits===3&&game.health===3&&game.respawns===0&&!game.boss.ward,'巨像通道实际键盘输入无伤断三链、越过双震');
  qaAssert($('next-chapter').classList.contains('hidden')&&$('replay').textContent.includes('守门巨像'),'巨像练习结算直接重战');
  qaAssert(narrative.count===beforePractice&&__qaWrites.length===practiceWrites&&$('lock-progress').classList.contains('hidden'),'两场练习不解锁主线、不写检查点或神锁');
  // 提示只教一次：这里断言"该教的全教了、且没有重复教学"。
  // 不写死总数（招式组变长变短都会让数字失效），改成断言语义：
  //   ① 第二幕七类全在（战斗必经过全部招式）；
  //   ② 第四幕至少覆盖三招以上（回放路线未必每招都触发，但主体招式必须教到）；
  //   ③ active 已清空（说明都收尾了，不是卡在一条提示上）。
  qaAssert(combatHints.active===null,'操作提示在练习结束后应当已收起');
  {const seen=[...combatHints.seen];
   const act2=seen.filter(k=>k.startsWith('chain-')||['low','high','fall','counter'].includes(k));
   const act4=seen.filter(k=>k.startsWith('dawn-'));
   qaAssert(act2.length===COVENANT_HINT_KINDS,'第二幕七类操作提示必须全部教过');
   qaAssert(act4.length>=4,'第四幕招式组至少要教到四种以上，否则等于没讲');
   qaAssert(new Set(seen).size===seen.length,'同一条提示不得重复记录');}
  qaClick('replay');finishBattleEntry();qaAssert(currentLevel.id==='covenant-boss-practice'&&game.elapsed===0&&game.boss.hits===0,'巨像重战直接重置第一轮');
  qaClick('pause-button');qaClick('restart-pause');qaAssert(mode==='running'&&currentLevel.bossOnly&&game.elapsed===0&&game.boss.hits===0,'巨像暂停重开保留练习通道');
  qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();
  qaClick('boss-hub-open');qaClick('boss-dawn-entry');finishBattleEntry();
  qaAssert(mode==='running'&&currentLevel.id==='dawn-boss-practice'&&game.x>4300,'执炬王练习直达楔前，不空跑入场');
  qaAssert($('touch-echo').textContent.includes('反灌星火'),'执炬王触屏动作与实际机制一致');
  if(!await qaRunRoute())return;
  qaAssert(mode==='won'&&game.health===3&&game.dawn.broken.size===3,'执炬王练习无伤三楔全断');
  qaAssert(game.x<DAWN_BOSS_PRACTICE.wedges[2].x,'最后一楔碎裂即结算，不再多跑空路');
  qaAssert(narrative.count===beforePractice&&__qaWrites.length===practiceWrites,'执炬王练习也不解锁或写入主线存档');
  qaClick('replay');finishBattleEntry();
  qaAssert(mode==='running'&&game.dawn.broken.size===0&&game.dawnEntities.length===0,'执炬王重战清空断楔与残留攻击');
  qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();qaClick('boss-hub-open');qaClick('boss-final-entry');finishBattleEntry();
  qaAssert(mode==='running'&&currentLevel.id==='final-boss-practice'&&game.x===11000,'最终对决通道直接进入真门战区');
  if(!await qaRunRoute())return;
  qaAssert(mode==='won'&&game.health===3&&game.finalDuel.hits===9,'最终决战练习无伤完成');
  qaAssert(narrative.count===beforePractice&&__qaWrites.length===practiceWrites,'最终决战练习不选择结局、不写正式存档与手记');
  qaClick('replay');finishBattleEntry();qaAssert(game.finalDuel.hits===0&&game.finalDuel.entities.length===0,'最终对决重战清理旧状态');
  qaClick('pause-button');document.querySelector('#pause-panel .return-menu').click();qaClick('pick-prologue');qaClick('start');qaAssert(mode==='intro'&&storyPanels.length===4,'序章回归');
  const out={ok:true,assertions:qaChecks.length,visits:qaVisits,errors:window.__qaErrors};
  const pre=document.createElement('pre');pre.id='chapter-verification';pre.textContent='@@CHAPTER@@'+JSON.stringify(out)+'@@ENDCHAPTER@@';document.body.append(pre);qaRender();
}
qaMain().catch(error=>{const pre=document.createElement('pre');pre.textContent='@@CHAPTER@@'+JSON.stringify({ok:false,error:error.message,stack:error.stack,visits:qaVisits,errors:window.__qaErrors})+'@@ENDCHAPTER@@';document.body.append(pre);});`;
const qaEnd=qaFixture.lastIndexOf('</script>');
const qaHtml=qaFixture.slice(0,qaEnd)+qaProbe+qaFixture.slice(qaEnd);
const qaPath=path.join(qaDir,'chapter-flow.html');writeFileSync(qaPath,qaHtml);
console.log('开发主流程校验页：'+qaPath);
if(process.argv.includes('--prepare'))process.exit(0);
const qaShotArg=process.argv.find(arg=>arg.startsWith('--shot='));
if(qaShotArg){
  const view=qaShotArg.slice(7);if(!qaShotViews.includes(view))throw Error('Unknown view');
  const qaSize=process.argv.find(arg=>arg.startsWith('--size='))?.slice(7)||'1440,900';
  if(!/^\d{3,4},\d{3,4}$/.test(qaSize))throw Error('Invalid screenshot size');
  const shotName=view.startsWith('finale-')?'chapter5-'+view.slice(7):view.startsWith('dawn-')?'chapter4-'+view.slice(5):view.startsWith('fate-')?'chapter3-'+view.slice(5):view==='menu-restored'?'menu-restored':view.startsWith('giant-')?'chapter2-'+view:['story-theater','story-elder','boss-hub','creator-gate','creator-editor'].includes(view)?view:view==='chain-practice'?'chapter2-boss-practice':view.startsWith('prologue-')?view:view.startsWith('covenant-')?'chapter2-'+view.slice(9):view==='harvest-elder'?'chapter2-harvest-elder':'chapter1-'+view;
  const shot=path.join(qaRoot,'docs/screenshots',shotName+(qaSize==='1440,900'?'':'-small')+'.png');
  const overlay=path.join(qaDir,`shot-overlay-${view}.png`);
  const canvasFile=path.join(qaDir,`shot-canvas-${view}.png`);
  // 第四幕排在整条流程的最后，走到它需要比第三幕更长的虚拟时间；
  // 预算给足了，否则截图会在到达 dawn 之前就被 dump-dom 打断。
  const chromeArgs=()=>['--headless=new','--disable-gpu','--no-first-run','--allow-file-access-from-files','--user-data-dir='+path.join(qaDir,'shot-profile'),'--virtual-time-budget=20000','--hide-scrollbars','--window-size='+qaSize];
  // 第一遍：让页面把真正的画布用 toDataURL 导出（这套 headless 里 canvas 不进合成结果）。
  const dom=runChrome([...chromeArgs(),'--dump-dom',pathToFileURL(qaPath).href+'?view='+view]);
  const canvasMatch=dom.match(/data-qa-canvas="data:image\/png;base64,([^"]+)"/);
  if(!canvasMatch){const failure=dom.match(/@@CHAPTER@@({[\s\S]*?})@@ENDCHAPTER@@/);throw Error('未取到画布导出：'+view+(failure?' / '+failure[1].slice(0,600):''));}
  writeFileSync(canvasFile,Buffer.from(canvasMatch[1],'base64'));
  // 第二遍：页面已用画布像素生成 DOM 图片，直接截图，保留 HUD 和对白。
  runChrome([...chromeArgs(),'--screenshot='+overlay,pathToFileURL(qaPath).href+'?view='+view]);
  copyFileSync(overlay,shot);
  console.log(shot);process.exit(0);
}
const qaDom=runChrome(['--headless=new','--disable-gpu','--no-first-run','--allow-file-access-from-files','--user-data-dir='+path.join(qaDir,'chapter-profile'),'--virtual-time-budget=20000','--dump-dom',pathToFileURL(qaPath).href]);
const qaMatch=qaDom.match(/@@CHAPTER@@({[\s\S]*?})@@ENDCHAPTER@@/);
if(!qaMatch){console.error('校验未结束');process.exit(1);}
const qaReport=JSON.parse(qaMatch[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
writeFileSync(path.join(qaDir,'chapter-flow-report.json'),JSON.stringify(qaReport,null,2));console.log(qaReport);
if(!qaReport.ok||qaReport.errors.length)process.exit(1);

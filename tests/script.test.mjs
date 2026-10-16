import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DISTRICT,BOSS_PRACTICE} from '../src/level-district.js';
import {COVENANT} from '../src/level-covenant.js';
import {Narrative,ALL_ENTRIES,JOURNAL_KEY} from '../src/narrative.js';
import {Encounter,DISTRICT_ENCOUNTERS} from '../src/narrative-act1.js';
import {COVENANT_ENCOUNTERS} from '../src/narrative-covenant.js';
import {CHAPTER_STORIES,INTERMISSION_PANELS,chapterStoryArt,encounterPortrait} from '../src/chapter-scenes.js';
import {STORY_PANELS} from '../src/story.js';
import {LORE} from '../src/lore.js';

test('six remaining locks belong to four distinct laws in the published acts; practice grants none',()=>{
  assert.deepEqual(DISTRICT.lockIds,['road']);assert.equal(DISTRICT.lockOffset,0);
  assert.deepEqual(COVENANT.lockIds,['wind','tides','harvest']);assert.equal(COVENANT.lockOffset,DISTRICT.lockIds.length);
  assert.equal(COVENANT.lockIds.length,COVENANT.boss.rounds);
  assert.equal(new Set([...DISTRICT.lockIds,...COVENANT.lockIds]).size,4);
  assert.equal(BOSS_PRACTICE.bossOnly,true);
  const journal=new Narrative();for(const e of DISTRICT.flags)journal.event(e.event);
  assert.ok(!journal.unlocked.has('a15'),'跑图旗标不能提前宣称道路锁已打开');
  journal.event('road-lock-open');assert.ok(journal.unlocked.has('a15'));
  assert.match(CHAPTER_STORIES.district.ending[0].body,/六道(?:锁)?中[，]?已解一道/);
  assert.match(CHAPTER_STORIES.covenant.ending[0].body,/累计解开四道/);
});

test('harvest replaces the sleep domain on the playable route, while required names and clauses survive skipping',()=>{
  assert.equal(COVENANT.scenery[2],'harvestGranary');
  assert.match(COVENANT.chapters[2].title,/丰收/);
  const journal=new Narrative(),encounter=new Encounter();
  for(const flag of COVENANT.flags){
    journal.event(flag.event);
    if(encounter.begin(flag.event))journal.unlock(encounter.finish().entry,false);
  }
  assert.ok(['c0','c6','c8'].every(id=>!journal.unlocked.has(id)),'开场与幕末须由实际场景归档');
  assert.ok(['c1','c2','c3','c4','c5','c7'].every(id=>journal.unlocked.has(id)));
  assert.match(ALL_ENTRIES.find(e=>e.id==='c1').body,/高坡吹笛/);
  assert.match(ALL_ENTRIES.find(e=>e.id==='c3').body,/摆渡者/);
  assert.match(ALL_ENTRIES.find(e=>e.id==='c5').body,/饥荒.*丰收神/);
  assert.match(ALL_ENTRIES.find(e=>e.id==='c2').body,/拒绝献祭.*卸任/);
  assert.ok(!journal.unlocked.has('cr0'));
});

test('Miya accompanies the journey and witnesses the sword, while the Sun-killer revelation waits for act three',()=>{
  assert.match(STORY_PANELS[2].body,/弥娅.*核心钥匙.*她查过.*六神.*真正死去.*烬只想先找到自己/s);
  assert.match(STORY_PANELS[2].quote,/送到门前.*找名字/);
  assert.match(CHAPTER_STORIES.covenant.ending[1].body,/弥娅.*烬答不上来/s);
  const live=JSON.stringify([STORY_PANELS,{prologue:CHAPTER_STORIES.prologue,district:CHAPTER_STORIES.district,covenant:CHAPTER_STORIES.covenant},INTERMISSION_PANELS,ALL_ENTRIES.filter(e=>!/^f/.test(e.id)),LORE.world]);
  assert.doesNotMatch(live,/弑日者|从背后刺|主动烧掉|亲手杀死太阳/);
  assert.doesNotMatch(JSON.stringify(CHAPTER_STORIES.prologue),/孩子.*就是太阳神/s);
  assert.match(CHAPTER_STORIES.district.ending[2].title,/就是太阳神/);
  assert.match(CHAPTER_STORIES.covenant.ending[0].body,/祖先.*记忆/);
});

test('new godlock scenes and Miya portraits render as local SVG without replacing the three bridge helpers',()=>{
  for(const [level,story] of Object.entries(CHAPTER_STORIES))for(const phase of ['opening','ending']){
    const arts=story[phase].map((_,i)=>chapterStoryArt(level,phase,i));
    if(level!=='finale')assert.equal(new Set(arts).size,arts.length);
    assert.ok(arts.every(s=>(s.startsWith('<svg')||s.startsWith('<div class="ending-shot"'))&&!/NaN|https:/.test(s)));
  }
  assert.match(encounterPortrait('mia'),/#e4d8b5/);
  assert.deepEqual(DISTRICT.boss.stations.map(s=>s.kind),['bell','rope','ward']);
  const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(code,/if\(currentLevel\.bossOnly\|\|currentLevel\.previewOnly\)\{configureResult\(\);setMode\('won'\);\}/);
});

test('existing journal IDs keep their read stage but use current canonical identities',()=>{
  const storage={getItem:key=>key===JOURNAL_KEY?JSON.stringify({version:2,ids:['c1','c3','c5','unknown']}):null};
  const journal=new Narrative(storage);assert.equal(journal.count,3);
  assert.ok(!journal.unlocked.has('a15')&&!journal.unlocked.has('c6'));
  assert.match(ALL_ENTRIES.find(e=>e.id==='c5').title,/宁禾/);
  assert.match(ALL_ENTRIES.find(e=>e.id==='c5').body,/丰收神/);
});

test('departure knowledge has sources and leaves lost history and original clauses for later evidence',()=>{
  const departure=JSON.stringify([STORY_PANELS,LORE.world,CHAPTER_STORIES.district.opening,CHAPTER_STORIES.covenant.opening]);
  assert.match(STORY_PANELS[1].quote,/名字.*或许/);
  assert.doesNotMatch(departure,/七个普通人|人可以拒绝献祭|神可以卸下职责|主动关门|主动焚名|弑日者/);
  assert.doesNotMatch(chapterStoryArt('covenant','opening',1),/人可拒绝献祭|神可卸下职责/);
  assert.doesNotMatch(readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),/契约写着可以离开/);
  assert.match(JSON.stringify(COVENANT_ENCOUNTERS['covenant-wind'].pages),/弥娅.*人可以拒绝献祭.*刻痕.*改抄簿/s);
  const early=new Narrative();early.advance(800,'prologue');
  assert.ok(!early.unlocked.has('c2')&&!early.unlocked.has('a13')&&!early.unlocked.has('c6'));
});

test('Jin refuses the officer after seeing tribute harm, before he knows the locked truth',()=>{
  const healer=JSON.stringify(DISTRICT_ENCOUNTERS['plate-healer'].pages);
  const warden=JSON.stringify(DISTRICT_ENCOUNTERS['quarter-warden'].pages);
  assert.match(healer,/病人.*女儿.*征收单/s);
  assert.match(warden,/粮和煤只够七夜/);
  assert.match(warden,/烬.*点起以后.*收记忆.*亲眼看看.*没查清之前/s);
  assert.match(ALL_ENTRIES.find(e=>e.id==='a14').body,/也可能有我的名字.*看清以前.*钥匙/s);
  assert.doesNotMatch(warden,/王想奴役|我就是弑日者|夺权|只有我能救/);
});

test('the harvest witness changes Jin’s reason to continue and the ending pays back that encounter',()=>{
  const pages=COVENANT_ENCOUNTERS['covenant-harvest'].pages;
  assert.ok(pages.some(p=>p.speaker==='老妇人'&&/今年还要.*缴/.test(p.text)));
  assert.ok(pages.some(p=>p.speaker==='老妇人'&&/女儿.*想不起来.*活着/s.test(p.text)));
  assert.ok(pages.some(p=>p.speaker==='烬'&&/名字的事.*还要查.*链断开/s.test(p.text)));
  assert.match(CHAPTER_STORIES.covenant.ending[0].title,/女儿扎辫子/);
  assert.match(ALL_ENTRIES.find(e=>e.id==='c8').body,/老妇人.*女儿.*这些账，停了/s);
  assert.notEqual(encounterPortrait('elder'),encounterPortrait('granary'));
  assert.doesNotMatch(encounterPortrait('elder'),/NaN|https:/);
  const record=ALL_ENTRIES.find(e=>e.id==='c5');
  const journal=new Narrative(),encounter=new Encounter();
  encounter.begin('covenant-harvest');assert.ok(!journal.unlocked.has(record.id));
  journal.unlock(encounter.finish().entry,false);assert.ok(journal.unlocked.has(record.id));
  assert.ok(!journal.unlocked.has('c6')&&!journal.unlocked.has('c8'),'略过粮仓不会先获得剑痕或幕末结果');
});

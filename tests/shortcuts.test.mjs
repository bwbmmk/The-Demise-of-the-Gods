import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/physics.js';
import {validateLevel} from '../src/level.js';
import {COVENANT,COVENANT_BOSS_PRACTICE} from '../src/level-covenant.js';
import {BOSS_CHANNELS,placeInBossArena} from '../src/boss-channels.js';
import {STORY_REELS,storyTheaterArt} from '../src/story-theater.js';
import {ALL_ENTRIES} from '../src/narrative.js';
import {COVENANT_ENCOUNTERS} from '../src/narrative-covenant.js';
import {routeInput} from './runner-input.mjs';

test('story reels cover all published necessary evidence in story order, without future acts',()=>{
  assert.deepEqual(STORY_REELS.map(r=>r.id),['prologue','district','intermission','covenant','fate','dawn','finale']);
  const ids=new Set(STORY_REELS.flatMap(r=>r.pages.flatMap(p=>p.recordIds)));
  assert.deepEqual([...ids].sort(),ALL_ENTRIES.filter(e=>!e.ring).map(e=>e.id).sort());
  const first=STORY_REELS[1].pages,second=STORY_REELS[3].pages;
  assert.ok(first.findIndex(p=>p.recordIds.includes('a3'))<first.findIndex(p=>p.recordIds.includes('a14')));
  assert.ok(first.findIndex(p=>p.recordIds.includes('a14'))<first.findIndex(p=>p.recordIds.includes('a13')));
  assert.ok(second.findIndex(p=>p.recordIds.includes('c5'))<second.findIndex(p=>p.recordIds.includes('c8')));
  assert.ok(second.findIndex(p=>p.recordIds.includes('c8'))<second.findIndex(p=>p.recordIds.includes('c6')));
  assert.doesNotMatch(JSON.stringify(STORY_REELS.slice(0,4)),/弑日者|亲手关门|从背后刺|献祭自己/);
  assert.doesNotMatch(JSON.stringify(STORY_REELS.slice(0,6)),/献祭自己|王自愿交出权柄/);
  // 第四幕的收束刚好停在"门可以开了、但还没有开"，不能越过它替第五幕回答问题。
  const dawnReel=STORY_REELS.find(r=>r.id==='dawn');
  assert.equal(dawnReel.id,'dawn');
  assert.doesNotMatch(JSON.stringify(dawnReel),/第四个结局|门开了。烬|王把权柄交/);
  assert.match(JSON.stringify(dawnReel),/门还没有开/);
});

test('story-only dialogue uses the actual published text and draws local art',()=>{
  const original=COVENANT_ENCOUNTERS['covenant-harvest'].pages;
  const copies=STORY_REELS[3].pages.filter(p=>p.kind==='dialogue'&&p.recordIds.includes('c5'));
  assert.deepEqual(copies.map(p=>[p.title,p.body,p.quote]),original.map(p=>[p.speaker,p.text,p.aside]));
  for(const r of STORY_REELS)for(const p of r.pages){const art=storyTheaterArt(p);assert.ok(art.startsWith('<svg')||art.startsWith('<div class="ending-shot"'));assert.doesNotMatch(art,/NaN|(?:src|href)="https?:\/\//);}
  assert.ok(copies.some(p=>p.portrait==='elder'));
});

test('giant practice starts in the arena and completes the actual three chains and double wave without damage',()=>{
  const level=COVENANT_BOSS_PRACTICE;
  assert.deepEqual(validateLevel(level),[]);
  // 断言要表达的是「巨像在通道里，且按钮 id 正确」，
  // 而不是「通道里总共有几个 Boss」——后者在加入执炬王后就过期了。
  // 早先写死 length===2，改一个 Boss 就得记得回来改这条测试。
  assert.ok(BOSS_CHANNELS.some(c=>c.level===level),'守门巨像不在 Boss 通道里');
  assert.equal(level.boss,COVENANT.boss);assert.equal(level.brake,true);assert.equal(level.bossOnly,true);
  const g=placeInBossArena(new Runner(level)),events=[],input={handled:new Set(),doubleAt:null};
  assert.equal(g.elapsed,0);assert.equal(g.health,3);assert.ok(g.x>42500-4&&g.x<42500);
  assert.deepEqual(level.flags,[]);assert.deepEqual(level.obstacles,[]);
  for(let i=0;i<120*60&&g.state==='running';i++){routeInput(g,input);g.update(1/120);events.push(...g.drainEvents());}
  assert.equal(g.state,'won');assert.equal(g.health,3);assert.equal(g.respawns,0);assert.equal(g.boss.hits,3);assert.equal(g.boss.ward,false);
  assert.ok(g.elapsed<30);assert.equal(events.filter(e=>e.type==='chain-impact'&&e.connected).length,3);
  assert.ok(!events.some(e=>e.type==='flag'||e.type==='item'||e.type==='hit'||e.event==='covenant-complete'));
});

test('giant retry restarts targeting immediately and cannot bank prior chains',()=>{
  const g=placeInBossArena(new Runner(COVENANT_BOSS_PRACTICE));g.update(1/120);g.boss.hits=2;
  g.restoreCheckpoint(true);assert.equal(g.boss.hits,0);assert.equal(g.health,3);
  g.update(1/120);assert.ok(g.inBossFight);assert.equal(g.collected.size,0);assert.equal(g.flag.size,0);
});

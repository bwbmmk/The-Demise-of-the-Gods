import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runnerPose} from '../src/animation.js';
import {SCORE,scoreEvents,scoreSample,noteHz,SCORE_SECTIONS,sectionFor,voiceFor} from '../src/music.js';
import {STORY_PANELS,storyArt} from '../src/story.js';

test('slide body remains below hanging-beam clearance; animated joints stay finite',()=>{
  for(let t=0;t<2;t+=1/144)for(const p of [{grounded:true,slideTime:.5},{grounded:true,slideTime:0},{grounded:false,slideTime:0,vy:-400,airSpin:.3}]) {
    const pose=runnerPose(p,t);for(const key of ['head','hips','chest','hand','footA','footB'])assert.ok(pose[key].every(Number.isFinite));
    if(p.slideTime>0){assert.ok(pose.head[1]-12>=-43);assert.ok(pose.hand[1]>-43);}
  }
});
test('score loops at a complete 16-bar phrase; contains melody, harmony and percussion',()=>{
  const events=scoreEvents();assert.equal(SCORE.beats,64);assert.ok(events.length>180);
  assert.deepEqual(new Set(events.map(e=>e.voice)),new Set(['pad','pluck','drum','bell','lead']));
  assert.ok(events.every((e,i)=>e.beat>=0&&e.beat<64&&e.duration>0&&(!i||e.beat>=events[i-1].beat)));
  for(const event of events)assert.ok(Number.isFinite(scoreSample(event.voice,noteHz(event.note),.2,event.duration)));
});
test('the same theme changes colour per chapter instead of playing one flat loop all game',()=>{
  // 用户原话：「音乐的转换……都要无比的丰富才是」。
  // 旧版全游戏共用一条固定谱，四个幕、每一幕四个章节听起来完全一样——
  // 那不是"主题贯穿"，是**没有转换**。这一版给同一首主题叠四层演奏法：
  // 起（只有 pad+pluck）→ 行（加鼓）→ 迫（加钟）→ 决（全声部）。
  // 这条测试锁住"声部密度单调递增"与"首段确实最干净"两件事。
  assert.equal(SCORE_SECTIONS.length,4,'应当有四段演奏法（对应四个章节）');
  const events=scoreEvents();
  const voicesIn=i=>new Set(events.filter(e=>voiceFor(e,i)).map(e=>e.voice));

  // ① 起段必须**没有**鼓与钟：那是最干净的一段。
  assert.ok(!voicesIn(0).has('drum'),'起段不该有鼓');
  assert.ok(!voicesIn(0).has('bell'),'起段不该有钟');
  assert.ok(!voicesIn(0).has('lead'),'起段不该有主旋律');
  assert.ok(voicesIn(0).has('pad')&&voicesIn(0).has('pluck'),'起段应有弦垫与拨奏');

  // ② 声部数量必须逐段不减（单调递增），最后一段是全声部。
  const counts=[0,1,2,3].map(i=>voicesIn(i).size);
  for(let i=1;i<counts.length;i++)assert.ok(counts[i]>=counts[i-1],`第 ${i+1} 段的声部不能比上一段少（${counts.join('/')}）`);
  assert.equal(counts[0],2,'起段应恰好 2 个声部');
  assert.equal(counts[3],5,'决段应齐五个声部（pad/pluck/drum/bell/lead）');

  // ③ 同一份谱面在不同段落要产出不同的实际增益（否则"换段"是假的）。
  const probe=events.find(e=>e.voice==='drum');
  const g=voiceFor(probe,3).gain;
  assert.ok(voiceFor(probe,0)===null,'起段的鼓必须完全不发声');
  assert.ok(g>probe.gain,'决段的鼓要比谱面基准更响');

  // ④ 段落索引要能夹住越界输入，不能返回 undefined。
  assert.equal(sectionFor(99).name,SCORE_SECTIONS[3].name);
  assert.equal(sectionFor(-5).name,SCORE_SECTIONS[0].name);
});
test('four different local illustrations accompany complete story panels',()=>{
  assert.equal(STORY_PANELS.length,4);const illustrations=STORY_PANELS.map((p,i)=>{assert.ok(p.title&&p.body&&p.quote);return storyArt(i);});
  assert.equal(new Set(illustrations).size,4);assert.ok(illustrations.every(svg=>svg.startsWith('<svg')&&!svg.includes('https://')&&!svg.includes('seventy')));
});
test('exported soundtrack is non-silent PCM with headroom',()=>{
  const wav=readFileSync(new URL('../assets/music/ember-requiem.wav',import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt32LE(24),22050);let peak=0,sum=0;for(let i=44;i<wav.length;i+=2){const sample=wav.readInt16LE(i);peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
  assert.ok(peak>20000&&peak<30000);assert.ok(Math.sqrt(sum/((wav.length-44)/2))>500);
});

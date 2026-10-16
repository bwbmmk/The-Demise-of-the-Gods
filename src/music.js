// 原创主题《葬火》：D 小调，84 BPM，16 小节循环。
//
// ⚠️ 第二版补：**声部密度随章节递进**（起因是用户原话"音乐的转换"）。
//
// 旧版全游戏共用一条固定的 16 小节谱，四个幕、每一幕的四个章节听起来
// 一模一样——玩家跑到第四幕的最后一楔，听到的还是序章第一秒那首曲子。
// 这不是"一首主题曲贯穿始终"的艺术选择，是**没有转换**。
//
// 这一版给同一首主题加了四层**演奏法**（不是换曲子：主题必须认得出来）：
//   section 0（起）：只有 pad + pluck。像有人在很远的地方哼。
//   section 1（行）：加 drum，pluck 起来。开始赶路。
//   section 2（迫）：加 bell，drum 加密。追兵上来了。
//   section 3（决）：lead 进来、全声部满。这是"最后一楔"。
// 于是同一首《葬火》在四段里有四种"脸色"，而旋律走向始终一致——
// 玩家听得出"到哪一段了"，但不会觉得换了首歌。
export const SCORE = {title:'葬火 · Ember Requiem', bpm:84, beats:64};

// 每一层的声部开关与增益倍率。index = 章节号（0..3），超出即取最后一段。
export const SCORE_SECTIONS = [
  {name:'起 · 远处有人哼', voices:{pad:1,pluck:.7,drum:0,bell:0,lead:0}, gain:1},
  {name:'行 · 开始赶路',   voices:{pad:1,pluck:1,drum:1,bell:0,lead:0}, gain:1.05},
  {name:'迫 · 他追上来了', voices:{pad:1,pluck:1,drum:1,bell:1,lead:0}, gain:1.12},
  {name:'决 · 最后一楔',   voices:{pad:1,pluck:1.1,drum:1.1,bell:1,lead:1}, gain:1.2},
];

export function sectionFor(index) {
  const i = Math.max(0, Math.min(SCORE_SECTIONS.length - 1, Math.floor(index) || 0));
  return SCORE_SECTIONS[i];
}

export const noteHz = midi => 440 * 2 ** ((midi - 69) / 12);

export function scoreEvents() {
  const events = [], chords = [[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61]];
  const melody = [[74,2],[77,1],[76,1],[69,3],[72,1],[74,4],[0,4],[77,2],[79,1],[77,1],[74,3],[72,1],[69,4],[0,4],[74,2],[81,2],[79,2],[77,2],[76,3],[74,1],[72,4],[69,2],[73,2],[76,2],[73,2],[74,6],[0,2]];
  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[Math.floor(bar / 2) % 4], beat = bar * 4;
    if (bar % 2 === 0) for (const note of chord) events.push({beat, duration:8.5, note, voice:'pad', gain:.035});
    for (let n = 0; n < 8; n++) events.push({beat:beat + n * .5, duration:.9, note:chord[[0,1,2,1,3,1,2,1][n]] + 12, voice:'pluck', gain:.085, layer:1});
    events.push({beat, duration:1.4, note:chord[0] - 12, voice:'drum', gain:.16, layer:1});
    events.push({beat:beat + 2.5, duration:.8, note:chord[0] - 12, voice:'drum', gain:.10, layer:2});
    if (bar % 4 === 0) events.push({beat, duration:5, note:chord[2] + 12, voice:'bell', gain:.10});
  }
  let cursor = 0;
  for (const [note, duration] of melody) {
    if (note) events.push({beat:cursor, duration:duration * .9, note, voice:'lead', gain:.115});
    cursor += duration;
  }
  return events.sort((a, b) => a.beat - b.beat);
}

/**
 * 把一个谱面事件按**当前章节**折算成实际要发声的次数/增益。
 * 返回 null 表示这一层在章节里完全不发声（例如起段的鼓）。
 *
 * 这是"转换"的核心：调度器不再关心章节，只管把事件喂进来，
 * 由这里决定"鼓这一段到底敲不敲"。
 */
export function voiceFor(event, sectionIndex) {
  const section = sectionFor(sectionIndex);
  const level = section.voices[event.voice] ?? 1;
  if (level <= 0) return null;
  return {gain: event.gain * level * section.gain, voice: event.voice};
}

export function scoreSample(voice, frequency, time, duration) {
  const phase = 2 * Math.PI * frequency * time;
  if (voice === 'drum') return Math.sin(phase * (.58 + .55 * Math.exp(-time * 15))) * Math.exp(-time * 5.3) * Math.min(1, time * 100);
  if (voice === 'bell') return (Math.sin(phase) + .33 * Math.sin(phase * 2.756) * Math.exp(-time * 2) + .12 * Math.sin(phase * 5.4)) * Math.exp(-time * 1.25) * Math.min(1, time * 90);
  if (voice === 'pluck') return (Math.sin(phase) + .3 * Math.sin(phase * 2)) * Math.exp(-time * 5) * Math.min(1, time * 90);
  const attack = Math.min(1, time / (voice === 'pad' ? .8 : .12)), release = Math.min(1, (duration - time) / (voice === 'pad' ? 1.3 : .45));
  const vibrato = Math.sin(time * 4.3) * .012;
  return (Math.sin(phase + vibrato) + .2 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3)) * attack * Math.max(0, release) * (voice === 'pad' ? .7 : 1);
}

export function finalScoreEvents(stage=0,ending=false){
  const events=[],chords=ending?[[50,57,62,66],[55,62,67,71],[47,54,59,62],[50,57,62,66]]:[[38,45,50,53],[34,41,46,50],[36,43,48,51],[33,40,45,49]];
  const motif=ending?[74,78,81,78,76,74,69,74]:[62,65,69,68,62,60,57,61];
  for(let bar=0;bar<16;bar++){
    const chord=chords[Math.floor(bar/2)%4],beat=bar*4;
    if(bar%2===0)for(const note of chord)events.push({beat,note,duration:8.3,voice:'pad',gain:ending?.045:.05});
    events.push({beat,note:motif[bar%8],duration:3.5,voice:'lead',gain:ending?.09:.11});
    if(!ending)for(let k=0;k<2+stage*2;k++)events.push({beat:beat+k*4/(2+stage*2),note:chord[0]-12,duration:.45,voice:'drum',gain:k===0?.18:.09});
    for(let k=0;k<4;k++)events.push({beat:beat+k,note:chord[k]+24,duration:1.3,voice:'pluck',gain:ending?.04:.05});
    if(bar%4===0)events.push({beat,note:chord[2]+24,duration:5,voice:'bell',gain:.06});
  }
  return events.sort((a,b)=>a.beat-b.beat);
}

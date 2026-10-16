// 《神之殇》扩展曲库 · 原创合成音源包
// 与 src/music.js 同一技术路线：纯函数乐谱 + 实时合成 + 离线 WAV 渲染。
// 全部为原创乐谱，不含任何第三方采样或外部音频资源。
//
// 调性体系：D 小调为骨，各章按神域情绪转调。
//   I   灰烬之城   D 自然小调     空虚、行走
//   II  风神之肺   A 多利亚       呼吸、上升
//   III 海神之血   D 和声小调     庄严、压迫
//   IV  安眠神之眼 D 小调 + 大七度 朦胧、不闭合
//   V   坠日王庭   D 弗里吉亚     炽热、审判
//   VI  无名之门   D 利底亚       黎明、开放

export const noteHz = midi => 440 * 2 ** ((midi - 69) / 12);

/* ------------------------------------------------------------------ *
 * 通用乐谱助手
 * ------------------------------------------------------------------ */

/** 小节序列 → 铺底和声（pad）。每 step 拍换一次和弦。 */
function padTrack(bars, { step = 8, gain = 0.04, duration = 8.5 } = {}) {
  const events = [];
  bars.forEach((chord, bar) => {
    if (bar % Math.max(1, Math.round(step / 4)) !== 0) return;
    for (const note of chord) events.push({ beat: bar * 4, duration, note, voice: 'pad', gain });
  });
  return events;
}

/** 分解和弦：每 half 拍一次，按 pattern 的索引取和弦音，向上八度。 */
function pluckTrack(bars, { pattern = [0, 1, 2, 1, 3, 1, 2, 1], gain = 0.05, layer = 1, octave = 12 } = {}) {
  const events = [];
  bars.forEach((chord, bar) => {
    for (let n = 0; n < pattern.length; n++) {
      events.push({ beat: bar * 4 + n * (4 / pattern.length), duration: 0.9, note: chord[pattern[n] % chord.length] + octave, voice: 'pluck', gain, layer });
    }
  });
  return events;
}

/** 低鼓 + 后半拍弱击。 */
function drumTrack(bars, { root = 0, gain = 0.26, layer = 1, extra = 0.13 } = {}) {
  const events = [];
  bars.forEach((chord, bar) => {
    const note = (chord[0] ?? root) - 12;
    events.push({ beat: bar * 4, duration: 1.4, note, voice: 'drum', gain, layer });
    events.push({ beat: bar * 4 + 2.5, duration: 0.8, note, voice: 'drum', gain: extra, layer });
  });
  return events;
}

/** 钟声：每 every 小节一次，取三音，向上八度。 */
function bellTrack(bars, { every = 4, gain = 0.1, octave = 12, offset = 0 } = {}) {
  const events = [];
  bars.forEach((chord, bar) => {
    if (bar % every !== 0) return;
    events.push({ beat: bar * 4 + offset, duration: 5, note: chord[2 % chord.length] + octave, voice: 'bell', gain });
  });
  return events;
}

/** [音高, 时值] 序列 → 主旋律音轨；和弦序号从 0 开始连续累加。 */
function leadTrack(melody, { gain = 0.085, voice = 'lead', offset = 0 } = {}) {
  const events = [];
  let cursor = offset;
  for (const [note, duration] of melody) {
    if (note) events.push({ beat: cursor, duration: duration * 0.9, note, voice, gain });
    cursor += duration;
  }
  return events;
}

const byBeat = (a, b) => a.beat - b.beat;
const build = (...tracks) => tracks.flat().sort(byBeat);

/* ------------------------------------------------------------------ *
 * 1. 弥娅 · 抄名人之歌（D 大调，56 BPM，8 小节，竖琴）
 *    用途：旅途手记、真名铜片收集、人物对话、章节选择
 * ------------------------------------------------------------------ */
const harpsichordBars = [[50, 57, 62, 66], [45, 52, 57, 61], [48, 55, 60, 64], [43, 50, 57, 62]];

export function harpsichordScore() {
  const bars = [...harpsichordBars, ...harpsichordBars];
  return build(
    padTrack(bars, { step: 4, gain: 0.032, duration: 4.4 }),
    pluckTrack(bars, { pattern: [0, 1, 2, 3, 2, 1], gain: 0.052 }),
    bellTrack(bars, { every: 4, gain: 0.06, octave: 24 }),
    leadTrack(
      [[81, 3], [79, 1], [77, 2], [76, 2], [74, 4], [0, 2], [76, 2],
       [77, 3], [79, 1], [81, 4], [79, 2], [77, 2], [76, 4], [74, 2], [72, 2]],
      { gain: 0.075 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 2. 风神之肺（A 多利亚，80 BPM，12 小节，风声）
 *    用途：上升气流段、悬空钟楼、风印腾跃
 * ------------------------------------------------------------------ */
const windBars = [[45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [45, 52, 57, 60]];
const windProgression = [...windBars, ...windBars, ...windBars];

export function windScore() {
  const whisper = [];
  windProgression.forEach((chord, bar) => {
    for (let n = 0; n < 4; n++) whisper.push({ beat: bar * 4 + n * 0.75, duration: 1.6, note: chord[n % chord.length] + 12, voice: 'whisper', gain: 0.03, layer: 1 });
  });
  return build(
    padTrack(windProgression, { step: 4, gain: 0.042, duration: 4.6 }),
    pluckTrack(windProgression, { pattern: [0, 2, 1, 3, 2, 0, 3, 1], gain: 0.045, layer: 1, octave: 24 }),
    whisper,
    drumTrack(windProgression, { gain: 0.18, layer: 1, extra: 0 }),
    bellTrack(windProgression, { every: 4, gain: 0.115, octave: 24, offset: 2 }),
    leadTrack(
      [[69, 2], [72, 2], [74, 1], [76, 1], [74, 2], [72, 2], [76, 4],
       [0, 4], [77, 2], [76, 2], [74, 1], [72, 1], [74, 2], [71, 2], [69, 4],
       [0, 2], [74, 2], [76, 2], [79, 2], [81, 4], [79, 2], [77, 2],
       [76, 3], [74, 1], [76, 2], [74, 2], [72, 4], [69, 3], [71, 1]],
      { gain: 0.078 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 3. 海神之血（D 和声小调，66 BPM，12 小节，涨潮）
 *    用途：潮汐台阶、水位迫近、圣堂倒影
 * ------------------------------------------------------------------ */
const tideBars = [[50, 57, 62, 65], [46, 53, 58, 62], [47, 52, 58, 61], [48, 55, 61, 64]];
const tideProgression = [...tideBars, ...tideBars, ...tideBars];

export function tideScore() {
  const wash = [];
  tideProgression.forEach((chord, bar) => {
    for (let n = 0; n < 2; n++) wash.push({ beat: bar * 4 + n * 2 + 1, duration: 3.2, note: chord[3] + 12, voice: 'wash', gain: 0.035, layer: 2 });
  });
  return build(
    padTrack(tideProgression, { step: 8, gain: 0.046, duration: 9.6 }),
    pluckTrack(tideProgression, { pattern: [0, 1, 3, 2, 1, 3], gain: 0.04, layer: 1, octave: 12 }),
    wash,
    drumTrack(tideProgression, { gain: 0.3, layer: 1, extra: 0.16 }),
    bellTrack(tideProgression, { every: 6, gain: 0.09, octave: 12 }),
    leadTrack(
      [[74, 2], [76, 1], [77, 1], [79, 3], [78, 1], [76, 4],
       [0, 3], [74, 1], [76, 2], [74, 2], [70, 4], [0, 4],
       [79, 2], [81, 2], [83, 1], [81, 1], [79, 2], [77, 2], [76, 4], [0, 4],
       [74, 3], [72, 1], [74, 2], [76, 2], [74, 6], [0, 2]],
      { gain: 0.082 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 4. 安眠神之眼（D 小调 + 大七度，58 BPM，10 小节，摇篮歌）
 *    用途：睡眠裂缝、平台明灭、被献祭者的梦
 *    刻意保持未解决的和声，让结尾悬在半空
 * ------------------------------------------------------------------ */
const sleepBars = [[50, 57, 61, 65], [48, 55, 59, 64], [46, 53, 57, 62], [45, 52, 56, 61], [50, 57, 60, 63], [48, 55, 59, 63]];
const sleepProgression = sleepBars;

export function sleepScore() {
  const breathing = [];
  sleepProgression.forEach((chord, bar) => {
    for (let n = 0; n < 2; n++) breathing.push({ beat: bar * 4 + n * 3, duration: 3.6, note: chord[1], voice: 'breath', gain: 0.03, layer: 1 });
  });
  return build(
    padTrack(sleepProgression, { step: 4, gain: 0.05, duration: 4.8 }),
    pluckTrack(sleepProgression, { pattern: [0, 2, 3, 2], gain: 0.035, layer: 2, octave: 24 }),
    breathing,
    bellTrack(sleepProgression, { every: 2, gain: 0.075, octave: 12, offset: 3 }),
    leadTrack(
      [[74, 4], [72, 4], [69, 6], [0, 2], [72, 4], [71, 4], [69, 8],
       [0, 4], [67, 4], [69, 4], [72, 2], [74, 2], [72, 6], [0, 2]],
      { gain: 0.07 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 5. 坠日王庭（D 弗里吉亚，88 BPM，12 小节，行军团）
 *    用途：执炬王追索、巨神脚步、逐夜倒计时
 * ------------------------------------------------------------------ */
const throneBars = [[50, 57, 62, 65], [49, 56, 61, 64], [48, 55, 60, 63], [50, 57, 62, 65]];
const throneProgression = [...throneBars, ...throneBars, ...throneBars];

export function marchScore() {
  const stabs = [];
  throneProgression.forEach((chord, bar) => {
    const hits = [1, 1.75, 2.5, 3.25];
    for (const at of hits) stabs.push({ beat: bar * 4 + at, duration: 0.55, note: chord[0] - 12, voice: 'stab', gain: 0.05, layer: 2 });
  });
  return build(
    padTrack(throneProgression, { step: 4, gain: 0.038, duration: 4.4 }),
    pluckTrack(throneProgression, { pattern: [0, 2, 1, 3], gain: 0.032, layer: 2, octave: 12 }),
    stabs,
    drumTrack(throneProgression, { gain: 0.34, layer: 1, extra: 0.2 }),
    leadTrack(
      [[74, 1], [75, 1], [76, 2], [74, 2], [73, 2], [74, 3], [71, 1], [74, 4],
       [0, 2], [76, 2], [75, 2], [74, 2], [72, 4], [0, 4],
       [79, 2], [76, 2], [74, 1], [73, 1], [74, 2], [76, 2], [78, 4], [0, 4],
       [74, 2], [73, 1], [72, 1], [74, 6], [0, 2]],
      { gain: 0.088 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 6. 无名之门 · 万家微火（D 利底亚，64 BPM，12 小节）
 *    用途：终点、分火结局、人间第一盏火
 * ------------------------------------------------------------------ */
const gateBars = [[50, 57, 61, 66], [43, 50, 54, 61], [47, 54, 59, 62], [45, 52, 56, 61], [48, 55, 59, 64], [50, 57, 61, 66]];
const gateProgression = [...gateBars, ...gateBars];

export function verdictScore() {
  const answer = [];
  gateProgression.forEach((chord, bar) => {
    for (let n = 0; n < 2; n++) answer.push({ beat: bar * 4 + n * 2 + 1, duration: 3, note: chord[2] + 12, voice: 'answer', gain: 0.028, layer: 1 });
  });
  return build(
    padTrack(gateProgression, { step: 4, gain: 0.05, duration: 4.8 }),
    pluckTrack(gateProgression, { pattern: [0, 1, 2, 3, 2, 1], gain: 0.045, layer: 1, octave: 12 }),
    answer,
    bellTrack(gateProgression, { every: 3, gain: 0.12, octave: 12 }),
    leadTrack(
      [[74, 2], [76, 2], [78, 2], [81, 6], [79, 2], [78, 2], [76, 4],
       [0, 2], [74, 2], [76, 2], [74, 2], [71, 4], [69, 4],
       [74, 3], [76, 1], [78, 2], [81, 2], [83, 4], [81, 4],
       [79, 2], [78, 2], [76, 2], [74, 2], [74, 8]],
      { gain: 0.085 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 7. 安魂 · 送葬（D 小调，52 BPM，12 小节，人声与钟）
 *    用途：死亡结算、剧情独白、片尾
 * ------------------------------------------------------------------ */
const requiemBars = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]];
const requiemProgression = [...requiemBars, ...requiemBars, ...requiemBars];

export function requiemScore() {
  const toll = [];
  requiemProgression.forEach((chord, bar) => {
    if (bar % 6 !== 0) return;
    toll.push({ beat: bar * 4, duration: 6, note: chord[0] + 12, voice: 'toll', gain: 0.14 });
  });
  return build(
    padTrack(requiemProgression, { step: 4, gain: 0.055, duration: 6.5, noteShift: 0 }),
    toll,
    drumTrack(requiemProgression.filter((_, i) => i % 2 === 0), { gain: 0.22, layer: 1, extra: 0.1 }),
    leadTrack(
      [[74, 4], [72, 4], [69, 4], [0, 2], [72, 2],
       [74, 4], [76, 4], [74, 8],
       [72, 2], [74, 2], [72, 2], [69, 2], [67, 4], [69, 4],
       [74, 4], [72, 3], [69, 1], [66, 8]],
      { gain: 0.075 },
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 8. 短动机 → 派生成品（胜、败、共鸣、章节切换）
 * ------------------------------------------------------------------ */
const MOTIF = [[74, 2], [77, 1], [76, 1], [72, 4]];

/** motif 可移调、可变速率地重写：rate 为时值倍率。 */
function motifAt(transpose, rate = 1) {
  return MOTIF.map(([note, duration]) => [note + transpose, duration * rate]);
}

export function stingerScore(kind) {
  if (kind === 'victory') return leadTrack([...motifAt(0), [61, 8]], { gain: 0.11, voice: 'lead' })
    .concat(leadTrack([[50, 16], [62, 16]], { gain: 0.05, voice: 'pad' }));
  if (kind === 'defeat') return leadTrack(motifAt(-3, 1.6), { gain: 0.09, voice: 'lead' })
    .concat(leadTrack([[46, 24]], { gain: 0.06, voice: 'pad' }));
  if (kind === 'resonance') return leadTrack(motifAt(12), { gain: 0.085, voice: 'bell' })
    .concat(leadTrack([[62, 16]], { gain: 0.045, voice: 'pad' }));
  return leadTrack(motifAt(0, 0.5), { gain: 0.08, voice: 'lead' });
}

export const STINGER_BPM = { victory: 84, defeat: 50, resonance: 96, transition: 120 };

/* ------------------------------------------------------------------ *
 * 音色合成：与现有 scoreSample 同结构的纯函数
 * 新增 voice：whisper / wash / breath / stab / toll / ember / glass
 * ------------------------------------------------------------------ */
export function packSample(voice, frequency, time, duration) {
  const phase = 2 * Math.PI * frequency * time;
  const env = (attack, release) => Math.min(1, time / attack) * Math.max(0, Math.min(1, (duration - time) / release));

  if (voice === 'drum') return Math.sin(phase * (0.58 + 0.55 * Math.exp(-time * 15))) * Math.exp(-time * 5.3) * Math.min(1, time * 100);
  if (voice === 'bell') return (Math.sin(phase) + 0.33 * Math.sin(phase * 2.756) * Math.exp(-time * 2) + 0.12 * Math.sin(phase * 5.4)) * Math.exp(-time * 1.25) * Math.min(1, time * 90);
  if (voice === 'pluck') return (Math.sin(phase) + 0.3 * Math.sin(phase * 2)) * Math.exp(-time * 5) * Math.min(1, time * 90);

  // 风：带缓慢相位漂移的窄带噪声感（用高频内调制的三角波近似）
  if (voice === 'whisper') return (Math.sin(phase + Math.sin(time * 1.7) * 1.4) + 0.4 * Math.sin(phase * 2.01)) * env(0.9, 1.1) * 0.7;
  // 潮水：低频涌起后缓慢退去
  if (voice === 'wash') return (Math.sin(phase) + 0.25 * Math.sin(phase * 1.5)) * env(1.2, 1.4) * 0.8;
  // 呼吸：极缓的起落，带轻微颤音
  if (voice === 'breath') return (Math.sin(phase + Math.sin(time * 0.9) * 0.6) + 0.18 * Math.sin(phase * 3)) * env(1.5, 1.6) * 0.7;
  // 军团短促推进音：快起快落，带二次谐波
  if (voice === 'stab') return (Math.sin(phase) + 0.5 * Math.sin(phase * 2) + 0.2 * Math.sin(phase * 3)) * Math.exp(-time * 9) * Math.min(1, time * 200);
  // 丧钟：极低频、长衰减、多分音
  if (voice === 'toll') return (Math.sin(phase) + 0.42 * Math.sin(phase * 2.02) + 0.2 * Math.sin(phase * 3.01) + 0.09 * Math.sin(phase * 4.17)) * Math.exp(-time * 0.7) * Math.min(1, time * 60);
  // 余火：带轻微失谐的暖音，用于共鸣/收集强化
  if (voice === 'ember') return (Math.sin(phase) + 0.22 * Math.sin(phase * 2.003) * Math.exp(-time * 1.2) + 0.1 * Math.sin(phase * 3.001)) * env(0.05, 0.5);
  // 玻璃/铜片：高次分音密集、脆而短
  if (voice === 'glass') return (Math.sin(phase) + 0.36 * Math.sin(phase * 3.47) + 0.19 * Math.sin(phase * 5.91)) * Math.exp(-time * 6) * Math.min(1, time * 160);

  const attack = Math.min(1, time / (voice === 'pad' ? 0.8 : 0.12));
  const release = Math.min(1, (duration - time) / (voice === 'pad' ? 1.3 : 0.45));
  const vibrato = Math.sin(time * 4.3) * 0.012;
  return (Math.sin(phase + vibrato) + 0.2 * Math.sin(phase * 2) + 0.09 * Math.sin(phase * 3)) * attack * Math.max(0, release) * (voice === 'pad' ? 0.7 : 1);
}

/* ------------------------------------------------------------------ *
 * 曲库索引
 * ------------------------------------------------------------------ */
export const TRACKS = [
  {
    id: 'mia-harpsichord', title: '抄名人之歌', english: 'The Namekeeper',
    file: 'mia-harpsichord.wav', bpm: 56, key: 'D 大调', minutes: '约 2:18',
    use: '手记、真名铜片、人物对话、章节选择',
    mood: '克制的温暖；唯一一支不靠低音压迫的曲子', score: harpsichordScore,
  },
  {
    id: 'wind-lung', title: '风神之肺', english: 'The Lung of Wind',
    file: 'wind-lung.wav', bpm: 80, key: 'A 多利亚', minutes: '约 1:12',
    use: '上升气流、悬空钟楼、风印腾跃',
    mood: '呼吸与失衡；每次托举都伴随未落地的空虚', score: windScore,
  },
  {
    id: 'tide-blood', title: '海神之血', english: 'The Blood Tide',
    file: 'tide-blood.wav', bpm: 66, key: 'D 和声小调', minutes: '约 1:27',
    use: '涨潮台阶、水位迫近、倒置圣堂',
    mood: '庄严的淹没感；"祝福"也会淹死不服从者', score: tideScore,
  },
  {
    id: 'sleep-eye', title: '安眠神之眼', english: 'The Unwaking Eye',
    file: 'sleep-eye.wav', bpm: 58, key: 'D 小调 · 大七度', minutes: '约 1:23',
    use: '睡梦裂缝、明灭平台、被献祭者的梦',
    mood: '永恒悬置；和声故意不解决，像没有醒来的人', score: sleepScore,
  },
  {
    id: 'throne-march', title: '坠日王庭', english: 'March of the Torchbearer',
    file: 'throne-march.wav', bpm: 88, key: 'D 弗里吉亚', minutes: '约 1:05',
    use: '追索军团、巨神脚步、七夜倒计时',
    mood: '推进与审判；第一音就带威胁的降二度', score: marchScore,
  },
  {
    id: 'nameless-gate', title: '无名之门', english: 'The Nameless Gate',
    file: 'nameless-gate.wav', bpm: 64, key: 'D 利底亚', minutes: '约 1:30',
    use: '终点、分火结局、人间第一盏火',
    mood: '开放的黎明；利底亚升四度给出"可以往外走"的暗示', score: verdictScore,
  },
  {
    id: 'requiem-rite', title: '安魂 · 送葬', english: 'Rite of the Bearer',
    file: 'requiem-rite.wav', bpm: 52, key: 'D 小调', minutes: '约 1:50',
    use: '死亡结算、独白、片尾送葬',
    mood: '不是悲恸而是克制；丧钟每六小节一次', score: requiemScore,
  },
];

/** 短动机索引：一次性结果音，不循环，走独立总线。 */
export const STINGERS = [
  { id: 'victory', kind: 'victory', file: 'sting-victory.wav', title: '结局 · 一粒火种归入掌心', use: '通关、解锁结局' },
  { id: 'defeat', kind: 'defeat', file: 'sting-defeat.wav', title: '失败 · 余火散入灰烬', use: '死亡结算' },
  { id: 'resonance', kind: 'resonance', file: 'sting-resonance.wav', title: '共鸣 · 有人在念你的名字', use: '共鸣环、真名获取' },
  { id: 'transition', kind: 'transition', file: 'sting-transition.wav', title: '转入 · 章末低鸣', use: '章节切换、进入新神域' },
];

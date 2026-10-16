import { SCORE, scoreEvents, noteHz, voiceFor, sectionFor, finalScoreEvents } from './music.js';
import { AUDIO_CLIPS, loadAudioClip } from './audio-clips.js';

export class Soundscape {
  constructor() {
    this.enabled=false;this.ctx=null;this.chapter=0;this.section=0;this.sectionTitle='';this.paused=false;this.allowTail=false;this.volume=.55;
    this.events=scoreEvents();this.cursor=0;this.cycle=0;this.timer=null;this.nodes=new Set();
    this.clipCache=new Map();this.clipNodes=new Set();this.clipGeneration=0;this.journalGeneration=0;this.journalOpen=false;this.journalNode=null;this.cueLast=new Map();
    this.onTrackChange=()=>{};
  }
  async toggle() {return this.setEnabled(!this.enabled);}
  async setEnabled(enabled) {
    if(!this.ctx) {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
      this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=0;
      const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=18;limiter.ratio.value=4;limiter.attack.value=.01;limiter.release.value=.25;
      this.master.connect(limiter);limiter.connect(this.ctx.destination);
      this.music=this.ctx.createGain();this.music.gain.value=this.volume;this.music.connect(this.master);
      this.scoreBus=this.ctx.createGain();this.scoreBus.gain.value=1;this.scoreBus.connect(this.music);
      this.readingBus=this.ctx.createGain();this.readingBus.gain.value=1;this.readingBus.connect(this.music);
      this.effects=this.ctx.createGain();this.effects.gain.value=.6;this.effects.connect(this.master);
      this.echo=this.ctx.createDelay(1);this.echo.delayTime.value=60/SCORE.bpm*.75;
      const feedback=this.ctx.createGain();feedback.gain.value=.22;
      const wet=this.ctx.createGain();wet.gain.value=.2;this.music.connect(this.echo);this.echo.connect(feedback);feedback.connect(this.echo);this.echo.connect(wet);wet.connect(this.master);
    }
    await this.ctx.resume();this.enabled=enabled;
    this.scoreBus.gain.setTargetAtTime(this.journalOpen?.04:1,this.ctx.currentTime,.25);
    this.onTrackChange(enabled?(this.journalOpen?'抄名人之歌':'葬火'):'声音已关闭');
    this.master.gain.setTargetAtTime(enabled?.65:0,this.ctx.currentTime,.16);
    this.pause(this.paused,this.allowTail);
    if(enabled&&!this.timer){this.origin=this.ctx.currentTime+.06;this.cursor=0;this.cycle=0;this.schedule();this.timer=setInterval(()=>this.schedule(),100);}
    if(!enabled)this.stopScore();
    if(!enabled){this.clipGeneration++;this.journalGeneration++;this.stopClips();}
    else {
      for(const id of ['transition','resonance','defeat','victory'])void loadAudioClip(this.ctx,id,this.clipCache).catch(()=>{});
      if(this.journalOpen)void this.startJournal();
    }
    return enabled;
  }
  stopScore() {
    clearInterval(this.timer);this.timer=null;const now=this.ctx.currentTime;
    for(const {osc,gain} of this.nodes){gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(.0001,now,.03);try{osc.stop(now+.12);}catch{}}
  }
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.ctx)this.music.gain.setTargetAtTime(this.volume*(this.paused && !this.journalOpen ? .2 : 1),this.ctx.currentTime,.15);}
  pause(paused,allowTail=false){this.paused=paused;this.allowTail=allowTail;this.setVolume(this.volume);if(this.ctx)this.effects.gain.setTargetAtTime(paused&&!allowTail?0:.6,this.ctx.currentTime,.06);}
  setChapter(chapter){this.chapter=chapter;}
  /**
   * 章节 → 配乐段落。这是"音乐的转换"的接入点。
   * 同一首《葬火》按章节换演奏法（见 music.js 的 SCORE_SECTIONS）：
   * 起段只有 pad+pluck、行段加鼓、迫段加钟、决段全声部。
   * 换段时对**已在发声**的声部做一次短的交叉淡化，避免硬切。
   */
  setSection(index,title=''){
    if(index===this.section)return;
    this.section=index;
    this.sectionTitle=title||sectionFor(index).name;
    if(this.ctx&&this.enabled&&!this.journalOpen)this.onTrackChange(`葬火 · ${this.sectionTitle}`);
  }
  refreshMix(){if(this.ctx){const cue=[...this.clipNodes].some(n=>n.id!=='journal'&&!n.stopping);this.scoreBus.gain.setTargetAtTime(this.journalOpen?.04:cue?.78:1,this.ctx.currentTime,.25);}}
  stopClip(node,fade=.15){
    if(!node||node.stopping)return;node.stopping=true;
    node.gain.gain.cancelScheduledValues(this.ctx.currentTime);node.gain.gain.setTargetAtTime(.0001,this.ctx.currentTime,fade/3);
    try{node.source.stop(this.ctx.currentTime+fade);}catch{}
    this.refreshMix();
  }
  stopClips(){for(const node of this.clipNodes)this.stopClip(node);this.journalNode=null;}
  resetPresentation(){this.clipGeneration++;this.journalGeneration++;this.stopClips();this.cueLast.clear();}
  createClip(buffer,id,bus){
    const spec=AUDIO_CLIPS[id],source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=!!spec.loop;
    gain.gain.value=spec.gain;source.connect(gain);gain.connect(bus);
    const node={source,gain,id};this.clipNodes.add(node);
    source.onended=()=>{source.disconnect();gain.disconnect();this.clipNodes.delete(node);if(this.journalNode===node)this.journalNode=null;this.refreshMix();};
    source.start();this.refreshMix();return node;
  }
  setJournal(open){
    this.journalOpen=open;this.journalGeneration++;this.setVolume(this.volume);
    this.onTrackChange(this.enabled?(open?'抄名人之歌':'葬火'):'声音已关闭');
    if(!this.ctx)return;
    this.scoreBus.gain.setTargetAtTime(open?.04:1,this.ctx.currentTime,.25);
    this.stopClip(this.journalNode,.35);this.journalNode=null;
    if(open&&this.enabled)void this.startJournal();
  }
  async startJournal(){
    const generation=this.journalGeneration;
    try{
      const buffer=await loadAudioClip(this.ctx,'journal',this.clipCache);
      if(!this.enabled||!this.journalOpen||generation!==this.journalGeneration)return;
      this.journalNode=this.createClip(buffer,'journal',this.readingBus);
      this.journalNode.gain.gain.setValueAtTime(.0001,this.ctx.currentTime);
      this.journalNode.gain.gain.setTargetAtTime(AUDIO_CLIPS.journal.gain,this.ctx.currentTime,.4);
    }catch{if(this.journalOpen&&generation===this.journalGeneration){this.scoreBus.gain.setTargetAtTime(.5,this.ctx.currentTime,.2);this.onTrackChange('葬火 · 档案变奏');}}
  }
  async playStinger(id){
    if(!this.enabled||!this.ctx||this.paused||this.journalOpen)return;
    const now=this.ctx.currentTime,previous=this.cueLast.get(id)??-100;
    if(now-previous<1.5)return;this.cueLast.set(id,now);
    const generation=this.clipGeneration;
    try{
      const buffer=await loadAudioClip(this.ctx,id,this.clipCache);
      if(!this.enabled||this.paused||this.journalOpen||generation!==this.clipGeneration)return;
      // Musical cues replace each other; actions retain their own short, readable feedback.
      for(const node of this.clipNodes)if(node.id!=='journal')this.stopClip(node,.2);
      this.createClip(buffer,id,this.effects);
    }catch{
      if(this.enabled&&generation===this.clipGeneration)this.tone(id==='defeat'?74:330,.5,'sine',.08,id==='defeat'?36:440);
    }
  }
  setFinalScore(stage=null,ending=false){
    const key=stage===null?'normal':ending?'ending':'final-'+stage;if(this.scoreKey===key)return;
    this.scoreKey=key;this.events=stage===null?scoreEvents():finalScoreEvents(stage,ending);this.scoreBpm=stage===null?84:ending?64:96+stage*10;
    this.cursor=0;this.cycle=0;if(this.ctx){const now=this.ctx.currentTime;for(const {osc,gain} of this.nodes){gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(.0001,now,.18);try{osc.stop(now+.65);}catch{}}}if(this.ctx)this.origin=this.ctx.currentTime+.15;
    if(stage!==null){this.section=3;this.chapter=3;}
    if(this.enabled)this.onTrackChange(stage===null?'葬火':ending?'万家微火 · 归途':['执炬 · 守火之王','执炬 · 万钧王权','执炬 · 最后的太阳'][stage]);
  }
  schedule() {
    if(!this.enabled)return;
    const beat=60/(this.scoreBpm||SCORE.bpm),loop=SCORE.beats*beat,now=this.ctx.currentTime;
    if(now-this.origin>loop*(this.cycle+1)+loop){this.cycle=Math.floor((now-this.origin)/loop);this.cursor=0;}
    for(let limit=0;limit<250;limit++) {
      const event=this.events[this.cursor],at=this.origin+this.cycle*loop+event.beat*beat;
      if(at>now+.22)break;
      if(at>=now-.03)this.scoreNote(event,Math.max(now,at),event.duration*beat);
      this.cursor++;if(this.cursor===this.events.length){this.cursor=0;this.cycle++;}
    }
  }
  voice(frequency,at,duration,type,volume,bus,attack=.02,release=.18,detune=0) {
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.value=frequency;osc.detune.value=detune;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+attack);gain.gain.setValueAtTime(Math.max(.0002,volume),at+Math.max(attack,duration-release));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain);gain.connect(bus);osc.start(at);osc.stop(at+duration+.02);
    const node={osc,gain};this.nodes.add(node);osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes.delete(node);};return osc;
  }
  scoreNote(event,at,duration) {
    // 先按当前章节折算：这一层在本段发不发声、增益多少。
    // 起段把鼓与钟整层关掉，所以同一份谱面在四段里听上去是四种脸色。
    const voicing=voiceFor(event,this.section);
    if(!voicing)return;
    const f=noteHz(event.note),density=event.layer===2?(this.chapter>=2?1:.3):event.layer===1?(this.chapter>=1?1:.85):1,g=voicing.gain*density;
    if(event.voice==='pad') {
      this.voice(f,at,duration,'sine',g,this.scoreBus,.8,1.3,-4);
      this.voice(f*2,at,duration,'sine',g*.3,this.scoreBus,.9,1.2,4);
    } else if(event.voice==='lead') {
      this.voice(f,at,duration,'triangle',g,this.scoreBus,.12,.35);
      this.voice(f/2,at,duration,'sine',g*.3,this.scoreBus,.18,.4);
    } else if(event.voice==='drum') {
      const osc=this.voice(f*1.6,at,duration,'sine',g,this.scoreBus,.008,duration-.015);osc.frequency.exponentialRampToValueAtTime(f*.6,at+duration);
    } else {
      this.voice(f,at,duration,'sine',g,this.scoreBus,.012,duration-.02);
      if(event.voice==='pluck')this.voice(f*2,at,duration*.7,'sine',g*.3,this.scoreBus,.012,duration*.7-.02);
      if(event.voice==='bell')this.voice(f*2.756,at,duration*.6,'sine',g*.22,this.scoreBus,.01,duration*.6-.02);
    }
  }
  tone(frequency,duration=.18,type='sine',volume=.16,endFrequency=frequency) {
    if(!this.enabled||!this.ctx)return;
    const now=this.ctx.currentTime,osc=this.voice(frequency,now,duration,type,volume,this.effects,.012,duration-.02);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10,endFrequency),now+duration);
  }
  play(event) {
    if(event.type==='jump')this.tone(event.double?320:180,.24,'triangle',.14,event.double?620:350);
    if(event.type==='slide')this.tone(110,.28,'sawtooth',.035,35);
    if(event.type==='collect')this.tone(880,.3,'sine',.12,1320);
    if(event.type==='rescue')this.tone(440,.65,'sine',.1,660);
    if(event.type==='land')this.tone(85,.1,'sine',.06,45);
    if(event.type==='hit')this.tone(88,.32,'sawtooth',.12,24);
    if(event.type==='launch')this.tone(180,.65,'sine',.2,740);
    if(event.type==='enemy-charge')this.tone(390,.32,'triangle',.055,540);
    if(event.type==='enemy-shot')this.tone(270,.18,'triangle',.075,160);
    if(event.type==='chain-lock')this.tone(510,.2,'triangle',.06,710);
    if(event.type==='chain-impact')this.tone(100,.45,'triangle',.10,35);
    if(event.type==='chain-wave')this.tone(160,.18,'sine',.07,60);
    if(event.type==='boss-cast')this.tone(event.kind==='high'?580:event.kind==='fall'?220:140,.28,'triangle',.075,110);
    if(event.type==='boss-broken')this.tone(880,.55,'sine',.11,660);
    if(event.type==='boss-counter')this.tone(440,.32,'triangle',.10,880);
    if(event.type==='boss-struck')this.tone(220,.4,'triangle',.12,90);
    if(event.type==='boss-ward')this.tone(660,.4,'sine',.10,990);
    // 第四幕逐招音色：横扫是擦地的短促噪音，射线是拉长的高频，雨是密集落点，熄日是低频轰。
    if(event.type==='dawn-move'){
      const map={
        quake:()=>this.tone(190,.5,'triangle',.08,100),
        stomp:()=>this.tone(140,.6,'triangle',.08,70),
        sweep:()=>this.tone(640,.5,'sine',.055,920),
        cinder:()=>this.tone(360,.4,'triangle',.06,220),
        meteor:()=>this.tone(560,.45,'triangle',.05,300),
        pulse:()=>this.tone(240,.85,'triangle',.075,660),
      };
      map[event.move]?.();
    }
    if(event.type==='dawn-exposed'){this.tone(660,.35,'sine',.06,990);this.tone(990,.55,'sine',.035,1320);}
    if(event.type==='final-cast')this.tone(event.attack==='high'?620:180,.45,'triangle',.065,event.attack==='tall'?540:100);
    if(event.type==='final-recall')this.tone(660,.7,'sine',.055,990);
    if(event.type==='final-memory-caught')this.tone(880,.16,'sine',.07,1320);
    if(event.type==='final-memory-return')this.tone(440,.4,'triangle',.08,1100);
    if(event.type==='final-duel-hit'){this.tone(220,.4,'triangle',.08,80);this.tone(1040,.28,'sine',.04,660);}
    if(event.type==='seal-inject')this.tone(event.hits===1?520:780,.25,'triangle',.07,1040);
    if(event.type==='dawn-land')this.tone(140,.2,'triangle',.045,65);
    if(event.type==='dawn-wedge-broken'){
      // 楔碎是这一幕最重要的正反馈，音要**分层**：
      // 低频的下坠（石头崩开）+ 高频的余韵（晨光泄出），
      // 单个正弦只能给出"叮"的一声，听不出"一根三人高的石柱断开了"。
      this.tone(300,.7,'triangle',.13,74);
      this.tone(880,.34,'sine',.05,180);
      // 余烬（逆火）在这一下会短暂发亮：用一个短促的高频点表示
      this.tone(1760,.14,'sine',.028,2100);
    }
    // 挥剑断楔（第四幕）。
    //
    // ⚠️ 为什么必须独立成一个音：断楔现在是**玩家的主动动作**（按 E），
    //   不是自动触发的事件。玩家需要立刻确认"我这一下有没有挥出去"，
    //   否则会以为按键没生效而反复按。
    // 三段各自承担不同信息：
    //   strike-start —— 剑出鞘（短促、高音）：确认输入被接收
    //   strike-miss  —— 砍空（低沉、短）：告诉你"够不着"，附带距离提示
    //   砍中——复用 dawn-wedge-broken 的碎裂音
    if(event.type==='strike-start')this.tone(520,.12,'square',.05,760);
    // 砍空要给**明确的否定感**，但不能刺耳——那是玩家的正常操作反馈，不是失误惩罚。
    if(event.type==='strike-miss')this.tone(150,.2,'sawtooth',.05,90);
    // 逆火余烬：拾取是清脆的"上挑"，冲刺是短促的"往下压再冲出去"。
    // 两者必须听得出区别——这是玩家判断"攒到了 / 花掉了"最快的通道。
    if(event.type==='ember')this.tone(660,.22,'triangle',.09,1080);
    if(event.type==='backfire')this.tone(300,.34,'sawtooth',.11,900);
    const cue={checkpoint:'transition',resonance:'resonance',dead:'defeat',won:'victory',gate:'transition'}[event.type];
    if(cue)void this.playStinger(cue);
  }
}

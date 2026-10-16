import { WORLD, SPRING_LAUNCH_VY, CHAPTERS, OBSTACLES, SHARDS, SPRINGS, RINGS, groundAt, chapterAt, hazardBounds, groundHeight, hazardBox, chapterIndex, LEVELS } from './level.js';
import { healthCapFor } from './hearts.js';
import { chainPattern } from './chain-boss.js';
import { FinalDuel } from './final-boss.js';

export function intersects(a,b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
export function playerBounds(p) { return { left:p.x-WORLD.playerHalfWidth, right:p.x+WORLD.playerHalfWidth, top:p.y-(p.slideTime>0?WORLD.slideHeight:WORLD.runHeight)+5, bottom:p.y-3 }; }

/**
 * 军官的悬浮高度（相对桥面的像素）。他会飞、无视地形，所以这个值不随地面起伏变化。
 * 取 92 是为了让他在画面上明确"悬空"，同时仍与玩家的跳跃弧线处在同一视野带里。
 */
const BOSS_HOVER=92;

/** 无 DOM 的确定性模拟层。渲染、输入和音效通过事件解耦。 */
// 取值来自实测扫描（0.35 / 0.45 / 0.5 / 0.55 / 0.6 六档）：
//   0.35 → 掉血 3 次（保护不足，beam+贴地扫那处仍中招）
//   0.5  → 掉血 2 次、通关、六招全出  ← 取这档
//   0.6+ → 掉血 2 次但战斗被拖长（0.6 时用时 136.8s）

export class Runner {
  /**
   * @param {object} [level] 关卡数据；缺省为序章。传入后所有世界查询走该关卡。
   * 关卡切换用 loadLevel，不在运行中替换引用。
   */
  constructor(level = LEVELS.prologue) { this.level = level; this.reset(); }

  /** 载入关卡。校验由 level.registerLevel 在注册时完成，此处只做防御性检查。 */
  loadLevel(level) {
    if (!level || !level.terrain || !level.obstacles || !level.chapters) {
      throw new Error('关卡数据不完整：需要 terrain / obstacles / chapters');
    }
    this.level = level;
    this.reset();
    return this;
  }

  reset() {
    const L = this.level;
    this.x=0; this.y=L.world.ground; this.vy=0; this.grounded=true;
    this.jumpsLeft=2; this.coyote=L.world.coyoteTime; this.jumpBuffer=0;
    this.slideTime=0; this.slideCooldown=0; this.slideQueued=0; this.jumpFromStop=false;
    // 砍楔（第四幕）：主动动作，与躲招解耦。见 strike() 的说明。
    this.strikeTime=0; this.strikeCooling=0; this.strikeFollow=0; this.dawnChannel=false; this.dawnBusyHold=0; this.hearts=this.level.hearts??0; this.health=healthCapFor(this.hearts); this.invulnerable=0; this.collected=new Set();
    this.braking=false;this.echoLight=false;this.rescueProgress=0;this.rescueId=null;this.rescueTimes=new Map();this.chaseAge=0;this.elapsed=0; this.respawns=0; this.chapter=0; this.checkpoint=0;
    this.checkpointShards=new Set(); this.state='running'; this.events=[];
    this.prevX=this.x;this.prevY=this.y;this.jumpPose=0;this.landPose=0;this.airSpin=0;
    this.rings=new Set();this.checkpointRings=new Set();this.usedSprings=new Set();this.combo=0;this.bestCombo=0;this.comboTime=0;
    this.flag=new Set();this.items=new Set();this.checkpointItems=new Set();this.checkpointFlags=new Set();
    this.bridgeMemory=0;
    this.warmth=0;this.litLamps=new Set();
    // 第四幕逆火冲刺：ember 是"手上攒着几枚余烬"，dashTime 是冲刺剩余时长。
    // 放在 reset 而不是 resetDawn：读档时余烬要和碎片一样回滚，
    // 但冲刺的**速度状态**属于玩家本体，不该被存档点重置。
    this.ember=0;this.dashTime=0;this.dashCooldown=0;this.embers=[];
    // 弹板滞空的"让招"计时：踩上弹板后的一小段里，王不把这一招落下来。
    // 弹板在主路上，触发是自动的，玩家在空中既刹不住也不能改落点。
    this.springHold=0;
    this.resetEnemies();
    this.resetMechanisms();
    this.resetBoss();
    this.resetDawn();
    this.resetFinale();
  }
  resetFinale(){
    this.finalDuel=this.level.finalBoss?new FinalDuel():null;
    this.finalChoice=null;this.doorOpen=false;
    if(this.level.bossOnly&&this.finalDuel){this.finalChoice='embers';this.doorOpen=true;this.finalDuel.begin(this);}
  }
  chooseFinalPath(id){
    if(!this.level.finalBoss||this.finalChoice||this.state!=='choosing'||!['throne','night','embers'].includes(id))return false;
    this.finalChoice=id;this.doorOpen=id!=='throne';this.emit('final-path',{id});
    if(id==='embers'){this.state='running';this.finalDuel.begin(this);}
    else{this.flag.add(`ending-${id}`);this.state='won';this.emit('won');}
    return true;
  }
  // 三轮逐步引入低刃、高刃、落印；反击飞行结束才计伤害。
  resetBoss() {
    const boss=this.level.boss;
    if(!boss){this.boss=null;this.bossShots=[];this.bossRelic=null;return;}
    // 检查点已经在 Boss 之后时，这场战斗视为已完成，不再重复打。
    const done=this.checkpoint>=boss.x;
    this.boss={
      phase:done?'defeated':'idle',
      x:boss.x,          // 军官当前世界坐标：每个物理帧跟着玩家一起前进
      y:this.groundAt(boss.x)-BOSS_HOVER, // 悬浮高度，无视地形起伏
      round:0,           // 已打完的轮数
      age:0,             // 当前阶段已进行的秒数
      shotsFired:0,      // 本轮已放出的法术数（齐射计数，取代原来的 charged 布尔）
      charged:false,     // 本轮是否已发过预警（保留：入场首帧与渲染会读）
      stunned:false,shieldAge:0, // 下一轮的盾从反击命中后开始生长
      relicTimer:0,      // 反击器物剩余存在时间（漏捡后会在下一轮重新出现）
      relicMissed:false, // 本轮器物是否已错过一次——用于"再出现"提示
      hits:0,            // 已经反击成功的次数
      ward:boss.ward!==false, counter:null,
      flight:0,          // 飞行起伏的相位，纯视觉
    };
    this.bossShots=[];
    this.bossRelic=null;
  }
  /** 玩家当前是否处于 Boss 战范围（预警到击败之间都算，用于 HUD 与渲染）。 */
  get inBossFight(){return !!this.boss&&this.boss.phase!=='idle'&&this.boss.phase!=='defeated';}
  setBrake(held){this.braking=!!held&&!!this.level.brake;}
  setEcho(held){this.echoLight=!!held&&!!this.level.echo&&this.state==='running';}
  // --------------------------------------------------------------------- //
  // 第四幕专属机制：逆火冲刺（backfire dash）
  //
  // 为什么这一幕需要一个**新的操控动词**：前三幕各有自己的动作语言——
  //   第一幕：跳过药车 / 滑过雨棚（基础三键的密集使用）
  //   第二幕：按住 A 控速（等退潮）+ 顺风域改变跳跃弧
  //   第三幕：按住 E 照忆（把不存在的桥变成实体）
  // 第四幕如果只剩"跑 + 跳 + 滑"，玩家会觉得这一段是前三幕的重复拼贴。
  //
  // 逆火冲刺的设定来源：执炬王在追赶中一路把自己烧成新太阳，沿途不断掉落
  // 「余烬」——那是他燃烧自己时掉下来的碎火。烬（玩家）可以**踩上去借这段火
  // 往前冲**。所以冲刺不是无限资源，而是"王烧得越猛、你能借的越多"。
  //
  // 机制上它解决一个真实的节奏问题：追兵（dawn.chase）始终在身后逼近，
  // 玩家需要在"停在楔前等锤"和"赶紧往前跑"之间反复切换。逆火冲刺给玩家
  // 一个**主动买时间**的手段：吃一枚余烬 → 获得一次瞬时加速，
  // 冲过一段本会挨锤的路。代价是余烬会消失——用在什么位置是玩家的选择。
  //
  // 与前三幕的分界：这不是"按住某个键改变状态"，而是**一次性的资源消费**。
  // 玩家要判断的是"这一段值不值得花掉手上这枚余烬"，而不是"什么时候松手"。
  // --------------------------------------------------------------------- //
  /**
   * 当前是否处于可冲刺状态。
   *
   * ⚠️ 冷却必须在这里判掉，而不是只写在 backfire() 里递减。
   *    `dashCooldown` 早先只被赋值、从未被读取，于是按住 Shift 会在
   *    连续几帧里把三枚余烬一口气花光——玩家看到的是"攒了一下全没了"，
   *    而不是"我一次用一枚"。这正是"一次性的资源消费"要避免的失控。
   *    （.verify/diag-dashfail.mjs + tests/dawn.test.mjs 的逆火冲刺用例复验。）
   */
  get dashReady(){return !!this.level.dawn&&this.ember>0&&this.dashCooldown<=0&&this.dashTime<=0&&this.state==='running';}
  /** 触发逆火冲刺：消耗一枚余烬，换取一段瞬时加速。 */
  backfire(){
    if(!this.dashReady)return false;
    this.ember--;this.dashTime=this.level.dawn?.dash?.duration??.55;
    this.dashCooldown=this.level.dawn?.dash?.cooldown??.35;
    this.emit('backfire',{x:this.x,y:this.y-36,left:this.ember});
    return true;
  }
  /** 王掉落余烬的位置：在玩家前方的必经路上，读起来像"他烧剩的东西落下来了"。 */
  dropEmber(x,y){this.embers.push({id:`ember-${x.toFixed(0)}`,x,y});}
  get savedPeople(){return (this.level.rescues||[]).filter(r=>this.flag.has(r.id)).length;}
  get greyFront(){const z=this.level.greyChase;return z&&this.flag.has('ember-spent')?z.trigger-z.lead+this.chaseAge*z.speed:null;}
  updateRescue(dt){
    if(!this.level.echo||!this.items.has('memory-ember'))return;
    const r=(this.level.rescues||[]).find(r=>!this.flag.has(r.id)&&this.x>=r.x-65&&this.x<=r.x+65);
    this.rescueId=r?.id||null;
    if(!r){this.rescueProgress=0;return;}
    if(this.echoLight&&this.grounded)this.rescueProgress+=dt;
    else this.rescueProgress=Math.max(0,this.rescueProgress-dt*2);
    if(this.rescueProgress<r.seconds)return;
    if(!this.flag.has('ember-spent')){this.flag.add('ember-spent');this.emit('flag',{id:'ember-spent',event:'fate-sacrifice',x:this.x});}
    this.flag.add(r.id);this.rescueTimes.set(r.id,this.elapsed);this.rescueProgress=0;this.rescueId=null;
    this.emit('rescue',{id:r.id,x:r.x,y:565,name:r.name});
  }
  updateBoss(dt) {
    if(this.level.boss?.kind==='chain'){this.updateChainBoss(dt);return;}
    const boss=this.level.boss;
    if(!boss||!this.boss||this.boss.phase==='idle'||this.boss.phase==='defeated')return;
    const B=this.boss;
    B.age+=dt;
    if(!B.stunned)B.shieldAge+=dt;
    // 军官与玩家同速前进、无视地形，因此始终停在玩家前方 lead 处。
    // 这条规则同时保证了三件事：玩家追不上他、他的位置永远可预期、
    // 双方的相对距离不依赖任何钳制——玩家在屏幕左、军官在屏幕右是自然结果。
    B.x=this.x+boss.lead;
    B.y=this.groundAt(boss.x)-BOSS_HOVER+Math.sin(B.flight)*6;
    B.flight+=dt*2.2;
    // 每轮的阶段推进都用累计时间比较，不用自减计时器，避免浮点误差累积成"少走一帧"。
    const round=B.round;
    const relic=boss.relics[round];
    const pattern=boss.patterns[round]||boss.patterns.at(-1);
    // 军官本体位置（世界坐标）——事件与渲染都读它，保证"打的是眼前那个军官"。
    const at={x:B.x,y:B.y,round};
    switch(B.phase){
      case 'charge':
        if(B.age>=boss.windup){
          B.phase='volley';B.age=0;B.shotsFired=0;
        }
        break;
      case 'volley':
        // 齐射：本轮连放 volley 发。每发之间留出 readable 的间隔，
        // 玩家因此是在**奔跑途中连续躲三次**，而不是躲一次就完事。
        // 用"下一次该发的时刻"推进，不用 shotsFired 做乘法——避免任何计数漂移。
        if(B.shotsFired<pattern.length&&B.age>=boss.gap*B.shotsFired){
          B.shotsFired=B.shotsFired+1;
          const kind=pattern[B.shotsFired-1],fall=kind==='fall';
          this.bossShots.push({id:boss.id+"-r"+round+"-s"+B.shotsFired,x:fall?this.x+this.level.chapters[this.chapter].speed*1.05:B.x-40,speed:fall?0:boss.speed,kind,age:0,warning:1.05});
          this.emit('boss-cast',{x:B.x,y:B.y,round,shot:B.shotsFired,kind});
        }
        if(B.shotsFired>=pattern.length&&B.age>=boss.gap*(pattern.length-1)+boss.cast){
          B.phase='shield';B.age=0;
        }
        break;
      case 'shield':
        // 常晚的钟声在护盾阶段的中段敲响，破盾并开启反击窗口。
        // 用固定时刻而不是"玩家做了什么"，保证任何人看到的剧本一致。
        if(!B.stunned&&B.age>=boss.shield*.45){
          B.stunned=true;
          this.emit('boss-broken',at);
        }
        if(B.stunned&&B.age>=boss.shield){
          B.phase='window';B.age=0;
          // 回火印悬在前方，跳起接住后自动飞向军官。
          this.publishRelic(relic,round);
        }
        break;
      case 'window':{
        // 器物存在时间到期后重新投放，永不卡关。
        if(this.bossRelic&&!this.bossRelic.gone){
          B.relicTimer=relic.life-B.age;
          const box=playerBounds(this);
          const rl=this.bossRelic;
          if(intersects(box,{left:rl.x-26,right:rl.x+26,top:rl.y-28,bottom:rl.y+28})){
            this.bossRelic.gone=true;
            B.phase='counter';B.age=0;B.counter={x:this.x,y:this.y-43};
            this.emit('boss-counter',{x:this.x,y:this.y-43,round});
            break;
          }
        }
        // 超时：器物滑过，重新在前方落一件，玩家不会被卡住。
        if(B.age>=relic.life||(this.bossRelic&&this.x>this.bossRelic.x+70)){
          this.bossRelic=null;
          if(!B.relicMissed){B.relicMissed=true;this.emit('boss-relic-missed',{round,from:relic.from});}
          B.age=0;
          this.publishRelic(relic,round);
        }
        break;
      }
      case 'counter':
        if(B.age>=.65){
          B.hits++;B.round++;B.counter=null;this.bossRelic=null;
          this.emit('boss-struck',{x:B.x,y:B.y-60,round});
          if(B.hits>=boss.rounds){B.phase='defeated';B.age=0;this.bossShots=[];this.emit('boss-defeated',at);}
          else{B.phase='recover';B.age=0;B.stunned=false;B.shieldAge=0;this.emit('boss-shield',{x:B.x,y:B.y,round:B.round});}
        }
        break;
      case 'recover':
        if(B.age>=1.8){B.phase='charge';B.age=0;B.stunned=false;B.relicMissed=false;B.shotsFired=0;}
        break;
      default:break;
    }
    // Boss 法术：从军官所在处贴着地面飞向玩家，命中即受伤。
    const player=playerBounds(this);
    this.bossShots=this.bossShots.filter(shot=>{
      shot.x-=shot.speed*dt;
      shot.age+=dt;
      const floor=this.groundAt(shot.x),fall=shot.kind==='fall';
      shot.y=floor-(shot.kind==='high'?62:22);
      const active=!fall||shot.age>=shot.warning;
      // 落印升起 160px 的地火；单跳最高约 118px，必须再跃一次越过。
      const bounds=fall?{left:shot.x-36,right:shot.x+36,top:floor-160,bottom:floor}:shot.kind==='high'?{left:shot.x-15,right:shot.x+15,top:-10000,bottom:floor-48}:shot.kind==='wave'?{left:shot.x-22,right:shot.x+22,top:floor-85,bottom:floor}:{left:shot.x-15,right:shot.x+15,top:shot.y-14,bottom:shot.y+14};
      if(active&&intersects(player,bounds)){
        this.hurt();
        return false;
      }
      return shot.x>this.x-160&&(!(shot.kind==='fall')||shot.age<shot.warning+.24);
    });
  }
  updateChainBoss(dt){
    const B=this.boss;if(!B||['idle','defeated'].includes(B.phase))return;
    B.age+=dt;B.x=this.x+this.level.boss.lead;B.y=510;
    if(B.phase==='charge'){
      B.patternIndex=B.hits;B.connected=false;B.targetX=this.x;B.age=0;
      const attack=chainPattern(this.level.boss,B).attack;
      if(attack){B.anchorX=undefined;B.phase='guard';B.charged=false;this.emit('boss-warning',{kind:attack});}
      else{B.anchorX=this.x+420;B.phase='aim';}
    }else if(B.phase==='guard'){
      if(!B.charged&&B.age>=1){
        B.charged=true;const kind=chainPattern(this.level.boss,B).attack;
        this.bossShots.push({id:'chain-guard-'+B.patternIndex,x:B.x-40,speed:320,kind,age:0});
        this.emit('boss-cast',{x:B.x,y:510,kind,round:B.patternIndex});
      }
      if(B.charged&&this.bossShots.length===0&&B.age>=1.8){B.anchorX=this.x+420;B.targetX=this.x;B.phase='aim';B.age=0;}
    }else if(B.phase==='aim'){
      B.targetX=this.x;
      if(B.age>=chainPattern(this.level.boss,B).aim){B.phase='locked';B.age=0;this.emit('chain-lock',{x:B.targetX,y:606});}
    }else if(B.phase==='locked'&&B.age>=chainPattern(this.level.boss,B).lock){
      B.phase='impact';B.age=0;
      if(Math.abs(this.x-B.targetX)<90)this.hurt();
      B.connected=Math.abs(B.targetX-B.anchorX)<=chainPattern(this.level.boss,B).tolerance;
      if(B.connected){B.hits++;B.round=B.hits;this.emit('boss-struck',{x:B.anchorX,y:590,round:B.hits-1});}
      this.emit('chain-impact',{x:B.targetX,y:606,connected:B.connected});
    }else if(B.phase==='impact'){
      const waves=chainPattern(this.level.boss,B).waves;
      for(const [index,wave] of waves.entries()){
        if(B.age>=wave.at-.6&&B.age-dt<wave.at-.6)this.emit('boss-warning',{kind:wave.height>120?'chain-high-wave':'chain-wave'});
        if(B.age>=wave.at&&B.age-dt<wave.at){
          this.emit('chain-wave',{x:this.x,y:606,height:wave.height,index,round:B.patternIndex});
          if(this.y>606-wave.height)this.hurt();
        }
      }
      if(B.age>waves.at(-1).at+.8){
        if(B.hits>=3){B.phase='defeated';this.emit('boss-defeated',{x:B.x,y:B.y});}
        else{B.phase='recover';B.age=0;}
      }
    }else if(B.phase==='recover'&&B.age>=1){B.phase='charge';B.age=0;}
    const box=playerBounds(this);
    this.bossShots=this.bossShots.filter(shot=>{
      shot.age+=dt;shot.x-=shot.speed*dt;const floor=this.groundAt(shot.x);
      shot.y=floor-(shot.kind==='high'?62:22);
      const bounds=shot.kind==='high'?{left:shot.x-15,right:shot.x+15,top:-10000,bottom:floor-48}:{left:shot.x-15,right:shot.x+15,top:shot.y-14,bottom:shot.y+14};
      if(intersects(box,bounds)){this.hurt();return false;}
      return shot.x>this.x-160;
    });
  }
  // --------------------------------------------------------------------- //
  // 第四幕 · 黎明王座的追逐与三根黎明楔
  //
  // 这一段和第二幕的巨像**故意不共用机制**。巨像是"停下把黄圈对到桩上"；
  // 第四幕是"站到楔前举火，把王的落锤引到楔上"——锤替玩家开路。
  // 复用巨像会让两幕在体感上变成同一关；B-05 明确要求各段可预告、
  // 可重试，且"绝不重复第二幕站定对准三遍"。
  //
  // 所以这里分成两条：
  //   1. chase —— 身后的追兵，按世界坐标逼近，被落锤击中会短暂踉跄。
  //   2. wedges —— 挡路的黎明楔。它是实心路障，撞上只被挡停；
  //      玩家在楔前按 E 举火引锤（strike/resolveStrike → baitedWedge），
  //      王的下一记落锤就会砸在这根楔上。
  // --------------------------------------------------------------------- //

  /** 玩家当前距离王落锤还有多久（用于 HUD 与渲染的预警圈）。 */
  get dawnAimLeft(){const D=this.dawn;return D&&D.phase==='aim'?Math.max(0,D.aim-D.moveAge):0;}

  resetDawn(){
    const spec=this.level.dawn;
    if(!spec){this.dawn=null;this.dawnChase=null;this.dawnHammers=[];this.dawnEntities=[];this.sparks=[];return;}
    const trigger=spec.trigger??0;
    this.ember=0;this.dashTime=0;this.dashCooldown=0;
    this.embers=(this.level.embers||[]).filter(e=>e.x>=this.checkpoint).map(e=>({...e}));
    this.sparks=(spec.sparks||[]).filter(s=>s.x>=this.checkpoint).map(s=>({...s}));
    this.sparkCharge=0;
    const broken=new Set((spec.wedges||[]).filter(w=>w.x<this.checkpoint).map(w=>w.id));
    const sealHits={};
    for(const w of spec.wedges||[])sealHits[w.id]=broken.has(w.id)?(spec.sealCost??2):0;
    const phase=this.checkpoint>=spec.x?'defeated':this.checkpoint>=trigger?'charge':'idle';
    this.dawn={
      phase,x:spec.x,age:0,aim:0,hits:0,round:0,busyHold:0,
      wedgeIndex:0,anchorWedge:null,anchorX:null,targetX:null,connected:false,stumbled:0,
      broken,
      sealHits,
      chain:[],move:null,moveAge:0,moveIndex:-1,chainIndex:-1,
      staggerFor:0,
      zones:[],
    };
    this.dawnEntities=[];
    this.dawnChase=phase==='idle'?null:{front:Math.max(0,this.x-(spec.chase?.lead??520)),stumble:0};
    this.dawn.chase=this.dawnChase;
    this.dawnHammers=[];
  }

  updateDawnChase(dt){
    const spec=this.level.dawn;if(!spec||!this.dawn)return;
    const C=this.dawn.chase||(this.dawn.chase={front:this.x-(spec.chase?.lead??520),stumble:0});
    this.dawn.chase=C;
    if(this.dawn.phase==='idle'||this.dawn.phase==='defeated')return;
    if(C.stumble>0){C.stumble=Math.max(0,C.stumble-dt);C.front=Math.min(C.front,this.x-(spec.chase?.lead??520));return;}
    if(this.dawn.phase==='aim'||this.dawn.phase==='impact'||this.dawn.phase==='stagger'||this.dawn.phase==='exposed')return;
    C.front+=spec.chase.speed*(this.braking&&this.grounded?1:.9)*dt;
  }

  updateDawnBoss(dt){
    const spec=this.level.dawn,D=this.dawn;
    if(!spec||!D||['idle','defeated'].includes(D.phase))return;
    D.age+=dt;
    D.x=this.x+520;
    this.updateSparks();
    if(D.phase==='stagger'){
      if(D.age>=D.staggerFor){D.phase='charge';D.age=0;D.connected=false;}
      return;
    }
    if(D.phase==='exposed'){
      if(this.dawnChannel&&this.grounded&&this.blockingWedge&&Math.abs(this.x-(this.blockingWedge.x-40))<=(spec.strike?.reach??320))this.strike();
      if(D.age>=(spec.counterWindow??2.6)){D.phase='charge';D.age=0;}
      return;
    }
    if(D.phase==='charge'){
      const wedge=this.blockingWedge;
      if(!wedge||wedge.x-this.x>850||this.springHold>0)return;
      if(D.age<(spec.cadence??.55))return;
      const chains=this.dawnPhaseChains();
      D.chainIndex=(D.chainIndex+1)%chains.length;
      D.chain=[...chains[D.chainIndex]];
      this.dawnStartNextInChain(spec);
    }else if(D.phase==='aim'){
      D.moveAge+=dt;
      for(const e of this.dawnEntities)if(e.telegraph&&['quake','sweep','pulse'].includes(e.kind))e.x=this.x+520;
      if(D.move==='hammer'){
        const e=this.dawnEntities.find(e=>e.kind==='hammer');
        if(e&&!e.locked){e.x=this.x;e.y=this.groundAt(e.x);if(D.moveAge>=.65){e.locked=true;D.targetX=e.x;this.emit('dawn-bait',{x:e.x,y:e.y});}}
      }
      if(D.moveAge>=D.aim){
        D.phase='impact';D.age=0;
        for(const e of this.dawnEntities){
          if(e.cast!==D.cast||!e.telegraph)continue;
          e.telegraph=false;e.armed=true;e.age=0;
        }
        this.emit('dawn-impact',{x:this.x,y:this.groundAt(this.x),connected:false,move:D.move,kind:D.move});
      }
    }else if(D.phase==='impact'){
      if(this.dawnEntities.length||D.age<(spec.moves[D.move]?.recover??.4))return;
      if(D.chain.length)this.dawnStartNextInChain(spec);
      else if(spec.baitWedges){D.phase='charge';D.age=0;}
      else{
        D.phase='exposed';D.age=0;
        this.sparkCharge=Math.min(spec.sparkMax??3,Math.max(this.sparkCharge,spec.sealCost??2));
        this.emit('dawn-exposed',{x:this.x,y:this.y,held:this.sparkCharge});
      }
    }
  }
  dawnPhaseChains(){
    const spec=this.level.dawn;
    return spec?.phases?.[Math.min(spec.phases.length-1,this.dawn?.broken.size??0)]||[];
  }
  dawnStartNextInChain(spec){
    const D=this.dawn,id=D.chain.shift(),def=spec.moves[id];
    D.move=id;D.moveAge=0;D.zones=[];D.cast=(D.cast||0)+1;
    D.aim=def.aim;D.charge=D.aim;D.phase='aim';D.age=0;D.busyHold=0;
    this.dawnFireMove(spec,id,true);
    this.emit('dawn-move',{move:id,name:def.name,read:def.read,broken:D.broken.size,round:D.hits,chainLeft:D.chain.length});
  }
  dawnFireMove(spec,id,telegraph=false){
    const D=this.dawn,px=this.x,origin=px+520;
    const spawn=e=>this.dawnEntities.push({...e,move:id,cast:D.cast,age:0,armed:!telegraph,telegraph});
    if(id==='hammer'){spawn({kind:'hammer',x:px,y:this.groundAt(px),radius:118,height:430,life:.5,locked:false});}
    else if(id==='cinder'||id==='meteor'){
      const offsets=id==='cinder'?[0,210]:[-210,0,210];
      offsets.forEach((off,i)=>{
        const x=px+off;
        spawn({kind:id,x,y:this.groundAt(x),radius:48,height:48,landIn:.32+i*.06,life:.6+i*.06});
      });
    }else if(id==='stomp'){
      [0,.62].forEach(delay=>spawn({kind:'quake',x:origin,dir:-1,speed:440,width:64,height:46,delay,life:2.6}));
    }else{
      const high=id==='sweep',tall=id==='pulse';
      spawn({kind:high?'sweep':tall?'pulse':'quake',x:origin,dir:-1,speed:tall?390:440,
        width:tall?96:84,height:high?380:tall?155:46,clearance:high?44:0,life:3});
    }
  }

  updateSparks(){
    const spec=this.level.dawn;if(!spec)return;
    const max=spec.sparkMax??3;
    this.sparks=(this.sparks||[]).filter(s=>{
      const sy=s.y??this.groundAt(s.x)-46;
      if(Math.abs(this.x-s.x)<56&&this.y>sy-200&&this.y<sy+120){
        if(this.sparkCharge<max){
          this.sparkCharge++;
          this.emit('spark',{x:s.x,y:sy,held:this.sparkCharge});
        }
        return false;
      }
      return true;
    });
  }

  updateDawnEntities(dt){
    if(!this.level.dawn||!this.dawnEntities)return;
    if(this.dawn?.phase==='defeated'){this.dawnEntities=[];return;}
    const body=playerBounds(this),keep=[];
    for(const e of this.dawnEntities){
      if(e.telegraph||!e.armed){keep.push(e);continue;}
      e.age+=dt;
      if(e.age<(e.delay||0)){keep.push(e);continue;}
      const age=e.age-(e.delay||0);
      if(age>e.life)continue;
      let box;
      if(e.kind==='hammer'){
        if(!e.landed){
          e.landed=true;const wedge=this.blockingWedge;
          if(wedge&&Math.abs(wedge.x-e.x)<150)this.breakDawnWedge(wedge);
          this.emit('dawn-land',{x:e.x,y:e.y,radius:e.radius,kind:e.kind});
        }
        box={left:e.x-e.radius,right:e.x+e.radius,top:e.y-e.height,bottom:e.y};
      }else if(e.kind==='cinder'||e.kind==='meteor'){
        if(age<e.landIn){keep.push(e);continue;}
        if(!e.landed){e.landed=true;this.emit('dawn-land',{x:e.x,y:e.y,radius:e.radius,kind:e.kind});}
        box={left:e.x-e.radius*.85,right:e.x+e.radius*.85,top:e.y-e.height,bottom:e.y};
      }else{
        e.x+=e.dir*e.speed*dt;
        if(e.x+e.width/2<this.x-70)continue;
        const floor=this.groundAt(e.x);
        box={left:e.x-e.width*.425,right:e.x+e.width*.425,top:floor-e.height,bottom:floor-(e.clearance||0)};
      }
      if(!e.hitDone&&intersects(body,box)){e.hitDone=true;this.hurt();}
      keep.push(e);
    }
    this.dawnEntities=this.dawn?.phase==='defeated'?[]:keep;
  }

  breakDawnWedge(w){
    const D=this.dawn,spec=this.level.dawn;if(D.broken.has(w.id))return;
    D.broken.add(w.id);D.sealHits[w.id]=spec.sealCost;D.hits++;D.round=D.hits;D.connected=true;D.chain=[];D.chainIndex=-1;
    if(D.chase){D.chase.stumble=2;D.chase.front=this.x-1000;}
    this.emit('dawn-wedge-broken',{id:w.id,x:w.x,y:this.groundAt(w.x),round:D.hits-1,by:'king'});
    if(D.broken.size===spec.wedges.length){D.phase='defeated';this.emit('dawn-defeated',{x:D.x,y:this.groundAt(D.x)});}
    else{D.phase='stagger';D.age=0;D.staggerFor=.65;}
  }
  strike() {
    if(this.state!=='running'||this.strikeTime>0||this.strikeCooling>0||this.strikeFollow>0) return;
    const spec=this.level.dawn;if(!spec)return;
    if(spec.baitWedges)return;
    const w=this.blockingWedge;
    if(this.dawn.phase!=='exposed'){this.emit('strike-miss',{x:this.x,reason:'guarded'});return;}
    if(!w){ this.emit('strike-miss',{x:this.x}); return; }
    this.strikeTime=spec.strike?.swing??.22;
    this.emit('strike-start',{x:this.x});
  }
  resolveStrike(){
    const spec=this.level.dawn,D=this.dawn;if(!spec||!D)return;
    if(spec.baitWedges)return;
    const w=this.blockingWedge;
    if(!w){ this.emit('strike-miss',{x:this.x}); return; }
    const reach=spec.strike?.reach??320;
    const gap=Math.abs(this.x-(w.x-40));
    if(D.phase==='exposed'&&gap<=reach&&(this.sparkCharge??0)>0){
      this.sparkCharge--;
      D.sealHits[w.id]=(D.sealHits[w.id]||0)+1;
      const need=spec.sealCost??2;
      this.emit('seal-inject',{id:w.id,x:w.x,y:this.groundAt(w.x),hits:D.sealHits[w.id],need,charge:this.sparkCharge});
      if(D.sealHits[w.id]>=need){
        const phases=spec.phases||[];
        const beforePhase=Math.min(Math.max(0,phases.length-1),D.broken.size);
        D.broken.add(w.id);D.hits++;D.round=D.hits;D.connected=true;this.dawnEntities=[];D.chain=[];
        const afterPhase=Math.min(Math.max(0,phases.length-1),D.broken.size);
        if(afterPhase!==beforePhase)D.chainIndex=-1;
        if(D.chase)D.chase.stumble=spec.stumble??1.5;
        this.emit('dawn-wedge-broken',{id:w.id,x:w.x,y:this.groundAt(w.x),round:D.hits-1,by:'spark'});
        if(D.broken.size>=(spec.wedges||[]).length){D.phase='defeated';this.emit('dawn-defeated',{x:D.x,y:this.groundAt(D.x)});}
        else{D.phase='stagger';D.age=0;D.staggerFor=spec.stagger??1.5;}
      }
    }else{
      this.emit('strike-miss',{x:this.x,gap:Math.round(gap),reach,charge:this.sparkCharge??0});
    }
    this.strikeCooling=spec.strike?.cooldown??.45;
    this.strikeFollow=spec.strike?.follow??.16;
  }

  healthCap(){ return healthCapFor(this.level.hearts ?? this.hearts ?? 0); }
  get blockingWedge(){
    const spec=this.level.dawn;if(!spec)return null;
    const D=this.dawn;if(!D)return null;
    return (spec.wedges||[]).find(w=>!D.broken.has(w.id)&&this.x<w.x-4)||null;
  }

  tidalState(zone){
    const age=(this.elapsed+(zone.offset||0))%zone.period;
    const open=age<zone.open;
    const height=open?0:Math.min(300,(age-zone.open)*600,(zone.period-age)*600);
    return {open,left:open?zone.open-age:zone.period-age,height};
  }
  /** 把反击器物投放到玩家前方的必经跑道上。 */
  publishRelic(relic,round){
    const boss=this.level.boss;
    const x=this.x+boss.relicLead;
    this.bossRelic={...relic,x,y:this.groundAt(x)-108,gone:false};
    this.emit('boss-window',{x,y:this.bossRelic.y,round,from:relic.from});
  }
  /** Boss 被反击命中时的金闪。渲染层通过在下一帧读取该值做一次画面反馈。 */
  goldFlashEmit(round){this.emit('boss-hit-flash',{round});}
  resetEnemies() {
    this.enemyStates=new Map((this.level.enemies||[]).map(e=>[e.id,{active:false,age:0,fired:0,done:e.x<this.checkpoint}]));
    this.projectiles=[];
  }
  updateEnemies(dt) {
    for(const enemy of this.level.enemies||[]) {
      const state=this.enemyStates.get(enemy.id);
      if(state.done)continue;
      if(!state.active&&this.x>=enemy.trigger){state.active=true;this.emit('enemy-charge',{x:enemy.x,y:this.groundAt(enemy.x)-65});}
      if(!state.active)continue;
      state.age+=dt;
      while(state.fired<enemy.shots&&state.age>=enemy.windup+state.fired*enemy.interval){
        const shot={id:`${enemy.id}-${state.fired++}`,x:enemy.x-22,speed:enemy.speed};
        this.projectiles.push(shot);this.emit('enemy-shot',{x:shot.x,y:this.groundAt(shot.x)-22});
      }
      if(state.fired===enemy.shots)state.done=true;
    }
    const player=playerBounds(this);
    this.projectiles=this.projectiles.filter(shot=>{
      shot.x-=shot.speed*dt;shot.y=this.groundAt(shot.x)-22;
      if(intersects(player,{left:shot.x-13,right:shot.x+13,top:shot.y-12,bottom:shot.y+12})){
        this.hurt();return false;
      }
      return shot.x>this.x-100;
    });
  }
  emit(type, data={}) { this.events.push({type,...data}); }
  drainEvents() { const events=this.events; this.events=[]; return events; }
  jump() {
    if(this.state!=='running') return;
    this.jumpBuffer=this.level.world.jumpBuffer;
    this.tryJump();
  }
  tryJump() {
    if(this.jumpBuffer<=0) return;
    if(this.grounded || this.coyote>0) {
      // 停步起跳 = 原地垂直跳。
      //
      // ⚠️ 这条是玩家实测反馈逼出来的（原话：「我停在楔那里等落锤，
      //   王放横扫我就不能跳——跳了就撞到楔上面了，我没得选」）。
      //   水平速度在 `braking && grounded` 时才是 0，离地一帧刹车就失效，
      //   空中恢复全速——于是"原地跳躲横扫"实际是"带着 360px/s 前移 266px"，
      //   从楔前 300px 内起跳必撞楔（致死线 wedge.x−30）。
      //   停步（按住 A）起跳时记住这个意图，整个滞空期间水平速度为 0：
      //   原地起跳、原地落地，横扫扫过脚下，落回原位。
      //   只在**离地那一刻**取一次 braking：跑动中起跳不受影响；
      //   空中二段跳不改变标记（保持垂直）；落地清除（见 update 的 land 分支）。
      if(this.grounded)this.jumpFromStop=this.braking;
      this.vy=this.level.world.firstJump; this.jumpsLeft=1; this.grounded=false; this.coyote=0;
      this.slideTime=0; this.jumpBuffer=0; this.slideQueued=0; this.emit('jump', {double:false});
      this.jumpPose=.25;this.airSpin=0;
    } else if(this.jumpsLeft>0) {
      this.vy=this.level.world.airJump; this.jumpsLeft=0; this.slideTime=0; this.jumpBuffer=0; this.slideQueued=0;
      this.emit('jump',{double:true});
      this.jumpPose=.35;this.airSpin=.45;
    }
  }
  slide() {
    if(this.state!=='running') return;
    if(!this.grounded) { this.vy=Math.max(this.vy, 900); this.slideQueued=.65; return; }
    if(this.slideCooldown>0 || this.slideTime>0) return;
    this.slideTime=this.level.world.slideDuration; this.emit('slide');
  }
  /** 当前关卡在 x 处的地面高度。 */
  groundAt(x) { const L=this.level; return groundHeight(L.terrain, x, L.world.ground); }
  resetMechanisms(){
    this.mechanismStates=new Map([...(this.level.tides||[]),...(this.level.platforms||[])].map(m=>[m.id,{age:0,started:false,done:m.x<this.checkpoint}]));
  }
  mechanismActive(m){const s=this.mechanismStates.get(m.id);return !!s&&(m.collapse?!s.done:s.started&&!s.done&&s.age>=m.warning&&s.age<m.warning+m.life);}
  platformAt(x){return (this.echoLight&&(this.level.echoPlatforms||[]).find(p=>x>=p.x&&x<=p.x+p.width))||(this.level.platforms||[]).find(p=>x>=p.x&&x<=p.x+p.width&&this.mechanismActive(p));}
  supportAt(x){return this.platformAt(x)?.y??this.groundAt(x);}
  updateMechanisms(dt){
    for(const m of [...(this.level.tides||[]),...(this.level.platforms||[])]){
      const s=this.mechanismStates.get(m.id);
      if(m.collapse){
        if(!s.started&&this.grounded&&this.x>=m.x&&this.x<=m.x+m.width&&Math.abs(this.y-m.y)<2){s.started=true;this.emit('mechanism-warning',{id:m.id,x:m.x,y:m.y});}
        if(s.started&&!s.done){s.age+=dt;if(s.age>=m.collapse)s.done=true;}
        continue;
      }
      if(!s.started&&!s.done&&this.x>=m.trigger){s.started=true;s.age=0;this.emit('mechanism-warning',{id:m.id,x:m.x,y:this.groundAt(m.x)});}
      if(s.started&&!s.done){s.age+=dt;if(s.age>=m.warning+m.life)s.done=true;}
    }
  }
  /** 障碍在当前关卡里的碰撞盒。 */
  boxOf(o) { return hazardBox(o, this.groundAt(o.x)); }
  restoreCheckpoint(refill=false) {
    const L=this.level;
    this.braking=false;this.echoLight=false;this.rescueProgress=0;this.rescueId=null;this.rescueTimes=new Map();this.chaseAge=0;this.x=this.checkpoint; this.y=this.groundAt(this.checkpoint); this.vy=0; this.grounded=true;
    this.jumpsLeft=2; this.coyote=L.world.coyoteTime; this.jumpBuffer=0;
    this.slideTime=0; this.slideCooldown=0; this.slideQueued=0; this.jumpFromStop=false;
    this.collected=new Set(this.checkpointShards); this.invulnerable=1.5;
    this.rings=new Set(this.checkpointRings);this.usedSprings=new Set(L.springs.filter(s=>s.x<this.checkpoint).map(s=>s.id));
    // 主线物品与旗标一起回滚：读档不能重刷已经拿到的铜片
    this.items=new Set(this.checkpointItems);
    this.flag=new Set(this.checkpointFlags);this.bridgeMemory=0;
    // 寒雾前有新的炭盆，读档不继承已经消耗过的暖光。
    this.warmth=0;this.litLamps=new Set((L.lamps||[]).filter(l=>l.x<this.checkpoint).map(l=>l.id));
    this.resetEnemies();
    this.resetMechanisms();
    // Boss 与检查点一起回档：重试不会保留上一条命打到的轮数，
    // 否则「失败 → 重试」会变成用命换进度。
    this.resetBoss();
    // 第四幕同理：已碎的楔按检查点回滚，追兵回到原位。
    this.resetDawn();
    this.resetFinale();
    this.prevX=this.x;this.prevY=this.y;this.jumpPose=0;this.landPose=0;this.airSpin=0;this.combo=0;this.comboTime=0;this.springHold=0;
    this.chapter=chapterIndex(L.chapters, this.x); this.state='running'; this.respawns++;
    // 回满到**当前上限**，不是写死 3：拿了第四心的人复活也是四心。
    if(refill) this.health=this.healthCap();
    this.emit('respawn');
  }
  hurt(falling=false) {
    if(!falling && this.invulnerable>0) return;
    if(!falling&&this.inBossFight&&this.boss.ward){this.boss.ward=false;this.invulnerable=1.7;this.emit('boss-ward',{x:this.x,y:this.y-40});return;}
    this.health--; this.invulnerable=1.7; this.emit('hit',{falling});
    this.combo=0;this.comboTime=0;
    if(this.health<=0) { this.health=0; this.state='dead'; this.emit('dead',{falling}); }
    else if(falling) this.restoreCheckpoint();
  }
  update(dt) {
    if(this.state!=='running') return;
    const L=this.level, W=L.world;
    this.prevX=this.x;this.prevY=this.y;
    this.elapsed+=dt;
    this.warmth=Math.max(0,this.warmth-dt);
    this.jumpPose=Math.max(0,this.jumpPose-dt);this.landPose=Math.max(0,this.landPose-dt);this.airSpin=Math.max(0,this.airSpin-dt);
    this.comboTime=Math.max(0,this.comboTime-dt);if(this.comboTime===0)this.combo=0;
    this.invulnerable=Math.max(0,this.invulnerable-dt);
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    this.slideQueued=Math.max(0,this.slideQueued-dt);
    this.slideCooldown=Math.max(0,this.slideCooldown-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    if(this.dashTime>0)this.dashTime=Math.max(0,this.dashTime-dt);
    if(this.springHold>0)this.springHold=Math.max(0,this.springHold-dt);
    // 砍楔计时：挥剑前摇结束的那一帧判定，然后进入收招冷却。
    if(this.strikeCooling>0)this.strikeCooling=Math.max(0,this.strikeCooling-dt);
    if(this.strikeFollow>0)this.strikeFollow=Math.max(0,this.strikeFollow-dt);
    if(this.strikeTime>0){
      const was=this.strikeTime;
      this.strikeTime=Math.max(0,this.strikeTime-dt);
      // 前摇走完的那一帧触发判定（用 was>0 → now==0 作为单次触发点）。
      if(was>0&&this.strikeTime===0)this.resolveStrike();
    }
    if(this.slideTime>0) {
      this.slideTime=Math.max(0,this.slideTime-dt);
      if(this.slideTime===0) this.slideCooldown=W.slideCooldown;
    }
    this.updateMechanisms(dt);
    const wind=(L.windZones||[]).find(z=>this.x>=z.from&&this.x<=z.to);
    // 逆火冲刺：冲刺期间额外加一段速度。
    //
    // ⚠️ 刹车**优先于**冲刺，这一点是实测改出来的：
    //   早期写成"冲刺期间无视刹车"（理由听起来很顺：冲刺的意义就是离开这里），
    //   但那样一来 QA 在楔前 guard 距离按住刹车也停不住，被自己的冲刺顶过
    //   wedge.x-30 的致死线（.verify/diag-dash6.mjs：在 33032 冲完落到 33372，死）。
    //   而且从玩家直觉上也是错的：按住 A 就是"我要停"，
    //   冲刺是"我要往前"——两者冲突时应该听刹车的，那是更明确的意图。
    //   所以冲刺的正确用法是"松开刹车的那一刻往前窜一段"，而不是"刹车也拦不住"。
    const dashBoost=this.dashTime>0&&!this.braking?(L.dawn?.dash?.speed??250):0;
    // jumpFromStop：停步垂直跳的滞空延续。见 tryJump 里的说明。
    // 停步起跳后整个滞空都不前移；落地清除标记。
    const braking=(this.braking&&this.grounded)||!!this.jumpFromStop;
    const duelActive=this.finalDuel&&!['idle','defeated'].includes(this.finalDuel.phase);
    const retreat=L.dawn?.baitWedges&&this.blockingWedge&&this.blockingWedge.x-this.x<800&&this.braking;
    const base=duelActive?this.finalDuel.move*300:retreat?-300:(braking?0:L.chapters[this.chapter].speed+(!this.grounded&&wind?wind.push:0));
    this.x+=(base+dashBoost)*dt;
    // 避难灯处停步，让注火成为一次真实输入；读对白或跳过不替玩家作选择。
    const waiting=(L.rescues||[]).find(r=>!this.flag.has(r.id)&&this.prevX<=r.x-60&&this.x>=r.x-60);
    if(waiting)this.x=waiting.x-60;
    // 未碎的楔是**路障**：楔不断就不能通过。没有这条约束，玩家可以无视
    // 机制一路跑到终点，"楔"就变成了可选收集品而不是关卡门。
    // 注意这里必须是"撞穿即死"而不是"撞上去停住"——如果楔把玩家挡停，
    // 玩家就白得一个"站定"状态，于是"顶着楔挨锤"会变成自动发生的事情，
    // 整幕退化为"只要一直跑就能过"。做成致命路障后，停步**必须玩家自己按**，
    // 决策才真正在玩家手里。
    // 未碎的楔是**实心路障**：它挡住去路，但不再"撞穿即死 + 回档"。
    // ⚠️ 旧版是 `this.hurt(true)`（扣一格余火并回滚到火祭碑）。第四幕的
    //   存档点平均间隔上万像素，一次手误就要重跑二十多秒，实际体验是
    //   "过不去"。路障本身已经足够构成关卡门——楔不断就不能通过——
    //   所以惩罚改成"被挡停"，代价交给王与追兵去收。
    const wedge=this.blockingWedge;
    if(wedge&&this.x>wedge.x-40)this.x=wedge.x-40;
    // 决斗期玩家被限制在场地内。边界从关卡数据读（level-finale 的 finalBoss.left/right），
    // 不再在这里写死 -260/+100——横扫地火的缝隙宽度是按这个场地宽度反推的，
    // 硬编码写两处的话，改场地就会让"缝隙够不够宽"悄悄失真。
    if(L.finalBoss){
      const spec=L.finalBoss,left=spec.arena+(spec.left??-260),right=spec.arena+(spec.right??100);
      this.x=duelActive?Math.max(left,Math.min(this.x,right)):Math.min(this.x,spec.arena);
    }
    const nextChapter=chapterIndex(L.chapters, this.x);
    if(nextChapter!==this.chapter) {
      this.chapter=nextChapter; this.checkpoint=L.chapters[nextChapter].at;
      this.checkpointShards=new Set(this.collected); this.health=Math.min(this.healthCap(),this.health+1);
      this.checkpointRings=new Set(this.rings);
      this.checkpointItems=new Set(this.items);
      this.checkpointFlags=new Set(this.flag);
      this.emit('checkpoint',{chapter:this.chapter});
    }
    const overGap=!this.platformAt(this.x)&&L.obstacles.some(o=>o.type==='gap' && this.x>o.x+3 && this.x<o.x+o.width-3);
    const ground=this.supportAt(this.x);
    if(this.grounded && overGap) { this.grounded=false; this.vy=0; }
    if(this.grounded) this.y=ground;
    if(!this.grounded) {
      this.coyote=Math.max(0,this.coyote-dt);
      if(this.coyote===0 && this.jumpsLeft===2) this.jumpsLeft=1;
      this.vy+=W.gravity*(wind?wind.lift:1)*dt; this.y+=this.vy*dt;
      // 从桥下横穿边缘不能吸附回地面。
      if(!overGap && this.y>=ground && this.prevY<=this.supportAt(this.prevX)+1 && this.vy>=0) {
        this.landPose=Math.min(.22,.08+this.vy/7000);this.airSpin=0;
        this.y=ground; this.vy=0; this.grounded=true;
        this.jumpFromStop=false;   // 落地即恢复正常的刹车/速度语义
        this.jumpsLeft=2; this.coyote=W.coyoteTime; this.emit('land');
        if(this.slideQueued>0) { this.slideQueued=0; this.slide(); }
        this.tryJump();
      }
    } else { this.coyote=W.coyoteTime; this.tryJump(); }
    for(const spring of L.springs) {
      if(this.grounded && this.x>=spring.x && this.x<=spring.x+spring.width && !this.usedSprings.has(spring.id)) {
        this.usedSprings.add(spring.id);this.grounded=false;this.vy=SPRING_LAUNCH_VY;this.jumpsLeft=1;this.coyote=0;this.slideTime=0;this.jumpPose=.35;this.springHold=2.5;this.emit('launch');
      }
    }
    if(this.y>900) { this.hurt(true); return; }
    const box=playerBounds(this);
    if(this.echoLight)for(const wall of L.echoWalls||[])if(intersects(box,{left:wall.x,right:wall.x+wall.width,top:wall.top,bottom:wall.bottom}))this.hurt();
    this.updateRescue(dt);
    if(this.greyFront!==null){this.chaseAge+=dt;if(this.x-18<=this.greyFront){this.hurt(true);return;}}
    for(const z of L.tidalChannels||[])if(this.x>z.x-18&&this.x<z.x+z.width+18&&this.y>606-this.tidalState(z).height&&this.tidalState(z).height>20){this.hurt(true);return;}
    for(const tide of L.tides||[])if(this.mechanismActive(tide)&&intersects(box,{left:tide.x-28,right:tide.x+28,top:this.groundAt(tide.x)-tide.height,bottom:this.groundAt(tide.x)}))this.hurt();
    if(this.state==='dead')return;
    this.updateEnemies(dt);
    if(this.state==='dead')return;
    this.updateBoss(dt);
    if(this.state==='dead')return;
    this.updateDawnChase(dt);
    this.updateDawnBoss(dt);
    this.updateDawnEntities(dt);
    this.finalDuel?.update(this,dt);
    if(this.state==='dead')return;
    if(this.finalDuel?.phase==='defeated'){
      this.flag.add('ending-embers');this.state='won';this.emit('won');return;
    }
    if(L.bossOnly&&L.dawn&&this.dawn?.phase==='defeated'){
      this.state='won';this.emit('won');return;
    }
    // 追兵贴上来就是一次真实失败：它不绕、不停，只能靠砸中楔把它震退。
    // 追兵贴上来：扣一格余火并把追兵推回满 lead，但**不回档**。
    // 第四幕的检查点相隔上万像素，一次"被追上"若回档，玩家会失去整段路线；
    // 而这一幕的压力本来就来自"不能停"，掉一格血已经足够昂贵。
    // 推回满 lead 也避免玩家在无敌帧里贴着追兵蹭过去。
    if(this.dawn?.chase&&this.dawn.phase!=='idle'&&this.dawn.phase!=='defeated'&&this.x-18<=this.dawn.chase.front){
      this.hurt();
      this.dawn.chase.front=Math.max(0,this.x-(L.dawn.chase?.lead??820));
      this.dawn.chase.stumble=Math.max(this.dawn.chase.stumble,.4);
    }
    if((L.bossOnly||L.finishOnBoss)&&this.boss?.phase==='defeated') {
      this.state='won'; this.emit('won'); return;
    }
    // 第四幕：楔全碎只是"路通了"，不等于到达。玩家还必须自己跑到出口，
    // 让「安眠锁解开、门可以开了、但门没有开」这段收束真正发生在终点。
    // 所以这里只清掉追兵，不结算；结算交给下面按 W.end 的通用判定。
    if(L.dawn&&this.dawn?.phase==='defeated'&&this.dawn.chase){this.dawn.chase=null;}
    for(const o of L.obstacles) {
      if(o.type==='gap' || o.x>this.x+100 || o.x+o.width<this.x-50) continue;
      if(intersects(box,this.boxOf(o))){
        // 滑铲刚结束的 0.16s 收势宽容：为躲招提前起的滑常常在梁腰到期，
        // 差一帧站起来挨打不属于操作失误。
        if(!(o.type==='beam'&&this.slideCooldown>0))this.hurt();
      }
      if(this.state==='dead') return;
    }
    for(const s of L.shards) {
      if(this.collected.has(s.id)) continue;
      if(intersects(box,{left:s.x-16,right:s.x+16,top:s.y-17,bottom:s.y+17})) {
        this.collected.add(s.id); this.emit('collect',{x:s.x,y:s.y});
        this.combo++;this.comboTime=2.4;this.bestCombo=Math.max(this.bestCombo,this.combo);
      }
    }
    for(const ring of L.rings) if(!this.rings.has(ring.id) && Math.hypot(this.x-ring.x,this.y-36-ring.y)<49) {
      this.rings.add(ring.id);this.health=Math.min(this.healthCap(),this.health+1);this.emit('resonance',{x:ring.x,y:ring.y,id:ring.id});
    }
    // 逆火余烬：拾取后攒成一次冲刺。与碎片分开计数（碎片是连忆，余烬是资源），
    // 所以它既不进 collected，也不在检查点之间"用掉就没"——
    // 用掉的余烬通过 this.embers 里那条记录被移除，读档不会重新长出来。
    if(this.embers.length){
      this.embers=this.embers.filter(e=>{
        if(Math.hypot(this.x-e.x,this.y-36-e.y)<46){
          this.ember=Math.min(this.level.dawn?.dash?.max??3,this.ember+1);
          this.emit('ember',{x:e.x,y:e.y,held:this.ember});
          return false;
        }
        return true;
      });
    }
    // 主线物品：铜片一类的东西。与碎片不同，它不参与连忆，且在检查点回滚，
    // 所以读档不能重刷主线收集物。
    for(const item of L.items||[]) {
      if(this.items.has(item.id)) continue;
      if((item.required&&this.prevX<item.x&&this.x>=item.x)||intersects(box,{left:item.x-22,right:item.x+22,top:item.y-24,bottom:item.y+24})) {
        this.items.add(item.id);
        if(item.kind==='coal'){this.warmth=L.warmthDuration;this.emit('warmth',{x:item.x,y:item.y});}
        this.emit('item',{id:item.id,event:item.event,x:item.x,y:item.y,place:item.place});
      }
    }
    for(const lamp of L.lamps||[])if(!this.litLamps.has(lamp.id)&&this.prevX<lamp.x&&this.x>=lamp.x){
      this.litLamps.add(lamp.id);this.emit('lamp-lit',{id:lamp.id,x:lamp.x,y:this.groundAt(lamp.x)-80});
    }
    if(this.warmth===0&&(L.coldZones||[]).some(zone=>this.x>=zone.from&&this.x<=zone.to))this.hurt();
    if(this.state==='dead')return;
    // 通用旗标：章节任务用它记录一次性触发（进入新地点、桥稳定等）
    for(const flag of L.flags||[]) {
      if(flag.manual)continue;
      if(this.flag.has(flag.id)) continue;
      if(this.prevX<flag.x&&this.x>=flag.x) {
        this.flag.add(flag.id); this.emit('flag',{id:flag.id,event:flag.event,x:flag.x});
      }
    }
    // Boss 入场：越过触发点就开打。军官从这一刻起飞在玩家前方，
    // charge 阶段从此刻起算，所以玩家读到的第一段预警时长是完整的 windup。
    if(L.boss&&this.boss&&this.boss.phase==='idle'&&this.prevX<L.boss.trigger&&this.x>=L.boss.trigger){
      this.boss.phase='charge';this.boss.age=0;this.boss.charged=true;
      // 军官立刻落到玩家前方，避免入场瞬间从关卡数据里的原始坐标"弹"过来。
      this.boss.x=this.x+L.boss.lead;
      this.boss.y=this.groundAt(this.boss.x)-BOSS_HOVER;
      this.emit('boss-enter',{x:this.boss.x,y:this.boss.y});
    }
    // 第四幕入场：越过触发点，王开始追击。这一刻起追兵就在身后，
    // 玩家不能再靠停步等机会——这正是本幕与第二幕的分界。
    //
    // 进 'charge' 而不是直接进 'aim'：charge 才是"选招 + 建立预警"的入口。
    // 早期写法直接进 aim，于是第一招的 move 是 null，既没有预警也没有判定，
    // 玩家在第一根楔前白白吃一轮——这是"莫名挨打"的来源之一。
    if(L.dawn&&this.dawn&&this.dawn.phase==='idle'&&this.prevX<L.dawn.trigger&&this.x>=L.dawn.trigger){
      this.dawn.phase='charge';this.dawn.age=0;this.dawn.moveIndex=-1;
      this.dawn.chase={front:Math.max(0,this.x-(L.dawn.chase?.lead??520)),stumble:0};
      this.emit('dawn-enter',{x:L.dawn.x,y:this.groundAt(L.dawn.x)});
    }
    const dawnGate=!L.dawn||this.dawn?.phase==='defeated';
    if(L.finalBoss&&!this.finalChoice&&this.x>=L.finalBoss.trigger){this.state='choosing';this.emit('final-choice');return;}
    if(L.finalBoss)return;
    if(this.x>=W.end&&(!this.boss||this.boss.phase==='defeated')&&dawnGate) { this.x=L.boss?this.x:W.end; this.state='won'; this.emit('won'); }
  }
}

// 兼容旧调用：仍从 level.js 导出同名查询
export { WORLD, CHAPTERS, OBSTACLES, SHARDS, SPRINGS, RINGS, groundAt, chapterAt, hazardBounds };

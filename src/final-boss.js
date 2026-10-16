// Warnings, moving bodies and phase cadence all belong to the simulation.
export const FINAL_PHASES=[
  {name:'守火之王',warning:1,speed:425,plans:[['low','rain','crossfire'],['high','hunt','tall'],['eruption','crossfire','edict','lance']]},
  {name:'万钧王权',warning:.886,speed:482,plans:[['siege','tall','sweepfire','high'],['hunt','edict','crossfire','sunfall'],['cage','sweepfire','siege','tall','edict']]},
  {name:'最后的太阳',warning:.772,speed:539,plans:[['siege','hunt','crossfire','sunfall','edict'],['cage','sweepfire','hunt','tall','siege'],['hunt','siege','edict','crossfire','sweepfire','sunfall']]},
];
// ---- 第五幕 · 横扫地火（sweepfire）的几何与节奏 ---------------------------- //
//
// 这七个数不是随手填的，全部由「玩家能不能走过去」反推。
// 改任何一个都要重跑 .verify/diag-sweepfire.mjs 看容错还剩多少。
//
// 旧值（宽 40 / 间距 78 / 间隔 0.22s）的问题，玩家原话是「缝非常难躲」：
//   · 缝宽 = 78-40 = 38px，而玩家碰撞盒是 30px → 可用站位只有 **8px**，
//     按走位速度 300px/s 算约 3 帧，键盘延迟一下就没了。
//   · 五道共占 4*78+40 = 352px，而玩家活动范围只有 360px
//     → 两端几乎贴着火柱，贴左墙还会直接站进第一道火里（等于陷阱）。
//   · 相邻两道只隔 0.22s，横穿 78px 却要 0.26s
//     → 「跟着火扫过去、踩进刚熄灭的那一道」根本追不上，
//       于是只剩「一次站进 8px 缝隙」这一条路，没有第二次机会。
//
// 新值把三条路都打开（见各处注释）。
const SWEEP_COUNT=5;      // 几道（招式身份，不要改）
const SWEEP_WIDTH=26;     // 每道宽
const SWEEP_SPACING=90;   // 相邻两道中心距 → 缝宽 = 90 - 26 = 64px
const SWEEP_X0=-260;      // 第一道中心相对 arena 的偏移
const SWEEP_HEIGHT=210;   // 火柱高
const SWEEP_STEP=.40;     // 相邻两道的点火间隔（秒）
const SWEEP_SPAN=.34;     // 每道持续燃烧（秒）

export class FinalDuel{
  constructor(){this.phase='idle';this.age=0;this.hits=0;this.maxHits=9;this.attack=null;this.entities=[];this.chain=[];this.power=0;this.held=false;this.orb=null;this.sequence=0;this.move=0;this.stage=0;this.arena=0;this.left=0;this.right=0;}
  // Every lost health segment increases pressure, including inside each phase.
  get spec(){return {...FINAL_PHASES[this.stage],warning:1-this.hits*.038,speed:425+this.hits*19,chargeGap:.48-this.hits*.04,linkGap:.2-this.hits*.016,recovery:.48-this.hits*.04,fall:.5-this.hits*.012};}
  // 场地边界与 arena 一起读进来，作为**单一事实来源**。
  // 之前 -260 / +100 这两个数散在 physics（钳制）和 renderer（画地板）里各写一遍，
  // 改宽度要记得改两处；横扫地火的几何又依赖这个宽度，三处联动迟早漏一处。
  begin(game){
    const spec=game.level.finalBoss;
    this.arena=spec.arena;
    this.left=spec.arena+(spec.left??-260);
    this.right=spec.arena+(spec.right??100);
    this.phase='charge';this.age=0;game.emit('final-duel-enter');
  }
  setHeld(value){this.held=!!value;}
  setMove(value){this.move=Math.sign(value);}
  startAttack(game,id){
    this.attack=id;this.phase='aim';this.age=0;this.entities=[];
    const ground=game.groundAt(game.x),x=this.arena+350,S=this.spec;
    const spawn=e=>this.entities.push({...e,age:0,warning:true,hit:false});
    const wave=(kind='low',delay=0,dir=-1)=>{
      const high=kind==='high',tall=kind==='tall';
      spawn({kind,x:dir===1?this.arena-410:x,y:ground-(high?380:tall?170:46),width:high?70:tall?82:64,height:high?336:tall?170:46,speed:S.speed,dir,delay,life:2.7});
    };
    const fall=(xx,width=64,delay=0,trackUntil=0)=>spawn({kind:'rain',x:xx,y:ground-460,width,height:width>100?110:44,delay,trackUntil,fall:S.fall,life:delay+S.fall+.32,ground});
    const pillar=(xx,delay=0,height=270,width=60,span=.42)=>spawn({kind:'eruption',x:xx,y:ground-height,width,height,delay,life:delay+span,ground});
    if(id==='rain'||id==='lance'){
      (id==='lance'?[0]:[-180,0,180]).forEach((off,i)=>fall(game.x+off,id==='lance'?62:64,i*.09));
    }else if(id==='hunt'){
      // Later spears follow independently, then give a fixed red lock before falling.
      [0,.62,1.24].forEach(delay=>fall(game.x,58,delay,Math.max(0,delay-.42)));
    }else if(id==='sunfall'){
      fall(game.x,150);wave('low',.55);
    }else if(id==='siege'){
      [-155,0,155].forEach(off=>fall(game.x+off,66));wave('low',.16);
    }else if(id==='eruption'){
      [-190,0,190].forEach((off,i)=>{
        pillar(game.x+off,i*.12);
        // 单体地火也带序号（renderer 显示点火次序），语义与横扫阵一致。
        this.entities[this.entities.length-1].order=i+1;
      });
    }else if(id==='sweepfire'){
      // The lit trail states the order; cleared columns become the escape route.
      //
      // 三条路都要走得通（参数见文件头的 SWEEP_* 常量）：
      //   ① 站进缝里 —— 64px 缝 / 30px 人 = 34px 容错（旧值 8px）
      //   ② 贴左右墙 —— 五道占 386px、场地 440px，两端各留 12px，不再被火柱盖住
      //   ③ 跟着火扫 —— 间隔 0.34s > 横穿 90px 所需的 0.3s，踩进刚熄灭的那一道来得及
      const reverse=this.sequence%2===0;
      for(let i=0;i<SWEEP_COUNT;i++){
        const order=reverse?SWEEP_COUNT-1-i:i;
        pillar(this.arena+SWEEP_X0+i*SWEEP_SPACING,order*SWEEP_STEP,SWEEP_HEIGHT,SWEEP_WIDTH,SWEEP_SPAN);
        const e=this.entities[this.entities.length-1];
        // 标记这是横扫阵，并带上点火序号。
        //   · renderer 靠 e.sweep 画「安全缝」——五道火占满场地，
        //     光画危险柱读不出哪里安全，这是玩家说「提示不清楚」的根因。
        //   · 编号直接带在实体上，不再由 delay 反推
        //     （旧渲染写死 `Math.round(e.delay/.22)+1`，节奏一改编号全错，
        //       而反扫时编号本身也是反的）。
        e.sweep=true;e.order=order+1;
      }
    }else if(id==='cage'){
      [-108,108].forEach(off=>pillar(game.x+off,0,410,52,1.24));wave('low',.12);
    }else if(id==='edict'){
      spawn({kind:'edict',x:this.arena-80,y:ground-410,width:440,height:366,delay:0,life:.38});
    }else if(id==='crossfire'){
      wave('low');wave('low',.27,1);
    }else if(id==='double'){
      wave('low');wave('low',.82);
    }else wave(id);
    game.emit('final-cast',{attack:id,phase:this.stage});
  }
  body(e){
    if(e.kind==='rain'){
      const fall=Math.max(0,e.age-e.delay)/e.fall;
      const top=e.ground-460+(460-e.height)*fall;
      return {left:e.x-e.width/2,right:e.x+e.width/2,top:fall<1?top:e.ground-42,bottom:fall<1?top+e.height:e.ground};
    }
    return {left:e.x-e.width/2,right:e.x+e.width/2,top:e.y,bottom:e.y+e.height};
  }
  update(game,dt){
    if(['idle','defeated'].includes(this.phase))return;
    this.age+=dt;this.power=this.held?Math.min(1,this.power+dt/.45):Math.max(0,this.power-dt*4);
    if(this.phase==='ascend'){if(this.age>=1.25){this.phase='charge';this.age=0;}return;}
    if(this.phase==='charge'){
      if(this.age<this.spec.chargeGap)return;
      const plan=this.spec.plans[this.sequence%3];this.sequence++;this.chain=[...plan];this.startAttack(game,this.chain.shift());return;
    }
    if(this.phase==='link'){
      if(this.age>=this.spec.linkGap)this.startAttack(game,this.chain.shift());return;
    }
    if(this.phase==='aim'){
      if(this.age<this.spec.warning)return;
      this.phase='attack';this.age=0;this.entities.forEach(e=>{e.warning=e.delay>0;e.age=0;});
    }
    if(this.phase==='attack'){
      this.entities=this.entities.filter(e=>{
        e.age+=dt;
        if(e.trackUntil&&e.age<e.trackUntil)e.x=game.x;
        e.warning=e.age<e.delay;
        if(e.warning)return true;
        if(e.speed)e.x+=(e.dir||-1)*e.speed*dt;
        // 出场边界跟着场地走（左 30 / 右 35 的余量沿用旧值）。
        // 这条同时是「往左跑到墙边躲横波」的依据，所以余量不能省。
        if(e.age>e.life||e.speed&&((e.dir||-1)<0?e.x+e.width/2<this.left-30:e.x-e.width/2>this.right+35))return false;
        const b=this.body(e),top=game.y-(game.slideTime>0?game.level.world.slideHeight:game.level.world.runHeight)+5;
        if(!e.hit&&game.x+15>b.left&&game.x-15<b.right&&top<b.bottom&&game.y-3>b.top){e.hit=true;game.hurt();}
        return true;
      });
      if(this.entities.length)return;
      if(this.chain.length){this.phase='link';this.age=0;return;}
      this.phase='recall';this.age=0;this.power=0;
      const height=[60,120,190][this.stage];
      this.orb={x:this.arena+330,y:game.groundAt(game.x)-height,speed:325+this.hits*5,height};
      game.emit('final-recall',{height});return;
    }
    if(this.phase==='recall'){
      this.orb.x-=this.orb.speed*dt;
      if(Math.abs(this.orb.x-game.x)<42&&Math.abs(this.orb.y-(game.y-36))<36&&this.held&&this.power>=.7){this.phase='holding';this.age=0;game.emit('final-memory-caught',{x:game.x,y:this.orb.y});return;}
      if(this.orb.x<this.arena-360){this.orb=null;this.phase='charge';this.age=0;game.emit('final-memory-missed');}return;
    }
    if(this.phase==='holding'){
      if(!this.held){this.phase='return';this.age=0;game.emit('final-memory-return',{x:game.x,y:game.y-36});}
      else if(this.age>1.6){game.hurt();this.phase='charge';this.age=0;this.orb=null;this.power=0;game.emit('final-memory-overload');}return;
    }
    if(this.phase==='return'&&this.age>=.4){
      this.hits++;this.orb=null;this.power=0;this.phase=this.hits>=this.maxHits?'defeated':'stagger';this.age=0;
      game.emit('final-duel-hit',{hits:this.hits});
      if(this.phase==='defeated')game.emit('final-duel-defeated');
      else if(this.hits%3===0){this.stage++;this.phase='ascend';game.emit('final-phase',{stage:this.stage,name:this.spec.name});}
    }else if(this.phase==='stagger'&&this.age>=this.spec.recovery){this.phase='charge';this.age=0;}
  }
}

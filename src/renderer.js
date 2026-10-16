import { WORLD, OBSTACLES, SHARDS, CHAPTERS, TERRAIN, SPRINGS, RINGS, groundAt, groundHeight, LEVELS } from './level.js';
import { runnerPose } from './animation.js';
import { flameStrength } from './cinematics.js';
import { ribbonMesh } from './ribbon.js';
import { chainPattern, chainLinkGeometry } from './chain-boss.js';
import { BackgroundDepth } from './background-depth.js';
import { endingAsset } from './ending-media.js';

const TAU=Math.PI*2;
function noise(n) { const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function polygon(ctx,points,fill,stroke) {
  ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath();
  if(fill) {ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function line(ctx,points,color,width=1) {
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}

// 失名街区的三段远景配色。刻意比序章更暖、更近、更有生活痕迹：
// 序章是死城，这里是有人住、只是没人记得名字的街区。
// 天色压得比地面暗，保证旧金铜片（#c7a978）仍然是画面里最亮的东西。
const DISTRICT_SKY={
  quarter:['#1d2229','#3b3a38','#6b6152'],   // 医者的旧屋：黄昏，瓦檐与晾衣绳
  bellTower:['#141a24','#2b2c33','#4d4740'], // 报时钟楼：入夜，钟楼剪影压在整条街上
  ferry:['#1a2530','#37414a','#6d7472'],     // 临河渡口：拂晓，水面与雾
  nameBridge:['#101e2a','#293e48','#526b70'],
  supplyRoad:['#1a2c3c','#425968','#899b9a'],
  coldArcade:['#142938','#3d596a','#7a9d9f'],
  shelter:['#21313b','#59675f','#9a9579'],
  windArchive:['#213440','#4e7178','#a0b7a8'],
  tideHarbor:['#172f43','#376981','#80afb3'],
  harvestGranary:['#293138','#686652','#b2a883'],
  sealGate:['#252b41','#4c6170','#8daca9'],
  fateArchive:['#202b3e','#4a697b','#a7bdb2'],
  warGate:['#332b3b','#726469','#bda58e'],
  namePyre:['#202c3b','#546b72','#b3b4a1'],
  greyRefuge:['#283441','#526d77','#a7bdb7'],
  // 第四幕：前两段是还亮着灯的人间（偏暖、有窗火），后两段是正在被点燃、
  // 又正在烧尽的王城（铜红、日冕压在天边）。天色比前三幕更"傍晚到破晓"。
  refugeHall:['#20242c','#3d3a3c','#8a7355'],   // 记名避难所：入夜，屋檐下都是灯
  courtRoad:['#171c26','#33353f','#6d6455'],    // 王庭城道：更冷的夜，石阶泛灰
  throneCity:['#241d24','#5a3f3a','#c08a5c'],   // 王座城：被点燃的暖红
  dawnChest:['#2a1f20','#7a4a34','#e6b276'],    // 尚未成形的太阳：全幕最亮的天色
  finalGate:['#101e2a','#384d5b','#899c98'],
};

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.width=1440;this.height=810;this.time=0;this.particles=[];this.shake=0;this.flash=0;
    this.trail=[];this.waves=[];this.goldFlash=0;this.wardUntil=0;
    this.backgroundDepth=new BackgroundDepth();
    this.finalBackdrop=typeof Image==='undefined'?null:new Image();
    if(this.finalBackdrop)this.finalBackdrop.src=endingAsset('gate');
    // 反击火球：纯视觉的飞行物。命中判定在物理层已经结算，
    // 这里只负责让它从玩家飞向军官，不是可交互实体。
    this.flameLevel=1;
    this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();this.dpr=Math.min(window.devicePixelRatio||1,2);
    const width=Math.round(rect.width*this.dpr),height=Math.round(rect.height*this.dpr);
    // 尺寸没变就别碰 canvas.width：重设它会清空整张画布，而下一帧之前
    // 画布就是一片黑。暂停/对白/转场切换 playing class 时 ResizeObserver
    // 会连发回调，若每次都重设，画面会在这些时刻闪黑（离屏截图更会直接拍成黑图）。
    if(width===this.canvas.width&&height===this.canvas.height){this.width=rect.width/Math.max(1,rect.height)*810;this.heroX=Math.max(120,Math.min(290,this.width*.22));return;}
    this.canvas.width=width;this.canvas.height=height;
    this.height=810;this.width=rect.width/Math.max(1,rect.height)*810;
    this.scale=this.canvas.height/810; this.heroX=Math.max(120,Math.min(290,this.width*.22));
  }
  burst(x,y,count,color,power=1) {
    for(let i=0;i<count;i++) {const a=Math.random()*TAU;const speed=(30+Math.random()*130)*power;this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.35+Math.random()*.5,max:.85,color,size:1+Math.random()*3});}
    if(this.particles.length>220) this.particles.splice(0,this.particles.length-220);
  }
  event(event,player) {
    if(event.type==='jump') this.burst(player.x,player.y-4,event.double?24:12,event.double?'#dec997':'#8a9d8e',event.double?1.5:1);
    if(event.type==='land') this.burst(player.x,player.y,9,'#8a9887',.6);
    if(event.type==='collect') this.burst(event.x,event.y,13,'#e8c988');
    if(event.type==='hit') {this.shake=13;this.flash=.45;this.burst(player.x,player.y-35,30,'#a5574d',1.5);}
    if(event.type==='respawn') {this.particles=[];this.trail=[];this.waves=[];this.wardUntil=0;}
    if(event.type==='checkpoint') this.burst(player.x,player.y-50,40,'#e8cc92',2);
    if(event.type==='jump'||event.type==='land'||event.type==='launch'||event.type==='resonance'||event.type==='checkpoint') {
      this.waves.push({x:event.x??player.x,y:event.y??player.y-4,life:0,max:event.type==='resonance'?1:.55,air:event.double||event.type==='resonance',color:event.type==='launch'?'#87c8bb':'#dfbd7a'});
    }
    if(event.type==='launch')this.burst(player.x,player.y,35,'#8acbbb',1.8);
    if(event.type==='resonance'){this.burst(event.x,event.y,50,'#f4ce85',2);this.goldFlash=.45;}
    if(event.type==='checkpoint')this.goldFlash=.35;
    // 记名桥机关：进门、破盾、反击命中、击退各给一次明确的画面反馈。
    // 反馈强度递增——破盾最亮，因为它才是"该去捡道具了"的信号。
    if(event.type==='boss-enter'){this.shake=8;this.flash=.3;this.burst(event.x,event.y,30,'#a5574d',1.4);}
    if(event.type==='boss-cast'){this.shake=6;this.burst(event.x,event.y,16,'#e08a5f',1.1);}
    if(event.type==='boss-broken'){this.goldFlash=.35;this.burst(event.x,event.y,72,'#fff0bd',2.2);this.waves.push({x:event.x,y:event.y,life:0,max:.7,air:true,color:'#cfe0e4'});}
    if(event.type==='boss-struck'){
      this.burst(event.x,event.y,52,'#f4ce85',2.2);this.goldFlash=.6;this.shake=11;
    }
    // ═══════════════════════════════════════════════════════════════════
    // 第四幕 · 举火引锤
    //
    // 这一幕的正反馈分四层，各自回答一个不同的问题：
    //   strike-start —— 火光在手里亮起，确认"我按了、火举起来了"
    //   strike-miss  —— 几缕灰烬散开（暗色），告诉玩家"离楔太远，没引到"
    //   dawn-bait    —— 楔顶升起一道光柱，确认"他已经朝这根楔来了"
    //   wedge-broken —— 石块崩裂 + 晨光泄出 + 冲击环，是整幕最大的正反馈
    // ═══════════════════════════════════════════════════════════════════
    // ⚠️ 这里**不能**用 `this.player`—— Renderer 从不缓存 player 引用
    //   （只有 event() 的第二个参数是当帧的 player），所以 this.player 是 undefined。
    //   strike 事件自带 x（见 physics 的 emit），y 取当帧 player 的脚底高度。
    if(event.type==='strike-start'){
      this.burst(event.x??player.x,(player.y)-46,12,'#ffe0a8',.8);
    }
    if(event.type==='final-memory-caught'||event.type==='final-memory-return')this.burst(player.x,player.y-36,18,'#b8f0d7',1);
    if(event.type==='final-duel-hit'){this.shake=7;this.goldFlash=.22;this.burst(player.x+460,player.y-110,32,'#edcfa4',1.5);}
    if(event.type==='dawn-exposed'){
      this.burst(player.x,player.y-65,24,'#a5f3dc',.9);
      this.waves.push({x:player.x,y:player.y-40,life:0,max:.6,air:true,color:'#a5f3dc'});
    }
    if(event.type==='seal-inject'){
      this.burst(event.x,event.y-180,24,'#a5f3dc',1);
      this.waves.push({x:event.x,y:event.y-140,life:0,max:.45,air:true,color:'#a5f3dc'});
    }
    if(event.type==='dawn-bait'){
      // 引锤成立：楔顶升起一道金色光柱，指向天上那轮尚未成形的太阳。
      const y=event.y??player.y;
      this.burst(event.x,y-150,20,'#ffd9a0',1.0);
      this.waves.push({x:event.x,y:y-90,life:0,max:.5,air:true,color:'#ffe0a0'});
    }
    if(event.type==='strike-miss'){
      // 砍空：暗色、向下散——"力气用在了空气上"
      this.burst(event.x??player.x,player.y-40,8,'#7d7264',.5);
    }
    if(event.type==='dawn-wedge-broken'){
      const y=event.y??player.y;
      // 石块崩裂（暖褐）
      this.burst(event.x,y-60,34,'#a08256',1.5);
      this.burst(event.x,y-140,26,'#c19a68',1.2);
      // 晨光泄出（亮金，沿柱子向上）
      this.burst(event.x,y-190,40,'#ffe0a0',1.8);
      this.goldFlash=.5;
      this.shake=Math.max(this.shake,9);
      // 冲击环：给"这一下真的砍在什么东西上"一个几何确认
      this.waves.push({x:event.x,y:y-110,life:0,max:.55,air:true,color:'#ffd9a0'});
      this.waves.push({x:event.x,y:y-30,life:0,max:.4,air:false,color:'#e8c088'});
    }
    if(event.type==='dawn-impact'){
      // 命中 / 落空都要有反馈：落空是「你躲对了」，命中是「这一下疼」。
      const x=event.x??player.x,y=event.y??player.y;
      if(event.whiff||event.connected){
        // 砸空 / 砸在楔上：青白冲击环，不震屏
        this.waves.push({x,y:y-20,life:0,max:.45,air:false,color:'#cfe0e4'});
        this.burst(x,y-30,12,'#b6c4be',.7);
      }else if(!event.connected){
        // 纯落空（没打中人也没断楔）
        this.waves.push({x,y:y-16,life:0,max:.35,air:false,color:'#8a9a96'});
      }
    }
    if(event.type==='dawn-stagger'){
      // 王踉跄：金色慢闪 + 轻震，读作「快跑的窗口开了」
      this.goldFlash=Math.max(this.goldFlash,.35);
      this.shake=Math.max(this.shake,6);
    }
    if(event.type==='chain-impact'){this.shake=10;this.burst(event.x,event.y,35,event.connected?'#ffe2a0':'#b6c4be',1.5);}
    if(event.type==='boss-ward'){this.wardUntil=player.elapsed+1.7;this.burst(player.x,player.y-40,28,'#aaf0cd',1.1);}
    if(event.type==='boss-defeated'){this.goldFlash=.8;this.shake=10;this.burst(event.x,player.y-60,80,'#f4ce85',2.4);}
    if(event.type==='boss-relic-missed'){this.burst(player.x+60,player.y-40,14,'#c7a978',.8);}
    if(event.type==='hit'&&!event.falling){this.shake=Math.max(this.shake,13);}
    if(event.type==='warmth'||event.type==='lamp-lit'){this.burst(event.x,event.y,36,'#efc789',1.5);this.waves.push({x:event.x,y:event.y,life:0,max:.7,air:true,color:'#efc789'});}
    if(event.type==='rescue'){this.burst(event.x,event.y,46,'#efc789',1.5);this.waves.push({x:event.x,y:event.y,life:0,max:.8,air:true,color:'#efc789'});}
    if(event.type==='flag'&&event.event==='fate-lock'){this.goldFlash=.5;this.burst(event.x,529,42,'#efc789',1.4);}
  }
  sample(player) {
    this.trail.push({x:player.x,y:player.y,t:player.elapsed,p:{grounded:player.grounded,slideTime:player.slideTime,vy:player.vy,airSpin:player.airSpin,landPose:player.landPose}});
    while(this.trail.length>96)this.trail.shift();
  }
  /**
   * 解析当前要画的关卡数据。菜单与没有关卡的场景回落到序章，
   * 这样序章之外的关卡只要带齐数据就能被画出来，不必改绘制代码。
   */
  viewFor(player) {
    const level=player?.level||LEVELS.prologue;
    const world=level.world||WORLD;
    const terrain=level.terrain||TERRAIN;
    return {
      level, world, terrain,
      // scenery 是可选的：按章节给出这一关自己的远景。
      // 没带的关卡继续用序章那三套（灰烬之城 / 无声圣所 / 神骸之桥），不改动原表现。
      scenery:level.scenery||null,
      chapters:level.chapters||CHAPTERS,
      obstacles:level.obstacles||OBSTACLES,
      shards:level.shards||SHARDS,
      springs:level.springs||SPRINGS,
      rings:level.rings||RINGS,
      items:level.items||[],
      groundAt:(x)=>groundHeight(terrain,x,world.ground),
    };
  }
  render(dt,player,mode,alpha=1,scene=null) {
    const c=this.ctx,w=this.width,h=this.height;
    this.time+=dt;const t=this.time;
    const menu=mode==='menu'||mode==='intro';
    const V=this.view=this.viewFor(player);this.bridgeMemory=player.bridgeMemory||0;
    const {world,terrain,chapters,obstacles,shards,springs,rings,items,groundAt:VgroundAt}=V;
    const actor={...player,x:player.prevX+(player.x-player.prevX)*alpha,y:player.prevY+(player.y-player.prevY)*alpha};
    this.flameLevel+=(flameStrength(player.health)-this.flameLevel)*(1-Math.exp(-dt*7));
    actor.flameLevel=this.flameLevel;
    this.heroX=V.level.brake?Math.min(420,w*.46):Math.max(120,Math.min(290,w*.22));
    const distance=menu?t*22:actor.x;
    const camera=distance-this.heroX;
    c.setTransform(this.scale,0,0,this.scale,0,0);
    c.fillStyle='#17252b';c.fillRect(0,0,w,h);
    c.save();
    if(this.shake>0&&!this.reducedMotion) c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake*.6);
    this.shake=Math.max(0,this.shake-dt*38);
    this.background(c,w,h,distance,t,menu?0:player.chapter);
    if(!menu&&player.finalDuel&&!['idle','defeated'].includes(player.finalDuel.phase)&&this.finalBackdrop?.complete&&this.finalBackdrop.naturalWidth){
      c.save();c.globalAlpha=.76;
      c.drawImage(this.finalBackdrop,0,0,w,Math.max(620,w*9/16));
      const shade=c.createLinearGradient(0,260,0,670);
      shade.addColorStop(0,'rgba(9,20,27,.12)');shade.addColorStop(1,'rgba(9,20,27,.92)');
      c.fillStyle=shade;c.fillRect(0,0,w,h);c.restore();
    }
    this.bridges(c,w,camera,t);
    for(const chapter of chapters) {
      if(chapter.at===0) continue;
      const x=chapter.at-camera;
      if(x>-100&&x<w+100) this.beacon(c,x,VgroundAt(chapter.at),t);
    }
    const end=world.end+170-camera;
    if(end<w+450&&end>-400&&V.level.id==='prologue') this.gate(c,end,world.ground,t,scene?.gate||0);
    this.landmarks(c,camera,w,t,player);
    this.roadGodlock(c,camera,w,t,player,scene);
    for(const o of obstacles) { const x=o.x-camera;if(x+o.width<-100||x>w+100)continue;this.obstacle(c,o,x,t); }
    this.lanternRoute(c,camera,w,t,player);
    this.covenantRoute(c,camera,w,t,player);
    this.fateRoute(c,camera,w,t,player);
    this.routeRelics(c,camera,w,t,player);
    if(!menu)this.ashKeepers(c,camera,w,t,player);
    this.bossStations(c,camera,w,t,player);
    this.wardenBoss(c,camera,w,t,player);
    this.bossCounter(c,camera,w,player);
    for(const s of shards) {
      const x=s.x-camera;
      if(x<-30||x>w+30||(!menu&&player.collected.has(s.id)))continue;
      const y=s.y+Math.sin(t*2+s.x)*3;
      const halo=c.createRadialGradient(x,y,0,x,y,25);halo.addColorStop(0,'#cfa96925');halo.addColorStop(1,'#cfa96900');c.fillStyle=halo;c.fillRect(x-25,y-25,50,50);
      polygon(c,[[x,y-9],[x+5,y],[x,y+9],[x-5,y]],'#e0bf7b','#efdcaa99');
      line(c,[[x-10,y],[x+10,y]],'#dcc38844');
    }
    // 主线物品：铜片一类。比碎片更大更沉，用旧金色而不是碎片的高光色，
    // 让玩家在乱局里一眼分得清「主线」和「可回收的碎屑」。
    for(const item of items) {
      if(item.kind==='coal'||item.kind==='ember')continue;
      const x=item.x-camera;
      if(x<-60||x>w+60||(!menu&&player.items?.has(item.id)))continue;
      const bob=Math.sin(t*1.6+item.x*.01)*2;
      const y=item.y+bob;
      const halo=c.createRadialGradient(x,y,0,x,y,44);halo.addColorStop(0,'#e8c07a30');halo.addColorStop(1,'#e8c07a00');c.fillStyle=halo;c.fillRect(x-44,y-44,88,88);
      polygon(c,[[x-11,y-15],[x+11,y-15],[x+11,y+15],[x-11,y+15]],'#c7a978','#f0dcb0aa');
      line(c,[[x-6,y-8],[x+6,y-8]],'#8a6f43',1.4);
      line(c,[[x-6,y-2],[x+3,y-2]],'#8a6f43',1.4);
      line(c,[[x-6,y+4],[x+5,y+4]],'#8a6f43',1.4);
    }
    if(menu) this.hero(c,w*.65,VgroundAt(camera+w*.65),{grounded:true,slideTime:0,vy:0,invulnerable:0,jumpsLeft:2},t,false);
    else if(scene){
      const sy=VgroundAt(player.x)+scene.offsetY;
      c.save();c.globalAlpha=scene.alpha;
      this.hero(c,this.heroX+scene.offsetX,sy,{...actor,grounded:true,slideTime:0,vy:0,invulnerable:0,airSpin:0,landPose:0,collapse:scene.collapse,flameLevel:scene.flame*(scene.type==='defeat'?1:flameStrength(player.health)),renderScale:scene.scale},t,scene.running);
      c.restore();
    }
    else {
      this.motionTrail(c,camera,{...actor,elapsed:player.elapsed-(1-alpha)/120});
      this.hero(c,this.heroX,actor.y,actor,player.elapsed-(1-alpha)/120,mode==='running'&&(player.finalDuel&&!['idle','defeated'].includes(player.finalDuel.phase)?!!player.finalDuel.move:!(player.braking&&player.grounded)));
      if(V.level.coldZones&&V.level.items.some(i=>i.kind==='coal'&&player.items.has(i.id))){
        const lx=this.heroX-16,ly=actor.y-32;
        line(c,[[lx,ly-19],[lx,ly-6]],'#b6a782',1.5);polygon(c,[[lx-7,ly-6],[lx+7,ly-6],[lx+6,ly+9],[lx-6,ly+9]],'#354547','#c4ad7e');
        if(player.warmth>0)this.smallFlame(c,lx,ly+3,t,11);
      }
    }
    for(const wave of this.waves) {
      wave.life+=dt;const q=wave.life/wave.max;if(q>=1)continue;
      c.save();c.globalAlpha=(1-q)*.65;c.strokeStyle=wave.color;c.lineWidth=2*(1-q)+.5;c.translate(wave.x-camera,wave.y);
      c.beginPath();c.ellipse(0,0,12+q*95,wave.air?12+q*70:3+q*12,0,0,TAU);c.stroke();c.restore();
    }
    this.waves=this.waves.filter(wave=>wave.life<wave.max);
    if(mode==='running' && player.grounded && Math.random()<.6) this.burst(player.x-16,player.y-2,1,player.slideTime>0?'#a99979':'#52655b',.28);
    for(const p of this.particles) {
      if(dt>0) {p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;}
      c.globalAlpha=Math.max(0,p.life/p.max);c.fillStyle=p.color;c.fillRect(p.x-camera,p.y,p.size,p.size);
    }
    c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    this.foreground(c,w,distance,t,menu?0:player.chapter);
    this.embers(c,w,h,t,menu?0:player.chapter);
    c.restore();
    if(this.flash>0) {c.fillStyle=`rgba(142,44,38,${this.flash*.4})`;c.fillRect(0,0,w,h);this.flash=Math.max(0,this.flash-dt);}
    if(this.goldFlash>0){c.fillStyle=`rgba(226,186,100,${this.goldFlash*.15})`;c.fillRect(0,0,w,h);this.goldFlash=Math.max(0,this.goldFlash-dt);}
    const vignette=c.createRadialGradient(w*.52,h*.43,h*.25,w*.52,h*.43,Math.max(w*.72,h*.8));vignette.addColorStop(0,'#02090c00');vignette.addColorStop(1,menu?'#02090c66':'#02090c32');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    if(scene)this.cinematicOverlay(c,w,h,scene,player);
  }
  ashKeepers(c,camera,w,t,player) {
    for(const enemy of player.level.enemies||[]){
      const x=enemy.x-camera,y=this.view.groundAt(enemy.x),state=player.enemyStates.get(enemy.id);
      const charging=state.active&&!state.done;
      const approaching=player.projectiles.some(p=>p.id.startsWith(enemy.id+'-')&&p.x-camera>w-35);
      if(x>w-35&&(charging||approaching)){
        c.fillStyle='#f2ba96';c.font='14px sans-serif';c.textAlign='right';c.fillText('灰弹将至 ↑',w-24,player.y-105);c.textAlign='left';
      }
      if(x< -90||x>w+80)continue;
      c.save();c.translate(x,y);c.globalAlpha=player.x>enemy.x?.35:1;
      // 站在矮灯台上的守灯人，法术从灯台下沿街面射出；不占用跑道碰撞。
      polygon(c,[[-27,0],[-24,-16],[27,-16],[30,0]],'#657371','#9ea59a');
      polygon(c,[[-18,-17],[-13,-56],[1,-74],[16,-55],[21,-17]],'#4c535b','#8b9698');
      polygon(c,[[-12,-55],[0,-71],[12,-55],[9,-42],[-9,-42]],'#253a45','#a0aaa0');
      line(c,[[-7,-52],[5,-52]],'#eead87',3);
      const lift=charging?Math.min(1,state.age/enemy.windup):0;
      line(c,[[7,-37],[-21,-46-lift*10]],'#8f9993',6);
      line(c,[[-23,-13],[-23,-72-lift*10]],'#b8ad90',3);
      if(charging){
        const glow=c.createRadialGradient(-23,-80,2,-23,-80,40);glow.addColorStop(0,'#ffe1b5b0');glow.addColorStop(1,'#ee875000');c.fillStyle=glow;c.fillRect(-65,-122,84,84);
        c.strokeStyle='#f0b58c';c.lineWidth=2;c.beginPath();c.arc(-23,-80,12,0,TAU*Math.min(1,state.age/enemy.windup));c.stroke();
      }
      c.restore();
    }
    for(const shot of player.projectiles||[]){
      const x=shot.x-camera,y=shot.y;if(x< -40||x>w+60)continue;
      const glow=c.createRadialGradient(x,y,1,x,y,32);glow.addColorStop(0,'#f4a776aa');glow.addColorStop(1,'#df754500');c.fillStyle=glow;c.fillRect(x-32,y-32,64,64);
      line(c,[[x+42,y+2],[x+18,y-4],[x,y]],'#e7a37d99',4);
      polygon(c,[[x-13,y],[x-3,y-12],[x+13,y-5],[x+9,y+10],[x-5,y+12]],'#df8b69','#ffe0b0');
      line(c,[[x-6,y],[x+4,y-5]],'#fff1c5',3);
    }
  }
  /**
   * 三位同行者在记名桥的协同点。追索军官始终飞在玩家前方，三人留在桥上各自的关卡口：
   * 常晚站在钟绳旁（敲钟破盾），岑渡守着缆绳（把反击器物送到前方跑道），韩蕙托着一盏小灯（护身）。
   * 每到一个阶段，对应的人会做出动作——这是"NPC 真的参与"在画面上的证据。
   */
  bossStations(c,camera,w,t,player){
    if(this.view.level.boss?.kind==='chain')return;
    const boss=this.view.level.boss;if(!boss)return;
    const B=player.boss;
    if(!B||B.phase==='idle'||(B.phase==='defeated'&&player.x>=56000))return;
    if(boss.kind==='seal'){
      for(let i=0;i<3;i++){
        const x=player.x-camera-170+i*55,y=player.y-105,active=i===B.round;
        c.save();c.globalAlpha=i<B.hits?.35:1;
        polygon(c,[[x-16,y-22],[x+16,y-22],[x+16,y+22],[x-16,y+22]],active?'#829e9b':'#465b6b','#d0ded0');
        c.font='12px serif';c.textAlign='center';c.fillStyle='#e1e7d0';c.fillText(['风','海','眠'][i],x,y+4);c.restore();
      }
      c.textAlign='left';return;
    }
    const stations=boss.stations||[];
    for(const station of stations){
      const index=stations.indexOf(station),worldX=player.x-195+index*58;
      const x=worldX-camera;if(x<-90||x>w+90)continue;
      const y=this.view.groundAt(worldX);
      const kind=station.kind==='rope'?'ferry':station.kind==='bell'?'bell':'healer';
      // 当前阶段轮到谁：钟在破盾时响，缆绳在窗口出现时绷紧，护身在被打中时亮。
      let acting=false;
      if(B){
        if(station.kind==='bell')acting=B.phase==='shield'||B.phase==='window';
        if(station.kind==='rope')acting=B.phase==='window';
        if(station.kind==='ward')acting=B.ward===true&&player.inBossFight;
      }
      // 缆绳：岑渡拽着的一端始终在岸边，另一端随奔跑向前甩出，
      // 托盘里的器物顺着缆绳滑到玩家前方的跑道上——绷紧时会亮。
      // 落点跟着玩家的前进方向走（而不是固定的桥心），这才是"边跑边送到手边"。
      if(station.kind==='rope'&&acting&&player.bossRelic&&!player.bossRelic.gone){
        const pull=acting?1:.35;
        const slack=acting?0:26;
        const endX=acting&&player.bossRelic?player.bossRelic.x-camera:x+Math.min(300,w*.42)-slack;
        c.strokeStyle=acting?'#cdb87a':'#7d8471';
        c.lineWidth=acting?3:2;
        c.beginPath();c.moveTo(x-6,y-62);c.quadraticCurveTo(x+120,y-16-pull*30,endX,y-6);c.stroke();
        c.strokeStyle='#5c6553';c.lineWidth=2;
        c.beginPath();c.moveTo(x-6,y-62);c.quadraticCurveTo(x+120,y-6-pull*22,endX,y-6);c.stroke();
      }
      // 小灯：韩蕙手上托着的护身灯，玩家处于无敌帧时是个亮点。
      if(station.kind==='ward'&&acting){
        const glow=c.createRadialGradient(x+30,y-70,1,x+30,y-70,acting?145:52);
        glow.addColorStop(0,acting?'#ffe8b3e0':'#e0b87855');glow.addColorStop(1,'#e0b87800');
        c.fillStyle=glow;c.beginPath();c.arc(x+30,y-70,acting?145:52,0,TAU);c.fill();
      }
      if(station.kind==='ward'&&acting){
        c.save();c.strokeStyle='#ffe6aacc';c.lineWidth=3;
        c.beginPath();c.moveTo(x+30,y-70);c.quadraticCurveTo(x+65,y-125,player.x-camera,player.y-45);c.stroke();
        c.fillStyle='#fff3c9';c.fillRect(x+24,y-79,12,19);c.restore();
      }
      // 钟绳：常晚拽着的那根绳，敲钟时绳身绷直。
      if(station.kind==='bell'){
        const swing=acting?Math.sin(t*9)*7:Math.sin(t*.9)*2;
        line(c,[[x-34,y-186],[x-34+swing,y-70]],'#a8987066',3);
        polygon(c,[[x-46,y-186],[x-14,y-186],[x-18,y-160],[x-42,y-160]],acting?'#7a6a45':'#5b5541','#a9976977');
        if(acting){
          c.strokeStyle='#f0d08a';c.lineWidth=2;
          c.beginPath();c.arc(x-30,y-150,16+Math.sin(t*9)*4,0,TAU);c.stroke();
          c.beginPath();c.arc(x-30,y-150,30+Math.sin(t*9)*6,0,TAU);c.stroke();
        }
      }
      this.npc(c,x,y,kind,t,acting?1:.72);
      c.fillStyle='#c8c6a2';c.font='11px serif';c.textAlign='center';
      c.fillText(station.name,x,y-96);
      if(acting){c.fillStyle='#f0d08a';c.font='10px serif';c.fillText(station.kind==='ward'?'护身灯':station.kind==='bell'?'敲钟破盾':'送回火印',x,y-110);}
    }
    if(B.phase==='shield'&&B.stunned){
      const q=Math.min(1,(B.age-boss.shield*.45)/(boss.shield*.55));
      const start=player.x-225-camera,end=B.x-camera;
      c.save();c.globalAlpha=1-q;c.strokeStyle='#ffe5a4';c.lineWidth=5;
      for(let i=0;i<3;i++){
        const x=start+(end-start)*Math.min(1,q*2+i*.13);
        c.beginPath();c.ellipse(x,player.y-125,22+i*10,65+i*20,0,0,TAU);c.stroke();
      }
      c.font='bold 18px serif';c.fillStyle='#fff0c9';c.textAlign='center';
      c.fillText('钟鸣 · 护盾已碎',end,B.y-210);c.restore();
    }
    c.textAlign='left';
  }
  /**
   * 记名桥的追索军官。
   *
   * 读招靠三件事同时发生：头顶蓄光条、剑锋抬手、脚下的预警弧。
   * 三个阶段各有独立轮廓——蓄光（举剑）、护盾（一圈硬光）、破盾（盾面碎裂）。
   * 不打玩家自己，伤害全部来自他那道贴地法术。
   */
  bossProjectiles(c,camera,w,t,player){
    // 法术：贴地飞行的赤色光刃，与守灯人灰弹共用"危险"色但更长更亮。
    for(const shot of player.bossShots||[]){
      const sx=shot.x-camera,sy=shot.y;
      if(shot.kind==='fall'){
        const floor=this.view.groundAt(shot.x),q=Math.min(1,shot.age/shot.warning),active=q>=1;
        c.save();c.strokeStyle='#ecaaeb';c.lineWidth=2.5;
        c.beginPath();c.ellipse(sx,floor-3,36,9,0,0,TAU);c.stroke();
        c.save();c.translate(sx,floor-176);c.rotate(t*.7);
        c.globalAlpha=active?.35:.45+.55*q;
        c.beginPath();c.arc(0,0,20,0,TAU);c.stroke();
        polygon(c,[[0,-28],[23,14],[-23,14]],null,'#ecb8f2');
        polygon(c,[[0,28],[-23,-14],[23,-14]],null,'#ecb8f2');c.restore();
        for(let i=0;i<7;i++){
          const angle=i*TAU/7+t*.4;
          const xx=sx+Math.cos(angle)*32,yy=floor-4+Math.sin(angle)*7;
          polygon(c,[[xx,yy-4],[xx+3,yy],[xx,yy+4],[xx-3,yy]],'#e6b7ef');
        }
        const fire=c.createLinearGradient(0,floor-160,0,floor);
        fire.addColorStop(0,'#fff0fd');fire.addColorStop(.38,'#d58beb');fire.addColorStop(1,'#99419bb0');
        c.fillStyle=fire;c.globalAlpha=active?1:.12+.15*q;
        c.beginPath();c.moveTo(sx-36,floor);
        c.bezierCurveTo(sx-30,floor-38,sx-36,floor-92,sx-27,floor-153);
        c.quadraticCurveTo(sx-21,floor-114,sx-14,floor-90);
        c.quadraticCurveTo(sx-11,floor-131,sx,floor-160);
        c.quadraticCurveTo(sx+15,floor-131,sx+14,floor-91);
        c.quadraticCurveTo(sx+23,floor-120,sx+29,floor-154);
        c.bezierCurveTo(sx+34,floor-82,sx+30,floor-38,sx+36,floor);c.closePath();c.fill();
        c.globalAlpha=active?.9:.3+.5*q;
        line(c,[[sx-31,floor-14],[sx-25,floor-98],[sx-27,floor-153]],'#f1c4fa',2);
        line(c,[[sx+31,floor-14],[sx+25,floor-98],[sx+29,floor-154]],'#f1c4fa',2);
        c.restore();continue;
      }
      if(shot.kind==='high'){
        const bottom=this.view.groundAt(shot.x)-48;
        c.save();c.fillStyle='#8fbfff44';c.fillRect(sx-15,0,30,bottom);
        line(c,[[sx-15,0],[sx-15,bottom],[sx+15,bottom],[sx+15,0]],'#b6d9ff',3);
        for(let yy=bottom-30;yy>0;yy-=55)line(c,[[sx-9,yy-14],[sx+9,yy]],'#d5ebff99',2);
        c.fillStyle='#e5f3ff';c.font='bold 14px sans-serif';c.textAlign='center';c.restore();continue;
      }
      if(shot.kind==='wave'){
        const floor=this.view.groundAt(shot.x);c.save();
        const foam=c.createLinearGradient(0,floor-85,0,floor);foam.addColorStop(0,'#d5ffefbb');foam.addColorStop(1,'#4798b27a');c.fillStyle=foam;c.fillRect(sx-22,floor-85,44,85);
        line(c,[[sx-22,floor-79],[sx-8,floor-88],[sx+8,floor-77],[sx+22,floor-84]],'#ddfff3',4);
        c.font='bold 13px sans-serif';c.fillStyle='#d5ffef';c.textAlign='center';c.restore();continue;
      }
      if(sx<-60||sx>w+70)continue;
      const glow=c.createRadialGradient(sx,sy,1,sx,sy,40);
      glow.addColorStop(0,'#f2b48caa');glow.addColorStop(1,'#d96b3a00');
      c.fillStyle=glow;c.fillRect(sx-40,sy-40,80,80);
      line(c,[[sx+58,sy+3],[sx+22,sy-3],[sx,sy]],'#e7a37d99',5);
      polygon(c,[[sx-16,sy],[sx-2,sy-15],[sx+16,sy-6],[sx+10,sy+13],[sx-7,sy+15]],'#e08a5f','#ffe0b0');
      line(c,[[sx-8,sy+1],[sx+5,sy-6]],'#fff1c5',3.4);
    }
  }
  chainWarden(c,camera,w,t,player){
    const B=player.boss;if(!B||B.phase==='idle')return;
    const x=B.x-camera,y=606,anchor=B.anchorX-camera,target=B.targetX-camera;
    const pattern=chainPattern(player.level.boss,B);
    this.bossProjectiles(c,camera,w,t,player);
    c.save();c.lineCap='round';
    // A heavy, jointed mechanism rather than the floating officer from Act I.
    const defeated=B.phase==='defeated',drop=defeated?100:0;
    c.translate(x,drop);
    polygon(c,[[-97,y],[-77,440],[-28,440],[-31,y]],'#56636a','#c0b59b');
    polygon(c,[[31,y],[28,440],[77,440],[97,y]],'#46535c','#c0b59b');
    polygon(c,[[-106,438],[-92,292],[0,258],[92,292],[106,438]],'#5e6c70','#bdac8c');
    for(let i=0;i<3;i++){
      c.strokeStyle=i<B.hits?'#3c494d':'#e0c67e';c.lineWidth=7;
      c.beginPath();c.ellipse(-52+i*52,360,13,23,0,0,TAU);c.stroke();
      c.font='12px serif';c.textAlign='center';c.fillStyle=i<B.hits?'#88928a':'#f0ddac';c.fillText(['风','潮汐','丰收'][i],-52+i*52,407);
    }
    polygon(c,[[-43,284],[-38,218],[0,197],[39,218],[43,284]],'#384b54','#aaa487');
    line(c,[[-25,248],[25,248]],defeated?'#4d5651':'#f2bd79',6);
    if(B.phase==='guard'){
      c.fillStyle=pattern.attack==='high'?'#b6d9ff':'#ffc08d';c.font='bold 15px sans-serif';c.textAlign='center';
      c.fillText((pattern.attack==='high'?'光幕':'光刃')+(B.charged?'':'蓄能 '+Math.max(0,1-B.age).toFixed(1)),0,170);
      c.strokeStyle=c.fillStyle;c.lineWidth=3;c.beginPath();c.arc(0,248,22,0,TAU*Math.min(1,B.age));c.stroke();
    }
    const locked=B.phase==='locked',impact=B.phase==='impact'&&B.age<.24;
    const hammerX=impact?target-x:locked?-170:-112;
    const hammerY=impact?588:locked?180:330;
    line(c,[[-91,315],[-135,275],[hammerX,hammerY-20]],'#a39e8a',21);
    c.fillStyle='#7b8580';c.strokeStyle='#e4c68c';c.lineWidth=3;
    c.fillRect(hammerX-54,hammerY-30,108,42);c.strokeRect(hammerX-54,hammerY-30,108,42);
    c.restore();c.save();
    if(!defeated&&Number.isFinite(anchor)){
      const broken=B.connected&&['impact','recover'].includes(B.phase);
      c.strokeStyle=broken?'#bda66b44':'#ddc080';c.lineWidth=6;c.setLineDash([12,8]);
      const link=chainLinkGeometry(B,camera);
      c.beginPath();c.moveTo(link.start.x,link.start.y);c.quadraticCurveTo(link.control.x,link.control.y,link.end.x,link.end.y);c.stroke();c.setLineDash([]);
      polygon(c,[[anchor-30,606],[anchor-20,571],[anchor+20,571],[anchor+30,606]],broken?'#665f50':'#c69d56','#fff0b0');
      if(!broken){c.strokeStyle='#ffe69b';c.lineWidth=3;c.strokeRect(anchor-pattern.tolerance,562,pattern.tolerance*2,43);}
      c.font='bold 15px sans-serif';c.textAlign='center';c.fillStyle='#ffe2a0';
      const lockName=['风','潮汐','丰收'][Math.min(2,broken?B.hits-1:B.hits)];
      c.fillText(broken?`${lockName}神锁已解`:`${lockName}锁桩`,anchor,500);
    }
    if(['aim','locked'].includes(B.phase)){
      c.strokeStyle=locked?'#ff8779':'#ffe39d';c.fillStyle=locked?'#e9534429':'#edc6711a';c.lineWidth=3;
      c.fillRect(target-90,170,180,436);c.setLineDash(locked?[]:[7,8]);c.strokeRect(target-90,170,180,436);c.setLineDash([]);
      c.beginPath();c.ellipse(target,600,90,15,0,0,TAU);c.stroke();
      c.font='bold 16px sans-serif';c.textAlign='center';c.fillStyle=locked?'#ffc1ad':'#ffe5b0';
      c.fillText(locked?`落锤 ${Math.max(0,pattern.lock-B.age).toFixed(1)} 秒`:`瞄准中 ${Math.max(0,pattern.aim-B.age).toFixed(1)} 秒`,target,151);
    }
    if(B.phase==='impact'){
      for(const wave of pattern.waves){const before=wave.at-B.age;if(before<0||before>.6)continue;
        const high=wave.height>120;
        c.fillStyle=high?'#c795ef':'#f1b15d';c.fillRect(0,602,w,4);c.globalAlpha=(.6-before)/.6*.65;
        c.fillRect(0,606-wave.height,w,wave.height);c.globalAlpha=1;c.font='bold 16px sans-serif';c.textAlign='center';c.fillStyle=high?'#e8c9ff':'#ffe6b7';c.fillText(`${high?'高震波':'震波'} ${before.toFixed(1)} 秒`,w*.46,high?425:470);
      }
      for(const wave of pattern.waves){const since=B.age-wave.at;if(since>=0&&since<.3){c.strokeStyle=wave.height>120?'#e8c9ff':'#fff0c0';c.lineWidth=6;c.beginPath();c.ellipse(player.x-camera,603,80+since*1600,wave.height*.3+since*110,0,Math.PI,TAU);c.stroke();}}
    }
    c.restore();
  }
  /**
   * 第四幕 · 执炬王。
   *
   * 这一幕的机制是"王在身后追、把落锤引到挡路的楔上"，所以屏幕上必须同时
   * 读得出三件事，缺一条玩家就会"莫名挨锤"：
   *   1. 王本人 —— 悬浮在身后 chase.lead 处，举锤时锤头朝玩家，落锤时砸向落点。
   *   2. 落点预警 —— aim 阶段就画出锤将落下的纵向光带；锁定后转红。
   *   3. 楔 —— 挡路的供能构件，锤中一次就裂一次，碎了才通。
   * 三者都读运行时的 game.dawn（相位/落点/已碎集合），不读关卡静态坐标。
   */
  dawnKing(c,camera,w,t,player){
    const spec=this.view.level.dawn,D=player.dawn;
    if(!spec||!D)return;
    const chase=D.chase;
    const broken=D.broken||new Set();
    const ground=this.view.groundAt;

    // ---- 楔：挡路的实体，先画，让王与预警压在它上面 ----
    for(const wedge of spec.wedges||[]){
      const x=wedge.x-camera;if(x<-160||x>w+200)continue;
      const gy=ground(wedge.x),isBroken=broken.has(wedge.id);
      c.save();
      if(isBroken){
        // 碎了：只剩底座与向两侧倒下的残片。
        c.globalAlpha=.55;
        polygon(c,[[x-34,gy],[x-20,gy-30],[x+20,gy-30],[x+34,gy]],'#6b5a45','#8d7a5c');
        polygon(c,[[x-58,gy],[x-40,gy-14],[x-24,gy+4],[x-42,gy+8]],'#4e4230');
        polygon(c,[[x+58,gy],[x+40,gy-14],[x+24,gy+4],[x+42,gy+8]],'#4e4230');
        c.font='12px serif';c.textAlign='center';c.fillStyle='#9d8f74';c.fillText('楔已断',x,gy-42);
      }else{
        // 未碎：一根楔进地面的仪式构件，顶部透出尚未成形的日光。
        const glow=c.createLinearGradient(0,gy-260,0,gy);
        glow.addColorStop(0,'#ffd9a000');glow.addColorStop(.6,'#ffce9140');glow.addColorStop(1,'#c88a4a55');
        c.fillStyle=glow;c.fillRect(x-46,gy-260,92,260);
        polygon(c,[[x-20,gy],[x-30,gy-150],[x-14,gy-232],[x,gy-262],[x+14,gy-232],[x+30,gy-150],[x+20,gy]],'#7a6247','#d9b478');
        line(c,[[x-6,gy-30],[x-9,gy-130],[x-3,gy-210],[x,gy-248]],'#ffe0abaa',2.5);
        line(c,[[x+7,gy-30],[x+9,gy-130],[x+6,gy-206]],'#ffe0ab77',1.5);
        const reach=spec.strike?.reach??320;
        const inRange=player.blockingWedge?.id===wedge.id&&Math.abs(player.x-(wedge.x-40))<=reach;
        const open=D.phase==='exposed',hits=D.sealHits?.[wedge.id]||0;
        c.strokeStyle=open?'#8ce4cd':'#d9b478';c.lineWidth=2;
        if(inRange){
          c.setLineDash(open?[]:[5,6]);
          line(c,[[x-40-reach,gy-6],[x-40,gy-6]],open?'#8ce4cd':'#d9b478',3);c.setLineDash([]);
        }
        c.font='14px serif';c.textAlign='center';c.fillStyle=open?'#a5f3dc':'#e7c894';
        c.fillText('黎明楔',x,gy-278);
        for(let i=0;i<(spec.baitWedges?0:2);i++){
          polygon(c,[[x-21+i*28,gy-190],[x-13+i*28,gy-202],[x-5+i*28,gy-190],[x-13+i*28,gy-178]],i<hits?'#9cf5d6':'#443526','#d9b478');
        }
        if(inRange&&open&&!spec.baitWedges){c.font='bold 16px serif';c.fillStyle='#a5f3dc';c.fillText('E',x,gy-305);}

      }
      c.restore();
    }

    // ---- 仪式星火：门闩充能资源 ----
    for(const s of player.sparks||[]){
      const x=s.x-camera;if(x<-40||x>w+40)continue;
      const y=s.y??ground(s.x)-46;
      c.save();c.globalCompositeOperation='lighter';
      const flick=1+Math.sin(t*9+s.x*.05)*.2;
      const glow=c.createRadialGradient(x,y,0,x,y,28*flick);
      glow.addColorStop(0,'rgba(255,230,140,.7)');
      glow.addColorStop(.5,'rgba(255,180,70,.3)');
      glow.addColorStop(1,'rgba(255,140,40,0)');
      c.fillStyle=glow;c.fillRect(x-32,y-32,64,64);
      c.restore();
      c.fillStyle='#ffe6a0';
      c.beginPath();c.arc(x,y,8*flick,0,TAU);c.fill();
      c.font='11px serif';c.textAlign='center';c.fillStyle='#ffe6a8';
      c.fillText('星火',x,y-18);
    }

    // ---- 逆火余烬：第四幕的专属资源 ----
    //
    // 画成落地未熄的碎火，和"记忆碎片"（圆润的金色小点）明确区分：
    // 余烬是三瓣跳动的火苗、有向下的尾焰，颜色偏橙红而不是旧金。
    // 玩家必须一眼分出"这是要捡的资源"和"那是连忆碎片"，
    // 否则冲刺机制就没有可读的提示。
    for(const e of player.embers||[]){
      const x=e.x-camera;if(x<-60||x>w+60)continue;
      c.save();
      c.globalCompositeOperation='lighter';
      const flick=1+Math.sin(t*7+e.x*.03)*.18;
      const glow=c.createRadialGradient(x,e.y,0,x,e.y,46*flick);
      glow.addColorStop(0,'rgba(255,196,120,.62)');
      glow.addColorStop(.45,'rgba(226,126,64,.28)');
      glow.addColorStop(1,'rgba(190,80,40,0)');
      c.fillStyle=glow;c.fillRect(x-50,e.y-50,100,100);
      // 三瓣火苗，向上收尖、向下留一段尾焰。
      for(let i=-1;i<=1;i++){
        const bx=x+i*7,by=e.y+Math.abs(i)*4;
        const sway=Math.sin(t*6+i*2.1)*2.4;
        c.beginPath();
        c.moveTo(bx,by+11);
        c.quadraticCurveTo(bx-7+sway,by-2,bx+sway,by-15*flick);
        c.quadraticCurveTo(bx+7+sway,by-2,bx,by+11);
        c.fillStyle=i===0?'#ffe0a8':'#e5954e';c.fill();
      }
      c.restore();
      c.font='10px serif';c.textAlign='center';c.fillStyle='#e8b884';
      c.fillText('余烬',x,e.y-30);
    }

    // ---- 逆火冲刺：玩家身后的火光拖尾 ----
    // 冲刺时给一段明确的速度感反馈。没有它，+250px/s 只是数字变化。
    if(player.dashTime>0){
      const px=player.x-camera,py=player.y-36;
      c.save();c.globalCompositeOperation='lighter';
      const trail=c.createLinearGradient(px-150,0,px+10,0);
      trail.addColorStop(0,'rgba(255,150,70,0)');
      trail.addColorStop(1,'rgba(255,206,140,.5)');
      c.fillStyle=trail;c.fillRect(px-150,py-14,160,28);
      for(let i=0;i<9;i++){
        const off=(i/9)*130+Math.sin(t*18+i)*4;
        c.fillStyle=`rgba(255,${190-i*8},${120+i*6},${.55-i*.05})`;
        c.fillRect(px-off,py-3+Math.sin(t*14+i*1.7)*5,11,3);
      }
      c.restore();
    }

    // Every live body is rendered in every combat phase, using simulation coordinates.
    const def=spec.moves?.[D.move];
    if(!['idle','defeated'].includes(D.phase)){
      c.save();
      c.fillStyle='#0b141bd9';c.fillRect(28,112,340,56);
      c.textAlign='left';c.fillStyle=D.phase==='exposed'?'#a5f3dc':'#e9cda4';c.font='18px serif';
      const title=D.phase==='exposed'?'王势已尽 · 回灌星火':D.phase==='stagger'?'仪式反冲 · 继续前进':def?.name||'逼近黎明楔';
      c.fillText(`${Math.min(3,broken.size+1)} / 3  ${title}`,42,137);
      const duration=D.phase==='exposed'?3.2:(D.aim||1);
      const left=D.phase==='exposed'?3.2-D.age:player.dawnAimLeft;
      if(D.phase==='aim'||D.phase==='exposed'){
        c.fillStyle='#4c4340';c.fillRect(42,152,310,4);
        c.fillStyle=D.phase==='exposed'?'#a5f3dc':'#e9cda4';
        c.fillRect(42,152,310*Math.max(0,Math.min(1,left/duration)),4);
      }
      c.restore();
    }
    for(const e of player.dawnEntities||[]){
      const ex=e.x-camera,gy=ground(e.x),warning=e.telegraph;
      if(ex<-220||ex>w+220)continue;
      c.save();
      const ready=warning?Math.max(0,Math.min(1,1-player.dawnAimLeft/(D.aim||1))):1;
      if(e.kind==='hammer'){
        c.fillStyle=e.locked?'#f2786240':'#e9c57d25';c.fillRect(ex-e.radius,gy-430,e.radius*2,430);
        c.strokeStyle=e.locked?'#ff967f':'#efd6a0';c.lineWidth=2;c.strokeRect(ex-e.radius,gy-430,e.radius*2,430);
        const yy=warning?gy-380:gy-30;
        polygon(c,[[ex-70,yy-38],[ex+70,yy-38],[ex+90,yy+15],[ex-90,yy+15]],'#715044','#ffe0a1');
        c.font='16px serif';c.textAlign='center';c.fillStyle='#ffe4b1';c.fillText(e.locked?'落点已定 · 后撤 ←':'引到楔前',ex,gy-450);
      }else if(e.kind==='cinder'||e.kind==='meteor'){
        const landed=!warning&&e.age>=e.landIn;
        c.strokeStyle=warning?'#dfaa72':'#ff9267';c.lineWidth=2;
        c.setLineDash(warning?[6,6]:[]);
        c.beginPath();c.ellipse(ex,gy-3,e.radius,10,0,0,TAU);c.stroke();c.setLineDash([]);
        if(!landed){
          const fall=warning?0:Math.min(1,e.age/e.landIn);
          const yy=gy-300+fall*276;
          line(c,[[ex,yy-58],[ex,yy]],warning?'#ffd09266':'#ffb075',5);
          polygon(c,[[ex-16,yy-9],[ex-6,yy-25],[ex+14,yy-17],[ex+20,yy+7],[ex,yy+19],[ex-18,yy+6]],'#af6344',warning?'#d6b183':'#ffe2a0');
          if(warning){c.globalAlpha=.25+ready*.4;line(c,[[ex,yy+24],[ex,gy-18]],'#ffba84',1);}
        }else{
          for(let i=-2;i<=2;i++){
            const fx=ex+i*16;
            polygon(c,[[fx-12,gy],[fx-10,gy-18],[fx+Math.sin(t*12+i)*4,gy-e.height],[fx+12,gy-15],[fx+14,gy]],'#e28c5599','#ffb773');
          }
        }
      }else{
        const top=gy-e.height,bottom=gy-(e.clearance||0),hw=e.width/2;
        c.globalAlpha=warning?.25+ready*.4:(e.age<(e.delay||0)?.25:1);
        const col=e.kind==='sweep'?'#a7d9ef':e.kind==='pulse'?'#d6a5f6':'#ffb079';
        // Curved, serrated fire fronts; the ground shadow shows their true width.
        c.fillStyle=e.kind==='pulse'?'#a76bc955':'#b47b4d55';c.strokeStyle=col;c.lineWidth=2.5;
        c.beginPath();c.moveTo(ex-hw,bottom);c.quadraticCurveTo(ex-hw-8,(top+bottom)/2,ex+hw*.35,top);
        c.lineTo(ex,top+18);c.lineTo(ex+hw,top+8);c.quadraticCurveTo(ex+hw*.6,(top+bottom)/2,ex+hw,bottom);c.closePath();c.fill();c.stroke();
        line(c,[[ex-hw,gy+2],[ex+hw,gy+2]],col,2);
        if(warning){c.font='12px serif';c.textAlign='center';c.fillStyle=col;c.fillText('蓄势',ex,top-16);}
      }
      c.restore();
    }

    // ---- 王本人 + 追兵 ----
    if(!chase&&D.phase==='idle')return;
    const kingX=(D.x??(player.x+(spec.chase?.lead??560)))-camera;
    const swing=D.phase==='impact'?Math.max(0,1-D.age/.28):0;
    // 屏幕外也要给方向提示：玩家不该被一个看不见的东西打死。
    if(kingX<-60||kingX>w+60){
      c.fillStyle='#f7c98f';c.font='15px serif';c.textAlign='center';
      c.fillText(`执炬王 ${kingX>w?'→':'←'}`,kingX>w?w-90:90,player.y-150);
      c.textAlign='left';
    }else{
      const kx=kingX,kg=ground(D.x??player.x);
      const fallen=D.phase==='defeated',staggered=D.phase==='stagger';
      const floatY=kg-96+(fallen?48:staggered?Math.sin(Math.min(1,D.age/1.5)*Math.PI)*25:0)-Math.sin(t*1.6)*7;
      c.save();c.translate(kx,floatY);
      // A human figure held in the throne's burning ribs; fracture count visibly changes it.
      for(let side of [-1,1]){
        polygon(c,[[side*38,94],[side*104,65],[side*116,-66],[side*75,-150],[side*82,-38],[side*56,24]],'#302b32','#aa8062');
        line(c,[[side*62,60],[side*87,-20],[side*68,-112]],D.phase==='exposed'?'#9ee6cf':'#dfa778',3);
        polygon(c,[[side*26,-76],[side*68,-54],[side*58,-28],[side*34,-34]],'#5a4242','#ca9a6c');
      }
      for(let i=0;i<3;i++){
        const ax=(i-1)*24;
        line(c,[[ax,70],[ax*.7,10],[ax*.4,-44]],i<broken.size?'#322b32':'#efba77',2);
      }
      polygon(c,[[-17,-90],[-14,-117],[14,-117],[17,-90],[0,-79]],'#171e24','#aa906d');
      line(c,[[-10,-102],[-3,-100]],'#ffe7b3',2);line(c,[[3,-100],[10,-102]],'#ffe7b3',2);
      // 尚未成形的太阳：王身后一轮半透的日冕，随它的动作明灭。
      const pulse=.5+.5*Math.sin(t*2.2);
      const corona=c.createRadialGradient(0,-46,10,0,-46,150);
      corona.addColorStop(0,`rgba(255,206,140,${.26+pulse*.16})`);
      corona.addColorStop(.55,'rgba(226,150,84,.10)');corona.addColorStop(1,'#e2965400');
      c.fillStyle=corona;c.fillRect(-150,-196,300,300);
      c.strokeStyle=`rgba(255,224,170,${.35+pulse*.3})`;c.lineWidth=2;
      c.beginPath();c.arc(0,-46,66,0,TAU);c.stroke();
      for(let i=0;i<12;i++){const a=i/12*TAU+t*.15;
        line(c,[[Math.cos(a)*70,-46+Math.sin(a)*70],[Math.cos(a)*(84+pulse*10),-46+Math.sin(a)*(84+pulse*10)]],`rgba(255,224,170,${.2+pulse*.25})`,2);}
      // 王袍：宽下摆的剪影，刻意比巨像更"人形"，因为它是融合了王座的人。
      polygon(c,[[-46,96],[-34,-30],[-16,-84],[0,-100],[16,-84],[34,-30],[46,96]],'#3b2f3f','#a5866a');
      polygon(c,[[-30,-22],[-22,-92],[22,-92],[30,-22]],'#4a3b48','#c2a077');
      // 熔进王座的冠冕。
      polygon(c,[[-26,-96],[-30,-132],[-12,-116],[0,-146],[12,-116],[30,-132],[26,-96]],'#6e4f3a','#ffd9a0');
      // 招式姿态：不同招式拿不同法器/摆不同姿势，让"他现在要干什么"一眼可读。
      const move=D.move;
      if(move==='stomp'||move==='quake'){
        // 王权落锤：抬锤 / 砸下。
        //
        // ⚠️ 角度**不能写死**。王恒定在玩家身后（`D.x = player.x + chase.lead`），
        // 局部 +x 就是"远离玩家"的方向——早先 aim=-0.85 / impact=0.6 把锤甩向
        // 局部 +x，于是动画里锤朝画面深处挥，而真正的判定（断楔/挨打）
        // 发生在**玩家脚下**。玩家看到的是"锤子挥向虚空"，
        // 于是既不知道锤要砸哪，也看不到"把锤引到楔上"这件事（实测 x=26381 帧）。
        //
        // 现在角度由**真实落点相对王的位置**算出：落点在王左边就往左挥。
        // 这样"王的锤砸向楔"与"锤砸向你脚下"共用同一个视觉方向，
        // 玩家读到的就是真实的判定。
        const hx=D.targetX??player.x;
        // 落点在王左侧 → 目标角度朝 -x。+0.6 弧度会让锤头落在局部 +x 侧。
        const side=Math.sign((hx-camera)-kx)||-1;
        const base=side<0?Math.PI:0;
        const hammerAng=D.phase==='aim'?base-0.85*side:(D.phase==='impact'?base+0.55*side:base-0.3*side);
        c.save();c.translate(-30*side,-64);c.rotate(hammerAng);
        line(c,[[0,0],[0,-96]],'#9a8266',13);
        c.fillStyle='#6f6157';c.strokeStyle='#ffd8a2';c.lineWidth=3;
        c.fillRect(-46,-146,92,38);c.strokeRect(-46,-146,92,38);
        c.restore();
      }else if(move==='sweep'){
        // 火炬横扫：单手举火把横挥，火把轨迹随相位扫开。
        const swing=D.phase==='impact'?1:D.phase==='aim'?0:0;
        const a=-0.5+swing*1.9;
        c.save();c.translate(-24,-60);c.rotate(a);
        line(c,[[0,0],[0,-84]],'#8d7358',10);
        const flare=c.createRadialGradient(0,-92,4,0,-92,42);
        flare.addColorStop(0,`rgba(255,214,150,${.9})`);flare.addColorStop(1,'rgba(255,150,80,0)');
        c.fillStyle=flare;c.fillRect(-46,-138,92,92);
        c.fillStyle='#ffcf96';c.beginPath();c.arc(0,-92,11,0,TAU);c.fill();
        c.restore();
      }else if(move==='cinder'){
        // 黎明射线：双手托起一轮光，光柱从日冕射出。
        c.save();c.translate(0,-108);
        const glow=c.createRadialGradient(0,0,6,0,0,64);
        glow.addColorStop(0,`rgba(255,246,210,${.95})`);glow.addColorStop(1,'rgba(255,214,140,0)');
        c.fillStyle=glow;c.fillRect(-70,-70,140,140);
        c.fillStyle='#fff0c8';c.beginPath();c.arc(0,0,17,0,TAU);c.fill();
        c.strokeStyle='rgba(255,238,190,.75)';c.lineWidth=2;
        for(let i=0;i<8;i++){const a=i/8*TAU+t*.9;
          line(c,[[Math.cos(a)*22,Math.sin(a)*22],[Math.cos(a)*40,Math.sin(a)*40]],'rgba(255,238,190,.6)',2);}
        c.restore();
      }else if(move==='meteor'){
        // 灰烬之雨：王抬手，掌心升起灰烬。
        c.save();c.translate(0,-118);
        for(let i=0;i<7;i++){
          const a=i/7*TAU+t*1.3,r=26+Math.sin(t*2+i)*9;
          c.fillStyle=`rgba(255,${180+i*8},110,${.4+.4*Math.sin(t*3+i)})`;
          c.beginPath();c.arc(Math.cos(a)*r,Math.sin(a)*r-16,3.4,0,TAU);c.fill();
        }
        c.restore();
      }else if(move==='pulse'){
        // 熄日：日冕急速扩张，王本体几乎被吞进光里。
        const burst=D.phase==='impact'?Math.min(1,D.age/.5):(D.phase==='aim'?D.age/Math.max(.001,D.aim):0);
        const R=60+burst*220;
        const g3=c.createRadialGradient(0,-46,20,0,-46,R);
        g3.addColorStop(0,`rgba(255,248,220,${.5+burst*.4})`);
        g3.addColorStop(.5,`rgba(255,170,90,${.24+burst*.3})`);
        g3.addColorStop(1,'rgba(255,120,60,0)');
        c.fillStyle=g3;c.fillRect(-R,-46-R,R*2,R*2);
      }
      c.fillStyle='#f4d5a4';c.font='13px serif';c.textAlign='center';
      c.fillText('执炬王',0,-166);
      // 招式名直接写在王头上——玩家不必猜他要干什么。
      if(def&&D.phase!=='idle'){
        c.fillStyle='#ffd9a0';c.font='bold 12px sans-serif';
        c.fillText(fallen?'仪式已断':D.phase==='exposed'?'回路敞开':staggered?'仪式反冲':def.name,0,-184);
      }
      c.restore();
    }
    // 追兵：贴地的灰潮前锋，屏幕上用一条渐隐的墙表示"它就在你身后"。
    const front=chase?chase.front-camera:-Infinity;
    if(chase&&front>-260&&front<w+80){
      c.save();
      const wall=c.createLinearGradient(front-190,0,front+20,0);
      wall.addColorStop(0,'#0c141a00');wall.addColorStop(1,'#1b2a31cc');
      c.fillStyle=wall;c.fillRect(front-190,120,210,700);
      c.strokeStyle='#8ea6a0aa';c.lineWidth=2;
      for(let i=0;i<10;i++){const yy=210+i*46,x=front-14+Math.sin(t*1.3+i)*11;line(c,[[x-26,yy],[x,yy-16],[x+26,yy]],'#a9c0b8',1.6);}
      c.font='12px serif';c.textAlign='right';c.fillStyle='#b7c9bf';c.fillText('追兵',front-8,196);
      c.restore();
    }
  }
  wardenBoss(c,camera,w,t,player){
    if(this.view.level.finalBoss){this.finalKing(c,camera,w,t,player);return;}
    if(this.view.level.boss?.kind==='chain'){this.chainWarden(c,camera,w,t,player);return;}
    // 第四幕没有 level.boss，走自己的王座渲染；它必须排在 wardenBoss 前面，
    // 否则 dawn 关卡会因为 boss 为空而直接 return，屏幕上什么都不画。
    if(this.view.level.dawn){this.dawnKing(c,camera,w,t,player);return;}
    const boss=this.view.level.boss;if(!boss)return;
    const B=player.boss;if(!B||B.phase==='idle')return;
    // 军官会飞、无视地形：位置与高度都读运行时的 B，不再用关卡数据里的静态坐标。
    const bx=B.x??boss.x, x=bx-camera, y=B.y??this.view.groundAt(bx);
    const ground=this.view.groundAt(bx);
    const round=B.round,defeated=B.phase==='defeated';
    this.bossProjectiles(c,camera,w,t,player);
    if(x<-140||x>w+140){
      // 屏外仍在战斗：给一个方向提示，和守灯人的"灰弹将至"同一语言。
      if(player.inBossFight){
        c.fillStyle='#f2ba96';c.font='14px sans-serif';c.textAlign='right';
        c.fillText((boss.name||'追索军官')+' '+(x>w?'→':'←'),w-24,player.y-140);c.textAlign='left';
      }
      return;
    }
    // 悬浮投影：军官飞在桥上，脚下给一片被拉开的淡影，读得出"他在空中"。
    c.save();c.globalAlpha=defeated?.12:.2;
    c.fillStyle='#0d151a';
    c.beginPath();c.ellipse(x,ground+2,34,7,0,0,TAU);c.fill();
    c.restore();
    c.save();c.translate(x,y);
    c.globalAlpha=defeated?.4:1;
    if(boss.kind==='seal'){
      polygon(c,[[-45,0],[-30,-92],[0,-146],[30,-92],[45,0]],'#43546e','#bdc4cf');
      polygon(c,[[-28,-111],[-31,-157],[-12,-137],[0,-172],[12,-137],[31,-157],[28,-111]],'#5c527b','#cbb2d5');
      line(c,[[-13,-99],[13,-99]],'#cfffea',4);
      for(let i=0;i<3;i++){const yy=-75+i*25;c.strokeStyle=i<B.hits?'#667688':'#d9d4b2';c.lineWidth=3;c.beginPath();c.arc(0,yy,9,0,TAU);c.stroke();}
    }else{
    // 军官：比守灯人高、比普通 NPC 宽，铁灰甲胄加追索军的赤色披带。
    polygon(c,[[-30,0],[-26,-30],[26,-30],[30,0]],'#4a5058','#8d968e');
    polygon(c,[[-24,-31],[-19,-96],[19,-96],[24,-31]],'#3b444d','#848d88');
    // 披带：从右肩斜过胸前，是追索军唯一的身份色。
    polygon(c,[[14,-92],[26,-84],[12,-38],[-2,-42]],'#8a4640','#b7705f');
    // 肩甲
    polygon(c,[[-30,-90],[-8,-104],[10,-100],[6,-86]],'#555f66','#919a91');
    // 头盔与面甲
    polygon(c,[[-13,-98],[-13,-126],[0,-140],[13,-125],[12,-97]],'#2f3a44','#7d8a86');
    line(c,[[-9,-118],[9,-117]],'#e0b781',3);
    // 披风：飞行时被气流拉向身后（左侧），比站姿更有速度感。
    const flap=Math.sin(t*3.4)*4;
    polygon(c,[[-22,-88],[-52-flap,-70],[-60-flap,-30],[-34,-46],[-24,-52]],'#6d3630','#94564a');
    }
    // 佩剑：非蓄光时斜垂在身侧。
    const charging=B.phase==='charge';
    const lift=charging?Math.min(1,B.age/boss.windup):0;
    const shieldUp=B.phase==='shield'||B.phase==='window'||(!B.stunned&&!defeated);
    line(c,[[22,-58],[34,-14]],'#3d4750',7);
    polygon(c,[[18,-64],[30,-70],[38,-18],[26,-12]],'#59636b','#9aa39a');
    // 蓄光：举剑过顶，剑尖聚起赤色光。
    if(charging){
      line(c,[[20,-84],[20,-84-lift*52]],'#b8ad90',5);
      const tipY=-84-lift*52;
      const glow=c.createRadialGradient(20,tipY,2,20,tipY,44+lift*20);
      glow.addColorStop(0,'#ffd1a6c0');glow.addColorStop(1,'#ee875000');
      c.fillStyle=glow;c.fillRect(20-72,tipY-72,144,144);
      c.strokeStyle='#f0b58c';c.lineWidth=2.5;
      c.beginPath();c.arc(20,tipY,13,0,TAU*Math.min(1,B.age/boss.windup));c.stroke();
    }
    // 护盾：一圈硬光罩住军官，直到常晚的钟声把它敲开。
    if(shieldUp){
      const broken=B.stunned;
      const pulse=broken?(B.phase==='shield'?Math.max(0,1-(B.age-boss.shield*.45)/.4):0):1;
      const grow=Math.min(1,(B.shieldAge||0)/.72),ease=1-Math.pow(1-grow,3);
      c.save();c.globalCompositeOperation='lighter';
      if(!broken){c.translate(0,-72);c.scale(.12+.88*ease,.15+.85*ease);c.translate(0,72);c.globalAlpha=.2+.8*grow;}
      c.strokeStyle=broken?`rgba(240,214,150,${.55*pulse})`:'rgba(160,196,208,.5)';
      c.lineWidth=broken?3.4:2.2;
      c.beginPath();c.ellipse(0,-72,52,86,0,-Math.PI/2,-Math.PI/2+TAU*(broken?1:grow));c.stroke();
      if(!broken){
        c.strokeStyle='rgba(160,196,208,.22)';
        c.beginPath();c.ellipse(0,-72,60,96,0,0,TAU);c.stroke();
        c.fillStyle=`rgba(153,211,227,${.07*ease})`;c.beginPath();c.ellipse(0,-72,52,86,0,0,TAU);c.fill();
        for(let i=0;i<6;i++){const a=-Math.PI/2+TAU*grow+i*TAU/6;c.fillStyle='#d6f0f4';c.beginPath();c.arc(Math.cos(a)*52,-72+Math.sin(a)*86,2.4*(1-grow)+.8,0,TAU);c.fill();}
      }else{
        // 碎裂：从盾面飞散的石屑
        for(let i=0;i<(B.phase==='shield'?16:0);i++){const a=i/16*TAU,q=Math.max(0,B.age-boss.shield*.45),rr=52+q*95;c.fillStyle=`rgba(255,230,166,${Math.max(0,1-q/1.3)})`;const xx=Math.cos(a)*rr,yy=-72+Math.sin(a)*rr*1.4;polygon(c,[[xx-7,yy-12],[xx+8,yy-3],[xx+3,yy+13],[xx-4,yy+5]],c.fillStyle);}
      }
      c.restore();
    }
    // 军官的名字与轮次：跑动时也能一眼读出打了几轮。
    c.fillStyle='#e2c49a';c.font='13px serif';c.textAlign='center';
    c.fillText((boss.name||'追索军官')+(defeated?(boss.kind==='seal'?' · 三锁已拆':' · 已击退'):''),0,-190);
    for(let i=0;i<boss.rounds;i++){
      c.fillStyle=i<round?'#f0d08a':'#5f6a63';
      c.beginPath();c.arc(-14+i*14,-172,3.4,0,TAU);c.fill();
    }
    c.textAlign='left';
    c.restore();
    // 地面预警弧：朝玩家方向铺在桥面上，越接近发射越实。
    // 画在军官本体之后（不随他悬空平移），所以它贴着地面。
    if(charging){
      c.save();c.globalCompositeOperation='lighter';
      c.strokeStyle=`rgba(226,138,95,${.22+lift*.5})`;c.lineWidth=2+lift*2;
      c.beginPath();c.ellipse(x-40,ground,150+lift*60,7+lift*5,0,0,TAU);c.stroke();
      c.restore();
    }
  }
  finalKing(c,camera,w,t,player){
    const duel=player.finalDuel;if(!duel)return;
    const active=!['idle','defeated'].includes(duel.phase),px=player.x-camera,gy=player.groundAt(player.x),kx=(duel.arena||this.view.level.finalBoss.arena)+460-camera;
    if(active){
      c.save();const sunX=kx-60,sunY=175;
      const glow=c.createRadialGradient(sunX,sunY,45,sunX,sunY,310);glow.addColorStop(0,['#a8813933','#d37a4544','#eb6c4655'][duel.stage]);glow.addColorStop(1,'#00000000');c.fillStyle=glow;c.fillRect(sunX-310,sunY-310,620,620);
      for(let r=0;r<3+duel.stage;r++){c.strokeStyle='#dba56855';c.lineWidth=2;c.beginPath();c.arc(sunX,sunY,88+r*29,t*.025*(r%2?1:-1),t*.025+Math.PI*1.65);c.stroke();}
      for(let i=0;i<32;i++){const xx=(i*83+t*(10+duel.stage*5))%(w+80)-40,yy=(i*79-t*11)%500;c.fillStyle='#e6b77477';c.fillRect(xx,yy,2,4);}
      // 地板线画在**玩家真正能走到的范围**上，边界与 physics 的钳制同源。
      // 旧版把 -260/+100 在这里又写了一遍：场地一改，画出来的线就和实际走位对不上，
      // 玩家会以为"线外还能走"。
      const lo=duel.left||duel.arena-260,hi=duel.right||duel.arena+100;
      const left=lo-camera,right=hi-camera;line(c,[[left,gy+8],[right,gy+8]],'#9bcbbb88',3);
      c.font='13px serif';c.textAlign='center';c.fillStyle='#b8d6ce';c.fillText('A ← 走位 → D', (left+right)/2,gy+34);c.restore();
    }
    // Opening is an explicit consequence of the player's branch, never a route animation.
    const gateX=this.view.level.finalBoss.arena+390-camera;
    if(gateX>-250&&gateX<w+300){
      c.save();c.fillStyle='#15232bd9';c.strokeStyle='#91aaa2';c.lineWidth=12;
      c.beginPath();c.moveTo(gateX-128,gy);c.lineTo(gateX-128,gy-330);c.quadraticCurveTo(gateX,gy-460,gateX+128,gy-330);c.lineTo(gateX+128,gy);c.closePath();c.fill();c.stroke();
      if(player.doorOpen){const glow=c.createRadialGradient(gateX,gy-220,10,gateX,gy-220,230);glow.addColorStop(0,'#e5d7a575');glow.addColorStop(1,'#a5d8c000');c.fillStyle=glow;c.fillRect(gateX-240,gy-460,480,500);}
      else line(c,[[gateX,gy-355],[gateX,gy-8]],'#ddc494',3);
      c.font='15px serif';c.textAlign='center';c.fillStyle='#d4c9ae';c.fillText('无名之门',gateX,gy-414);c.restore();
    }
    if(!active&&duel.phase!=='defeated')return;
    c.save();c.translate(kx,gy-95+(duel.phase==='defeated'?45:0));
    const crownFire=c.createRadialGradient(0,-105,5,0,-105,96);crownFire.addColorStop(0,'#ffd19588');crownFire.addColorStop(1,'#d6884500');c.fillStyle=crownFire;c.fillRect(-100,-205,200,200);
    polygon(c,[[-52,95],[-36,-28],[-17,-76],[17,-76],[39,-25],[58,95]],'#3b303b','#c79869');
    polygon(c,[[-19,-77],[-18,-120],[18,-120],[19,-77]],'#19242c','#b29a77');
    polygon(c,[[-26,-119],[-32,-156],[-12,-139],[0,-174],[13,-138],[34,-157],[27,-119]],'#987650','#ebd092');
    line(c,[[-11,-103],[-4,-101]],'#ffe2a0',2);line(c,[[4,-101],[11,-103]],'#ffe2a0',2);
    const arm=duel.phase==='aim'?-1.2:duel.phase==='attack'?.45:-.4;
    c.save();c.translate(-34,-42);c.rotate(arm);line(c,[[0,0],[-20,-92]],'#a08162',10);polygon(c,[[-39,-100],[-21,-143],[-4,-98]],'#d5a06e','#ffe0a0');c.restore();
    for(let i=0;i<duel.maxHits;i++){c.fillStyle=i<duel.hits?'#58645e':duel.stage===2?'#ef9977':'#ebc286';c.fillRect(-77+i*18,-193,12,6);}
    c.fillStyle='#e9cea2';c.font='15px serif';c.textAlign='center';c.fillText(duel.phase==='defeated'?'执炬王 · 收炬':'执炬王',0,-214);c.restore();
    // 横扫地火的**安全缝**标记。
    //
    // 为什么必须有：五道火柱几乎占满整个场地，玩家光看危险柱读不出「哪里站得住」,
    // 于是只能等第一次被烧到才知道缝隙在哪——这就是「画面提示不够清楚」。
    // 缝 = 相邻两道之间，画一条虚线并标注「安全」。
    // 配色沿用场地线已有的青玉色 #9bcbbb，不引入新色系。
    // ⚠️ 必须用**全部**地火算缝，不能只挑 warning 中的那些。
    //   已经点着的柱子同样是危险区（火就在柱子里），漏掉它会算出错位的缝：
    //   比如 p4 点燃后，只有 [p0,p1,p2] 参与计算，"p2–p4 之间"那道真缝就消失了，
    //   玩家会看到安全标记突然变少、甚至指向错误的位置。
    const sweeps=duel.entities.filter(e=>e.sweep).sort((a,b)=>a.x-b.x);
    if(sweeps.length>1){
      const arenaFloor=player.groundAt(duel.arena);
      const gPulse=.55+.45*Math.sin(t*5);
      for(let i=0;i<sweeps.length-1;i++){
        const gL=sweeps[i].x+sweeps[i].width/2,gR=sweeps[i+1].x-sweeps[i+1].width/2;
        if(gR-gL<30)continue;                       // 缝太窄就不标（标了反而误导）
        const gx=(gL+gR)/2-camera;
        if(gx<-80||gx>w+80)continue;
        c.save();c.globalAlpha=.42+gPulse*.28;
        c.strokeStyle='#9bcbbb';c.lineWidth=2;c.setLineDash([5,5]);
        c.beginPath();c.moveTo(gx,arenaFloor-6);c.lineTo(gx,arenaFloor-64);c.stroke();
        c.setLineDash([]);
        c.font='12px serif';c.textAlign='center';c.fillStyle='#c2ead9';
        c.fillText('安全',gx,arenaFloor-72);c.restore();
      }
    }
    for(const e of duel.entities){
      const x=e.x-camera,warning=e.warning,b=duel.body(e),floor=e.ground??player.groundAt(e.x);
      c.save();c.globalAlpha=warning?.8:1;
      if(e.kind==='edict'){
        const left=b.left-camera,right=b.right-camera;
        if(warning){
          c.fillStyle='#d89e7a22';c.fillRect(left,b.top,e.width,e.height);
          for(let i=0;i<7;i++)line(c,[[left+i*70,b.top],[left+i*70+45,b.bottom]],'#edb89644',1);
          line(c,[[left,b.bottom],[right,b.bottom]],'#ffcc9c',2);
        }else{
          const fire=c.createLinearGradient(0,b.top,0,b.bottom);fire.addColorStop(0,'#ae654622');fire.addColorStop(.8,'#ffb57f77');fire.addColorStop(1,'#ffdfb8');
          c.fillStyle=fire;c.fillRect(left,b.top,e.width,e.height);line(c,[[left,b.bottom-4],[right,b.bottom-4]],'#fff0cf',5);
        }
      }else if(e.kind==='eruption'){
        c.strokeStyle=warning?'#e9bc8e':'#ffc9a4';c.lineWidth=2;c.beginPath();c.ellipse(x,floor-3,e.width/2+3,9,0,0,TAU);c.stroke();
        if(warning){
          const half=e.width/2;
          if(e.sweep){
            // 横扫地火：危险柱画成**实心渐变柱 + 左右两条实边**。
            // 旧版是 14% 透明度的填充加一条细竖线，扫一眼读不出「这一列会喷火」，
            // 玩家说「画面提示不够清楚」主要就是这里。
            const pulse=.5+.5*Math.sin(t*6);
            const col=c.createLinearGradient(0,e.y,0,floor);
            col.addColorStop(0,`rgba(255,196,150,${.14+pulse*.08})`);
            col.addColorStop(1,`rgba(236,134,84,${.30+pulse*.16})`);
            c.fillStyle=col;c.fillRect(x-half,e.y,e.width,floor-e.y);
            c.strokeStyle='#ffc9a4';c.lineWidth=2;
            c.beginPath();c.moveTo(x-half,e.y);c.lineTo(x-half,floor);c.lineTo(x+half,floor);c.lineTo(x+half,e.y);c.stroke();
            c.strokeStyle='#ffe0b8';c.lineWidth=1.2;
            c.beginPath();c.moveTo(x,e.y+16);c.lineTo(x,floor-10);c.stroke();
            // 点火序号直接读 e.order。旧版是 Math.round(e.delay/.22)+1，
            // 节奏一调编号就全错，反向横扫时顺序也是反的。
            c.font='bold 16px serif';c.textAlign='center';c.fillStyle='#ffeacb';
            c.fillText(String(e.order??''),x,floor-24);
          }else{
            c.fillStyle='#ee9f6825';c.fillRect(x-half,e.y,e.width,e.height);
            line(c,[[x,floor-12],[x,e.y]],'#f7b98f77',1);
            c.font='12px serif';c.textAlign='center';c.fillStyle='#ffcd96';
            c.fillText(String(e.order??Math.round(e.delay/.22)+1),x,floor-20);
          }
        }else{
          const half=e.width/2;
          polygon(c,[[x-half,floor],[x-half*.75,e.y+e.height*.35],[x-7,e.y+28],[x+3,e.y],[x+12,e.y+60],[x+half*.6,e.y+e.height*.3],[x+half,floor]],'#da76487a','#ffbf8e');
          line(c,[[x-7,floor],[x+6,e.y+50],[x,e.y+8]],'#ffe0b8',4);
        }
      }else if(e.kind==='rain'){
        const tracking=warning&&e.trackUntil&&duel.phase==='attack'&&e.age<e.trackUntil;
        c.strokeStyle=tracking?'#e8d29d':'#ff997b';c.lineWidth=e.width>100?3:2;c.setLineDash(warning?[6,6]:[]);
        c.beginPath();c.ellipse(x,floor-3,e.width/2,10,0,0,TAU);c.stroke();c.setLineDash([]);
        if(warning){c.fillStyle=tracking?'#d4ae5522':'#d9664c22';c.fillRect(x-e.width/2,floor-460,e.width,460);line(c,[[x,floor-440],[x,floor-12]],c.strokeStyle,1);}
        const yy=warning?floor-430:(b.top+b.bottom)/2;
        if(e.width>100){
          const sun=c.createRadialGradient(x,yy,5,x,yy,e.width*.62);sun.addColorStop(0,'#ffe2a9');sun.addColorStop(.55,'#e7995dcc');sun.addColorStop(1,'#f5854300');c.fillStyle=sun;c.fillRect(x-e.width,yy-e.width,e.width*2,e.width*2);
          c.strokeStyle='#ffd9a9';c.beginPath();c.arc(x,yy,e.width*.32,0,TAU);c.stroke();
        }else{
          polygon(c,[[x-11,yy-22],[x,yy-44],[x+11,yy-22],[x+7,yy+8],[x,yy+22],[x-7,yy+8]],'#b7694f','#ffd09f');
          if(!warning)line(c,[[x,yy-28],[x,yy-100]],'#efa56a88',5);
        }
        if(!warning&&e.age>=e.delay+e.fall)polygon(c,[[x-e.width/2,floor],[x-15,floor-26],[x,floor-42],[x+15,floor-26],[x+e.width/2,floor]],'#d78b5588','#edaa77');
      }else{
        const top=b.top,bottom=b.bottom,half=e.width/2;
        polygon(c,[[x-half,bottom],[x-half*.5,top+25],[x+half*.4,top],[x+half,top+18],[x+half*.5,bottom]],e.kind==='tall'?'#b985cf88':'#c8845088',e.kind==='tall'?'#dbb1f0':'#ffd2a0');
        if(warning){const dir=e.dir||-1,cueX=Math.max(28,Math.min(w-28,x));line(c,[[cueX-dir*24,top+e.height*.5],[cueX+dir*24,top+e.height*.5],[cueX+dir*13,top+e.height*.5-9]],'#ffcfa0',3);}
      }
      c.restore();
    }
    if(duel.orb){
      const holding=duel.phase==='holding',returning=duel.phase==='return';
      const f=returning?Math.min(1,duel.age/.4):0;
      const ox=holding?px:returning?px+f*460:duel.orb.x-camera,oy=holding?player.y-36:returning?player.y-36-f*90:duel.orb.y;
      c.save();const glow=c.createRadialGradient(ox,oy,1,ox,oy,42);glow.addColorStop(0,'#ffffd6bb');glow.addColorStop(1,'#a4f3d400');c.fillStyle=glow;c.fillRect(ox-44,oy-44,88,88);
      polygon(c,[[ox,oy-17],[ox+14,oy],[ox,oy+17],[ox-14,oy]],'#f3efc5','#9de3cf');
      if(duel.phase==='recall'){c.font='13px serif';c.textAlign='center';c.fillStyle='#bcebd8';c.fillText('记忆',ox,oy-30);}
      c.restore();
    }
    if(duel.held&&active){c.strokeStyle='#b3ecd7';c.lineWidth=2;c.beginPath();c.arc(px,player.y-36,34,-Math.PI/2,-Math.PI/2+duel.power*TAU);c.stroke();}
    if(active){
      c.save();c.fillStyle='#0d1824dd';c.fillRect(28,112,320,50);c.fillStyle='#dbc9a6';c.font='17px serif';c.textAlign='left';
      const labels={ascend:duel.spec.name+' · 王权燃尽',charge:'执炬王 · 最终对决',link:'王权连击',aim:'赤火蓄势',attack:'避开赤火',recall:'金色记忆归来',holding:'松开 E · 发还记忆',return:'记忆发还',stagger:'王势中断'};
      c.fillText(`${duel.maxHits-duel.hits} / ${duel.maxHits}  ${labels[duel.phase]||''}`,42,137);c.font='12px serif';c.fillStyle='#edaa83';c.fillText(duel.spec.name+(duel.hits?' · 连击加速':''),42,155);c.restore();
    }
  }
  /**
   * 反击火球：拾到器物后由强化余火打出、飞向军官的一发。
   * 与军官的赤色法术用同一套语言但颜色相反（暖金 vs 赤红），
   * 让"哪一发是我打的"在乱局里也读得出来。
   */
  bossCounter(c,camera,w,player){
    const relic=player.bossRelic,B=player.boss;
    if(relic&&!relic.gone){
      const x=relic.x-camera,y=relic.y;
      if(x>-80&&x<w+80){
        c.save();c.strokeStyle='#80f0d4';c.lineWidth=3;
        c.beginPath();c.arc(x,y,25,0,TAU);c.stroke();
        polygon(c,[[x,y-17],[x+12,y],[x,y+17],[x-12,y]],'#b3ffe4','#f5ffd9');
        line(c,[[x-35,y+60],[x,y+35],[x+35,y+60]],'#80f0d4aa',2);
        c.textAlign='center';c.fillStyle='#c5ffe9';c.font='14px sans-serif';
        c.font='11px sans-serif';c.fillText(relic.label||'回火印',x,y+42);c.restore();
      }
    }
    if(B?.phase==='counter'&&B.counter){
      const q=Math.min(1,B.age/.65),x=B.counter.x+(B.x-B.counter.x)*q-camera,y=B.counter.y+(B.y-60-B.counter.y)*q;
      line(c,[[x-55,y+8],[x,y]],'#8ceac7',6);c.fillStyle='#e1ffdc';c.beginPath();c.arc(x,y,12,0,TAU);c.fill();
    }
    if(player.inBossFight&&(B.ward||this.wardUntil>player.elapsed)){
      const used=!B.ward,q=used?Math.min(1,(this.wardUntil-player.elapsed)/1.7):1;
      const x=player.x-camera,y=player.y-42;
      c.save();c.globalAlpha=q;c.fillStyle=used?'#fff0b744':'#f9dfa51a';
      c.strokeStyle=used?'#fff5cb':'#ffe0a6cc';c.lineWidth=used?6:3;
      if(used){
        const spread=(1-q)*24;
        for(let i=0;i<8;i++){const a=i*TAU/8;c.beginPath();c.ellipse(x,y,43+spread,64+spread,0,a,a+.35);c.stroke();}
        c.font='bold 16px serif';c.textAlign='center';c.fillStyle='#fff0bd';c.fillText('护身灯已碎',x,y-83);
      }else{c.beginPath();c.ellipse(x,y,32,53,0,0,TAU);c.fill();c.stroke();}
      c.restore();
    }
  }
  background(c,w,h,distance,t,chapter) {
    // scenery 由关卡数据给出（按章节索引）。有它就画这一关自己的远景，
    // 没有就沿用序章那三套——换关卡不需要改绘制代码。
    const scenery=this.view?.scenery;
    const draw=biome=>{
      if(scenery){
        const name=scenery[biome]??scenery[0];
        this.sky(c,w,h,distance,t,DISTRICT_SKY[name]??DISTRICT_SKY.quarter);
        this.districtScene(c,w,distance,t,name);
        return;
      }
      this.sky(c,w,h,distance,t,biome);
      if(biome===0){this.god(c,w,distance,t);this.ruins(c,w,distance,.13,410,'#25383a',1);this.hills(c,w,distance,.24,510,'#203235');this.ruins(c,w,distance,.33,555,'#1a2b2d',0);this.mist(c,w,510,t,.11);}
      if(biome===1)this.sanctuary(c,w,distance,t);
      if(biome===2)this.boneAbyss(c,w,distance,t);
    };
    // 转场仅发生在火祭碑后的安全地段；旧场景与新场景交叠约 1.5 秒。
    const blend=chapter>0?Math.min(1,Math.max(0,(distance-(this.view?.chapters?.[chapter]?.at??0))/500)):1;
    if(blend<1){draw(chapter-1);c.save();c.globalAlpha=blend;draw(chapter);c.restore();}else draw(chapter);
  }
  sky(c,w,h,distance,t,biome=0) {
    // biome 传序号时用序章三套配色；传数组时直接用该关卡自带的天色。
    const colors=Array.isArray(biome)?biome
      :[['#121e27','#33484a','#64736a'],['#080d19','#17202c','#30362f'],['#11172a','#283549','#606b76']][biome];
    const sky=c.createLinearGradient(0,0,0,650);sky.addColorStop(0,colors[0]);sky.addColorStop(.46,colors[1]);sky.addColorStop(1,colors[2]);c.fillStyle=sky;c.fillRect(0,0,w,h);
    if(biome===1)return;
    const mx=w*.74-distance*.013,my=173;
    const glow=c.createRadialGradient(mx,my,30,mx,my,300);glow.addColorStop(0,'#d6d6b925');glow.addColorStop(.4,'#c4ceac0d');glow.addColorStop(1,'#bccdab00');c.fillStyle=glow;c.fillRect(mx-300,my-300,600,600);
    c.strokeStyle='#b3bda360';c.lineWidth=.8;c.beginPath();c.arc(mx,my,67,0,TAU);c.stroke();
    c.fillStyle='#c9cbb580';c.beginPath();c.arc(mx,my,51,0,TAU);c.fill();
    c.fillStyle='#26373ee8';c.beginPath();c.arc(mx+18,my-9,48,0,TAU);c.fill();
    line(c,[[mx-80,my],[mx+80,my]],'#b5b89926');line(c,[[mx,my-86],[mx,my+86]],'#b5b89926');
    const skyAlpha=c.globalAlpha;
    for(let i=0;i<34;i++){const x=noise(i+1)*w,y=noise(i+81)*300; c.globalAlpha=skyAlpha*(.15+noise(i)*.22);c.fillStyle='#d4d6c7';c.fillRect(x,y,1,1);}c.globalAlpha=skyAlpha;
    for(let i=0;i<7;i++) {
      const x=((i*339-t*(3+i*.3))%(w+600)+w+600)%(w+600)-300;
      const y=100+noise(i+18)*250;
      c.fillStyle='#9eada506';c.beginPath();c.ellipse(x,y,280,18,0,0,TAU);c.fill();
    }
    // 细长斜光，让废墟与天空分层。
    polygon(c,[[mx-20,150],[mx+20,155],[mx+370,606],[mx+180,606]],'#d5d4a804');
  }
  god(c,w,distance,t) {
    const x=w*.66-distance*.037,y=420;
    c.save();c.translate(x,y);c.rotate(-.19);
    // 一尊仰卧在山脊上的巨神：破碎光环、冠冕、面容与肩甲。
    c.strokeStyle='#74827a36';c.lineWidth=2;c.beginPath();c.arc(12,-146,137,Math.PI*.92,Math.PI*2.8);c.stroke();
    c.lineWidth=.6;c.beginPath();c.arc(12,-146,147,Math.PI*1.09,Math.PI*2.72);c.stroke();
    for(let i=0;i<17;i++){const a=i/17*TAU;line(c,[[12+Math.cos(a)*139,-146+Math.sin(a)*139],[12+Math.cos(a)*154,-146+Math.sin(a)*154]],'#7d877541',1);}
    polygon(c,[[-76,-118],[-83,-188],[-63,-238],[-34,-250],[-7,-244],[15,-257],[57,-235],[80,-205],[80,-167],[106,-139],[96,-124],[72,-120],[67,-88],[40,-59],[-13,-44],[-55,-75]],'#3a4c4c');
    polygon(c,[[-68,-197],[-93,-267],[-62,-247],[-44,-302],[-20,-257],[4,-318],[25,-257],[64,-296],[61,-241],[91,-255],[76,-198]],'#33464a');
    polygon(c,[[-55,-176],[-20,-187],[20,-172],[50,-181],[67,-161],[24,-148],[-8,-157]],'#2a4043');
    line(c,[[-53,-173],[-22,-169],[-3,-178]],'#182f35',4);
    line(c,[[28,-160],[51,-163],[63,-173]],'#172e33',4);
    polygon(c,[[18,-156],[39,-131],[32,-119],[11,-124]],'#4c5c57');
    line(c,[[-8,-94],[13,-87],[39,-96]],'#233b40',3);
    line(c,[[-34,-242],[-15,-211],[-30,-189],[-8,-159],[-14,-116],[-3,-81]],'#192f35b0',2);
    line(c,[[-33,-241],[-14,-211],[-29,-189]],'#83917b33');
    polygon(c,[[-78,-70],[-27,-54],[-29,-11],[5,7],[139,-19],[250,10],[326,68],[-294,113],[-231,23],[-155,8]],'#304548');
    polygon(c,[[-169,12],[-99,-19],[-29,-3],[-64,42],[-164,60],[-237,49]],'#3c504f');
    line(c,[[-154,20],[-104,5],[-59,15],[-89,38],[-154,45]],'#6b7c693e',2);
    polygon(c,[[60,7],[132,-8],[199,4],[153,36],[91,48]],'#3c4f4d');
    // 从胸腔升起的枯树。
    line(c,[[152,14],[161,-37],[150,-66],[155,-103]],'#2b4043',5);
    line(c,[[160,-36],[185,-61],[195,-91]],'#2b4043',3);
    line(c,[[151,-61],[128,-87],[123,-115]],'#2b4043',2);
    c.restore();
    for(let i=0;i<5;i++) {
      const bx=x-160+i*63+Math.sin(t*.2+i)*6,by=195+Math.sin(i*3)*41;
      polygon(c,[[bx,by],[bx+10,by-18],[bx+20,by-12],[bx+14,by+8]],'#385054');
    }
  }
  hills(c,w,distance,factor,base,color) {
    const step=150,start=Math.floor(distance*factor/step)-2;c.beginPath();c.moveTo(-200,810);
    for(let i=start;i<start+w/step+5;i++) {const x=i*step-distance*factor;const y=base-noise(i+47)*115;c.lineTo(x,y);}c.lineTo(w+200,810);c.closePath();c.fillStyle=color;c.fill();
  }
  ruins(c,w,distance,factor,base,color,far) {
    const cell=225,start=Math.floor(distance*factor/cell)-2;
    for(let i=start;i<start+w/cell+4;i++) {
      const x=i*cell-distance*factor;const height=80+noise(i+61)*180;
      c.fillStyle=color;
      if(noise(i+5)>.36) {
        const width=50+noise(i+17)*55;
        polygon(c,[[x,base],[x,base-height],[x+12,base-height-9],[x+17,base-height-33],[x+22,base-height-7],[x+width-18,base-height+4],[x+width-10,base-height-26],[x+width,base-height],[x+width,base]],color);
        c.fillStyle=far?'#40545365':'#30434360';
        for(let j=0;j<3;j++){c.fillRect(x+13+j*19,base-height+29,5,29);}
        line(c,[[x+width*.6,base-height],[x+width*.5,base-height+61],[x+width*.7,base-height+98],[x+width*.55,base]],'#101e252f',2);
        if(noise(i+42)>.45) {
          c.fillStyle=color;c.fillRect(x+width+47,base-height+20,13,height-20);
          c.beginPath();c.arc(x+width+25,base-height+70,36,Math.PI,0);c.lineWidth=12;c.strokeStyle=color;c.stroke();
        }
      } else {
        polygon(c,[[x,base],[x+5,base-height],[x+17,base-height-6],[x+21,base-25],[x+31,base]],color);
        line(c,[[x+13,base-height+65],[x-30,base-height+35],[x-45,base-height+1]],color,5);
        line(c,[[x+14,base-height+92],[x+45,base-height+45],[x+54,base-height+16]],color,4);
      }
    }
  }
  mist(c,w,y,t,opacity) {
    const gradient=c.createLinearGradient(0,y-90,0,y+50);gradient.addColorStop(0,'#adc0a300');gradient.addColorStop(.66,`rgba(153,178,158,${opacity})`);gradient.addColorStop(1,'#adc0a300');c.fillStyle=gradient;c.fillRect(0,y-90,w,140);
  }
  bridges(c,w,camera,t=0) {
    const ground=this.view?.world?.ground??WORLD.ground;
    // 先绘制完整石桥，再把断口从地形段中切开，深渊保留远景。
    let start=camera-80;const end=camera+w+80;
    const gaps=(this.view?.obstacles||OBSTACLES).filter(o=>o.type==='gap'&&o.x+o.width>start&&o.x<end);
    for(const gap of [...gaps,{x:end,width:0}]) {
      const stop=Math.min(gap.x,end);
      if(stop>start) {
        const cuts=[start,...(this.view?.terrain||TERRAIN).filter(([x])=>x>start&&x<stop).map(([x])=>x),stop];
        for(let i=1;i<cuts.length;i++) {
          const a=cuts[i-1],b=cuts[i],ya=this.view.groundAt(a),yb=this.view.groundAt(b);
          if(this.view.level.id==='district'&&a>=40100)c.globalAlpha=.2+.8*Math.min(1,(this.bridgeMemory||0)/3);
          if(Math.abs(ya-yb)<.1)this.groundSegment(c,a-camera,b-camera,ya,a,t);
          else this.slopeSegment(c,a-camera,b-camera,ya,yb);
          c.globalAlpha=1;
        }
      }
      start=Math.max(start,gap.x+gap.width);
    }
    for(const g of gaps) {
      const x=g.x-camera,gy=this.view.groundAt(g.x),ey=this.view.groundAt(g.x+g.width);
      line(c,[[x-25,gy-2],[x,gy-2]],'#ad7c5c',2);line(c,[[x+g.width,ey-2],[x+g.width+25,ey-2]],'#ad7c5c',2);
      polygon(c,[[x-8,gy],[x,gy],[x-4,gy+22],[x-11,gy+43],[x-15,gy+10]],'#28312a');
      polygon(c,[[x+g.width,ey],[x+g.width+21,ey],[x+g.width+15,ey+61],[x+g.width+5,ey+27]],'#28312a');
      c.fillStyle='#c69f7735';c.font='10px Georgia';c.textAlign='center';c.fillText('∨',x+g.width/2,ground+90);
    }
  }
  groundSegment(c,left,right,y,worldStart,t=0) {
    const width=right-left;if(width<=0)return;
    const location=(this.view.chapters||CHAPTERS).reduce((i,p,j)=>worldStart+width/2>=p.at?j:i,0);
    if(this.view.level.id==='district'&&location===2){
      c.fillStyle='#122830';c.fillRect(left,y+26,width,810-y-26);
      c.fillStyle='#6e7562';c.fillRect(left,y,width,4);c.fillStyle='#3f514b';c.fillRect(left,y+4,width,22);
      c.save();c.beginPath();c.rect(left,y,width,810-y);c.clip();
      const offset=left-worldStart;
      for(let i=Math.floor(worldStart/42);i<(worldStart+width)/42+1;i++){
        const x=i*42+offset;line(c,[[x,y+3],[x-2,y+24]],'#0c2028',2);line(c,[[x+8,y+10],[x+30,y+9]],'#95a17c44');
        if(i%5===0){c.fillStyle='#263e3d';c.fillRect(x+5,y+25,12,150);line(c,[[x+7,y+33],[x+7,y+135]],'#80917744',2);}
      }
      c.restore();return;
    }
    const material=Math.min(2,location);
    const grad=c.createLinearGradient(0,y,0,810);grad.addColorStop(0,['#182421','#252a27','#283039'][material]);grad.addColorStop(1,'#0b1518');c.fillStyle=grad;c.fillRect(left,y,width,810-y);
    c.fillStyle=['#465346','#aaa078','#8d978b'][material];c.fillRect(left,y,width,3);c.fillStyle=['#26372f','#535443','#596662'][material];c.fillRect(left,y+3,width,material===2?16:10);
    c.save();c.beginPath();c.rect(left,y,width,810-y);c.clip();
    const offset=left-worldStart;
    for(let row=0;row<3;row++) {
      const tile=110,base=Math.floor(worldStart/tile)-1;
      for(let i=base;i<base+width/tile+4;i++) {
        const x=i*tile+offset+(row%2)*55,sy=y+20+row*44;
        line(c,[[x,sy],[x+100,sy-2]],'#8b957216',1);
        line(c,[[x,sy],[x+4,sy+32]],'#020c1366',2);
        if(noise(i+row*5)>.7) line(c,[[x+30,sy],[x+37,sy+14],[x+29,sy+27]],'#071317',1);
      }
    }
    // 下层支柱和拱洞。
    const step=280,start=Math.floor(worldStart/step)-1;
    for(let i=start;i<start+width/step+3;i++) {
      const x=i*step+offset;
      c.fillStyle='#071216';c.beginPath();c.moveTo(x,820);c.lineTo(x,y+132);c.bezierCurveTo(x,y+59,x+155,y+59,x+155,y+132);c.lineTo(x+155,820);c.fill();
      c.strokeStyle='#59634e18';c.lineWidth=6;c.beginPath();c.moveTo(x-4,810);c.lineTo(x-4,y+133);c.bezierCurveTo(x-4,y+52,x+159,y+52,x+159,y+133);c.lineTo(x+159,810);c.stroke();
    }
    c.restore();
    // 草：根必须钉在世界坐标上，只随风摆。
    // 之前用 j 当屏幕序号、又用 floor(worldStart/32)+j 当噪声序号，
    // 两者在 worldStart 不是 32 的整数倍时会错位——同一个世界位置的草
    // 会随镜头换成另一株，视觉上就是整片草沿地面滑动。
    // 改为：先把世界区间对齐到 32 的格子，位置和噪声都从世界坐标算。
    const firstCell=Math.ceil(worldStart/32),lastCell=Math.ceil((worldStart+width)/32);
    for(let cell=firstCell;cell<=lastCell;cell++){
      const worldX=cell*32,x=worldX-worldStart+left;
      const n=noise(cell);
      if(n>.56){
        // 摆动只影响草尖，根部两点共用同一世界基准，绝不横向漂移。
        const sway=Math.sin(t*1.7+cell*1.9)*1.6;
        line(c,[[x,y],[x-3+sway*.6,y-6-n*6],[x+2+sway,y-3],[x+7+sway*1.4,y-9]],'#59654c77',1);
      }
    }
    if(material===1){for(let px=left+20;px<right-20;px+=72){polygon(c,[[px,y+20],[px+12,y+30],[px,y+40],[px-12,y+30]],null,'#b69c5833');}line(c,[[left,y+51],[right,y+51]],'#a9975b44',1);}
    if(material===2){for(let px=left+20;px<right;px+=55){line(c,[[px,y+6],[px-6,y+15],[px+4,y+24]],'#b6bb9860',2);}}
  }
  obstacle(c,o,x,t) {
    const y=this.view?.groundAt(o.x)??groundAt(o.x);
    if(o.skin&&['district','lantern'].includes(this.view.level.id)){this.streetObstacle(c,o,x,y);return;}
    if(o.type==='block') {
      polygon(c,[[x,y],[x+3,y-o.height+9],[x+16,y-o.height],[x+o.width-12,y-o.height+4],[x+o.width,y-o.height+15],[x+o.width,y]],'#253230','#626855');
      polygon(c,[[x+o.width-13,y-o.height+5],[x+o.width,y-o.height+15],[x+o.width,y],[x+o.width-14,y]],'#172523');
      line(c,[[x+14,y-o.height+16],[x+o.width-19,y-o.height+18]],'#b79c6877',2);
      const mx=x+o.width*.45,my=y-o.height*.48;
      polygon(c,[[mx,my-12],[mx+7,my],[mx,my+12],[mx-7,my]],null,'#bf7263');line(c,[[mx,my-8],[mx,my+8]],'#bf7263');
      line(c,[[x+o.width-16,y-o.height+3],[x+o.width-25,y-25],[x+o.width-20,y]],'#a07c5833');
    }
    if(o.type==='beam') {
      // 碰撞面以发红的下缘明确标记，通行高度 43px，滑铲身高 29px。
      for(const offset of [24,o.width-24]) {
        line(c,[[x+offset,-10],[x+offset,y-196]],'#596860',3);
        for(let cy=10;cy<y-196;cy+=20){c.strokeStyle='#7e887849';c.lineWidth=1;c.strokeRect(x+offset-3,cy,6,10);}
      }
      polygon(c,[[x,y-191],[x+18,y-205],[x+o.width-12,y-198],[x+o.width,y-180],[x+o.width,y-49],[x+o.width-17,y-43],[x+11,y-43],[x,y-57]],'#253433','#536352');
      polygon(c,[[x+14,y-177],[x+o.width-14,y-177],[x+o.width-14,y-64],[x+14,y-64]],'#192b2b','#475747');
      const cx=x+o.width/2;line(c,[[cx,y-163],[cx,y-86]],'#9b7c55',2);line(c,[[cx-24,y-136],[cx+24,y-136]],'#9b7c55',2);
      c.strokeStyle='#9b7c5580';c.lineWidth=1;c.beginPath();c.arc(cx,y-127,24,0,TAU);c.stroke();
      line(c,[[x+8,y-44],[x+o.width-8,y-44]],'#ba7160',3);
      c.fillStyle='#c77b5920';c.fillRect(x+7,y-44,o.width-14,7);
    }
  }
  beacon(c,x,y,t) {
    polygon(c,[[x-23,y],[x-18,y-91],[x,y-113],[x+18,y-91],[x+23,y]],'#33403a','#84856b');
    const halo=c.createRadialGradient(x,y-85,0,x,y-85,90);halo.addColorStop(0,'#e1c27e38');halo.addColorStop(1,'#e1c27e00');c.fillStyle=halo;c.fillRect(x-90,y-175,180,180);
    polygon(c,[[x,y-105-Math.sin(t*4)*4],[x+7,y-81],[x,y-68],[x-7,y-81]],'#e0c592');
    line(c,[[x,y-61],[x,y-28]],'#8d825e',2);
  }
  gate(c,x,y,t,open=0) {
    const glow=c.createRadialGradient(x,y-115,0,x,y-115,250);glow.addColorStop(0,'#e9cd8b30');glow.addColorStop(1,'#e9cd8b00');c.fillStyle=glow;c.fillRect(x-250,y-365,500,500);
    for(const side of [-1,1]) polygon(c,[[x+side*110,y],[x+side*90,y-220],[x+side*70,y-280],[x+side*60,y-235],[x+side*62,y]],'#354137','#929275');
    c.strokeStyle='#a9a38190';c.lineWidth=6;c.beginPath();c.arc(x,y-190,80,Math.PI,0);c.stroke();
    c.strokeStyle='#c7b178a0';c.lineWidth=1;c.beginPath();c.arc(x,y-150,112,0,TAU);c.stroke();
    c.fillStyle='#dfcfab';c.font='12px serif';c.textAlign='center';c.fillText('无名之门遗址 · 六锁未解',x,y-305);
    for(let i=0;i<8;i++){c.fillStyle='#d6c99280';c.fillRect(x+Math.sin(i*5+t*.2)*50,y-20-((t*30+i*35)%220),2,2);}
    if(open>0){c.save();c.globalCompositeOperation='lighter';const light=c.createLinearGradient(x-62,0,x+62,0);light.addColorStop(0,'#e6c78700');light.addColorStop(.5,`rgba(243,214,157,${open*.65})`);light.addColorStop(1,'#e6c78700');c.fillStyle=light;c.fillRect(x-62,y-210,124,210);line(c,[[x,y-237],[x,y]],`rgba(255,232,183,${open})`,2+open*4);c.restore();}
  }
  hero(c,x,y,p,t,running,ghost=false) {
    const pose=runnerPose(p,t,running),sliding=p.slideTime>0;
    c.save();c.translate(x,y);
    if(p.renderScale)c.scale(p.renderScale,p.renderScale);
    if(p.invulnerable>0&&Math.sin(t*35)>.1)c.globalAlpha*=.4;
    if(!ghost){c.fillStyle='#050c1080';c.beginPath();c.ellipse(0,0,sliding?37:24,4,0,0,TAU);c.fill();}
    polygon(c,pose.cape,ghost?'#dcb46d':'#8d403a');
    line(c,pose.cape.slice(0,4),ghost?'#f1c47c':'#d493674f',2);
    c.lineCap='round';
    line(c,[pose.hips,pose.kneeB,pose.footB],ghost?'#b99162':'#101b22',9);
    line(c,[pose.footB,[pose.footB[0]+8,pose.footB[1]]],ghost?'#b99162':'#101b22',5);
    line(c,[pose.chest,pose.backElbow,pose.backHand],ghost?'#b99162':'#18282c',7);
    line(c,[pose.hips,pose.kneeA,pose.footA],ghost?'#d8b67d':'#34443e',10);
    line(c,[pose.kneeA,pose.footA],ghost?'#f0c77d':'#88947a77',2);
    line(c,[pose.footA,[pose.footA[0]+9,pose.footA[1]]],ghost?'#d8b67d':'#111d22',5);
    const [hx,hy]=pose.hips,[cx,cy]=pose.chest;
    polygon(c,[[cx-10,cy-5],[cx+9,cy-4],[hx+9,hy],[hx-11,hy]],ghost?'#d6af70':'#283b3c');
    line(c,[[cx-5,cy],[hx-3,hy-7]],ghost?'#f0cd8a':'#8a947969',3);
    line(c,[[hx-11,hy],[hx+9,hy]],'#b1a078',3);
    line(c,[pose.chest,pose.elbow,pose.hand],ghost?'#e1bf81':'#344441',7);
    line(c,[[pose.hand[0]-3,pose.hand[1]], [pose.hand[0]+6,pose.hand[1]-1]],ghost?'#ffe0a3':'#b8aa87',4);
    const [nx,ny]=pose.head;
    polygon(c,[[nx-11,ny+7],[nx-13,ny-2],[nx-5,ny-12],[nx+5,ny-9],[nx+11,ny],[nx+9,ny+9]],ghost?'#deb77a':'#17262d',ghost?null:'#85917a66');
    polygon(c,[[nx+1,ny-4],[nx+11,ny],[nx+9,ny+5],[nx+1,ny+4]],ghost?'#f4d493':'#08151e');
    line(c,[[nx+4,ny+1],[nx+10,ny+1]],'#edcb83',1.3);
    if(!ghost){
      if((p.airSpin||0)>0){c.save();c.globalAlpha=(p.airSpin/.45)*.5;c.strokeStyle='#e8c382';c.lineWidth=1.3;c.beginPath();c.arc(0,-37,48,t*12,t*12+Math.PI*1.5);c.stroke();c.restore();}
      this.flame(c,pose.hand[0]+3,pose.hand[1]-5,t,(sliding?.8:1)*(p.flameLevel??flameStrength(p.health??3)));
    }
    // 举火引锤（第四幕）：把手里的余火高举过头，火光在抬手末段炸亮一下。
    //
    // ⚠️ 这段必须有可见反馈，否则玩家按了 E 不知道有没有生效——
    //   引锤是**玩家的主动动作**，不是自动触发的。
    // swing 取自 physics 的 strike 计时（0.3s），末尾一小段是收手。
    if(!ghost&&p.strikeTime>0){
      const dur=p.level?.dawn?.strike?.swing??.3;
      const k=Math.max(0,Math.min(1,1-p.strikeTime/dur));   // 0=起手 1=举满
      const raise=Math.sin(Math.min(1,k*1.05)*Math.PI*.5);
      const hx=pose.hand[0],hy=pose.hand[1]-4-raise*12;
      c.save();c.globalCompositeOperation='lighter';
      const R=24+raise*30;
      const glow=c.createRadialGradient(hx,hy,2,hx,hy,R);
      glow.addColorStop(0,`rgba(255,238,190,${.5+raise*.4})`);
      glow.addColorStop(.5,`rgba(255,180,90,${.24+raise*.22})`);
      glow.addColorStop(1,'rgba(255,150,60,0)');
      c.fillStyle=glow;c.fillRect(hx-R,hy-R,R*2,R*2);
      // 举起的火苗：越高越亮，读作"挑衅"。
      c.fillStyle='#ffe0a8';
      c.beginPath();c.moveTo(hx,hy+8);
      c.quadraticCurveTo(hx-9,hy-6,hx,hy-8-22*raise);
      c.quadraticCurveTo(hx+9,hy-6,hx,hy+8);c.fill();
      // 举满时向外扩一圈光环：引锤成立的视觉确认。
      if(k>.45){
        const a=Math.min(1,(k-.45)/.55);
        c.strokeStyle=`rgba(255,224,160,${(1-a)*.85})`;c.lineWidth=3;
        c.beginPath();c.arc(hx,hy,16+a*52,0,TAU);c.stroke();
      }
      c.restore();
    }
    // 收手残留（strikeFollow）：火光收束回去，避免抬手动作凭空断掉。
    if(!ghost&&p.strikeTime<=0&&p.strikeFollow>0){
      const k=1-p.strikeFollow/(p.level?.dawn?.strike?.follow??.16);   // 0=刚举满 1=收完
      c.save();c.globalAlpha=(1-k)*.5;c.globalCompositeOperation='lighter';
      const hx=pose.hand[0],hy=pose.hand[1]-10;
      const glow=c.createRadialGradient(hx,hy,2,hx,hy,26*(1-k*.5));
      glow.addColorStop(0,'rgba(255,230,180,.6)');glow.addColorStop(1,'rgba(255,150,60,0)');
      c.fillStyle=glow;c.fillRect(hx-40,hy-40,80,80);
      c.restore();
    }
    c.restore();
  }
  flame(c,x,y,t,scale=1) {
    if(scale<.005)return;
    c.save();c.translate(x,y);c.scale(scale,scale);c.globalCompositeOperation='lighter';
    const light=c.createRadialGradient(0,-8,1,0,-8,62);light.addColorStop(0,'#ffb85a65');light.addColorStop(.25,'#ef903727');light.addColorStop(1,'#ed9c4400');c.fillStyle=light;c.fillRect(-62,-70,124,124);
    const flicker=Math.sin(t*23)*3,tip=Math.sin(t*17)*4;
    c.fillStyle='#e59540';c.beginPath();c.moveTo(-7,0);c.bezierCurveTo(-15,-12,-5,-21,tip-2,-33-flicker);c.bezierCurveTo(10,-24,3,-15,10,-10);c.bezierCurveTo(16,1,4,7,-7,0);c.fill();
    c.fillStyle='#f9ce73';c.beginPath();c.moveTo(-4,1);c.quadraticCurveTo(-7,-10,tip+2,-22);c.quadraticCurveTo(4,-10,7,-4);c.quadraticCurveTo(6,5,-4,1);c.fill();
    c.fillStyle='#fff0b8';c.beginPath();c.ellipse(0,-2,3.5,6,0,0,TAU);c.fill();
    for(let i=0;i<5;i++){const age=(t*1.3+i*.19)%1;c.globalAlpha=1-age;c.fillStyle='#f9d68d';c.fillRect(-age*20+Math.sin(t*6+i)*5,-12-age*45,1.8,1.8);}
    c.restore();
  }
  motionTrail(c,camera,player) {
    const now=player.elapsed,points=this.trail.filter(s=>now-s.t<.7&&s.t<=now);
    if(points.length<2)return;
    if(!this.reducedMotion) {
      c.save();c.globalCompositeOperation='lighter';
      for(let i=0;i<points.length-3;i+=24){const sample=points[i],q=1-(now-sample.t)/.7;c.globalAlpha=q*.045;this.hero(c,sample.x-camera,sample.y,sample.p,sample.t,true,true);}
      c.restore();
    }
    // 每次物理 tick 采样掌心位置；高刷显示用插值，尾迹不依赖帧数。
    const ribbon=points.map(s=>{const hand=runnerPose(s.p,s.t).hand;return [s.x-camera+hand[0]+3,s.y+hand[1]-8];});
    const hand=runnerPose(player,now).hand;ribbon.push([player.x-camera+hand[0]+3,player.y+hand[1]-8]);
    const mesh=ribbonMesh(ribbon,now,player.flameLevel??1,this.reducedMotion);
    c.save();c.globalCompositeOperation='lighter';
    const gradient=c.createLinearGradient(ribbon[0][0],0,ribbon.at(-1)[0]+.1,0);gradient.addColorStop(0,'#b0753200');gradient.addColorStop(.32,'#d6a05e45');gradient.addColorStop(.8,'#eaba7377');gradient.addColorStop(1,'#fff0baaa');
    c.globalAlpha=this.reducedMotion?.35:.8;polygon(c,[...mesh.left,...[...mesh.right].reverse()],gradient);
    line(c,mesh.center,'#ffe0a477',1.2);line(c,mesh.left,'#d99b5644',.6);
    c.restore();
  }
  cinematicOverlay(c,w,h,scene,player) {
    const {q,type}=scene,bars=Math.sin(Math.PI*q)*Math.min(40,h*.05);
    c.fillStyle='#070e15';c.fillRect(0,0,w,bars);c.fillRect(0,h-bars,w,bars);
    if(type==='defeat'){
      const phase=Math.max(0,(q-.25)/.75),y=(this.view?.groundAt(player.x)??groundAt(player.x))+(scene.falling?55:-29);
      c.save();c.globalCompositeOperation='lighter';
      for(let i=0;i<34;i++){const n=noise(i+320),angle=noise(i+510)*TAU;c.globalAlpha=Math.sin(phase*Math.PI)*(.2+n*.5);c.fillStyle=i%3?'#bcad84':'#eac687';c.fillRect(this.heroX+18+Math.cos(angle)*phase*65,y-phase*(30+n*105),1+n*2,1+n*2);}
      c.restore();
    }
    if(type==='departure'&&q>.8){c.fillStyle=`rgba(5,12,18,${Math.min(1,(q-.8)/.2)})`;c.fillRect(0,0,w,h);}
  }
  slopeSegment(c,a,b,ya,yb) {
    polygon(c,[[a,ya],[b,yb],[b,820],[a,820]],'#14221f');
    line(c,[[a,ya],[b,yb]],'#6b7560',3);line(c,[[a,ya+8],[b,yb+8]],'#304336',5);
    for(let x=a+12;x<b;x+=38){const y=ya+(yb-ya)*(x-a)/(b-a);line(c,[[x,y+15],[x+8,y+50],[x+4,y+100]],'#35423488');}
  }
  routeRelics(c,camera,w,t,player) {
    for(const spring of (this.view?.springs||SPRINGS)) {
      const x=spring.x-camera,y=this.view.groundAt(spring.x);if(x<-150||x>w+150)continue;
      c.save();c.globalCompositeOperation='lighter';
      const beam=c.createLinearGradient(0,y-190,0,y);beam.addColorStop(0,'#8edcc100');beam.addColorStop(1,'#8edcc12a');c.fillStyle=beam;c.fillRect(x-20,y-190,spring.width+40,190);
      c.strokeStyle='#8ac7ad';c.lineWidth=2;c.beginPath();c.ellipse(x+50,y-2,48,7,0,0,TAU);c.stroke();
      for(let i=0;i<8;i++){const q=(t*.6+i/8)%1;line(c,[[x+15+i*10,y-q*155],[x+18+i*10,y-q*155-14]],`rgba(158,224,199,${(1-q)*.45})`,1);}
      c.restore();c.font='10px serif';c.textAlign='center';c.fillStyle='#a6cfb8';c.fillText('风 印',x+50,y+25);
    }
    for(const ring of (this.view?.rings||RINGS)) {
      if(player.rings.has(ring.id))continue;
      const x=ring.x-camera;if(x<-80||x>w+80)continue;
      c.save();c.translate(x,ring.y);c.globalCompositeOperation='lighter';c.strokeStyle='#dbb775';c.lineWidth=2;
      c.beginPath();c.ellipse(0,0,27,43,0,0,TAU);c.stroke();c.lineWidth=.6;c.beginPath();c.ellipse(0,0,34,51,0,0,TAU);c.stroke();
      for(let i=0;i<7;i++){const a=t+i/7*TAU;c.fillStyle='#f0d794';c.fillRect(Math.cos(a)*30,Math.sin(a)*47,2,2);}
      c.restore();c.fillStyle='#d3ba83';c.textAlign='center';c.font='9px serif';c.fillText('共 鸣',x,ring.y-62);
    }
  }
  spectacle(c,w,distance,t,chapter) {
    if(chapter===1) {
      // 圣所的巨大玫瑰窗与穿透尘埃的光束。
      const x=w*.7-Math.sin(distance*.0003)*90,y=220;
      c.save();c.strokeStyle='#a69e7130';c.lineWidth=3;
      for(const r of [105,120,135]){c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();}
      for(let i=0;i<12;i++){const a=i/12*TAU;line(c,[[x+Math.cos(a)*40,y+Math.sin(a)*40],[x+Math.cos(a)*135,y+Math.sin(a)*135]],'#a69e7140',2);}
      polygon(c,[[x-25,y],[x+30,y],[x+210,600],[x+90,600]],'#d8c89209');c.restore();
    }
    if(chapter===2) {
      // 最后一段在巨神肋骨下穿行；远景裂隙发光但不产生伤害。
      for(let i=0;i<5;i++){const x=i*410-distance*.17%410;c.strokeStyle='#51615a66';c.lineWidth=29;c.beginPath();c.moveTo(x,610);c.bezierCurveTo(x-130,320,x-45,120,x+155,30);c.stroke();line(c,[[x+15,510],[x-21,365],[x+12,260]],'#a5986530',3);}
      const pulse=Math.pow(Math.max(0,Math.sin(t*.43)),10)*.07;
      c.fillStyle=`rgba(186,184,140,${pulse})`;c.fillRect(0,0,w,600);
      line(c,[[w*.8,20],[w*.77,110],[w*.8,170],[w*.74,280]],'#baad7050',1.5);
    }
    // 从前方缓慢逼近的流星，避开主跑道和危险色。
    if(!this.reducedMotion){const q=(t*.09)%1;line(c,[[w*(1.1-q*.6),70+q*130],[w*(1.1-q*.6)+70,44+q*130]],'#b6c4b126',1);}
  }

  sanctuary(c,w,distance,t) {
    const spacing=370,offset=distance*.2%spacing;
    for(let i=-1;i<w/spacing+2;i++) {
      const x=i*spacing-offset;
      polygon(c,[[x,610],[x,-10],[x+42,-10],[x+42,610]],'#131d27');
      line(c,[[x+7,0],[x+7,560]],'#73775d35',3);
      c.strokeStyle='#47504355';c.lineWidth=13;c.beginPath();c.moveTo(x+43,556);c.lineTo(x+43,175);c.quadraticCurveTo(x+85,73,x+185,17);c.quadraticCurveTo(x+286,73,x+328,175);c.lineTo(x+328,556);c.stroke();
      polygon(c,[[x+110,423],[x+110,213],[x+185,120],[x+260,213],[x+260,423]],'#373e38','#82806860');
      for(let pane=0;pane<3;pane++)polygon(c,[[x+124+pane*42,400],[x+124+pane*42,229],[x+141+pane*42,184],[x+155+pane*42,227],[x+155+pane*42,400]],['#6b735142','#56666c52','#8d73574a'][pane]);
      line(c,[[x+110,285],[x+260,285]],'#1c282a',8);line(c,[[x+173,177],[x+186,249],[x+171,313],[x+194,376]],'#131f27',4);
      polygon(c,[[x+145,222],[x+218,222],[x+400,606],[x+278,606]],'#d7c9960b');
      polygon(c,[[x+5,570],[x+23,494],[x+45,477],[x+71,500],[x+88,570]],'#18252a');
    }
    this.spectacle(c,w,distance,t,1);this.mist(c,w,560,t,.065);
  }
  boneAbyss(c,w,distance,t) {
    this.hills(c,w,distance,.09,480,'#354354');
    this.hills(c,w,distance,.17,650,'#1f3042');
    // 深渊底部没有建筑：孤立神骨、悬垂脊柱和远处的断裂圆环。
    const center=w*.66-Math.sin(distance*.00017)*100;
    c.strokeStyle='#a5a9913a';c.lineWidth=8;c.beginPath();c.arc(center,205,170,.3,Math.PI*1.73);c.stroke();
    c.lineWidth=1;c.beginPath();c.arc(center,205,186,.08,Math.PI*1.61);c.stroke();
    for(let i=-1;i<w/320+2;i++) {
      const x=i*320-distance*.24%320;
      c.strokeStyle='#697c7a77';c.lineWidth=31;c.beginPath();c.moveTo(x,640);c.bezierCurveTo(x-103,446,x-139,205,x+107,60);c.stroke();
      c.strokeStyle='#aab09a33';c.lineWidth=3;c.beginPath();c.moveTo(x+7,620);c.bezierCurveTo(x-81,434,x-113,222,x+103,71);c.stroke();
      line(c,[[x-78,265],[x-106,316],[x-86,359]],'#172937',7);
      polygon(c,[[x+140,730],[x+164,670],[x+186,692],[x+209,820],[x+144,820]],'#182938');
    }
    for(let i=0;i<9;i++){const x=(i*167+distance*.09)%(w+180)-90,y=340+Math.sin(i*5)*80;polygon(c,[[x,y],[x+19,y-8],[x+27,y+4],[x+5,y+15]],'#70807930');}
    this.mist(c,w,647,t,.13);
  }

  /**
   * 失名街区的三段远景。街区是"有人住"的，所以画的是生活痕迹而不是神殿与深渊：
   * 医者的旧屋有晾衣绳与药柜，报时钟楼有停摆的钟与 scaffolding，临河渡口有水面与系船桩。
   * 三段共用意条：晾着的衣服、门口的空椅子、栏杆——都在暗示"人还在，只是没人记得名字"。
   */
  districtScene(c,w,distance,t,name) {
    if(['fateArchive','warGate','namePyre','greyRefuge'].includes(name)){this.fateScene(c,w,distance,t,name);return;}
    if(['windArchive','tideHarbor','harvestGranary','sealGate'].includes(name)){this.covenantScene(c,w,distance,t,name);return;}
    // 第四幕：王城四段。放在这里而不是末尾的兜底，否则会被画成名字桥。
    if(['refugeHall','courtRoad','throneCity','dawnChest'].includes(name)){this.dawnScene(c,w,distance,t,name);return;}
    if(['supplyRoad','coldArcade','shelter'].includes(name))this.lanternScene(c,w,distance,t,name);
    else if(name==='quarter') this.quarterScene(c,w,distance,t);
    else if(name==='bellTower') this.bellTowerScene(c,w,distance,t);
    else if(name==='ferry')this.ferryScene(c,w,distance,t);
    else this.nameBridgeScene(c,w,distance,t);
  }
  /**
   * 第四幕 · 王城远景。四段共用一条"人间的灯 → 王的火"的明暗推进：
   *   refugeHall 屋檐与窗火最多（人还活着）；courtRoad 石阶与旗列（强征的秩序）；
   *   throneCity 断裂的巨拱与日冕（王把自己炼成太阳）；dawnChest 最亮的日蚀。
   * 只画 y ≤ 460 的远景，绝不侵入跑道、共鸣环与预警带。
   */
  dawnScene(c,w,distance,t,name){
    this.hills(c,w,distance,.07,452,name==='dawnChest'?'#5a4038':'#333a45');
    this.backgroundDepth.draw(c,w,distance,name);
    const ruins=name==='throneCity'||name==='dawnChest';
    const span=ruins?300:260,start=Math.floor(distance*(ruins?.16:.19)/span)-1;
    for(let i=start;i<start+w/span+3;i++){
      const x=i*span-distance*(ruins?.16:.19);
      if(name==='refugeHall'){
        // 屋顶轮廓 + 四扇亮着的窗：这是"记名"的地方，灯必须看得见。
        // 第二版把窗从 2 扇加到 4 扇、并错落两层：第一段要读作"人还活着"，
        // 而旧版两张窗间距 96、高度整齐，远看像同一扇复印出来的。
        polygon(c,[[x,452],[x,452-96],[x+span*.5,452-140],[x+span,452-96],[x+span,452]],'#2b3038');
        for(let k=0;k<4;k++){
          const wx=x+22+k*62,wy=452-(k%2?88:70);
          const lit=(i*4+k)%3!==0;                       // 每三扇留一扇黑：有人家已经走了
          c.save();c.globalAlpha=lit?.5:.18;
          c.fillStyle=lit?'#d8ab6d':'#4a5058';c.fillRect(wx,wy,7,12);
          if(lit){const glow=c.createRadialGradient(wx+3,wy+6,0,wx+3,wy+6,24);
            glow.addColorStop(0,'#e0b47844');glow.addColorStop(1,'#e0b47800');c.fillStyle=glow;c.fillRect(wx-21,wy-18,48,48);}
          c.restore();
        }
        // 屋顶上的炊烟：只有这一段有——后面三段要"安静下来"。
        if(i%2===0){c.strokeStyle='#5a6068aa';c.lineWidth=3;c.beginPath();
          c.moveTo(x+span*.72,452-132);
          c.quadraticCurveTo(x+span*.72+18,452-176,x+span*.72-6,452-214);c.stroke();}
      }else if(name==='courtRoad'){
        // 一层层收上去的石阶 + 垂下的军旗：王庭的秩序感。
        // 第二版补了台阶间的**刻痕**（名单的隐喻）与旗列间距的轻微变化。
        const steps=['#242a34','#2b323d','#333b47'];
        for(let s=0;s<3;s++){
          c.fillStyle=steps[s];
          c.fillRect(x+s*24,452-40-s*38,span-s*48,40+s*38);
        }
        // 石阶上的刻痕：一排排小竖线，像被反复刻写过的名字。
        c.strokeStyle='#161b22';c.lineWidth=2;
        for(let r=0;r<3;r++)for(let k=0;k<7;k++){
          const lx=x+16+k*34,ly=452-6-r*38;
          c.beginPath();c.moveTo(lx,ly);c.lineTo(lx,ly-(6+r*3));c.stroke();
        }
        line(c,[[x+span*.5,300],[x+span*.5,452]],'#39424e',3);
        polygon(c,[[x+span*.5,312],[x+span*.5+46,328],[x+span*.5,344]],'#5d4a44','#8a6b5c');
      }else if(name==='throneCity'){
        // 断裂的巨拱与远处的城垛；王座本身在 landmark 里单独画。
        c.strokeStyle='#4b3b3a';c.lineWidth=17;
        c.beginPath();c.moveTo(x,452);c.quadraticCurveTo(x+span*.5,452-190,x+span,452);c.stroke();
        c.strokeStyle='#a8805022';c.lineWidth=2;
        c.beginPath();c.moveTo(x+8,452);c.quadraticCurveTo(x+span*.5,452-180,x+span-8,452);c.stroke();
        polygon(c,[[x+span*.2,452],[x+span*.2,452-72],[x+span*.2+54,452-72],[x+span*.2+54,452]],'#3a2f30');
        if(i%2===0){c.strokeStyle='#5a4746';c.lineWidth=5;
          c.beginPath();c.arc(x+span*.5,452-70,30,Math.PI,Math.PI*1.9);c.stroke();}
      }else{
        // dawnChest · 尚未成形的太阳：全幕最亮的远景。
        //
        // ⚠️ 这一节是第二版补的。旧版 dawnChest 就是这里的 else 兜底，
        //    画的是同一枚日蚀环重复铺满整屏——38800 之后玩家看到的是
        //    一张**完全静止的重复图案**，这也是"道路还是没变"的一部分。
        //    现在改成三种远景轮换：日蚀 / 胸腔肋架 / 点灯的城垛，
        //    让最后一段有它自己的画面身份，而不只是"更亮的同一张图"。
        const variant=i%3;
        if(variant===0){
          // ① 日蚀：最近的一枚，日轮压到地平在线。
          const cx=x+span*.5,cy=452-150;
          const halo=c.createRadialGradient(cx,cy,16,cx,cy,190);
          halo.addColorStop(0,'#ffd9a033');halo.addColorStop(1,'#ffd9a000');
          c.fillStyle=halo;c.fillRect(cx-190,cy-190,380,380);
          c.strokeStyle='#d9a068';c.lineWidth=3;c.beginPath();c.arc(cx,cy,58,0,TAU);c.stroke();
          c.fillStyle='#241a1c';c.beginPath();c.arc(cx,cy,52,0,TAU);c.fill();
          c.fillStyle='#f0c088';c.beginPath();c.arc(cx+16,cy-12,50,0,TAU);c.fill();
          c.fillStyle='#241a1c';c.beginPath();c.arc(cx-6,cy-4,52,0,TAU);c.fill();
          for(let k=0;k<9;k++){const a=k/9*TAU+t*.12;
            line(c,[[cx+Math.cos(a)*62,cy+Math.sin(a)*62],[cx+Math.cos(a)*78,cy+Math.sin(a)*78]],'#e6b27655',2);}
        }else if(variant===1){
          // ② 胸腔肋架：王把自己烧成太阳之后，剩下的那副空壳。
          c.strokeStyle='#4a3436';c.lineWidth=13;
          for(let k=0;k<3;k++){
            const rx=x+50+k*84,rh=188-k*22;
            c.beginPath();c.moveTo(rx,452);
            c.quadraticCurveTo(rx+26,452-rh*.62,rx+8,452-rh);
            c.stroke();
          }
        }else{
          // ③ 点灯的城垛：胸腔之上仍有人间——最远处一排亮着的窗，
          //    与第一段 refugeHall 呼应（"万家微火"的收束）。
          polygon(c,[[x,452],[x,452-64],[x+span,452-64],[x+span,452]],'#332c2e');
          for(let k=0;k<4;k++){
            const wx=x+26+k*62,wy=452-52;
            c.save();c.globalAlpha=.62;c.fillStyle='#ffd29a';c.fillRect(wx,wy,6,11);
            const glow=c.createRadialGradient(wx+3,wy+5,0,wx+3,wy+5,26);
            glow.addColorStop(0,'#ffc98a44');glow.addColorStop(1,'#ffc98a00');
            c.fillStyle=glow;c.fillRect(wx-23,wy-21,52,52);c.restore();
          }
        }
        line(c,[[x,452],[x+span,452]],'#c08a5c44',3);
      }
    }
    // 暖雾只铺在最下方一条，避免糊住跑道。
    this.mist(c,w,452,t,name==='dawnChest'?.14:.09);
  }
  fateScene(c,w,distance,t,name){
    this.hills(c,w,distance,.075,440,'#3a5364');
    this.backgroundDepth.draw(c,w,distance,name);
    const span=340,start=Math.floor(distance*.18/span)-1;
    for(let i=start;i<start+w/span+3;i++){
      const x=i*span-distance*.18;
      if(name==='fateArchive'){
        c.strokeStyle='#91b6b177';c.lineWidth=8;c.beginPath();c.moveTo(x+20,603);c.lineTo(x+20,240);c.bezierCurveTo(x+20,113,x+310,113,x+310,240);c.lineTo(x+310,603);c.stroke();
        for(let k=0;k<4;k++){c.fillStyle='#18313e';c.fillRect(x+45+k*60,273,35,251);for(let j=0;j<6;j++)line(c,[[x+51+k*60,294+j*37],[x+74+k*60,294+j*37]],'#cfbd8a66',2);}
      }else if(name==='warGate'){
        line(c,[[x+26,606],[x+26,246],[x+170,160],[x+307,246],[x+307,606]],'#6d7177',24);
        line(c,[[x+170,211],[x+170,565]],'#d8c59b55',4);
        polygon(c,[[x+30,420],[x+80,400],[x+110,447],[x+44,520]],'#363e49','#b4b6a255');
      }else if(name==='namePyre'){
        polygon(c,[[x+35,589],[x+76,470],[x+261,470],[x+301,589]],'#3a515e','#a0b0a177');
        for(let k=0;k<4;k++){const xx=x+115+k*33;line(c,[[xx,410],[xx-10,326],[xx+11,301]],'#bda68255',3);}
      }else{
        line(c,[[x+60,603],[x+60,434],[x+83,426],[x+115,440]],'#809d96',5);
        polygon(c,[[x+99,442],[x+137,442],[x+137,488],[x+99,488]],'#3c5760','#b9b78b');
        c.fillStyle='#b5c6b01f';c.fillRect(x+25,511,244,91);
        line(c,[[x+20,583],[x+279,583]],'#819d93',5);
      }
    }
    this.mist(c,w,569,t,.075);
  }
  fateRoute(c,camera,w,t,player){
    const L=this.view.level;if(!L.echo)return;
    c.save();
    for(const p of L.echoPlatforms){
      const x=p.x-camera;if(x+p.width<0||x>w)continue;
      c.globalAlpha=player.echoLight?1:.35;c.strokeStyle=player.echoLight?'#ffe2a2':'#c3ab80';c.lineWidth=3;c.setLineDash(player.echoLight?[]:[8,7]);c.strokeRect(x,p.y,p.width,14);c.setLineDash([]);
      if(player.echoLight){
        polygon(c,[[x,p.y],[x+p.width,p.y],[x+p.width-5,p.y+14],[x+p.width*.68,p.y+20],[x+p.width*.36,p.y+16],[x+5,p.y+14]],'#a28d63');
        line(c,[[x+8,p.y+5],[x+p.width-8,p.y+5]],'#f8dc9b',2);
        for(let j=1;j<5;j++)line(c,[[x+p.width*j/5,p.y+1],[x+p.width*j/5-3,p.y+14]],'#6c634e',1);
      }
      for(let j=0;j<3;j++)line(c,[[x+27+j*57,p.y+19],[x+21+j*57,p.y+43]],'#dec99744',1);
    }
    c.globalAlpha=1;
    for(const wall of L.echoWalls){
      const x=wall.x-camera;if(x+wall.width<0||x>w)continue;
      c.globalAlpha=player.echoLight?.8:.25;c.fillStyle=player.echoLight?'#8bcbd15e':'#7199a51c';c.fillRect(x,wall.top,wall.width,wall.bottom-wall.top);
      c.strokeStyle='#b3e9ed';c.lineWidth=2;c.setLineDash(player.echoLight?[]:[6,8]);c.strokeRect(x,wall.top,wall.width,wall.bottom-wall.top);c.setLineDash([]);
      for(let j=0;j<8;j++)line(c,[[x,wall.top+30+j*45],[x+wall.width/2,wall.top+13+j*45],[x+wall.width,wall.top+30+j*45]],'#c8edf199',2);
    }
    c.globalAlpha=1;
    const ember=L.items.find(i=>i.kind==='ember');
    if(ember&&!player.items.has(ember.id)){
      const x=ember.x-camera;if(x>-80&&x<w+80){c.fillStyle='#e2c58a';c.beginPath();c.arc(x,ember.y,14,0,TAU);c.fill();line(c,[[x-21,ember.y-26],[x,ember.y-39],[x+21,ember.y-26]],'#e9d3a4',2);}
    }
    for(const r of L.rescues){
      const x=r.x-camera;if(x<-130||x>w+130)continue;
      const saved=player.flag.has(r.id),savedAge=saved?player.elapsed-(player.rescueTimes.get(r.id)??player.elapsed-3):0;
      if(savedAge<2.4)this.npc(c,x+48+savedAge*55,606,r.kind,t,saved?Math.max(0,1-savedAge/2.4):1);
      line(c,[[x-20,606],[x-20,481],[x+1,472],[x+28,482]],'#aab29a',5);
      c.fillStyle='#203b47';c.fillRect(x+6,485,39,62);line(c,[[x+6,485],[x+45,485],[x+45,547],[x+6,547],[x+6,485]],saved?'#f2d492':'#8eab9b',3);
      if(saved){this.smallFlame(c,x+26,535,t,20);line(c,[[x+18,571],[x+180,571]],'#dfc68a',2);}
      c.font='14px serif';c.textAlign='center';c.fillStyle=saved?'#f2d7a1':'#d8e6d2';c.fillText(saved?'沿灯路离开':r.name,x+32,453);
      if(player.rescueId===r.id){c.fillStyle='#e4c485';c.fillRect(x-99,430,170*player.rescueProgress/r.seconds,5);}
    }
    if(player.echoLight){
      const x=player.x-camera,y=player.y-46;const halo=c.createRadialGradient(x+30,y,0,x+30,y,210);halo.addColorStop(0,'#f0d69c1f');halo.addColorStop(1,'#f0d69c00');c.fillStyle=halo;c.fillRect(x-180,y-210,420,420);
    }
    if(player.greyFront!==null){
      const x=player.greyFront-camera;c.fillStyle='#9baeb377';c.fillRect(0,220,Math.max(0,x),485);
      const mist=c.createLinearGradient(x-95,0,x+40,0);mist.addColorStop(0,'#a5b7bb60');mist.addColorStop(1,'#a5b7bb00');c.fillStyle=mist;c.fillRect(x-95,220,135,485);
      line(c,[[x,252],[x-28,331],[x+7,412],[x-15,518],[x,681]],'#dce6da77',3);
    }
    c.restore();
  }
  covenantScene(c,w,distance,t,name){
    this.hills(c,w,distance,.09,420,'#3b5368');
    this.backgroundDepth.draw(c,w,distance,name);
    const span=name==='harvestGranary'?290:340,start=Math.floor(distance*.2/span)-1;
    for(let i=start;i<start+w/span+3;i++){
      const x=i*span-distance*.2;
      if(name==='windArchive'){
        polygon(c,[[x,598],[x+17,354],[x+80,272],[x+143,354],[x+160,598]],'#466773','#b0c9b477');
        line(c,[[x+80,300],[x+80,180]],'#c4c4a4',3);polygon(c,[[x+80,182],[x+180+Math.sin(t)*8,205],[x+80,227]],'#8aa99c','#c8dbc0');
        c.fillStyle='#b6cabc55';for(let k=0;k<3;k++)c.fillRect(x+46+k*25,380,15,103);
        line(c,[[x-20,485],[x+220,440],[x+315,475]],'#adcfc744',2);
      }else if(name==='tideHarbor'){
        c.fillStyle='#518da378';c.fillRect(x,465,span,138);
        for(let k=0;k<5;k++)line(c,[[x+8,480+k*20],[x+span-10,476+k*20]],'#c0e6de44',2);
        polygon(c,[[x+25,423],[x+245,423],[x+203,474],[x+75,474]],'#354b5c','#9fbaa8');
        line(c,[[x+137,422],[x+137,254],[x+228,349],[x+137,356]],'#a4bbb1',4);
      }else if(name==='harvestGranary'){
        // 旧粮仓、种子袋、育苗台：与安眠域的病床有明确区别。
        polygon(c,[[x,602],[x,292],[x+span*.5,220],[x+span,292],[x+span,602]],'#5b6358','#a1a387');
        line(c,[[x+19,319],[x+span-19,319],[x+span-19,574]],'#89947b',7);
        for(let k=0;k<3;k++){
          const sx=x+45+k*70;c.fillStyle='#ab986d';c.beginPath();c.ellipse(sx,529,28,42,0,0,TAU);c.fill();
          line(c,[[sx-10,494],[sx+10,494]],'#e0c89b',3);
          line(c,[[sx,449],[sx,416],[sx-13,407],[sx,419],[sx+13,410]],'#a1ba7c',3);
          c.fillStyle='#75664d';c.fillRect(sx-23,449,46,15);
        }
        line(c,[[x+32,469],[x+span-25,469]],'#c2b184',5);
        line(c,[[x+span-30,330],[x+span-30,536],[x+28,536]],'#e2bc7755',5);
      }else{
        line(c,[[x,606],[x,258],[x+span*.5,190],[x+span,258],[x+span,606]],'#52677b',29);
        c.fillStyle='#bfbad333';c.fillRect(x+40,287,span-80,273);
        for(let k=0;k<3;k++){c.strokeStyle='#c1c6b477';c.lineWidth=4;c.beginPath();c.arc(x+span/2,330+k*66,21,0,TAU);c.stroke();}
      }
    }
    this.mist(c,w,557,t,.09);
  }
  covenantRoute(c,camera,w,t,player){
    const L=this.view.level;
    for(const zone of L.windZones||[]){
      const left=zone.from-camera,right=zone.to-camera;if(right<0||left>w)continue;
      c.save();c.beginPath();c.rect(left,340,right-left,260);c.clip();c.fillStyle='#8ce0ce13';c.fillRect(left,340,right-left,260);
      for(let i=0;i<7;i++){const yy=375+i*29,shift=this.reducedMotion?0:(t*110)%180;for(let xx=left-180+shift;xx<right;xx+=180)line(c,[[xx,yy+12],[xx+52,yy],[xx+43,yy-6],[xx+52,yy]],'#b7ffdf99',2);}
      c.restore();c.fillStyle='#d7ffe7';c.font='13px serif';c.textAlign='left';c.fillText('顺风 · 跳得更远',Math.max(20,left+18),354);
    }
    for(const z of L.tidalChannels||[]){
      const x=z.x-camera;if(x+z.width<0||x>w)continue;
      const state=player.tidalState(z);c.save();
      c.fillStyle='#172f3b';c.fillRect(x,606,z.width,24);
      for(let i=0;i<z.width;i+=50){c.fillStyle='#8c9b8a';c.fillRect(x+i,607,38,8);}
      c.fillStyle='#53b5c798';c.fillRect(x,606-state.height,z.width,state.height);
      line(c,[[x,606-state.height],[x+z.width,606-state.height]],'#d9fff1',4);
      line(c,[[x-35,606],[x-35,474]],'#b7baa0',4);
      c.fillStyle=state.open?'#c5ffb1':'#ffb5a0';c.beginPath();c.arc(x-35,474,10,0,TAU);c.fill();
      c.font='bold 15px sans-serif';c.textAlign='left';c.fillText(state.open?`退潮 ${state.left.toFixed(1)} 秒 · 松开前进`:`涨潮 · 按住 A 等 ${state.left.toFixed(1)} 秒`,Math.max(16,x-110),state.height>160?280:441);
      c.restore();
    }
    for(const tide of L.tides||[]){
      const x=tide.x-camera,floor=this.view.groundAt(tide.x),state=player.mechanismStates.get(tide.id);if(x<-70||x>w+70||state.done)continue;
      c.save();const active=player.mechanismActive(tide);c.strokeStyle='#c6ffed';c.lineWidth=3;c.setLineDash(active?[]:[5,5]);c.strokeRect(x-28,floor-tide.height,56,tide.height);c.setLineDash([]);
      c.fillStyle=active?'#a2eadcb0':'#99e7dd22';c.fillRect(x-28,floor-tide.height,56,tide.height);
      if(active)line(c,[[x-30,floor-tide.height],[x-14,floor-tide.height-8],[x+7,floor-tide.height+3],[x+30,floor-tide.height-4]],'#e9fff1',5);
      c.font='bold 13px sans-serif';c.textAlign='center';c.fillStyle='#deffef';c.fillText(active?'↑ 跳过潮浪':state.started?'潮浪将起 ↑':'潮线 ↑',x,floor-tide.height-22);
      if(state.started){c.fillStyle='#defbed';c.fillRect(x-28,floor+9,56*Math.min(1,state.age/tide.warning),3);}c.restore();
    }
    for(const p of L.platforms||[]){
      const x=p.x-camera,state=player.mechanismStates.get(p.id);if(x+p.width<0||x>w)continue;
      const active=player.mechanismActive(p);c.save();c.globalAlpha=active?1:.25;c.strokeStyle=p.collapse?'#d5b989':'#e4cffa';c.lineWidth=3;c.setLineDash(active?[]:[6,6]);c.strokeRect(x,p.y,p.width,13);c.setLineDash([]);
      if(active){c.fillStyle=p.collapse?'#a18a66':'#a9a4cacc';c.fillRect(x,p.y,p.width,13);c.fillStyle='#f3d8ff';c.fillRect(x,p.y+20,p.width*Math.max(0,1-(p.collapse?state.age/p.collapse:(state.age-p.warning)/p.life)),4);}
      c.globalAlpha=1;c.fillStyle='#eadcf5';c.font='12px sans-serif';c.textAlign='center';c.fillText(p.collapse?(state.done?'木板已断':state.started?'快跳！木板在断裂':'木桥 · 踩上就塌'):active?'落稳 → 再跳':state.done?'踏板已眠':'梦桥 · 即将显现',x+p.width/2,p.y-25);c.restore();
    }
    c.textAlign='left';
  }
  lanternScene(c,w,distance,t,name){
    this.hills(c,w,distance,.09,420,'#3c5660');
    const span=name==='coldArcade'?240:320,start=Math.floor(distance*.22/span)-1;
    for(let i=start;i<start+w/span+3;i++){
      const x=i*span-distance*.22;
      if(name==='coldArcade'){
        c.strokeStyle='#496574';c.lineWidth=28;c.beginPath();c.moveTo(x,605);c.lineTo(x,330);c.bezierCurveTo(x,194,x+span-35,194,x+span-35,330);c.lineTo(x+span-35,605);c.stroke();
        c.strokeStyle='#a7c7c355';c.lineWidth=2;c.stroke();
        for(let k=0;k<5;k++)polygon(c,[[x+28+k*35,274],[x+39+k*35,274],[x+32+k*35,295+noise(i+k)*22]],'#b1d4d555');
      }else{
        const roof=name==='shelter'?316:390;
        polygon(c,[[x,605],[x,roof],[x+120,roof-60],[x+250,roof],[x+250,605]],name==='shelter'?'#455b54':'#354d57','#8ba49a44');
        line(c,[[x,roof],[x+120,roof-60],[x+250,roof]],'#bec6ad66',3);
        for(let k=0;k<3;k++){c.fillStyle=name==='shelter'?'#d8b67a':'#6f9299';c.fillRect(x+30+k*65,roof+50,30,48);}
        if(name==='supplyRoad'){line(c,[[x+170,605],[x+175,roof-85]],'#526976',6);polygon(c,[[x+175,roof-85],[x+227,roof-72],[x+221,roof-40],[x+175,roof-50]],'#98564f');}
      }
    }
    this.mist(c,w,565,t,name==='coldArcade'?.18:.09);
    // 雪粒只属于远景；没有碰撞，不冒充新的危险。
    if(name!=='shelter')for(let i=0;i<36;i++){const x=(noise(i+121)*w-distance*.14+t*(14+i%5))%w,y=(noise(i+34)*550+t*(8+i%4))%560;c.fillStyle='#cbe1e15a';c.fillRect((x+w)%w,y,2,2);}
  }
  lanternRoute(c,camera,w,t,player){
    const L=this.view.level;if(!L.coldZones)return;
    for(const zone of L.coldZones){const left=zone.from-camera,right=zone.to-camera;if(right<0||left>w)continue;
      c.save();c.beginPath();c.rect(left,270,right-left,450);c.clip();
      const fog=c.createLinearGradient(0,300,0,640);fog.addColorStop(0,'#9fd9e000');fog.addColorStop(1,'#9fd9e048');c.fillStyle=fog;c.fillRect(left,270,right-left,420);
      for(let i=0;i<10;i++)line(c,[[left-80+Math.sin(t+i)*30,390+i*22],[right+60,405+i*22]],'#d3e8e521',1.5);
      c.restore();if(left>-80&&left<w){c.fillStyle='#c3e4e4';c.font='12px serif';c.textAlign='left';c.fillText('寒雾 · 携灯通过',left+12,this.view.groundAt(zone.from)-182);}
    }
    for(const item of L.items.filter(i=>i.kind==='coal')){const x=item.x-camera,y=this.view.groundAt(item.x);if(x<-80||x>w+80)continue;
      line(c,[[x-25,y-12],[x-18,y-47],[x+18,y-47],[x+25,y-12]],'#8c9987',5);
      polygon(c,[[x-31,y-48],[x+31,y-48],[x+24,y-31],[x-24,y-31]],'#69766b','#b2ae89');
      this.smallFlame(c,x,y-49,t,36);c.fillStyle='#edcc95';c.font='12px serif';c.textAlign='center';c.fillText(player.items.has(item.id)?'已续火':'炭盆 · 12 秒',x,y-113);
    }
    for(const lamp of L.lamps){const x=lamp.x-camera,y=this.view.groundAt(lamp.x),lit=player.litLamps.has(lamp.id);if(x<-160||x>w+160)continue;
      line(c,[[x,y],[x,y-130]],'#839788',7);polygon(c,[[x-24,y-130],[x+24,y-130],[x+19,y-90],[x-19,y-90]],'#263d43','#adb18b');line(c,[[x-30,y-131],[x,y-152],[x+30,y-131]],'#adb18b',4);
      if(lit){const glow=c.createRadialGradient(x,y-111,0,x,y-111,150);glow.addColorStop(0,'#f2ce893c');glow.addColorStop(1,'#f2ce8900');c.fillStyle=glow;c.fillRect(x-150,y-261,300,300);this.smallFlame(c,x,y-105,t,22);}
      c.fillStyle=lit?'#eed29e':'#a4bcb6';c.font='12px serif';c.textAlign='center';c.fillText(lit?'已点亮 · 有人守灯':'旧灯架',x,y-172);
    }
    if(player.warmth>0){const x=player.x-camera,y=player.y-42,r=110;const glow=c.createRadialGradient(x,y,4,x,y,r);glow.addColorStop(0,'#eec48233');glow.addColorStop(1,'#eec48200');c.fillStyle=glow;c.fillRect(x-r,y-r,r*2,r*2);c.strokeStyle='#f2d59966';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,62,85,0,0,TAU);c.stroke();}
    c.textAlign='left';
  }
  smallFlame(c,x,y,t,size){
    const q=Math.sin(t*5+x)*3;polygon(c,[[x-size*.35,y+size*.2],[x-size*.4,y-size*.2],[x+q,y-size],[x+size*.15,y-size*.32],[x+size*.35,y],[x+size*.2,y+size*.2]],'#e4af67','#f1d89d');
  }
  /** 医者的旧屋：黄昏。瓦檐、晾衣绳、门口的空椅子。 */
  quarterScene(c,w,distance,t) {
    // 落日余光：从右上斜压下来，给每层屋顶一道边光。
    // 没有这道光，前后景会糊成一片——规范要求"前景高对比、中景可读、远景柔化"。
    const gx=w*.78-distance*.02;
    const glow=c.createRadialGradient(gx,180,20,gx,180,620);
    glow.addColorStop(0,'#e0b87830');glow.addColorStop(.5,'#c8a05a12');glow.addColorStop(1,'#c8a05a00');
    c.fillStyle=glow;c.fillRect(gx-620,0,1240,620);
    this.hills(c,w,distance,.1,470,'#2f332e');
    this.backgroundDepth.draw(c,w,distance,'quarter');
    // 后排屋顶：低矮连片，檐口参差。逐层提亮，形成三层纵深。
    const cell=190,start=Math.floor(distance*.16/cell)-2;
    for(let i=start;i<start+w/cell+4;i++) {
      const x=i*cell-distance*.16,h=54+noise(i+23)*44,base=470;
      polygon(c,[[x,base],[x,base-h],[x+cell*.5,base-h-16],[x+cell,base-h+5],[x+cell,base]],'#3a3d35');
      line(c,[[x+3,base-h],[x+cell*.5,base-h-16],[x+cell-3,base-h+5]],'#8a84614d',2);
    }
    // 两侧近排屋檐：左右夹出一条街，透视让路更窄。
    const span=300,near=Math.floor(distance*.34/span)-1;
    for(let i=near;i<near+w/span+3;i++) {
      const x=i*span-distance*.34;
      polygon(c,[[x-30,600],[x+26,318],[x+186,318],[x+214,600]],'#33362f');
      polygon(c,[[x+16,336],[x+46,286],[x+176,286],[x+196,336]],'#282a23');
      // 檐口受光边：把两侧屋顶从背景里勾出来
      line(c,[[x+16,336],[x+46,286],[x+176,286],[x+196,336]],'#9a907040',2.5);
      // 窗：暖光透出来。这是"屋里还有人"的唯一直接证据，所以给足亮度。
      for(let k=0;k<2;k++) {
        const wx=x+52+k*66,lit=noise(i*3+k+7)>.34;
        polygon(c,[[wx,420],[wx,352],[wx+40,352],[wx+40,420]],'#1b1d19');
        if(lit){
          polygon(c,[[wx+4,416],[wx+4,382],[wx+36,382],[wx+36,416]],'#d8ae63');
          // 窗光洒在地上的一小片
          polygon(c,[[wx+2,600],[wx+40,600],[wx+56,646],[wx-12,646]],'#c8a05a12');
        }
      }
      // 檐下挂一盏灯：暖色面积保持很小，但足以让街道有焦点。
      const lx=x+104;
      line(c,[[lx,336],[lx,368]],'#6b6a5526',1.5);
      polygon(c,[[lx-9,368],[lx+9,368],[lx+6,392],[lx-6,392]],'#e0b878');
      const lg=c.createRadialGradient(lx,380,2,lx,380,86);
      lg.addColorStop(0,'#e0b8782e');lg.addColorStop(1,'#e0b87800');
      c.fillStyle=lg;c.beginPath();c.arc(lx,380,86,0,TAU);c.fill();
      // 晾衣绳：绳上挂着几件衣服，是"有人住"最直接的证据。
      line(c,[[x+4,352],[x+196,338]],'#6b6a552e',1.5);
      for(let k=0;k<3;k++) {
        const lx=x+34+k*54,ly=352-k*4.6,drop=26+noise(i+k+11)*30;
        polygon(c,[[lx,ly],[lx+26,ly-2],[lx+24,ly+drop],[lx+2,ly+drop-2]],['#4a4438','#3e3a33','#454039'][k]);
      }
      // 门口一把空椅子：留着，像是有人刚离开。椅面受一点灯光才看得见。
      line(c,[[x+150,600],[x+150,578],[x+176,578],[x+176,600]],'#2a2c2480',3);
      line(c,[[x+146,578],[x+180,578]],'#8a84614d',2.5);
    }
    this.mist(c,w,566,t,.1);
  }
  /** 报时钟楼：入夜。钟楼剪影压住整条街，钟不再报时。 */
  bellTowerScene(c,w,distance,t) {
    // 月光从左上斜切，给钟楼一道冷边光——夜里全靠这道光把轮廓从天上剥下来。
    const mx=w*.26+Math.sin(distance*.00013)*60;
    const mg=c.createRadialGradient(mx,132,10,mx,132,560);
    mg.addColorStop(0,'#cfd8e02e');mg.addColorStop(.45,'#a8b6c414');mg.addColorStop(1,'#a8b6c400');
    c.fillStyle=mg;c.fillRect(mx-560,0,1120,620);
    c.strokeStyle='#c8d2dc42';c.lineWidth=1.2;c.beginPath();c.arc(mx,132,44,0,TAU);c.stroke();
    c.fillStyle='#d6dde470';c.beginPath();c.arc(mx,132,33,0,TAU);c.fill();
    this.hills(c,w,distance,.1,486,'#2b3033');
    this.backgroundDepth.draw(c,w,distance,'bellTower');
    const tower=w*.72-Math.sin(distance*.00021)*70;
    // 塔身：比周围屋脊高出一截，压迫感来自高度而不是亮度。
    polygon(c,[[tower-96,600],[tower-72,150],[tower+72,150],[tower+96,600]],'#282c32');
    polygon(c,[[tower-104,158],[tower,84],[tower+104,158]],'#20242a');
    // 受光边：只勾左肩，右肩留暗面，这样体积感才出得来。
    line(c,[[tower-104,158],[tower,84],[tower+104,158]],'#a8b4be5c',2.5);
    line(c,[[tower-96,600],[tower-72,150],[tower-40,150]],'#8e9aa444',2);
    line(c,[[tower,84],[tower,44]],'#6b6a5a4a',2);
    // 塔上仍亮着的窗：常晚还没离开。
    for(let k=0;k<3;k++) {
      const y=210+k*126;
      polygon(c,[[tower-30,y],[tower-30,y+52],[tower+30,y+52],[tower+30,y]],'#14181c');
      if(k<2) line(c,[[tower-30,y+26],[tower+30,y+26]],'#4e4c4038',2);
      if(k===1){
        polygon(c,[[tower-24,y+30],[tower-24,y+46],[tower+24,y+46],[tower+24,y+30]],'#d0a862');
        polygon(c,[[tower-34,y+24],[tower+34,y+24],[tower+52,y+76],[tower-52,y+76]],'#c8a05a14');
      } else if(k===2) {
        polygon(c,[[tower-22,y+30],[tower-22,y+46],[tower+8,y+46],[tower+8,y+30]],'#c8a05a70');
      }
    }
    // 钟：巨大、倾斜、静止。没有摆动动画——它已经很久没响过了。
    // 钟身留一点边光，让"停止"这件事有具体的形，而不是一块黑。
    const swing=Math.sin(t*.11)*.012;
    c.save();c.translate(tower+4,268);c.rotate(.19+swing);
    polygon(c,[[-46,0],[46,0],[38,74],[-38,74]],'#5b523d','#8d7f5857');
    line(c,[[-44,4],[44,4]],'#a8946a4a',2);
    line(c,[[-40,18],[40,18]],'#332f22',3);
    line(c,[[-36,66],[36,66]],'#332f22',3);
    // 钟舌：歪在一侧，静止。
    polygon(c,[[-5,74],[5,74],[9,96],[-9,96]],'#39332a');
    c.restore();
    line(c,[[tower+4,190],[tower+4,268]],'#6d614340',2);
    // 两侧低屋顶，把塔夹在中间；檐口留一道月光边。
    const cell=210,start=Math.floor(distance*.2/cell)-2;
    for(let i=start;i<start+w/cell+4;i++) {
      const x=i*cell-distance*.2;
      polygon(c,[[x,600],[x,504],[x+cell*.5,488],[x+cell,504],[x+cell,600]],'#23262b');
      line(c,[[x,504],[x+cell*.5,488],[x+cell,504]],'#7c879233',2);
      if(noise(i+31)>.5) polygon(c,[[x+cell*.5,488],[x+cell*.5,452],[x+cell*.5+5,452],[x+cell*.5+5,488]],'#23262b');
    }
    this.mist(c,w,600,t,.13);
  }
  /** 临河渡口：拂晓。水面、系船桩、一条没人来坐的船。 */
  ferryScene(c,w,distance,t) {
    this.hills(c,w,distance,.08,452,'#2a3236');
    this.backgroundDepth.draw(c,w,distance,'ferry');
    // 对岸：低矮的一条线，中间留出水面。
    const step=260,start=Math.floor(distance*.12/step)-1;
    for(let i=start;i<start+w/step+3;i++) {
      const x=i*step-distance*.12,h=26+noise(i+13)*40;
      polygon(c,[[x,470],[x,470-h],[x+step*.5,470-h-12],[x+step,470-h+2],[x+step,470]],'#232b2f');
    }
    // 水面：横向亮带越远越密，制造出"水在动"的错觉，但不喧宾夺主。
    for(let i=0;i<22;i++) {
      const y=470+i*11.5;
      const alpha=(.05+noise(i+3)*.09)*(1-i/26);
      c.fillStyle=`rgba(158,178,180,${alpha})`;
      c.fillRect(((i*137+distance*(.2+i*.03))%(w+240))-120,y,60+noise(i)*150,1.6);
    }
    // 渡口木桩与空船。
    for(let i=-1;i<w/340+2;i++) {
      const x=i*340-distance*.3;
      polygon(c,[[x,600],[x+7,548],[x+17,548],[x+20,600]],'#1b1e1f');
      line(c,[[x+8,552],[x+16,552]],'#3a3a3238',2);
    }
    const boatX=w*.6-Math.sin(distance*.00018)*90;
    c.save();c.translate(boatX,566);c.rotate(Math.sin(t*.42)*.016);
    polygon(c,[[-96,0],[96,0],[74,26],[-74,26]],'#20241f');
    line(c,[[-74,20],[74,20]],'#3a3a3238',2);
    line(c,[[-8,0],[-8,-72]],'#23261f',3);
    polygon(c,[[-8,-70],[40,-62],[40,-40],[-8,-46]],'#2e2f2638');
    c.restore();
    this.mist(c,w,600,t,.15);
  }
  streetObstacle(c,o,x,y){
    if(o.type==='block'){
      const colors={medicine:'#49584b',cart:'#534c3d',cargo:'#3a4a4b',stone:'#3c4b50'};
      polygon(c,[[x,y],[x,y-o.height],[x+o.width,y-o.height],[x+o.width,y]],colors[o.skin]||'#394b4a','#859279');
      line(c,[[x+6,y-o.height+7],[x+o.width-6,y-o.height+7]],'#c98d6d',2);
      if(o.skin==='medicine'){
        line(c,[[x+o.width/2,y-o.height+15],[x+o.width/2,y-17]],'#a8b299',3);
        line(c,[[x+o.width/2-13,y-o.height/2],[x+o.width/2+13,y-o.height/2]],'#a8b299',3);
      }else if(o.skin==='cargo'||o.skin==='cart'){
        line(c,[[x+8,y-8],[x+o.width-8,y-o.height+13]],'#a497723d',4);
        line(c,[[x+9,y-o.height+13],[x+o.width-9,y-8]],'#a497724d',4);
      }else line(c,[[x+o.width*.4,y-o.height],[x+o.width*.6,y-o.height/2],[x+o.width*.3,y]],'#152c33',3);
      return;
    }
    // 所有低障碍共用同一碰撞轮廓，场所专属外形不可掩盖赤色下缘。
    line(c,[[x+18,0],[x+18,y-195]],'#73806f55',3);line(c,[[x+o.width-18,0],[x+o.width-18,y-195]],'#73806f55',3);
    const color=o.skin==='bell'?'#5b5541':o.skin==='rope'?'#394c4e':'#484b43';
    polygon(c,[[x,y-198],[x+o.width,y-198],[x+o.width,y-43],[x,y-43]],color,'#798472');
    if(o.skin==='awning'){
      for(let dx=10;dx<o.width;dx+=24)line(c,[[x+dx,y-185],[x+dx-8,y-53]],'#141f253d',10);
    }else if(o.skin==='bell'){
      const cx=x+o.width/2;
      polygon(c,[[cx-30,y-166],[cx+30,y-166],[cx+47,y-74],[cx-47,y-74]],'#746442','#a9976977');
      line(c,[[cx,y-74],[cx,y-52]],'#b2a075',5);
    }else{
      for(let cy=y-184;cy<y-52;cy+=19)line(c,[[x+12,cy],[x+o.width-12,cy+11]],'#8a907066',3);
    }
    line(c,[[x+4,y-44],[x+o.width-4,y-44]],'#d38d73',3);
  }
  npc(c,x,y,kind,t,alpha=1){
    const colors={healer:'#637668',bell:'#5c697e',ferry:'#786b52',elder:'#8c9283',child:'#a28c68'};
    c.save();c.translate(x,y);c.globalAlpha=alpha;
    if(kind==='child')c.scale(.72,.72);
    const breath=Math.sin(t*1.4)*1.2;
    line(c,[[-7,-18],[-12,-2]],'#14232c',9);line(c,[[7,-18],[13,-2]],'#14232c',9);
    polygon(c,[[-20,-7],[-15,-61+breath],[12,-65+breath],[21,-7]],colors[kind]||'#64736b');
    line(c,[[-11,-55],[-23,-34]],colors[kind]||'#64736b',8);line(c,[[11,-54],[25,-35]],colors[kind]||'#64736b',8);
    polygon(c,[[-13,-61],[-13,-77+breath],[0,-87+breath],[13,-76+breath],[11,-60]],'#3b5557','#a1aa8955');
    polygon(c,[[-5,-73+breath],[9,-72+breath],[8,-63+breath],[-4,-64+breath]],'#b5a88b');
    if(kind==='healer')polygon(c,[[18,-39],[36,-39],[32,-31],[22,-31]],'#b9ad85');
    if(kind==='ferry')line(c,[[31,-4],[47,-103]],'#aaa07d',4);
    if(kind==='elder'){line(c,[[3,-65],[3,-55]],'#d6d6bd',8);line(c,[[25,-36],[36,-55],[41,0]],'#aaa78a',4);}
    if(kind==='child'){polygon(c,[[-10,-47],[15,-47],[15,-24],[-10,-24]],'#bcc6af','#e4d4a1');line(c,[[-10,-43],[4,-39],[15,-44]],'#798b83',2);}
    c.restore();
  }
  landmarks(c,camera,w,t,player){
    for(const mark of this.view.level.landmarks||[]){
      if(mark.kind==='finalGate')continue; // The true gate is rendered once by finalKing, without bridge helpers.
      const x=mark.x-camera,y=this.view.groundAt(mark.x);if(x<-800||x>w+800)continue;
      if(mark.kind==='fate'){
        line(c,[[x-48,y],[x-48,y-131],[x+48,y-131],[x+48,y]],'#96aeaa',6);
        c.fillStyle='#baab83';c.fillRect(x-33,y-112,66,69);line(c,[[x-23,y-96],[x+24,y-96],[x+24,y-83],[x-15,y-83]],'#6b6d59',2);
        if(mark.x===24350){const opened=player.flag.has('f-lock');c.strokeStyle=opened?'#f1d394':'#b7c9b5';c.lineWidth=5;c.beginPath();c.arc(x,y-77,23,opened?.45:0,opened?TAU-.4:TAU);c.stroke();}
        if(mark.x===550||mark.x===29800)this.npc(c,x+81,y,'bell',t);
        if(mark.x<24800&&!player.flag.has('f-miya'))this.mia(c,x+151,y,t);
      }else if(['archive','harbor','granary','seal'].includes(mark.kind)){
        // 三域地标不复用桥头的三名 NPC；弥娅在安全落脚处等烬。
        line(c,[[x-85,y],[x-85,y-125],[x+85,y-125],[x+85,y]],'#899a86',5);
        c.fillStyle='#c0ac82';c.fillRect(x-54,y-102,108,67);
        c.fillStyle='#4a5145';c.font='17px serif';c.textAlign='center';c.fillText({archive:'风 · 原契',harbor:'潮汐 · 渡簿',granary:'丰收 · 种子',seal:'领还通道'}[mark.kind],x,y-67);
        this.mia(c,x+145,y,t);
      }else if(mark.kind==='father'){
        this.npc(c,x+70,y,'father',t);polygon(c,[[x+77,y-62],[x+87,y-58],[x+79,y-19],[x+70,y-22]],'#a56156');c.fillStyle='#c8b992';c.fillRect(x+34,y-43,22,31);
        line(c,[[x-122,y],[x-122,y-77],[x-36,y-77],[x-36,y]],'#8c9b8c',5);line(c,[[x-117,y-43],[x-40,y-43]],'#bea786',3);
      }else if(mark.kind==='shelter'){
        polygon(c,[[x-155,y],[x-155,y-160],[x,y-225],[x+210,y-160],[x+210,y]],'#354d48','#9aab90');c.fillStyle='#182f36';c.fillRect(x-54,y-122,87,122);c.fillStyle='#e7c58a';c.fillRect(x+73,y-133,58,55);line(c,[[x+102,y-133],[x+102,y-78]],'#536859',3);
        this.npc(c,x+46,y,'healer',t);this.npc(c,x+115,y,'bell',t);this.npc(c,x+190,y,'ferry',t);
      }else if(mark.kind==='healer'){
        polygon(c,[[x-140,y],[x-140,y-190],[x+140,y-190],[x+140,y]],'#20383a','#577267');
        polygon(c,[[x-166,y-182],[x,y-260],[x+160,y-182]],'#273f41','#748471');
        c.fillStyle='#0c1f28';c.fillRect(x-56,y-135,94,135);
        const lamp=c.createRadialGradient(x-15,y-110,1,x-15,y-110,150);lamp.addColorStop(0,'#ddbd7630');lamp.addColorStop(1,'#ddbd7600');c.fillStyle=lamp;c.fillRect(x-165,y-260,300,300);
        for(let i=0;i<5;i++){c.fillStyle='#718774';c.fillRect(x-121,y-139+i*24,46,18);line(c,[[x-99,y-135+i*24],[x-93,y-135+i*24]],'#bec29b',2);}
        c.fillStyle='#dfc58b';c.fillRect(x+73,y-147,28,47);c.fillStyle='#617c70';c.fillRect(x-35,y-174,68,17);
        this.npc(c,x+158,y,'healer',t);
      }else if(mark.kind==='bell'){
        line(c,[[x+15,y-290],[x+15,y-78]],'#a99b7166',4);
        polygon(c,[[x-44,y-122],[x+62,y-122],[x+62,y-80],[x-44,y-80]],'#3a504c','#80927b');
        for(let i=0;i<3;i++)line(c,[[x-20+i*27,y-115],[x-20+i*27,y-92]],'#b8a77b',2);
        this.npc(c,x+120,y,'bell',t);
      }else if(mark.kind==='ferry'){
        line(c,[[x-130,y-10],[x+180,y-8]],'#819084',5);
        polygon(c,[[x-190,y+62],[x+35,y+62],[x+8,y+103],[x-157,y+103]],'#223c41','#768878');
        line(c,[[x+1,y+75],[x+84,y-42]],'#a89870',3);
        polygon(c,[[x+68,y],[x+69,y-62],[x+82,y-62],[x+88,y]],'#2a4449','#829784');
        this.npc(c,x+124,y,'ferry',t);
      }else if(['refuge','court','throne','chest'].includes(mark.kind)){
        // 第四幕的四处地标。构图原则：全部 y-170 以上，不进跑道；
        // 每一处都放一名"城里的人"，但不复用记名桥的三位同行者，也不出现弥娅。
        if(mark.kind==='refuge'){
          // 记名避难所：屋檐下挂满名册灯，最早的一批人还在这里。
          polygon(c,[[x-170,y],[x-170,y-168],[x,y-236],[x+200,y-168],[x+200,y]],'#33434a','#8d9a88');
          c.fillStyle='#16292f';c.fillRect(x-62,y-128,96,128);
          for(let i=0;i<4;i++){const lx=x-120+i*58,ly=y-186;
            c.fillStyle='#e3c489';c.fillRect(lx,ly,5,10);
            c.fillStyle='#e8c58a33';c.beginPath();c.arc(lx+2,ly+5,17,0,TAU);c.fill();}
          this.npc(c,x+64,y,'healer',t);this.npc(c,x+136,y,'elder',t);
        }else if(mark.kind==='court'){
          // 王庭城道 · 献祭名单：一块竖起的名单碑，守卫正低头在上面找名字。
          line(c,[[x-96,y],[x-96,y-196],[x+96,y-196],[x+96,y]],'#7f8a80',7);
          c.fillStyle='#b3a781';c.fillRect(x-68,y-178,136,150);
          for(let i=0;i<6;i++)line(c,[[x-52,y-160+i*23],[x+52,y-160+i*23]],'#5d5a48',2);
          line(c,[[x-52,y-160],[x-30,y-160]],'#9c4a3f',3);
          this.npc(c,x+142,y,'healer',t);
        }else if(mark.kind==='throne'){
          // 黎明王座：王还坐在那里，冠上是尚未成形的太阳；第一根楔在它后面。
          c.fillStyle='#2a2228';c.fillRect(x-118,y-92,236,92);
          polygon(c,[[x-118,y-92],[x-92,y-166],[x+92,y-166],[x+118,y-92]],'#3a2c30','#9c7a63');
          line(c,[[x-92,y-166],[x-128,y-214],[x-84,y-230]],'#a8876a',7);
          line(c,[[x+92,y-166],[x+128,y-214],[x+84,y-230]],'#a8876a',7);
          const cy=y-196;
          c.strokeStyle='#e0ae74';c.lineWidth=3;c.beginPath();c.arc(x,cy,38,0,TAU);c.stroke();
          c.fillStyle='#2a2228';c.beginPath();c.arc(x,cy,33,0,TAU);c.fill();
          this.npc(c,x-172,y,'elder',t);
        }else{
          // 胸腔之上 · 安眠锁第六道：最后一根楔之后的门锁形制。
          line(c,[[x-84,y],[x-84,y-184],[x+84,y-184],[x+84,y]],'#7a6a58',9);
          c.strokeStyle=player.flag.has('d-lock')?'#f0d49a':'#9d8f74';c.lineWidth=6;
          c.beginPath();c.arc(x,y-124,34,Math.PI*.15,Math.PI*1.85);c.stroke();
          line(c,[[x,y-90],[x,y-30]],player.flag.has('d-lock')?'#f5d99b':'#8b8168',5);
          c.font='12px serif';c.textAlign='center';c.fillStyle='#d6c9a6';
          c.fillText(player.flag.has('d-lock')?'安眠锁已解':'安眠锁 · 第六道',x,y-202);
        }
      }else{
        const restored=this.bridgeMemory>=3;
        if(!player.boss||player.boss.phase==='idle')for(let i=0;i<3;i++)this.npc(c,x-100+i*65,y,['healer','bell','ferry'][i],t,.45+.55*Math.min(1,this.bridgeMemory/(i+1)));
        c.strokeStyle=restored?'#dac590':'#94b3aa44';c.lineWidth=2;
        c.beginPath();c.arc(x+150,y-150,102,0,TAU);c.stroke();
        line(c,[[x+150,y-252],[x+150,y-47]],restored?'#e0c99555':'#94b3aa22',1);
        if(restored)line(c,[[x-170,y+4],[x+570,y+4]],'#e5c489',2);
      }
      c.fillStyle='#c8c6a2';c.font='13px serif';c.textAlign='center';c.fillText(mark.label,x,mark.kind==='healer'?y-284:y-160);
      if(mark.name){c.font='10px serif';c.fillStyle='#cbb184';c.fillText(mark.name,x+135,y-103);}
    }
  }
  mia(c,x,y,t){
    c.save();c.translate(x,y);
    polygon(c,[[-22,0],[-19,-69],[0,-86],[19,-69],[23,0]],'#526d68','#94a18b');
    c.fillStyle='#b9ab8c';c.beginPath();c.arc(0,-93,11,0,TAU);c.fill();
    line(c,[[-11,-95],[11,-95]],'#e4d7b0',5);
    line(c,[[14,-61],[31,-43],[39,-48],[45,-104],[45,0]],'#b8aa80',3);
    c.fillStyle='#bb9b64';c.fillRect(-22,-41,17,24);
    c.fillStyle='#c0cbb5';c.font='12px serif';c.textAlign='center';c.fillText('弥娅',0,-118);c.restore();
  }
  roadGodlock(c,camera,w,t,player,scene){
    if(this.view.level.id!=='district')return;
    const x=this.view.level.world.end-170-camera,y=606;if(x<-160||x>w+180)return;
    const opened=player.state==='won',q=opened?(scene?.gate||1):0;
    c.save();line(c,[[x-44,y],[x-44,y-170],[x+44,y-170],[x+44,y]],'#7c8e81',12);
    c.strokeStyle=opened?'#ebcc8e':'#9aab9a';c.lineWidth=5;c.beginPath();c.arc(x,y-91,31,q*.55,TAU-q*.7);c.stroke();
    line(c,[[x,y-59],[x,y-8]],opened?'#f2cc82':'#6a8074',4);
    c.font='15px serif';c.textAlign='center';c.fillStyle='#d5c6a1';c.fillText(opened?'道路神锁已解':'道路神锁',x,y-194);
    this.mia(c,x+96,y,t);c.restore();
  }
  nameBridgeScene(c,w,distance,t){
    this.hills(c,w,distance,.08,442,'#344e57');
    this.backgroundDepth.draw(c,w,distance,'nameBridge');
    const cx=w*.7-distance*.015;
    for(let i=0;i<4;i++){
      const x=cx+(i-1.5)*270;
      c.strokeStyle='#49636a';c.lineWidth=19;c.beginPath();c.moveTo(x-92,600);c.bezierCurveTo(x-120,300,x+20,142,x+120,108);c.stroke();
      c.strokeStyle='#9ab29e33';c.lineWidth=2;c.beginPath();c.moveTo(x-84,584);c.bezierCurveTo(x-108,300,x+24,159,x+123,121);c.stroke();
    }
    for(let i=0;i<12;i++){
      const x=(i*139-distance*.25)%(w+200),y=515+Math.sin(i*1.7+t*.35)*22;
      polygon(c,[[x,y],[x+42,y-5],[x+47,y+8],[x+8,y+14]],'#91b1a52a');
    }
    this.mist(c,w,565,t,.12);
  }
  foreground(c,w,distance,t,biome=0) {
    const step=660,start=Math.floor(distance*.8/step)-1;
    for(let i=start;i<start+w/step+3;i++) {
      const x=i*step-distance*.8;const y=810;
      polygon(c,[[x-10,y],[x+3,y-133],[x+25,y-165],[x+30,y-106],[x+48,y-104],[x+61,y]],'#091416');
      if(biome===0)line(c,[[x+19,y-90],[x-25,y-124],[x-47,y-160]],'#0a1617',5);
      if(biome===1){line(c,[[x-30,y-40],[x+70,y-40]],'#58604a44',5);}
    }
    this.mist(c,w,754,t,.04);
  }
  embers(c,w,h,t,biome=0) {
    for(let i=0;i<40;i++) {
      const x=((noise(i+700)*w-t*(biome===2?48:biome===1?3:8+noise(i)*16))%w+w)%w,y=(noise(i+800)*h-t*(biome===1?-3:3+noise(i+1)*8)+h*100)%h;
      const warm=i%6===0;c.fillStyle=warm?'#d3a76b':'#a5b0a3';c.globalAlpha=(.16+noise(i+4)*.3)*(warm?1:.65);c.fillRect(x,y,warm?2:1,noise(i+8)*2+1);
    }
    c.globalAlpha=1;
    if(biome===0)for(let i=0;i<4;i++){const x=(w*.37+i*80-t*7+w*100)%w,y=150+Math.sin(i*2+t*.2)*32;const flap=Math.sin(t*4+i)*3;line(c,[[x-5,y-flap],[x,y],[x+5,y-flap]],'#15272bb0',1.5);}
  }
}

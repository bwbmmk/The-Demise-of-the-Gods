// 第四幕：路线推进与三楔战交替。战区净空，躲招推进、引王落锤拆楔。
// 六锁尽解只解除封锁；真门与三个结局留给第五幕。
import { WORLD, groundHeight, registerLevel } from './level.js';

const DAWN_GROUND=606;
const dawnTerrain=[
  [0,606],[2000,606],[2350,578],[3600,578],[3920,606],           // 避难所前的缓坡
  [6200,606],[6550,562],[8600,562],[8950,606],                   // 城道的行人台地
  [11200,606],[11600,570],[13600,570],[13900,606],               // 名单台地
  [16000,606],[16350,556],[18400,556],[18700,606],               // 守卫核查的高台
  [20600,606],[21000,574],[23000,574],[23300,606],[24000,606],   // 王座前的低凹（章界）
  [26000,606],[26350,560],[28400,560],[28700,606],               // 王座城的台地
  [30800,606],[31150,548],[33200,548],[33500,606],               // 上升的王庭
  [35600,606],[35950,534],[38000,534],[38300,606],               // 胸腔路口
  [40400,606],[40700,522],[42800,522],[43100,606],               // 最高高台 · 最后一楔
  [45200,606],[47200,606],
];

const dawnWedges=[
  {id:'wedge-1',x:26800,y:groundHeight(dawnTerrain,26800,DAWN_GROUND)-72},
  {id:'wedge-2',x:33400,y:groundHeight(dawnTerrain,33400,DAWN_GROUND)-72},
  {id:'wedge-3',x:40600,y:groundHeight(dawnTerrain,40600,DAWN_GROUND)-72},
];

const dawnSparks=[
  {id:'spark-0',x:24800},{id:'spark-1',x:25400},{id:'spark-2',x:26100},
  {id:'spark-3',x:31200},{id:'spark-4',x:32000},{id:'spark-5',x:32800},
  {id:'spark-6',x:38400},{id:'spark-7',x:39200},{id:'spark-8',x:40000},
].map((s,i)=>({...s,y:groundHeight(dawnTerrain,s.x,DAWN_GROUND)-46,index:i}));

const DAWN_MOVES={
  hammer:{id:'hammer',name:'王权落锤',read:'引到楔前 · 金圈变红后按 A 后撤',aim:1.65,recover:.45,bite:'hammer'},
  cinder:{id:'cinder',name:'熔渣抛物',read:'跑开→ 落石圈外 · 或站进缝里',aim:1.05,recover:.40,bite:'cinder'},
  quake:{id:'quake',name:'贴地冲击波',read:'贴地焰刃 · 跳跃越过',aim:1.05,recover:.40,bite:'quake'},
  meteor:{id:'meteor',name:'火雨',read:'落点已锁定 · 离开红圈或跳过残焰',aim:1.05,recover:.40,bite:'meteor'},
  stomp:{id:'stomp',name:'双重践踏',read:'跳↑ 环从脚下扩开',aim:1.05,recover:.40,bite:'stomp'},
  sweep:{id:'sweep',name:'火炬横扫',read:'悬空炬刃 · 滑铲从下方通过',aim:1.05,recover:.40,bite:'sweep'},
  pulse:{id:'pulse',name:'日冕高浪',read:'日冕高浪 · 二段跳越过',aim:1.05,recover:.55,bite:'pulse'},
};

const DAWN_PHASES=[[['quake','hammer']],[['sweep','hammer']],[['pulse','stomp','hammer']]];

const DAWN_SEAL_COST=2;
const DAWN_SPARK_MAX=3;

const DAWN_AIM=1.05, DAWN_AHEAD=1.34, DAWN_TOLERANCE=280, DAWN_HAMMER=72;

const dawnLayout=[
  ['block',2600,66,74,'cart'],['beam',3500,140,0,'awning'],
  ['beam',3820,150,0,'awning'],                                  // 重音 A：连滑（320px）
  ['gap',4600,285],                                            // 900 之后
  ['block',5700,70,80,'stone'],['beam',7050,150,0,'awning'],   // 1100 之后
  ['gap',8900,320],['beam',10150,158,0,'bell'],                // 1500 之后
  ['block',11600,72,84,'stone'],['gap',13300,318],
  ['beam',14700,158,0,'bell'],['beam',15550,150,0,'bell'],     // 连梁：连着滑两次
  ['beam',15880,150,0,'bell'],                                  // 重音 B：三连梁（330px）
  ['block',16850,68,88,'cart'],['gap',18500,338],
  ['beam',20000,160,0,'rope'],['block',21550,72,80,'stone'],
  ['gap',22250,300],
  ['beam',24000,150,0,'bell'],['beam',24400,150,0,'bell'],     // 重音 C：连滑（300px）
  ['block',24700,72,82,'stone'],                                // 紧接一跳：滑→跳
  ['gap',28600,330],                                           // 楔-1 之后：先跳出去
  ['beam',30000,160,0,'rope'],['block',30900,74,86,'stone'],   // 上升台地：滑→跳
  ['gap',31400,300],
  ['beam',35400,152,0,'bell'],['gap',36600,320],               // 一滑一跳
  ['block',37800,70,84,'stone'],
  ['gap',43400,300],                                           // 重音 D-1：跳
  ['beam',44000,158,0,'rope'],['beam',44400,150,0,'rope'],     // 重音 D-2：三连梁（400px）
  ['beam',44760,150,0,'rope'],
  ['gap',45400,300],['block',46300,70,86,'stone'],             // 收尾：跳出去落地
];
const dawnObstacles=dawnLayout
  .map(([type,x,width,height=0,skin],i)=>({id:`d-hazard-${i}`,type,x,width,height,skin}))
  .sort((a,b)=>a.x-b.x);

const dawnEmbers=[
  {id:'ember-0',x:5200},   // 一 · 第一个断口之后：教学，跑过去就捡到
  {id:'ember-1',x:12400},  // 二 · 城道连梁，滑过之后
  {id:'ember-2',x:16150},  // 二 · 三连梁之后（15890 之后，避开 beam@15740）
  {id:'ember-3',x:24300},  // 三 · 王座城第一段（撞王之前）
  {id:'ember-4',x:30200},  // 三 · 楔-2 与楔-3 之间
  {id:'ember-5',x:33700},  // 三 · 长台重音（34700）之前——这一段最紧，先给一枚
  {id:'ember-6',x:36900},  // 三 · 长台三连之后、出长台之前
  {id:'ember-7',x:42300},  // 四 · 最后一楔之后
  {id:'ember-8',x:43750},  // 四 · 三窄坑之间——最后一段唯一的中途补给
].map((e,i)=>({...e,y:groundHeight(dawnTerrain,e.x,DAWN_GROUND)-50,index:i}));

const dawnSprings=[
  {id:'wind-dawn-refuge',x:6450,width:100},   // 城南台地
  {id:'wind-dawn-court',x:20850,width:100},   // 城道台地（两块障碍之间的净空）
{ id:'wind-dawn-throne',x:38800,width:100 },  // 楔-3 之前的托举，落点留足刹车距离
  {id:'wind-dawn-chest',x:42600,width:100},   // 42800 台地根部（最后一楔之前）
];
const dawnRings=[
  {id:'ring-dawn-0',x:6715, y:294},
  {id:'ring-dawn-1',x:21132,y:306},
  {id:'ring-dawn-2',x:39080,y:332},
  {id:'ring-dawn-3',x:42880,y:248},
];

const dawnShards=[];
const addDawnShard=(x,y,extra)=>dawnShards.push({id:`d-memory-${dawnShards.length}`,x,y,...extra});

const DAWN_LIFT=[
  {id:'lift-dawn-0',spring:'wind-dawn-refuge',x:6600,z:6},
  {id:'lift-dawn-1',spring:'wind-dawn-court', x:21010,z:6},
  {id:'lift-dawn-2',spring:'wind-dawn-throne',x:38960,z:6},
  {id:'lift-dawn-3',spring:'wind-dawn-chest', x:42760,z:6},
];
const dawnLiftShards=[];
function pushLiftRail(lift,rail,extraJump,count){
  const spring=dawnSprings.find(s=>s.id===lift.spring);
  const W=WORLD,vx=360;
  const tApex=800/W.gravity,xApex=spring.x+vx*tApex;
  const y0=groundHeight(dawnTerrain,spring.x,DAWN_GROUND);
  const yApex=y0-800*tApex+.5*W.gravity*tApex*tApex;
  for(let i=0;i<count;i++){
    const x=lift.x+i*64;
    if(x<=xApex&&extraJump)continue;   // 高层不重复铺顶点前那一段（与低层重叠）
    const t=(x-spring.x)/vx;
    let y;
    if(x<=xApex)y=y0-800*t+.5*W.gravity*t*t;
    else if(!extraJump)y=yApex+.5*W.gravity*(t-tApex)**2;
    else{
      const dt=(x-xApex)/vx;
      const apexGround=groundHeight(dawnTerrain,xApex,DAWN_GROUND);
      const yApexLocal=apexGround-800*tApex+.5*W.gravity*tApex*tApex;
      y=yApexLocal+W.airJump*dt+.5*W.gravity*dt*dt;
    }
    const floor=groundHeight(dawnTerrain,x,DAWN_GROUND);
    if(y>floor-40||y<60)continue;
    dawnLiftShards.push({id:`${lift.id}-${rail}-${i}`,x,y:Math.round(y),spring:lift.spring,index:i,rail});
  }
}
for(const lift of DAWN_LIFT){
  pushLiftRail(lift,'lift-low',false,lift.z);
  pushLiftRail(lift,'lift-high',true,lift.z);
}
for(const s of dawnLiftShards)addDawnShard(s.x,s.y,{rail:s.rail,spring:s.spring,liftIndex:s.index});

const liftSpan=(x)=>DAWN_LIFT.some(l=>x>l.x-380&&x<l.x+380);
for(let x=700;x<46600;x+=460){
  if(dawnObstacles.some(o=>x>o.x-190&&x<o.x+o.width+190))continue;
  if(dawnSprings.some(s=>x>s.x-160&&x<s.x+s.width+160))continue;
  if(dawnRings.some(r=>Math.abs(r.x-x)<220))continue;
  if(liftSpan(x))continue;
  addDawnShard(x,groundHeight(dawnTerrain,x,DAWN_GROUND)-45);
}
for(const o of dawnObstacles){
  const floor=groundHeight(dawnTerrain,o.x,DAWN_GROUND);
  if(o.type==='gap')for(let i=0;i<3;i++)addDawnShard(o.x+o.width*(i+.5)/3,floor-118-Math.sin((i+.5)/3*Math.PI)*36);
  if(o.type==='block')addDawnShard(o.x+o.width/2,floor-135);
  if(o.type==='beam')addDawnShard(o.x+o.width/2,floor-18);
}
dawnShards.sort((a,b)=>a.x-b.x);

export const DAWN={
  id:'dawn',title:'第四幕 · 最后的神谕',
  lockOffset:5,brake:true,
  world:{...WORLD,end:47200},
  chapters:[
    {at:0,title:'记名避难所 · 互助之夜',subtitle:'ACT IV / 万家各自点灯',numeral:'I',speed:330,line:'这一次，不是他一个人在建。'},
    {at:11000,title:'王庭城道 · 献祭名单',subtitle:'ACT IV / 名单上有谁',numeral:'II',speed:350,line:'守卫在名单上找自己的家。'},
    {at:23000,title:'王座 · 尚未成形的太阳',subtitle:'ACT IV / 不能停步',numeral:'III',speed:360,line:'他一动，脚下的城就亮一分。'},
    {at:38800,title:'胸腔之上 · 最后一楔',subtitle:'ACT IV / 借他的火',numeral:'IV',speed:360,line:'再跑一段。前面还有一根。'},
  ],
  terrain:dawnTerrain,
  scenery:['refugeHall','courtRoad','throneCity','dawnChest'],
  obstacles:dawnObstacles,
  springs:dawnSprings,
  rings:dawnRings,
  shards:dawnShards,
  lift:DAWN_LIFT,
  embers:dawnEmbers,
  items:[],
  enemies:[],
  dawn:{
    id:'throne-dawn',name:'执炬王',x:41800,trigger:23400,
    aim:DAWN_AIM,ahead:DAWN_AHEAD,hammer:DAWN_HAMMER,tolerance:DAWN_TOLERANCE,
    recover:.40,stumble:1.5,chase:{speed:120,lead:820},
    wedges:dawnWedges,
    sealCost:DAWN_SEAL_COST,
    sparkMax:DAWN_SPARK_MAX,
    moves:DAWN_MOVES,phases:DAWN_PHASES,
    chainLead:0,
    chainRest:.25,
    counterWindow:3.2,
    baitWedges:true,
    strike:{swing:.22,cooldown:.45,reach:320,follow:.16},
    cadence:.35,
    cadenceDecay:.08,
    stagger:1.5,
    cinder:{count:3,spread:220,radius:64,fire:.55},
    quake:{height:42,width:90,speed:300,life:1.6},
    meteor:{count:4,span:520,radius:58},
    stomp:{rings:[120,220],width:36},
    sweep:{height:36,width:200,speed:360,life:1.4},
    pulse:{inner:70,outer:280,width:40},
    sparks:[],
    dash:{speed:250,duration:.55,cooldown:.4,max:3},
  },
  wedges:dawnWedges,
  flags:[
    {id:'d-refuge',x:700,event:'dawn-refuge'},
    {id:'d-roster',x:11800,event:'dawn-roster'},
    {id:'d-guard',x:12200,event:'dawn-guard'},
    {id:'d-lockroad',x:17600,event:'dawn-lockroad'},
    {id:'d-supply',x:22600,event:'dawn-supply'},
    {id:'d-throne',x:23600,event:'dawn-throne'},
    {id:'d-crown',x:30000,event:'dawn-crown'},
    {id:'d-lock',x:41800,event:'dawn-lock'},
  ],
  checkpoints:[0,11000,23000,38800],
  landmarks:[
    {kind:'refuge',x:600,label:'记名避难所 · 互助名册'},
    {kind:'court',x:11800,label:'王庭城道 · 献祭名单'},
    {kind:'throne',x:23500,label:'黎明王座 · 第一根楔'},
    {kind:'chest',x:41800,label:'安眠锁 · 第六道'},
  ],
  exits:[{id:'d-exit',x:47200,event:'dawn-complete'}],
  tutorials:[
    {from:0,to:600,text:'按住 A / ← 刹步，松开继续跑；空中仍向前移动'},
    {from:2200,to:2700,text:'前方是拾级而上的坡道 · 顺势起跳越过药车'},
    {from:4900,to:5700,text:'王的余烬落在地上 · 踩上去拾起，按 Shift / → 借火前冲'},
    {from:6400,to:7250,text:'风印托举 · 高处的共鸣可选，主线在地面'},
    {from:11900,to:12800,text:'王烧得越猛，落下的余烬越多 · 冲刺可以把你带出落锤范围'},
    {from:14400,to:15800,text:'两道横梁连着来 · 滑铲不必等恢复，提前读第二次'},
    {from:22000,to:23200,text:'守卫放行了 · 前面就是王座，先跟上'},
    {from:23450,to:24900,text:'黎明楔挡路 · 先引王的金圈到楔前，变红后按住 A 后撤，让落锤砸断楔'},
    {from:25400,to:26400,text:'门闩碎了他会踉跄 · 趁这段时间往前冲，别回头'},
    {from:39000,to:40400,text:'最后一根黎明楔 · 紫色高浪要二段跳，把落锤引向楔，变红后后撤'},
    {from:34800,to:35600,text:'贴地焰刃跳起 · 悬空炬刃滑铲 · 高浪二段跳'},
    {from:41800,to:43100,text:'最后一根楔已断 · 安眠锁解开。门可以开了，但门还没有开'},
  ],
};
registerLevel(DAWN);

const DAWN_PRACTICE_GROUND=DAWN_GROUND;
const dawnPracticeWedges=[
  {id:'wedge-1',x:5200, y:DAWN_PRACTICE_GROUND-72},
  {id:'wedge-2',x:8000, y:DAWN_PRACTICE_GROUND-72},
  {id:'wedge-3',x:10800,y:DAWN_PRACTICE_GROUND-72},
];
const dawnPracticeTerrain=[[0,DAWN_PRACTICE_GROUND],[13000,DAWN_PRACTICE_GROUND]];
export const DAWN_BOSS_PRACTICE={
  ...DAWN,
  id:'dawn-boss-practice',
  title:'执炬王 · 独立练习',
  bossOnly:true,
  world:{...DAWN.world,end:13000},
  chapters:[{
    at:0,title:'执炬王 · 独立练习',subtitle:'BOSS PRACTICE / 胸腔之上',
    numeral:'B',speed:360,
    line:'引王的金圈到楔前，变红后按住 A 后撤，让落锤砸断楔',
  }],
  terrain:dawnPracticeTerrain,
  obstacles:[],
  dawn:{
    ...DAWN.dawn,
    id:'throne-dawn-practice',x:12200,trigger:4400,
    wedges:dawnPracticeWedges,
    cadence:.5,
    cadenceDecay:0,
    chainRest:.8,
    phases:DAWN_PHASES,
    sparks:[],
  },
  wedges:dawnPracticeWedges,
  springs:[],rings:[],shards:[],items:[],enemies:[],
  flags:[],
  embers:[
    {id:'dp-ember-0',x:4900}, {id:'dp-ember-1',x:5100},
    {id:'dp-ember-2',x:7700}, {id:'dp-ember-3',x:7900},
    {id:'dp-ember-4',x:10500},{id:'dp-ember-5',x:10700},
  ].map((e,i)=>({...e,y:DAWN_PRACTICE_GROUND-50,index:i})),
  checkpoints:[4600],
  landmarks:[
    {kind:'chest',x:12200,label:'执炬王 · 门闩练习'},
    {kind:'throne',x:8000,label:'王座段 · 三门闩练习'},
  ],
  exits:[{id:'dawn-practice-exit',x:13000,event:'dawn-practice-complete'}],
  tutorials:[
    {from:0,to:700,text:'执炬王 · 引王的金圈到楔前，变红后按住 A 后撤，让落锤砸断楔'},
    {from:4400,to:5200,text:'门闩碎了他会踉跄 · 趁这段时间往前冲'},
    {from:7200,to:8000,text:'双重践踏分两次跳 · 火雨离开落点 · 日冕高浪二段跳'},
  ],
};
registerLevel(DAWN_BOSS_PRACTICE);

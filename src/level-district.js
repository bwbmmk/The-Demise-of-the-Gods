import { WORLD, groundHeight, registerLevel } from './level.js';
import { LANTERN } from './level-lantern.js';

// 对话只在安全落脚处触发；名字按路线获得，不要求抢拾。
const districtTerrain = [
  [0,606],[2800,606],[3100,552],[5500,552],[5800,606],
  [7500,606],[7850,570],[9900,570],[10200,606],[13000,606],
  [14400,606],[14700,532],[17800,532],[18100,606],
  [20600,606],[21000,560],[23000,560],[23300,606],[26000,606],
  [28000,606],[28400,575],[30500,575],[30800,606],
  [32600,606],[33000,548],[35200,548],[35500,606],
  [39000,606],[56000,606],
];
const districtChapters = [
  {at:0,title:'医者旧屋',subtitle:'ACT I / 失名街区 · 01',numeral:'I',speed:310,line:'韩蕙还在旧屋收药。先去接她。'},
  {at:13000,title:'报时钟楼',subtitle:'ACT I / 失名街区 · 02',numeral:'II',speed:340,line:'常晚留在钟楼，得带她下去。'},
  {at:26000,title:'临河渡口',subtitle:'ACT I / 失名街区 · 03',numeral:'III',speed:365,line:'船还停在渡口。岑渡应该在那里。'},
  {at:39000,title:'记名桥',subtitle:'ACT I / 被遗忘者的国度',numeral:'IV',speed:320,line:'人已到齐，得想办法让桥重新接上。'},
];
const districtLayout = [  ['block',1450,62,66,'medicine'],['beam',2470,150,0,'awning'],
  ['block',3880,72,78,'medicine'],['gap',4850,180],
  ['beam',6420,155,0,'awning'],['gap',7200,275],
  ['block',9020,70,72,'cart'],['beam',10100,160,0,'awning'],
  ['block',13900,70,76,'stone'],['beam',15550,155,0,'bell'],
  ['gap',16500,210],['block',17700,72,84,'stone'],
  ['beam',18950,160,0,'bell'],['gap',19900,305],
  ['beam',22250,155,0,'bell'],['block',22800,68,72,'stone'],
  ['block',27150,66,74,'cargo'],['gap',28600,220],
  ['beam',29750,160,0,'rope'],['gap',31200,320],
  ['block',33600,72,80,'cargo'],['beam',34700,150,0,'rope'],
  ['gap',35700,290],
];
const districtObstacles=districtLayout.map(([type,x,width,height=0,skin],i)=>({id:`q-route-${i}`,type,x,width,height,skin}));
const districtItems=[
  {id:'plate-healer',x:11500,event:'plate-healer',place:'医者旧屋',name:'韩蕙'},
  {id:'plate-bell',x:24600,event:'plate-bell',place:'报时钟楼',name:'常晚'},
  {id:'plate-ferry',x:37700,event:'plate-ferry',place:'临河渡口',name:'岑渡'},
].map(item=>({...item,required:true,y:groundHeight(districtTerrain,item.x,606)-48}));
const districtSprings=[{id:'wind-heal',x:8150,width:100},{id:'wind-bell',x:21300,width:100},{id:'wind-ferry',x:32050,width:100}];
const districtRings=[{id:'ring-quarter-0',x:8400,y:365},{id:'ring-quarter-1',x:21550,y:355},{id:'ring-quarter-2',x:32300,y:401}];
const districtShards=[];
const addDistrictShard=(x,y)=>districtShards.push({id:`memory-quarter-${districtShards.length}`,x,y});
// Boss 段只在桥面恢复后开放，所以这段不放碎片，避免"打完 BOSS 顺手捡一路"稀释终点。
for(let x=700;x<39600;x+=460){
  if(districtObstacles.some(o=>x>o.x-180&&x<o.x+o.width+180)||districtItems.some(i=>Math.abs(i.x-x)<400))continue;
  addDistrictShard(x,groundHeight(districtTerrain,x,606)-45);
}
for(const o of districtObstacles){
  const y=groundHeight(districtTerrain,o.x,606);
  if(o.type==='gap')for(let i=0;i<3;i++)addDistrictShard(o.x+o.width*(i+.5)/3,y-120-Math.sin((i+.5)/3*Math.PI)*35);
  if(o.type==='block')addDistrictShard(o.x+o.width/2,y-135);
  if(o.type==='beam')addDistrictShard(o.x+o.width/2,y-18);
}
districtShards.sort((a,b)=>a.x-b.x);

// --------------------------------------------------------------------------- //
// 记名桥机关：执炬王麾下的追索军官
//
// 设计约束（见 AGENTS.md 与任务要求）：
// - 不新增攻击键。玩家仍然只有跳跃、二段跳、滑铲；
//   造成伤害的是三位同行者的协同（常晚敲钟、岑渡送缆绳、韩蕙护身）。
// - 三轮定胜负。每轮 = 预警 → 法术 → 破盾窗口 → 拾取反击道具 → 自动反击。
// - 反击道具漏捡会再次出现，不允许卡关；Boss 前有检查点。
// - 所有判定都由 physics.js 的确定性状态机驱动，暂停/跳过不改变数值。
// --------------------------------------------------------------------------- //
const BRIDGE_GROUND=606;
const districtBoss={
  id:'warden-officer',
  name:'追索军官',
  // x 只作为"这场战斗属于这一段"的锚点（检查点判定、HUD 分段都用它），
  // 真实位置每帧由 lead 决定：军官会飞、无视地形，和玩家同速前进。
  x:41600,
  trigger:39900,
  // 军官始终停在玩家前方 lead px。480 是屏幕构图值：
  // 玩家固定在屏幕 22% 处，480 让军官落在屏幕右侧约 2/3 处，
  // 最窄的 860px 屏上也不会出屏。
  lead:480,
  rounds:3,
  // 起手预警 1.4 秒，留出辨认招式的时间。
  windup:1.4,
  // 每轮由 patterns 指定招式；volley 保留为最多发数，gap 为施法间隔。
  volley:5,gap:1.65,
  patterns:[['low','low','low'],['high','low','high','low'],['fall','high','low','fall','high']],
  cast:1.3,
  speed:270,
  shield:2.2,
  // 回火印投到前方空中，需要跳起接住；漏接后重新投放。
  relicLead:380,
  relics:[
    {id:'relic-bell-r1',life:4,from:'岑渡'},
    {id:'relic-rope-r2',life:4,from:'岑渡'},
    {id:'relic-bell-r3',life:4,from:'岑渡'},
  ],
  stations:[
    // x 保留关卡锚点；战斗中三位同伴随玩家移动，并各自提供援助。
    {kind:'bell',x:40300,name:'常晚'},
    {kind:'rope',x:41400,name:'岑渡'},
    {kind:'ward',x:42500,name:'韩蕙'},
  ],
};

export const DISTRICT={
  id:'district',lockOffset:0,lockIds:['road'],title:'第一幕 · 被遗忘者的国度',world:{...WORLD,end:56000},
  chapters:districtChapters,terrain:districtTerrain,obstacles:districtObstacles,
  scenery:['quarter','bellTower','ferry','nameBridge'],
  items:districtItems,springs:districtSprings,rings:districtRings,shards:districtShards,
  // 灰潮侵蚀的守灯人：杖尖蓄光后发射沿地面前进的灰弹。最后一处为双发。
  enemies:[6100,15300,18700,28200,36800].map((x,i)=>({id:`ash-keeper-${i}`,x,trigger:x-600,windup:.75,speed:230,shots:i===4?2:1,interval:.65})),
  boss:districtBoss,
  flags:[{id:'q-enter',x:400,event:'quarter-enter'},{id:'q-heal',x:10600,event:'quarter-healer'},
    {id:'q-bell',x:23800,event:'quarter-bell'},{id:'q-ferry',x:36800,event:'quarter-ferry'},
    {id:'q-bridge',x:39800,event:'quarter-bridge'},{id:'q-warden',x:39860,event:'quarter-warden'}],
  checkpoints:[13000,26000,39000],exits:[{id:'bridge-crossing',x:56000,event:'district-complete'}],
  tutorials:[{from:850,to:1550,text:'药箱挡路 · 空格跃过'},{from:1920,to:2620,text:'倒塌的雨棚 · ↓ 滑铲穿过'},
    {from:5400,to:6200,text:'守灯人举杖蓄光后会放出灰弹 · 靠近时跳过'},
    {from:6570,to:7500,text:'街面被灰潮吞去 · 起跳后再按一次空格'},
    {from:7800,to:8500,text:'风印托举 · 高处共鸣可选，主线在地面'},
    {from:30350,to:31600,text:'栈桥断裂 · 两次跳跃越过水面'},
    {from:39850,to:40250,text:'看招式躲避 · 低刃跳过，高幕滑铲，紫色落印二段跳'},
    {from:40250,to:41200,text:'常晚敲钟破盾 · 留意前方青色回火印'},
    {from:41200,to:42400,text:'岑渡送来回火印 · 跳起接住，自动反击'},
    {from:42400,to:43600,text:'韩蕙托灯护身 · 抵挡一次伤害'}],
  landmarks:[{x:11500,kind:'healer',name:'韩蕙',label:'医者旧屋'},
    {x:24600,kind:'bell',name:'常晚',label:'报时钟楼'},
    {x:37700,kind:'ferry',name:'岑渡',label:'临河渡口'},
    {x:40300,kind:'bridge',label:'记名桥'}],
};
// 北岸改为纯剧情幕间，不再拼接跑图。
export const NORTH_BANK=56000;
export const NORTH_SCALE=.65;
registerLevel(DISTRICT);

// 独立的桥心练习场：复用正式 Boss 机制，但移除前置跑图、收集和对白，
// 从触发点前几步直接开始，击退军官后立即结算，方便反复练习读招。
const practiceTerrain=[[0,BRIDGE_GROUND],[43000,BRIDGE_GROUND]];
export const BOSS_PRACTICE={
  ...DISTRICT,
  id:'boss-practice',
  title:'桥心 Boss 练习',
  world:{...DISTRICT.world,end:43000},
  chapters:[{at:0,title:'桥心 Boss 练习',subtitle:'BOSS PRACTICE / 记名桥',numeral:'B',speed:320,line:'读招、躲开、接住回火印。'}],
  terrain:practiceTerrain,
  obstacles:[],items:[],springs:[],rings:[],shards:[],enemies:[],flags:[],
  tutorials:[{from:0,to:43000,text:'练习场 · 低刃跳过，高位光幕滑铲，紫色落印二段跳'}],
  scenery:['nameBridge'],
  checkpoints:[39800],
  exits:[{id:'boss-practice-exit',x:43000,event:'boss-practice-complete'}],
  bossOnly:true,
  coldZones:null,lamps:[],
};
registerLevel(BOSS_PRACTICE);

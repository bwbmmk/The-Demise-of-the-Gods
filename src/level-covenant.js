import { WORLD, registerLevel } from './level.js';
import { CHAIN_PATTERNS } from './chain-boss.js';

// 第二幕：控速过潮、落脚续跳、诱导巨像砸断锁链。
export const COVENANT={
  id:'covenant',lockOffset:1,lockIds:['wind','tides','harvest'],brake:true,finishOnBoss:true,title:'第二幕 · 众神的谎言',world:{...WORLD,end:58000},
  chapters:[
    {at:0,title:'风域 · 高坡旧祠',subtitle:'ACT II / 借风过崖',numeral:'I',speed:330,line:'风从旧祠里吹出来。先去找那份原契。'},
    {at:15000,title:'海域 · 退潮港',subtitle:'ACT II / 读潮躲浪',numeral:'II',speed:350,line:'有人愿意留下，也该有人能离开。'},
    {at:30000,title:'丰收域 · 育种粮仓',subtitle:'ACT II / 断桥不停步',numeral:'III',speed:365,line:'粮仓还在收取记忆。先去看门边的欠单。'},
    {at:42000,title:'封门 · 守门巨像',subtitle:'ACT II / 诱锤断链',numeral:'IV',speed:365,line:'祭坛还在抽取人的记忆。砸断供能链，打开领还记忆的通道。'},
  ],
  terrain:[[0,606],[58000,606]],scenery:['windArchive','tideHarbor','harvestGranary','sealGate'],
  obstacles:[
    ['block',1400,68,74],['beam',2450,145],['gap',3300,380],['block',4800,72,82],['beam',6050,160],
    ['gap',8100,400],['beam',9700,165],['block',10900,70,88],['gap',12600,310],['beam',13900,150],
    ['block',16100,72,82],['beam',18500,165],['gap',19750,320],['beam',22500,160],['block',23900,72,88],
    ['gap',26900,350],['beam',28500,165],
    ['gap',32000,600],['beam',33800,165],['block',35050,72,85],['gap',36500,620],['beam',38500,170],['gap',39500,340],
  ].map(([type,x,width,height=0],i)=>({id:`c-hazard-${i}`,type,x,width,height,steps:type==='gap'&&width>=600})),
  windZones:[{id:'wind-c1',from:2850,to:4250,lift:.72,push:95},{id:'wind-c2',from:7650,to:9200,lift:.72,push:95}],
  tides:[],
  tidalChannels:[{id:'channel-1',x:17500,width:650,period:7,open:3.4,offset:0},{id:'channel-2',x:25300,width:730,period:6.8,open:3.2,offset:2.1}],
  platforms:[{id:'dream-1',x:32180,width:195,y:531,trigger:31550,warning:.5,life:3.8,collapse:.75},{id:'dream-2',x:36680,width:195,y:531,trigger:36050,warning:.5,life:3.8,collapse:.65}],
  springs:[],rings:[{id:'ring-covenant-0',x:13200,y:440}],
  shards:[1100,2100,4400,5600,7200,10300,11800,14500,15500,19000,20400,23200,26000,29100,31000,34400,37800,40800].map((x,i)=>({id:`c-memory-${i}`,x,y:561})),
  items:[],enemies:[],
  flags:[{id:'c-wind',x:800,event:'covenant-wind'},{id:'c-clause',x:11500,event:'covenant-clause'},{id:'c-sea',x:15500,event:'covenant-sea'},{id:'c-choice',x:29100,event:'covenant-choice'},{id:'c-sleep',x:30500,event:'covenant-harvest'},{id:'c-gate',x:42200,event:'covenant-gate'}],
  landmarks:[{kind:'archive',x:800,label:'高坡旧祠 · 笛谱与铜契'},{kind:'harbor',x:15500,label:'退潮港 · 旧渡簿'},{kind:'granary',x:30500,label:'育种粮仓 · 领还册'},{kind:'seal',x:42150,label:'三域封门 · 强征回路'}],
  checkpoints:[0,15000,30000,42000],exits:[{id:'c-exit',x:58000,event:'covenant-complete'}],
  tutorials:[
    {from:0,to:600,text:'按住 A / ← 刹步，松开继续跑；空中仍向前移动'},
    {from:2800,to:4200,text:'青色顺风托住跳跃 · 在断崖边起跳，空中还能再跃'},
    {from:16900,to:18000,text:'按住 A / ← 在岸边等退潮；绿灯亮起再松开，通过水道'},
    {from:31250,to:32650,text:'木板踩上就开始断裂 · 落稳后赶紧往前跳，空中还能再跃'},
    {from:35900,to:37200,text:'第二座断桥塌得更快 · 落上木板恢复二段跳，别停步'},
    {from:41700,to:42600,text:'把黄圈引到锁桩上 → 按 A 停住 → 红圈锁定后松开离开 → 跳震波'},
  ],
  boss:{id:'chain-warden',kind:'chain',name:'守门巨像',x:43700,trigger:42500,lead:330,rounds:3,ward:false,patterns:CHAIN_PATTERNS},
};
registerLevel(COVENANT);

// 巨像练习复用正式状态机，检查点放在触发点前，失败也能直接重战。
export const COVENANT_BOSS_PRACTICE={
  ...COVENANT,
  id:'covenant-boss-practice',title:'守门巨像 Boss 练习',bossOnly:true,
  world:{...COVENANT.world,end:52000},
  chapters:[{at:0,title:'守门巨像 · 独立练习',subtitle:'BOSS PRACTICE / 三域封门',numeral:'B',speed:365,line:'黄圈对桩，红圈离开，跳过落锤后的震波。'}],
  terrain:[[0,606],[52000,606]],scenery:['sealGate'],
  obstacles:[],windZones:[],tides:[],tidalChannels:[],platforms:[],
  springs:[],rings:[],shards:[],items:[],enemies:[],flags:[],
  checkpoints:[42500-365/120],landmarks:[{kind:'seal',x:42150,label:'三域封门 · 巨像练习'}],
  exits:[{id:'chain-practice-exit',x:52000,event:'chain-practice-complete'}],
  tutorials:[],
};
registerLevel(COVENANT_BOSS_PRACTICE);

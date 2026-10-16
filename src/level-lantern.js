import { WORLD, groundHeight } from './level.js';

// 第一幕桥后段的数据模板；不作为独立章节注册或显示。
const lanternTerrain=[[0,606],[5800,606],[6150,552],[8700,552],[9050,606],[11000,606],[13500,606],[13850,566],[17100,566],[17450,606],[22000,606],[23700,606],[24050,548],[26700,548],[27050,606],[33000,606]];
const lanternChapters=[
  {at:0,title:'军粮旧道',subtitle:'CHAPTER II / 七夜微火 · 01',numeral:'I',speed:315,line:'桥对岸有一名落单的追索兵。他一直望着北边的屋子。'},
  {at:11000,title:'熄灯拱廊',subtitle:'CHAPTER II / 七夜微火 · 02',numeral:'II',speed:345,line:'下一座灯架在拱廊尽头。先从炭盆续火，再穿过寒雾。'},
  {at:22000,title:'北岸收容所',subtitle:'CHAPTER II / 七夜微火 · 03',numeral:'III',speed:355,line:'药箱和热水都到了。还差收容所门前的最后一盏灯。'},
];
const lanternLayout=[
  ['block',1250,64,68,'cargo'],['beam',2350,150,0,'awning'],
  ['block',5250,66,74,'cargo'],['gap',6360,190],['beam',7010,145,0,'awning'],
  // 8950 → 8500：原位落在 [8700,552]→[9050,606] 这段54px 上坡上，
  // 块底锚在左端，右侧地面下坠 11.1px，块与地面之间裂出一条可钻的缝——
  // 那等于这个块根本不存在。8500 在平段 [6150,8700] 上，下坠 0。
['block',8500,72,76,'stone'],['gap',9860,285],
  ['block',11500,70,68,'cargo'],['beam',13200,155,0,'awning'],
  ['gap',14100,210],['block',15000,70,82,'stone'],['beam',16700,160,0,'awning'],
  ['gap',18100,300],['block',19300,68,76,'cargo'],['beam',20800,150,0,'awning'],
  ['block',23400,68,72,'stone'],['gap',24700,280],['beam',25700,155,0,'awning'],
  ['block',28450,66,70,'cargo'],['gap',29800,310],['beam',31000,150,0,'awning'],
];
const lanternObstacles=lanternLayout.map(([type,x,width,height=0,skin],i)=>({id:`l-route-${i}`,type,x,width,height,skin}));
const lanternFuel=[4500,12300,23000].map((x,i)=>({id:`coal-${i}`,x,y:groundHeight(lanternTerrain,x,606)-48,required:true,kind:'coal',event:`coal-${i}`,place:'炭盆续火'}));
const lanternLamps=[{id:'lamp-0',x:7600},{id:'lamp-1',x:15600},{id:'lamp-2',x:26500}];
const lanternShards=[];
for(let x=600;x<32400;x+=470){if(lanternObstacles.some(o=>x>o.x-190&&x<o.x+o.width+190)||lanternFuel.some(i=>Math.abs(i.x-x)<200))continue;lanternShards.push({id:`l-memory-${lanternShards.length}`,x,y:groundHeight(lanternTerrain,x,606)-45});}
for(const o of lanternObstacles){const floor=groundHeight(lanternTerrain,o.x,606);if(o.type==='gap')for(let i=0;i<3;i++)lanternShards.push({id:`l-memory-${lanternShards.length}`,x:o.x+o.width*(i+.5)/3,y:floor-150});}

export const LANTERN={
  id:'lantern',title:'七夜微火',world:{...WORLD,end:33000},terrain:lanternTerrain,chapters:lanternChapters,
  obstacles:lanternObstacles,shards:lanternShards,springs:[{id:'l-lift',x:20100,width:100}],
  rings:[{id:'ring-lantern-0',x:20320,y:405}],items:lanternFuel,enemies:[],
  checkpoints:[11000,22000],exits:[{id:'l-exit',x:33000,event:'lantern-complete'}],
  scenery:['supplyRoad','coldArcade','shelter'],
  warmthDuration:12,lamps:lanternLamps,
  coldZones:[{id:'cold-0',from:4900,to:7500},{id:'cold-1',from:12800,to:15500},{id:'cold-2',from:23300,to:26400}],
  flags:[{id:'l-father',x:3200,event:'lantern-father'},{id:'l-trial',x:4100,event:'lantern-trial'},{id:'l-first-light',x:8000,event:'lantern-first-light'},{id:'l-shelter',x:27500,event:'lantern-shelter'}],
  landmarks:[{kind:'father',x:3210,label:'追索兵 · 陆承'},{kind:'shelter',x:27510,label:'北岸收容所'}],
  tutorials:[{from:4400,to:5100,text:'炭盆自动续火 · 携灯可穿过寒雾 · 暖光仅维持 12 秒'}, {from:6270,to:6500,text:'↑ 跳过断口'}, {from:9730,to:10000,text:'↑ ↑ 二段跳越过宽断口'}, {from:12000,to:12900,text:'靠近炭盆自动续火 · 将暖光送到拱廊尽头'}, {from:22500,to:23300,text:'最后一次续火 · 越过寒雾，点亮收容所的灯'}],
};

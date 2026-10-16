import { WORLD, registerLevel } from './level.js';

// 金色旧桥只有照忆时承重；蓝色封墙也只在照忆时拦路。
const fateBridges=[
  {x:2300,width:1050,wall:false},
  {x:6350,width:1130,wall:true},
  {x:10600,width:1130,wall:true},
  {x:15300,width:1420,wall:true,extra:true},
  {x:19500,width:1420,wall:true,extra:true},
  {x:27200,width:1420,wall:true,extra:true},
  {x:34050,width:1420,wall:true,extra:true},
  {x:38200,width:1420,wall:true,extra:true},
];
export const FATE={
  id:'fate',title:'第三幕 · 弑日者',lockOffset:4,brake:true,echo:true,
  world:{...WORLD,end:41400},
  chapters:[
    {at:0,title:'命运域 · 留痕廊',subtitle:'ACT III / 照忆',numeral:'I',speed:345,line:'这里留下的，是曾经发生过的事。'},
    {at:12500,title:'白昼战争 · 封门之日',subtitle:'ACT III / 旧日重临',numeral:'II',speed:355,line:'门边有人在求他。声音越来越近。'},
    {at:23000,title:'焚名台 · 无人同行',subtitle:'ACT III / 自己的选择',numeral:'III',speed:350,line:'刻痕没有变。现在，他认得这只手了。'},
    {at:31000,title:'灰潮 · 三盏避难灯',subtitle:'ACT III / 携火救人',numeral:'IV',speed:365,line:'火只能用一次。前面还有人。'},
  ],
  terrain:[[0,606],[41400,606]],scenery:['fateArchive','warGate','namePyre','greyRefuge'],
  obstacles:[
    ...fateBridges.map((b,i)=>({id:`f-gap-${i}`,type:'gap',x:b.x,width:b.width,height:0})),
    ...[['block',4100,65,76],['beam',4850,130],['block',8400,68,84],['beam',9250,140],
      ['beam',13700,150],['block',17500,70,90],['beam',18400,150],
      ['block',25400,70,88],['beam',26300,145],['block',32700,70,90],['beam',33250,145],
      ['block',35900,70,95],['beam',36450,150],['block',40400,70,88]].map(([type,x,width,height=0],i)=>({id:`f-hazard-${i}`,type,x,width,height})),
  ].sort((a,b)=>a.x-b.x),
  echoPlatforms:fateBridges.flatMap((b,i)=>[180,570,b.extra?1000:940].map((offset,j)=>({id:`f-stone-${i}-${j}`,x:b.x+offset,width:j===0?250:300,y:531}))),
  echoWalls:fateBridges.flatMap((b,i)=>b.wall?[{id:`f-wall-${i}-a`,x:b.x+480,width:45,top:250,bottom:710},...(b.extra?[{id:`f-wall-${i}-b`,x:b.x+915,width:40,top:250,bottom:710}]:[])]:[]),
  springs:[],rings:[{id:'ring-fate-0',x:8600,y:436}],
  shards:[1000,3900,8000,9700,12000,13300,17200,18100,22100,25000,26100,29300,32200,35800,37500,40700].map((x,i)=>({id:`f-memory-${i}`,x,y:561})),
  items:[{id:'memory-ember',kind:'ember',required:true,x:29800,y:553,event:'fate-ember',place:'命运神留下的记忆余火'}],enemies:[],
  flags:[
    {id:'f-archive',x:650,event:'fate-archive'},
    {id:'f-war',x:12800,event:'fate-war'},
    {id:'f-close',x:17100,event:'fate-close'},
    {id:'f-sun',x:21800,event:'fate-sun'},
    {id:'f-pyre',x:23400,event:'fate-pyre'},
    {id:'f-lock',x:24500,event:'fate-lock'},
    {id:'f-miya',x:24800,event:'fate-miya'},
    {id:'ember-spent',x:31500,event:'fate-sacrifice',manual:true},
    {id:'saved-traveler',x:31500,event:'fate-rescue',manual:true},
    {id:'saved-elder',x:35600,event:'fate-rescue',manual:true},
    {id:'saved-child',x:37300,event:'fate-rescue',manual:true},
  ],
  rescues:[
    {id:'saved-traveler',x:31500,name:'提灯的妇人',kind:'healer',seconds:1.1},
    {id:'saved-elder',x:35600,name:'扶杖的老人',kind:'elder',seconds:1.1},
    {id:'saved-child',x:37300,name:'抱着书的孩子',kind:'child',seconds:1.1},
  ],
  greyChase:{trigger:31500,speed:320,lead:600},
  checkpoints:[0,12500,23000,31000],
  landmarks:[{kind:'fate',x:550,label:'留痕廊 · 封存的选择'},{kind:'fate',x:12750,label:'封门记录 · 白昼战争'},{kind:'fate',x:24350,label:'命运锁 · 第五道'},{kind:'fate',x:29800,label:'记忆余火 · 仅此一次'}],
  exits:[{id:'f-exit',x:41400,event:'fate-complete'}],
  tutorials:[
    {from:1200,to:2100,text:'按住 E 照忆：金色旧桥承重；松开后只剩轮廓'},
    {from:2160,to:3470,text:'按住 E 跃上旧桥；每次落稳都会恢复二段跳'},
    {from:5650,to:6300,text:'蓝色封墙也会显形：跳离石台 → 松开 E 穿墙 → 再按住 E 落到下一台'},
    {from:14350,to:15050,text:'前面有两道封墙，每次跃离石台都要收光穿墙，再照亮下一台'},
    {from:30600,to:31800,text:'靠近避难灯会停步；按住 E 注火救人。灰潮追来后，别回头'},
  ],
};
registerLevel(FATE);

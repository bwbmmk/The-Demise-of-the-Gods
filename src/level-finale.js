import { WORLD,registerLevel } from './level.js';
export const FINALE={
  id:'finale',title:'第五幕 · 凡人的黎明',lockOffset:6,brake:true,
  world:{...WORLD,end:11600},
  chapters:[
    {at:0,title:'归途 · 万家灯火',subtitle:'ACT V / THE ROAD HOME',numeral:'I',speed:330,line:'沿着灯火，回到无名之门。'},
    {at:4800,title:'门前 · 最后的选择',subtitle:'ACT V / THE NAMELESS GATE',numeral:'II',speed:340,line:'六锁已解。神心仍在你的手里。'},
    {at:10400,title:'真门 · 凡人的黎明',subtitle:'ACT V / THE LAST CHOICE',numeral:'III',speed:340,line:'这次，由你决定。'},
  ],
  terrain:[[0,606],[2300,606],[2600,578],[3500,578],[3800,606],[6500,606],[6900,562],[7700,562],[8000,606],[11600,606]],
  scenery:['refugeHall','courtRoad','finalGate'],
  obstacles:[
    {id:'v-gap-0',type:'gap',x:1600,width:285},
    {id:'v-block-0',type:'block',x:3000,width:70,height:80,skin:'stone'},
    {id:'v-beam-0',type:'beam',x:4200,width:160,height:0,skin:'rope'},
    {id:'v-gap-1',type:'gap',x:5800,width:310},
    {id:'v-beam-1',type:'beam',x:8500,width:150,height:0,skin:'awning'},
    {id:'v-block-1',type:'block',x:9200,width:68,height:82,skin:'stone'},
  ],
  springs:[],rings:[],items:[],enemies:[],
  shards:Array.from({length:14},(_,i)=>({id:`v-shard-${i}`,x:500+i*680,y:510})),
  checkpoints:[0,4800,10400],
  flags:[{id:'v-home',x:600,event:'final-home'},{id:'v-price',x:5000,event:'final-price'}],
  landmarks:[{kind:'refuge',x:650,label:'互助的灯路'},{kind:'court',x:5100,label:'七夜之外'},{kind:'finalGate',x:11200,label:'无名之门'}],
  exits:[{id:'v-exit',x:11600,event:'final-complete'}],
  tutorials:[{from:10200,to:11200,text:'到门前选择：续旧契、毁神权，或让火归于万家。'},
    {from:0,to:1000,text:'灯路已通。沿着它回到无名之门。'}],
  // 决斗场：left/right 是玩家活动范围相对 arena 的偏移，默认 -260 / +100（=360px）。
  // 这里放宽到 440px，因为横扫地火是「五道火柱 + 四个安全缝」的结构：
  //   窄场地逼着火柱挤在一起，缝只有 8px 可用（玩家原话「非常难躲」）。
  //   440px 让五道各留 64px 缝、两端还能各站 12px，三条躲法才都走得通。
  // 改这个数要同步重算 final-boss.js 里的 SWEEP_* 常量。
  finalBoss:{trigger:10800,arena:11000,left:-300,right:140},
};
registerLevel(FINALE);
export const FINAL_BOSS_PRACTICE={...FINALE,id:'final-boss-practice',title:'执炬王 · 真门决战',bossOnly:true,
  world:{...WORLD,end:11600},chapters:[{at:0,title:'执炬王 · 真门决战',subtitle:'FINAL DUEL',numeral:'B',speed:340,line:'躲开赤火，按住 E 接回记忆，松开 E 送回。'}],
  terrain:[[0,606],[11600,606]],scenery:['finalGate'],obstacles:[],shards:[],flags:[],landmarks:[],tutorials:[],checkpoints:[0],exits:[],};
registerLevel(FINAL_BOSS_PRACTICE);

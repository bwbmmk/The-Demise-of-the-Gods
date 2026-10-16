// New finale copy is intentionally editable. Existing published text remains unchanged.
export const FINAL_CHOICES=[
  {id:'throne',title:'余晖王座',body:'不开门，延续执炬王的道路。保住供给与白昼，也保留旧契约。'},
  {id:'night',title:'无神长夜',body:'开门，送葬七神，毁去神权。记忆归来，灰潮结束；人间失去供给与御寒的力量。'},
  {id:'embers',title:'万家微火',body:'开门，迎战执炬王。尝试留下力量，结束神的统治，让人间自己掌火。'},
];
export const FINAL_ENDINGS={
  throne:[
    {kicker:'ENDING I / THE AFTERGLOW THRONE',title:'余晖王座',body:'神心留在门外。烬接过王的火，坐上黎明王座。积雪融化，粮仓重新得到供给。无名之门依旧关闭。',quote:'新的白昼，仍由记忆支付。',art:'final-throne'},
    {kicker:'THE COVENANT REMAINS',title:'有人活到了明天。',body:'人们重新献出记忆，换取庇护。母亲叫孩子的名字，孩子回过头，却没认出那是在叫自己。旧契约继续运转。',quote:'门没有开。',art:'final-throne'},
  ],
  night:[
    {kicker:'ENDING II / THE GODLESS NIGHT',title:'无神长夜',body:'太阳神之心进入真门。七神终于死亡，被夺走的记忆回到人间。烬毁去神权，灰潮止息。',quote:'每一个名字，都回来了。',art:'final-open'},
    {kicker:'THE PRICE OF FREEDOM',title:'长夜没有尽头。',body:'回路停止供给。粮食耗尽，严寒吞没温室和城镇。人们带着自己的记忆向南迁徙，一个接一个倒在路上。人类逐渐走向灭亡。',quote:'他们记得彼此，却无法再暖起来。',art:'final-night'},
  ],
  embers:[
  {
    "kicker": "THE LAST WATCH",
    "title": "王倒下时，仍护着那一点火。",
    "body": "王冠滚下石阶。执炬王跪在断炬旁，掌中的火仍照着门外的城。每有一缕金光从他身上剥落，远处就暗下一扇窗。烬没有再出手。他托住那点正在熄灭的光。",
    "quote": "执炬王：「赢了我，然后呢？雪停了吗？」",
    "art": "final-transfer"
  },
  {
    "kicker": "WHAT THE KING REMEMBERS",
    "title": "他记得第一场雪。",
    "body": "「那一年，粮仓冻得打不开。有人抱着孩子来求我。我答应过他们，天会亮。」王看着自己的手。千百年来，他用征来的记忆续火，再用续起的火证明征取不可停止。如今他终于看见，掌中留下的是力量，也是每一个没能兑现的明天。",
    "quote": "烬：「你救过他们。可活下来的人，不该永远欠你一生。」",
    "art": "final-transfer"
  },
  {
    "kicker": "THE TORCH WITHOUT A THRONE",
    "title": "这一次，他没有把火攥紧。",
    "body": "门外的灯路没有随王冠坠落而熄灭。记名的人仍在传递名单，邻里轮流守着炉子。烬指向那些微光：「他们已经在照顾彼此。缺的是你手里的力量。」王沉默很久。他把这些年积存的权柄自愿交给烬，一点也没有留下。",
    "quote": "执炬王：「别替我坐上去。让他们过冬。」",
    "art": "final-transfer"
  },
  {
    "kicker": "THE NAME BEHIND THE GATE",
    "title": "门后，是他未走完的一生。",
    "body": "烬走入真门，找回自己的记忆与过去的力量。第三幕失去的只是那一次余火，门后的一生仍在。他记起曾经想回去的家，也记起关门时握得发白的手。名字终于回来了。他比任何时候都想活下去。",
    "quote": "他在心里念了一遍自己的名字。没有再把它烧掉。",
    "art": "final-open"
  },
  {
    "kicker": "THE LAST COVENANT",
    "title": "他不愿再成为一轮太阳。",
    "body": "七神彻底死亡，旧回路正在崩解。烬可以把权柄留在身上，让人们重新向他求火；也可以毁掉它，看着寒夜吞没城镇。可他一路见过的名字，不该只剩这两种去处。他把自己的力量接入正在断裂的回路，试着让火越过王座，抵达每一家。第一缕火离开时，他的手指也透出了光。",
    "quote": "他明白了：要让力量留下，他就不能再把自己留在其中。",
    "art": "final-open"
  },
  {
    "kicker": "A NAME TO KEEP",
    "title": "这一次，有人会记得他。",
    "body": "门外，弥娅的声音沿着灯路传来：「烬，回来吧。我们还可以再想办法。」他回头望了很久。那是他真正想去的人间。他想起不记得女儿面容的老妇人，想起桥上的三个人，也想起那个被他从灰潮里拉回来的陌生人。让他们活下去，不该再以失去谁的名字为代价。",
    "quote": "烬：「把我的名字写下来吧。以后不用拿它换火了。」",
    "art": "final-transfer"
  },
  {
    "kicker": "ENDING III / A THOUSAND EMBERS",
    "title": "长夜尽处，万家微火。",
    "body": "烬献祭自身，将找回的力量与王的权柄一同分散。没有新的王冠落下。火穿过他的身体，落入温室、粮仓、夜航的船，也落入一双双伸出的手。灰潮退去时，他最后看见的，是远处一户人家把灯放到了窗前。",
    "quote": "这一回，太阳没有升起。人间亮了。",
    "art": "final-embers"
  },
  {
    "kicker": "THE MORTAL DAWN",
    "title": "后来，人们学会照料自己的火。",
    "body": "最初的冬天依然艰难。有人种坏了一棚麦子，邻村就分来种子；有人没学会守炉，隔壁便来帮忙。力量留在万家，不再由谁赐予，也不再靠献出记忆维持。多年后，孩子在名册上读到烬，问弥娅那是谁。她把书摊在有光的地方。",
    "quote": "弥娅：「一个终于找到回家路的人。他把路留给了我们。」",
    "art": "final-embers"
  }
],
};
// Preserve the four published creator keys when inserting new scenes before them.
FINAL_ENDINGS.embers.forEach((page,i)=>{page.editSlot=['king-fall','king-memory',0,1,'choice','farewell',2,3][i];});
export const FINALE_STORY={
  opening:[
    {kicker:'ACT V / THE MORTAL DAWN',title:'长路尽头，仍是那扇门。',body:'六道封锁已经解除。烬带着太阳神之心，沿着人们留下的灯路，重新来到无名之门。',quote:'几千年前，他曾在这里关门。',art:'final-gate'},
    {kicker:'THE LAST CHOICE',title:'没有一条路，可以免去代价。',body:'开门能够归还记忆，送葬七神。神权如何处置，却决定人间能否度过接下来的寒夜。王仍在门前。他把仅存的供给护在身后，不肯让路。烬已经见过断供会夺走什么，也见过旧契怎样夺走一个人的一生。',quote:'这一次，选择交到你的手里。',art:'final-gate'},
  ],
  ending:FINAL_ENDINGS.embers,
  throne:FINAL_ENDINGS.throne,night:FINAL_ENDINGS.night,embers:FINAL_ENDINGS.embers,
};
export function finalSceneShapes(kind,person){
  const gate=`<path d="M360 590V160Q600 15 840 160V590" fill="#16262c" stroke="#a9ad97" stroke-width="18"/><path d="M405 590V185Q600 75 795 185V590" fill="${kind==='final-gate'||kind==='final-throne'?'#08141c':'#d7dab0'}"/><path d="M600 170V590" stroke="#d8bc84" stroke-width="4"/>`;
  const jin=person(525,600,'#844c43','traveler',1),king=person(855,600,'#c99a52','king',1.1);
  let art=`<path d="M0 594H1200V700H0Z" fill="#182b31"/>${gate}`;
  if(kind==='final-embers'){
    art=`<path d="M0 540Q600 330 1200 520V700H0Z" fill="#1c3339"/>`;
    for(let i=0;i<9;i++){const x=80+i*128,y=420+(i%3)*52;art+=`<path d="M${x-35} ${y}l35-30 35 30v70h-70Z" fill="#283d41" stroke="#9da690" stroke-width="2"/><rect x="${x-12}" y="${y+14}" width="24" height="30" fill="#e7c88f"/><path d="M600 155Q${x} 200 ${x} ${y+20}" fill="none" stroke="#efc986" stroke-width="2" opacity=".5"/>`;}
    art+=`<circle cx="600" cy="155" r="75" fill="url(#sceneFire)"/>`;
  }else if(kind==='final-night')art=`<path d="M0 550Q600 450 1200 570V700H0Z" fill="#1c2d38"/>`+Array.from({length:6},(_,i)=>person(220+i*126,590,'#65767b','townsfolk',.7)+`<circle cx="${238+i*126}" cy="512" r="13" fill="#deba7b"/>`).join('');
  else if(kind==='final-throne')art+=king+`<circle cx="600" cy="265" r="152" fill="url(#sceneFire)"/>`+jin;
  else art+=jin+king+(kind==='final-transfer'?`<path d="M855 430Q690 340 525 470" fill="none" stroke="#efd89c" stroke-width="12"/><circle cx="680" cy="412" r="85" fill="url(#sceneFire)"/>`:'');
  return art;
}

import { ACT_ONE_ENTRIES, ACT_ONE_QUESTS, ACT_ONE_RINGS } from './narrative-act1.js';
import { LANTERN_ENTRIES, LANTERN_RINGS } from './narrative-lantern.js';
import { COVENANT_ENTRIES, COVENANT_RINGS } from './narrative-covenant.js';
import { FATE_ENTRIES, FATE_RINGS } from './narrative-fate.js';
import { DAWN_ENTRIES, DAWN_RINGS } from './narrative-dawn.js';
import { FINALE_ENTRIES } from './narrative-finale.js';

export const JOURNAL_KEY='requiem.journal.v2';
// 必要剧情按路线解锁，技巧收集只补人物细节，永不锁住主线解释。
// 第一幕条目按关卡旗标/物品事件解锁（见 narrative-act1.js），不依赖绝对距离，
// 因为不同关卡的长度与速度都不同，写死距离会让文案和关卡绑死。
export const MEMORY_ENTRIES=[
  {
    "id": "p0",
    "at": 0,
    "title": "同路的约定",
    "speaker": "弥娅",
    "line": "这颗心能开门。你的名字，或许就在门后。",
    "body": "弥娅把太阳神之心交给我，说它是无名之门的核心钥匙。门后存着诸神夺走的记忆，她要去把它们归还，让回路里受困的六神真正死去。我不知道她能不能做到。我想知道的，是自己从前叫什么。",
    "question": "我的名字也被收走了吗？"
  },
  {
    "id": "p1",
    "at": 800,
    "title": "空白的名碑",
    "speaker": "烬",
    "line": "碑还在。名字呢？",
    "body": "我擦掉碑上的灰，下面仍是一片空白。身后的街口也少了一截，刚经过的门已找不到了。弥娅让我别站太久。我问这里埋着谁，她没有答出来。",
    "question": "石头还在，人却能从记忆里消失？"
  },
  {
    "id": "p2",
    "at": 4400,
    "title": "抄名人的方法",
    "speaker": "弥娅",
    "line": "念名字的时候，也想想那个人。",
    "body": "弥娅把铜片放到我手里，念了一个名字，又说起那人的住处和手艺。模糊的刻痕清楚了一点。她说铜片只能帮人记起；没有人记得的地方，最终也留不住。",
    "question": "如果还活着的人互相记住，能留下些什么？"
  },
  {
    "id": "p3",
    "at": 7200,
    "title": "胸腔里的钟声",
    "speaker": "弥娅",
    "line": "神已经死了。这些回路，还没停。",
    "body": "我把手贴近神骸，听见铜管里一下一下的震动。弥娅读过神殿的征收簿，说这就是祈祷回路。神不会回答了，记忆却仍被送进去。她沿着这些管路，查到了无名之门。",
    "question": "没有人在听，他们为什么还得献？"
  },
  {
    "id": "p4",
    "at": 10300,
    "title": "没有回音的圣所",
    "speaker": "旧祭文",
    "line": "“献出一个名字，换你所爱之人的下一个清晨。”",
    "body": "神像前放着空碗，碗底还刻着一个孩子的名字。祭文说，献出记忆可以换来亲人的清晨。我停下来听了一会儿。除了远处的钟声，没有别的回答。",
    "question": "献过记忆的人，真的等到了那个清晨吗？"
  },
  {
    "id": "p5",
    "at": 13600,
    "title": "掌心里的哭声",
    "speaker": "烬",
    "line": "别哭。……你听得见我吗？",
    "body": "哭声从我的掌心传出来，像有人忍着不肯出声。我问他是谁，他没有回答。弥娅也听见了。我把火托近一些，那声音又退回深处。",
    "question": "太阳神的心里，怎么会有孩子的声音？"
  },
  {
    "id": "p6",
    "at": 26000,
    "title": "七锁的门，只开了一线",
    "speaker": "弥娅",
    "line": "太阳那一道断了。其余六道，还连着祭道。",
    "body": "门前有七处锁痕。刻着太阳的一处已经断裂；弥娅沿其余六处摸过去，念出道路、风、潮汐、丰收、命运、安眠。心里的火靠近门缝便亮了一些，可门没有动。得先去解锁，钥匙才能用。",
    "question": "道路锁在河边。那条路还走得通吗？"
  },
  {
    "id": "p7",
    "at": 22300,
    "title": "七夜的追索令",
    "speaker": "追索令的残页",
    "line": "粮和燃料只够七夜。王命追索军追回太阳神之心。",
    "body": "桥边夹着一页军令：粮与燃料只够七夜，追索军须取回太阳神之心。弥娅说执炬王要重燃太阳。要把心交给他的人，也许确实在等天亮。可这颗心还在哭，王会把它拿去做什么？",
    "question": "重燃太阳以后，还要收人的记忆吗？"
  },
  {
    "id": "p8",
    "at": null,
    "title": "孩子的请求",
    "speaker": "余火中的声音",
    "line": "别让他们……再成为神。",
    "body": "我从门边的裂缝听见孩子说：“别让他们再成为神。”我还不知道他指谁。弥娅说道路锁在河边，韩蕙、常晚和岑渡还留在那条路上。先找到他们，再去桥头。",
    "question": "孩子到底经历过什么？"
  },
  {
    "id": "r0",
    "ring": "ring-0",
    "title": "一只手的温度",
    "speaker": "铜片上的字",
    "line": "“若你忘了回家的路，就记得有人等你。”",
    "body": "风里传来一句回家的话。我想跟着它再往前听，后面的声音却断了。掌心的火暖了一点。我想不起，有没有谁也这样等过我。"
  },
  {
    "id": "r1",
    "ring": "ring-1",
    "title": "没有神像的祈祷",
    "speaker": "无名人的记忆",
    "line": "“我求的不是永生，只是她明天还能醒来。”",
    "body": "我听见一个人求神，让病中的亲人再醒来一次。他没有求别的。圣所空了，那句话却还在。"
  },
  {
    "id": "r2",
    "ring": "ring-2",
    "title": "裂纹中的笔迹",
    "speaker": "烬",
    "line": "这道封印的刻法……我似乎见过。",
    "body": "指尖滑到裂纹的一半，还没看清下一处转折，手已经停在那里。我收回手，重走了一遍。还是一样。我不记得自己学过这种刻法。"
  }
];
export const QUESTS=[
  {
    "at": 0,
    "label": "与弥娅携心离开灰城",
    "detail": "沿旧城北路去无名之门，寻找烬的本名。"
  },
  {
    "at": 9200,
    "label": "穿过无声圣所",
    "detail": "沿神骸的祈祷回路向北走。"
  },
  {
    "at": 18400,
    "label": "抵达无名之门遗址",
    "detail": "门还未打开；去看看它被什么锁住。"
  }
];

// --------------------------------------------------------------------------- //
// 第一幕接入：条目按事件解锁，任务按关卡切换。
// 事件解锁比绝对距离可靠——关卡长度和速度会随设计调整，
// 把文案写死在坐标上，改一次关卡就要重排一次文案。
// --------------------------------------------------------------------------- //
export const ALL_ENTRIES=[...MEMORY_ENTRIES,...ACT_ONE_ENTRIES,...ACT_ONE_RINGS,...LANTERN_ENTRIES,...LANTERN_RINGS,...COVENANT_ENTRIES,...COVENANT_RINGS,...FATE_ENTRIES,...FATE_RINGS,...DAWN_ENTRIES,...DAWN_RINGS,...FINALE_ENTRIES];
/** 事件名 → 手记条目。关卡的 flag.event / item.event 查这张表。 */
export const ENTRY_BY_EVENT=new Map(
  [...ACT_ONE_ENTRIES,...LANTERN_ENTRIES,...COVENANT_ENTRIES,...FATE_ENTRIES,...DAWN_ENTRIES,...FINALE_ENTRIES].filter(e=>e.flag).map(e=>[e.flag,e]),
);
export const ENTRY_BY_RING=new Map([
  ...MEMORY_ENTRIES.filter(e=>e.ring).map(e=>[e.ring,e]),
  ...ACT_ONE_RINGS.map(e=>[e.ring,e]),
  ...LANTERN_RINGS.map(e=>[e.ring,e]),
  ...COVENANT_RINGS.map(e=>[e.ring,e]),
  ...FATE_RINGS.map(e=>[e.ring,e]),
  ...DAWN_RINGS.map(e=>[e.ring,e]),
]);
export { ACT_ONE_ENTRIES, ACT_ONE_QUESTS, ACT_ONE_RINGS };

export class Narrative {
  constructor(storage=null){this.storage=storage;this.unlocked=new Set();this.queue=[];this.session=new Set();
    try{const data=JSON.parse(storage?.getItem(JOURNAL_KEY)||storage?.getItem('requiem.journal.v1')||'null');
      if([1,2].includes(data?.version)&&Array.isArray(data.ids))for(const id of data.ids){
        // 旧版第一幕 a12 的意思是「桥还没开」。不能迁移成新版「桥已稳定」。
        const entries=data.version===1?MEMORY_ENTRIES:ALL_ENTRIES;
        if(entries.some(e=>e.id===id))this.unlocked.add(id);
      }
    }catch{}
  }
  resetRun(){this.queue=[];this.session.clear();}
  unlock(id,notify=true){const entry=ALL_ENTRIES.find(e=>e.id===id);if(!entry||this.session.has(id))return false;this.session.add(id);this.unlocked.add(id);if(notify)this.queue.push(entry);
    try{this.storage?.setItem(JOURNAL_KEY,JSON.stringify({version:2,ids:[...this.unlocked]}));}catch{}
    return true;
  }
  advance(distance,levelId='prologue'){if(levelId!=='prologue')return;for(const entry of MEMORY_ENTRIES)if(Number.isFinite(entry.at)&&distance>=entry.at)this.unlock(entry.id);}
  /** 关卡事件解锁：旗标与主线物品共用一张表。 */
  event(name){const entry=ENTRY_BY_EVENT.get(name);return entry?this.unlock(entry.id):false;}
  ring(id){const entry=ENTRY_BY_RING.get(id);return entry?this.unlock(entry.id):false;}
  next(){return this.queue.shift()||null;}
  // quests 允许显式传 null（表示该关卡没有自己的任务表），此时回落到通用任务。
  // 用 ?? 而不是默认参数：默认参数只在 undefined 时生效，null 会照样穿透。
  quest(distance,quests){const list=quests?.length?quests:QUESTS;return list.reduce((q,next)=>distance>=next.at?next:q,list[0]);}
  get count(){return this.unlocked.size;}
}

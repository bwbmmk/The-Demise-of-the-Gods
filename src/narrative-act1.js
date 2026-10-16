import { LANTERN_ENCOUNTERS } from './narrative-lantern.js';
import { COVENANT_ENCOUNTERS } from './narrative-covenant.js';
import { FATE_ENCOUNTERS } from './narrative-fate.js';
import { DAWN_ENCOUNTERS } from './narrative-dawn.js';
// 第一幕先交代撤离目的，再通过可见变化揭示记名规则。
// 道路神锁与孩子身份在第一幕幕末揭示；北岸图文幕间获得真名。
export const ACT_ONE_ENTRIES=[
  {
    "id": "a0",
    "flag": "quarter-enter",
    "title": "去旧屋接人",
    "speaker": "弥娅",
    "line": "韩蕙还在旧屋。先去接她，再到河边找锁。",
    "body": "弥娅认得这一带的住户。道路锁在河边，韩蕙还在旧屋收药，常晚守着钟楼，岑渡没离开渡口。我们也要走那座桥，顺路接他们出去。",
    "question": ""
  },
  {
    "id": "a1",
    "flag": "quarter-healer",
    "title": "还没收好的药柜",
    "speaker": "烬",
    "line": "药还温着，她应该没走远。",
    "body": "药柜的标签只剩白纸，门前有一只刚洗过的药碗。弥娅叫韩蕙的名字，屋里有人应了。这里还没空。",
    "question": ""
  },
  {
    "id": "a3",
    "flag": "plate-healer",
    "title": "韩蕙 · 医者",
    "speaker": "韩蕙",
    "line": "岑渡家那孩子去年烧了一夜，是我看的。",
    "body": "韩蕙把名字牌交给我。她说神殿今年又来收过记忆，有个病人认不出天天送药的女儿。她记着那些没停的账，药箱却已装不下多少东西。她收好药就来，让我先去找常晚。",
    "question": ""
  },
  {
    "id": "a5",
    "flag": "quarter-bell",
    "title": "刚修好的钟绳",
    "speaker": "烬",
    "line": "绳子刚换过，楼上还有人。",
    "body": "报时册上的字淡了，钟绳却刚换过。栏杆挂着一条绷带。我听见楼上有人数钟，跟着那声音往上走。",
    "question": ""
  },
  {
    "id": "a7",
    "flag": "plate-bell",
    "title": "常晚 · 报时人",
    "speaker": "常晚",
    "line": "听见三声钟，岑渡就知道还有人没上船。",
    "body": "常晚说起等船和韩蕙替她包手的事，我手里“韩蕙”二字忽然能看清了。她没察觉，还在抱怨当年包得太紧。第二枚铜片背面接着半句歌：“莫问天明。”",
    "question": "说起共同经历，为什么连褪去的字也会恢复？"
  },
  {
    "id": "a9",
    "flag": "quarter-ferry",
    "title": "搁浅的渡船",
    "speaker": "烬",
    "line": "船底裂了。只能走桥。",
    "body": "岑渡把裂开的船底翻给我看。断木撞穿了底板，补上还得几天。他指着石桥：现在只能从那里过，可桥中间已少了一段。",
    "question": ""
  },
  {
    "id": "a11",
    "flag": "plate-ferry",
    "title": "岑渡 · 摆渡人",
    "speaker": "岑渡",
    "line": "她来我家看过病……可她的脸，我快记不清了。",
    "body": "岑渡认得铜片上的字，却迟迟没认出韩蕙。他记得有人来给女儿退烧，只想不起那张脸。韩蕙就在他面前。他看了很久，仍摇头。",
    "question": "常晚说起包扎时，铜片上的字曾恢复；在桥前能否再试一次？"
  },
  {
    "id": "a12",
    "flag": "bridge-restored",
    "title": "桥接上了",
    "speaker": "烬",
    "line": "石板回来了。沿着这边走，我先过去。",
    "body": "我把牌子摆在桥头，缺口没有变化。韩蕙说起岑渡女儿非要洗药碗，岑渡笑了一下，想起来了。脚下第一段石板也回来了。接着是三声钟、船上那次包扎。他们叫出彼此的名字，桥面一段段接到对岸。",
    "question": "被记住的，不止是一个名字。"
  },
  {
    "id": "a15",
    "flag": "road-lock-open",
    "title": "第一道神锁 · 道路",
    "speaker": "弥娅",
    "line": "这道断了。还剩五道。",
    "body": "军官退开后，我把心送到桥端。火沿锁上的旧刻纹走了一圈，铜环裂了。弥娅读出“道路”二字，说六道中已经解开一道。三人在桥上喊彼此的名字，石板没有再消失。",
    "question": "余下的锁为什么还连着各地神殿？"
  },
  {
    "id": "a13",
    "flag": "district-bridge-complete",
    "title": "太阳曾是个孩子",
    "speaker": "余火中的声音",
    "line": "他们说，天亮我就能回家。",
    "body": "锁断时，我在火里看见一个孩子，和一个许诺天亮就让他回家的人。后来又有人求他等收成、等冬天、等战争过去。同一张脸渐渐长大，被戴上太阳冠。掌心的孩子说：“他们后来叫我太阳神。”他还记得最初只答应守一夜。",
    "question": "如果连他都没能离开，原来的约定去了哪里？"
  },
  {
    "id": "a14",
    "flag": "quarter-warden",
    "title": "我没有交出神心",
    "speaker": "烬",
    "line": "先把这些账弄明白。心，我现在不能交。",
    "body": "军官说王要用神心重燃太阳，城里只剩七夜粮煤。我问太阳点起后，韩蕙的病人还要不要缴记忆。他答不出来，只让我服从军令。门后有被收走的记忆，也可能有我的名字。在亲眼看清以前，我不愿把唯一能开门的钥匙交出去。",
    "question": "王的办法，能停下这些征收吗？"
  }
];
/** 战前剧情：在桥心遇到追索军官时插入，先讲清双方是谁、要什么。 */
export const BRIDGE_WARDEN_SCENE={
  "id": "warden",
  "place": "记名桥 · 桥心",
  "person": "追索军官",
  "role": "执炬王麾下 · 追索军团",
  "kind": "warden",
  "entry": "a14",
  "pages": [
    {
      "speaker": "追索军官",
      "text": "奉执炬王的命令，交还太阳神之心。我放他们三个过桥。",
      "aside": "军官立在桥中。弥娅退到道路锁旁，韩蕙把药箱放在三人脚边。"
    },
    {
      "speaker": "烬",
      "text": "王要拿它点太阳？点起以后，街上还要收记忆吗？韩蕙的病人，已经认不出自己的女儿了。",
      "aside": "军官没有看药箱，只看着烬手里的火。"
    },
    {
      "speaker": "追索军官",
      "text": "粮和煤只够七夜。王说，这颗心能让太阳再升起来。别的事，到王庭再问。",
      "aside": "常晚提起街上的神殿遗民。军官摇头：“他们守神殿的规矩，我奉的是王命。”"
    },
    {
      "speaker": "烬",
      "text": "这些账没停，连名字都快收空了。门后到底锁了什么，我得亲眼看看。没查清之前，心不能给你。",
      "aside": "烬把神心拢进掌心。门后或许也有他的名字，他还不愿放弃那条路。"
    },
    {
      "speaker": "追索军官",
      "text": "那就按军令办。",
      "aside": "剑锋亮起。常晚握住手钟：“盾亮了，我来敲开。”岑渡拉紧缆绳：“我送回火印，你跳起来接。”韩蕙提起灯：“能替你挡一次。”"
    }
  ]
};
export const ACT_ONE_QUESTS=[
  {
    "at": 0,
    "label": "去旧屋接医者韩蕙",
    "detail": "弥娅带路；道路神锁在河边，三人也要走那里撤离。"
  },
  {
    "at": 13000,
    "label": "接常晚下钟楼，一起去渡口",
    "detail": "韩蕙收好药箱后会跟上。"
  },
  {
    "at": 26000,
    "label": "找到岑渡，查看渡船",
    "detail": "三人到齐后一起撤离。"
  },
  {
    "at": 39000,
    "label": "到桥头，帮三人记起往事",
    "detail": "说起共同经历时，褪去的字曾恢复。"
  }
];
export const ACT_ONE_RINGS=[
  {
    "id": "q0",
    "ring": "ring-quarter-0",
    "title": "药方之外",
    "speaker": "街坊的回声",
    "line": "她总把最苦的那味药，放在最后。",
    "body": "韩蕙给我看过两张同样的方子。大人的那张没改，孩子的那张把苦药往后挪了。她记得谁怕苦。"
  },
  {
    "id": "q1",
    "ring": "ring-quarter-1",
    "title": "钟楼上的晚饭",
    "speaker": "常晚的回声",
    "line": "冷了就冷了。总有人比我更晚回家。",
    "body": "钟楼上有只旧饭盒。常晚说，渡口最后一盏灯亮了，她才知道人都到家。饭往往已经冷了。"
  },
  {
    "id": "q2",
    "ring": "ring-quarter-2",
    "title": "船舷上的刻度",
    "speaker": "岑渡的回声",
    "line": "这一道是她长高的。这一道，也是。",
    "body": "我沿船舷摸过几道刻痕。岑渡的手停在最高那一道，说女儿长到这里时已经不肯让他抱了。"
  }
];
export const DISTRICT_ENCOUNTERS={
  "quarter-warden": BRIDGE_WARDEN_SCENE,
  "plate-healer": {
    "id": "healer",
    "place": "医者旧屋",
    "person": "韩蕙",
    "role": "医者",
    "kind": "healer",
    "entry": "a3",
    "pages": [
      {
        "speaker": "韩蕙",
        "text": "弥娅，你还记得路。我叫韩蕙，这块牌子是你上回刻的。",
        "aside": "她把铜片交给烬，背面还留着半句旧歌：灯归掌心。"
      },
      {
        "speaker": "韩蕙",
        "text": "神殿又来收过一回。有个病人连送药的女儿都认不出了，欠单上的字倒还清清楚楚。",
        "aside": "烬翻过她留下的征收单。去年的手印下面，又添了一栏。"
      },
      {
        "speaker": "烬",
        "text": "神不是已经死了吗？",
        "aside": "韩蕙扣上药箱：“死了，账没停。先去钟楼接常晚吧，再到渡口找岑渡。我收好药就来。”弥娅认出桥的方向，先去查看道路锁。"
      }
    ]
  },
  "plate-bell": {
    "id": "bell",
    "place": "报时钟楼",
    "person": "常晚",
    "role": "报时人",
    "kind": "bell",
    "entry": "a7",
    "pages": [
      {
        "speaker": "常晚",
        "text": "韩蕙还没走？上次涨水，我怕岑渡漏下她，就敲了三声钟。那是我们说好的，听见就得等。",
        "aside": "她把铜片递过来，背面接着另一句：莫问天明。"
      },
      {
        "speaker": "常晚",
        "text": "那回拉绳子把手磨破了，还是她给我包的。包得太紧，我连筷子都拿不住。走吧，我带你去渡口。",
        "aside": "说到韩蕙的名字时，烬手里第一枚铜片亮了一下。原本模糊的两个字又能看清了。"
      }
    ]
  },
  "plate-ferry": {
    "id": "ferry",
    "place": "临河渡口",
    "person": "岑渡",
    "role": "摆渡人",
    "kind": "ferry",
    "entry": "a11",
    "pages": [
      {
        "speaker": "岑渡",
        "text": "别上船，底下让断木撞穿了。我的牌子给你。要过河，只能试试那座石桥。",
        "aside": "韩蕙提着药箱赶到，常晚伸手接过。三个人终于到齐了。"
      },
      {
        "speaker": "岑渡",
        "text": "你是……韩蕙？我记得有人来给孩子看病，可那张脸怎么也想不起来了。",
        "aside": "烬把铜片翻给他看，他还是摇头。常晚刚才说起包扎，字迹就恢复了；烬打算到桥头让他们再聊聊那时的事。"
      }
    ]
  },
  "quarter-bridge": {
    "id": "bridge",
    "place": "记名桥",
    "person": "三位同行者",
    "role": "一起过河",
    "kind": "bridge",
    "entry": "a12",
    "pages": [
      {
        "speaker": "弥娅",
        "text": "常晚说起包扎时，字就清楚了。韩蕙，你再说说岑渡女儿生病那晚。",
        "aside": "她把三枚铜片放到桥头。岑渡看着牌子，仍认不出身边的医者。"
      },
      {
        "speaker": "韩蕙",
        "text": "记得。退烧了还不肯睡，非要洗药碗。你怕她摔着，就蹲在旁边替她端着。",
        "aside": "岑渡抬起头：“是了，她把水泼了我一身。”脚边的第一段石板重新出现。"
      },
      {
        "speaker": "岑渡",
        "text": "常晚，上次那三声钟我听见了。我又等了一会儿，你提着饭盒跑来，说还有韩蕙，不能开船。",
        "aside": "常晚笑了一下：“饭都凉透了。”第二段桥面接上，三人往前挪了几步。"
      },
      {
        "speaker": "常晚",
        "text": "韩蕙，后来你就在船上给我包的手。我说太紧，你还拆了重新包。你看，疤还在这儿。",
        "aside": "她摊开手掌。韩蕙握住她的手，叫出了她的名字。最后几块石板从灰里显出来，通到了对岸。"
      },
      {
        "speaker": "烬",
        "text": "接上了。我先过，你们跟紧。岑渡，帮她拿一下药箱。",
        "aside": "烬踏上石板，脚下没有下沉。三人还在说刚才那晚的事，仿佛街上的账单暂时远了一点。"
      }
    ]
  }
};
// 不持有 Runner：暂停和快进只影响当前页，数值归模拟层。
export class Encounter {
  constructor(){this.active=null;this.page=0;this.seen=new Set();}
  reset(){this.active=null;this.page=0;this.seen.clear();}
  begin(event){const scene=DISTRICT_ENCOUNTERS[event]||LANTERN_ENCOUNTERS[event]||COVENANT_ENCOUNTERS[event]||FATE_ENCOUNTERS[event]||DAWN_ENCOUNTERS[event];if(!scene||this.seen.has(scene.id))return false;this.active=scene;this.page=0;return true;}
  next(){if(!this.active)return null;if(this.page<this.active.pages.length-1){this.page++;return null;}return this.finish();}
  finish(){if(!this.active)return null;const scene=this.active;this.seen.add(scene.id);this.active=null;return scene;}
  get current(){return this.active?.pages[this.page]||null;}
}

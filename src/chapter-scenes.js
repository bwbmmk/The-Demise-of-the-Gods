import { STORY_PANELS, storyArt } from './story.js';
import { FATE_STORY, fateSceneShapes } from './story-fate.js';
import { DAWN_STORY, dawnSceneShapes } from './story-dawn.js';
import { FINALE_STORY, finalSceneShapes } from './story-finale.js';
import { endingIllustration } from './ending-media.js';

// 每个已发布章节都要有 opening / ending。世界真相只在对应进度显示。
export const CHAPTER_STORIES={
  finale:FINALE_STORY,
  fate:FATE_STORY,
  dawn:DAWN_STORY,
  "prologue": {
    "opening": STORY_PANELS,
    "ending": [
      {
        "kicker": "PROLOGUE / SEVEN GODLOCKS",
        "title": "六道神锁，\n封住长夜。",
        "body": "烬把神心送近门缝，火亮了一些，门却没有动。\n弥娅读过锁痕：太阳锁已断，其余六道仍完整，连着门后的祭道。侧边那条裂缝刚够人通过。",
        "quote": "弥娅：「先去解锁。第一道在河边。」",
        "art": "godlocks"
      },
      {
        "kicker": "NEXT / THE NAMELESS QUARTER",
        "title": "余火深处，\n还有人未归。",
        "body": "烬俯身再听，那声音近得像就在掌心，却没有回答自己的名字。\n弥娅在河边见过三个还没撤离的人。他们挡在灰潮前，也在去道路锁的那条路上。",
        "quote": "余火中的声音：「别让他们……再成为神。」",
        "art": "plates"
      }
    ]
  },
  "district": {
    "opening": [
      {
        "kicker": "ACT I / THE NAMELESS QUARTER",
        "title": "失名之地，\n灯火未绝。",
        "body": "烬随弥娅穿过裂缝。旧地图上找不到国名，街边的窗里却仍有人影。\n弥娅停在一块空白门牌前，叫了一声韩蕙。屋里应了。",
        "quote": "弥娅：「是这里。先接她去河边。」",
        "art": "street"
      },
      {
        "kicker": "THREE NAMES / THREE LIVES",
        "title": "三枚名字，\n一条归路。",
        "body": "韩蕙收药，常晚守钟，岑渡留在渡口。烬跟着弥娅读过三枚名字牌，把路线记住。\n接上韩蕙后，弥娅先去桥头查看道路锁；烬继续到钟楼和渡口接人。",
        "quote": "烬：「把人接齐，我们一起过河。」",
        "art": "plates"
      },
      {
        "kicker": "THE ROAD LOCK",
        "title": "河吞旧岸，\n桥待故人。",
        "body": "从街尾能看见河面和断桥。渡口仍有船影，烬打算先去看看。\n道路锁就在北岸。要找回门后的记忆，先得让这几个人和自己都过河。",
        "quote": "弥娅：「铜片带好。见到岑渡，叫他等一等。」",
        "art": "bridge"
      }
    ],
    "ending": [
      {
        "kicker": "THE FIRST LOCK / ROAD",
        "title": "名字越过河流。",
        "body": "军官退到桥边。烬把神心送到道路锁前，火沿刻纹转了一圈，铜环裂开。\n弥娅数过剩下的锁，六道中已解一道。韩蕙、常晚和岑渡在对岸叫着彼此，桥没有再消失。",
        "quote": "弥娅：「还剩五道。火里……有声音。」",
        "art": "roadlock"
      },
      {
        "kicker": "ONE NIGHT / ONE PROMISE",
        "title": "天亮以后，\n他就能回家。",
        "body": "烬在火里看见一个孩子。有人替他写下约定：只守一夜，天亮就回来。\n后来，又有人求他等庄稼、等过冬。烬看着同一张脸渐渐长大，始终没走出火。",
        "quote": "孩子：「我母亲还在家里等。」",
        "art": "song"
      },
      {
        "kicker": "THE CHILD WAS THE SUN",
        "title": "火里的孩子，\n就是太阳神。",
        "body": "记忆中的人戴上太阳冠，掌心的孩子轻声说：“他们后来叫我太阳神。”\n烬这才认出那是同一张脸。孩子记得一夜的约定，也记得母亲。他怎么死去的，火里没有出现。",
        "quote": "余火：「她说，天亮就能回来。」",
        "art": "revelation"
      }
    ]
  },
  "covenant": {
    "opening": [
      {
        "kicker": "ACT II / THE MISSING CLAUSES",
        "title": "旧契蒙尘，\n新账未休。",
        "body": "北岸的灯有人接着照料，烬仍想找回自己的名字。可街上的欠单、岑渡想不起的脸，也一直在他心里。\n弥娅指向三域祭道：风、潮汐、丰收的旧契约都存放在那里。",
        "quote": "烬：「去看看。现在这些规矩，总得有个来处。」",
        "art": "windarchive"
      },
      {
        "kicker": "WIND / TIDES / HARVEST",
        "title": "风过海堤，\n种子待春。",
        "body": "旧地图画到粮仓背后的封门为止。那里的三条链，既连着神锁，也锁着领还记忆的通道。\n弥娅翻过地图，让烬看退潮时能走的石路。运粮栈道缺了木板，到了那里还得小心落脚。",
        "quote": "弥娅：「风坡旧祠有抄本。先去那里。」",
        "art": "threecontracts"
      }
    ],
    "ending": [
      {
        "kicker": "FOUR OF SIX / MEMORIES RETURN",
        "title": "她想起了\n女儿扎辫子的样子。",
        "body": "三锁已解，六道中累计解开四道。领还通道打开，弥娅按册请人领回祖先的部分记忆。\n老妇人也想起来一点，握着欠单说了很久。烬没有催她。照料者留下守种子，名字仍留在册上。",
        "quote": "烬：「至少这份账，别再收了。」",
        "art": "openexit"
      },
      {
        "kicker": "A MARK / AN UNKNOWN PAST",
        "title": "这道缺口，\n一寸不差。",
        "body": "断链扯下铁板，烬把剑贴进门上旧痕，每一处缺口都对上了。弥娅问他记不记得，烬答不上来。\n手却自己握紧了剑。照料者说封门记录在命运域；两人决定去查。还剩命运、安眠两锁。",
        "quote": "弥娅：「我们去找记录。你别把剑收起来。」",
        "art": "swordmark"
      }
    ]
  }
};
// 幕间只读剧情，不注册成模拟关卡。
export const INTERMISSION_PANELS=[
  {
    "kicker": "INTERMISSION / SEVEN NIGHTS",
    "title": "军令下面，\n还有一张配给表。",
    "body": "陆承带他们走进收容所。靠窗床上的孩子是他女儿，杯里的水结着冰。\n他摊开配给表，给烬指粮煤和人数：只够七夜。折回配给表以后，他又看了一眼床上的孩子。",
    "quote": "陆承：「我也想问王要拿什么去烧。可她先得过今晚。」",
    "art": "supplies"
  },
  {
    "kicker": "A SMALL FLAME",
    "title": "先烧一碗热水。",
    "body": "烬把空灯托近神心，问孩子能不能分一点火。岑渡拨开灯芯，韩蕙把药碗放上炉。\n火落进灯里，掌心仍亮着。常晚添了煤，等水慢慢热起来。",
    "quote": "烬：「只给这张床就好。你试试。」",
    "art": "littlefire"
  },
  {
    "kicker": "A SHIFT / MANY HANDS",
    "title": "灯亮着。\n门外还没有天亮。",
    "body": "孩子喝下半碗水。韩蕙留下守床，常晚列夜班，岑渡去修炭车。烬看着住户接过煤铲。\n陆承仍带军令回去。他会说这盏灯救了人，可一间暖屋还回答不了整座城的寒夜。",
    "quote": "常晚：「下一班谁接，写在这里。别又漏了。」",
    "art": "shelter"
  },
  {
    "kicker": "A NAME / BEFORE THE CROWN",
    "title": "阿昼。",
    "body": "弥娅问孩子，要把什么名字刻在灯架上。烬听见他讲母亲叫他回家吃饭，声音比桥上轻了些。\n铜片刻好后，孩子念了一遍。像很久没人再这样叫过他。",
    "quote": "余火：「她叫我阿昼。」",
    "art": "littlefire"
  },
  {
    "kicker": "NEXT / THREE DOMAINS",
    "title": "北面的祭道，\n风声没停。",
    "body": "夜班有人接了。弥娅收起名册，问烬还走不走。他把神心托稳，望向北面的祭道。\n门后或许能找回自己。可在那之前，他想查清神殿为何一直在收。",
    "quote": "烬：「走。先去看原契。」",
    "art": "windroad"
  }
];

function scenePerson(x,y,color,kind='traveler',scale=1){
  if(kind==='elder')return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-25-8L-31 0M10-8L15 0" stroke="#25343a" stroke-width="12"/><path d="M-40-4L-36-72Q-25-101 0-87L25-8Z" fill="#7d8374"/><path d="M-34-77Q-47-97-31-118Q-7-132 9-111L3-84Z" fill="#9a9d90"/><path d="M-30-110Q-12-121 1-106L-2-92L-21-93Z" fill="#c4b695"/><path d="M-30-68L-10-36L20-49" stroke="#7d8374" stroke-width="13" fill="none"/><rect x="-5" y="-56" width="27" height="36" fill="#c4b28a" transform="rotate(12)"/><path d="M1-46L14-44M-1-37L12-35" stroke="#77674f" stroke-width="2"/><path d="M-30-18Q-8-5 14-12" stroke="#a5aa94" stroke-width="3" fill="none"/></g>`;

  const hood=kind==='bell'?'M-22-118Q0-149 22-118L17-91H-18Z':'M-19-112Q0-137 20-112L17-91H-17Z';
  const tool=kind==='mia'?'<path d="M33-57L46-85L50 0" fill="none" stroke="#bcae85" stroke-width="5"/><path d="M-17-111H17" stroke="#e4d8b5" stroke-width="6"/><rect x="-35" y="-53" width="19" height="28" fill="#b59562"/>':kind==='ferry'?'<path d="M39-5L64-175" stroke="#9f9476" stroke-width="7"/>':kind==='healer'?'<path d="M17-63Q42-40 57-63" fill="#b7a47d" stroke="#d0be94" stroke-width="3"/>':'';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-16-12L-22 0M13-12L19 0" stroke="#14272d" stroke-width="14"/><path d="M-34-4L-26-85Q0-109 25-83L35-4Z" fill="${color}"/><path d="M-19-72L-39-25M22-73L40-49" stroke="${color}" stroke-width="13" stroke-linecap="round"/><path d="${hood}" fill="#3e5153"/><path d="M-12-111L14-111L11-97H-10Z" fill="#bba98a"/><path d="M-5-102L7-102" stroke="#293f43" stroke-width="2"/>${tool}<path d="M-11-77L-8-17" stroke="#d2b477" stroke-opacity=".22" stroke-width="3"/></g>`;
}

// 原生 SVG 插画：同一美术语言，开场/章末各有独立构图，离线无需素材。
export function chapterStoryArt(levelId,phase,index){
  if(levelId==='prologue'&&phase==='opening')return storyArt(index);
  const panel=levelId==='intermission'?INTERMISSION_PANELS[index]:CHAPTER_STORIES[levelId]?.[phase]?.[index];
  const kind=panel?.art||'street';let art='';
  if(levelId==='finale'){const illustration=endingIllustration(kind);if(illustration)return illustration;}
  const copper=(x,y,angle,text)=>`<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-65" y="-103" width="130" height="206" rx="5" fill="#998260" stroke="#dbc694" stroke-width="3"/><path d="M-49-79H49M-49 72H49" stroke="#503f2c" stroke-width="2"/><text y="-15" fill="#302b25" text-anchor="middle" font-family="serif" font-size="31">${text}</text><path d="M-30 26H30M-30 40H22" stroke="#5e4e37" stroke-width="3"/></g>`;
  const bridge=`<path d="M0 532Q240 506 410 525M800 525Q1000 506 1200 532" stroke="#667c76" stroke-width="29" fill="none"/><path d="M409 525H800" stroke="#9baf99" stroke-width="25" stroke-dasharray="52 16" opacity="${['together','roadlock'].includes(kind)?1:.3}"/><path d="M40 544V700M300 532V700M902 532V700M1140 544V700" stroke="#233b42" stroke-width="44"/><path d="M0 519Q280 485 405 510M805 510Q1000 485 1200 519" fill="none" stroke="#a2ac8c" stroke-width="4"/>`;
  if(levelId==='finale'){
    art=finalSceneShapes(kind,scenePerson);
  }else if(levelId==='fate'){
    art=fateSceneShapes(kind,scenePerson);
  }else if(levelId==='dawn'){
    art=dawnSceneShapes(kind,scenePerson);
  }else if(kind==='godlocks'){
    art=`<path d="M0 570H1200V700H0Z" fill="#172c35"/><path d="M738 565V220Q899 61 1060 220V565" fill="#253d44" stroke="#9dafa1" stroke-width="12"/><path d="M897 145V565" stroke="#efd89c" stroke-width="3"/>`;
    const domains=['白昼','道路','风','潮汐','丰收','命运','安眠'];
    domains.forEach((name,i)=>{const x=765+(i%2)*245,y=195+Math.floor(i/2)*91;art+=`<g transform="translate(${x} ${y})"><circle r="27" fill="#21343e" stroke="${i?'#b1baa1':'#887e6a'}" stroke-width="5" ${i?'':'stroke-dasharray="46 27"'}/><text y="6" font-size="15" font-family="serif" text-anchor="middle" fill="#ddcba0">${name}</text></g>`;});
    art+=`${scenePerson(401,570,'#80463f')}${scenePerson(555,570,'#526d68','mia')}<text x="915" y="633" text-anchor="middle" fill="#d5c194" font-size="24" font-family="serif">太阳锁已毁 · 六锁仍在</text>`;
  }else if(kind==='roadlock'){
    art=`<path d="M0 450Q490 357 1200 447V700H0Z" fill="#2a4148"/>${bridge}${scenePerson(926,522,'#66796b','healer',.59)}${scenePerson(991,522,'#5d6e80','bell',.59)}${scenePerson(1056,522,'#7f7358','ferry',.59)}${scenePerson(519,557,'#80463f')}${scenePerson(1140,566,'#526d68','mia',.8)}<path d="M743 559V276H867V559" fill="none" stroke="#99aa92" stroke-width="15"/><circle cx="805" cy="360" r="51" fill="none" stroke="#e7ce8b" stroke-width="7" stroke-dasharray="95 35"/><path d="M753 529L592 529L570 472M805 413V555" stroke="#efc679" stroke-width="5" fill="none"/><circle cx="805" cy="360" r="175" fill="url(#sceneFire)"/><text x="805" y="260" text-anchor="middle" fill="#e2cba0" font-size="26" font-family="serif">道路 · 第一锁已解</text><path d="M757 318l-13-25M853 402l22 18" stroke="#ebd9a4" stroke-width="4"/>`;
  }else if(['windarchive','threecontracts','openexit','swordmark'].includes(kind)){
    art=`<path d="M0 558H1200V700H0Z" fill="#142833"/><path d="M740 558V212Q900 83 1060 212V558" fill="#263c4b" stroke="#b2b9a1" stroke-width="12"/>`;
    if(kind==='windarchive'){
      for(let i=0;i<5;i++)art+=`<path d="M78 ${244+i*45}Q302 ${139+i*54} 599 ${256+i*36}" fill="none" stroke="#91c8c6" stroke-width="3" opacity=".5"/>`;
      art+=`${copper(890,355,0,'原契约')}${scenePerson(366,562,'#80463f')}${scenePerson(517,562,'#526d68','mia')}<path d="M238 417V328M229 350H247M229 370H247" stroke="#bbbd96" stroke-width="5"/>`;
    }else if(kind==='threecontracts')art+=`${copper(290,345,-9,'风')}${copper(600,345,0,'潮汐')}${copper(910,345,9,'丰收')}<path d="M254 510H946" stroke="#91c8c6" stroke-width="3"/><text x="600" y="573" text-anchor="middle" font-family="serif" font-size="23" fill="#d4c69e">旧契刻在铜上</text>`;
    else if(kind==='openexit'){
      art+=`<path d="M813 548V235Q900 151 987 235V548" fill="#a7c1b5" opacity=".6"/><circle cx="900" cy="363" r="206" fill="url(#sceneFire)"/>${scenePerson(310,560,'#80463f')}${scenePerson(471,560,'#526d68','mia')}${scenePerson(653,560,'#7d8374','elder',.96)}<rect x="494" y="415" width="93" height="58" fill="#c2ac83"/><text x="900" y="611" text-anchor="middle" fill="#d6c49b" font-size="26" font-family="serif">领还通道 · 四锁已解</text>`;
      for(let i=0;i<3;i++)art+=`<path d="M${735+i*135} 230l-28 32m4 12l20 27" stroke="#bfcab9" stroke-width="4"/>`;
    }else art+=`<path d="M476 145L594 427L573 446L455 166Z" fill="#c4cab1"/><path d="M559 393l20-8-6-13" fill="#263c4b"/><path d="M531 170L649 452M621 415l-13 9" stroke="#acb9a7" stroke-width="6"/><path d="M525 480H677M552 458l-20 96" stroke="#a9946e" stroke-width="10"/>${scenePerson(310,576,'#80463f')}${scenePerson(718,576,'#526d68','mia')}`;
  }else if(kind==='supplies'){
    art=`<path d="M0 486L280 414L710 448L1200 391V700H0Z" fill="#2b414a"/><path d="M0 554Q670 514 1200 556V700H0Z" fill="#142630"/><path d="M765 526V264L907 174L1080 264V526Z" fill="#344b50" stroke="#8b9a8e" stroke-width="3"/><path d="M851 526V344H985V526Z" fill="#162a32"/>${scenePerson(387,559,'#805046','traveler',1.1)}${scenePerson(683,550,'#586975','father',1.2)}<path d="M697 435L726 446L721 522L700 511Z" fill="#a35e53"/><g transform="translate(596 421) rotate(10)"><rect x="-50" y="-65" width="100" height="130" fill="#cab991"/><path d="M-34-38H34M-34-16H34M-34 6H25M-34 28H34" stroke="#796851" stroke-width="3"/><text y="55" text-anchor="middle" font-size="21" font-family="serif" fill="#584738">七 夜</text></g>`;
  }else if(kind==='littlefire'){
    art=`<circle cx="607" cy="331" r="235" fill="url(#sceneFire)"/><path d="M0 576Q560 474 1200 562V700H0Z" fill="#172b34"/>${scenePerson(320,573,'#805046','traveler',1.15)}<path d="M355 493Q455 453 549 458" stroke="#b9ae89" stroke-width="15" fill="none"/><path d="M541 474Q577 427 600 389Q608 439 644 473Z" fill="#e6b774"/><path d="M635 475Q697 411 773 452" fill="none" stroke="#e8c589" stroke-width="3"/><g transform="translate(819 492)"><path d="M-49 70V-48H49V70Z" fill="#243b40" stroke="#bcb083" stroke-width="5"/><path d="M-62-48L0-79L62-48" fill="none" stroke="#bcb083" stroke-width="6"/><path d="M0-78V-97" stroke="#bcb083" stroke-width="4"/><path d="M-28 58Q-37 12 0-22Q-9 13 22 25Q42 44 28 58Z" fill="#e7bd78"/><circle cy="18" r="110" fill="url(#sceneFire)"/></g>`;
  }else if(kind==='shelter'){
    art=`<path d="M140 602V199L600 98L1070 199V602Z" fill="#2c4347" stroke="#718578" stroke-width="6"/><path d="M220 205H984M600 103V599" stroke="#657b70" stroke-width="14"/><path d="M770 268H898V374H770Z" fill="#d2ad71" opacity=".65"/><circle cx="801" cy="380" r="220" fill="url(#sceneFire)"/><path d="M228 525H506V547H228Z" fill="#887d61"/><path d="M247 547V599M482 547V599" stroke="#887d61" stroke-width="8"/><path d="M236 518Q289 472 452 495L490 520Z" fill="#a9b49c"/>${scenePerson(548,589,'#66796b','healer',.85)}${scenePerson(711,589,'#5d6e80','bell',.86)}${scenePerson(955,589,'#7f7358','ferry',.87)}<path d="M630 497H825V514H630Z" fill="#7c7158"/><path d="M640 514V595M815 514V595" stroke="#7c7158" stroke-width="8"/>`;
  }else if(kind==='windroad'){
    art=`<path d="M0 391L227 301L454 392L741 262L1200 362V700H0Z" fill="#304b54"/><path d="M0 652Q572 532 843 290L1014 284Q760 594 314 700H0Z" fill="#536e6f"/><path d="M836 321V194L924 143L1010 194V321" fill="#1e3943" stroke="#889e94" stroke-width="7"/><path d="M705 266Q916 224 1051 247M605 298Q855 258 1115 284" fill="none" stroke="#b3c7b4" stroke-opacity=".35" stroke-width="3"/>${scenePerson(393,613,'#805046','traveler',1.05)}${scenePerson(535,572,'#526d68','mia',.94)}`;
  }else if(kind==='street'){
    for(let i=0;i<5;i++){const x=i*263-40,h=170+i%2*55;art+=`<path d="M${x} 540V${h+110}L${x+111} ${h+51}L${x+232} ${h+110}V540Z" fill="${i%2?'#25383b':'#304447'}" stroke="#71827c" stroke-opacity=".22"/><path d="M${x+85} 540V407H${x+144}V540" fill="#101e27"/><rect x="${x+50}" y="${h+137}" width="32" height="56" fill="#d8b775" opacity=".65"/><path d="M${x+90} 383H${x+139}" stroke="#96a18c" stroke-width="8"/>`;}
    art+=`<path d="M0 547Q510 502 1200 547V700H0Z" fill="#111f28"/>${scenePerson(516,573,'#80463f','traveler',1.1)}<circle cx="556" cy="507" r="70" fill="url(#sceneFire)"/>`;
  }else if(kind==='plates'){
    art=`<circle cx="601" cy="298" r="190" fill="none" stroke="#a7a77f" stroke-opacity=".2"/>${copper(364,331,-16,'韩蕙')}${copper(602,297,0,'常晚')}${copper(833,331,16,'岑渡')}<path d="M191 562Q600 527 1010 561" stroke="#708075" stroke-width="3"/><text x="600" y="600" text-anchor="middle" fill="#b9b18b" font-family="serif" font-size="18" letter-spacing="8">灯归掌心 · 莫问天明</text>`;
  }else if(kind==='bridge'||kind==='together'){
    art=`<path d="M0 402Q420 322 1200 416V700H0Z" fill="#2a4148"/><path d="M0 585Q520 500 1200 580V700H0Z" fill="#0e202d"/>${bridge}`;
    art+=kind==='together'?`${scenePerson(474,520,'#657467','healer',.8)}${scenePerson(583,520,'#5c6379','bell',.75)}${scenePerson(700,520,'#76644d','ferry',.85)}<path d="M449 528H746" stroke="#ebcd83" stroke-width="3"/><circle cx="600" cy="510" r="210" fill="url(#sceneFire)"/>`:`${scenePerson(245,517,'#80463f','traveler',.9)}${scenePerson(933,519,'#657467','healer',.64)}<path d="M484 518L491 468M573 521L580 492M684 522L691 479" stroke="#809997" opacity=".35" stroke-width="12"/>`;
  }else if(kind==='song'){
    art=`<path d="M169 562V258L519 99L869 258V562Z" fill="#314749" stroke="#85927c" stroke-width="6"/><path d="M496 561V362H655V561" fill="#102833"/><circle cx="585" cy="469" r="232" fill="url(#sceneFire)"/><path d="M546 530Q519 472 576 402Q570 460 616 484L607 530Z" fill="#edbb71"/>${scenePerson(782,564,'#837e68','traveler',1.12)}${scenePerson(442,566,'#ab7952','traveler',.61)}<path d="M758 442L679 466L640 465" stroke="#b5a782" stroke-width="14" fill="none"/><text x="521" y="209" text-anchor="middle" fill="#e4ce9f" font-family="serif" font-size="23">天亮以后，可以回家</text><path d="M171 590H890" stroke="#89957a" stroke-width="8"/>`;
  }else if(kind==='warden'){
    // 桥心：军官一人立在桥中，剑锋蓄光；烬与三人在左侧，右端是对岸。
    art=`<path d="M0 402Q420 322 1200 416V700H0Z" fill="#2a4148"/><path d="M0 585Q520 500 1200 580V700H0Z" fill="#0e202d"/>${bridge}`;
    // 蓄光的剑与脚下的预警弧——这是"读招"的教学，必须在章末画出来。
    art+=`<circle cx="905" cy="352" r="176" fill="url(#sceneFire)"/><path d="M905 452V352" stroke="#e7b47c" stroke-width="6"/><path d="M887 452h36" stroke="#9a7a52" stroke-width="10"/><path d="M879 520q26-16 52 0" fill="none" stroke="#e08a5f" stroke-width="4" stroke-opacity=".6"/>`;
    // 军官：比同行者更高，赤色披带是追索军的身份色。
    art+=`<g transform="translate(905 566)"><path d="M-30 0L-26-92H26L30 0Z" fill="#3b444d"/><path d="M14-88L28-80L10-34L-4-40Z" fill="#8a4640"/><path d="M-30-86L-8-101L12-97L6-82Z" fill="#555f66"/><path d="M-13-95V-124L0-138L13-123V-94Z" fill="#2f3a44"/><path d="M-9-116H9" stroke="#e0b781" stroke-width="3"/><path d="M22-56L36-14" stroke="#3d4750" stroke-width="7"/></g>`;
    art+=`${scenePerson(474,520,'#657467','healer',.8)}${scenePerson(583,520,'#5c6379','bell',.75)}${scenePerson(700,520,'#76644d','ferry',.85)}${scenePerson(300,521,'#80463f','traveler',.95)}`;
  }else if(kind==='revelation'){
    // 身份揭示：神心展开，里面那个"成神之前的自己"被光托起，
    // 三人与烬在下方仰视。构图刻意不出现神像——被揭穿的不是神的威严，是一个普通人。
    art=`<path d="M0 470L196 401L420 436L646 366L906 431L1200 381V700H0Z" fill="#2a4148"/><path d="M0 592Q501 462 1200 585V700H0Z" fill="#0e202d"/>`;
    art+=`<circle cx="600" cy="300" r="228" fill="url(#sceneFire)"/>`;
    // 神心：一颗被剖开的火核，往外散出记忆的碎片。
    art+=`<path d="M600 434Q521 392 539 296Q553 208 600 168Q647 208 661 296Q679 392 600 434Z" fill="#3f4f4a" stroke="#a9976b" stroke-width="4"/>`;
    art+=`<path d="M600 419Q545 384 559 305Q569 236 600 205Q631 236 641 305Q655 384 600 419Z" fill="#c98a49"/>`;
    art+=`<path d="M600 404Q562 376 574 311Q582 258 600 236Q618 258 626 311Q638 376 600 404Z" fill="#f4d18d"/>`;
    // 那个普通人：站在火核里，双手垂着，没有武器，也没有冠冕。
    art+=`<g transform="translate(600 372) scale(1.05)"><path d="M-13 0L-10-52H10L13 0Z" fill="#8d5b3c"/><path d="M-10-50L-2-66L4-64L8-50Z" fill="#c69a6d"/><path d="M0-62a9 9 0 1 0 0-18a9 9 0 1 0 0 18Z" fill="#d8b183"/></g>`;
    // 记忆碎片：从火核往外飘。
    for(let i=0;i<14;i++){const a=i/14*6.28,r=112+(i%4)*36;art+=`<rect x="${600+Math.cos(a)*r}" y="${300+Math.sin(a)*r*.82}" width="4" height="4" fill="#e6c691" opacity=".55"/>`;}
    art+=`${scenePerson(262,568,'#80463f','traveler',.95)}${scenePerson(403,568,'#526d68','mia',.84)}${scenePerson(760,566,'#657467','healer',.8)}${scenePerson(858,566,'#5c6379','bell',.72)}${scenePerson(948,566,'#76644d','ferry',.8)}`;
  }else if(kind==='torches'){
    art=`<path d="M0 442L185 379L409 412L635 335L895 408L1200 358V700H0Z" fill="#294049"/><path d="M0 567Q501 433 1200 560V700H0Z" fill="#111f2c"/>`;
    for(let i=0;i<8;i++){const x=627+i*63,y=468+Math.sin(i)*20;art+=`<path d="M${x} ${y}V${y-49}" stroke="#a7996a" stroke-width="3"/><circle cx="${x}" cy="${y-58}" r="5" fill="#c8a564"/><circle cx="${x}" cy="${y-58}" r="33" fill="url(#sceneFire)"/>`;}
    art+=scenePerson(302,568,'#80463f','traveler');
  }else{
    art=`<path d="M0 544H1200V700H0Z" fill="#11212a"/><path d="M771 555V275Q891 93 1011 275V555" fill="#182c33" stroke="#7e8571" stroke-width="15"/><path d="M891 178V554" stroke="#e7cb85" stroke-width="5"/><circle cx="891" cy="400" r="202" fill="url(#sceneFire)"/>${scenePerson(518,568,'#80463f','traveler')}`;
  }
  return `<svg viewBox="0 0 1200 700" role="img" aria-label="${panel?.title.replace('\n','')||'章节剧情'}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sceneSky" x2="0" y2="1"><stop stop-color="#101d2b"/><stop offset="1" stop-color="#536b6a"/></linearGradient><radialGradient id="sceneFire"><stop stop-color="#efc47c" stop-opacity=".25"/><stop offset="1" stop-color="#e2b477" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="700" fill="url(#sceneSky)"/><circle cx="932" cy="155" r="47" fill="#bcc5af" opacity=".3"/><circle cx="948" cy="140" r="45" fill="#263b46"/>${art}<path d="M24 85V24H90M1176 615V676H1110" stroke="#c4b280" stroke-opacity=".5" fill="none"/></svg>`;
}

export function encounterKind(scene,page){
  if(page.speaker==='弥娅')return 'mia';
  if(page.speaker==='烬')return 'jin';
  if(page.speaker==='老妇人')return 'elder';
  if(page.speaker==='太阳')return 'sun';
  if(page.speaker==='城中人')return 'villager';
  // 第四幕：王与守卫都要能一眼与同行者区分开。
  if(page.speaker==='执炬王')return 'king';
  if(scene.kind==='bridge')return {韩蕙:'healer',岑渡:'ferry',常晚:'bell'}[page.speaker]||'bridge';
  return scene.kind;
}

export function encounterPortrait(kind){
  if(kind==='sun')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="90" r="73" fill="none" stroke="#ccb97f" opacity=".6"/><path d="M26 229L37 123L90 108L143 123L156 229Z" fill="#9b9169"/><path d="M66 113L58 70L90 56L122 76L112 115Z" fill="#baa87c"/><path d="M61 77L47 29L70 43L86 10L105 43L131 28L119 77Z" fill="#baab79"/><path d="M70 87l13 4M97 91l13-5M83 105h15" stroke="#514f3b" stroke-width="3"/><path d="M90 132V229" stroke="#dfca8f" stroke-opacity=".6" stroke-width="3"/></svg>`;
  // visual-kit 概念图的兜帽和旧金轮廓，用本项目的暗红披风重绘为原生 SVG。
  if(kind==='jin')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="89" cy="106" r="70" fill="none" stroke="#bda773" opacity=".35"/><path d="M29 226L39 120L75 94L129 119L151 226Z" fill="#844d44"/><path d="M57 119L58 219H117L124 125L94 106Z" fill="#223b42"/><path d="M49 100L58 52L87 31L122 64L129 103L97 123Z" fill="#1e343c" stroke="#b49b69" stroke-width="3"/><path d="M66 72L88 56L110 77L100 103L77 100Z" fill="#5f7976"/><path d="M71 77L83 80M93 81L104 78" stroke="#213239" stroke-width="3"/><path d="M64 128L72 163M114 130L108 166" stroke="#b59c69" stroke-width="3"/><path d="M48 143L28 202M124 143L137 172" stroke="#844d44" stroke-width="14" stroke-linecap="round"/><path d="M133 175L155 164" stroke="#b8aa85" stroke-width="9"/><path d="M150 161Q136 141 153 125Q152 141 163 147Q171 159 157 165Z" fill="#e9c181"/><path d="M40 227H142" stroke="#b49b69" stroke-opacity=".45"/></svg>`;
  if(kind==='elder')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="103" r="70" fill="none" stroke="#a4b49e" opacity=".35"/>${scenePerson(98,232,'#7d8374','elder',1.54)}</svg>`;

  if(kind==='lamp')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="130" r="72" fill="#ddb675" opacity=".09"/><path d="M45 213V83H135V213Z" fill="#233b40" stroke="#a99d73" stroke-width="4"/><path d="M32 83L90 51L148 83M90 51V28" fill="none" stroke="#a99d73" stroke-width="4"/><path d="M65 194Q48 148 88 104Q76 143 108 159Q130 180 115 194Z" fill="#e9c080"/><path d="M75 195Q63 169 88 142Q87 169 102 176V195Z" fill="#fff0b3"/></svg>`;
  if(kind==='father')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="103" r="70" fill="none" stroke="#adbdaf" opacity=".35"/>${scenePerson(90,242,'#536773','father',1.45)}<path d="M103 130L123 140L114 207L97 199Z" fill="#a65e52"/><rect x="45" y="167" width="34" height="48" fill="#c6b58b"/></svg>`;
  // 执炬王：已经半个身子是光。轮廓要有"尚未成形的太阳"的观感，
  // 所以头冠上留一圈火，而不是画一张人脸。
  if(kind==='king')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="104" r="76" fill="url(#sceneFire)" opacity=".55"/><circle cx="90" cy="92" r="66" fill="none" stroke="#e6c884" opacity=".5"/><path d="M28 228L40 122L84 96L140 120L154 228Z" fill="#6f5836"/><path d="M56 120L60 214H124L128 126L92 108Z" fill="#2a3138"/><path d="M52 100L58 54L90 30L124 58L128 102L96 120Z" fill="#8a6c3e" stroke="#e0c184" stroke-width="3"/><path d="M58 48L44 6L70 26L90 -2L110 26L138 2L124 50Z" fill="#e9c181"/><path d="M66 76L80 80M100 81L114 78" stroke="#382f21" stroke-width="4"/><path d="M78 100H102" stroke="#efe0b6" stroke-width="3"/><path d="M136 140L160 196" stroke="#c8a765" stroke-width="11" stroke-linecap="round"/><path d="M40 228H144" stroke="#e0c184" stroke-opacity=".5"/></svg>`;
  // 城里的普通人（守夜人、被记名的人）：刻意朴素，与大人物拉开距离。
  if(kind==='townsfolk')return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="103" r="70" fill="none" stroke="#a9b3a4" opacity=".3"/>${scenePerson(90,242,'#7e8879','townsfolk',1.45)}<path d="M24 226H156" stroke="#a9b3a4" opacity=".45"/></svg>`;
  const colors={jin:'#80463f',mia:'#526d68',granary:'#7a805d',healer:'#667267',bell:'#5c6379',ferry:'#776751',bridge:'#80584b',warden:'#4a5560'};
  // 追索军官不用同行者的剪影：他更高、有甲胄和赤色披带，
  // 玩家一眼就要认出"这个人和前面三个不是一类"。
  if(kind==='warden'){
    return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="103" r="70" fill="none" stroke="#bba474" opacity=".35"/>
      <path d="M32 226L38 118H142L148 226Z" fill="#3b444d"/>
      <path d="M116 124L140 134L112 196L88 186Z" fill="#8a4640"/>
      <path d="M33 128L74 104L124 112L112 132Z" fill="#555f66"/>
      <path d="M62 112V60L90 36L118 58V110Z" fill="#2f3a44"/>
      <path d="M70 76H110" stroke="#e0b781" stroke-width="5"/>
      <path d="M126 148L148 204" stroke="#3d4750" stroke-width="10" stroke-linecap="round"/>
      <path d="M24 226H156" stroke="#bba474" opacity=".5"/></svg>`;
  }
  return `<svg viewBox="0 0 180 240" aria-hidden="true"><circle cx="90" cy="103" r="70" fill="none" stroke="#bba474" opacity=".35"/>${scenePerson(90,242,colors[kind]||colors.bridge,kind,1.45)}<path d="M24 226H156" stroke="#bba474" opacity=".5"/></svg>`;
}

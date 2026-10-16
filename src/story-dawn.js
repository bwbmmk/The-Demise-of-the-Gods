export const DAWN_STORY={
  opening:[
    {kicker:'ACT IV / THE LAST ORACLE',title:'万家各自点灯。',body:'弥娅走后，她留下的那套办法自己长开了。避难所、粮仓、余火中继站、种子库、夜路，在不同地方同时铺开。\n这秩序不是神建立的，甚至也不全是烬建立的——是普通人彼此之间建立的。',quote:'烬：「也许活下去这件事，本来就不该只交给一个太阳。」',art:'dawn-refuge'},
    {kicker:'THE ROSTER / A NAME ON THE LIST',title:'名单上有谁。',body:'执炬王把全部幸存者的记忆投入黎明王座，名单就挂在王庭的城门边。守卫原本只是轮值，直到有人认出自己家的姓。\n没有人被谁说服。他只是先看清了名单上写着谁。',quote:'王庭守卫：「让我再看一遍……那是我妹的名字。」',art:'dawn-roster'},
  ],
  ending:[
    {kicker:'THE THRONE / A SUN NOT YET FORMED',title:'他一动，脚下的城就亮一分。',body:'王把自己融进了黎明王座，成为一尊尚未成形的新太阳。他不再是可以用剑对付的人，而是一种正在成形的光。\n烬接住王施法后回落的星火，将它们灌回供能的黎明楔。第一道裂纹沿着楔身爬上王座，城里的光暗了一瞬。第三根楔折断后，那轮未成形的太阳终于停止升起。',quote:'烬：「火还在。只是不能再拿他们来烧。」',art:'dawn-throne'},
    {kicker:'THE SIXTH LOCK / UNSEALED, NOT OPENED',title:'门可以开了。门还没有开。',body:'第三根楔断的时候，仪式整个停住。第六道安眠锁应声而解，六锁已尽，无名之门不再被封锁。\n王还没有死。他倒下之前仍在问：如果明天没有太阳呢？烬仍然没有回答——这个问题不该由他一个人替所有人说出口。',quote:'执炬王：「如果明天没有太阳呢？」\n烬：「……这个问题，不该由我一个人说出口。」',art:'dawn-lock'},
  ],
  evidence:[
    {title:'记名避难所',art:'dawn-refuge'},
    {title:'献祭名单',art:'dawn-roster'},
    {title:'城门的门闩',art:'dawn-guard'},
    {title:'道路与安眠的名字',art:'dawn-lockroad'},
    {title:'粮只够七夜',art:'dawn-supply'},
    {title:'尚未成形的太阳',art:'dawn-throne'},
    {title:'三根黎明楔',art:'dawn-wedges'},
  ],
};

// 同一套原生 SVG 语言；与前三幕共用 person(...) 的造型，只换配色与地景。
export function dawnSceneShapes(kind,person){
  const jin=(x,y,s=1)=>person(x,y,'#844c43','traveler',s);
  const kin=(x,y,s=1)=>person(x,y,'#9c7a4a','warden',s);      // 王庭守卫
  const king=(x,y,s=1)=>person(x,y,'#c99a52','king',s);        // 执炬王：偏金
  const town=(x,y,s=1,c='#7e8879')=>person(x,y,c,'townsfolk',s);
  const fire=(x,y,r=145)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sceneFire)"/><path d="M${x} ${y+26}q-30-30-4-69q0 22 21 40q17 26-17 29Z" fill="#ecc785"/>`;
  // 王座：一尊尚未成形的太阳。三条楔从左中右插在地里，供着仪式。
  const throne=`<path d="M478 588L560 337Q900 214 1240 337L1322 588Z" fill="#3a4a55" opacity=".9"/><circle cx="900" cy="430" r="164" fill="url(#sceneFire)"/><circle cx="900" cy="430" r="104" fill="#f2d79a" opacity=".72"/>`;
  const wedges=(y=606)=>[
    `<path d="M700 ${y}V348l52-70v328Z" fill="#5b6a74" stroke="#e7cf96" stroke-width="7"/>`,
    `<path d="M1098 ${y}V348l52-70v328Z" fill="#5b6a74" stroke="#e7cf96" stroke-width="7"/>`,
    `<path d="M899 ${y}V320l52-70v356Z" fill="#5b6a74" stroke="#e7cf96" stroke-width="7"/>`,
  ].join('');
  let art='<path d="M0 586H1200V700H0Z" fill="#11252f"/>';
  if(kind==='dawn-refuge'){
    // 记名避难所：几间屋、门口的名册、轮班的火炬
    for(let i=0;i<4;i++){const x=118+i*268;
      art+=`<path d="M${x} 585V389H${x+188}V585" fill="#2f4857" stroke="#82a7ab" stroke-width="3"/><path d="M${x-13} 389L${x+94} 328L${x+201} 389Z" fill="#3d5a67" stroke="#8fb3ad" stroke-width="3"/><rect x="${x+34}" y="455" width="46" height="60" fill="#c8b889" opacity=".55"/>`;}
    art+=`<path d="M470 583h266v14H470Z" fill="#998b6a"/><path d="M492 540h226v40H492Z" fill="#cdb98c" opacity=".8"/>`;
    for(let i=0;i<4;i++)art+=`<path d="M${512+i*62} 548h34M${512+i*62} 559h34" stroke="#6d6449" stroke-width="3"/>`;
    art+=`${town(560,583,.92,'#a08d68')}${town(676,583,.9)}${jin(392,584,1.06)}${fire(1010,505,96)}`;
  }else if(kind==='dawn-roster'){
    // 献祭名单：城门边一张长纸，守卫的手指停在某个姓上
    art+=`<path d="M0 586H1200V700H0Z" fill="#0e2029"/><path d="M702 585V171Q900 15 1098 171V585" fill="#273e49" stroke="#8dafa9" stroke-width="14"/><path d="M740 581V198Q901 57 1060 198V581" fill="#152a35"/>`;
    art+=`<rect x="404" y="238" width="212" height="330" fill="#cdbb90" stroke="#8c7c58" stroke-width="5"/>`;
    for(let i=0;i<9;i++)art+=`<path d="M424 ${272+i*33}H596" stroke="#6f6549" stroke-width="3"/>`;
    art+=`<path d="M424 371H512" stroke="#b45f52" stroke-width="5"/>`;
    art+=`${kin(330,585,1.12)}${jin(214,585,.9)}<path d="M362 468L508 372" stroke="#c3b18a" stroke-width="10"/>`;
  }else if(kind==='dawn-guard'){
    // 城门的门闩被人抬起来
    art+=`<path d="M0 585V210H150V585ZM1050 585V210H1200V585Z" fill="#263a44" stroke="#7f9c98" stroke-width="9"/>`;
    art+=`<path d="M150 372H1050" stroke="#a68f60" stroke-width="26"/><path d="M150 420H1050" stroke="#8b774f" stroke-width="16" opacity=".7"/>`;
    art+=`<path d="M555 372l62-118l62 118Z" fill="#cbb184"/>`;
    art+=`${jin(760,585,1.12)}${kin(628,585,1.02)}<path d="M792 462L666 404" stroke="#c3b18a" stroke-width="9"/>`;
    art+=`<path d="M430 585L1200 585" stroke="#6d827e" stroke-width="5"/>`;
  }else if(kind==='dawn-lockroad'){
    // 夜路与中继站：一排火炬照亮的路
    art+=`<path d="M0 604L1200 560V700H0Z" fill="#1a2f39"/>`;
    for(let i=0;i<5;i++){const x=170+i*215;art+=`<path d="M${x} 598V430" stroke="#7c6f52" stroke-width="7"/>${fire(x,402,62)}`;}
    art+=`${jin(360,602,1.0)}${town(520,602,.9,'#a08d68')}<path d="M150 622H1050" stroke="#c8b889" stroke-opacity=".35" stroke-width="4"/>`;
  }else if(kind==='dawn-supply'){
    // 粮只够七夜：仓廪、量斗，王在中继站前
    art+=`<path d="M96 583V365H420V583Z" fill="#334751" stroke="#8fa099" stroke-width="6"/><path d="M78 365L258 268L438 365Z" fill="#3f5763" stroke="#93ada6" stroke-width="6"/>`;
    for(let i=0;i<3;i++)art+=`<path d="M${146+i*96} 583V492h62v91Z" fill="#a58f60" opacity=".85"/>`;
    art+=`<path d="M640 583L690 452h172l50 131Z" fill="#5a6b62" stroke="#93a89f" stroke-width="5"/>`;
    art+=`${king(886,583,1.24)}${jin(586,583,1.0)}${fire(1046,492,72)}`;
  }else if(kind==='dawn-throne'||kind==='dawn-wedges'){
    // 王座与三楔：王之胸腔前，地缝透光
    art+=`<path d="M0 586H1200V700H0Z" fill="#0d1e28"/>`;
    art+=throne;
    art+=wedges(586);
    art+=`<path d="M0 604L1200 574" stroke="#c99a52" stroke-opacity=".38" stroke-width="5"/>`;
    art+=kind==='dawn-wedges'?`${jin(452,586,1.14)}${fire(512,430,58)}${fire(1146,430,58)}`:`${jin(430,586,1.16)}`;
  }else if(kind==='dawn-lock'){
    // 倒下的王与仍未开启的门
    art+=`<path d="M666 585V171Q900 9 1134 171V585" fill="#273e49" stroke="#8dafa9" stroke-width="15"/><path d="M704 581V198Q900 57 1096 198V581" fill="#152a35"/><path d="M900 114V581" stroke="#c6d4b7" stroke-width="4"/>`;
    art+=`<circle cx="900" cy="352" r="88" fill="url(#sceneFire)" opacity=".62"/>`;
    art+=`${jin(400,586,1.1)}${king(540,600,1.28)}${fire(452,478,64)}`;
  }
  return art;
}

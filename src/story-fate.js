export const FATE_STORY={
  opening:[
    {kicker:'ACT III / THE RECORD OF CHOICES',title:'众神不语。\n旧日作证。',body:'三域封门上的剑痕，一寸不差地合着烬的残刃。记录被送进命运域，此后再没有人取走。\n弥娅与他来到留痕廊。这里没有写好的明天，只有曾被人留下、又被人遗忘的昨日。',quote:'烬：「把那一页找出来。我想亲眼看。」',art:'fate-record'},
    {kicker:'THE HEART / A LIGHT ON THE PAST',title:'照过来路，\n才知去处。',body:'神心照向断桥，金色石台一块块显出来。墙上的蓝色封痕也亮了，截断了去路。\n按住 E 照忆，旧桥才能承重；跃离石台后收光穿墙，再照亮下一处落脚地。烬把剑带在身边，走进光里。',quote:'弥娅：「我跟着。你看见什么，告诉我。」',art:'fate-light'},
  ],
  ending:[
    {kicker:'A NAME / GIVEN TO THE LIVING',title:'无名者举火。',body:'三个人走出潮口。妇人替老人扶稳灯，孩子抱着书，沿着照亮的石路继续走。\n没有人知道雾里递火的人叫什么，也没有人看见那几个曾浮在余火中的字。烬松开空了的手，另一只手里，神心仍亮着。',quote:'孩子：「前面还有一盏。我们能走到那里。」',art:'fate-rescue'},
    {kicker:'THE CLOSED GATE / THE ROAD AHEAD',title:'关门的是我。',body:'守卷人在潮口外等着，问他：“你连名字都不要了，还去无名之门做什么？”\n烬停了一会儿，把太阳神之心托稳。他舍去的是这一次取回名字的余火。门仍在那里，当年留下的封印也仍在那里。',quote:'烬：「关门的是我。」\n「总得有人把它打开。」',art:'fate-alone'},
    {kicker:'FIVE OF SIX / TOWARD THE LAST LOCK',title:'长夜未尽。\n这一程，独行。',body:'六道神锁已解五道，只剩安眠。弥娅走向收容所，要把活着和失踪的人都记进名册。\n烬走向另一条路。名字还在门后；这一次，走下去已经不只为了它。',quote:'烬：「几千年前我关了那扇门。这一次，我去把它打开。」',art:'fate-road'},
  ],
  evidence:[
    {title:'封门记录',art:'fate-record'},
    {title:'开门之日',art:'fate-war'},
    {title:'关门的手',art:'fate-close'},
    {title:'太阳身后',art:'fate-sword'},
    {title:'焚名台',art:'fate-pyre'},
    {title:'抄名人的岔路',art:'fate-parting'},
    {title:'仅此一次',art:'fate-ember'},
  ],
};

// 同一套原生 SVG 语言；每段证据都能在纯享版中对应到独立画面。
export function fateSceneShapes(kind,person){
  const jin=(x,y,s=1)=>person(x,y,'#844c43','traveler',s);
  const mia=(x,y,s=1)=>person(x,y,'#526d68','mia',s);
  const fire=(x,y)=>`<circle cx="${x}" cy="${y}" r="145" fill="url(#sceneFire)"/><path d="M${x} ${y+28}q-32-32-5-74q0 24 23 43q18 28-18 31Z" fill="#ecc785"/>`;
  const gate=`<path d="M700 583V174Q899 9 1100 174V583" fill="#273e49" stroke="#8dafa9" stroke-width="15"/><path d="M738 579V201Q901 53 1062 201V579" fill="#152a35"/><path d="M900 112V579" stroke="#c6d4b7" stroke-width="4"/>`;
  let art='<path d="M0 586H1200V700H0Z" fill="#11252f"/>';
  if(kind==='fate-record'){
    for(let i=0;i<7;i++){const x=120+i*144;art+=`<path d="M${x} 557V181H${x+94}V557" fill="#2f4857" stroke="#82a7ab" stroke-width="3"/><path d="M${x+17} 218H${x+77}M${x+17} 262H${x+77}M${x+17} 306H${x+77}M${x+17} 350H${x+77}" stroke="#c8b889" stroke-opacity=".6" stroke-width="3"/>`;}
    art+=`${jin(460,593,1.1)}${mia(594,593)}${fire(518,462)}`;
  }else if(kind==='fate-light'){
    art='<path d="M0 566H372V700H0ZM1070 566H1200V700H1070Z" fill="#182b35"/>';
    for(let i=0;i<3;i++)art+=`<path d="M${410+i*223} 491h160v21h-160Z" fill="#998b6a" stroke="#f1d494" stroke-width="4"/><path d="M${412+i*223} 519v74" stroke="#c7ae7b" stroke-opacity=".15" stroke-width="3"/>`;
    art+=`<path d="M619 145v411h57V145Z" fill="#89c8dc" fill-opacity=".28" stroke="#bee8ed" stroke-width="4"/>${jin(302,566)}${mia(175,566,.92)}${fire(350,455)}<path d="M361 456L1170 380L1116 556L407 516Z" fill="#ebc778" fill-opacity=".07"/>`;
  }else if(['fate-war','fate-close','fate-sword'].includes(kind)){
    art+=gate;
    if(kind==='fate-war'){
      art+=`<path d="M804 568V234Q900 148 996 234V568" fill="#d6c297" opacity=".5"/>${fire(900,340)}<path d="M0 522Q219 371 410 530L631 700H0Z" fill="#467c8b" opacity=".75"/>${person(220,494,'#768375','healer',.9)}${person(275,517,'#977d63','traveler',.55)}${jin(567,583,1.25)}`;
    }else if(kind==='fate-close')art+=`${jin(832,581,1.55)}<path d="M852 457L900 409" stroke="#c9b58c" stroke-width="13"/><path d="M885 172L928 247L880 312L928 386L890 558" fill="none" stroke="#ba9f73" stroke-width="6"/><path d="M0 603L790 568" stroke="#a6c2b0" stroke-width="5"/>`;
    else art+=`<path d="M804 581L810 421Q852 393 889 419L906 581Z" fill="#a49569"/><path d="M839 424L889 391L929 347" stroke="#a49569" stroke-width="19" fill="none"/><path d="M834 385L834 348L866 336L891 366L874 397Z" fill="#796f51"/><path d="M830 350l-18-53 27 18 15-50 25 44 26-14-18 58" fill="#b1a56e"/>${jin(661,582,1.15)}<path d="M669 474L842 421" stroke="#c8cbb2" stroke-width="8"/><path d="M647 456L672 498" stroke="#ae8e66" stroke-width="9"/>`;
  }else if(kind==='fate-pyre'){
    art+=`<path d="M400 588L455 451H767L824 588Z" fill="#334751" stroke="#8fa099" stroke-width="6"/>${fire(610,417)}<rect x="575" y="328" width="75" height="117" fill="#c2a97a" transform="rotate(17 610 385)"/><path d="M597 352h34M597 371h24M597 390h31" stroke="#746b57" stroke-width="4"/>${jin(382,588,1.2)}<path d="M402 479L526 416" stroke="#bba785" stroke-width="13"/>${mia(958,588,1.1)}`;
  }else if(kind==='fate-parting'){
    art+=`<path d="M530 700L627 487L217 223M627 487L1057 266" fill="none" stroke="#597c80" stroke-width="50"/>${jin(650,593,1.1)}${mia(357,419,.82)}<path d="M299 373h43v65h-43Z" fill="#bfa67c"/><path d="M221 266H303V345H221Z" fill="#a3bfa4" opacity=".45"/>`;
  }else if(kind==='fate-ember'){
    art+=`${jin(443,582,1.1)}${fire(604,365)}<path d="M587 321H628M587 344H617M591 369H628" stroke="#fff0b2" stroke-width="4"/><path d="M603 392Q706 425 1053 457M604 392Q656 460 760 556" fill="none" stroke="#d3be81" stroke-width="3"/>`;
    for(let i=0;i<3;i++)art+=`<path d="M${829+i*91} 565V436h40v129Z" fill="#223b48" stroke="#8eab9f" stroke-width="3"/>`;
  }else if(kind==='fate-rescue'){
    art+=`<path d="M0 100L328 208L404 700H0Z" fill="#6c7d82" opacity=".42"/>${jin(380,584)}${person(725,576,'#7e8879','healer',.92)}${person(861,575,'#7d8374','elder',.94)}${person(977,575,'#a08d68','traveler',.57)}${fire(648,461)}<path d="M638 488L1180 497" stroke="#e2c388" stroke-width="5"/>`;
  }else if(kind==='fate-alone')art+=`${gate}${jin(437,582,1.16)}${fire(484,468)}<path d="M0 646L1200 590" stroke="#697f7a" stroke-width="4"/>`;
  else art+=`<path d="M0 692L846 253H1027L383 700Z" fill="#435e68"/><path d="M799 292V126Q921 13 1045 126V292" fill="#213943" stroke="#8ca49d" stroke-width="12"/>${jin(436,583,.86)}${fire(478,490)}<path d="M0 456L199 332L391 423L636 289L1200 398V700L467 553Z" fill="#2d4854" opacity=".4"/>`;
  return art;
}

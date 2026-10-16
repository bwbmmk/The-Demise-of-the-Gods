export const STORY_PANELS=[
  {
    "kicker": "I / THE COVENANT",
    "title": "人们献出记忆，\n换来白昼。",
    "body": "旧祭文写道，人们以记忆为契，以此换取神明庇护。烬在灰城醒来，本名已从记忆中消失。\n他记得怎样握剑，却记不起谁把剑交给了他。街边碑上名字的刻痕都已经随着时间褪尽了。",
    "quote": "「那时，我们把遗忘称作恩典。」"
  },
  {
    "kicker": "II / THE FALL",
    "title": "后来，\n太阳也死去了。",
    "body": "白昼战争以后，神骸坠落，化作群山。灰城尽头，钟声仍从死去的胸腔里传出。\n弥娅读过神殿的征收簿。被收走的记忆，存放在无名之门后。街上的人却仍向神骸跪下。",
    "quote": "弥娅：「如果你的名字真的存在过，它或许也在那里。」"
  },
  {
    "kicker": "III / THE LAST EMBER",
    "title": "最后一缕火，\n交到你的手中。",
    "body": "弥娅把太阳神之心交给烬：这是开启无名之门的核心钥匙，六道神锁还得沿途解开。\n她查过旧祭道，知道六神的残骸仍被祈祷回路束缚；开门才能归还记忆，让它们真正死去。烬只想先找到自己。",
    "quote": "烬：「我把它送到门前。你带我去找名字。」"
  },
  {
    "kicker": "IV / THE JOURNEY",
    "title": "为逝去的神，\n走完最后一程。",
    "body": "穿过灰城、圣所与神骸之桥，抵达无名之门。弥娅走在烬身旁，手杖点着尚未消失的石缝。\n掌中的余火没有熄灭，偶尔传来一声低低的哭。烬想不起自己何时见过这样的光，胸口却隐隐作痛。",
    "quote": "「先活着抵达。然后，听它说完。」"
  }
];
function citySilhouette(y,color,scale=1) {
  let output='';for(let i=0;i<18;i++){const x=i*76-30,height=45+(i*47%130);output+=`<path d="M${x} ${y}v-${height}l12-5 7-25 8 25h22l9-18 6 22h12v${height+1}z" fill="${color}"/>`;}
  return `<g transform="scale(${scale} 1)">${output}</g>`;
}
function figure(x,y,scale,hood=true) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-30 0l8-93 17-21 21 9 15 105z" fill="#0b1720"/><path d="M-19-83l-39 69 32-12 18-64" fill="${hood?'#8e4b42':'#4c6261'}"/><path d="M-17-102l1-21 17-21 17 12 9 30-18 12z" fill="#1c3038" stroke="#809182" stroke-opacity=".5"/><path d="M0-121l18 9-4 13-16-6" fill="#0b1720"/><path d="M10-90l31 24 27-11" fill="none" stroke="#425954" stroke-width="11" stroke-linecap="round"/><path d="M65-77h15" stroke="#c9b28b" stroke-width="6" stroke-linecap="round"/></g>`;
}
export function storyArt(index) {
  const halo=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#bca46b" stroke-opacity=".35"/><circle cx="${x}" cy="${y}" r="${r+13}" fill="none" stroke="#bca46b" stroke-opacity=".14"/>`;
  let art='';
  if(index===0)art=`<circle cx="615" cy="192" r="84" fill="url(#sun)"/>${halo(615,192,114)}<g stroke="#cead70" stroke-opacity=".28">${Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2;return `<path d="M${615+Math.cos(a)*123} ${192+Math.sin(a)*123}l${Math.cos(a)*24} ${Math.sin(a)*24}"/>`;}).join('')}</g><path d="M575 580l-25-215 29-72 15-70 42 0 25 73 38 68-16 216" fill="#293e43"/><path d="M587 251l-22-65 26 19 24-60 23 60 26-24-21  70" fill="none"/><path d="M573 242l-15-64 36 24 20-55 21 55 37-24-15 64" fill="#42534d" stroke="#8b886d"/><path d="M583 271l29 9 35-10M603 304l22 0" stroke="#10272e" stroke-width="5"/><path d="M567 348l-154 114-101-15M661 350l144 111 126-18" fill="none" stroke="#2d4549" stroke-width="45"/><path d="M613 320v210" stroke="#dfbd7444" stroke-width="3"/>${citySilhouette(610,'#15282f')}<path d="M0 616l180-55 129 15 196-15 179 26 186-21 330 42v92H0" fill="#0e1d23"/>${figure(350,580,.8,false)}${figure(850,590,.65,false)}<path d="M354 462Q474 396 617 306M853 490Q753 378 617 306" fill="none" stroke="#d0b97b" stroke-opacity=".3" stroke-dasharray="2 12"/>`;
  if(index===1)art=`<circle cx="765" cy="160" r="73" fill="#987952" opacity=".3"/>${halo(765,160,103)}<path d="M757 41l-23 88 43 23-53 84 41 31" fill="none" stroke="#efbd78" stroke-width="4"/><path d="M0 465l150-92 127 33 180-76 243 79 221-79 279 80v290H0" fill="#283d42"/><g transform="translate(610 405) rotate(25)"><path d="M-147-75l34-104 129-30 97 76 5 76-29 62-80 52-105-13-63-39z" fill="#485c5a" stroke="#7a8670"/><path d="M-114-170l-48-99 80 44 44-110 43 101  80 0" fill="none"/><path d="M-120-179l-43-98 78 39 44-102 39 102 95-47-33 92" fill="#344b4e"/><path d="M-92-80l56 15 36-20M22-70l37 12 37-18" stroke="#142d35" stroke-width="12"/><path d="M-45 16l47 7 40-20M-40-184l32 76-30 47 29 53" fill="none" stroke="#172d34" stroke-width="7"/></g>${citySilhouette(635,'#102128')}<path d="M920-40L763 366" stroke="#132932" stroke-width="21"/><path d="M811 162l127 52" stroke="#5b6559" stroke-width="12"/><path d="M0 540Q500 445 1200 578v122H0" fill="#0b1b23"/><g fill="#d4a16c">${Array.from({length:30},(_,i)=>`<circle cx="${i*43}" cy="${480+(i*31%145)}" r="${1+i%3}" opacity=".4"/>`).join('')}</g>`;
  if(index===2)art=`<path d="M132 650V117Q598-155 1068 117v533" fill="#20363e" stroke="#405557" stroke-width="25"/><path d="M225 650V174Q595-36 975 174v476" fill="#132731"/><path d="M580 0v195M270 177l110 66M930 166l-95 77" stroke="#d0b17833" stroke-width="3"/>${halo(600,310,142)}<ellipse cx="600" cy="363" rx="255" ry="200" fill="url(#ember)"/>${figure(392,625,2.5,false)}<g transform="translate(1200 0) scale(-1 1)">${figure(345,625,2.5)}</g><path d="M474 414q53 16 130-30l43 24-60 33-110 4" fill="#a89576"/><path d="M750 448l-91-8-57-36-29 20 72 51 104 9" fill="#67796b"/><path d="M582 399q-34-30-11-54 10-27 27-58 0 42 23 52 25 29 1 56z" fill="#d49a48"/><path d="M594 399q-20-20-2-54 12 19 20 28 12 20-18 26" fill="#ffdf98"/><path d="M343 284l61 8M811 285l47-7" stroke="#b1b4a0" stroke-width="5"/><path d="M0 636l346-34 258 24 284-36 312 59v51H0" fill="#091820"/>`;
  if(index===3)art=`<path d="M0 437l140-54 97 8  80 40" fill="none"/><path d="M0 428l120-57  90 0" fill="none"/><path d="M0 474l185-66 166 12 199-84 280 71 370-81v374H0" fill="#2a4248"/>${halo(938,286,162)}<ellipse cx="935" cy="377" rx="140" ry="280" fill="url(#ember)"/><path d="M842 553V262q94-147 189 0v291" fill="#172b30" stroke="#7f8263" stroke-width="13"/><path d="M871 553V275q65-97 128 0v278" fill="#d6b672" opacity=".18"/><path d="M932 221v331" stroke="#f4dd99" stroke-width="5"/><path d="M0 612l790-106 410 65v129H0" fill="#0b1c23"/><path d="M0 612l790-106 410 65" stroke="#6f7a62" stroke-width="5"/><path d="M460 558l-107-17 59 34-122 16 99 0" fill="#a65b46"/>${figure(440,565,.95)}<circle cx="513" cy="486" r="58" fill="url(#ember)"/><path d="M507 488q-13-18 1-37 1 15 11 21 11 17-12 16" fill="#efc57c"/><g stroke="#697c70" stroke-width="15" fill="none" opacity=".65"><path d="M20 598Q-108 180 342 79M250 575Q59 210 439 64"/></g>`;
  // SVG 原生绘制，四幅独立构图，无联网素材。文字置于 HTML 以保持可读性。
  return `<svg viewBox="0 0 1200 700" role="img" aria-label="${STORY_PANELS[index].title.replace('\n','')}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#101f2b"/><stop offset="1" stop-color="#506764"/></linearGradient><radialGradient id="sun"><stop stop-color="#e3ca8d"/><stop offset="1" stop-color="#9e936e"/></radialGradient><radialGradient id="ember"><stop stop-color="#edbf713f"/><stop offset=".45" stop-color="#cb934617"/><stop offset="1" stop-color="#cb934600"/></radialGradient></defs><path fill="url(#sky)" d="M0 0h1200v700H0z"/>${art}<g fill="#c8cbb1" opacity=".35">${Array.from({length:45},(_,i)=>`<circle cx="${i*79%1200}" cy="${i*137%680}" r="${i%3===0?1.8:.8}"/>`).join('')}</g><path d="M18 75V18h 70 M1182 625v57h-70" fill="none" stroke="#d2b277" stroke-opacity=".4"/></svg>`;
}

// 两节腿的圆交点。只取朝行进方向凸出的膝盖，避免摆腿时反关节。
export function legJoints(hip,foot,upper=22,lower=23) {
  const dx=foot[0]-hip[0],dy=foot[1]-hip[1],raw=Math.hypot(dx,dy);
  const d=Math.max(.01,Math.min(upper+lower-.01,raw));
  const along=(upper*upper-lower*lower+d*d)/(2*d);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  const ux=dx/Math.max(raw,.01),uy=dy/Math.max(raw,.01);
  return {knee:[hip[0]+ux*along+uy*bend,hip[1]+uy*along-ux*bend],foot:[hip[0]+ux*d,hip[1]+uy*d]};
}
// 着地脚由前向后推地；后脚抬跟、收腿，再向前摆。左右腿错开半周期。
export function strideFoot(t,offset=0) {
  const phase=((t*2.6+offset)%1+1)%1;
  if(phase<.6)return [15-32*phase/.6,-2];
  const q=(phase-.6)/.4,e=q*q*(3-2*q);
  return [-17+32*e,-2-22*Math.sin(Math.PI*q)];
}
// 时间连续的关节姿态，独立于显示器刷新率；物理脚点始终是局部原点。
export function runnerPose(p,t,running=true) {
  if(p.collapse>0){
    const base=runnerPose({...p,collapse:0,slideTime:0,grounded:true},t,false),q=Math.min(1,p.collapse);
    const kneel={hips:[-7,-16],chest:[9,-33],head:[18,-42],hand:[29,-13],elbow:[24,-25],backElbow:[-8,-20],backHand:[-19,-3],kneeA:[13,-3],footA:[-4,-3],kneeB:[-20,-4],footB:[-34,-3],cape:[[-2,-37],[-30,-33],[-53,-18],[-68,-6],[-43,-3],[-15,-14]]};
    for(const key of Object.keys(kneel)){if(key==='cape')base.cape=base.cape.map((pt,i)=>pt.map((v,k)=>v+(kneel.cape[i][k]-v)*q));else base[key]=base[key].map((v,k)=>v+(kneel[key][k]-v)*q);}
    return base;
  }
  const phase=t*2.6*Math.PI*2,cycle=Math.sin(phase),air=!p.grounded,slide=p.slideTime>0;
  if(slide) return {hips:[-15,-12],chest:[4,-17],head:[16,-19],hand:[37,-14],elbow:[22,-12],backElbow:[-22,-17],backHand:[-35,-6],kneeA:[6,-7],footA:[30,-3],kneeB:[-27,-5],footB:[-44,-3],cape:[[-4,-22],[-32,-24],[-58,-12],[-80,-14],[-64,-4],[-24,-10]],squash:1};
  const compression=(p.landPose||0)*14,bob=air?0:running?Math.abs(cycle)*1.2:Math.sin(t*1.7)*.4;
  const chest=[air?-2:4,-58+compression-bob],head=[air?2:8,-73+compression-bob];
  const hand=[27+Math.sin(t*5)*1.4,air?-50:-43+compression-bob];
  const tuck=(p.airSpin||0)>0?1:air&&p.vy<0?.6:0;
  const hips=[0,-41+compression-bob];
  const legA=legJoints(hips,air?[8,-2-tuck*18]:running?strideFoot(t):[9,-2]);
  const legB=legJoints(hips,air?[-22,-4-tuck*12]:running?strideFoot(t,.5):[-11,-2]);
  return {hips,chest,head,hand,elbow:[13,-39+compression-bob],backElbow:[-17,-41+compression+cycle*4],backHand:[-20-cycle*8,-30+compression],
    kneeA:legA.knee,footA:legA.foot,kneeB:legB.knee,footB:legB.foot,
    cape:[[chest[0]-7,chest[1]-4],[-30,-53+Math.sin(t*11)*4],[-55,-45+Math.sin(t*13)*6],[-77,-34+Math.sin(t*10)*8],[-56,-32+Math.sin(t*12)*6],[-21,-32]],squash:1};
}

// 攻击参数由模拟和画面共同读取，避免预警、判定和当前锁孔错位。
export const CHAIN_PATTERNS=[
  {aim:2.4,lock:1,tolerance:55,attack:null,waves:[{at:.8,height:45}]},
  {aim:2.2,lock:.85,tolerance:50,attack:'low',waves:[{at:.7,height:45},{at:1.6,height:60}]},
  {aim:2,lock:.75,tolerance:45,attack:'high',waves:[{at:.65,height:45},{at:1.5,height:140}]},
];
export function chainPattern(config,state){
  const patterns=config.patterns||CHAIN_PATTERNS;
  return patterns[Math.min(patterns.length-1,state.patternIndex??state.hits??0)];
}
export function chainLinkGeometry(state,camera){
  const broken=state.connected&&['impact','recover'].includes(state.phase);
  const index=Math.min(2,state.patternIndex??Math.max(0,state.hits-(broken?1:0)));
  const start={x:state.x-camera-52+index*52,y:360},end={x:state.anchorX-camera,y:589};
  return {index,start,end,control:{x:(start.x+end.x)/2,y:540}};
}

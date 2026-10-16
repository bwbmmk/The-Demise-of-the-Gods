const clampScene=value=>Math.max(0,Math.min(1,value));
const easeScene=value=>{const q=clampScene(value);return q*q*(3-2*q);};
export const SCENE_DURATIONS={arrival:2.8,defeat:2.1,departure:4.2};
export function flameStrength(health) {return [0,.36,.68,1][Math.max(0,Math.min(3,Math.round(health)))];}

// 演出时不推进 Runner；暂停、跳过只改变演出时间，不改变物理和结算数据。
export class Cinematic {
  constructor(){this.active=false;this.type=null;this.time=0;this.cues=new Set();}
  begin(type,{falling=false,reducedMotion=false}={}) {
    if(!(type in SCENE_DURATIONS))throw new Error('Unknown cinematic');
    this.type=type;this.time=0;this.active=true;this.falling=falling;this.reducedMotion=reducedMotion;this.cues.clear();
  }
  cancel(){this.active=false;this.type=null;}
  skip(){if(this.active)this.time=SCENE_DURATIONS[this.type];}
  update(dt){if(this.active)this.time=Math.min(SCENE_DURATIONS[this.type],this.time+Math.max(0,dt));return this.active&&this.time>=SCENE_DURATIONS[this.type];}
  takeCue(name,progress){if(this.active&&!this.cues.has(name)&&this.time/SCENE_DURATIONS[this.type]>=progress){this.cues.add(name);return true;}return false;}
  sample() {
    if(!this.active)return null;
    const q=clampScene(this.time/SCENE_DURATIONS[this.type]);
    const base={type:this.type,q,time:this.time,offsetX:0,offsetY:0,alpha:1,collapse:0,flame:1,gate:0,running:false,scale:1,falling:this.falling};
    if(this.type==='arrival') {
      const landing=easeScene(q/.42),rise=easeScene((q-.48)/.38);
      return {...base,offsetX:this.reducedMotion?0:-110*(1-landing),offsetY:this.reducedMotion?0:-160*(1-landing),alpha:Math.min(1,q*7),collapse:q<.42?0:(1-rise)*.8,flame:.06+.94*easeScene((q-.43)/.42)};
    }
    if(this.type==='defeat')return {...base,collapse:easeScene(q/.53),offsetY:this.falling?60+q*110:0,alpha:1-easeScene((q-.55)/.4),flame:.35*(1-easeScene(q/.66))};
    return {...base,offsetX:170*easeScene((q-.17)/.58),alpha:1-easeScene((q-.68)/.18),flame:1-easeScene((q-.64)/.2),gate:easeScene(q/.27)*(1-easeScene((q-.85)/.15)),running:q>.17&&q<.76,scale:1-.25*easeScene((q-.4)/.4)};
  }
}

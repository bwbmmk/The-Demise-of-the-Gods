export const PROGRESS_KEY='requiem.progress.v1';
export const COMPLETION_KEY='requiem.completed.v1';

// 余火上限随四心系统变成 4（见 hearts.js）。这个上限写进了存档校验里——
// 沿用硬编码 3 会让拿到第四心的玩家**读不出自己的存档**，直接被当成失效进度。
import { MAX_HEALTH, tallyHearts } from './hearts.js';

// 只保存已到达的检查点，绝不把手记已读当作本次关卡任务已完成。
export class ProgressStore {
  constructor(storage=null){this.storage=storage;this.notice='';}
  readAll(){
    try{const raw=this.storage?.getItem(PROGRESS_KEY);if(!raw)return {};
      const data=JSON.parse(raw);if(data.version!==1||!data.levels||typeof data.levels!=='object')throw Error('format');return data.levels;
    }catch{this.notice='旧进度无法读取，可重新开始；已读手记独立保留。';return {};}
  }
  load(level){
    const data=this.readAll()[level.id];if(!data)return null;
    const cp=data.checkpoint;
    const ids=(values,list)=>Array.isArray(values)&&values.every(id=>typeof id==='string'&&list.some(e=>e.id===id&&e.x<cp));
    if(!level.checkpoints.includes(cp)||!Number.isFinite(data.elapsed)||data.elapsed<0||data.elapsed>86400||!Number.isInteger(data.health)||data.health<1||data.health>MAX_HEALTH||!Number.isInteger(data.respawns)||data.respawns<0||!Number.isFinite(data.bestCombo)||data.bestCombo<0||!ids(data.shards,level.shards)||!ids(data.rings,level.rings)||!ids(data.items,level.items||[])||!ids(data.flags,level.flags||[])){
      this.notice='此章节进度已失效，可重新开始；已读手记独立保留。';return null;
    }
    return data;
  }
  /**
   * 前置幕的心源结算：逐幕按收集率定档，累加后**硬封顶 4**（见 hearts.js）。
   * 只统计真的有存档的幕——玩家跳关的话，没打的幕不算 0 心，
   * 而是「不计入」，否则会因为缺档而被扣心。
   * @param {string[]} ids 前置幕的 level.id，按顺序
   * @returns {{total:number, breakdown:Array}}
   */
  tallyHearts(ids){
    const levels={...this.readAll(),...this.readCompleted()};
    const acts=ids.map(id=>{
      const d=levels[id];
      return {id,collected:(d?.shards||[]).length,total:d?.shardTotal??0};
    }).filter(a=>a.total>0);
    return tallyHearts(acts);
  }
  save(game){
    if(game.checkpoint===0||game.level.bossOnly||game.level.previewOnly)return;
    const levels=this.readAll();
    levels[game.level.id]={checkpoint:game.checkpoint,health:game.health,
      shards:[...game.checkpointShards],rings:[...game.checkpointRings],items:[...game.checkpointItems],flags:[...game.checkpointFlags],
      // 记下这一幕的碎片总数与已收集数，供第四幕结算心源。
      // 没有这两项就没法跨幕累计——只存已收集数是不够的，
      // 因为不同幕的碎片总数差了一个量级（序章 90 / 第三幕 16）。
      shardTotal:(game.level.shards||[]).length,
      elapsed:game.elapsed,respawns:game.respawns,bestCombo:game.bestCombo};
    try{this.storage?.setItem(PROGRESS_KEY,JSON.stringify({version:1,levels}));}catch{this.notice='浏览器未允许保存进度，本次旅程仍可继续。';}
  }
  clear(levelId){const levels=this.readAll();delete levels[levelId];try{this.storage?.setItem(PROGRESS_KEY,JSON.stringify({version:1,levels}));}catch{}}
  readCompleted(){try{const data=JSON.parse(this.storage?.getItem(COMPLETION_KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
  complete(game){
    if(game.level.bossOnly||game.level.previewOnly)return;
    const data=this.readCompleted();
    data[game.level.id]={shards:[...game.collected],shardTotal:game.level.shards.length,elapsed:game.elapsed};
    try{this.storage?.setItem(COMPLETION_KEY,JSON.stringify(data));}catch{}
    this.clear(game.level.id);
  }
  restore(game,data){
    game.reset();game.checkpoint=data.checkpoint;
    game.checkpointShards=new Set(data.shards);game.checkpointRings=new Set(data.rings);game.checkpointItems=new Set(data.items);game.checkpointFlags=new Set(data.flags);
    game.restoreCheckpoint();game.health=data.health;game.elapsed=data.elapsed;game.respawns=data.respawns;game.bestCombo=data.bestCombo;game.events=[];
  }
}

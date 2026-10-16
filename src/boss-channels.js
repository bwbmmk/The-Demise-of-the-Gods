import { BOSS_PRACTICE } from './level-district.js';
import { COVENANT_BOSS_PRACTICE } from './level-covenant.js';
import { DAWN_BOSS_PRACTICE } from './level-dawn.js';
import { FINAL_BOSS_PRACTICE } from './level-finale.js';

export const BOSS_CHANNELS=[
  {id:'bridge',buttonId:'boss-entry',level:BOSS_PRACTICE,guide:'追索军官 · 三轮法术与回火反击。'},
  {id:'chain',buttonId:'boss-covenant-entry',level:COVENANT_BOSS_PRACTICE,guide:'守门巨像 · 诱锤、贴地刃、高位光幕与震波。'},
  {id:'dawn',buttonId:'boss-dawn-entry',level:DAWN_BOSS_PRACTICE,guide:'执炬王 · 把金圈引到楔前，变红后按住 A 后撤，借王的落锤拆楔。'},
  {id:'final',buttonId:'boss-final-entry',level:FINAL_BOSS_PRACTICE,guide:'真门决战 · A/D 走位，跳跃/滑铲读连招；血量越少越快。按住 E 接忆，松开发还。'},
];

export function placeInBossArena(runner){
  const level=runner.level;
  if(level.finalBoss){runner.reset();runner.x=level.finalBoss.arena;runner.prevX=runner.x;runner.y=runner.prevY=runner.groundAt(runner.x);runner.checkpoint=0;return runner;}
  if(level.dawn){
    if(!level.bossOnly)throw new Error('这不是 Boss 练习场');
    const speed=level.chapters[0].speed;
    runner.reset();
    runner.x=level.dawn.trigger-speed/120*3;
    runner.prevX=runner.x;
    runner.y=runner.groundAt(runner.x);runner.prevY=runner.y;
    runner.checkpoint=level.checkpoints[0];
    runner.resetDawn();
    return runner;
  }
  if(!level.bossOnly||!level.boss)throw new Error('这不是 Boss 练习场');
  runner.reset();
  runner.x=level.boss.trigger-level.chapters[0].speed/120;
  runner.prevX=runner.x;runner.y=runner.groundAt(runner.x);runner.prevY=runner.y;
  runner.checkpoint=level.checkpoints[0];runner.resetBoss();
  return runner;
}

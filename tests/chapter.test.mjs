import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerPose,strideFoot} from '../src/animation.js';
import {Runner} from '../src/physics.js';
import {Narrative} from '../src/narrative.js';
import {DISTRICT} from '../src/level-district.js';
import {Encounter,DISTRICT_ENCOUNTERS} from '../src/narrative-act1.js';
import {CHAPTER_STORIES,chapterStoryArt} from '../src/chapter-scenes.js';
import {ProgressStore,PROGRESS_KEY} from '../src/progress.js';

test('knees keep the human bend direction through a full stride and both jumps',()=>{
  for(let t=0;t<2;t+=1/144)for(const p of [{grounded:true,slideTime:0},{grounded:false,vy:-600,airSpin:0},{grounded:false,vy:-600,airSpin:.4}]){
    const pose=runnerPose(p,t);
    for(const leg of ['A','B']){
      const h=pose.hips,k=pose['knee'+leg],f=pose['foot'+leg];
      const cross=(k[0]-h[0])*(f[1]-k[1])-(k[1]-h[1])*(f[0]-k[0]);
      assert.ok(cross>0,'膝盖不能反关节');
      assert.ok(Math.abs(Math.hypot(k[0]-h[0],k[1]-h[1])-22)<.001);
      assert.ok(Math.abs(Math.hypot(k[0]-f[0],k[1]-f[1])-23)<.001);
      assert.ok(f[1]<=-1.9,'脚底不能穿过地面');
    }
  }
  assert.ok(strideFoot(.2/2.6)[0]>strideFoot(.4/2.6)[0],'支撑脚由前向后推地');
  assert.ok(strideFoot(.8/2.6)[1]<-15,'摆动脚抬起');
});

test('running weight stays above the stance leg rather than in a permanent squat',()=>{
  for(let t=0;t<1/2.6;t+=1/240){
    const pose=runnerPose({grounded:true,slideTime:0,landPose:0},t);
    assert.ok(pose.hips[1]<=-40);assert.ok(pose.head[0]>pose.hips[0]);
    for(const leg of ['A','B'])if(pose['foot'+leg][1]>-2.1){
      const h=pose.hips,k=pose['knee'+leg],f=pose['foot'+leg];
      const cosine=((h[0]-k[0])*(f[0]-k[0])+(h[1]-k[1])*(f[1]-k[1]))/(22*23);
      assert.ok(Math.acos(Math.max(-1,Math.min(1,cosine)))>2,'支撑腿膝角应大于约115度');
    }
  }
});
test('every playable chapter has distinct opening and closing illustrations',()=>{
  for(const level of ['prologue','district'])for(const phase of ['opening','ending']){
    const pages=CHAPTER_STORIES[level][phase];assert.ok(pages.length>=2);
    const arts=pages.map((page,i)=>{assert.ok(page.title&&page.body&&page.quote);return chapterStoryArt(level,phase,i);});
    assert.equal(new Set(arts).size,pages.length);assert.ok(arts.every(s=>s.startsWith('<svg')&&!s.includes('https://')));
  }
});
test('district route never unlocks prologue memories by distance',()=>{
  const story=new Narrative();story.advance(DISTRICT.world.end,'district');assert.equal(story.count,0);
  for(const event of ['quarter-enter','plate-healer','plate-bell','plate-ferry'])story.event(event);
  assert.equal(story.count,4);assert.ok(!story.unlocked.has('p7'));assert.ok(!story.unlocked.has('a12'));
  story.event('bridge-restored');assert.ok(story.unlocked.has('a12'));
});
test('required names are route rewards even when the player jumps past; optional rings remain optional',()=>{
  for(const item of DISTRICT.items){
    const game=new Runner(DISTRICT);game.x=item.x-1;game.y=450;game.grounded=false;game.vy=0;
    game.chapter=DISTRICT.chapters.reduce((i,c,j)=>game.x>=c.at?j:i,0);game.update(1/120);
    assert.ok(game.items.has(item.id));assert.equal(game.rings.size,0);
  }
});
test('reading, pausing and skipping an encounter do not alter score, health, time or checkpoint',()=>{
  const game=new Runner(DISTRICT),before=JSON.stringify(game);
  for(const event of Object.keys(DISTRICT_ENCOUNTERS)){
    const scene=new Encounter();assert.equal(scene.begin(event),true);
    const page=scene.current;assert.equal(scene.current,page);
    while(scene.active)scene.next();
    assert.equal(scene.begin(event),false);
    const skipped=new Encounter();skipped.begin(event);assert.equal(skipped.finish().id,DISTRICT_ENCOUNTERS[event].id);
  }
  assert.equal(JSON.stringify(game),before);
});
test('checkpoint rolls back route flags together with the names and prevents lost encounters',()=>{
  const game=new Runner(DISTRICT);game.flag.add('q-enter');game.items.add('plate-healer');
  game.x=12999;game.y=606;game.update(1/120);
  game.flag.add('q-bell');game.items.add('plate-bell');game.restoreCheckpoint(true);
  assert.deepEqual([...game.flag],['q-enter']);assert.deepEqual([...game.items],['plate-healer']);
});
test('progress restores only banked checkpoint resources, with no respawn or elapsed-time inflation',()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,PROGRESS_KEY);raw=value;}};
  const saves=new ProgressStore(storage),game=new Runner(DISTRICT);
  game.items.add('plate-healer');game.flag.add('q-enter');game.x=12999;game.y=606;game.update(1/120);saves.save(game);
  const data=saves.load(DISTRICT);assert.ok(data);const restored=new Runner(DISTRICT);saves.restore(restored,data);
  assert.equal(restored.x,13000);assert.deepEqual([...restored.items],['plate-healer']);assert.equal(restored.respawns,game.respawns);assert.equal(restored.elapsed,game.elapsed);
  restored.items.add('plate-bell');saves.save(restored);assert.deepEqual(saves.load(DISTRICT).items,['plate-healer']);
  for(const value of ['bad',JSON.stringify({version:99,levels:{}}),JSON.stringify({version:1,levels:{district:{...data,items:['plate-ferry']}}})]){raw=value;assert.equal(saves.load(DISTRICT),null);}
  const denied=new ProgressStore({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});assert.doesNotThrow(()=>denied.save(game));assert.equal(denied.load(DISTRICT),null);
});

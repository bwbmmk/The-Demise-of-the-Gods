import test from 'node:test';
import assert from 'node:assert/strict';
import { Cinematic, flameStrength, SCENE_DURATIONS } from '../src/cinematics.js';
import { Narrative, MEMORY_ENTRIES, JOURNAL_KEY } from '../src/narrative.js';
import { ribbonMesh } from '../src/ribbon.js';
import { Runner } from '../src/physics.js';

test('health gives distinct decreasing flame sizes and extinguishes at zero',()=>{
  assert.deepEqual([3,2,1,0].map(flameStrength),[1,.68,.36,0]);
  assert.equal(flameStrength(-1),0);assert.equal(flameStrength(4),1);
});
test('arrival, defeat and departure complete with appropriate final poses',()=>{
  for(const type of Object.keys(SCENE_DURATIONS)){
    const scene=new Cinematic();scene.begin(type);assert.equal(scene.update(0),false);
    assert.equal(scene.update(SCENE_DURATIONS[type]),true);
    const end=scene.sample();assert.equal(end.q,1);
    if(type==='arrival'){assert.equal(Math.abs(end.offsetY),0);assert.equal(end.flame,1);assert.equal(end.collapse,0);}
    else {assert.equal(end.alpha,0);assert.equal(end.flame,0);}
    if(type==='departure'){assert.equal(end.offsetX,170);assert.equal(end.gate,0);}
    scene.cancel();assert.equal(scene.sample(),null);
  }
});
test('pause, skip and once-only cues do not advance game simulation or score',()=>{
  const game=new Runner(),before=JSON.stringify(game),scene=new Cinematic();scene.begin('arrival');
  scene.update(1.4);const pose=scene.sample();scene.update(0);assert.deepEqual(scene.sample(),pose);
  assert.equal(scene.takeCue('land',.42),true);assert.equal(scene.takeCue('land',.42),false);
  scene.skip();assert.equal(scene.sample().q,1);assert.equal(JSON.stringify(game),before);
  scene.begin('arrival',{reducedMotion:true});assert.equal(scene.sample().offsetY,0);
});
test('main story unlocks in route order without requiring optional rings',()=>{
  const story=new Narrative();story.advance(799);assert.deepEqual([...story.unlocked],['p0']);
  story.advance(800);assert.ok(story.unlocked.has('p1'));assert.ok(!story.unlocked.has('p2'));
  story.advance(27600);assert.equal(story.count,8);assert.ok(!story.unlocked.has('p8'));
  story.unlock('p8',false);assert.equal(story.count,9);assert.ok(![...story.unlocked].some(id=>id.startsWith('r')));
  assert.equal(story.quest(9200).label,'穿过无声圣所');assert.equal(story.quest(18400).label,'抵达无名之门遗址');
});
test('checkpoint backtracking never duplicates queued memories; replay preserves archive',()=>{
  const story=new Narrative();story.advance(4400);const count=story.queue.length;
  story.advance(0);story.advance(4400);assert.equal(story.queue.length,count);
  story.resetRun();assert.equal(story.count,3);assert.equal(story.queue.length,0);
  story.advance(0);assert.equal(story.queue.length,1);story.ring('ring-1');story.ring('ring-1');
  assert.ok(story.unlocked.has('r1'));assert.equal(story.queue.length,2);
});
test('journal persists stable ids and rejects corrupt, unknown and future saves',()=>{
  let value=null;const storage={getItem:key=>{assert.equal(key,JOURNAL_KEY);return value;},setItem:(key,data)=>{value=data;}};
  const story=new Narrative(storage);story.advance(4400);assert.equal(new Narrative(storage).count,3);
  value=JSON.stringify({version:1,ids:['p1','p1','unknown']});assert.equal(new Narrative(storage).count,1);
  for(const data of ['bad json',JSON.stringify({version:9,ids:['p1']})]){value=data;assert.equal(new Narrative(storage).count,0);}
  const denied=new Narrative({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});denied.advance(4400);assert.equal(denied.count,3);
  assert.equal(new Set(MEMORY_ENTRIES.map(e=>e.id)).size,MEMORY_ENTRIES.length);
});
test('ribbon handles empty, coincident and moving samples without NaN or mutation',()=>{
  assert.deepEqual(ribbonMesh([],0),{center:[],left:[],right:[]});
  for(const points of [[[2,2],[2,2]],Array.from({length:96},(_,i)=>[i*3,Math.sin(i/9)*30])]){
    const before=JSON.stringify(points),mesh=ribbonMesh(points,100);
    assert.ok(mesh.center.length<=286);assert.equal(mesh.left.length,mesh.right.length);
    assert.ok([...mesh.center,...mesh.left,...mesh.right].flat().every(Number.isFinite));
    assert.equal(JSON.stringify(points),before);assert.deepEqual(mesh.center.at(-1),points.at(-1));
  }
});
test('ribbon narrows at low health and reduced motion removes flutter',()=>{
  const points=[[0,0],[10,0],[20,0]],full=ribbonMesh(points,1,1,true),weak=ribbonMesh(points,1,.36,true);
  assert.ok(full.left[3][1]>weak.left[3][1]);assert.ok(full.center.every(p=>p[1]===0));
  assert.ok(ribbonMesh(points,1,1,false).center.some(p=>p[1]!==0));
});

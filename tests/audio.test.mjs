import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Soundscape} from '../src/audio.js';
import {AUDIO_CLIPS,loadAudioClip} from '../src/audio-clips.js';

function mockAudio(){
  const param=()=>({value:1,target:1,setValueAtTime(v){this.target=v;},setTargetAtTime(v){this.target=v;},cancelScheduledValues(){}});
  const sources=[];
  const ctx={currentTime:10,createGain:()=>({gain:param(),connect(){},disconnect(){}}),
    createBufferSource(){const node={started:false,stopped:false,connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(node);return node;}};
  const audio=new Soundscape();audio.ctx=ctx;audio.enabled=true;
  for(const key of ['music','effects','readingBus','scoreBus'])audio[key]=ctx.createGain();
  for(const id of Object.keys(AUDIO_CLIPS))audio.clipCache.set(id,Promise.resolve({duration:AUDIO_CLIPS[id].duration}));
  return{audio,ctx,sources};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('final battle music escalates independently, ending resolves it, and switching resets the score cursor',()=>{
  const {audio}=mockAudio();audio.setFinalScore(0);const first=audio.events.filter(e=>e.voice==='drum').length;
  audio.cursor=8;audio.cycle=3;audio.setFinalScore(2);
  assert.ok(audio.events.filter(e=>e.voice==='drum').length>first);assert.equal(audio.scoreBpm,116);assert.equal(audio.cursor,0);assert.equal(audio.cycle,0);
  audio.setFinalScore(0,true);assert.equal(audio.scoreBpm,64);assert.ok(!audio.events.some(e=>e.voice==='drum'));
  assert.ok(audio.events.every(e=>Number.isFinite(e.note)&&e.duration>0&&e.gain>0));
  audio.setFinalScore(null);assert.equal(audio.scoreBpm,84);assert.equal(audio.scoreKey,'normal');
});

test('edited cues are bounded PCM with quiet ends, headroom and traceable sources',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/music/selected/manifest.json',import.meta.url)));
  assert.equal(manifest.length,5);
  for(const entry of manifest){
    const data=readFileSync(new URL('../assets/music/selected/'+entry.file,import.meta.url));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt16LE(22),1);assert.equal(data.readUInt32LE(24),22050);
    assert.ok(Math.abs((data.length-44)/44100-AUDIO_CLIPS[entry.id].duration)<.002);
    assert.equal(data.readInt16LE(44),0);assert.ok(Math.abs(data.readInt16LE(data.length-2))<20);
    assert.ok(entry.peak>.01&&entry.peak<.6);assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
  }
});
test('opening a journal while paused plays reading music and restores original mix on close',async()=>{
  const{audio,sources}=mockAudio();audio.pause(true);audio.setJournal(true);await settle();
  assert.equal(audio.music.gain.target,.55);assert.equal(audio.scoreBus.gain.target,.04);
  assert.equal(sources.length,1);assert.equal(sources[0].loop,true);
  audio.setJournal(false);assert.equal(sources[0].stopped,true);assert.ok(Math.abs(audio.music.gain.target-.11)<1e-9);
  audio.pause(false);assert.equal(audio.scoreBus.gain.target,1);assert.equal(audio.music.gain.target,.55);
});
test('pending reading audio cannot start after the archive is closed',async()=>{
  const{audio,sources}=mockAudio();let release;audio.clipCache.set('journal',new Promise(r=>release=r));
  audio.setJournal(true);audio.setJournal(false);release({});await settle();assert.equal(sources.length,0);
});
test('pending result cue is discarded when a run is restarted',async()=>{
  const{audio,sources}=mockAudio();let release;audio.clipCache.set('defeat',new Promise(r=>release=r));
  const pending=audio.playStinger('defeat');audio.resetPresentation();release({});await pending;assert.equal(sources.length,0);
});
test('muting, pause and journal prevent cues; repeated cues replace rather than stack',async()=>{
  const{audio,ctx,sources}=mockAudio();audio.enabled=false;await audio.playStinger('victory');assert.equal(sources.length,0);
  audio.enabled=true;audio.pause(true);await audio.playStinger('victory');assert.equal(sources.length,0);
  audio.pause(false);await audio.playStinger('victory');await audio.playStinger('victory');assert.equal(sources.length,1);
  ctx.currentTime+=2;await audio.playStinger('resonance');assert.equal(sources.length,2);assert.equal(sources[0].stopped,true);
  audio.resetPresentation();assert.equal(sources[1].stopped,true);
});
test('ending screens allow existing cue tails; a real pause silences them',async()=>{
  const{audio,sources}=mockAudio();await audio.playStinger('defeat');assert.equal(audio.scoreBus.gain.target,.78);
  audio.pause(true,true);assert.equal(audio.effects.gain.target,.6);
  audio.pause(true);assert.equal(audio.effects.gain.target,0);
  sources[0].onended();assert.equal(audio.clipNodes.size,0);assert.equal(audio.scoreBus.gain.target,1);
});
test('offline HTML embeds exactly the five selected WAV files',()=>{
  const html=readFileSync(new URL('../神之殇-demo.html',import.meta.url),'utf8');
  const match=html.match(/const EMBEDDED_AUDIO = (\{[^\n]+\});/);assert.ok(match);
  const embedded=JSON.parse(match[1]);assert.deepEqual(Object.keys(embedded).sort(),Object.keys(AUDIO_CLIPS).sort());
  for(const [id,data]of Object.entries(embedded))assert.deepEqual(Buffer.from(data,'base64'),readFileSync(new URL('../assets/music/selected/'+AUDIO_CLIPS[id].file,import.meta.url)));
});
test('decoding cache shares concurrent work and safely retries failed file loads',async()=>{
  const original=globalThis.fetch;let calls=0,decodes=0,fail=false;const cache=new Map();
  globalThis.fetch=async()=>{calls++;return {ok:!fail,arrayBuffer:async()=>new ArrayBuffer(44)};};
  const ctx={decodeAudioData:async()=>{decodes++;return {duration:3.4};}};
  try{
    const[a,b]=await Promise.all([loadAudioClip(ctx,'transition',cache),loadAudioClip(ctx,'transition',cache)]);
    assert.equal(a,b);assert.equal(calls,1);assert.equal(decodes,1);
    fail=true;await assert.rejects(loadAudioClip(ctx,'defeat',cache));assert.ok(!cache.has('defeat'));
    fail=false;await loadAudioClip(ctx,'defeat',cache);assert.equal(calls,3);
  }finally{globalThis.fetch=original;}
});

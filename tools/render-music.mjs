import {mkdir,writeFile} from 'node:fs/promises';
import {SCORE,scoreEvents,noteHz,scoreSample} from '../src/music.js';
const rate=22050,beat=60/SCORE.bpm,length=Math.ceil((SCORE.beats*beat+4)*rate),samples=new Float32Array(length);
for(const event of scoreEvents()) {
  const start=Math.round(event.beat*beat*rate),duration=event.duration*beat,end=Math.min(length,start+Math.ceil(duration*rate));
  for(let i=start;i<end;i++)samples[i]+=scoreSample(event.voice,noteHz(event.note),(i-start)/rate,duration)*event.gain;
}
const delay=Math.round(beat*.75*rate);for(let i=delay;i<length;i++)samples[i]+=samples[i-delay]*.2;
let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
const data=Buffer.alloc(44+length*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(length*2,40);
for(let i=0;i<length;i++){const fade=Math.min(1,i/(rate*1.2),(length-i)/(rate*3));data.writeInt16LE(Math.round(samples[i]/Math.max(.01,peak)*.82*fade*32767),44+i*2);}
await mkdir(new URL('../assets/music/',import.meta.url),{recursive:true});await writeFile(new URL('../assets/music/ember-requiem.wav',import.meta.url),data);
console.log(`葬火：${(length/rate).toFixed(1)} 秒，峰值归一化至 -1.7 dBFS，22.05kHz PCM WAV。`);

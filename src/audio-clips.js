// Embedded only by the offline builder. Development uses the same edited local WAVs.
export const EMBEDDED_AUDIO = null;
export const AUDIO_CLIPS = {
  journal:{title:'抄名人之歌',file:'journal.wav',duration:34.2857,gain:.75,loop:true},
  transition:{title:'章末低鸣',file:'transition.wav',duration:3.4,gain:.40},
  resonance:{title:'有人在念你的名字',file:'resonance.wav',duration:6.4,gain:.46},
  defeat:{title:'余火散入灰烬',file:'defeat.wav',duration:6,gain:.52},
  victory:{title:'一粒火种归入掌心',file:'victory.wav',duration:8,gain:.46},
};

export async function loadAudioClip(ctx,id,cache) {
  if(!AUDIO_CLIPS[id])throw new Error('Unknown audio clip');
  if(cache.has(id))return cache.get(id);
  const pending=(async()=>{
    let data;
    if(EMBEDDED_AUDIO?.[id]){
      const raw=atob(EMBEDDED_AUDIO[id]),bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      data=bytes.buffer;
    }else{
      const response=await fetch(new URL(`../assets/music/selected/${AUDIO_CLIPS[id].file}`,import.meta.url));
      if(!response.ok)throw new Error('Audio clip unavailable');
      data=await response.arrayBuffer();
    }
    return ctx.decodeAudioData(data);
  })();
  cache.set(id,pending);
  try{return await pending;}catch(error){cache.delete(id);throw error;}
}

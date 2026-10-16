// Make a portable, silent motion-storyboard from the two generated paintings.
// It is camera/particle animation, not model-generated character animation.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const base=path.resolve('.verify/film-profile-v2');
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9337','--user-data-dir='+base,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws;
try{
  let tab;for(let i=0;i<30;i++){try{tab=(await(await fetch('http://127.0.0.1:9337/json')).json())[0];if(tab)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!tab)throw new Error('Chrome recorder unavailable');
  ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  const send=(method,params)=>new Promise(resolve=>{const id=++seq;pending.set(id,resolve);ws.send(JSON.stringify({id,method,params}));});
  const sources=['transfer','embers'].map(id=>'data:image/jpeg;base64,'+fs.readFileSync('assets/ending/'+id+'.jpg').toString('base64'));
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const sources=${JSON.stringify(sources)};
    const images=await Promise.all(sources.map(src=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>{throw new Error('image load failed')};i.src=src;})));
    const c=document.createElement('canvas');c.width=1280;c.height=720;document.body.append(c);const ctx=c.getContext('2d');
    const stream=c.captureStream(30),chunks=[];
    const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1600000});
    const done=new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};});
    rec.start();const start=performance.now();
    await new Promise(resolve=>{function frame(now){const t=(now-start)/1000,index=t<8?0:1,local=index?t-8:t,zoom=1.03+local*.006;
      ctx.fillStyle='#08141c';ctx.fillRect(0,0,1280,720);ctx.save();ctx.globalAlpha=Math.min(1,t/1.5,(18-t)/2);ctx.translate(640,360);ctx.scale(zoom,zoom);ctx.drawImage(images[index],-640,-360,1280,720);ctx.restore();
      if(t>7&&t<9){ctx.fillStyle='rgba(8,20,28,'+(1-Math.abs(t-8))+')';ctx.fillRect(0,0,1280,720);}
      for(let i=0;i<65;i++){const x=(i*127+t*23)%1280,y=720-((i*81+t*21)%760);ctx.fillStyle='rgba(239,193,104,'+(.15+Math.sin(i+t)*.12)+')';ctx.fillRect(x,y,2,2);}
      ctx.fillStyle='#08141c';ctx.fillRect(0,0,1280,42);ctx.fillRect(0,678,1280,42);
      if(t<18)setTimeout(()=>frame(performance.now()),33);else{rec.stop();resolve();}}
      setTimeout(()=>frame(performance.now()),33);});return await done;
  })()`});
  if(result.result.exceptionDetails)throw new Error(JSON.stringify(result.result.exceptionDetails));
  const data=result.result.result.value;if(!data)throw new Error('Empty recording');
  fs.writeFileSync('assets/ending/epilogue.webm',Buffer.from(data,'base64'));console.log('Recorded assets/ending/epilogue.webm',fs.statSync('assets/ending/epilogue.webm').size);
}finally{ws?.close();child.kill();}

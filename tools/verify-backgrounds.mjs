// 比较正式离线包中的同一帧，输出原背景 / 采用后的远景。
// Chrome 读取 Canvas 原像素；不靠黑屏截图，也不写玩家存档。
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {runChrome} from './run-chrome.mjs';

const bgQaRoot=path.resolve(import.meta.dirname,'..'),bgQaDir=path.join(bgQaRoot,'.verify');
mkdirSync(bgQaDir,{recursive:true});
const bgQaBundle=readFileSync(path.join(bgQaRoot,'神之殇-demo.html'),'utf8');
const bgQaFixture=bgQaBundle.replace('<head>','<head><script>window.requestAnimationFrame=()=>0;window.__bgErrors=[];addEventListener("error",e=>__bgErrors.push(e.message));</script>')
  .replace('const narrative=new Narrative(journalStorage);','journalStorage={getItem:()=>null,setItem:()=>{}};const narrative=new Narrative(journalStorage);')
  .replace('const storage=()=>{try{return window.localStorage;}catch{return null;}};','const storage=()=>null;');
const bgQaProbe=String.raw`
const bgChecks=[],bgSheets=[];
function bgAssert(condition,label){if(!condition)throw Error(label);bgChecks.push(label);}
function bgSnapshot(){return JSON.stringify({x:game.x,y:game.y,health:game.health,elapsed:game.elapsed,checkpoint:game.checkpoint,flag:[...game.flag],light:game.echoLight,boss:game.boss,stones:game.level.echoPlatforms,walls:game.level.echoWalls});}
function bgCapture(){
  const canvas=$('game');renderer.render(0,game,'running',1);
  const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);return copy;
}
try{
  setMode('running');renderer.reducedMotion=true;renderer.trail=[];renderer.particles=[];renderer.time=20;
  // 两帧关闭同一份随机脚下扬尘，否则随机粒子会冒充背景像素差异。
  renderer.burst=()=>{};
  const specs=[
    ['district',DISTRICT,[3000,16000,28200,43000]],
    ['covenant',COVENANT,[6200,20600,31800,43000]],
    ['fate',FATE,[7100,15800,27400,34400]],
  ];
  for(const [id,level,positions] of specs){
    loadLevel(level);game.elapsed=20;game.setEcho(true);
    const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=28+positions.length*433;
    const sc=sheet.getContext('2d');sc.fillStyle='#0c1820';sc.fillRect(0,0,sheet.width,sheet.height);
    sc.fillStyle='#d1c4a6';sc.font='16px serif';sc.fillText('原背景',20,20);sc.fillText('选用后的远景',740,20);
    for(const [row,x] of positions.entries()){
      game.x=game.prevX=x;game.y=game.prevY=game.groundAt(x);game.chapter=level.chapters.reduce((i,c,j)=>x>=c.at?j:i,0);
      renderer.flash=renderer.goldFlash=renderer.shake=0;
      const before=bgSnapshot();renderer.backgroundDepth.enabled=false;const old=bgCapture();
      renderer.backgroundDepth.enabled=true;const selected=bgCapture();
      const oldData=old.getContext('2d').getImageData(0,0,old.width,old.height).data;
      const newData=selected.getContext('2d').getImageData(0,0,selected.width,selected.height).data;
      let changed=0,foreground=0;const safeTop=Math.ceil(old.height*460/810);
      for(let py=0;py<old.height;py++)for(let px=0;px<old.width;px++){
        const i=(py*old.width+px)*4;
        if(oldData[i]!==newData[i]||oldData[i+1]!==newData[i+1]||oldData[i+2]!==newData[i+2]){changed++;if(py>=safeTop)foreground++;}
      }
      const name=level.scenery[game.chapter];
      bgAssert(changed>500,'远景实际可见 / '+name);bgAssert(foreground===0,'路面与实体像素保持清楚 / '+name);
      bgAssert(before===bgSnapshot(),'背景绘制不改变模拟与地图 / '+name);
      sc.drawImage(old,0,28+row*433,720,405);sc.drawImage(selected,720,28+row*433,720,405);
      sc.fillStyle='#d1c4a6';sc.fillText(name+' · x'+x+' · 前景差异 '+foreground,20,452+row*433);
    }
    bgSheets.push({id,data:sheet.toDataURL('image/png')});
  }
  const cacheSize=renderer.backgroundDepth.tiles.size;
  for(let d=0;d<45000;d+=310)renderer.backgroundDepth.draw(renderer.ctx,renderer.width,d,'fateArchive');
  bgAssert(renderer.backgroundDepth.tiles.size===cacheSize,'滚动不会无限增加远景缓存');
  const pre=document.createElement('pre');pre.textContent='@@BG@@'+JSON.stringify({ok:true,checks:bgChecks,errors:window.__bgErrors,sheets:bgSheets})+'@@ENDBG@@';document.body.append(pre);
}catch(error){const pre=document.createElement('pre');pre.textContent='@@BG@@'+JSON.stringify({ok:false,error:error.message,checks:bgChecks,errors:window.__bgErrors})+'@@ENDBG@@';document.body.append(pre);}
`;
const bgQaEnd=bgQaFixture.lastIndexOf('</script>'),bgQaFile=path.join(bgQaDir,'background-depth.html');
writeFileSync(bgQaFile,bgQaFixture.slice(0,bgQaEnd)+bgQaProbe+bgQaFixture.slice(bgQaEnd));
const bgSmall=process.argv.includes('--small');
const bgQaDom=runChrome(['--headless=new','--disable-gpu','--no-first-run','--allow-file-access-from-files','--window-size='+(bgSmall?'960,600':'1440,900'),'--user-data-dir='+path.join(bgQaDir,'background-profile'),'--virtual-time-budget=2000','--dump-dom',pathToFileURL(bgQaFile).href]);
const bgQaMatch=bgQaDom.match(/@@BG@@({[\s\S]*?})@@ENDBG@@/);
if(!bgQaMatch)throw Error('背景检查未结束');
const bgQaReport=JSON.parse(bgQaMatch[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
const bgQaShots=bgQaReport.sheets||[];delete bgQaReport.sheets;
for(const {id,data} of bgQaShots){
  const out=path.join(bgQaRoot,'docs/screenshots','background-compare-'+id+(bgSmall?'-small':'')+'.png');
  writeFileSync(out,Buffer.from(data.split(',')[1],'base64'));console.log(out);
}
writeFileSync(path.join(bgQaDir,'background-depth-report'+(bgSmall?'-small':'')+'.json'),JSON.stringify(bgQaReport,null,2));
console.log(bgQaReport);if(!bgQaReport.ok||bgQaReport.errors.length)process.exit(1);

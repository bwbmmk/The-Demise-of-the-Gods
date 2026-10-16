// 从 visual-kit 对照图选取远景层次和屋窗灯火，按现有拱城重绘。
// 所有形状留在 y <= 450 的远景里，不接触跑道、照忆石台与预警。
const BG_DEPTH_WIDTH=2048;
const BG_DEPTH_SCENES={
  quarter:       {kind:'town',far:'#666858',near:'#55584c',fog:'#b7aa86',warm:.55},
  bellTower:     {kind:'town',far:'#505964',near:'#424954',fog:'#9dabb3',warm:.22},
  ferry:         {kind:'coast',far:'#697b80',near:'#51656f',fog:'#c0cfcc',warm:.08},
  nameBridge:    {kind:'coast',far:'#587680',near:'#3c5968',fog:'#a9c2c2',warm:.04},
  windArchive:   {kind:'upland',far:'#80a49f',near:'#607f89',fog:'#d0dfca',warm:0},
  tideHarbor:    {kind:'coast',far:'#75a8ac',near:'#487c91',fog:'#c6e3da',warm:.05},
  harvestGranary:{kind:'town',far:'#a3a385',near:'#7d8976',fog:'#ded4aa',warm:.10},
  sealGate:      {kind:'ruin',far:'#869b9d',near:'#657789',fog:'#c3d3c6',warm:0},
  fateArchive:   {kind:'ruin',far:'#8aadb0',near:'#617d8e',fog:'#d0ddd2',warm:0},
  warGate:       {kind:'ruin',far:'#af9d95',near:'#8a7b84',fog:'#ddcdb5',warm:0},
  namePyre:      {kind:'ruin',far:'#9aaca8',near:'#6a828a',fog:'#d0d6c2',warm:0},
  greyRefuge:    {kind:'ruin',far:'#8caaa9',near:'#637c8b',fog:'#c8d9cc',warm:0},
  // 第四幕：前段是还亮着灯的人间（镇），后段是正在被点亮、又正在烧尽的王城（废墟）。
  refugeHall:    {kind:'town',far:'#7d8474',near:'#5d6559',fog:'#c6bfa2',warm:.62},
  courtRoad:     {kind:'town',far:'#5f6774',near:'#464e5b',fog:'#aab4b8',warm:.26},
  throneCity:    {kind:'ruin',far:'#c09a7e',near:'#8a6b5f',fog:'#e6c79c',warm:.34},
  dawnChest:     {kind:'ruin',far:'#d3ae82',near:'#94735c',fog:'#f0d5a6',warm:.48},
};
function bgDepthNoise(n){const s=Math.sin(n*83.17+19.3)*29173.7;return s-Math.floor(s);}
function bgDepthPolygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}

export class BackgroundDepth {
  constructor(){this.enabled=true;this.tiles=new Map();}
  tile(kind,layer){
    const key=kind+layer;if(this.tiles.has(key))return this.tiles.get(key);
    const seed={town:17,coast:63,upland:109,ruin:167}[kind]+layer*47;
    const blocks=[];
    // 循环几何只生成一次；不跟随每帧时间生成、不在滚动中累积对象。
    for(let i=0;i<12;i++){
      const n=seed+i*7,width=45+bgDepthNoise(n+1)*65;
      blocks.push({x:i*BG_DEPTH_WIDTH/12+bgDepthNoise(n)*30,width,height:45+bgDepthNoise(n+2)*(layer?133:89),
        broken:bgDepthNoise(n+3)>.42,lit:bgDepthNoise(n+4),roof:bgDepthNoise(n+5)*17+6});
    }
    const ridge=Array.from({length:17},(_,i)=>[i*128,25+bgDepthNoise(seed+i+301)*65]);
    ridge[16][1]=ridge[0][1];
    const tile={blocks,ridge};this.tiles.set(key,tile);return tile;
  }
  draw(c,w,distance,name){
    const style=BG_DEPTH_SCENES[name];if(!this.enabled||!style)return;
    c.save();c.beginPath();c.rect(0,0,w,450);c.clip();
    const inheritedAlpha=c.globalAlpha;
    for(let layer=0;layer<2;layer++){
      const tile=this.tile(style.kind,layer),factor=layer?.055:.026;
      const shift=((distance*factor)%BG_DEPTH_WIDTH+BG_DEPTH_WIDTH)%BG_DEPTH_WIDTH;
      const base=layer?443:386;
      c.globalAlpha=inheritedAlpha*(layer?.38:.28);
      const color=layer?style.near:style.far;
      const silhouette=c.createLinearGradient(0,base-180,0,base);
      silhouette.addColorStop(0,color);silhouette.addColorStop(.40,color);silhouette.addColorStop(1,color+'00');c.fillStyle=silhouette;
      for(let origin=-shift-BG_DEPTH_WIDTH;origin<w;origin+=BG_DEPTH_WIDTH){
        // 海岸与高坡的轮廓比城区更疏，让风和水仍然占据画面。
        bgDepthPolygon(c,[[origin,base],...tile.ridge.map(([x,y])=>[origin+x,base-y]),[origin+BG_DEPTH_WIDTH,base]]);
        for(const [i,b] of tile.blocks.entries()){
          if(style.kind==='upland'&&i%4!==0||style.kind==='coast'&&i%3!==0)continue;
          const x=origin+b.x,y=base-b.height;
          if(x+b.width<0||x>w)continue;
          if(style.kind==='ruin'){
            const broken=b.broken?[[x,y],[x+b.width*.24,y+b.roof],[x+b.width*.35,y-14],[x+b.width*.46,y+21],[x+b.width*.70,y+8],[x+b.width,y+19]]
              :[[x,y+18],[x+9,y+18],[x+9,y],[x+b.width*.7,y],[x+b.width*.7,y+14],[x+b.width,y+14]];
            bgDepthPolygon(c,[[x,base],...broken,[x+b.width,base]]);
            // 断拱只出现在高处；不在缺口下画似乎能落脚的横台。
            if(b.broken){c.lineWidth=5;c.strokeStyle=c.fillStyle;c.beginPath();c.arc(x+b.width+16,y+62,23,Math.PI,Math.PI*1.83);c.stroke();}
          }else if(style.kind==='upland'){
            bgDepthPolygon(c,[[x,base],[x+10,y+35],[x+b.width*.55,y],[x+b.width*.72,y+25],[x+b.width,base]]);
          }else{
            bgDepthPolygon(c,[[x,base],[x,y],[x+b.width*.5,y-b.roof],[x+b.width,y+3],[x+b.width,base]]);
            if(layer&&b.lit<style.warm){
              // 灯嵌在屋窗内，和该房屋一起做视差；不是悬在跑道上的拾取物。
              const wx=x+b.width*.45,wy=y+25;
              c.save();c.globalAlpha=inheritedAlpha*.35;c.fillStyle='#cba66d';c.fillRect(wx,wy,5,10);
              const glow=c.createRadialGradient(wx+2,wy+5,0,wx+2,wy+5,17);
              glow.addColorStop(0,'#d5ac7330');glow.addColorStop(1,'#d5ac7300');c.fillStyle=glow;c.fillRect(wx-15,wy-12,34,34);c.restore();
            }
          }
        }
      }
    }
    // 雾只淡化远处墙脚，不盖住角色高度、路面或危险轮廓。
    c.globalAlpha=inheritedAlpha*.045;
    const fog=c.createLinearGradient(0,310,0,450);fog.addColorStop(0,style.fog+'00');fog.addColorStop(.7,style.fog);fog.addColorStop(1,style.fog+'00');
    c.fillStyle=fog;c.fillRect(0,310,w,140);c.restore();
  }
}

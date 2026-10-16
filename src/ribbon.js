// Catmull–Rom 中心线 → 有厚度的连续丝带；数值和采样数均有上限。
export function ribbonMesh(points,time,strength=1,reducedMotion=false) {
  if(points.length<2)return {center:[],left:[],right:[]};
  const center=[];
  for(let i=0;i<points.length-1;i++) {
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    for(let j=0;j<3;j++){const t=j/3,t2=t*t,t3=t2*t;center.push([0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)));}
  }
  center.push([...points.at(-1)]);
  const left=[],right=[],curve=center.map(p=>[...p]);
  for(let i=0;i<center.length;i++) {
    const q=i/(center.length-1),a=curve[Math.max(0,i-1)],b=curve[Math.min(center.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    const flutter=reducedMotion?0:Math.sin(time*8-q*11)*(1-q)*8*Math.sin(Math.PI*q);
    const width=Math.sin(Math.PI*q*.94)*(.6+4.8*strength)*(1+.2*Math.sin(time*5-q*12));
    center[i]=[center[i][0]+nx*flutter,center[i][1]+ny*flutter];
    left.push([center[i][0]+nx*width,center[i][1]+ny*width]);right.push([center[i][0]-nx*width,center[i][1]-ny*width]);
  }
  return {center,left,right};
}

// Merge raster strips into continuous contours and remove subpixel tracing noise.
export function smoothWantFont(wantFont){
if(wantFont.glyphs.O.path.some(p=>p[0]==='C'))return wantFont;
const old=structuredClone(wantFont),mask=new Set(),W=540,H=190;
for(let i=0;i<old.glyphs.O.path.length;i+=5){const a=old.glyphs.O.path[i],b=old.glyphs.O.path[i+1];for(let x=a[1];x<b[1];x++)mask.add((H-a[2])*W+x);}
const edges=new Map(),key=(x,y)=>`${x},${y}`,on=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&mask.has(y*W+x);
function edge(x,y,a,b){const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);}
for(const n of mask){const x=n%W,y=Math.floor(n/W);if(!on(x,y-1))edge(x,y,x+1,y);if(!on(x+1,y))edge(x+1,y,x+1,y+1);if(!on(x,y+1))edge(x+1,y+1,x,y+1);if(!on(x-1,y))edge(x,y+1,x,y);}
const path=[];let contours=0;
while(edges.size){const first=edges.keys().next().value,start=first.split(',').map(Number),pts=[start];let cur=start;
 do{const k=key(...cur),ends=edges.get(k);if(!ends)throw Error('Open contour');cur=ends.pop();if(!ends.length)edges.delete(k);pts.push(cur);}while(key(...cur)!==first);
 const compact=pts.slice(0,-1).filter((p,i,arr)=>{const a=arr[(i+arr.length-1)%arr.length],b=arr[(i+1)%arr.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
 function simplify(ps){if(ps.length<=2)return ps;const a=ps[0],b=ps.at(-1),dx=b[0]-a[0],dy=b[1]-a[1];let max=0,at=0;for(let i=1;i<ps.length-1;i++){const p=ps[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d>max){max=d;at=i;}}return max>1.2?[...simplify(ps.slice(0,at+1)).slice(0,-1),...simplify(ps.slice(at))]:[a,b];}
 const mid=Math.floor(compact.length/2),points=[...simplify(compact.slice(0,mid+1)).slice(0,-1),...simplify([...compact.slice(mid),compact[0]]).slice(0,-1)];
 const get=i=>points[(i+points.length)%points.length],sharp=i=>{const a=get(i-1),p=get(i),b=get(i+1),u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]];return (u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))<.75;};
 path.push(['M',points[0][0],H-points[0][1]]);
 for(let i=0;i<points.length;i++){const a=get(i-1),p=get(i),q=get(i+1),b=get(i+2),c1=sharp(i)?p:[p[0]+(q[0]-a[0])/6,p[1]+(q[1]-a[1])/6],c2=sharp(i+1)?q:[q[0]-(b[0]-p[0])/6,q[1]-(b[1]-p[1])/6];for(const c of [c1,c2])for(let k=0;k<2;k++)c[k]=Math.max(Math.min(p[k],q[k]),Math.min(Math.max(p[k],q[k]),c[k]));path.push(['C',c1[0],H-c1[1],c2[0],H-c2[1],q[0],H-q[1]]);}path.push(['Z']);contours++;
}
wantFont.glyphs.O.path=path;
return wantFont;
}

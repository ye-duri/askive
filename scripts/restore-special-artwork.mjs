import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brandRuns} from '../mac-print/public/calendar-layout.mjs';
const root=new URL('../dist/',import.meta.url).pathname;
const frames=JSON.parse(await readFile(root+'frames.json','utf8'));
const originalCatalog=JSON.parse(await readFile(new URL('../docs/special-original-catalog.json',import.meta.url),'utf8'));
const flow=JSON.parse(await readFile(new URL('../docs/calendar-frame-reflow.json',import.meta.url),'utf8'));

const ref=(await readFile(new URL('../branding/special/paper-approved-logo-reference.png',import.meta.url))).toString('base64');
const approvedFooter=(await readFile(new URL('../branding/special/paper-approved-footer.png',import.meta.url))).toString('base64');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();for(const f of frames.filter(f=>f.edition==='special'&&f.id!=='siwol-market-four')){
 const rec=flow.find(v=>v.id===f.id),of=originalCatalog.find(v=>v.id===f.id);
 const source=(await readFile(root+rec.oldSrc)).toString('base64');
 let protect=[];try{const svg=await readFile(root+'frames/'+f.id+'.svg','utf8');for(const m of svg.matchAll(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g))protect.push(m.slice(1).map(Number));for(const m of svg.matchAll(/transform="translate\(([\d.]+) ([\d.]+)\)"/g))protect.push([+m[1]-38,+m[2]-38,76,76]);}catch{}
 const result=await page.evaluate(async({f,of,rec,source,ref,approvedFooter,runs,protect})=>{
 const load=async b=>{const i=new Image();i.src='data:image/png;base64,'+b;await i.decode();return i;};
 const im=await load(source),wide=im.width>im.height;const work=document.createElement('canvas');work.width=wide?im.height:im.width;work.height=wide?im.width:im.height;const w=work.getContext('2d');if(wide){w.setTransform(0,1,1,0,0,0);}w.drawImage(im,0,0);w.resetTransform();
 const W=work.width,H=work.height;
 const bands=rec.bands.map(([y,h,add])=>{const forbidden=protect.map(p=>wide?[p[0]-5,p[0]+p[2]+5]:[p[1]-5,p[1]+p[3]+5]);let yy=y;for(let k=0;k<120;k++){const tryY=y+k;if(!forbidden.some(([a,b])=>tryY<b&&tryY+h>a)){yy=tryY;break;}}return[yy,h,add];});
 const dest=document.createElement('canvas');dest.width=W;dest.height=H+bands.reduce((n,b)=>n+b[2],0);const d=dest.getContext('2d');let sy=0,dy=0;
 // Keep source pixels at their original scale. Only insert mirrored texture strips.
 for(const [y,h,add]of bands){d.drawImage(work,0,sy,W,y+h-sy,0,dy,W,y+h-sy);dy+=y+h-sy;for(let row=0;row<add;row++){const phase=row%(h*2),sample=phase<h?y+h-1-phase:y+phase-h;d.drawImage(work,0,sample,W,1,0,dy+row,W,1);}dy+=add;sy=y+h;}
 d.drawImage(work,0,sy,W,H-sy,0,dy,W,H-sy);
 const c=document.createElement('canvas');c.width=wide?dest.height:dest.width;c.height=wide?dest.width:dest.height;const x=c.getContext('2d');if(wide)x.setTransform(0,1,1,0,0,0);x.drawImage(dest,0,0);x.resetTransform();
 const base=c.toDataURL().split(',')[1];
 const mapped=y=>y+bands.reduce((sum,[start,h,add])=>sum+(y>=start+h?add:0),0);
 const slots=of.slots.map(([a,b,sw,sh])=>wide?[mapped(a*im.width)/c.width,b,(mapped((a+sw)*im.width)-mapped(a*im.width))/c.width,sh]:[a,mapped(b*im.height)/c.height,sw,(mapped((b+sh)*im.height)-mapped(b*im.height))/c.height]);
 const paper=f.id.includes('paper'),green=f.id.includes('green');
 const logo=document.createElement('canvas');logo.width=1220;logo.height=300;const lc=logo.getContext('2d');lc.fillStyle=green?'white':paper?'#263a99':f.id.includes('friends')?'#9c4565':f.id.includes('club')?'#315582':'#495b40';for(const [xx,yy,ww,a]of runs){lc.globalAlpha=a/255;lc.fillRect(xx,yy,ww,1);}lc.globalAlpha=1;
 if(paper){
  // Reuse the approved sticker lettering and white contour, not a generated frame.
  const reference=await load(ref),sticker=document.createElement('canvas');sticker.width=365;sticker.height=140;const sc=sticker.getContext('2d');sc.drawImage(reference,278,1483,365,140,0,0,365,140);const px=sc.getImageData(0,0,365,140);for(let n=0;n<px.data.length;n+=4){const r=px.data[n],g=px.data[n+1],b=px.data[n+2];if(!(Math.min(r,g,b)>231||(b-r>45&&b-g>25)))px.data[n+3]=0;}const seen=new Uint8Array(365*140);let largest=[];for(let seed=0;seed<seen.length;seed++){if(seen[seed]||!px.data[seed*4+3])continue;const group=[seed];seen[seed]=1;for(let k=0;k<group.length;k++){const n=group[k],xx=n%365,yy=Math.floor(n/365);for(const next of [xx? n-1:-1,xx<364?n+1:-1,yy?n-365:-1,yy<139?n+365:-1])if(next>=0&&!seen[next]&&px.data[next*4+3]){seen[next]=1;group.push(next);}}if(group.length>largest.length)largest=group;}const keep=new Set(largest);for(let n=0;n<seen.length;n++)if(!keep.has(n))px.data[n*4+3]=0;sc.putImageData(px,0,0);
  const spec=wide?{box:[702,857,545,157],pos:[710,865,450]}:c.width===1200?{box:[423,1874,530,235],pos:[355,1898,474]}:{box:[369,1640,445,179],pos:[305,1645,400]};
  const [bx,by,bw,bh]=spec.box;
  const clean=x.getImageData(bx-15,by-15,bw+30,bh+30),cw=clean.width,ch=clean.height,cp=clean.data,mask=new Uint8Array(cw*ch);
  const candidates=new Uint8Array(cw*ch),visited=new Uint8Array(cw*ch),sw=wide?398:c.width===1200?370:309;
  const outline=[[.38,0],[.58,0],[.65,.18],[.87,.19],[1,.40],[.98,.65],[.85,.72],[.9,.88],[.65,1],[.25,1],[.06,.88],[.06,.66],[0,.53],[0,.32],[.2,.19],[.32,.15]];
  const outlineContains=(xx,yy)=>{const X=(xx-15)/sw,Y=(yy-15)/(wide?153:c.width===1200?224:166);let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const [a,b]=outline[i],[c,d]=outline[j];if((b>Y)!==(d>Y)&&X<(c-a)*(Y-b)/(d-b)+a)inside=!inside;}return inside;};
  for(let yy=15;yy<ch-15;yy++)for(let xx=15;xx<15+sw;xx++){const n=(yy*cw+xx)*4;if(outlineContains(xx,yy)&&(Math.min(cp[n],cp[n+1],cp[n+2])>232||(cp[n+2]-cp[n]>40&&cp[n+2]-cp[n+1]>25)))candidates[yy*cw+xx]=1;}
  let oldSticker=[];for(let seed=0;seed<candidates.length;seed++){if(!candidates[seed]||visited[seed])continue;const group=[seed];visited[seed]=1;for(let k=0;k<group.length;k++){const n=group[k],xx=n%cw,yy=Math.floor(n/cw);for(const next of [xx?n-1:-1,xx<cw-1?n+1:-1,yy?n-cw:-1,yy<ch-1?n+cw:-1])if(next>=0&&candidates[next]&&!visited[next]){visited[next]=1;group.push(next);}}if(group.length>oldSticker.length)oldSticker=group;}
  const glyphs=new Set(oldSticker);for(let yy=15;yy<ch-15;yy++)for(let xx=15+sw;xx<cw-15;xx++){const n=(yy*cw+xx)*4;if(cp[n+2]-cp[n]>40&&cp[n+2]-cp[n+1]>25)glyphs.add(yy*cw+xx);}
  for(const n of glyphs){const xx=n%cw,yy=Math.floor(n/cw);for(let sy=Math.max(0,yy-5);sy<=Math.min(ch-1,yy+5);sy++)for(let sx=Math.max(0,xx-5);sx<=Math.min(cw-1,xx+5);sx++)mask[sy*cw+sx]=1;}
  const old=new Uint8ClampedArray(cp);for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++){const n=yy*cw+xx;if(!mask[n])continue;const samples=[];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=1;k<600;k++){const sx=xx+k*dx,sy=yy+k*dy;if(sx<0||sy<0||sx>=cw||sy>=ch)break;const v=sy*cw+sx;if(!mask[v]&&old[v*4+3]===255&&Math.min(old[v*4],old[v*4+1],old[v*4+2])>140&&Math.max(old[v*4],old[v*4+1],old[v*4+2])<235){samples.push([v,1/k]);break;}}const sum=samples.reduce((s,v)=>s+v[1],0);if(sum)for(let q=0;q<3;q++)cp[n*4+q]=Math.round(samples.reduce((s,v)=>s+old[v[0]*4+q]*v[1],0)/sum);}
  x.putImageData(clean,bx-15,by-15);
  const [lx,ly,lw]=spec.pos;x.save();x.shadowColor='rgba(39,43,63,.25)';x.shadowBlur=3;x.shadowOffsetY=3;x.drawImage(sticker,lx,ly,lw,lw*140/365);x.restore();
  if(['hanmaeum-2026-daecheong-paper-four','hanmaeum-2026-daecheong-paper-six-portrait'].includes(f.id)){
   const cleanReference=await load(approvedFooter),fh=Math.round(192*c.width/941),top=f.id.endsWith('six-portrait')?1596:c.height-fh;
   x.clearRect(0,0,c.width,c.height);x.drawImage(dest,0,0);
   x.drawImage(cleanReference,0,1480,941,192,0,top,c.width,fh);
   if(f.id==='hanmaeum-2026-daecheong-paper-six-portrait')x.drawImage(dest,830,1460,201,184,830,1460,201,184);
  }
 }else if(green){const y=wide?860:c.width===1200?1860:1655;const color=x.getImageData(5,c.height-5,1,1).data;x.fillStyle=`rgb(${color[0]},${color[1]},${color[2]})`;x.fillRect(0,y,c.width,c.height-y);const lw=Math.min(c.width*.38,(c.height-y)*2.7);x.drawImage(logo,(c.width-lw)/2,y+(c.height-y-lw*300/1220)/2,lw,lw*300/1220);
 }else{const y=c.height-182,period=f.id.includes('club')?46:f.id.includes('friends')?72:1,sourceX=78+Math.floor((c.width-450-78)/period)*period;x.drawImage(c,sourceX,y,250,136,66,y,250,136);x.drawImage(logo,80,y+40,222,222*300/1220);if(!f.id.includes('farewell')){const start=c.width/2-220,top=c.height-107;x.drawImage(c,start,c.height-46,440,8,start,top,440,65);x.fillStyle=lc.fillStyle;x.textAlign='center';x.font='18px Arial';x.fillText('IMAGINATION / SPECIAL EDITION',c.width/2,c.height-77);}}
 const preview=document.createElement('canvas');const s=960/Math.max(c.width,c.height);preview.width=Math.round(c.width*s);preview.height=Math.round(c.height*s);preview.getContext('2d').drawImage(c,0,0,preview.width,preview.height);const thumb=document.createElement('canvas');thumb.width=Math.round(c.width*s*.31);thumb.height=Math.round(c.height*s*.31);const t=thumb.getContext('2d');t.fillStyle='white';t.fillRect(0,0,thumb.width,thumb.height);t.drawImage(c,0,0,thumb.width,thumb.height);
 return{base,png:c.toDataURL().split(',')[1],preview:preview.toDataURL('image/webp',.9).split(',')[1],thumbnail:thumb.toDataURL('image/webp',.9).split(',')[1],slots,bands};
 },{f,of,rec,source,ref,approvedFooter,runs:brandRuns,protect});
 const hash=createHash('sha256').update(result.png).digest('hex').slice(0,10);for(const [key,ext]of[['png','png'],['preview','webp'],['thumbnail','webp']]){const path=`frames/${f.id}-restored-${hash}-${key}.${ext}`;await writeFile(root+path,Buffer.from(result[key],'base64'));f[key==='png'?'src':key]=path;}f.slots=result.slots;f.artworkRestoration='original-scale-v1';console.log(f.id);}
await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');
}finally{await browser.close();}

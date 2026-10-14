import {chromium}from'playwright';import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import{brandRuns}from'../mac-print/public/calendar-layout.mjs';
const root=new URL('../dist/',import.meta.url).pathname,frames=JSON.parse(await readFile(root+'frames.json','utf8'));const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage();for(const f of frames.filter(f=>f.edition==='special'&&f.id!=='siwol-market-four'&&(!process.argv.includes('--paper-only')||f.id.includes('paper')))){const original=(await readFile(root+`frames/${f.id}-calendar-print.png`)).toString('base64');const data=await p.evaluate(async({f,original,runs})=>{const im=new Image();im.src='data:image/png;base64,'+original;await im.decode();const W=im.width,H=im.height,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.drawImage(im,0,0);const logo=document.createElement('canvas');logo.width=1220;logo.height=300;const l=logo.getContext('2d');const green=f.id.includes('green'),paper=f.id.includes('paper'),wide=W>H;const color=green?'#ffffff':paper?'#283f99':f.id.includes('friends')?'#9c4565':f.id.includes('club')?'#315582':'#495b40';l.fillStyle=color;for(const [xx,yy,w,a]of runs){l.globalAlpha=a/255;l.fillRect(xx,yy,w,1);}
 if(paper){
 // A surgical replacement of lettering INSIDE the original logo sticker only.
 // Preserve the original paper, sticker silhouette and shadows; remove only event lettering.
 const spec=wide?{box:[705,860,398,153],mark:[735,923,350]}:W===1200?{box:[424,1875,370,224],mark:[452,1960,324]}:{box:[370,1643,309,166],mark:[400,1705,254]};
 const [rx,ry,rw,rh]=spec.box,pixels=x.getImageData(rx,ry,rw,rh),d=pixels.data,mask=new Set();
 for(let yy=0;yy<rh;yy++)for(let xx=0;xx<rw;xx++){const i=(yy*rw+xx)*4;if(d[i+2]-d[i]>55&&d[i+2]-d[i+1]>40)for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const mx=xx+dx,my=yy+dy;if(mx>=0&&mx<rw&&my>=0&&my<rh)mask.add(my*rw+mx);}}
 const originalPixels=new Uint8ClampedArray(d);
 for(const pixel of mask){const xx=pixel%rw,yy=Math.floor(pixel/rw),i=pixel*4,samples=[];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=1;k<100;k++){const sx=xx+dx*k,sy=yy+dy*k,n=sy*rw+sx;if(sx<0||sx>=rw||sy<0||sy>=rh)break;if(!mask.has(n)&&Math.min(...originalPixels.slice(n*4,n*4+3))>230){samples.push([originalPixels[n*4],originalPixels[n*4+1],originalPixels[n*4+2],1/k]);break;}}const weight=samples.reduce((n,v)=>n+v[3],0);for(let q=0;q<3;q++)d[i+q]=weight?Math.round(samples.reduce((n,v)=>n+v[q]*v[3],0)/weight):255;}
 x.putImageData(pixels,rx,ry);const [lx,ly,lw]=spec.mark;x.drawImage(logo,lx,ly,lw,lw*300/1220);
 // Remove blue event/date glyphs without replacing the surrounding paper texture.
 const event=wide?[1108,923,130,69]:W===1200?[792,1980,160,91]:[684,1713,126,72];
 const [ex,ey,ew,eh]=event,ep=x.getImageData(ex,ey,ew,eh),ed=ep.data,em=new Set();
 for(let yy=0;yy<eh;yy++)for(let xx=0;xx<ew;xx++){const i=(yy*ew+xx)*4;if(ed[i+2]-ed[i]>40&&ed[i+2]-ed[i+1]>25)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const mx=xx+dx,my=yy+dy;if(mx>=0&&mx<ew&&my>=0&&my<eh)em.add(my*ew+mx);}}
 const source=new Uint8ClampedArray(ed);
 for(const pixel of em){const xx=pixel%ew,yy=Math.floor(pixel/ew),samples=[];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=1;k<70;k++){const sx=xx+dx*k,sy=yy+dy*k,n=sy*ew+sx;if(sx<0||sx>=ew||sy<0||sy>=eh)break;if(!em.has(n)){samples.push([source[n*4],source[n*4+1],source[n*4+2],1/k]);break;}}const weight=samples.reduce((n,v)=>n+v[3],0);if(weight)for(let q=0;q<3;q++)ed[pixel*4+q]=Math.round(samples.reduce((n,v)=>n+v[q]*v[3],0)/weight);}
 x.putImageData(ep,ex,ey);

 }else if(green){const y=wide?860:W===1200?1860:1655;const sample=x.getImageData(5,H-5,1,1).data;x.fillStyle=`rgb(${sample[0]},${sample[1]},${sample[2]})`;x.fillRect(0,y,W,H-y);const w=Math.min(W*.38,(H-y)*2.7),h=w*300/1220;x.drawImage(logo,(W-w)/2,y+(H-y-h)/2,w,h);}

 else{const y=H-182;
  // Restore the native patterned background from a clean part of the same footer.
  const period=f.id.includes('club')?46:f.id.includes('friends')?72:1;
  const sourceX=78+Math.floor((W-450-78)/period)*period;
  x.drawImage(im,sourceX,y,250,136,66,y,250,136);
  x.drawImage(logo,80,y+40,222,222*300/1220);
  if(!f.id.includes('farewell')){
   const start=W/2-220,top=H-107;
   // Footer captions occupy a shallow band; keep vertical pattern columns intact.
   x.drawImage(im,start,H-46,440,8,start,top,440,65);
   x.fillStyle=color;x.textAlign='center';x.font='18px Arial';x.fillText('IMAGINATION / SPECIAL EDITION',W/2,H-77);
  }
 }
 const preview=document.createElement('canvas');const s=960/Math.max(W,H);preview.width=Math.round(W*s);preview.height=Math.round(H*s);preview.getContext('2d').drawImage(c,0,0,preview.width,preview.height);const thumb=document.createElement('canvas');thumb.width=Math.round(W*s*.31);thumb.height=Math.round(H*s*.31);const tx=thumb.getContext('2d');tx.fillStyle='white';tx.fillRect(0,0,thumb.width,thumb.height);tx.drawImage(c,0,0,thumb.width,thumb.height);return{png:c.toDataURL().split(',')[1],preview:preview.toDataURL('image/webp',.9).split(',')[1],thumbnail:thumb.toDataURL('image/webp',.9).split(',')[1]};},{f,original,runs:brandRuns});const hash=createHash('sha256').update(data.png).digest('hex').slice(0,10);for(const[key,ext]of[['png','png'],['preview','webp'],['thumbnail','webp']]){const file=`frames/${f.id}-imagination-${key}-${hash}.${ext}`;await writeFile(root+file,Buffer.from(data[key],'base64'));f[key==='png'?'src':key]=file;}f.brand='Imagination Hall';}
await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');console.log('Updated requested special frames; original photo slots retained');}finally{await b.close();}

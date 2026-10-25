import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brandRuns} from '../mac-print/public/calendar-layout.mjs';
const root=new URL('../dist/',import.meta.url).pathname,frames=JSON.parse(await readFile(root+'frames.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();
for(const f of frames.filter(f=>f.edition==='basic')){
 const original=(await readFile(root+f.src)).toString('base64');
 const result=await page.evaluate(async({f,original,runs})=>{
  const old=new Image();old.src='data:image/png;base64,'+original;await old.decode();
  const sample=document.createElement('canvas');sample.width=sample.height=1;const sx=sample.getContext('2d');sx.drawImage(old,0,0);const rgb=[...sx.getImageData(0,0,1,1).data].slice(0,3);
  const bg=f.color==='black'?'#000000':`rgb(${rgb.join(',')})`,light=f.color!=='black'&&rgb.reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)>145,ink=light?'#000000':'#ffffff';
  const W=1200,H=2133,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  const rows=f.count/2,top=98,bottom=1680,gap=32,shift=f.layout==='offset'?80:0,h=(bottom-top-gap*(rows-1)-shift)/rows;
  const slots=[];for(let row=0;row<rows;row++)for(let col=0;col<2;col++){const x=col?619:67,y=Math.round(top+row*(h+gap)+col*shift),w=520,hh=Math.round(h);ctx.clearRect(x,y,w,hh);slots.push([x/W,y/H,w/W,hh/H]);}
  const logo=document.createElement('canvas');logo.width=1220;logo.height=300;const lc=logo.getContext('2d');lc.fillStyle=ink;for(const [x,y,w,a]of runs){lc.globalAlpha=a/255;lc.fillRect(x,y,w,1);}ctx.drawImage(logo,320,1820,560,560*300/1220);
  // Event dates are intentionally omitted.
  const thumb=document.createElement('canvas');thumb.width=250;thumb.height=Math.round(H*250/W);const tc=thumb.getContext('2d');tc.fillStyle='#fff';tc.fillRect(0,0,thumb.width,thumb.height);tc.drawImage(c,0,0,thumb.width,thumb.height);
  const preview=document.createElement('canvas');preview.width=Math.round(W*960/H);preview.height=960;preview.getContext('2d').drawImage(c,0,0,preview.width,preview.height);
  return {slots,png:c.toDataURL('image/png').split(',')[1],thumbnail:thumb.toDataURL('image/webp',.9).split(',')[1],preview:preview.toDataURL('image/webp',.9).split(',')[1]};
 },{f,original,runs:brandRuns});
 const digest=createHash('sha256').update(result.png).digest('hex').slice(0,10);
 for(const [key,ext]of [['png','png'],['thumbnail','webp'],['preview','webp']]){const path=`frames/${f.id}-imagination-${key}-${digest}.${ext}`;await writeFile(root+path,Buffer.from(result[key],'base64'));f[key==='png'?'src':key]=path;}
 f.slots=result.slots;f.sourceWidth=1200;f.sourceHeight=2133;f.layoutVersion='imagination-hall-v1';f.brand='Imagination Hall';delete f.eventDate;f.dateVisible=false;
}
await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');console.log('Updated',frames.filter(f=>f.edition==='basic').length,'basic frames. Special frames unchanged.');
}finally{await browser.close();}

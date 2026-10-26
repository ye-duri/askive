import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const frames=JSON.parse(await readFile(root+'frames.json','utf8'));
const originals=JSON.parse(await readFile(new URL('../docs/special-original-catalog.json',import.meta.url),'utf8'));
const flow=JSON.parse(await readFile(new URL('../docs/calendar-frame-reflow.json',import.meta.url),'utf8'));
const signature=(await readFile(new URL('../branding/signature/yonsei-signature.png',import.meta.url))).toString('base64');
let html=await readFile(root+'index.html','utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();for(const f of frames.filter(f=>!f.hidden)){
 if(f.layoutVersion==='single-frame-original-v1')continue;
 const of=originals.find(a=>a.id===f.id),rec=flow.find(a=>a.id===f.id);
 let protect=[];if(of){try{const svg=await readFile(root+'frames/'+f.id+'.svg','utf8');for(const m of svg.matchAll(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g))protect.push(m.slice(1).map(Number));for(const m of svg.matchAll(/transform="translate\(([\d.]+) ([\d.]+)\)"/g))protect.push([+m[1]-38,+m[2]-38,76,76]);}catch{}}
 const source=(await readFile(root+f.src)).toString('base64');
 const out=await page.evaluate(async({f,of,rec,protect,source,signature})=>{
  const load=async s=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();return i;};
  const im=await load(source),c=document.createElement('canvas');let slots;
  if(f.edition==='basic'){
   c.width=1200;c.height=1776;const x=c.getContext('2d'),sample=document.createElement('canvas');sample.width=sample.height=1;sample.getContext('2d').drawImage(im,0,0);const p=sample.getContext('2d').getImageData(0,0,1,1).data;
   x.fillStyle=`rgb(${p[0]},${p[1]},${p[2]})`;x.fillRect(0,0,c.width,c.height);
   let rects;if(f.count===4)rects=f.layout==='offset'?[[48,48,540,628],[612,208,540,628],[48,700,540,628],[612,860,540,628]]:[128,780].flatMap(y=>[48,612].map(x=>[x,y,540,628]));
   else rects=[0,1,2].flatMap(i=>[48,612].map((x,col)=>[x,(f.layout==='offset'?48+(col?128:0):112)+i*448,540,424]));
   for(const r of rects)x.clearRect(...r);slots=rects.map(([a,b,w,h])=>[a/1200,b/1776,w/1200,h/1776]);
   const logo=document.createElement('canvas');logo.width=324;logo.height=181;const l=logo.getContext('2d');l.drawImage(await load(signature),216,21,1351,753,0,0,324,181);l.globalCompositeOperation='source-in';l.fillStyle=(p[0]*.299+p[1]*.587+p[2]*.114)<150?'white':'black';l.fillRect(0,0,324,181);x.drawImage(logo,438,1524);
  }else{
   const wide=im.width>im.height;
   const bands=rec.bands.map(([y,h,add])=>{const forbidden=protect.map(p=>wide?[p[0]-5,p[0]+p[2]+5]:[p[1]-5,p[1]+p[3]+5]);let yy=y;for(let k=0;k<120;k++){const test=y+k;if(!forbidden.some(([a,b])=>test<b&&test+h>a)){yy=test;break;}}return[yy,h,add];});
   const work=document.createElement('canvas');work.width=wide?im.height:im.width;work.height=wide?im.width:im.height;const q=work.getContext('2d');if(wide)q.setTransform(0,1,1,0,0,0);q.drawImage(im,0,0);
   const restored=document.createElement('canvas');restored.width=work.width;restored.height=work.height-bands.reduce((n,b)=>n+b[2],0);const d=restored.getContext('2d');let sy=0,dy=0,added=0;
   for(const [y,h,add]of bands){const end=y+h+added,len=end-sy;d.drawImage(work,0,sy,work.width,len,0,dy,work.width,len);sy=end+add;dy+=len;added+=add;}
   d.drawImage(work,0,sy,work.width,work.height-sy,0,dy,work.width,work.height-sy);
   c.width=of.sourceWidth;c.height=of.sourceHeight;const x=c.getContext('2d');if(wide)x.setTransform(0,1,1,0,0,0);x.drawImage(restored,0,0);x.resetTransform();
   // Do not slice lettering along the horizontal shortening bands.
   if(wide){const top=f.id.includes('paper')?857:860;x.clearRect(0,top,c.width,c.height-top);x.drawImage(im,(im.width-c.width)/2,top,c.width,c.height-top,0,top,c.width,c.height-top);}
   slots=of.slots;
  }
  const scaled=(max,bg)=>{const v=document.createElement('canvas'),s=max/Math.max(c.width,c.height);v.width=Math.round(c.width*s);v.height=Math.round(c.height*s);const x=v.getContext('2d');if(bg){x.fillStyle='white';x.fillRect(0,0,v.width,v.height);}x.drawImage(c,0,0,v.width,v.height);return v.toDataURL('image/webp',.94).split(',')[1];};
  return {png:c.toDataURL().split(',')[1],preview:scaled(960,false),thumbnail:scaled(300,true),slots,width:c.width,height:c.height};
 },{f,of,rec,protect,source,signature});
 const hash=createHash('sha256').update(out.png).digest('hex').slice(0,10);
 for(const [key,ext]of [['src','png'],['preview','webp'],['thumbnail','webp']]){const name=`frames/${f.id}-single-${hash}-${key}.${ext}`;await writeFile(root+name,Buffer.from(out[key==='src'?'png':key],'base64'));html=html.replaceAll(f[key],name);f[key]=name;}
 f.slots=out.slots;f.sourceWidth=out.width;f.sourceHeight=out.height;f.layoutVersion='single-frame-original-v1';f.dateVisible=false;delete f.eventDate;console.log(f.id,out.width,out.height);
 }
 await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');await writeFile(root+'index.html',html.replaceAll('height="213"','height="178"'));
}finally{await browser.close();}

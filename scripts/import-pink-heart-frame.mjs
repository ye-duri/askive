import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=process.argv[2];if(!input)throw Error('Provide the original frame PNG path');
const root=new URL('../dist/',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const result=await page.evaluate(async data=>{
  const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
  const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const original=ctx.getImageData(0,0,c.width,c.height),pixels=original.data;
  // Detect the four large transparent (or solid-black) photo placeholders without changing artwork.
  const runs=new Map();for(let y=0;y<c.height;y++){let start=-1;for(let x=0;x<=c.width;x++){const i=(y*c.width+x)*4,black=x<c.width&&(pixels[i+3]===0||(pixels[i]===0&&pixels[i+1]===0&&pixels[i+2]===0&&pixels[i+3]===255));if(black&&start<0)start=x;if(!black&&start>=0){if(x-start>c.width*.3){const key=start+':'+(x-start),groups=runs.get(key)||[];let last=groups.at(-1);if(last&&last.y+last.h===y)last.h++;else groups.push({x:start,y,w:x-start,h:1});runs.set(key,groups);}start=-1;}}}
  const rects=[...runs.values()].flat().filter(r=>r.h>c.height*.2).sort((a,b)=>a.y-b.y||a.x-b.x);
  if(rects.length!==4)throw Error(JSON.stringify({message:'Expected four photo placeholders',width:c.width,height:c.height,groups:[...runs.values()].flat(),sample:Array.from(pixels.slice((100*c.width+100)*4,(100*c.width+100)*4+4))}));
  for(const r of rects)ctx.clearRect(r.x,r.y,r.w,r.h);
  const after=ctx.getImageData(0,0,c.width,c.height).data;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,inside=rects.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);if(inside){if(after[i+3]!==0)throw Error('Opaque slot');}else for(let k=0;k<4;k++)if(after[i+k]!==pixels[i+k])throw Error('Artwork changed');}
  const out={width:c.width,height:c.height,rects,src:c.toDataURL().split(',')[1]};
  for(const [key,max]of [['preview',960],['thumbnail',300]]){const t=document.createElement('canvas'),scale=max/Math.max(c.width,c.height);t.width=Math.round(c.width*scale);t.height=Math.round(c.height*scale);const q=t.getContext('2d');if(key==='thumbnail'){q.fillStyle='white';q.fillRect(0,0,t.width,t.height);}q.drawImage(c,0,0,t.width,t.height);out[key]=t.toDataURL('image/webp',.96).split(',')[1];}return out;
 },(await readFile(input)).toString('base64'));
 const id='ask-pink-heart-four',frame={id,name:'핑크 하트 · 4컷',edition:'special',count:4,paper:'selphy-p',sourceWidth:result.width,sourceHeight:result.height,brand:'Ask Seek Knock',dateVisible:true,slots:result.rects.map(r=>[r.x/result.width,r.y/result.height,r.w/result.width,r.h/result.height])};
 const hash=createHash('sha256').update(Buffer.from(result.src,'base64')).digest('hex').slice(0,10);
 for(const key of ['src','preview','thumbnail']){frame[key]=`frames/${id}-${hash}-${key}.${key==='src'?'png':'webp'}`;await writeFile(root+frame[key],Buffer.from(result[key],'base64'));}
 const frames=JSON.parse(await readFile(root+'frames.json'));const index=frames.findIndex(f=>f.id===id);if(index<0)frames.splice(frames.findIndex(f=>f.edition==='special'),0,frame);else frames[index]=frame;
 await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');console.log(JSON.stringify({frame,rects:result.rects,artworkPixelsUnchanged:true},null,2));
}finally{await browser.close();}

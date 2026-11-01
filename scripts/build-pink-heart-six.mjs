import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const frames=JSON.parse(await readFile(root+'frames.json','utf8'));
const base=frames.find(f=>f.id==='ask-pink-heart-four');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 const result=await page.evaluate(async({data,base})=>{
  const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');
  ctx.drawImage(im,0,0);
  const original=ctx.getImageData(0,0,c.width,c.height).data;
  const old=base.slots.map(([x,y,w,h])=>({x:Math.round(x*c.width),y:Math.round(y*c.height),w:Math.round(w*c.width),h:Math.round(h*c.height)}));
  const top=old[0].y,bottom=old[2].y+old[2].h,gap=old[2].y-(old[0].y+old[0].h),rowHeight=(bottom-top-2*gap)/3;
  const slots=[];
  for(let row=0;row<3;row++){
   const y=top+Math.round(row*(rowHeight+gap)),end=top+Math.round((row+1)*rowHeight+row*gap),src=old[row===0?0:2];
   // Keep the original side texture; only introduce dividers within the old photo columns.
   for(const col of [0,1]){const r=old[col];ctx.clearRect(r.x,y,r.w,end-y);slots.push([r.x/c.width,y/c.height,r.w/c.width,(end-y)/c.height]);}
   if(row<2){ctx.imageSmoothingEnabled=false;for(const r of old.slice(0,2))ctx.drawImage(im,r.x-3,old[0].y+old[0].h+1,r.w+6,gap-2,r.x-3,end,r.w+6,gap);ctx.imageSmoothingEnabled=true;}
  }
  // Header and footer, including the character, lettering and date, remain pixel-identical.
  const after=ctx.getImageData(0,0,c.width,c.height).data;
  for(let y=0;y<c.height;y++){if(y>=top&&y<bottom)continue;for(let x=0;x<c.width;x++)for(let k=0;k<4;k++){const i=(y*c.width+x)*4+k;if(original[i]!==after[i])throw Error('Header/footer artwork changed');}}
  const out={slots,src:c.toDataURL().split(',')[1]};
  for(const [key,max]of [['preview',960],['thumbnail',300]]){const t=document.createElement('canvas'),scale=max/Math.max(c.width,c.height);t.width=Math.round(c.width*scale);t.height=Math.round(c.height*scale);const q=t.getContext('2d');if(key==='thumbnail'){q.fillStyle='white';q.fillRect(0,0,t.width,t.height);}q.drawImage(c,0,0,t.width,t.height);out[key]=t.toDataURL('image/webp',.96).split(',')[1];}
  return out;
 },{data:(await readFile(root+base.src)).toString('base64'),base});
 const id='ask-pink-heart-six',frame={...base,id,name:'핑크 하트 · 6컷',count:6,slots:result.slots};
 const hash=createHash('sha256').update(Buffer.from(result.src,'base64')).digest('hex').slice(0,10);
 for(const key of ['src','preview','thumbnail']){frame[key]=`frames/${id}-${hash}-${key}.${key==='src'?'png':'webp'}`;await writeFile(root+frame[key],Buffer.from(result[key],'base64'));}
 const index=frames.findIndex(f=>f.id===id);if(index<0)frames.splice(frames.indexOf(base)+1,0,frame);else frames[index]=frame;
 await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');console.log(JSON.stringify(frame,null,2));
} finally {await browser.close();}

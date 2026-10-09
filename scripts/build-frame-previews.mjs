import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const frames=JSON.parse(await readFile(root+'frames.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();let before=0,after=0;
 for(const frame of frames){
  const original=await readFile(root+frame.src);before+=original.length;
  const r=await page.evaluate(async b64=>{
   const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
   const c=document.createElement('canvas'),scale=Math.min(1,960/Math.max(img.width,img.height));
   c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   return {width:img.width,height:img.height,data:c.toDataURL('image/webp',.9).split(',')[1]};
  },original.toString('base64'));
  const bytes=Buffer.from(r.data,'base64'),hash=createHash('sha256').update(bytes).digest('hex').slice(0,10);
  frame.preview=`frames/${frame.id}-screen-${hash}.webp`;frame.sourceWidth=r.width;frame.sourceHeight=r.height;
  await writeFile(root+frame.preview,bytes);after+=bytes.length;
 }
 await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');console.log({count:frames.length,originalMB:before/1e6,screenMB:after/1e6,reduction:1-after/before});
}finally{await browser.close();}

import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [input,dest]=process.argv.slice(2);if(!input||!dest)throw Error('Usage: input.png destination-dist');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const out=await page.evaluate(async data=>{
  const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
  if(im.width!==952||im.height!==1652)throw Error('Unexpected WHO AM I artwork dimensions');
  const raw=document.createElement('canvas');raw.width=im.width;raw.height=im.height;const q=raw.getContext('2d');q.drawImage(im,0,0);
  const rects=[[45,68,418,528],[489,68,418,528],[45,621,418,528],[489,621,418,528]];
  for(const [x,y,w,h]of rects){const d=q.getImageData(x+4,y+4,w-8,h-8).data;for(let i=0;i<d.length;i+=4)if(Math.min(d[i],d[i+1],d[i+2])<220)throw Error('Photo window does not match supplied artwork');q.clearRect(x,y,w,h);}
  // Match the existing single-frame print ratio; preserve typography/footer proportions.
  const c=document.createElement('canvas');c.width=1200;c.height=1776;const x=c.getContext('2d'),s=c.width/im.width,top=Math.round(68*s),bottom=c.height-Math.round((im.height-1149)*s),mapY=y=>top+(y-68)*(bottom-top)/(1149-68);
  x.drawImage(raw,0,0,952,68,0,0,1200,top);x.drawImage(raw,0,68,952,1081,0,top,1200,bottom-top);x.drawImage(raw,0,1149,952,503,0,bottom,1200,1776-bottom);
  const slots=rects.map(([a,b,w,h])=>[a/952,mapY(b)/1776,w/952,(mapY(b+h)-mapY(b))/1776]);
  const result={slots,src:c.toDataURL().split(',')[1]};
  for(const[key,max]of [['preview',960],['thumbnail',300]]){const t=document.createElement('canvas');t.width=Math.round(1200*max/1776);t.height=max;const ctx=t.getContext('2d');if(key==='thumbnail'){ctx.fillStyle='white';ctx.fillRect(0,0,t.width,t.height);}ctx.drawImage(c,0,0,t.width,t.height);result[key]=t.toDataURL('image/webp',.96).split(',')[1];}
  return result;
 },(await readFile(input)).toString('base64'));
 const id='who-am-i-four',hash=createHash('sha256').update(Buffer.from(out.src,'base64')).digest('hex').slice(0,10),frame={id,name:'WHO AM I 성극 · 4컷',edition:'special',count:4,paper:'selphy-p',sourceWidth:1200,sourceHeight:1776,layoutVersion:'single-frame-original-v1',brand:'WHO AM I',dateVisible:true,slots:out.slots};
 await mkdir(dest+'/frames',{recursive:true});
 for(const key of ['src','preview','thumbnail']){frame[key]=`frames/${id}-${hash}-${key}.${key==='src'?'png':'webp'}`;await writeFile(dest+'/'+frame[key],Buffer.from(out[key],'base64'));}
 const frames=JSON.parse(await readFile(dest+'/frames.json'));const i=frames.findIndex(f=>f.id===id);if(i>=0)frames[i]=frame;else frames.splice(frames.findIndex(f=>f.edition==='special'),0,frame);
 await writeFile(dest+'/frames.json',JSON.stringify(frames,null,2)+'\n');console.log(JSON.stringify(frame,null,2));
}finally{await browser.close();}

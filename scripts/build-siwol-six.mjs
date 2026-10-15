// Reflow approved Siwol artwork into a six-photo compositor template.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const catalog=JSON.parse(await readFile(root+'frames.json'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();for(const id of ['siwol-market-four','siwol-market-peach-four']){
 const source=catalog.find(f=>f.id===id);
 const result=await page.evaluate(async({png,source})=>{
  const im=new Image();im.src='data:image/png;base64,'+png;await im.decode();
  const c=document.createElement('canvas');c.width=600;c.height=1057;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
  const rgba=ctx.getImageData(300,700,1,1).data;ctx.fillStyle=`rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
  // Preserve header, side decoration, title, date and logo at their original pixels.
  ctx.fillRect(32,46,534,786);
  const cols=source.slots.slice(0,2).map(s=>[Math.round(s[0]*600),Math.round(s[2]*600)]);
  const slots=[];for(const y of [46,314,581])for(const [x,w] of cols){ctx.clearRect(x,y,w,251);slots.push([x/600,y/1057,w/600,251/1057]);}
  // Keep the original orange leaf, repositioned onto the first new divider.
  const leaf=document.createElement('canvas');leaf.width=64;leaf.height=54;const lx=leaf.getContext('2d');lx.drawImage(im,249,388,64,54,0,0,64,54);const pixels=lx.getImageData(0,0,64,54);
  for(let i=0;i<pixels.data.length;i+=4){const d=pixels.data;if(!(d[i]>180&&d[i+1]>35&&d[i+1]<120&&d[i+2]<65))d[i+3]=0;}
  lx.putImageData(pixels,0,0);ctx.drawImage(leaf,249,273);
  const files={png:c.toDataURL().split(',')[1]};for(const[key,w] of [['preview',540],['thumbnail',220]]){const t=document.createElement('canvas');t.width=w;t.height=Math.round(1057*w/600);const x=t.getContext('2d');if(key==='thumbnail'){x.fillStyle='white';x.fillRect(0,0,t.width,t.height);}x.drawImage(c,0,0,t.width,t.height);files[key]=t.toDataURL('image/webp',.94).split(',')[1];}
  for(const [x,y,w,h] of slots){if(ctx.getImageData(Math.round((x+w/2)*600),Math.round((y+h/2)*1057),1,1).data[3]!==0)throw Error('Blocked photo opening');}
  return {files,slots};
 },{png:(await readFile(root+source.src)).toString('base64'),source});
 const f={...source,id:source.id.replace('-four','-six'),name:source.name.replace('4컷','6컷'),count:6,slots:result.slots,layoutVersion:'siwol-six-v1',hidden:false};
 const hash=createHash('sha256').update(result.files.png).digest('hex').slice(0,10);
 for(const[key,ext] of [['png','png'],['preview','webp'],['thumbnail','webp']]){const path=`frames/${f.id}-${key}-${hash}.${ext}`;await writeFile(root+path,Buffer.from(result.files[key],'base64'));f[key==='png'?'src':key]=path;}
 const old=catalog.findIndex(x=>x.id===f.id);if(old<0)catalog.push(f);else catalog[old]=f;console.log(f.name,f.src);
}await writeFile(root+'frames.json',JSON.stringify(catalog,null,2)+'\n');}finally{await browser.close();}

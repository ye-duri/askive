// Reflow approved WANT artwork into a six-photo compositor template.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const catalog=JSON.parse(await readFile(root+'frames.json'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();for(const id of ['want-four']){
 const source=catalog.find(f=>f.id===id);
 const result=await page.evaluate(async({png,source})=>{
  const im=new Image();im.src='data:image/png;base64,'+png;await im.decode();
  const c=document.createElement('canvas');c.width=600;c.height=1057;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
  // Keep all outer artwork and the title unchanged; rebuild only the photo openings.
  for(const sx of [34,308]){
   ctx.clearRect(sx,46,260,787);
   for(const y of [297,564])ctx.drawImage(im,sx,431,260,17,sx,y,260,17);
  }
  // Restore original title lettering that overlaps the lower photograph edges.
  ctx.drawImage(im,0,810,600,247,0,810,600,247);
  const slots=[];for(const [y,h] of [[45,253],[313,252],[580,254]])for(const x of [33,307])slots.push([x/600,y/1057,262/600,h/1057]);
  const files={png:c.toDataURL().split(',')[1]};for(const[key,w] of [['preview',540],['thumbnail',220]]){const t=document.createElement('canvas');t.width=w;t.height=Math.round(1057*w/600);const x=t.getContext('2d');if(key==='thumbnail'){x.fillStyle='white';x.fillRect(0,0,t.width,t.height);}x.drawImage(c,0,0,t.width,t.height);files[key]=t.toDataURL('image/webp',.94).split(',')[1];}
  for(const [x,y,w,h] of slots){if(ctx.getImageData(Math.round((x+w/2)*600),Math.round((y+h/2)*1057),1,1).data[3]!==0)throw Error('Blocked photo opening');}
  return {files,slots};
 },{png:(await readFile(root+source.src)).toString('base64'),source});
 const f={...source,id:source.id.replace('-four','-six'),name:source.name.replace('4컷','6컷'),count:6,slots:result.slots,layoutVersion:'want-six-v1',hidden:false};
 const hash=createHash('sha256').update(result.files.png).digest('hex').slice(0,10);
 for(const[key,ext] of [['png','png'],['preview','webp'],['thumbnail','webp']]){const path=`frames/${f.id}-${key}-${hash}.${ext}`;await writeFile(root+path,Buffer.from(result.files[key],'base64'));f[key==='png'?'src':key]=path;}
 const old=catalog.findIndex(x=>x.id===f.id);if(old<0)catalog.push(f);else catalog[old]=f;console.log(f.name,f.src);
}await writeFile(root+'frames.json',JSON.stringify(catalog,null,2)+'\n');}finally{await browser.close();}

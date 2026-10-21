// Update only the event-date region of the approved compositor assets.
import {chromium} from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const frames=JSON.parse(await readFile(root+'frames.json'));let html=await readFile(root+'index.html','utf8');
const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage();
for(const f of frames.filter(f=>f.printTheme==='siwol')){
 const peach=f.id.includes('peach'),font=await readFile(root+'fonts/'+(peach?'SUIT-Variable.woff2':'MaruBuri-Regular.woff2'));
 const output=await p.evaluate(async({png,font,peach})=>{
 const face=new FontFace('EventDate',`url(data:font/woff2;base64,${font})`);await face.load();document.fonts.add(face);
 const im=new Image();im.src='data:image/png;base64,'+png;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const before=x.getImageData(0,0,c.width,c.height).data;
 const box=peach?[384,998,184,29]:[423,998,145,25];const bg=x.getImageData(580,1000,1,1).data;x.fillStyle=`rgb(${bg[0]},${bg[1]},${bg[2]})`;x.fillRect(...box);x.fillStyle='#893519';x.font=`${peach?24:18}px EventDate`;x.textAlign='right';x.fillText('2026.10.24(Sat)',563,peach?1021:1017);
 const after=x.getImageData(0,0,c.width,c.height).data;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const i=(y*c.width+xx)*4; if(xx<box[0]||xx>=box[0]+box[2]||y<box[1]||y>=box[1]+box[3])for(let k=0;k<4;k++)if(before[i+k]!==after[i+k])throw Error('Changed outside date');if(before[i+3]!==after[i+3])throw Error('Changed transparency');}
 const files={png:c.toDataURL().split(',')[1]};for(const[key,w] of [['preview',540],['thumbnail',220]]){const t=document.createElement('canvas');t.width=w;t.height=Math.round(c.height*w/c.width);const tx=t.getContext('2d');if(key==='thumbnail'){tx.fillStyle='white';tx.fillRect(0,0,t.width,t.height);}tx.drawImage(c,0,0,t.width,t.height);files[key]=t.toDataURL('image/webp',.94).split(',')[1];}return files;
 },{png:(await readFile(root+f.src)).toString('base64'),font:font.toString('base64'),peach});
 const hash=createHash('sha256').update(output.png).digest('hex').slice(0,10);
 for(const[key,ext] of [['png','png'],['preview','webp'],['thumbnail','webp']]){const field=key==='png'?'src':key,path=`frames/${f.id}-${key}-${hash}.${ext}`;await writeFile(root+path,Buffer.from(output[key],'base64'));html=html.replaceAll(f[field],path);f[field]=path;}f.eventDate='2026-10-24';console.log(f.name,'date updated; unchanged artwork and alpha verified');
}
await writeFile(root+'frames.json',JSON.stringify(frames,null,2)+'\n');await writeFile(root+'index.html',html);
}finally{await b.close();}

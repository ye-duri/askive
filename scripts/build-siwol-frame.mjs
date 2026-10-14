// Import the approved print-sheet artwork into the frame compositor, preserving its pixels.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url).pathname;
const input=process.argv[2];if(!input)throw Error('Pass the approved 1200 x 1776 print sheet PNG');
const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage();const output=await p.evaluate(async base64=>{
 const im=new Image();im.src='data:image/png;base64,'+base64;await im.decode();if(im.width!==1200||im.height!==1776)throw Error('Unexpected reference size');
 const c=document.createElement('canvas');c.width=600;c.height=1057;const x=c.getContext('2d');x.drawImage(im,0,0);
 // The supplied PNG already has transparent photo openings; retain the leaf overlays.
 const slots=[[33,46,259,385],[307,46,259,385],[33,448,259,384],[307,448,259,384]];
 const files={png:c.toDataURL().split(',')[1]};for(const [key,w]of [['preview',540],['thumbnail',220]]){const t=document.createElement('canvas');t.width=w;t.height=Math.round(1057*w/600);const tx=t.getContext('2d');if(key==='thumbnail'){tx.fillStyle='white';tx.fillRect(0,0,t.width,t.height);}tx.drawImage(c,0,0,t.width,t.height);files[key]=t.toDataURL('image/webp',.94).split(',')[1];}
 // Trace the supplied OCT lettering as paths, so canvas and PDF use the exact approved shape.
 const letter=document.createElement('canvas');letter.width=540;letter.height=190;const lx=letter.getContext('2d');lx.drawImage(im,35,1090,540,190,0,0,540,190);const d=lx.getImageData(0,0,540,190).data,path=[];
 for(let y=0;y<190;y++){let start=-1;for(let xx=0;xx<=540;xx++){const n=(y*540+xx)*4,on=xx<540&&d[n]>120&&d[n]<230&&d[n+1]<130&&d[n+2]<100;if(on&&start<0)start=xx;if(!on&&start>=0){path.push(['M',start,190-y],['L',xx,190-y],['L',xx,189-y],['L',start,189-y],['Z']);start=-1;}}}
 return{files,slots:slots.map(([a,b,c,d])=>[a/600,b/1057,c/600,d/1057]),font:{units:190,glyphs:{O:{advance:540,path},C:{advance:0,path:[]},T:{advance:0,path:[]},'.':{advance:0,path:[]}}}};
},(await readFile(input)).toString('base64'));
 const hash=createHash('sha256').update(output.files.png).digest('hex').slice(0,10);const f={id:'siwol-market-four',name:'시월장 · 4컷',edition:'special',count:4,paper:'selphy-p',sourceWidth:600,sourceHeight:1057,layoutVersion:'siwol-v1',brand:'Imagination Hall',printTheme:'siwol',slots:output.slots};
 for(const[key,ext]of[['png','png'],['preview','webp'],['thumbnail','webp']]){const name=`frames/siwol-market-four-${key}-${hash}.${ext}`;await writeFile(root+name,Buffer.from(output.files[key],'base64'));f[key==='png'?'src':key]=name;}
 const frames=JSON.parse(await readFile(root+'frames.json'));await writeFile(root+'frames.json',JSON.stringify([...frames.filter(f=>f.id!== 'siwol-market-four'),f],null,2)+'\n');
 const fonts=(await readFile(root+'print/calendar-fonts.mjs','utf8')).split('\n// Approved Siwol')[0];const module=fonts+'\n// Approved Siwol OCT. lettering, traced from the supplied print reference.\ncalendarFonts.siwol='+JSON.stringify(output.font)+';\n';await writeFile(root+'print/calendar-fonts.mjs',module);await writeFile(new URL('../mac-print/public/calendar-fonts.mjs',import.meta.url),module);console.log('Added Siwol frame and exact calendar heading');
}finally{await b.close();}

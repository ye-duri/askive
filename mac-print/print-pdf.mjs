import {calendarLayout} from './public/calendar-layout.mjs';
// Fix physical placement before handing the job to macOS's print pipeline.
export function printPDF(jpeg,scale=94,rotation=0){
 if(!Number.isInteger(scale)||scale<85||scale>100)throw Error('Invalid print scale');
 if(![0,90].includes(rotation))throw Error('Invalid print rotation');
 let width,height,components;
 for(let i=2;i<jpeg.length;){
  if(jpeg[i++]!==255)throw Error('Invalid JPEG marker');
  while(jpeg[i]===255)i++;
  const marker=jpeg[i++];if(marker===218||marker===217)break;
  if(marker===1||(marker>=208&&marker<=215))continue;
  if(i+2>jpeg.length)break;const length=jpeg.readUInt16BE(i);
  if(length<2||i+length>jpeg.length)break;
  if([192,193,194].includes(marker)&&length>=8){height=jpeg.readUInt16BE(i+3);width=jpeg.readUInt16BE(i+5);components=jpeg[i+7];break;}i+=length;
 }
 if(!width||!height||![1,3].includes(components))throw Error('인쇄할 JPEG 크기를 확인할 수 없습니다.');
 const pageWidth=100*72/25.4,pageHeight=148*72/25.4;
 const factor=pageWidth/1200*scale/100,offsetX=pageWidth*(1-scale/100)/2,offsetY=pageHeight*(1-scale/100)/2;
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).join(' ');
 const lines=[`q ${factor} 0 0 ${factor} ${offsetX} ${offsetY} cm`];
 for(const p of calendarLayout(width,height,rotation)){
  const y=1776-p.y;
  if(p.type==='photo'){
   const matrix=p.rotation===90?`0 ${-p.h} ${p.w} 0 ${p.x} ${y}`:`${p.w} 0 0 ${p.h} ${p.x} ${y-p.h}`;
   lines.push(`q ${matrix} cm /Photo Do Q`);
  }else if(p.type==='brand'){const k=p.w/137;for(const [rx,ry,rw,a] of p.runs){const color=[121,77,50].map(v=>(255+(v-255)*a/255)/255).join(' ');lines.push(`${color} rg ${p.x+rx*k} ${y-(ry+1)*k} ${rw*k} ${k} re f`);}}else if(p.type==='line')lines.push(`${rgb(p.color)} RG 0.8 w ${p.x} ${y} m ${p.x+p.w} ${y-p.h} l S`);
  else{const font=p.font==='sans'?'F2':(p.font==='italic'||p.font==='brand')?'F3':'F1';lines.push(`BT /${font} ${p.size} Tf ${rgb(p.color)} rg 1 0 0 1 ${p.x} ${y} Tm (${p.value}) Tj ET`);}
 }
 lines.push('Q');const content=Buffer.from(lines.join('\n'));
 const stream=(header,data)=>Buffer.concat([Buffer.from(`<< ${header} /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(6)} ${pageHeight.toFixed(6)}] /Resources << /XObject << /Photo 4 0 R >> /Font << /F1 6 0 R /F2 7 0 R /F3 8 0 R >> >> /Contents 5 0 R >>`),stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${components===3?'DeviceRGB':'DeviceGray'} /BitsPerComponent 8 /Filter /DCTDecode`,jpeg),stream('',content),Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'),Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>')];
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let size=parts[0].length;
 objects.forEach((o,i)=>{offsets.push(size);const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from('\nendobj\n')]);parts.push(part);size+=part.length;});
 parts.push(Buffer.from(`xref\n0 9\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));return Buffer.concat(parts);
}

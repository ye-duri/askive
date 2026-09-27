// Fix physical placement before handing the job to macOS's print pipeline.
export function printPDF(jpeg,scale=94){
 if(!Number.isInteger(scale)||scale<85||scale>100)throw Error('Invalid print scale');
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
 const pageWidth=(width>height?148:100)*72/25.4,pageHeight=(width>height?100:148)*72/25.4;
 const ratio=Math.min(pageWidth/width,pageHeight/height)*scale/100;
 const w=width*ratio,h=height*ratio,x=(pageWidth-w)/2,y=(pageHeight-h)/2;
 const content=Buffer.from(`q\n${w.toFixed(6)} 0 0 ${h.toFixed(6)} ${x.toFixed(6)} ${y.toFixed(6)} cm\n/Photo Do\nQ\n`);
 const stream=(header,data)=>Buffer.concat([Buffer.from(`<< ${header} /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(6)} ${pageHeight.toFixed(6)}] /Resources << /XObject << /Photo 4 0 R >> >> /Contents 5 0 R >>`),stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${components===3?'DeviceRGB':'DeviceGray'} /BitsPerComponent 8 /Filter /DCTDecode`,jpeg),stream('',content)];
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let size=parts[0].length;
 objects.forEach((o,i)=>{offsets.push(size);const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),o,Buffer.from('\nendobj\n')]);parts.push(part);size+=part.length;});
 parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));return Buffer.concat(parts);
}

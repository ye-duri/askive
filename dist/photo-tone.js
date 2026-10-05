// Prepared once per capture; weak keys release originals and corrections after a session.
const prepared=new WeakMap();
const curve=Uint8ClampedArray.from({length:256},(_,v)=>(255*Math.pow(v/255,.97)-128)*1.035+130);
export function naturalPhoto(photo){return prepared.get(photo)||photo;}
export async function prepareNaturalPhoto(photo){
 if(prepared.has(photo))return prepared.get(photo);
 const result=document.createElement('canvas');result.width=photo.width;result.height=photo.height;
 const ctx=result.getContext('2d');ctx.drawImage(photo,0,0);
 const image=ctx.getImageData(0,0,result.width,result.height),d=image.data;
 // Process bounded strips and yield between them so the interface remains responsive.
 const strip=result.width*32*4;
 for(let start=0;start<d.length;start+=strip){
  const end=Math.min(start+strip,d.length);
  for(let i=start;i<end;i+=4){const r=curve[d[i]],g=curve[d[i+1]],b=curve[d[i+2]],l=.2126*r+.7152*g+.0722*b;d[i]=l+(r-l)*1.07;d[i+1]=l+(g-l)*1.07;d[i+2]=l+(b-l)*1.07;}
  if(end<d.length)await new Promise(resolve=>setTimeout(resolve,0));
 }
 ctx.putImageData(image,0,0);prepared.set(photo,result);return result;
}

// Shared 100 x 148 mm print composition. Coordinates use a 1200 x 1776 canvas.
export function calendarLayout(width,height,rotation=0){
 const commands=[],blue='#126ba3',line='#94bed8';
 const photo=(x,y,w,h)=>{const rw=rotation===90?height:width,rh=rotation===90?width:height,r=Math.min(w/rw,h/rh),pw=rw*r,ph=rh*r;commands.push({type:'photo',x:x+(w-pw)/2,y:y+(h-ph)/2,w:pw,h:ph,rotation});};
 photo(0,0,600,1060);photo(600,0,600,1060);
 photo(600,1060,300,530);photo(900,1060,300,530);
 const text=(value,x,y,size,font='serif')=>commands.push({type:'text',value,x,y,size,font,color:blue});
 const rule=(x,y,w,h)=>commands.push({type:'line',x,y,w,h,color:line});
 text('OCT.',32,1310,238);
 const x=44,y=1400,cw=73,rh=60;
 ['SUN','MON','TUE','WED','THU','FRI','SAT'].forEach((d,i)=>text(d,x+i*cw+14,y-15,12,'sans'));
 for(let i=0;i<=7;i++)rule(x+i*cw,y,0,rh*5);
 for(let i=0;i<=5;i++)rule(x,y+i*rh,cw*7,0);
 const first=new Date(Date.UTC(2026,9,1)).getUTCDay();
 for(let day=1;day<=31;day++){const n=first+day-1;text(String(day),x+(n%7)*cw+(day<10?29:20),y+Math.floor(n/7)*rh+38,28);}
 text('Hello, October!',44,1730,15);text('2026',516,1730,15);
 text('Yonsei Studio',735,1685,45,'italic');
 return commands;
}
export function drawCalendar(canvas,image,scale=94,rotation=0){
 canvas.width=1200;canvas.height=1776;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1200,1776);c.save();c.translate(600*(1-scale/100),888*(1-scale/100));c.scale(scale/100,scale/100);
 for(const p of calendarLayout(image.naturalWidth||image.width,image.naturalHeight||image.height,rotation)){
  if(p.type==='photo'){c.save();if(p.rotation===90){c.translate(p.x+p.w,p.y);c.rotate(Math.PI/2);c.drawImage(image,0,0,p.h,p.w);}else c.drawImage(image,p.x,p.y,p.w,p.h);c.restore();}
  else if(p.type==='line'){c.strokeStyle=p.color;c.lineWidth=.8;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+p.w,p.y+p.h);c.stroke();}
  else{c.fillStyle=p.color;c.font=`${p.font==='italic'?'italic ':''}${p.size}px ${p.font==='sans'?'Helvetica, Arial':'Times New Roman, Times, serif'}`;c.fillText(p.value,p.x,p.y);}
 }c.restore();
}

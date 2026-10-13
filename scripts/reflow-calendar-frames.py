from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import json,hashlib,shutil
r=Path(__file__).resolve().parents[1];frames=json.loads((r/'dist/frames.json').read_text());backup=Path('/private/tmp/askive-before-reflow');backup.mkdir(exist_ok=True)
if all(f.get('layoutVersion')=='calendar-tall-v1' for f in frames):
 print('All frames already migrated; no changes.');raise SystemExit(0)
(backup/'frames.json').write_text(json.dumps(frames,ensure_ascii=False,indent=2))
report=[];thumbs=[]
for f in frames:
 
 if f.get('layoutVersion')=='calendar-tall-v1':continue
 src=r/'dist'/f['src'];im=Image.open(src).convert('RGBA');ow,oh=im.size;wide=ow>oh
 # Work along long axis; only open photo-center bands gain height.
 work=im.transpose(Image.Transpose.TRANSPOSE) if wide else im
 W,H=work.size;target=round(W*16/9);extra=target-H
 slots=[]
 for a,b,c,d in f['slots']:
  slots.append([b*oh,a*ow,d*oh,c*ow] if wide else [a*ow,b*oh,c*ow,d*oh])
 centers=sorted(y+h/2 for x,y,w,h in slots);groups=[]
 for v in centers:
  if groups and v-sum(groups[-1])/len(groups[-1])<H*.1:groups[-1].append(v)
  else:groups.append([v])
 alpha=work.getchannel('A');bands=[]
 for group in groups:
  mid=round(sum(group)/len(group));half=round(min(s[3] for s in slots)*.12)
  candidates=[]
  for y in range(max(1,mid-half),min(H-17,mid+half)):
   # Do not split any photo edge; preserve corners and artwork outside these bands.
   if any(abs(y-edge)<24 or abs(y+16-edge)<24 for s in slots for edge in [s[1],s[1]+s[3]]):continue
   hist=alpha.crop((0,y,W,y+16)).histogram();candidates.append((sum(hist[:8]),-abs(y-mid),y))
  bands.append((max(candidates)[2] if candidates else mid,16))
 bands=sorted(set(bands));increments=[extra//len(bands)]*len(bands)
 for i in range(extra%len(bands)):increments[i]+=1
 dest=Image.new('RGBA',(W,target));prev=0;dy=0;segments=[]
 for (y,h),add in zip(bands,increments):
  if y<prev:raise Exception('overlap')
  dest.paste(work.crop((0,prev,W,y)),(0,dy));dy+=y-prev
  strip=work.crop((0,y,W,y+h));dest.paste(strip.resize((W,h+add),Image.Resampling.BICUBIC),(0,dy));segments.append((y,h,add));dy+=h+add;prev=y+h
 dest.paste(work.crop((0,prev,W,H)),(0,dy))
 def mapped(y):
  return y+sum(add*min(1,max(0,(y-start)/h)) for start,h,add in segments)
 transformed=[]
 for x,y,w,h in slots:
  yy=mapped(y);hh=mapped(y+h)-yy
  transformed.append([yy/target,x/W,hh/target,w/W] if wide else [x/W,yy/target,w/W,hh/target])
 if wide:dest=dest.transpose(Image.Transpose.TRANSPOSE)
 new=r/'dist/frames'/f'{f["id"]}-calendar-print.png';dest.save(new,optimize=True)
 oldsrc=f['src'];f['src']=str(new.relative_to(r/'dist'));f['slots']=transformed;f['sourceWidth'],f['sourceHeight']=dest.size;f['layoutVersion']='calendar-tall-v1'
 thumb=dest.copy();thumb.thumbnail((300,444));tp=r/'dist/frames'/f'{f["id"]}-calendar-thumb.webp';thumb.save(tp,'WEBP',quality=88);f['thumbnail']=str(tp.relative_to(r/'dist'))
 preview=dest.copy();preview.thumbnail((960,960));data=Path('/private/tmp/frame-preview.webp');preview.save(data,'WEBP',quality=90);digest=hashlib.sha256(data.read_bytes()).hexdigest()[:10];pp=r/'dist/frames'/f'{f["id"]}-screen-{digest}.webp';shutil.copy2(data,pp);f['preview']=str(pp.relative_to(r/'dist'))
 report.append({'id':f['id'],'oldSrc':oldsrc,'size':dest.size,'bands':segments})
 if f['edition']=='special' or f['color']=='beige':
  tile=Image.new('RGB',(230,330),'#ddd');t=dest.copy();t.thumbnail((215,300));white=Image.new('RGBA',t.size,'white');white.alpha_composite(t);tile.paste(white.convert('RGB'),((230-t.width)//2,0));ImageDraw.Draw(tile).text((4,307),f['id'].replace('hanmaeum-2026-','')[:33],fill='black');thumbs.append(tile)
(r/'dist/frames.json').write_text(json.dumps(frames,ensure_ascii=False,indent=2)+'\n');(r/'docs/calendar-frame-reflow.json').write_text(json.dumps(report,indent=2)+'\n')
sheet=Image.new('RGB',(230*6,330*((len(thumbs)+5)//6)),'white')
for i,t in enumerate(thumbs):sheet.paste(t,((i%6)*230,(i//6)*330))
sheet.save('/private/tmp/reflow-contact.png');print('Reflowed',len(frames),'frames; artwork outside photo-center bands retained at original scale')

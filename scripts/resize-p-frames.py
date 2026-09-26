from pathlib import Path
import json,xml.etree.ElementTree as E,copy,re,shutil
r=Path(__file__).resolve().parents[1];ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
frames=json.loads((r/'dist/frames.json').read_text());layouts=json.loads((r/'deliverables/frame-guide-P/layouts.json').read_text());details=[]
if all(f.get('paper')=='selphy-p' for f in frames):
 print('All registered frames already use SELPHY P; no changes.');raise SystemExit(0)
base=E.parse(r/'dist/frames/club-grid.svg').getroot();logo=next(e for e in base if e.get('id')=='yonsei-frame-logo')
for f in frames:
 p=r/'dist'/f['src'];old=E.parse(p).getroot();ow=float(old.get('width'));oh=float(old.get('height'))
 if f.get('paper')=='selphy-p':continue
 if f.get('edition')=='basic':
  slots=layouts[str(f['count'])]['slots']
  if 'strip' in f['id']:slots=[[48,48+i*336,1104,312] for i in range(4)]
  color='#f5d9d7' if 'rose' in f['id'] else '#dceaf4' if 'sky' in f['id'] else '#e9efdf'
  root=E.Element('{'+ns+'}svg',width='1200',height='1776',viewBox='0 0 1200 1776')
  path='M0 0H1200V1776H0Z '+' '.join(f'M{x} {y}h{w}v{h}h-{w}Z' for x,y,w,h in slots)
  E.SubElement(root,'{'+ns+'}path',{'fill':color,'fill-rule':'evenodd','d':path})
  l=copy.deepcopy(logo);l.set('transform','translate(210 1470) scale(1.35)');l.set('color','#84505a' if 'rose' in f['id'] else '#35556d' if 'sky' in f['id'] else '#234c40');root.append(l)
 else:
  scale=min(1200/ow,1776/oh);w=ow*scale;h=oh*scale;x=(1200-w)/2;y=(1776-h)/2
  slots=[[round(x+a*ow*scale),round(y+b*oh*scale),round(c*ow*scale),round(d*oh*scale)] for a,b,c,d in f['slots']]
  root=E.Element('{'+ns+'}svg',width='1200',height='1776',viewBox='0 0 1200 1776')
  # Opaque extension outside the original artwork; transparent photo holes stay clear.
  for xx,yy,ww,hh in [(0,0,1200,y),(0,y+h,1200,1776-y-h),(0,y,x,h),(x+w,y,1200-x-w,h)]:
   if ww>0 and hh>0:E.SubElement(root,'{'+ns+'}rect',x=str(xx),y=str(yy),width=str(ww),height=str(hh),fill='#252c36')
  g=E.SubElement(root,'{'+ns+'}g',transform=f'translate({x} {y}) scale({scale})')
  for child in old:g.append(child)
 E.ElementTree(root).write(p,encoding='unicode')
 f['slots']=[[x/1200,y/1776,w/1200,h/1776] for x,y,w,h in slots];f['paper']='selphy-p'
 details.append({'id':f['id'],'name':f['name'],'count':f['count'],'width':1200,'height':1776,'slots_pixels':slots})
(r/'dist/frames.json').write_text(json.dumps(frames,ensure_ascii=False,indent=2)+'\n');(r/'docs/frame-layouts.json').write_text(json.dumps(details,ensure_ascii=False,indent=2))
(r/'docs/templates/selphy-p').mkdir(exist_ok=True)
for p in (r/'deliverables/frame-guide-P').glob('*'):
 if p.suffix in ['.png','.svg','.json']:shutil.copy2(p,r/'docs/templates/selphy-p'/p.name)
# The upload fallback must match the guide exactly. Preserve legacy aspect-ratio uploads.
p=r/'dist/app.js';s=p.read_text();needle='  const x = Math.round(width*42/1080)'
insert="""  if(Math.abs(width/height-100/148)<.002){
    const cols=count>=4?2:1,rows=Math.ceil(count/cols),w=(1104-(cols-1)*24)/cols,h=(1320-(rows-1)*24)/rows;
    return {width,height,slots:Array.from({length:count},(_,i)=>({x:Math.round((48+i%cols*(w+24))*width/1200),y:Math.round((48+Math.floor(i/cols)*(h+24))*height/1776),w:Math.round(w*width/1200),h:Math.round(h*height/1776)}))};
  }
"""
assert needle in s;s=s.replace(needle,insert+needle);p.write_text(s)

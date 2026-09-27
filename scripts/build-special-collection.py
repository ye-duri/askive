from pathlib import Path
import json,base64
R=Path(__file__).resolve().parents[1]
def data(p,mime='image/png'):return 'data:'+mime+';base64,'+base64.b64encode((R/p).read_bytes()).decode()
logo=data('dist/frames/yonsei-signature.svg','image/svg+xml');font=data('dist/fonts/SUIT-Variable.woff2','font/woff2')
themes=[('farewell','잘 다녀와','#E9E8D5','#495B40','SEE YOU','SOON!'),('club','우리의 모임','#DCE8FA','#315582','OUR','MOMENTS'),('friends','베스트 프렌드','#F5DDE6','#9C4565','BEST','TOGETHER'),('garden','클로버 가든','#E1EDBC','#52713D','LUCKY','US!')]
def shape(x,y,w,h,kind,fill,stroke='none',sw=0):
 attrs=f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
 if kind=='oval':return f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" {attrs}/>'
 if kind=='arch':
  r=min(w/2,h*.45);return f'<path d="M{x} {y+h}V{y+r}A{w/2} {r} 0 0 1 {x+w} {y+r}V{y+h}Z" {attrs}/>'
 if kind=='cloud':
  return f'<path d="M{x+w*.18} {y+h*.08}Q{x+w*.5} {y-h*.08} {x+w*.82} {y+h*.08}Q{x+w*1.04} {y+h*.15} {x+w*.94} {y+h*.43}Q{x+w*1.08} {y+h*.72} {x+w*.83} {y+h*.9}Q{x+w*.5} {y+h*1.08} {x+w*.17} {y+h*.9}Q{x-w*.08} {y+h*.72} {x+w*.06} {y+h*.43}Q{x-w*.04} {y+h*.15} {x+w*.18} {y+h*.08}Z" {attrs}/>'
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{30 if kind=="round" else 8}" {attrs}/>'
frames=[]
for theme,name,bg,ink,t1,t2 in themes:
 for variant,count in [('four',4),('six',6),('wide',4)]:
  W,H=(1776,1200) if variant=='wide' else (1200,1776);rows=count//2
  left,top,gap=(136,90,28) if variant=='wide' else (72,190,44);bottom=H-(192 if variant=='wide' else 240);sw=(W-2*left-gap)/2
  stagger=70 if variant!='wide' else 28
  sh=(bottom-top-stagger-gap*(rows-1))/rows
  slots=[[left+c*(sw+gap),top+r*(sh+gap)+(stagger if c else 0),sw,sh] for r in range(rows) for c in range(2)]
  kinds=[('rect' if theme=='farewell' else 'round' if theme=='club' else ('oval' if i%2==0 else 'round') if theme=='friends' else ('arch' if i%2==0 else 'cloud')) for i in range(count)]
  a=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><style>@font-face{{font-family:SUIT;src:url({font}) format("woff2")}}text{{font-family:SUIT,sans-serif}}</style><mask id="cut"><rect width="{W}" height="{H}" fill="white"/>']
  a += [shape(*slot,k,'black') for slot,k in zip(slots,kinds)]
  a.append(f'</mask></defs><g mask="url(#cut)"><rect width="{W}" height="{H}" fill="{bg}"/>')
  if theme=='club':
   for x in range(20,W,46):a.append(f'<path d="M{x} 0V{H}" stroke="{ink}" opacity=".12"/>')
   for y in range(20,H,46):a.append(f'<path d="M0 {y}H{W}" stroke="{ink}" opacity=".12"/>')
  elif theme=='friends':
   for x in range(0,W,72):a.append(f'<path d="M{x} 0V{H}" stroke="#fff" stroke-width="28" opacity=".25"/>')
  elif theme=='farewell':
   a.append(f'<path d="M32 35H{W-32}V{H-35}H32Z" fill="none" stroke="{ink}" stroke-width="4" stroke-dasharray="12 10"/>')
  else:
   for x,y in [(42,110),(W-42,180),(36,H*.5),(W-40,H*.65),(45,H-120)]:
    a.append(f'<g fill="{ink}" transform="translate({x} {y})">'+''.join(f'<ellipse cx="{dx}" cy="{dy}" rx="13" ry="19" transform="rotate({rot} {dx} {dy})"/>' for dx,dy,rot in [(-10,-10,-45),(10,-10,45),(-10,10,45),(10,10,-45)])+'</g>')
  title_y,subtitle_y,title_size,subtitle_size=(38,67,34,22) if variant=='wide' else (94,147,62,42)
  a.append(f'<text x="76" y="{title_y}" font-size="{title_size}" font-weight="850" letter-spacing="-2" fill="{ink}">{t1}</text><text x="80" y="{subtitle_y}" font-size="{subtitle_size}" font-weight="600" letter-spacing="5" fill="{ink}">{t2}</text>')
  a.append(f'<path d="M{W-340} {38 if variant=="wide" else 72}q80 -48 142 8t122 0" fill="none" stroke="{ink}" stroke-width="4" stroke-linecap="round"/>')
  for i,((x,y,w,h),kind) in enumerate(zip(slots,kinds)):
   a.append(shape(x-9,y-9,w+18,h+18,kind,'#FFFDF8'))
   a.append(shape(x-4,y-4,w+8,h+8,kind,'none',ink,3))
   if theme in ('club','farewell'):
    a.append(f'<rect x="{x+w*.25}" y="{y-20}" width="{w*.36}" height="35" fill="{("#F3BC7C" if theme=="club" else "#AAB592")}" transform="rotate({-5 if i%2==0 else 4} {x+w/2} {y})"/>')
   a.append(f'<text x="{x+12}" y="{y+h+25}" font-size="18" font-weight="700" fill="{ink}">0{i+1} / OUR DAYS</text>')
  a.append(f'<image href="{logo}" x="78" y="{H-177}" width="210" height="118"/></g>')
  # Foreground illustrations deliberately cross slot edges after the hole mask.
  for i in [0,count-1]:
   x,y,w,h=slots[i];pw=min(w*.58,310);ph=pw*.52
   # Place across the bottom corner, leaving the face center open.
   px=x+w-pw*.83 if i==0 else x-pw*.17;py=y+h-ph*.64
   a.append(f'<svg x="{px}" y="{py}" width="{pw}" height="{ph}" viewBox="235 245 1220 535"><image href="{data("branding/special/sheep-peek-v2.png")}" width="1680" height="960"/></svg>')
  if theme=='farewell':
   a.append(f'<image href="{data("branding/special/sheep-farewell.png")}" x="{W/2-145}" y="{H-250}" width="290" height="235"/>')
  else:
   a.append(f'<text x="{W/2}" y="{H-78}" text-anchor="middle" font-size="20" letter-spacing="3" font-weight="650" fill="{ink}">YONSEI / SPECIAL EDITION</text>')
  a.append('</svg>');id=f'sheep-{theme}-{variant}';(R/f'dist/frames/{id}.svg').write_text(''.join(a))
  frames.append(dict(id=id,name=f'{name} · {"가로 4컷" if variant=="wide" else str(count)+"컷"}',src=f'frames/{id}.svg',count=count,edition='special',paper='selphy-p',slots=[[x/W,y/H,w/W,h/H] for x,y,w,h in slots]))
p=R/'dist/frames.json';old=json.loads(p.read_text());p.write_text(json.dumps([f for f in old if not f['id'].startswith('sheep-')]+frames,ensure_ascii=False,indent=2)+'\n')
print('Redesigned',len(frames),'special frames')

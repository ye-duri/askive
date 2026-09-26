from pathlib import Path
import json,base64
R=Path(__file__).resolve().parents[1]
def data(p,mime='image/png'):return 'data:'+mime+';base64,'+base64.b64encode((R/p).read_bytes()).decode()
logo=data('dist/frames/yonsei-signature.svg','image/svg+xml')
themes=[('farewell','잘 다녀와','#EEEBDC','#65704F','SEE YOU SOON','sheep-farewell.png'),('club','우리의 모임','#E5ECF7','#657FAD','OUR LITTLE CLUB','sheep-friends.png'),('friends','베스트 프렌드','#F8E8EA','#BE7389','BETTER TOGETHER','sheep-friends.png'),('garden','클로버 가든','#EAF0D9','#688455','A LITTLE GOOD LUCK','sheep-friends.png')]
frames=[]
for theme,name,bg,ink,title,mascot in themes:
 for variant,count in [('four',4),('six',6),('wide',4)]:
  W,H=(1776,1200) if variant=='wide' else (1200,1776)
  left,top,gap=70,150,32
  bottom=H-290
  rows=count//2
  sw=(W-2*left-gap)/2;sh=(bottom-top-gap*(rows-1))/rows
  slots=[[left+c*(sw+gap),top+r*(sh+gap),sw,sh] for r in range(rows) for c in range(2)]
  a=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><mask id="cut"><rect width="{W}" height="{H}" fill="white"/>']
  for x,y,w,h in slots:a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{32 if theme=="friends" else 12}" fill="black"/>')
  a.append(f'</mask></defs><g mask="url(#cut)"><rect width="{W}" height="{H}" fill="{bg}"/>')
  if theme=='club':
   for x in range(0,W,40):a.append(f'<path d="M{x} 0V{H}" stroke="{ink}" opacity=".13"/>')
   for y in range(0,H,40):a.append(f'<path d="M0 {y}H{W}" stroke="{ink}" opacity=".13"/>')
  elif theme=='friends':
   for x in range(24,W,70):
    for y in range(24,H,70):a.append(f'<circle cx="{x}" cy="{y}" r="3" fill="{ink}" opacity=".3"/>')
  elif theme=='farewell':
   a.append(f'<rect x="25" y="25" width="{W-50}" height="{H-50}" rx="20" fill="none" stroke="{ink}" stroke-width="3" stroke-dasharray="12 10"/>')
  else:
   for x,y in [(37,96),(W-35,94),(35,H//2),(W-35,H//2),(44,H-90)]:
    a.append(f'<g fill="{ink}" opacity=".6">'+''.join(f'<ellipse cx="{x+dx}" cy="{y+dy}" rx="9" ry="14" transform="rotate({rot} {x+dx} {y+dy})"/>' for dx,dy,rot in [(-7,-7,-45),(7,-7,45),(-7,7,45),(7,7,-45)])+'</g>')
  a.append(f'<text x="{W/2}" y="92" text-anchor="middle" font-family="Georgia,serif" font-size="32" letter-spacing="5" fill="{ink}">{title}</text>')
  for x,y,w,h in slots:
   a.append(f'<rect x="{x-7}" y="{y-7}" width="{w+14}" height="{h+14}" rx="{39 if theme=="friends" else 19}" fill="none" stroke="{ink}" stroke-width="3"/>')
   if theme=='club':a.append(f'<rect x="{x+w/2-55}" y="{y-16}" width="110" height="26" fill="#C7D2AB" opacity=".85" transform="rotate(-4 {x+w/2} {y})"/>')
  a.append(f'<image href="{logo}" x="78" y="{H-205}" width="230" height="128"/>')
  a.append(f'<image href="{data("branding/special/"+mascot)}" x="{W/2-210}" y="{H-282}" width="420" height="264"/>')
  a.append('</g></svg>')
  id=f'sheep-{theme}-{variant}';(R/f'dist/frames/{id}.svg').write_text(''.join(a))
  frames.append(dict(id=id,name=f'{name} · {"가로 4컷" if variant=="wide" else str(count)+"컷"}',src=f'frames/{id}.svg',count=count,edition='special',paper='selphy-p',slots=[[x/W,y/H,w/W,h/H] for x,y,w,h in slots]))
p=R/'dist/frames.json';old=json.loads(p.read_text());p.write_text(json.dumps([f for f in old if not f['id'].startswith('sheep-')]+frames,ensure_ascii=False,indent=2)+'\n')
print('Created',len(frames),'special frames')

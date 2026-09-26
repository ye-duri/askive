from pathlib import Path
import json,base64
r=Path(__file__).resolve().parents[1]
ink=base64.b64encode((r/'branding/signature/yonsei-signature.png').read_bytes()).decode()
colors=[('black','검정','#171717','#FFFFFF'),('white','흰색','#FFFFFF','#772F40'),('cherry','체리 레드','#B83A48','#FFFFFF'),('pink','분홍','#E78FA6','#772F40'),('beige','베이지','#EFE5D3','#654536'),('khaki','카키','#82835A','#FFFFFF'),('lime','라임','#CEDF6C','#254632'),('sora','소라','#B6C5EA','#243C68'),('dusty','더스티 블루','#6D88A7','#FFFFFF')]
layouts={
2:[('side','좌우',[[48,48,540,1440],[612,48,540,1440]]),('wide','상하',[[48,48,1104,708],[48,780,1104,708]]),('offset','엇갈림',[[48,48,540,1280],[612,208,540,1280]])],
4:[('grid','기본 2×2',[[x,y,540,708] for y in [48,780] for x in [48,612]]),('offset','엇갈림',[[48,48,540,628],[612,208,540,628],[48,700,540,628],[612,860,540,628]]),('landscape','가로 2×2',[[x,y,828,432] for y in [48,504] for x in [48,900]])],
6:[('grid','2열',[[x,y,540,464] for y in [48,536,1024] for x in [48,612]]),('wide','3열',[[x,y,352,708] for y in [48,780] for x in [48,424,800]]),('offset','엇갈림',[[x,48+i*448+(128 if col else 0),540,424] for i in range(3) for col,x in enumerate([48,612])])]
}
def logo(color,x,y,w,h):
 return f'<defs><filter id="ink" x="0" y="0" width="100%" height="100%"><feFlood flood-color="{color}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="216 21 1351 753"><image width="1774" height="887" href="data:image/png;base64,{ink}" filter="url(#ink)"/></svg>'
old=json.loads((r/'dist/frames.json').read_text());frames=[];details=[]
for count,variants in layouts.items():
 for layout,title,slots in variants:
  for color,name,bg,fg in colors:
   id=f'basic-{count}-{layout}-{color}';src=f'frames/{id}.svg'
   W,H=(1776,1200) if layout=='landscape' else (1200,1776)
   lx,ly,lw,lh=(726,972,324,181) if layout=='landscape' else (438,1524,324,181)
   d=f'M0 0H{W}V{H}H0Z '+' '.join(f'M{x} {y}h{w}v{h}h-{w}Z' for x,y,w,h in slots)
   svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><path fill="{bg}" fill-rule="evenodd" d="{d}"/>'+logo(fg,lx,ly,lw,lh)+'</svg>'
   (r/'dist'/src).write_text(svg)
   frames.append(dict(id=id,name=name,layout=layout,layoutName=title,color=color,src=src,count=count,edition='basic',paper='selphy-p',slots=[[x/W,y/H,w/W,h/H] for x,y,w,h in slots]))
   details.append(dict(id=id,name=f'{count}컷 {title} · {name}',width=W,height=H,slots_pixels=slots))
frames.extend(f for f in old if f.get('edition')=='special')
(r/'dist/frames.json').write_text(json.dumps(frames,ensure_ascii=False,indent=2)+'\n')
(r/'docs/basic-frame-layouts.json').write_text(json.dumps(details,ensure_ascii=False,indent=2)+'\n')
(r/'dist/frames/yonsei-signature.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="223" viewBox="0 0 400 223">'+logo('#253B37',0,0,400,223)+'</svg>')
p=r/'dist/index.html';s=p.read_text().replace('src="frames/askive-logo.svg"','src="frames/yonsei-signature.svg"').replace('<strong>YONSEI STUDIO</strong><span>우리의 순간을 모으다</span>','<strong>연세스튜디오</strong><span>우리의 순간을 모으다</span>').replace('src="frames/club-grid.svg"','src="frames/basic-4-grid-beige.svg"');p.write_text(s)
print('Generated',len(details),'basic frames and preserved',len(frames)-len(details),'special frames')

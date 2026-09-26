"""Rebuild outlined Yonsei Studio SVG identity and frame footer marks.
Requires fonttools. Photos and slot geometry are preserved.
"""
from pathlib import Path
import json,copy,xml.etree.ElementTree as E
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
R=Path(__file__).resolve().parents[1]; D=R/'dist'; NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
def lettering(text,file,size,x,y,spacing=0):
 f=TTFont(file);g=f.getGlyphSet();c=f.getBestCmap();scale=size/f['head'].unitsPerEm;out=[]
 for char in text:
  glyph=c[ord(char)];pen=SVGPathPen(g);g[glyph].draw(pen)
  out.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({scale:.5f} {-scale:.5f})"/>');x+=g[glyph].width*scale+spacing
 return ''.join(out)
ko=lettering('연세스튜디오',D/'fonts/nanum-pen.ttf',108,122,96,-2)
en=lettering('YONSEI STUDIO','/System/Library/Fonts/Supplemental/Arial.ttf',16,139,122,4)
mark='''<g transform="translate(10 18) rotate(-7 46 46)"><rect x="7" y="7" width="80" height="80" rx="24" fill="#e7eece"/><path d="M27 3H13A10 10 0 0 0 3 13V28M67 3h14a10 10 0 0 1 10 10v14M91 67v14a10 10 0 0 1-10 10H67M27 91H13A10 10 0 0 1 3 81V67" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><g transform="translate(47 47)" fill="currentColor"><ellipse cy="-12" rx="10" ry="16"/><ellipse cy="-12" rx="10" ry="16" transform="rotate(90)"/><ellipse cy="-12" rx="10" ry="16" transform="rotate(180)"/><ellipse cy="-12" rx="10" ry="16" transform="rotate(270)"/><circle r="7" fill="#faf8ef"/></g><circle cx="84" cy="8" r="8" fill="#ed927a" stroke="#faf8ef" stroke-width="3"/></g>'''
body=f'{mark}<g fill="currentColor">{ko}{en}</g>'
logo=f'<svg xmlns="{NS}" width="560" height="140" viewBox="0 0 560 140" role="img" aria-label="연세스튜디오" color="#234c40">{body}</svg>'
for p in [D/'frames/askive-logo.svg',R/'branding/yonsei-studio-logo.svg']:
 p.write_text(logo)
(D/'frames/askive-mark.svg').write_text(f'<svg xmlns="{NS}" viewBox="0 0 114 130" color="#234c40">{mark}</svg>')
(R/'branding/yonsei-studio-mark.svg').write_text((D/'frames/askive-mark.svg').read_text())
for f in json.loads((D/'frames.json').read_text()):
 p=D/f['src'];root=E.parse(p).getroot();w,h=map(float,[root.get('width'),root.get('height')]);
 bottom=max((y+hh)*h for x,y,ww,hh in f.get('slots',[[42/1080,42/1440,486/1080,576/1440],[552/1080,642/1440,486/1080,576/1440]]))
 # Only remove generated footer lettering, leaving all artwork and photo openings.
 for e in list(root):
  if e.get('id') in ['askive-frame-logo','askive-frame-subtitle','yonsei-frame-logo'] or e.tag==f'{{{NS}}}text' and float(e.get('y','0'))>bottom:root.remove(e)
 space=h-bottom;lw=min(w*.57,(space-30)*4);lh=lw/4
 ink='#f7f2e7' if f['edition']=='special' else {'rose':'#854e5b','sky':'#345b72'}.get(f['id'].split('-')[0],'#234c40')
 group=E.fromstring(f'<g xmlns="{NS}" id="yonsei-frame-logo" color="{ink}" transform="translate({(w-lw)/2} {bottom+(space-lh)/2}) scale({lw/560})">{body}</g>');root.append(group);p.write_text(E.tostring(root,encoding='unicode'))
(R/'branding/README-YONSEI.md').write_text('''# 연세스튜디오 로고

초점 프레임 + 꽃잎처럼 펼쳐진 셔터 + 손글씨 워드마크.
- SVG: 모든 글자를 윤곽선으로 변환해 기기별 폰트 차이 없음.
- 녹색 #234C40 / 크림 #FAF8EF / 코랄 #ED927A.
- 사용 폰트: Nanum Pen Script (OFL, dist/fonts/OFL.txt), 영문 Arial 윤곽선.
- 페이지 헤더, 파비콘, 기본 프레임 하단, QR 출력 하단에 반영.
- 사진 영역/프레임 비율은 변경하지 않음.
''')

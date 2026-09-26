"""Rebuild outlined Yonsei Studio SVG identity and frame footer marks.
Requires fonttools. Photos and slot geometry are preserved.
"""
from pathlib import Path
import json,copy,xml.etree.ElementTree as E
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
R=Path(__file__).resolve().parents[1]; D=R/'dist'; NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
def lettering(text,file,size,x,y,spacing=0):
 f=TTFont(file,fontNumber=16) if str(file).endswith(".ttc") else TTFont(file);g=f.getGlyphSet();c=f.getBestCmap();scale=size/f['head'].unitsPerEm;out=[]
 for char in text:
  glyph=c[ord(char)];pen=SVGPathPen(g);g[glyph].draw(pen)
  out.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({scale:.5f} {-scale:.5f})"/>');x+=g[glyph].width*scale+spacing
 return ''.join(out)
ko=lettering('연세스튜디오','/System/Library/Fonts/AppleSDGothicNeo.ttc',79,8,87,-4)
en=lettering('YONSEI / STUDIO','/System/Library/Fonts/Supplemental/Arial Bold.ttf',18,13,124,3)
mark='<path d="m510 17 11 28 29 11-29 11-11 29-11-29-29-11 29-11z" fill="#a897e2"/>'
body=f'{mark}<g fill="currentColor">{ko}{en}</g>'
logo=f'<svg xmlns="{NS}" width="560" height="140" viewBox="0 0 560 140" role="img" aria-label="연세스튜디오" color="#202023">{body}</svg>'
for p in [D/'frames/askive-logo.svg',R/'branding/yonsei-studio-logo.svg']:
 p.write_text(logo)
(D/'frames/askive-mark.svg').write_text(f'<svg xmlns="{NS}" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#202023"/><path d="m50 14 10 26 26 10-26 10-10 26-10-26-26-10 26-10z" fill="#c9baf2"/></svg>')
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

굵고 촘촘한 한글 워드마크 + 라벤더 플래시 심볼 + 영문 서브라인.
- SVG: 모든 글자를 윤곽선으로 변환해 기기별 폰트 차이 없음.
- 차콜 #202023 / 라벤더 #A897E2.
- 사용 폰트: Apple SD Gothic Neo Heavy, Arial Bold 윤곽선. 폰트 파일은 배포하지 않음.
- 페이지 헤더, 파비콘, 기본 프레임 하단, QR 출력 하단에 반영.
- 사진 영역/프레임 비율은 변경하지 않음.
''')

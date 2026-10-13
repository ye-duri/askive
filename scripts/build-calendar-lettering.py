import sys,json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.qu2cuPen import Qu2CuPen
from fontTools.pens.basePen import BasePen
class Paths(BasePen):
 def __init__(self,gs):super().__init__(gs);self.commands=[]
 def _moveTo(self,p):self.commands.append(['M',*p])
 def _lineTo(self,p):self.commands.append(['L',*p])
 def _curveToOne(self,p1,p2,p3):self.commands.append(['C',*p1,*p2,*p3])
 def _closePath(self):self.commands.append(['Z'])
 def _endPath(self):pass
out={}
for key,file in [('heading','Arial Bold.ttf'),('condensed','DIN Condensed Bold.ttf')]:
 f=TTFont('/System/Library/Fonts/Supplemental/'+file);gs=f.getGlyphSet();cmap=f.getBestCmap();glyphs={}
 for c in ' ABCDEFGHIJKLMNOPQRSTUVWXYZ.,!0123456789':
  name=cmap[ord(c)];p=Paths(gs);gs[name].draw(p)
  commands=[[v if isinstance(v,str) else round(v,3) for v in cmd] for cmd in p.commands]
  glyphs[c]={'advance':f['hmtx'][name][0],'path':commands}
 out[key]={'units':f['head'].unitsPerEm,'glyphs':glyphs}
output=Path(__file__).resolve().parents[1]/'mac-print/public/calendar-fonts.mjs'
output.write_text('// Calendar lettering as vector outlines: identical in canvas and print PDF.\nexport const calendarFonts='+json.dumps(out,separators=(',',':'))+';\n')
(output.parents[2]/'dist/print/calendar-fonts.mjs').write_bytes(output.read_bytes())
print('Vector font module bytes',output.stat().st_size)

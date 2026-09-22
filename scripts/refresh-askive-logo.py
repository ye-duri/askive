from pathlib import Path
import json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]; d=root/'dist'; ns='http://www.w3.org/2000/svg'; ET.register_namespace('',ns)
typeface=ET.fromstring((root/'branding/type-editorial.svg').read_text())
typeWidth=float(typeface.get('viewBox').split()[2])
paths=''.join(ET.tostring(c,encoding='unicode') for c in typeface)
def body(ink='#151a17',accent='#a15740'):
 return f'<g transform="translate(-68 -52)"><path d="M99 71H77v79h22m402-79h22v79h-22" fill="none" stroke="{accent}" stroke-width="2"/><g transform="translate(118 57) scale({365/typeWidth})" color="{ink}">{paths}</g></g>'
logo=f'<svg xmlns="{ns}" viewBox="0 0 464 106" role="img" aria-label="ASKIVE">{body()}</svg>'
(d/'frames/askive-logo.svg').write_text(logo);(root/'branding/askive-logo.svg').write_text(logo)
mark=f'<svg xmlns="{ns}" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="#faf8f2"/><path d="M11 10H6v28h5m26-28h5v28h-5" fill="none" stroke="#a15740" stroke-width="1.5"/><path d="m14 35 10-24 10 24h-7l-3-8h-6l-3 8zm5-10h4l-2-6z" fill="#151a17"/></svg>'
(d/'frames/askive-mark.svg').write_text(mark)
frames=json.loads((d/'frames.json').read_text())
for f in frames:
 p=d/f['src'];tree=ET.fromstring(p.read_text());groups=[e for e in tree if e.tag==f'{{{ns}}}g'];old=next((g for g in groups if g.get('id')=='askive-frame-logo'),groups[0])
 colors={'rose':'#8e4e58','sky':'#34566f','club':'#284d3f'};ink=next((v for k,v in colors.items() if f['id'].startswith(k)),'#f5f4ed')
 replacement=ET.fromstring(f'<g xmlns="{ns}" id="askive-frame-logo" transform="{old.attrib["transform"]}"><g transform="translate(0 -10) scale({318/464})">{body(ink,ink if ink!="#f5f4ed" else "#c7b5a8")}</g></g>')
 tree.remove(old);tree.append(replacement)
 for child in list(tree):
  if child.get('id')=='askive-frame-subtitle':tree.remove(child)
 width=float(tree.get('width'));height=float(tree.get('height'));center=width/2
 subtitle=ET.Element(f'{{{ns}}}g',{'id':'askive-frame-subtitle','aria-label':'ASK + ARCHIVE · 우리의 순간을 모으다'})
 for filename,y,fontHeight in [('tagline-en.svg',height-69,15 if width>600 else 13),('tagline-ko.svg',height-43,18 if width>600 else 16)]:
  src=ET.fromstring((root/'branding'/filename).read_text());sw=float(src.get('viewBox').split()[2]);scale=fontHeight/75
  wrap=ET.SubElement(subtitle,f'{{{ns}}}g',{'transform':f'translate({center-sw*scale/2} {y}) scale({scale})','color':ink})
  for child in src:wrap.append(child)
 tree.append(subtitle);p.write_text(ET.tostring(tree,encoding='unicode'))

"""Asset compatibility and actual HTTP byte-range regression checks."""
from pathlib import Path
import json, re, subprocess, urllib.request, wave
import numpy as np
from atlas import load, ROOT

report=[]
for source,kind in [('musculos-zanatomy','musculo'),('esqueleto','hueso')]:
    parts=load(source);count=sum(len(p['pos']) for p in parts)
    ao=np.fromfile(ROOT/'piezas'/f'detalle-{kind}.bin',dtype='<f4')
    assert len(ao)==count,(kind,len(ao),count)
    assert np.isfinite(ao).all() and ao.min()>=.27 and ao.max()<=1
    assert ao.std()>.02,'Occlusion must actually vary across the model'
    report.append(f'{kind}: {count} vertices with compatible nonuniform occlusion')
html=(ROOT/'index.html').read_text(encoding='utf-8')
script=re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)
p=subprocess.run(['node','--input-type=module','--check'],input=script,text=True,encoding='utf-8',capture_output=True)
assert p.returncode==0,p.stderr
subprocess.run(['node','--check',str(ROOT/'director-detalle.js')],check=True)
with wave.open(str(ROOT/'cine-preview.wav')) as w:
    assert w.getnframes()/w.getframerate()==24 and w.getnchannels()==2
request=urllib.request.Request('http://127.0.0.1:8769/cine-preview.wav',headers={'Range':'bytes=2048-4095'})
with urllib.request.urlopen(request) as r:
    payload=r.read();assert r.status==206 and len(payload)==2048
assert payload==(ROOT/'cine-preview.wav').read_bytes()[2048:4096]
report+=['Inline JS and director syntax valid','24 s stereo audio','HTTP seek range returns exact requested bytes']
(ROOT/'verificacion-detalle.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('\n'.join(report))

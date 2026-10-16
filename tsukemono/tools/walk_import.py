# エディタで作った歩くアニメのシート（assets/editor/<名前>.sheet.png）を、ゲームの絵に取りこむ。  python3 tools/walk_import.py
# 1コマずつ assets/img/walk_<名前>_<k>.png に切り出し、assets/walk.js（位置・長さ）を書く。
# シートは上に1行の余白つき（体が浮くぶん）。足もとの位置（ax）は元のポーズと同じ。
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ED = os.path.join(HERE, '..', 'assets', 'editor')
IMG = os.path.join(HERE, '..', 'assets', 'img')
trace = open(os.path.join(HERE, '..', 'assets', 'trace.js'), encoding='utf8').read()
TRACE = json.loads(trace[trace.index('{'):trace.rindex('}') + 1])
sheets = json.load(open(os.path.join(ED, 'sheets.json'), encoding='utf8'))
for f in os.listdir(IMG):
    if f.startswith('walk_'):
        os.remove(os.path.join(IMG, f))
meta = {}
for name, s in sheets.items():
    sheet = Image.open(os.path.join(ED, s['sheet'])).convert('RGBA')
    fw, fh = s['frameWidth'], s['frameHeight']
    p0 = TRACE['poses'][name][0]
    frames = []
    for k, fr in enumerate(s['frames']):
        im = sheet.crop((fr['x'], 0, fr['x'] + fw, fh))
        im.save(os.path.join(IMG, f'walk_{name}_{k}.png'))
        frames.append({'img': f'walk_{name}_{k}', 'w': fw, 'h': fh, 'ax': p0['ax'] + s.get('padLeft', 0), 'ms': fr['ms'], 'below': s.get('padBottom', 0)})  # below: 足の裏より下の行（影）
    meta[name] = frames
with open(os.path.join(HERE, '..', 'assets', 'walk.js'), 'w', encoding='utf8') as f:
    f.write('// tools/walk_import.py が作る（手で書きかえない）。ドット絵エディタで作った歩くアニメ（8コマ。元の絵の脚・すそを動かし、足もとに影）。\n')
    f.write('// 元の作品は assets/editor/<名前>.json（エディタの「作品を開く」で開いて直せる）。\n')
    f.write(f'export const WALK = {json.dumps(meta, ensure_ascii=False)};\n')
print(len(meta), '人')

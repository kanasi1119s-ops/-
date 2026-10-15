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
WALK_SPEED = 48  # px/秒（src/world.js と同じ）
sheets = json.load(open(os.path.join(ED, 'sheets.json'), encoding='utf8'))
for f in os.listdir(IMG):
    if f.startswith('walk_'):
        os.remove(os.path.join(IMG, f))
meta = {}
for name, s in sheets.items():
    sheet = Image.open(os.path.join(ED, s['sheet'])).convert('RGBA')
    fw, fh = s['frameWidth'], s['frameHeight']
    p0 = TRACE['poses'][name][0]
    plan = json.load(open(os.path.join(ED, f'{name}.plan.json'), encoding='utf8'))
    # 足が地面を滑らない長さ: 3コマで支えの足が歩幅ぶん（前→後ろ）動く。歩く速さ WALK_SPEED（src/world.js）と合わせる
    stride = float(plan['note'].split('歩幅 ')[1].split('・')[0])
    ms = max(90, min(160, round(2000 * stride / (3 * WALK_SPEED))))
    frames = []
    for k, fr in enumerate(s['frames']):
        im = sheet.crop((fr['x'], 0, fr['x'] + fw, fh))
        im.save(os.path.join(IMG, f'walk_{name}_{k}.png'))
        frames.append({'img': f'walk_{name}_{k}', 'w': fw, 'h': fh, 'ax': p0['ax'], 'ms': ms})
    meta[name] = frames
with open(os.path.join(HERE, '..', 'assets', 'walk.js'), 'w', encoding='utf8') as f:
    f.write('// tools/walk_import.py が作る（手で書きかえない）。ドット絵エディタで描いた歩くアニメ（6コマ）。\n')
    f.write('// 元の作品は assets/editor/<名前>.json（エディタの「作品を開く」で開いて直せる）。\n')
    f.write(f'export const WALK = {json.dumps(meta, ensure_ascii=False)};\n')
print(len(meta), '人')

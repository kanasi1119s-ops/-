# 店主の頭のタオルの欠け（透明になってしまったドット）を見つけて、埋める色を決める。
#   python3 tools/towel_holes.py            → assets/editor/faces/keeper_towel.design.json（エディタで描く点の表）
# 欠け = 頭の上のほう（HEAD 行まで）の透明なドットで、まわり8マスのうち FILL_MIN 以上が絵のドットのもの、
#        または外とつながっていない透明（穴）。埋める色は、まわりで多い色（いちばん明るい側をとる）。
import json, os
from collections import Counter
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
HEAD = 30          # タオルのある高さ（これより下は腕や服なので触らない）
FILL_MIN = 5
OUT = os.path.join(ROOT, 'assets/editor/faces')

def holes(im):
    w, h = im.size
    px = im.load()
    op = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    # 外とつながる透明
    outside = set(); stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or (x, y) in outside or op(x, y): continue
        outside.add((x, y)); stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    found = {}
    for _ in range(3):  # 埋めると、となりも埋まる条件になることがある
        add = {}
        for y in range(min(HEAD, h)):
            for x in range(w):
                if op(x, y) or (x, y) in found: continue
                nb = [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy)]
                cols = [px[a, b][:3] if op(a, b) else found.get((a, b)) for a, b in nb]
                cols = [c for c in cols if c]
                if (x, y) not in outside or len(cols) >= FILL_MIN:
                    # タオルの穴だけ: まわりが明るい（タオルの白）こと
                    light = [c for c in cols if sum(c) > 450]
                    if len(light) * 2 >= len(cols) and cols:
                        add[(x, y)] = Counter(light).most_common(1)[0][0]
        if not add: break
        found.update(add)
    return found

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    design = {}
    for i in range(7):
        im = Image.open(os.path.join(ROOT, f'assets/img/pose_keeper_{i}.png')).convert('RGBA')
        f = holes(im)
        design[f'pose_keeper_{i}'] = [{'x': x, 'y': y, 'color': '#%02x%02x%02x' % c} for (x, y), c in sorted(f.items(), key=lambda t: (t[0][1], t[0][0]))]
        print(i, len(f))
    json.dump(design, open(os.path.join(OUT, 'keeper_towel.design.json'), 'w'), ensure_ascii=False, indent=0)

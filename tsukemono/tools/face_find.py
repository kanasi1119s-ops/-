# 顔の目と口の位置を見つける（驚いた顔を描くための下調べ）。
#   python3 tools/face_find.py <絵の名前>... → JSON（顔の枠・目・口）
# 肌の色 = 頭のあたりで多い肌っぽい色。目 = 肌の枠の中の暗いドットのかたまり（左右に2つ）。口 = 目より下の暗い・赤いドット。
import json, sys, os, colorsys
from collections import Counter
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')

def is_skin(c):
    r, g, b = c[:3]
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return r > 150 and r >= g >= b - 10 and 0.02 < h < 0.13 and s > 0.25 and 0.45 < l < 0.88

def find(name, rows=60):
    im = Image.open(os.path.join(ROOT, 'assets/img', f'{name}.png')).convert('RGBA')
    w, h = im.size; px = im.load()
    sk = [(x, y) for y in range(min(rows, h)) for x in range(w) if px[x, y][3] and is_skin(px[x, y])]
    if len(sk) < 20: return {'name': name, 'w': w, 'h': h, 'face': None}
    # いちばん上の、まとまった肌（顔）: 行ごとの肌の数が多い所
    ys = Counter(y for _, y in sk)
    top = min(y for y, n in ys.items() if n >= 3)
    face = [(x, y) for x, y in sk if top <= y <= top + 26]
    x0, x1 = min(x for x, _ in face), max(x for x, _ in face)
    y1 = max(y for _, y in face)
    # 目: 顔の枠の中の暗いドット（明るさ < 90）で、左右にまわりの肌があるもの
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    dark = [(x, y) for y in range(top + 3, top + 16) for x in range(x0 + 1, x1) if px[x, y][3] and lum(px[x, y]) < 95]
    comps = []
    seen = set()
    for p in dark:
        if p in seen: continue
        st = [p]; comp = []
        while st:
            q = st.pop()
            if q in seen or q not in dark: continue
            seen.add(q); comp.append(q)
            st += [(q[0] + dx, q[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        comps.append(comp)
    def box(c): return (min(x for x, _ in c), min(y for _, y in c), max(x for x, _ in c), max(y for _, y in c))
    comps = [c for c in comps if 2 <= len(c) <= 14]
    comps.sort(key=lambda c: -len(c))
    eyes = sorted([box(c) for c in comps[:2]], key=lambda b: b[0])
    return {'name': name, 'w': w, 'h': h, 'face': [x0, top, x1, y1], 'eyes': eyes}

if __name__ == '__main__':
    print(json.dumps([find(n) for n in sys.argv[1:]], ensure_ascii=False))

# 顔の目・口を見つける（驚いた顔の設計用）。肌に囲まれた、肌でないドットのかたまりを「顔のパーツ」とみなす。
#   python3 tools/face_parts.py <絵の名前>... → JSON
import json, sys, os, colorsys
from collections import Counter
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')

def skin(c):
    if c[3] == 0: return False
    r, g, b = c[:3]
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return r > 140 and 0.0 < h < 0.14 and s > 0.22 and l > 0.42

def parts(name, top_rows=64):
    im = Image.open(os.path.join(ROOT, 'assets/img', f'{name}.png')).convert('RGBA')
    w, h = im.size; px = im.load()
    S = {(x, y) for y in range(min(top_rows, h)) for x in range(w) if skin(px[x, y])}
    if len(S) < 30: return {'name': name, 'w': w, 'h': h, 'face': None}
    # 顔 = いちばん上の大きな肌のかたまり
    comps, seen = [], set()
    for p in sorted(S, key=lambda p: (p[1], p[0])):
        if p in seen: continue
        st, comp = [p], []
        while st:
            q = st.pop()
            if q in seen or q not in S: continue
            seen.add(q); comp.append(q); st += [(q[0] + 1, q[1]), (q[0] - 1, q[1]), (q[0], q[1] + 1), (q[0], q[1] - 1)]
        comps.append(comp)
    comps = [c for c in comps if len(c) >= 40]
    if not comps: return {'name': name, 'w': w, 'h': h, 'face': None}
    face = min(comps, key=lambda c: min(y for _, y in c))
    F = set(face)
    fx0, fx1 = min(x for x, _ in face), max(x for x, _ in face)
    fy0, fy1 = min(y for _, y in face), max(y for _, y in face)
    # 肌に左右（同じ行）と上下（同じ列）で挟まれた、肌でないドット
    def inside(x, y):
        if (x, y) in F: return False
        l = any((i, y) in F for i in range(x - 6, x)); r = any((i, y) in F for i in range(x + 1, x + 7))
        u = any((x, j) in F for j in range(y - 6, y)); d = any((x, j) in F for j in range(y + 1, y + 7))
        return l and r and u and d
    holes = {(x, y) for y in range(fy0, fy1 + 1) for x in range(fx0, fx1 + 1) if inside(x, y)}
    hc, seen = [], set()
    for p in holes:
        if p in seen: continue
        st, comp = [p], []
        while st:
            q = st.pop()
            if q in seen or q not in holes: continue
            seen.add(q); comp.append(q); st += [(q[0] + dx, q[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
        hc.append(comp)
    box = lambda c: [min(x for x, _ in c), min(y for _, y in c), max(x for x, _ in c), max(y for _, y in c)]
    hc = [c for c in hc if len(c) >= 2]
    skincol = Counter(px[p][:3] for p in face).most_common(1)[0][0]
    return {'name': name, 'w': w, 'h': h, 'face': [fx0, fy0, fx1, fy1], 'skin': '#%02x%02x%02x' % skincol,
            'holes': sorted([box(c) + [len(c)] for c in hc], key=lambda b: (b[1], b[0]))}

if __name__ == '__main__':
    print(json.dumps([parts(n) for n in sys.argv[1:]], ensure_ascii=False))

# おばあさんの頭巾の欠け（縮めて切り抜いたときに、背景と見分けられず透明になった頭巾の白）を埋める点の表を作る。
#   python3 tools/granny_hood.py [--preview 出力.png]  → assets/editor/mend/granny_hood.design.json（エディタで描く点の表）
# 欠け = 頭（HEAD 行まで）の透明なドットで、左右・上下とも REACH マスのうちに絵のドットがあるもの（頭巾の輪郭線の内側に抜けた所）。
#   外に大きく開いたかたまりは本来のすき間なので埋めない。埋める色は、近くでいちばん多い頭巾の白。
import json, os, sys
from collections import Counter
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
HEAD = 24       # 頭巾のある高さ（これより下は顔・髪のまとめ・服）
HOOD = 12       # 頭巾の形をふさぐ高さ
CLOSE = 9       # ふさぐ丸い筆の大きさ
REACH = 7       # 欠けとみなす幅: 左右・上下ともこの距離のうちに絵のドットがある透明
OUT = os.path.join(ROOT, 'assets/editor/mend')
NAMES = [f'pose_granny_{i}' for i in range(8)] + [f'pose_granny2_{i}' for i in range(8)] + \
        ['surprise_granny', 'angry_granny', 'surprise_granny2', 'angry_granny2'] + \
        [f'walk_granny_{i}' for i in range(16)] + [f'walk_granny2_{i}' for i in range(16)]

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def sat(c): return max(c[:3]) - min(c[:3])
def light(c): return lum(c) > 175 and sat(c) < 60       # 頭巾の白・薄い影
def dark(c): return lum(c) < 80                          # 輪郭線

def mend(a, k=CLOSE):
    h, w = a.shape[:2]
    op = a[..., 3] > 0
    top = int(np.argmax(op.any(1)))
    hood = np.zeros_like(op); hood[top:min(h, top + HOOD)] = True
    head = np.zeros_like(op); head[top:min(h, top + HEAD)] = True
    def bracketed(y, x):
        l = op[y, max(0, x - REACH):x].any(); r = op[y, x + 1:x + REACH + 1].any()
        u = op[max(top, y - REACH):y, x].any(); d = op[y + 1:y + REACH + 1, x].any()
        return l and r and u and d
    # 1) 頭巾の形をふさぐ（頭巾の高さだけ。丸い筆で閉じる）
    pad = k
    m = np.pad(op, pad).astype(np.uint8)
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    closed = cv2.morphologyEx(m, cv2.MORPH_CLOSE, ker)[pad:-pad, pad:-pad] > 0
    new = closed & ~op & hood
    # 2) 頭の中の、まわりを囲まれた欠け（顔と髪のあいだなど）
    for y, x in zip(*np.nonzero(~op & head & ~new)):
        if bracketed(y, x):
            new[y, x] = True
    # 外に大きく開いたかたまりは本来のすき間なので埋めない
    full = op | new
    n, lab = cv2.connectedComponents((new & ~hood).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        g = lab == i
        ring = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        if (ring & ~full).sum() > max(2, g.sum() // 3): new[g] = False
    full = op | new
    outside = np.pad(~full, 1, constant_values=False)
    outside[0, :] = False  # 画面の上の端は外とみなさない（絵の上の行も輪郭線のまま）
    edge = np.zeros_like(full)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        edge |= outside[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    edge &= full
    ring = [tuple(a[y, x, :3]) for y, x in zip(*np.nonzero(edge & op & hood)) if dark(a[y, x])]
    line = Counter(ring).most_common(1)[0][0] if ring else (40, 32, 40)
    def fill_col(y, x):
        for r in range(1, 6):
            nb = [tuple(a[j, i, :3]) for j in range(max(0, y - r), min(h, y + r + 1)) for i in range(max(0, x - r), min(w, x + r + 1)) if op[j, i] and light(a[j, i])]
            if nb: return Counter(nb).most_common(1)[0][0]
        return None
    def mid_col(y, x):  # 頭巾より下の欠けは、まわりで多い色
        nb = [tuple(a[j, i, :3]) for j in range(max(0, y - 1), min(h, y + 2)) for i in range(max(0, x - 1), min(w, x + 2)) if op[j, i]]
        return Counter(nb).most_common(1)[0][0] if nb else None
    out = {}
    for y, x in zip(*np.nonzero(new)):
        c = line if edge[y, x] else (fill_col(y, x) if hood[y, x] else mid_col(y, x))
        if c is not None: out[(int(x), int(y))] = c
    # 3) もとの欠けのふちの線が、ふさいだあと頭巾の内側に入ったもの → 頭巾の白
    #    頭巾の白の中に浮いた暗い点（欠けの近くでなくても、まわり8マスのうち6マス以上が頭巾の白のもの）も同じ
    near = cv2.dilate(new.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    for _ in range(2):
        for y, x in zip(*np.nonzero(op & ~edge & hood)):
            if (int(x), int(y)) in out or lum(a[y, x]) > 140: continue
            nb = [(j, i) for j in range(y - 1, y + 2) for i in range(x - 1, x + 2) if (j, i) != (y, x) and 0 <= j < h and 0 <= i < w]
            good = sum(1 for j, i in nb if light(out.get((int(i), int(j)), a[j, i] if op[j, i] else (0, 0, 0))))
            if good >= (5 if near[y, x] else 6):
                c = fill_col(y, x)
                if c is not None: out[(int(x), int(y))] = c
    # 4) 頭の、埋めたことで囲まれた小さな透明（6マスまでのピンホール）は、まわりで多い色で埋める
    filled = op.copy()
    for (x, y) in out: filled[y, x] = True
    n, lab = cv2.connectedComponents((~filled).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        ys, xs = np.nonzero(lab == i)
        if len(ys) > 6 or ys.max() >= top + HEAD + 4 or ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1: continue
        for y, x in zip(ys, xs):
            nb = [out.get((int(i_), int(j)), tuple(a[j, i_, :3])) for j, i_ in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if filled[j, i_]]
            out[(int(x), int(y))] = Counter(nb).most_common(1)[0][0]
    return out

if __name__ == '__main__':
    design, prev = {}, []
    for n in NAMES:
        a = np.asarray(Image.open(os.path.join(ROOT, f'assets/img/{n}.png')).convert('RGBA')).copy()
        f = mend(a)
        print(n, len(f))
        if not f: continue
        design[n] = [{'x': x, 'y': y, 'color': '#%02x%02x%02x' % tuple(int(v) for v in c)} for (x, y), c in sorted(f.items(), key=lambda t: (t[0][1], t[0][0]))]
        b = a.copy()
        for (x, y), c in f.items(): b[y, x] = (*c, 255)
        prev.append((a, b))
    os.makedirs(OUT, exist_ok=True)
    json.dump(design, open(os.path.join(OUT, 'granny_hood.design.json'), 'w'), ensure_ascii=False, indent=0)
    if '--preview' in sys.argv and prev:
        rows = []
        for a, b in prev:
            top = int(np.argmax((a[..., 3] > 0).any(1)))
            cell = lambda im: im[top:top + 30]
            row = np.concatenate([cell(a), np.zeros((30, 3, 4), np.uint8), cell(b)], 1)
            rows.append(row)
        W = max(r.shape[1] for r in rows)
        rows = [np.pad(r, ((0, 3), (0, W - r.shape[1]), (0, 0))) for r in rows]
        sheet = Image.fromarray(np.concatenate(rows, 0))
        bg = Image.new('RGBA', sheet.size, (255, 0, 255, 255)); bg.alpha_composite(sheet)
        bg.resize((sheet.width * 5, sheet.height * 5), Image.NEAREST).save(sys.argv[sys.argv.index('--preview') + 1])

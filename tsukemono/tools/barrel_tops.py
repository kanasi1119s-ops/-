# 樽の中身のドット絵を作る。  python3 tools/barrel_tops.py [--preview 出力.png]
# 樽の口（だ円。トレースした形）の中に、野菜を1つずつ置いて詰める。手前ほど後から置く（奥が隠れる）。
# 真ん中は口より少し盛り上がる（HEAP 行ぶん上に絵がはみ出す）。空の樽は、内側の板・底・漬け汁の残りを描く。
# 出力: assets/img/slot<番号>_<中身>.png（中身: empty / hakusai / kyuri / daikon / nozawana / nasu / takuan）
import os
import random
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'assets', 'img')
HEAP = 4  # 口より上に盛り上がる行

# ---- 色（1文字＝1色） ----
PAL = {
    # 木
    'W': (92, 60, 36), 'w': (70, 45, 27), 'v': (52, 33, 21), 'V': (118, 80, 48), 'b': (38, 24, 17), 'B': (28, 18, 13),
    # 漬け汁
    'q': (88, 70, 44), 'Q': (132, 112, 78), 'z': (176, 160, 120),
    # きゅうり
    'k': (24, 52, 22), 'g': (52, 102, 40), 'G': (88, 140, 58), 'L': (150, 192, 98), 'y': (196, 214, 140),
    # 白菜
    'h': (238, 236, 220), 'H': (210, 206, 184), 'j': (172, 166, 140), 'f': (126, 170, 72), 'F': (88, 132, 52), 'e': (60, 96, 38),
    # 大根
    'd': (244, 240, 230), 'D': (220, 214, 198), 'c': (178, 170, 150), 'n': (150, 188, 96),
    # たくあん
    't': (240, 204, 64), 'T': (210, 164, 34), 'u': (168, 122, 24), 'U': (250, 230, 130), 'r': (190, 60, 40),
    # 野沢菜
    'o': (36, 72, 30), 'O': (60, 104, 42), 'p': (96, 140, 62), 's': (190, 204, 140), 'S': (152, 168, 106),
    # なす
    'm': (40, 20, 48), 'M': (72, 38, 88), 'N': (112, 66, 140), 'i': (170, 130, 196), 'x': (52, 92, 38), 'X': (82, 124, 52),
}

# ---- 野菜の形（. は透明）。右向き。置くときに左右反転もする ----
SPRITES = {
    'kyuri': [
        ['.kkkkkkk..', 'kGLyLGGgk.', 'kgGGGgggkk', '.kkkkkkkk.'],
        ['..kkkkkk', '.kGLLGgk', 'kgGgGggk', 'kgggggk.', '.kkkkk..'],
        ['.kkkkkkkk.', 'kgLyGLGGgk', '.kkkkkkkk.'],
        ['.kkk.', 'kGLgk', 'kgggk', '.kkk.'],  # 切り口
    ],
    'hakusai': [
        ['..eFFe...', '.eFffFe..', 'efFhhHFe.', 'Fhhhhhhj.', 'jHhhhHjj.', '.jjjjj...'],
        ['.eFFe..', 'eFffFe.', 'FhhhhH.', 'jhhhHj.', '.jjjj..'],
        ['..eFe..eFe', '.eFfFeeFfF', 'eFhhHFFhhH', 'jHhhhjjHhj', '.jjjj.jjj.'],
        ['.FFe', 'Fhhj', 'jHhj', '.jj.'],
    ],
    'daikon': [
        ['.cccccccc..', 'cdddddDDDcn', 'cDdddDDDDcn', '.cccccccc..'],
        ['.ccc.', 'cdDdc', 'cDdDc', '.ccc.'],  # 切り口
        ['..cccccc', '.cddddDc', 'cdddDDDc', 'cDDDDDc.', '.cccccc.'],
    ],
    'takuan': [
        ['.uuu.', 'uUtTu', 'utTTu', '.uuu.'],  # 輪切り
        ['.uuuu.', 'uUttTu', 'utTTTu', '.uuuu.'],
        ['.uuuuuuuu..', 'uUUtttTTTuu', 'utttTTTTTTu', '.uuuuuuuuu.'],  # まるごと
        ['.uuu', 'uUtu', 'utTu', '.uu.'],
    ],
    'nozawana': [
        ['..oOo.....', '.oOpOoSSS.', 'oOpppOsssS', '.oOOoSSS..'],
        ['.oo..oo.', 'oOpOoOpo', 'oOppOpOo', '.SSssSS.', '..SSSS..'],
        ['oOo', 'OpO', 'oSo', '.S.'],
    ],
    'nasu': [
        ['..mmmmm.x', '.mNiNMMxX', 'mNiMMMMmx', 'mMMMMMmm.', '.mmmmm...'],
        ['.mmmm.x', 'mNiMMxX', 'mMMMMmx', '.mmmm..'],
        ['.mmm.', 'mNMMm', 'mMiMm', '.mmm.'],  # 切り口ではなく小なす
    ],
}


def load_mask(i):
    a = np.array(Image.open(os.path.join(IMG, f'slot{i}_empty_trace.png' if os.path.exists(os.path.join(IMG, f'slot{i}_empty_trace.png')) else f'slot{i}_hakusai.png')).convert('RGBA'))
    return a[:, :, 3] > 0


def put(img, spr, x0, y0, flip, clip):
    h, w = img.shape[:2]
    # 落ち影: 置く野菜の1ドット下を暗くする（となりの野菜と分かれて見える）
    for yy, row in enumerate(spr):
        if flip:
            row = row[::-1]
        for xx, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + xx, y0 + yy + 1
            below = spr[yy + 1][::-1][xx] if (flip and yy + 1 < len(spr)) else (spr[yy + 1][xx] if yy + 1 < len(spr) else '.')
            if below == '.' and 0 <= x < w and 0 <= y < h and clip[y, x] and img[y, x, 3]:
                img[y, x, :3] = (img[y, x, :3] * 0.55).astype(np.uint8)
    for yy, row in enumerate(spr):
        if flip:
            row = row[::-1]
        for xx, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + xx, y0 + yy
            if 0 <= x < w and 0 <= y < h and clip[y, x]:
                img[y, x] = (*PAL[ch], 255)


def heap_mask(mask):
    """口のだ円に、真ん中が HEAP 行まで盛り上がった山を足した範囲。"""
    h, w = mask.shape
    out = np.zeros((h + HEAP, w), bool)
    out[HEAP:] = mask
    xs = np.nonzero(mask.any(0))[0]
    x0, x1 = xs.min(), xs.max()
    cx, rx = (x0 + x1) / 2, (x1 - x0) / 2
    top = np.nonzero(mask.any(1))[0].min() + HEAP
    for x in range(w):
        u = abs(x - cx) / (rx * 0.82)
        if u >= 1:
            continue
        rise = int(round(HEAP * (1 - u * u) ** 0.6))
        for y in range(top - rise, top + 2):
            if 0 <= y < h + HEAP:
                out[y, x] = True
    return out


def interior(mask, wet=True, seed=0):
    """空の樽の中: 奥の内側の板（縦じま）、底、漬け汁の残り。"""
    rng = random.Random(seed)
    h, w = mask.shape
    img = np.zeros((h + HEAP, w, 4), np.uint8)
    ys = np.nonzero(mask.any(1))[0]
    top, bot = ys.min(), ys.max()
    xs = np.nonzero(mask.any(0))[0]
    cx, rx = (xs.min() + xs.max()) / 2, (xs.max() - xs.min()) / 2
    for y in range(h):
        for x in range(w):
            if not mask[y, x]:
                continue
            t = (y - top) / max(1, bot - top)  # 0=奥 1=手前
            if t < 0.5:  # 奥の内側の板（影の中。上ほど少し明るい。4ドットごとに板の継ぎ目）
                col = PAL['W'] if t < 0.2 else PAL['w']
                if x % 4 == 0:
                    col = PAL['v']
            else:  # 底（手前ほど暗い）
                col = PAL['w'] if t < 0.7 else PAL['b']
                if abs(x - cx) > rx * 0.8:
                    col = PAL['B']
            img[y + HEAP, x] = (*col, 255)
    if wet:  # 底に残った漬け汁（にぶい照り）
        for y in range(h):
            for x in range(w):
                if mask[y, x]:
                    t = (y - top) / max(1, bot - top)
                    if 0.55 < t < 0.85 and abs(x - cx) < rx * 0.55:
                        img[y + HEAP, x] = (*PAL['q'], 255)
                        if rng.random() < 0.12:
                            img[y + HEAP, x] = (*PAL['Q'], 255)
        img[int(top + (bot - top) * 0.62) + HEAP, int(cx) - 3:int(cx) + 1] = (*PAL['z'], 255)
    return img


def filled(mask, kind, seed):
    rng = random.Random(seed)
    h, w = mask.shape
    img = interior(mask, wet=True, seed=seed)
    # 下地（すき間から見える暗い色）
    dark = {'kyuri': 'k', 'hakusai': 'j', 'daikon': 'c', 'takuan': 'u', 'nozawana': 'o', 'nasu': 'm'}[kind]
    hm = heap_mask(mask)
    for y in range(h + HEAP):
        for x in range(w):
            if hm[y, x] and (y < HEAP or not mask[y - HEAP, x] or (y - HEAP) > 1):
                img[y, x] = (*PAL[dark], 255)
    sprites = SPRITES[kind]
    big = [sp for sp in sprites if len(sp[0]) >= 6] or sprites
    # 奥（上）から手前（下）へ、段に分けて並べる。段ごとに半個ずらし、となりと1ドットだけ重ねる
    ys = np.nonzero(hm.any(1))[0]
    y = ys.min() - 1
    row = 0
    while y < h + HEAP:
        x = -rng.randint(1, 4) - (3 if row % 2 else 0)
        while x < w:
            spr = rng.choice(big if rng.random() < 0.85 else sprites)
            put(img, spr, x, y + rng.choice((0, 0, 1)), rng.random() < 0.3, hm)
            x += len(spr[0]) - 1
        y += max(2, min(len(sp) for sp in big) - 1)
        row += 1
    # 手前のふちの影（樽のふちが落とす影）と、両はしの暗がり
    ys = np.nonzero(mask.any(1))[0]
    bot = ys.max() + HEAP
    for y in range(h + HEAP):
        for x in range(w):
            if img[y, x, 3] and hm[y, x]:
                if y >= bot - 1:
                    img[y, x, :3] = (img[y, x, :3] * 0.62).astype(np.uint8)
                elif y == bot - 2:
                    img[y, x, :3] = (img[y, x, :3] * 0.82).astype(np.uint8)
    xs = np.nonzero(mask.any(0))[0]
    for y in range(h + HEAP):
        for x in (xs.min(), xs.min() + 1, xs.max() - 1, xs.max()):
            if img[y, x, 3]:
                img[y, x, :3] = (img[y, x, :3] * 0.7).astype(np.uint8)
    return img


def opening(mask0, i):
    """樽の口の形: トレースした形を下へ2行のばし（背景に残る元の中身を隠す）、
    口に立っている値札（白い札）は隠さない。返す形は、元の絵の大きさより2行高い。"""
    import json
    trace = open(os.path.join(HERE, '..', 'assets', 'trace.js'), encoding='utf8').read()
    slot = json.loads(trace[trace.index('{'):trace.rindex('}') + 1])['slots'][i]
    h, w = mask0.shape
    m = np.zeros((h + 2, w), bool)
    for d in (1, 2):  # トレースした形は口より1行ほど高いので、1〜2行下げる（奥のふちの板は隠さない）
        m[d:d + h] |= mask0
    bg = np.array(Image.open(os.path.join(IMG, 'bg.png')).convert('RGB')).astype(int)
    for y in range(h + 2):
        for x in range(w):
            r, g, b = bg[slot['y'] + y, slot['x'] + x]
            if i < 2 and y < 7 and x > w * 0.55 and m[y, x] and min(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 60:
                m[y, x] = False  # 値札（左の2つの樽の奥に立っている）
    return m


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    rows = []
    for i in range(3):
        # 口の形は、トレースした空の樽の絵から（はじめの1回だけ控えを作る）
        ctrl = os.path.join(IMG, f'slot{i}_empty_trace.png')
        if not os.path.exists(ctrl):
            Image.open(os.path.join(IMG, f'slot{i}_empty.png')).save(ctrl)
        mask0 = np.array(Image.open(ctrl).convert('RGBA'))[:, :, 3] > 0
        mask = opening(mask0, i)
        row = []
        for kind in ['empty', 'hakusai', 'kyuri', 'daikon', 'nozawana', 'nasu', 'takuan']:
            if kind == 'empty':  # 空の樽は口の内側だけ（まわりのふちの板を見せる）
                er = mask.copy()
                er[1:-1, 1:-1] = mask[1:-1, 1:-1] & mask[:-2, 1:-1] & mask[2:, 1:-1] & mask[1:-1, :-2] & mask[1:-1, 2:]
                er[0] = False
                img = interior(er, wet=True, seed=i)
                # 口のふち（板の切り口）: 奥は明るく、手前は暗く
                ys_ = np.nonzero(mask.any(1))[0]
                midy = (ys_.min() + ys_.max()) / 2
                for y in range(mask.shape[0]):
                    for x in range(mask.shape[1]):
                        if mask[y, x] and not er[y, x]:
                            img[y + HEAP, x] = (*PAL['V' if y < midy else 'W'], 255)
            else:
                img = filled(mask, kind, seed=i * 7 + len(kind))
            Image.fromarray(img).save(os.path.join(IMG, f'slot{i}_{kind}.png'))
            row.append(img)
        rows.append(row)
    if preview:
        cw, ch = rows[0][0].shape[1] + 8, rows[0][0].shape[0] + 6
        cw = max(r[0].shape[1] for r in rows) + 8
        out = Image.new('RGBA', (cw * 7, ch * 3), (120, 80, 50, 255))
        for r, row in enumerate(rows):
            for c, img in enumerate(row):
                im = Image.fromarray(img)
                out.alpha_composite(im, (c * cw + 4, r * ch + 3))
        out.resize((out.width * 8, out.height * 8), Image.NEAREST).save(preview)


if __name__ == '__main__':
    main()

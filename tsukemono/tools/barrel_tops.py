# 樽の中身のドット絵の設計図を作る。  python3 tools/barrel_tops.py [--preview 出力.png]
# 樽の口の内側（ふちの板の内側のだ円。背景の絵から測った）に収まるように、中身を1つずつ置いて詰める。
# 口より上には盛らない（ふちに被らない）。値札（樽に立っている白い札）も隠さない。
# 出力: assets/editor/barrels/<名前>.design.json（色と画素）。実際の絵は tools/editor_barrels.mjs が
#       ドット絵エディタのペンで1ドットずつ描いて、assets/img/slot<番号>_<中身>.png に書き出す。
#   中身: empty（空）/ hakusai / kyuri / daikon / nozawana / nasu / takuan
import json
import math
import os
import random
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'assets', 'img')
OUT = os.path.join(HERE, '..', 'assets', 'editor', 'barrels')

SC = 2  # 画面の倍率（tools/trace.py の SC と同じ。下の座標と野菜の形は 384×216 で書き、SC 倍して使う）
# 樽の口の内側（背景の絵の座標。中心・横半径・縦半径）
MOUTHS = [
    {'cx': 113.5, 'cy': 168.7, 'rx': 16.0, 'ry': 4.9},
    {'cx': 150.0, 'cy': 168.7, 'rx': 14.4, 'ry': 4.9},
    {'cx': 229.6, 'cy': 169.7, 'rx': 15.0, 'ry': 4.9},
]

PAL = {
    # 木（内側の板）・漬け汁
    'W': (98, 64, 38), 'w': (74, 47, 28), 'v': (55, 35, 22), 'b': (40, 25, 17), 'B': (26, 16, 11), 'V': (128, 88, 54),
    'q': (96, 74, 40), 'Q': (150, 122, 70), 'z': (206, 186, 128),
    # きゅうり
    'k': (22, 48, 20), 'g': (46, 96, 36), 'G': (78, 134, 52), 'L': (138, 186, 88), 'y': (196, 220, 140), 'Y': (110, 60, 30),
    # 白菜
    'h': (244, 242, 228), 'H': (218, 214, 190), 'j': (178, 170, 140), 'J': (140, 132, 104), 'f': (138, 182, 78), 'F': (96, 144, 54), 'e': (58, 98, 36),
    # 大根
    'd': (246, 244, 236), 'D': (224, 220, 206), 'c': (180, 172, 152), 'C': (140, 132, 112), 'n': (126, 168, 76), 'a': (82, 120, 50),
    # たくあん
    't': (240, 202, 62), 'T': (212, 162, 34), 'u': (160, 114, 22), 'U': (252, 232, 136), 'r': (120, 82, 14),
    # 野沢菜
    'o': (32, 66, 28), 'O': (54, 98, 40), 'p': (88, 136, 58), 'P': (128, 170, 84), 's': (198, 212, 150), 'S': (156, 172, 110),
    # なす
    'm': (34, 16, 42), 'M': (66, 32, 82), 'N': (104, 60, 132), 'i': (176, 140, 206), 'I': (226, 210, 236), 'x': (48, 88, 36), 'X': (86, 128, 54),
}

# 野菜の形（右向き。. は透明）。小さいながら、ふち・地の色・陰・照りを分ける
SPRITES = {
    'kyuri': [  # きゅうり（いぼ＝明るい点、へた＝茶色）
        ['.kkkkkkkkk.', 'kgLyLGLyGgk', 'kGgGgGgGggY', '.kkkkkkkkk.'],
        ['.kkkkkkk.', 'kGLyGLGgY', 'kgggGgggk', '.kkkkkkk.'],
        ['..kkkkkkkk', '.kgLyGLGgk', 'kgGgGgggk.', 'Ykkkkkkk..'],
    ],
    'hakusai': [  # 白菜（4つ割りの断面: 白い軸の重なりと、先の緑の葉）
        ['.eFFFe.....', 'eFfffFFe...', 'FfhhHfFFe..', 'jhhHhhhhHj.', 'JjHhhHhhjJ.', '.JJjjjjJJ..'],
        ['..eFFe..', '.eFffFe.', 'eFhhhHFe', 'jhHhhHhj', '.JjjjjJ.'],
        ['.eFFe.eFe.', 'eFffFFffFe', 'FhhHhhhHhj', 'JjhhHHhjJJ', '.JJjjjjJ..'],
    ],
    'daikon': [  # 大根（白い根、葉の付け根の緑、ひげ根）
        ['.ccccccccc..', 'cdddddDDDDcn', 'cDdddDDDDCca', '.ccccccccc..'],
        ['.cccccc..', 'cddddDDcn', 'cDDDDDCca', '.cccccc..'],
    ],
    'takuan': [  # たくあん（干した大根のしわと、輪切りの断面）
        ['.uuuuuuuuu.', 'uUtUttUtTTu', 'utTtTTtTTTu', '.uuuuuuuuu.'],
        ['.uuu.', 'uUUtu', 'utTTu', '.uuu.'],
        ['.uuuu.', 'uUUttu', 'utTTTu', '.uuuu.'],
    ],
    'nozawana': [  # 野沢菜（長い葉。淡い緑の茎と、濃い葉）
        ['..oOOo.....', '.oOpPpOoSSS', 'oOpPpOOsSsS', '.ooOOoSSSS.'],
        ['.oOo..oOo.', 'oOpPOoOpPo', 'oOOpOOpOOo', '.SSssSsSS.'],
        ['.ooOOo...', 'oOpPPpOSS', '.oOOoSsSS'],
    ],
    'nasu': [  # なす（つやの照り、緑のへた）
        ['..mmmmmm.x', '.mNIiNMMxX', 'mNiNMMMMmx', 'mMMMMMMmm.', '.mmmmmm...'],
        ['.mmmmm.x', 'mNIiMMxX', 'mMNMMMmx', '.mmmmm..'],
    ],
}


MOUTHS = [{k: v * SC for k, v in m.items()} for m in MOUTHS]
# 野菜の形は SC 倍に拡大（1ドット→SC×SC）
SPRITES = {k: [[''.join(ch * SC for ch in row) for row in spr for _ in range(SC)] for spr in v] for k, v in SPRITES.items()}


def mouth_mask(i):
    """樽の口の内側のだ円（絵の大きさとその中の画素）と、絵を置く位置。値札の画素は外す。"""
    m = MOUTHS[i]
    x0, x1 = math.floor(m['cx'] - m['rx']), math.ceil(m['cx'] + m['rx'])
    y0, y1 = math.floor(m['cy'] - m['ry']), math.ceil(m['cy'] + m['ry'])
    w, h = x1 - x0 + 1, y1 - y0 + 1
    mask = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            dx = (x0 + x + 0.5 - m['cx']) / m['rx']
            dy = (y0 + y + 0.5 - m['cy']) / m['ry']
            mask[y, x] = dx * dx + dy * dy <= 1.0
    bg = np.array(Image.open(os.path.join(IMG, 'bg.png')).convert('RGB')).astype(int)
    for y in range(h):
        for x in range(w):
            r, g, b = bg[y0 + y, x0 + x]
            # 値札（白い札と、それを挿している棒）は残す: 左の2つの樽の、口の右奥にある
            if i < 2 and mask[y, x] and x > w * 0.55 and y < h * 0.75 and min(r, g, b) > 140 and max(r, g, b) - min(r, g, b) < 70:
                mask[y, x] = False
    return mask, (x0, y0)


def put(img, spr, x0, y0, flip, clip):
    h, w = img.shape[:2]
    rows = [r[::-1] if flip else r for r in spr]
    # 落ち影: 野菜の下の1ドットを暗く（重なりが分かる）
    for yy, row in enumerate(rows):
        for xx, ch in enumerate(row):
            if ch == '.':
                continue
            below = rows[yy + 1][xx] if yy + 1 < len(rows) and xx < len(rows[yy + 1]) else '.'
            x, y = x0 + xx, y0 + yy + 1
            if below == '.' and 0 <= x < w and 0 <= y < h and clip[y, x] and img[y, x, 3]:
                img[y, x, :3] = (img[y, x, :3] * 0.55).astype(np.uint8)
    i = 0
    for yy, row in enumerate(rows):
        xx = 0
        while xx < len(row):
            ch = row[xx]
            key = ch
            x, y = x0 + xx, y0 + yy
            if key != '.' and 0 <= x < w and 0 <= y < h and clip[y, x]:
                img[y, x] = (*PAL[key], 255)
            xx += len(key) if key != '.' else 1


def interior(mask, seed, wet):
    """口の内側: 奥の内側の板（ふちの影で暗い。板の継ぎ目）、底、漬け汁の残り。"""
    rng = random.Random(seed)
    h, w = mask.shape
    img = np.zeros((h, w, 4), np.uint8)
    ys = np.nonzero(mask.any(1))[0]
    top, bot = ys.min(), ys.max()
    xs = np.nonzero(mask.any(0))[0]
    cx, rx = (xs.min() + xs.max()) / 2, (xs.max() - xs.min()) / 2
    for y in range(h):
        for x in range(w):
            if not mask[y, x]:
                continue
            t = (y - top) / max(1, bot - top)
            edge = abs(x - cx) / rx
            if t < 0.45:  # 奥の内側の板
                col = PAL['b'] if t < 0.12 else PAL['w'] if t < 0.3 else PAL['W']  # いちばん上はふちの影
                if x % (4 * SC) == 1 and t >= 0.12:
                    col = PAL['v']  # 板の継ぎ目
            else:  # 底
                col = PAL['w'] if t < 0.65 else PAL['b']
                if edge > 0.8:
                    col = PAL['B']
            img[y, x] = (*col, 255)
    if wet:
        for y in range(h):
            for x in range(w):
                t = (y - top) / max(1, bot - top)
                if mask[y, x] and 0.55 < t < 0.9 and abs(x - cx) < rx * 0.6:
                    img[y, x] = (*PAL['q'], 255)
                    if rng.random() < 0.15:
                        img[y, x] = (*PAL['Q'], 255)
        yy = int(top + (bot - top) * 0.68)
        for x in range(int(cx) - 4 * SC, int(cx)):
            if mask[yy, x]:
                img[yy, x] = (*PAL['z'], 255)  # 漬け汁の照り
    return img


def filled(mask, kind, seed):
    rng = random.Random(seed)
    h, w = mask.shape
    img = interior(mask, seed, wet=True)
    ys = np.nonzero(mask.any(1))[0]
    top, bot = ys.min(), ys.max()
    # 中身は奥のふちの影（上の2行）より下に詰める。手前ほど後から置く
    clip = mask.copy()
    clip[:top + 2 * SC] = False
    sprites = SPRITES[kind]
    y = top + 1
    row = 0
    while y <= bot:
        x = -rng.randint(1, 5) * SC - (2 * SC if row % 2 else 0)
        while x < w:
            spr = rng.choice(sprites)
            put(img, spr, x, y + rng.choice((0, 0, 1)) - 1, rng.random() < 0.35, clip)
            x += len(spr[0]) - 1 + rng.choice((0, 0, 1))
        y += 2 * SC
        row += 1
    # 漬け汁が手前のふちぎわにのぞく（つやの点）
    for x in range(w):
        for y in range(h - 1, -1, -1):
            if mask[y, x]:
                if rng.random() < 0.5:
                    img[y, x] = (*PAL['q'], 255)
                if rng.random() < 0.12:
                    img[y, x] = (*PAL['Q'], 255)
                break
    # 左右のはしと、手前のふちぎわは暗く（樽の中の影）
    xs = np.nonzero(mask.any(0))[0]
    cx, rx = (xs.min() + xs.max()) / 2, (xs.max() - xs.min()) / 2
    for y in range(h):
        for x in range(w):
            if img[y, x, 3]:
                e = abs(x - cx) / rx
                f = 1.0
                if e > 0.86:
                    f = 0.6
                elif e > 0.72:
                    f = 0.8
                if y == bot:
                    f *= 0.7
                img[y, x, :3] = (img[y, x, :3] * f).astype(np.uint8)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    designs = {}
    for i in range(3):
        mask, (ox, oy) = mouth_mask(i)
        for kind in ['empty', 'hakusai', 'kyuri', 'daikon', 'nozawana', 'nasu', 'takuan']:
            img = interior(mask, seed=i, wet=True) if kind == 'empty' else filled(mask, kind, seed=i * 11 + len(kind))
            name = f'slot{i}_{kind}'
            Image.fromarray(img).save(os.path.join(OUT, f'{name}.design.png'))
            designs[name] = {'x': ox, 'y': oy, 'w': img.shape[1], 'h': img.shape[0]}
    with open(os.path.join(OUT, 'mouths.json'), 'w', encoding='utf8') as f:
        json.dump(designs, f, ensure_ascii=False, indent=1)
    with open(os.path.join(HERE, '..', 'assets', 'mouths.js'), 'w', encoding='utf8') as f:
        f.write('// tools/barrel_tops.py が作る（手で書きかえない）。樽の中身の絵を置く位置（背景の座標）と大きさ。\n')
        f.write(f'export const MOUTHS = {json.dumps(designs, ensure_ascii=False)};\n')
    if preview:
        bg = Image.open(os.path.join(IMG, 'bg.png')).convert('RGBA')
        rows = []
        for kinds in (['empty', 'kyuri', 'hakusai'], ['daikon', 'nozawana', 'nasu'], ['takuan', 'empty', 'empty']):
            c = bg.copy()
            for i in range(3):
                d = designs[f'slot{i}_{kinds[i]}']
                c.alpha_composite(Image.open(os.path.join(OUT, f'slot{i}_{kinds[i]}.design.png')), (d['x'], d['y']))
            rows.append(c.crop((90 * SC, 148 * SC, 255 * SC, 182 * SC)))
        out = Image.new('RGBA', (rows[0].width, rows[0].height * 3))
        for k, r in enumerate(rows):
            out.paste(r, (0, k * r.height))
        out.resize((out.width * 6, out.height * 6), Image.NEAREST).save(preview)


if __name__ == '__main__':
    main()

"""参考画像（assets/reference/shop_reference.jpg）をドット絵にトレースする。

  python3 tools/trace.py      # 必要: pip install opencv-python-headless pillow numpy

出力（assets/img/）:
  bg.png              背景 384×216（人物を抜いて埋め直し、空は透明）
  cloud_*.png         空に浮かぶ雲（流すために背景から抜いたもの）
  char_*.png          人物（店主・客）。動きは JS 側でコマを作る
  basket.png          かご

手順: 縮小(384×216) → 128色に減色 → GrabCut で人物を切り抜く → 背景を補修 → 空を抜く。
人物の切り抜きのヒント（確実に人物/背景の場所）は、下の HINTS に 384×216 の座標で書く。
"""
import os
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/reference/shop_reference.jpg')
OUT = os.path.join(ROOT, 'assets/img')
W, H = 384, 216

src = cv2.imread(SRC)
S = src.shape[1] / W

# ---------------------------------------------------------------- 減色
rgb = Image.open(SRC).convert('RGB').resize((W, H), Image.BOX)
pal_img = rgb.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
PAL = np.array(pal_img.getpalette()[:128 * 3]).reshape(-1, 3)
base = np.asarray(pal_img.convert('RGB')).copy()


def snap(arr):
    """色をパレットに寄せる（補修した部分もドット絵の色に戻す）。"""
    flat = arr.reshape(-1, 3).astype(int)
    d = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(-1)
    return PAL[d.argmin(1)].reshape(arr.shape).astype(np.uint8)


# ---------------------------------------------------------------- 人物の切り抜き
BOXES = {
    'keeper': (175, 112, 214, 194), 'woman': (228, 138, 265, 214),
    'kid1': (280, 154, 304, 214), 'kid2': (312, 156, 341, 214), 'kid3': (346, 154, 381, 214),
    'basket': (229, 170, 248, 196),
}
HINTS = {  # fg: (cx, cy, r) / bg: (x0, y0, x1, y1)
    'keeper': {'fg': [(195, 124, 6), (195, 138, 6), (195, 160, 6), (187, 181, 2), (203, 181, 2), (203, 172, 2), (204, 185, 2), (187, 172, 2), (187, 189, 2), (204, 189, 2), (181, 142, 2), (209, 142, 2)],
               'bg': [(175, 112, 182, 135), (207, 112, 214, 135), (191, 176, 199, 186), (175, 150, 183, 194), (210, 150, 214, 190), (175, 192, 183, 194), (193, 191, 199, 194), (209, 192, 214, 194)]},
    'woman': {'fg': [(250, 155, 5), (250, 180, 5)], 'bg': [(228, 182, 238, 214), (228, 138, 236, 160)]},
    'kid1': {'fg': [(291, 163, 5), (292, 180, 3), (292, 197, 2)], 'bg': [(288, 154, 300, 158), (298, 154, 304, 176), (280, 154, 284, 165), (298, 206, 304, 214)]},
    'kid2': {'fg': [(325, 165, 6), (327, 185, 4), (327, 195, 3)], 'bg': [(336, 156, 341, 172)]},
    'kid3': {'fg': [(362, 163, 6), (360, 182, 4), (358, 195, 3), (371, 180, 3)], 'bg': [(368, 154, 381, 168), (377, 170, 381, 190)]},
    'basket': {'fg': [(238, 186, 4)], 'bg': []},
}


# 384×216 での手直し（切り抜きの足りない所・余計な所）
FORCE = {
    'keeper': {'fg': [(184, 172, 192, 186), (199, 172, 207, 186)], 'bg': [(178, 191, 214, 194)]},
}


def grabcut(name):
    x0, y0, x1, y1 = BOXES[name]
    m = np.zeros(src.shape[:2], np.uint8)
    m[int(y0 * S):int(y1 * S), int(x0 * S):int(x1 * S)] = cv2.GC_PR_FGD
    for cx, cy, r in HINTS[name]['fg']:
        cv2.circle(m, (int(cx * S), int(cy * S)), int(r * S), cv2.GC_FGD, -1)
    for a, b, c, d in HINTS[name]['bg']:
        m[int(b * S):int(d * S), int(a * S):int(c * S)] = cv2.GC_BGD
    cv2.grabCut(src, m, None, np.zeros((1, 65)), np.zeros((1, 65)), 10, cv2.GC_INIT_WITH_MASK)
    mm = ((m == 1) | (m == 3)).astype(np.uint8)
    inv = (1 - mm).copy()
    cv2.floodFill(inv, np.zeros((inv.shape[0] + 2, inv.shape[1] + 2), np.uint8), (0, 0), 2)
    mm[inv == 1] = 1  # 内側の穴を埋める
    # 384×216 へ: セルの半分以上が人物なら人物
    small = cv2.resize(mm.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
    keep = np.zeros_like(small)
    keep[y0:y1, x0:x1] = small[y0:y1, x0:x1]
    for a, b, c, d in FORCE.get(name, {}).get('fg', []):
        keep[b:d, a:c] = True
    for a, b, c, d in FORCE.get(name, {}).get('bg', []):
        keep[b:d, a:c] = False
    return keep


masks = {n: grabcut(n) for n in BOXES}
# kid3 の後ろの茂みの色を落とす
x0, y0, x1, y1 = BOXES['kid3']
for y in range(y0, 175):
    for x in range(x0, x1):
        r, g, b = base[y, x].astype(int)
        if masks['kid3'][y, x] and ((g > r + 10 and g >= b - 30) or (b > r + 40 and x > 360)):
            masks['kid3'][y, x] = False


def save_sprite(name, mask):
    x0, y0, x1, y1 = BOXES[name]
    ys, xs = np.nonzero(mask[y0:y1, x0:x1])
    ax0, ay0, ax1, ay1 = x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1
    rgba = np.zeros((ay1 - ay0, ax1 - ax0, 4), np.uint8)
    # 人物は人物だけで減色する（全体の減色だと肌や服のピンクが消える）
    crop = rgb.crop((ax0, ay0, ax1, ay1))
    own = crop.quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    rgba[..., :3] = np.asarray(own)
    rgba[..., 3] = mask[ay0:ay1, ax0:ax1] * 255
    Image.fromarray(rgba).save(os.path.join(OUT, f'{"char_" if name != "basket" else ""}{name}.png'))
    return (int(ax0), int(ay0), int(ax1 - ax0), int(ay1 - ay0))


os.makedirs(OUT, exist_ok=True)
placed = {n: save_sprite(n, m) for n, m in masks.items()}

# ---------------------------------------------------------------- 背景の補修
hole = np.zeros((H, W), bool)
for n in ('keeper', 'woman', 'kid1', 'kid2', 'kid3', 'basket'):
    hole |= cv2.dilate(masks[n].astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
bg = base.copy()


def mirror(x0, x1, y0, y1, cx):
    """樽などの左右対称なものを、反対側から写して埋める。"""
    for y in range(y0, y1):
        for x in range(x0, x1):
            sx = int(round(2 * cx - x))
            if hole[y, x] and 0 <= sx < W and not hole[y, sx]:
                bg[y, x] = bg[y, sx]
                hole[y, x] = False


def copy(x0, y0, x1, y1, dx, dy):
    """別の場所から写す。"""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if hole[y, x] and not hole[y + dy, x + dx]:
                bg[y, x] = bg[y + dy, x + dx]
                hole[y, x] = False


def mark(x0, y0, x1, y1):
    """影なども埋め直す対象にする。"""
    hole[y0:y1, x0:x1] = True


def paste(x0, y0, x1, y1, dx, dy):
    """埋めた後でも上書きして写す。"""
    bg[y0:y1, x0:x1] = bg[y0 + dy:y1 + dy, x0 + dx:x1 + dx].copy()
    hole[y0:y1, x0:x1] = False


def band(x0, x1, rows, lines=None):
    """横帯の色で埋める（店の奥の壁・土間など）。rows = [[y0, y1, [r,g,b]], ...]"""
    for y0, y1, col in rows:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if hole[y, x]:
                    bg[y, x] = col
                    hole[y, x] = False
    for lx, ly0, ly1, col in (lines or []):
        bg[ly0:ly1, lx] = col


OPS = {'mirror': mirror, 'copy': copy, 'mark': mark, 'paste': paste, 'band': band}
for op in __import__('json').load(open(os.path.join(os.path.dirname(__file__), 'patches.json'))):
    OPS[op[0]](*op[1:])

# 残りは周りから埋めて、パレットの色に戻す
rest = hole.astype(np.uint8) * 255
filled = cv2.inpaint(cv2.cvtColor(bg, cv2.COLOR_RGB2BGR), rest, 3, cv2.INPAINT_TELEA)
filled = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
bg[hole] = snap(filled[hole].reshape(-1, 1, 3)).reshape(-1, 3)

# ---------------------------------------------------------------- 吊るし物（揺らすので背景から抜く）
DARK = np.array([37, 25, 32])
HANGING = {  # 名前: (x0, y0, x1, y1, 判定)  判定=その画素が吊るし物か
    'noren': (100, 86, 294, 115, lambda r, g, b: (b > r + 8 and b > 70) or (r > 150 and g > 150 and b > 150)),
    'daikon': (102, 112, 148, 139, lambda r, g, b: (r + g + b) > 260 or (g > r + 15 and g > 70)),
    'chili_l': (147, 111, 172, 139, lambda r, g, b: r > g + 55),
    'chili_r': (278, 111, 295, 141, lambda r, g, b: r > g + 55),
}
hang_meta = {}
for name, (x0, y0, x1, y1, test) in HANGING.items():
    sub = bg[y0:y1, x0:x1]
    m = np.array([[test(*(int(v) for v in px)) for px in row] for row in sub])
    # 縁取り（暗い輪郭）も1ドット含める
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (sub.sum(-1) < 760)
    rgba = np.dstack([sub, m * 255]).astype(np.uint8)
    Image.fromarray(rgba).save(os.path.join(OUT, f'hang_{name}.png'))
    behind = sub.copy()
    behind[m] = DARK
    bg[y0:y1, x0:x1] = behind
    hang_meta[name] = (x0, y0)

# ---------------------------------------------------------------- 売り場の樽（3つ）の中身: 空/白菜/きゅうり
TOPS = {'tomato': (98, 164, 133, 174), 'kyuri': (136, 163, 171, 173), 'hakusai': (214, 164, 253, 174)}
SLOTS = ['tomato', 'kyuri', 'hakusai']  # 樽1〜3 に使う樽


def is_content(r, g, b):
    h, l, sat = __import__('colorsys').rgb_to_hls(r / 255, g / 255, b / 255)
    wood = 0.04 < h < 0.12 and sat > 0.2 and l < 0.62
    dark = l < 0.16
    return not wood and not dark


tex = {}
cmask = {}
for k, (x0, y0, x1, y1) in TOPS.items():
    sub = bg[y0:y1, x0:x1]
    content = np.array([[is_content(*(int(v) for v in px)) for px in row] for row in sub])
    h, w = content.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cmask[k] = ((xx - (w - 1) / 2) / (w / 2)) ** 2 + ((yy - (h - 1) / 2) / (h / 2)) ** 2 <= 1  # 樽の口（だ円）
    t = sub.copy()  # 中身の模様: 中身でない所は、同じ行の近くの中身の色で埋める
    for y in range(h):
        xs = np.nonzero(content[y])[0]
        if len(xs) == 0:
            xs = np.nonzero(content.any(0))[0][:1] if content.any() else [0]
            t[y] = t[min(h - 1, y + 1)]
            continue
        for x in range(w):
            if not content[y, x]:
                t[y, x] = sub[y, xs[np.abs(xs - x).argmin()]]
    tex[k] = t
slot_meta = []
for i, k in enumerate(SLOTS):
    x0, y0, x1, y1 = TOPS[k]
    m = cmask[k]
    h, w = m.shape
    for variant in ('empty', 'hakusai', 'kyuri'):
        img = np.zeros((h, w, 4), np.uint8)
        for y in range(h):
            for x in range(w):
                if not m[y, x]:
                    continue
                if variant == 'empty':  # 空の樽: 奥ほど暗い木の内側
                    img[y, x, :3] = (60, 41, 40) if y < h * 0.45 else (37, 25, 32)
                else:
                    t = tex[variant]
                    img[y, x, :3] = t[y % t.shape[0], (x + (t.shape[1] - w) // 2) % t.shape[1]]
                img[y, x, 3] = 255
        Image.fromarray(img).save(os.path.join(OUT, f'slot{i}_{variant}.png'))
    slot_meta.append({'x': x0, 'y': y0, 'w': w, 'h': h})

# ---------------------------------------------------------------- 空を抜く（上から塗りつぶしでつながった青）
def is_sky(c):
    r, g, b = (int(v) for v in c)
    return b > 150 and b > r + 30 and b >= g - 5


sky = np.zeros((H, W), bool)
stack = [(x, 0) for x in range(W) if is_sky(bg[0, x])]
while stack:
    x, y = stack.pop()
    if not (0 <= x < W and 0 <= y < H) or sky[y, x] or y > 120 or not is_sky(bg[y, x]):
        continue
    sky[y, x] = True
    stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

# 浮いている雲（全体が空に囲まれているもの）を抜き出して流す
CLOUDS = json_clouds = __import__('json').load(open(os.path.join(os.path.dirname(__file__), 'clouds.json')))
alpha = np.where(sky, 0, 255).astype(np.uint8)
cloud_meta = []
for i, (x0, y0, x1, y1) in enumerate(CLOUDS):
    sub = ~sky[y0:y1, x0:x1]
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = bg[y0:y1, x0:x1]
    rgba[..., 3] = sub * 255
    Image.fromarray(rgba).save(os.path.join(OUT, f'cloud_{i}.png'))
    alpha[y0:y1, x0:x1][sub] = 0
    cloud_meta.append((x0, y0))

out = np.dstack([bg, alpha])
Image.fromarray(out).save(os.path.join(OUT, 'bg.png'))
meta = {'size': [W, H], 'chars': placed, 'clouds': cloud_meta, 'hanging': hang_meta, 'slots': slot_meta}
with open(os.path.join(ROOT, 'assets/trace.js'), 'w') as f:
    f.write('// tools/trace.py が書き出す。手で編集しない（トレースし直すと上書きされる）。\n')
    f.write('export const TRACE = ' + __import__('json').dumps(meta, ensure_ascii=False) + ';\n')
print('ok', placed, cloud_meta)

"""参考画像をドット絵にトレースする。
  背景: assets/reference/shop_background.jpg（人のいない店先）
  人物: assets/reference/shop_reference.jpg（店主・客がいる店先）から切り抜く
  ポーズ: assets/reference/pose_*.jpg（店主・女性・おばあちゃんのポーズ集。無地の背景）

  python3 tools/trace.py      # 必要: pip install opencv-python-headless pillow numpy

出力（assets/img/）:
  bg.png              背景 384×216（人物を抜いて埋め直し、空は透明）
  cloud_*.png         空に浮かぶ雲（流すために背景から抜いたもの）
  char_kid*.png       子ども3人（店先の絵から切り抜き。動きは JS 側でずらしてコマを作る）
  pose_*_N.png        店主・女性・おばあちゃんのポーズ（ポーズ集から切り抜き）
  basket.png          かご

手順: 縮小(384×216) → 128色に減色 → GrabCut で人物を切り抜く → 吊るし物・樽の口・雲を抜く → 空を抜く。
人物の切り抜きのヒント（確実に人物/背景の場所）は、下の HINTS に 384×216 の座標で書く。
"""
import os
import numpy as np
import cv2
from PIL import Image
from defringe import defringe

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/reference/shop_reference.jpg')
BG_SRC = os.path.join(ROOT, 'assets/reference/shop_background.jpg')
OUT = os.path.join(ROOT, 'assets/img')
SC = 2  # 画面の大きさの倍率（384×216 を 1 として。2 なら 768×432。下の座標はすべて 384×216 で書き、使うときに SC 倍する）
W, H = 384 * SC, 216 * SC
VOTE = os.environ.get('TRACE_VOTE', '1') != '0'  # 1: 多数決で縮める / 0: 面積の平均で縮めて減色

src = cv2.imread(SRC)
S = src.shape[1] / W

# ---------------------------------------------------------------- 減色
rgb = Image.open(SRC).convert('RGB').resize((W, H), Image.BOX)
pal_img = rgb.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
PAL = np.array(pal_img.getpalette()[:128 * 3]).reshape(-1, 3)
base = np.asarray(pal_img.convert('RGB')).copy()


def vote_downscale(full, mask, tw, th, colors, dark_weight=1.6, seed=0):
    """元の絵（縮める前）を多数決で縮める。色は元の絵の画素から先に colors 色に決め（縮めてから決めると、線と地の混ざった色ばかりになる）、
    縮めた1マスごとに面積のいちばん多い色をとる。暗い色（線）は dark_weight 倍に数えて、細い輪郭線が消えにくくする。
    full: 元の絵 (H×W×3)。mask: 使う画素（None なら全部）。返り値: (th×tw×3, パレット)"""
    H, W = full.shape[:2]
    msk = np.ones((H, W), bool) if mask is None else mask.astype(bool)
    px = full[msk]
    rs = np.random.RandomState(seed)
    samp = px[rs.choice(len(px), min(len(px), 200000), replace=False)]
    pal_img = Image.fromarray(samp.reshape(1, -1, 3).astype(np.uint8)).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(pal_img.getpalette()[:colors * 3]).reshape(-1, 3)
    pal = pal[:max(1, len({tuple(c) for c in pal}))] if False else pal
    flat = full.reshape(-1, 3).astype(np.int32)
    lab = np.empty(len(flat), np.int32)
    for i in range(0, len(flat), 100000):
        d = ((flat[i:i + 100000, None, :] - pal[None, :, :]) ** 2).sum(-1)
        lab[i:i + 100000] = d.argmin(1)
    lab = lab.reshape(H, W)
    lum = pal @ np.array([0.299, 0.587, 0.114])
    wgt = np.where(lum < 80, dark_weight, 1.0)
    mf = msk.astype(np.float32)
    cov = np.zeros((len(pal), th, tw), np.float32)
    for k in range(len(pal)):
        sel = (lab == k) & msk
        if not sel.any():
            continue
        cov[k] = cv2.resize(sel.astype(np.float32), (tw, th), interpolation=cv2.INTER_AREA) * wgt[k]
    small = pal[cov.argmax(0)].astype(np.uint8)
    return small, pal


def despeckle(rgb, alpha):
    """ぽつんと1ドットだけ違う色（まわりの不透明な4近傍に同じ色がなく、3つ以上が同じ色）を、その色にそろえる。"""
    out = rgb.copy()
    H, W = alpha.shape
    for y in range(H):
        for x in range(W):
            if not alpha[y, x]:
                continue
            nb = [tuple(rgb[y + dy, x + dx]) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H and 0 <= x + dx < W and alpha[y + dy, x + dx]]
            me = tuple(rgb[y, x])
            if len(nb) >= 3 and me not in nb:
                c, n = max(((c, nb.count(c)) for c in set(nb)), key=lambda t: t[1])
                if n >= 3:
                    out[y, x] = c
    return out


def snap(arr):
    """色をパレットに寄せる（補修した部分もドット絵の色に戻す）。"""
    flat = arr.reshape(-1, 3).astype(int)
    d = ((flat[:, None, :] - PAL[None, :, :]) ** 2).sum(-1)
    return PAL[d.argmin(1)].reshape(arr.shape).astype(np.uint8)


# ---------------------------------------------------------------- 人物の切り抜き
BOXES = {
    'kid1': (280, 154, 304, 214), 'kid2': (312, 156, 341, 214), 'kid3': (346, 154, 381, 214),
    'basket': (229, 170, 248, 196),
}
HINTS = {  # fg: (cx, cy, r) / bg: (x0, y0, x1, y1)
    'kid1': {'fg': [(291, 163, 5), (292, 180, 3), (292, 197, 2)], 'bg': [(288, 154, 300, 158), (298, 154, 304, 176), (280, 154, 284, 165), (298, 206, 304, 214)]},
    'kid2': {'fg': [(325, 165, 6), (327, 185, 4), (327, 195, 3)], 'bg': [(336, 156, 341, 172)]},
    'kid3': {'fg': [(362, 163, 6), (360, 182, 4), (358, 195, 3), (371, 180, 3)], 'bg': [(368, 154, 381, 168), (377, 170, 381, 190)]},
    'basket': {'fg': [(238, 186, 4)], 'bg': []},
}


# 384×216 での手直し（切り抜きの足りない所・余計な所）
FORCE = {
}


def _sc(v):
    return tuple(int(round(x * SC)) for x in v)


BOXES = {k: _sc(v) for k, v in BOXES.items()}
HINTS = {k: {'fg': [_sc(c) for c in h['fg']], 'bg': [_sc(b) for b in h['bg']]} for k, h in HINTS.items()}
FORCE = {k: {kk: [_sc(b) for b in vv] for kk, vv in f.items()} for k, f in FORCE.items()}


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
    FULL_MASKS[name] = mm.astype(bool)  # 元の大きさのマスク（色を多数決で決めるときに使う）
    # 384×216 へ: セルの半分以上が人物なら人物
    small = cv2.resize(mm.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
    keep = np.zeros_like(small)
    keep[y0:y1, x0:x1] = small[y0:y1, x0:x1]
    for a, b, c, d in FORCE.get(name, {}).get('fg', []):
        keep[b:d, a:c] = True
    for a, b, c, d in FORCE.get(name, {}).get('bg', []):
        keep[b:d, a:c] = False
    return keep


FULL_MASKS = {}
masks = {n: grabcut(n) for n in BOXES}
# kid3 の後ろの茂みの色を落とす
x0, y0, x1, y1 = BOXES['kid3']
for y in range(y0, 175 * SC):
    for x in range(x0, x1):
        r, g, b = base[y, x].astype(int)
        if masks['kid3'][y, x] and ((g > r + 10 and g >= b - 30) or (b > r + 40 and x > 360 * SC)):
            masks['kid3'][y, x] = False


def save_sprite(name, mask):
    x0, y0, x1, y1 = BOXES[name]
    ys, xs = np.nonzero(mask[y0:y1, x0:x1])
    ax0, ay0, ax1, ay1 = x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1
    rgba = np.zeros((ay1 - ay0, ax1 - ax0, 4), np.uint8)
    # 人物は人物だけで減色する（全体の減色だと肌や服のピンクが消える）。元の絵の画素から24色に決めて多数決で縮める
    fy0, fy1, fx0, fx1 = int(ay0 * S), int(ay1 * S), int(ax0 * S), int(ax1 * S)
    full = src[fy0:fy1, fx0:fx1, ::-1].copy()  # cv2 は BGR
    fm = FULL_MASKS[name][fy0:fy1, fx0:fx1]
    own, _ = vote_downscale(full, fm if fm.any() else None, ax1 - ax0, ay1 - ay0, 24)
    rgba[..., :3] = despeckle(own, mask[ay0:ay1, ax0:ax1])
    rgba[..., 3] = mask[ay0:ay1, ax0:ax1] * 255
    Image.fromarray(rgba).save(os.path.join(OUT, f'{"char_" if name != "basket" else ""}{name}.png'))
    return (int(ax0), int(ay0), int(ax1 - ax0), int(ay1 - ay0))


os.makedirs(OUT, exist_ok=True)
placed = {n: save_sprite(n, m) for n, m in masks.items()}

# ---------------------------------------------------------------- 背景（人のいない絵から）
BG_COLORS = 192
if VOTE:
    bg, _ = vote_downscale(np.asarray(Image.open(BG_SRC).convert('RGB')), None, W, H, BG_COLORS, dark_weight=1.0)  # 元の絵の画素から色を決め、多数決で縮める
    bg = bg.copy()
else:
    bg_rgb = Image.open(BG_SRC).convert('RGB').resize((W, H), Image.BOX)
    bg = np.asarray(bg_rgb.quantize(colors=BG_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')).copy()

# ---------------------------------------------------------------- 吊るし物（揺らすので背景から抜く）
DARK = np.array([37, 25, 32])
HANGING = {  # 名前: (x0, y0, x1, y1, 判定)  判定=その画素が吊るし物か
    'noren': (97, 86, 292, 115, lambda r, g, b: (b > r + 8 and b > 70) or (r > 150 and g > 150 and b > 150)),
    'daikon': (99, 111, 147, 140, lambda r, g, b: (r + g + b) > 260 or (g > r + 15 and g > 70)),
    'chili_l': (147, 111, 172, 139, lambda r, g, b: r > g + 55),
    'chili_r': (278, 111, 295, 141, lambda r, g, b: r > g + 55),
}
HANGING = {k: (*_sc(v[:4]), v[4]) for k, v in HANGING.items()}
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
TOPS = {'tomato': (99, 161, 133, 171), 'kyuri': (132, 162, 166, 172), 'hakusai': (212, 163, 249, 173)}
TOPS = {k: _sc(v) for k, v in TOPS.items()}
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
    if not (0 <= x < W and 0 <= y < H) or sky[y, x] or y > 120 * SC or not is_sky(bg[y, x]):
        continue
    sky[y, x] = True
    stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

# 浮いている雲（全体が空に囲まれているもの）を抜き出して流す
CLOUDS = [(120, 11, 143, 22), (217, 5, 297, 28)]
CLOUDS = [_sc(c) for c in CLOUDS]
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
# ---------------------------------------------------------------- ポーズ集（無地の背景）から人物のコマを切り出す
# ポーズ集ごとの背丈（ドット）。ポーズの高さの中央値をこの背丈に合わせる（店先の店主が約76）
# ポーズ集の中で消す所（x0, y0, x1, y1。元の画像の座標）: おじいさんの「受け取る」に写っている、渡す人の手
POSE_ERASE = {'oldman': [(960, 412, 1024, 441)], 'boy': [(1290, 552, 1376, 594)], 'girl': [(1290, 552, 1376, 594)], 'student': [(1290, 552, 1376, 594)], 'gakuran': [(1290, 552, 1376, 594)], 'blazer': [(1290, 552, 1376, 594)], 'yankee': [(960, 412, 1024, 441)], 'suit': [(1290, 552, 1376, 594)], 'shades': [(960, 412, 1024, 441)], 'volley': [(960, 412, 1024, 441)], 'soccer': [(960, 412, 1024, 441)], 'racer': [(1290, 552, 1376, 594)], 'karate': [(1290, 552, 1376, 594)], 'samurai': [(1290, 552, 1376, 594)], 'beach': [(1290, 552, 1376, 594)], 'parasol': [(1290, 552, 1376, 594)], 'angler': [(960, 412, 1024, 441)], 'hiker': [(1290, 552, 1376, 594)], 'knight': [(1290, 552, 1376, 594)], 'alien': [(960, 412, 1024, 441)], 'centaur': [(1290, 552, 1376, 594)], 'witch': [(960, 412, 1024, 441)], 'demon': [(960, 412, 1024, 441)]}
# 影が茶色がかった灰色の絵: 影とみなす明るさの範囲（黒い靴・白いソックスの陰を消さないように）
WARM_SHADOW = {'boy': (55, 172), 'girl': (55, 172), 'student': (55, 172), 'gakuran': (55, 172), 'blazer': (95, 150),
               'yankee': (95, 178, 12), 'suit': (70, 172), 'shades': (95, 178, 12), 'volley': (95, 178, 12), 'soccer': (95, 178, 12), 'racer': (95, 178, 12), 'karate': (95, 178, 12), 'samurai': (95, 178, 12), 'beach': (95, 178, 12), 'parasol': (95, 178, 12), 'hiker': (55, 172), 'knight': (95, 178, 12), 'alien': (95, 178, 12), 'centaur': (55, 172), 'witch': (55, 172), 'demon': (55, 172)}  # 3つめ: 色味の幅の上限（既定20）
# 背景との色の差がこれより大きい所を人物とみなす（既定40。背景に近い白い靴などがある絵は下げる）
FG_DIFF = {}
# 影とみなす青みの上限（b - r）。青みがかった白い靴の陰を影と間違える絵は下げる
SHADOW_BLUE = {'yankee': 12, 'shades': 12, 'volley': 12, 'soccer': 12, 'racer': 12, 'karate': 12, 'samurai': 12, 'beach': 12, 'parasol': 12, 'knight': 12, 'alien': 12}
# 輪郭のすき間を閉じてから内側を埋める（背景と同じ色の部分がある絵。値は閉じる幅）
# 内側の穴でも、背景との色の差がこれ以下なら埋めない（脚のあいだのすき間など）
HOLE_NOT_BG = {'beach': 18, 'knight': 15, 'centaur': 18}
CLOSE_HOLES = {'blazer': 9, 'yankee': 9, 'shades': 9, 'volley': 9, 'soccer': 9, 'racer': 9, 'karate': 9, 'samurai': 9, 'beach': 5, 'parasol': 9, 'knight': 9, 'alien': 9}
POSE_HEIGHT = {'keeper': 77, 'woman': 74, 'granny': 73, 'granny2': 72, 'oldman': 75, 'boy': 56, 'girl': 58, 'student': 64, 'gakuran': 66, 'blazer': 65, 'yankee': 70, 'suit': 74, 'shades': 72, 'volley': 64, 'soccer': 62, 'racer': 70, 'karate': 68, 'samurai': 70, 'beach': 66, 'parasol': 80, 'angler': 78, 'hiker': 72, 'knight': 74, 'alien': 66, 'centaur': 74, 'witch': 74, 'demon': 72}


# 服の色をそろえる人物: ポーズ0（歩きの元の絵）の襟・スカートの色に、ほかのポーズの襟・スカートを塗り直す。
# 値は塗らない所（ポーズ番号: [(x0, y0, x1, y1), ...]。切り抜いたコマの座標）。かご・財布・袋など、服に近い色の持ち物
OUTFIT = {'granny': {6: [(21, 45, 99, 64)], 7: [(26, 24, 99, 36)]},
          'granny2': {6: [(21, 32, 99, 40)]}}


def _hsv(rgb):
    x = cv2.cvtColor(rgb.astype(np.float32) / 255, cv2.COLOR_RGB2HSV)
    return x[..., 0], x[..., 1], x[..., 2]


def outfit_regions(rgb, alpha, skip=()):
    """襟（上）とスカート（下）のドットを返す。服の色相（そのコマで多い色）から ±28° の、くすんだ暗めの色。
    あごより上（顔・髪の線）と、スカートの裾より下（靴）は入れない。"""
    h, s, v = _hsv(rgb)
    hh = np.where(h <= 30, h + 360, h)
    H = rgb.shape[0]
    base = alpha & (s > 0.17) & (v > 0.05) & (v < 0.62)
    broad = base & (hh >= 195) & (hh <= 370)
    skin = alpha & (h > 12) & (h < 40) & (s > 0.25) & (v > 0.55)
    chin = max([y for y in range(int(H * 0.3)) if skin[y].sum() >= 3] or [0])
    band = np.zeros_like(alpha); band[int(H * 0.72):int(H * 0.88)] = True
    neck = np.zeros_like(alpha); neck[chin:chin + 7] = True
    out = []
    for zone in (neck, band):
        c0 = float(np.median(hh[broad & zone]))
        c = base & (np.abs(hh - c0) <= 28)
        n, lab, st, _ = cv2.connectedComponentsWithStats(c.astype(np.uint8), 8)
        keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] >= 12])
        keep[:max(0, chin - 1)] = False
        for x0, y0, x1, y1 in skip:
            keep[y0:y1, x0:x1] = False
        out.append(keep)
    upper, lower = out
    cnt = lower.sum(1)
    hem = max(y for y in range(H) if cnt[y] >= 9)
    upper[hem + 1:] = False; lower[hem + 1:] = False
    mid = (chin + hem) // 2  # 襟（胸の前の帯も）は上半分、スカートは下半分
    upper[mid:] = False; lower[:mid] = False
    return upper, lower


def outfit_stats(rgb, masks):
    h, s, v = _hsv(rgb)
    hh = np.where(h <= 30, h + 360, h)
    return [(float(np.median(hh[m])), float(np.median(s[m])), float(np.median(v[m]))) for m in masks]


def recolor_outfit(rgb, masks, src, ref):
    """色相をずらし、彩度・明るさを比で合わせる（陰影の段はそのまま残る）。"""
    h, s, v = _hsv(rgb)
    out = rgb.astype(np.float32) / 255
    for m, (h0, s0, v0), (h1, s1, v1) in zip(masks, src, ref):
        hn = (h[m] + (h1 - h0)) % 360
        sn = np.clip(s[m] * s1 / max(s0, 1e-3), 0, 1)
        vn = np.clip(v[m] * v1 / max(v0, 1e-3), 0, 1)
        px = cv2.cvtColor(np.dstack([hn, sn, vn]).astype(np.float32), cv2.COLOR_HSV2RGB)
        out[m] = px.reshape(-1, 3)
    return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)


# 頭巾をそろえる: ポーズ集で頭巾をかぶっているポーズとかぶっていないポーズが混ざっている人は、
# かぶっているポーズ（src）の頭巾を、かぶっていないポーズ（dst）の髪と入れかえる（顔の位置で合わせる。顔はそのまま）
HOOD = {'granny': {'src': 4, 'dst': [0, 1, 3, 6, 7], 'hooded': [2, 4, 5]}}


POSE_COLORS = 48  # 人物1人の色数（記号 0-9A-Za-l。m 以降は人ごとの足し色に使える）


def _skin(rgba):
    a = rgba[..., :3].astype(np.float32) / 255
    mx, mn = a.max(-1), a.min(-1)
    r, g = a[..., 0], a[..., 1]
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.where(mx == r, (g - a[..., 2]) / np.maximum(mx - mn, 1e-6) * 60, 999)
    return (rgba[..., 3] > 0) & (hue > 12) & (hue < 40) & (sat > 0.25) & (mx > 0.55)


def _head_cover(rgba):
    """頭の、肌でないドット（髪・頭巾とそのふちの線）: あごより上で、頭のてっぺんにつながっているかたまり。あごの行と、顔の位置も返す"""
    skin = _skin(rgba)
    H = rgba.shape[0]
    rows = [y for y in range(int(H * 0.35)) if skin[y].sum() >= 3]
    chin = max(rows) if rows else int(H * 0.25)
    cand = (rgba[..., 3] > 0) & ~skin
    cand[chin + 1:] = False
    n, lab = cv2.connectedComponents(cand.astype(np.uint8), connectivity=8)
    top = {lab[y, x] for y in range(min(3, H)) for x in range(rgba.shape[1]) if cand[y, x]}
    cover = np.isin(lab, list(top)) & cand
    ys, xs = np.nonzero(skin[:chin + 1])
    return cover, chin, (int(ys.min()), int(xs.min()))


def hood_from_reference(q, alpha, sub, m, tw, th, crop):
    """頭巾を元の絵から描き直す。元の絵（縮める前）の頭のドットを 線・頭巾の白・髪の灰色・肌 に分け、
    1マスごとに面積の多い種類で決めて縮める（細い線や白が灰色に混ざらない）。色は元の絵の、その種類の色。
    q, alpha: 縮めたあとの絵。sub: 元の絵の切り抜き。m: 人物のマスク（元の大きさ）。crop: 縮めた絵の切り取り位置"""
    f = sub.astype(np.float32)
    lum = f @ np.array([0.299, 0.587, 0.114], np.float32)
    mx, mn = f.max(-1), f.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.where(mx == f[..., 0], (f[..., 1] - f[..., 2]) / np.maximum(mx - mn, 1e-6) * 60, 999)
    fig = m > 0
    skin = fig & (hue > 12) & (hue < 40) & (sat > 0.25) & (mx > 140)
    dark = fig & ~skin & (lum < 100)
    light = fig & ~skin & ~dark & (lum >= 195) & (mx - mn < 45)
    mid = fig & ~skin & ~dark & ~light
    (ya, yb, xa, xb) = crop
    def small(mask):
        return cv2.resize(mask.astype(np.float32), (tw, th), interpolation=cv2.INTER_AREA)[ya:yb, xa:xb]
    cov = np.stack([small(~fig), small(skin), small(dark), small(light), small(mid)])  # 背景・肌・線・白・灰
    lab = cov.argmax(0)
    light_lum = small(light * lum) / np.maximum(small(light), 1e-6)
    # 色: 元の絵のその種類の色（中央値）
    col = lambda mask, d: np.median(sub[mask], 0).astype(np.uint8) if mask.any() else np.array(d, np.uint8)
    c_line, c_white, c_grey = col(dark, (52, 52, 62)), col(light & (lum >= 225), (236, 238, 242)), col(mid, (150, 152, 160))
    c_shade = col(light & (lum < 225), (210, 212, 218))
    # 頭（あごより上）だけ描き直す
    rgba = np.dstack([q, alpha * 255]).astype(np.uint8)
    cover, chin, _ = _head_cover(rgba)
    out = rgba.copy()
    skin_now = _skin(rgba)
    for y in range(min(chin + 1, out.shape[0])):
        for x in range(out.shape[1]):
            L = lab[y, x]
            if L == 0:
                if not skin_now[y, x]:
                    out[y, x] = 0
            elif L == 1:
                if not skin_now[y, x] and not alpha[y, x]:
                    out[y, x, :3] = c_shade; out[y, x, 3] = 255  # まれ: 肌のはずが透明 → 影の色
            elif L == 2:
                out[y, x, :3] = c_line; out[y, x, 3] = 255
            elif L == 3:
                out[y, x, :3] = c_white if light_lum[y, x] >= 218 else c_shade; out[y, x, 3] = 255
            else:
                out[y, x, :3] = c_grey; out[y, x, 3] = 255
    return out[..., :3], out[..., 3] > 0


def crisp_hood(rgba):
    """頭巾をくっきりさせる: 縮小でぼけた頭巾のふちの線を暗い線に、内側を白（と薄い影の1段）にそろえる。
    髪（灰色のかたまり）はそのまま。形（透明かどうか）は変えない"""
    out = np.array(rgba, copy=True)
    cover, chin, _ = _head_cover(out)
    skin = _skin(out)
    alpha = out[..., 3] > 0
    lum = out[..., :3].astype(int) @ np.array([299, 587, 114]) // 1000
    # 線の色: 頭の中でいちばん暗い色
    ys, xs = np.nonzero(cover)
    dark_i = np.argmin(lum[ys, xs]); line = out[ys[dark_i], xs[dark_i], :3].copy()
    white_px = out[cover & (lum >= 200)][:, :3]
    white = white_px.max(0) if len(white_px) else np.array([236, 238, 242])
    shade = np.clip(white.astype(int) - 22, 0, 255).astype(np.uint8)
    W = cover & (lum >= 170)
    for _ in range(2):  # 白のとなりの明るめの灰色（線とまざった色）は白に
        pad = np.pad(W, 1)
        nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        W |= cover & nb & (lum >= 135)
    H_, W_ = alpha.shape
    pa = np.pad(alpha, 1); ps = np.pad(skin, 1)
    edge_out = cover & ~(pa[:-2, 1:-1] & pa[2:, 1:-1] & pa[1:-1, :-2] & pa[1:-1, 2:])  # 透明に接する
    edge_face = cover & (ps[:-2, 1:-1] | ps[2:, 1:-1] | ps[1:-1, :-2] | ps[1:-1, 2:])  # 顔に接する
    inner = W & ~edge_out & ~edge_face
    out[inner & (lum >= 200), :3] = white
    out[inner & (lum < 200), :3] = shade
    out[(edge_out | edge_face) & (W | (lum < 120)), :3] = line
    hair = cover & ~W & ~edge_out & ~edge_face  # 頭巾からのぞく髪: 灰色1色と線の2段に
    if hair.any():
        grey = np.median(out[hair & (lum >= 120)][:, :3], 0).astype(np.uint8) if (hair & (lum >= 120)).any() else shade
        out[hair & (lum >= 120), :3] = grey
        out[hair & (lum < 120), :3] = line
    return out


def transplant_hood(dst, src):
    """src の頭巾を dst の髪と入れかえた絵を返す（上にはみ出す分は行を足す）"""
    cover_s, chin_s, face_s = _head_cover(src)
    cover_d, chin_d, face_d = _head_cover(dst)
    dy, dx = face_d[0] - face_s[0], face_d[1] - face_s[1]
    sy, sx = np.nonzero(cover_s)
    pad = max(0, -(sy.min() + dy))
    out = np.pad(dst, ((pad, 0), (0, 0), (0, 0)))
    cover_d = np.pad(cover_d, ((pad, 0), (0, 0)))
    out[cover_d] = 0  # 髪を消す
    skin_d = _skin(out)
    for y, x in zip(sy, sx):
        ty, tx = y + dy + pad, x + dx
        if 0 <= ty < out.shape[0] and 0 <= tx < out.shape[1] and not skin_d[ty, tx]:
            out[ty, tx] = src[y, x]
    return out


POSE_HEIGHT = {k: v * SC for k, v in POSE_HEIGHT.items()}


def extract_poses(name):
    a = np.asarray(Image.open(os.path.join(ROOT, f'assets/reference/pose_{name}.jpg')).convert('RGB')).astype(int)
    h0, w0, _ = a.shape
    bgc = np.median(a[2:10, 2:10].reshape(-1, 3), 0)
    mx, mn = a.max(-1), a.min(-1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gridc = (g > 235) & (b > 235) & (r < 240)
    # 枠線: 区切り線の色が縦・横に長く続く列と行だけ（水色っぽい白い靴などを消さないように）
    grid = np.zeros_like(gridc)
    grid[:, gridc.mean(0) > 0.5] = True
    grid[gridc.mean(1) > 0.5, :] = True
    grid &= gridc
    fg = ((np.abs(a - bgc).sum(-1) > FG_DIFF.get(name, 40)) & ~grid).astype(np.uint8)
    # 影は背景より暗い灰色（白い靴や服の明るい陰は背景に近いので、影とみなさない）
    shadow = (b >= r - 10) & (b - r <= SHADOW_BLUE.get(name, 25)) & ((mx - mn) < 30) & (mx > 70) & (mx < bgc.max() - 20)
    if name in WARM_SHADOW:  # 影が茶色がかった灰色の絵
        lo, hi, *rest = WARM_SHADOW[name]
        shadow |= ((mx - mn) < (rest[0] if rest else 20)) & (mx > lo) & (mx < hi)
    for x0e, y0e, x1e, y1e in POSE_ERASE.get(name, []):
        fg[y0e:y1e, x0e:x1e] = 0
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n2, _, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    # 絵の端に触れている部品（渡す人の手など、枠の外から入っているもの）は除く
    boxes = [list(st[i, :4]) for i in range(1, n2)
             if st[i, 4] > 400 and st[i, 0] > 2 and st[i, 1] > 2 and st[i, 0] + st[i, 2] < w0 - 2 and st[i, 1] + st[i, 3] < h0 - 2]
    merged = True
    while merged:  # 近い部品（袋など）を同じ人物にまとめる
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                x1, y1, w1, h1 = boxes[i]; x2, y2, w2, h2 = boxes[j]
                if x1 - 12 < x2 + w2 and x2 - 12 < x1 + w1 and y1 - 12 < y2 + h2 and y2 - 12 < y1 + h1:
                    boxes[i] = [min(x1, x2), min(y1, y2), max(x1 + w1, x2 + w2) - min(x1, x2), max(y1 + h1, y2 + h2) - min(y1, y2)]
                    boxes.pop(j); merged = True; break
            if merged:
                break
    boxes = [bx for bx in boxes if bx[3] > h0 * 0.2]
    rows = h0 / 2  # 2段
    boxes.sort(key=lambda bx: (int((bx[1] + bx[3] / 2) // rows), bx[0]))  # 上の段から左→右
    scale = POSE_HEIGHT[name] / float(np.median([bx[3] for bx in boxes]))
    poses = []
    for i, (x, y, w, h) in enumerate(boxes):
        x0, y0, x1, y1 = max(0, x - 4), max(0, y - 4), min(w0, x + w + 4), min(h0, y + h + 4)
        m = fg[y0:y1, x0:x1].copy()
        sh = shadow[y0:y1, x0:x1].copy()
        sh[:max(0, (y1 - y0) - int(34 * h0 / 572))] = False  # 足元の影だけ落とす
        m[sh] = 0
        k = CLOSE_HOLES.get(name)
        pad = (k or 0) + 2  # 外側に余白を足してから閉じる（端がふさがらないように）
        mp = np.pad(m, pad)
        closed = cv2.morphologyEx(mp, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) if k else mp
        inv = (1 - closed).astype(np.uint8)
        cv2.floodFill(inv, np.zeros((inv.shape[0] + 2, inv.shape[1] + 2), np.uint8), (0, 0), 2)
        inv, closed = inv[pad:-pad, pad:-pad], closed[pad:-pad, pad:-pad]
        holes = inv == 1
        if name in HOLE_NOT_BG:  # 脚のあいだなど、囲まれていても背景の色のままの所は埋めない
            holes &= np.abs(a[y0:y1, x0:x1] - bgc).sum(-1) > HOLE_NOT_BG[name]
        m[holes] = 1  # 内側の穴（白い服の影など）を埋める
        if k:
            m[(closed > 0) & ~sh] = 1
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(np.float32)
        tw, th = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
        ms = cv2.resize(m, (tw, th), interpolation=cv2.INTER_AREA)
        alpha = ms > 0.5
        ys, xs = np.nonzero(alpha)
        if VOTE:  # 色は元の絵の画素から決めて、1マスごとに多数決で縮める（平均すると線と地が混ざってぼける）
            small, _ = vote_downscale(a[y0:y1, x0:x1].astype(np.uint8), m > 0, tw, th, POSE_COLORS, dark_weight=1.0)
            q = small[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        else:
            rgbf = a[y0:y1, x0:x1].astype(np.float32) * m[..., None]
            cs = cv2.resize(rgbf, (tw, th), interpolation=cv2.INTER_AREA) / np.maximum(ms[..., None], 1e-6)
            cs = cs[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            q = np.asarray(Image.fromarray(np.clip(cs, 0, 255).astype(np.uint8)).quantize(colors=POSE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
        alpha = alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        q = despeckle(q, alpha)
        if name in HOOD and i in HOOD[name]['hooded']:  # 頭巾を元の絵から描き直す
            q, alpha = hood_from_reference(q, alpha, a[y0:y1, x0:x1], m, tw, th, (ys.min(), ys.max() + 1, xs.min(), xs.max() + 1))
        if name in OUTFIT:  # 襟・スカートの色をポーズ0にそろえる
            masks = outfit_regions(q, alpha, OUTFIT[name].get(i, ()))
            st_ = outfit_stats(q, masks)
            if i == 0:
                ref_outfit = st_
            else:
                q = recolor_outfit(q, masks, st_, ref_outfit)
        rgba = defringe(np.dstack([q, alpha * 255]).astype(np.uint8))[0]  # ふちに残った白いにじみを取る
        Image.fromarray(rgba).save(os.path.join(OUT, f'pose_{name}_{i}.png'))
        feet = np.nonzero(alpha[-4:].any(0))[0]  # 足元の中心
        poses.append({'w': int(alpha.shape[1]), 'h': int(alpha.shape[0]), 'ax': int(round(feet.mean()))})
    if name in HOOD:  # 頭巾をそろえる（頭巾をくっきりさせてから、顔の位置で合わせて髪と入れかえる）
        src = np.asarray(Image.open(os.path.join(OUT, f'pose_{name}_{HOOD[name]["src"]}.png')).convert('RGBA'))
        for i in HOOD[name]['dst']:
            fp = os.path.join(OUT, f'pose_{name}_{i}.png')
            out = transplant_hood(np.asarray(Image.open(fp).convert('RGBA')), src)
            q = np.asarray(Image.fromarray(out[..., :3]).quantize(colors=POSE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
            out = np.dstack([q, out[..., 3]]).astype(np.uint8)  # 頭巾の色が足されたぶん、色数をそろえ直す
            Image.fromarray(out).save(fp)
            poses[i]['h'] = int(out.shape[0])
    return poses


POSES = {n: extract_poses(n) for n in POSE_HEIGHT}

meta = {'size': [W, H], 'poses': POSES, 'chars': placed, 'clouds': cloud_meta, 'hanging': hang_meta, 'slots': slot_meta}
with open(os.path.join(ROOT, 'assets/trace.js'), 'w') as f:
    f.write('// tools/trace.py が書き出す。手で編集しない（トレースし直すと上書きされる）。\n')
    f.write('export const TRACE = ' + __import__('json').dumps(meta, ensure_ascii=False) + ';\n')
print('ok', placed, cloud_meta)

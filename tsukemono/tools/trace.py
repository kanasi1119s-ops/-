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

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/reference/shop_reference.jpg')
BG_SRC = os.path.join(ROOT, 'assets/reference/shop_background.jpg')
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

# ---------------------------------------------------------------- 背景（人のいない絵から）
bg_rgb = Image.open(BG_SRC).convert('RGB').resize((W, H), Image.BOX)
bg = np.asarray(bg_rgb.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')).copy()

# ---------------------------------------------------------------- 吊るし物（揺らすので背景から抜く）
DARK = np.array([37, 25, 32])
HANGING = {  # 名前: (x0, y0, x1, y1, 判定)  判定=その画素が吊るし物か
    'noren': (97, 86, 292, 115, lambda r, g, b: (b > r + 8 and b > 70) or (r > 150 and g > 150 and b > 150)),
    'daikon': (99, 111, 147, 140, lambda r, g, b: (r + g + b) > 260 or (g > r + 15 and g > 70)),
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
TOPS = {'tomato': (99, 161, 133, 171), 'kyuri': (132, 162, 166, 172), 'hakusai': (212, 163, 249, 173)}
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
CLOUDS = [(120, 11, 143, 22), (217, 5, 297, 28)]
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
POSE_ERASE = {'oldman': [(960, 412, 1024, 441)], 'boy': [(1290, 552, 1376, 594)], 'girl': [(1290, 552, 1376, 594)], 'student': [(1290, 552, 1376, 594)], 'gakuran': [(1290, 552, 1376, 594)], 'blazer': [(1290, 552, 1376, 594)], 'yankee': [(960, 412, 1024, 441)], 'suit': [(1290, 552, 1376, 594)], 'shades': [(960, 412, 1024, 441)], 'volley': [(960, 412, 1024, 441)], 'soccer': [(960, 412, 1024, 441)], 'racer': [(1290, 552, 1376, 594)], 'karate': [(1290, 552, 1376, 594)], 'samurai': [(1290, 552, 1376, 594)], 'beach': [(1290, 552, 1376, 594)]}
# 影が茶色がかった灰色の絵: 影とみなす明るさの範囲（黒い靴・白いソックスの陰を消さないように）
WARM_SHADOW = {'boy': (55, 172), 'girl': (55, 172), 'student': (55, 172), 'gakuran': (55, 172), 'blazer': (95, 150),
               'yankee': (95, 178, 12), 'suit': (70, 172), 'shades': (95, 178, 12), 'volley': (95, 178, 12), 'soccer': (95, 178, 12), 'racer': (95, 178, 12), 'karate': (95, 178, 12), 'samurai': (95, 178, 12), 'beach': (95, 178, 12)}  # 3つめ: 色味の幅の上限（既定20）
# 背景との色の差がこれより大きい所を人物とみなす（既定40。背景に近い白い靴などがある絵は下げる）
FG_DIFF = {}
# 影とみなす青みの上限（b - r）。青みがかった白い靴の陰を影と間違える絵は下げる
SHADOW_BLUE = {'yankee': 12, 'shades': 12, 'volley': 12, 'soccer': 12, 'racer': 12, 'karate': 12, 'samurai': 12, 'beach': 12}
# 輪郭のすき間を閉じてから内側を埋める（背景と同じ色の部分がある絵。値は閉じる幅）
# 内側の穴でも、背景との色の差がこれ以下なら埋めない（脚のあいだのすき間など）
HOLE_NOT_BG = {'beach': 18}
CLOSE_HOLES = {'blazer': 9, 'yankee': 9, 'shades': 9, 'volley': 9, 'soccer': 9, 'racer': 9, 'karate': 9, 'samurai': 9, 'beach': 5}
POSE_HEIGHT = {'keeper': 77, 'woman': 74, 'granny': 73, 'granny2': 72, 'oldman': 75, 'boy': 56, 'girl': 58, 'student': 64, 'gakuran': 66, 'blazer': 65, 'yankee': 70, 'suit': 74, 'shades': 72, 'volley': 64, 'soccer': 62, 'racer': 70, 'karate': 68, 'samurai': 70, 'beach': 66}


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
        rgbf = a[y0:y1, x0:x1].astype(np.float32) * m[..., None]
        ms = cv2.resize(m, (tw, th), interpolation=cv2.INTER_AREA)
        cs = cv2.resize(rgbf, (tw, th), interpolation=cv2.INTER_AREA) / np.maximum(ms[..., None], 1e-6)
        alpha = ms > 0.5
        ys, xs = np.nonzero(alpha)
        cs, alpha = cs[ys.min():ys.max() + 1, xs.min():xs.max() + 1], alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        img = Image.fromarray(np.clip(cs, 0, 255).astype(np.uint8))
        q = np.asarray(img.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
        rgba = np.dstack([q, alpha * 255]).astype(np.uint8)
        Image.fromarray(rgba).save(os.path.join(OUT, f'pose_{name}_{i}.png'))
        feet = np.nonzero(alpha[-4:].any(0))[0]  # 足元の中心
        poses.append({'w': int(alpha.shape[1]), 'h': int(alpha.shape[0]), 'ax': int(round(feet.mean()))})
    return poses


POSES = {n: extract_poses(n) for n in POSE_HEIGHT}

meta = {'size': [W, H], 'poses': POSES, 'chars': placed, 'clouds': cloud_meta, 'hanging': hang_meta, 'slots': slot_meta}
with open(os.path.join(ROOT, 'assets/trace.js'), 'w') as f:
    f.write('// tools/trace.py が書き出す。手で編集しない（トレースし直すと上書きされる）。\n')
    f.write('export const TRACE = ' + __import__('json').dumps(meta, ensure_ascii=False) + ';\n')
print('ok', placed, cloud_meta)

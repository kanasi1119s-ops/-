# 人物の絵の色をそろえる設計図を作る。  python3 tools/sprite_color.py [名前の頭...] → assets/editor/mend/color.design.json
#   そのあと EDITOR_OUT=assets/editor/mend node tools/editor_touch.mjs assets/editor/mend/color.design.json で、
#   エディタの色の表の色を色選びで置きかえ（recolor）、にごりの点をえんぴつで直して（touch）書き出す。
# なぜ: ポーズ集は1ポーズずつ別に減色したので、同じ人の同じ服でもポーズごとに少しずつ色が違い（1人あたり約370色）、
#   動くと色がちらつき、人どうしでも輪郭の黒・肌の色合い・くすみ具合がばらばらだった。
# 手順:
#   1. 人ごとの色の表: 全ポーズの色を Lab で重みつき k-means にかけて約40色にし、目の光や小さな飾りなど表から遠い色は足す。
#      表の色は実在の色から選ぶ（新しい色は作らない）。その人のポーズ・歩くコマ・驚いた顔・怒った顔を、近い表の色に置きかえる
#      （表から ΔE 14 より遠い色＝顔の汗や怒りの印などは、そのまま）。
#   2. 全員共通の調整 T（色→色）: 肌の色相をそろえる、くすんだ中間色を少し澄ませる（白・灰・黒と鮮やかな色はさわらない）、
#      とても暗い輪郭の色をこげ茶寄りの黒にそろえる（元の色合いも少し残す）。従業員・男爵・タマ殿・子どもは T だけ。
#   3. にごりの点: 8方向のうち6つ以上が同じ色で、自分はそれに近い色（ΔE 12 未満）のぽつんとした点を、まわりの色にそろえる。
#   足もとの半透明の影の色は変えない。
import glob, json, os, sys
from collections import Counter
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMG = os.path.join(ROOT, 'assets/img')
OUT = os.path.join(ROOT, 'assets/editor/mend')
CHARS = 'keeper woman granny granny2 oldman boy girl student gakuran blazer yankee suit shades volley soccer racer karate samurai beach parasol angler hiker knight alien centaur witch demon'.split()
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def to_lab(rgb):
    return cv2.cvtColor(np.asarray(rgb, np.uint8).reshape(-1, 1, 3).astype(np.float32) / 255, cv2.COLOR_RGB2LAB).reshape(-1, 3)


def to_rgb(lab):
    return np.clip(cv2.cvtColor(np.asarray(lab, np.float32).reshape(-1, 1, 3), cv2.COLOR_LAB2RGB).reshape(-1, 3) * 255 + 0.5, 0, 255).astype(np.uint8)


def load(n):
    return np.asarray(Image.open(os.path.join(IMG, n + '.png')).convert('RGBA'))


def build_palette(ch, k=40, extra_de=14):
    cnt = Counter()
    for f in glob.glob(os.path.join(IMG, f'pose_{ch}_*.png')):
        a = np.asarray(Image.open(f).convert('RGBA')); m = a[..., 3] == 255
        u, n = np.unique(a[m][:, :3], axis=0, return_counts=True)
        for c, k_ in zip(map(tuple, u), n): cnt[c] += int(k_)
    cols = np.array(list(cnt.keys()), np.uint8); w = np.array([cnt[tuple(c)] for c in cols], float)
    L = to_lab(cols)
    X = np.repeat(L, np.maximum(1, np.sqrt(w).astype(int)), axis=0).astype(np.float32)
    cv2.setRNGSeed(1)
    _, _, cent = cv2.kmeans(X, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 4, cv2.KMEANS_PP_CENTERS)
    pal = np.unique(np.array([cols[((L - c) ** 2).sum(1).argmin()] for c in cent]), axis=0)
    d = np.sqrt(((L[:, None, :] - to_lab(pal)[None]) ** 2).sum(-1)).min(1)
    far = d > extra_de
    if far.any():
        fc, fl, fw = cols[far], L[far], w[far]; keep = []
        for i in np.argsort(-fw):
            if all(np.sqrt(((fl[i] - fl[j]) ** 2).sum()) > extra_de for j in keep): keep.append(i)
        pal = np.concatenate([pal, fc[keep]])
    return pal


P = dict(ol_L=22, ol_target=(12.0, 6.0, 3.0), ol_mix=0.55, skin_h=(25, 80), skin_c=(8, 60), skin_L=(35, 92), skin_hue=52.0, skin_mix=0.6,
         vib=0.30, vib_cmin=5.0, vib_cmax=45.0)


def T(rgb, p=P):
    """全員共通の色の調整（色→色）"""
    lab = to_lab(rgb).astype(np.float64); L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    C = np.hypot(a, b); h = np.degrees(np.arctan2(b, a)) % 360
    sk = (h >= p['skin_h'][0]) & (h <= p['skin_h'][1]) & (C >= p['skin_c'][0]) & (C <= p['skin_c'][1]) & (L >= p['skin_L'][0]) & (L <= p['skin_L'][1])
    h = np.where(sk, h + (((p['skin_hue'] - h + 180) % 360) - 180) * p['skin_mix'], h)
    mid = (L > 25) & (L < 88) & (C >= p['vib_cmin'])
    t = np.clip((C - p['vib_cmin']) / (p['vib_cmax'] - p['vib_cmin']), 0, 1)
    C = np.where(mid, C * (1 + p['vib'] * np.sin(np.pi * t)), C)
    a = C * np.cos(np.radians(h)); b = C * np.sin(np.radians(h))
    ol = L < p['ol_L']; m = p['ol_mix'] * np.clip((p['ol_L'] - L) / 8, 0, 1)
    tl, ta, tb = p['ol_target']
    L = np.where(ol, L * (1 - m) + tl * m, L); a = np.where(ol, a * (1 - m) + ta * m, a); b = np.where(ol, b * (1 - m) + tb * m, b)
    return to_rgb(np.stack([L, a, b], 1))


def color_map(a, pal=None, max_de=14):
    """その絵の不透明な色 → 新しい色"""
    u = np.unique(a[a[..., 3] == 255][:, :3], axis=0)
    src = u.copy()
    if pal is not None:
        d = ((to_lab(u)[:, None, :] - to_lab(pal)[None]) ** 2).sum(-1)
        j = d.argmin(1); near = np.sqrt(d[np.arange(len(u)), j]) < max_de
        src[near] = pal[j[near]]
    new = T(src)
    return {tuple(int(v) for v in o): tuple(int(v) for v in n) for o, n in zip(u, new)}


def tidy(a, de=12.0, need=6):
    H, W = a.shape[:2]; op = a[..., 3] == 255; out = a.copy()
    lab = to_lab(a[..., :3].reshape(-1, 3)).reshape(H, W, 3)
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not op[y, x]: continue
            nb = [(y + dy, x + dx) for dy, dx in N8]
            if not all(op[q] for q in nb): continue
            c, k = Counter(tuple(a[q][:3]) for q in nb).most_common(1)[0]
            if k < need or c == tuple(a[y, x, :3]): continue
            q = next(q for q in nb if tuple(a[q][:3]) == c)
            if np.sqrt(((lab[y, x] - lab[q]) ** 2).sum()) < de: out[y, x, :3] = c
    return out


hexc = lambda c: '#%02x%02x%02x' % tuple(c)


def design_for(n, pal):
    a = load(n)
    cmap = color_map(a, pal)
    semi = {tuple(int(v) for v in c) for c in a[(a[..., 3] > 0) & (a[..., 3] < 255)][:, :3]}
    cmap = {o: nw for o, nw in cmap.items() if o not in semi}  # 影の色は変えない
    b = a.copy(); m = b[..., 3] == 255
    flat = [cmap.get(tuple(int(v) for v in c), tuple(int(v) for v in c)) for c in b[m][:, :3]]
    b[m, :3] = np.array(flat, np.uint8)
    c = tidy(b)
    touch = [{'x': int(x), 'y': int(y), 'color': hexc(c[y, x, :3])} for y, x in zip(*np.nonzero(np.any(c != b, -1)))]
    return {'recolor': {hexc(o): hexc(nw) for o, nw in cmap.items() if o != nw}, 'touch': touch}, c


def main(prefixes):
    os.makedirs(OUT, exist_ok=True)
    jobs = []
    for ch in CHARS:
        names = [os.path.basename(f)[:-4] for f in glob.glob(os.path.join(IMG, f'*_{ch}_*.png')) + glob.glob(os.path.join(IMG, f'*_{ch}.png'))]
        names = [n for n in names if n.split('_')[0] in ('pose', 'walk', 'surprise', 'angry') and n.split('_')[1] == ch]
        jobs.append((ch, sorted(names)))
    others = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(IMG, '*.png')) if os.path.basename(f).split('_')[0] in ('staff', 'baron', 'tama', 'char'))
    jobs.append((None, others))
    path = os.path.join(OUT, 'color.design.json')
    design = json.load(open(path)) if prefixes and os.path.exists(path) else {}
    for ch, names in jobs:
        if prefixes: names = [n for n in names if any(n.startswith(p) for p in prefixes)]
        if not names: continue
        pal = build_palette(ch) if ch else None
        for n in names:
            design[n], _ = design_for(n, pal)
        print(ch or 'others', len(names), '枚')
    json.dump(design, open(path, 'w'))
    print(len(design), '枚 →', path, ' 置きかえる色', sum(len(v['recolor']) for v in design.values()), ' 直す点', sum(len(v['touch']) for v in design.values()))


if __name__ == '__main__':
    main(sys.argv[1:])

# 人物の絵の手直しの設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/sprite_mend.py [絵の名前の頭...] → assets/editor/mend/mend.design.json
#   そのあと EDITOR_OUT=assets/editor/mend node tools/editor_touch.mjs assets/editor/mend/mend.design.json で、
#   エディタのえんぴつ・消しゴムで1ドットずつ描いて書き出す。
# 直すもの（元の絵の描き方はそのまま。内側の明るい縁取りや細い線には手を出さない）:
#   1. 形の欠け: 受け取りのポーズ（7）で宙に浮いた袋（参照画像では店の人の手が持っていた）を、お客の指先にかける。
#      おばあちゃん2人のポーズ7に残った店主の手を消して、袋をかけ直す。おばあちゃんの頭巾の付け替えで抜けた首と肩を、
#      同じ向きの別のポーズから移して埋める（歩くコマ・驚いた顔・怒った顔も同じ所）。切り抜きの切れ端を消す。
#   2. 体の中の小さな穴（靴・靴下・かごのピンホール）を、まわりの色で埋める。
#   3. 線と体のあいだの透明な隙間を体の色で埋める。
#   4. 線の外にはみ出した背景の色（線と背景の中間の灰色・背景の白の取り残し・線にぶら下がった明るい点）と、はぐれたドットを消す。
#   5. 白い服などの明るい縁で線が抜けた所に、外側へ1ドットの線を足す（近くの線の色）。
# 足す色は、その絵にもとからある近い色に寄せる（エディタの色の表は62色まで）。
import json, os, sys
from collections import Counter
from multiprocessing import Pool
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMG = os.path.join(ROOT, 'assets/img')
OUT = os.path.join(ROOT, 'assets/editor/mend')
BG = np.array([196, 205, 214], float)  # 参照画像の背景（薄い青灰色）。切り抜きの縁にこの色が混ざっている
LW = np.array([0.299, 0.587, 0.114])
N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
N8 = N4 + [(-1, -1), (-1, 1), (1, -1), (1, 1)]
MAX_COLORS = 62


def load(name):
    return np.asarray(Image.open(os.path.join(IMG, name + '.png')).convert('RGBA')).copy()


def lum(c):
    return float(np.dot(c[:3], LW))


class Img:
    def __init__(s, a):
        s.a = a.copy(); s.H, s.W = a.shape[:2]
    def op(s, y, x):  # 不透明（体）。半透明の影は体に数えない
        return 0 <= y < s.H and 0 <= x < s.W and s.a[y, x, 3] == 255
    def tr(s, y, x):  # 完全に透明（絵の外も透明あつかい）
        return not (0 <= y < s.H and 0 <= x < s.W) or s.a[y, x, 3] == 0
    def c(s, y, x):
        return s.a[y, x, :3].astype(float)
    def dark(s, y, x, t=95):
        return s.op(y, x) and lum(s.c(y, x)) < t


def blend_bg(p, d):
    """p が線の色 d と背景 BG を混ぜた色か: (混ぜ具合 t, 残差)"""
    v = BG - d; n = float(v @ v)
    if n < 1:
        return 0, 999
    t = float((p - d) @ v) / n
    return t, float(np.abs(p - (d + t * v)).sum())


def clean(a, steps=('hole', 'gap', 'halo', 'speck', 'line'), hole_max=6):
    im = Img(a); H, W = im.H, im.W

    def setp(y, x, col):
        if col is None:
            im.a[y, x] = 0
        else:
            im.a[y, x, :3] = col; im.a[y, x, 3] = 255

    if 'hole' in steps:  # 体の中の小さな透明（ピンホール）: まわりの色で外から埋める
        tr = (im.a[..., 3] == 0).astype(np.uint8)
        k, lab, st, _ = cv2.connectedComponentsWithStats(tr, connectivity=4)
        for i in range(1, k):
            x0, y0, w, h, n = st[i]
            if x0 == 0 or y0 == 0 or x0 + w >= W or y0 + h >= H or n > hole_max:
                continue
            left = set(zip(*np.nonzero(lab == i)))
            if any(0 < im.a[yy + dy, xx + dx, 3] < 255 for yy, xx in left for dy, dx in N4):
                continue  # 影のそばはさわらない
            while left:
                done = []
                for yy, xx in left:
                    nb = [tuple(im.a[yy + dy, xx + dx, :3]) for dy, dx in N4 if im.op(yy + dy, xx + dx) and (yy + dy, xx + dx) not in left]
                    if nb:
                        done.append(((yy, xx), Counter(nb).most_common(1)[0][0]))
                if not done:
                    break
                for (yy, xx), col in done:
                    setp(yy, xx, np.array(col, np.uint8)); left.discard((yy, xx))
    if 'gap' in steps:  # 線と体のあいだの透明な隙間（線が体から1マス離れている）: 体の側の色で埋める
        fills = []
        for y in range(H):
            for x in range(W):
                if im.a[y, x, 3] != 0:
                    continue
                for dy, dx in N4:
                    by, bx = y + dy, x + dx
                    if not im.op(by, bx) or im.dark(by, bx):
                        continue
                    if not im.dark(y - dy, x - dx, 80):
                        continue
                    w = 1
                    while w < 3 and im.dark(y - dy * (w + 1), x - dx * (w + 1), 80):
                        w += 1
                    if w >= 3 or not im.tr(y - dy * (w + 1), x - dx * (w + 1)):
                        continue
                    fills.append((y, x, im.a[by, bx, :3].copy())); break
        for y, x, col in fills:
            setp(y, x, col)
    def bglike(c):  # 背景の取り残しらしい色: 鮮やかでなく、背景の色・白・線と背景の中間のどれか
        return c.max() - c.min() < 45 and (np.abs(c - BG).sum() < 45 or lum(c) > 200 or 90 < lum(c) < 200)

    def outside(y, x, p):
        """外から内へ3マス以内に暗い線があり、その奥に体が続き、そこまでが背景らしい色だけ（2〜3マス幅のにじみ）"""
        if not bglike(p):
            return False
        for dy, dx in N4:
            if not im.tr(y + dy, x + dx):
                continue
            for j in range(1, 4):
                qy, qx = y - j * dy, x - j * dx
                if im.dark(qy, qx):
                    if im.op(qy - dy, qx - dx) and im.op(qy - 2 * dy, qx - 2 * dx):
                        return True
                    break
                if not (im.op(qy, qx) and bglike(im.c(qy, qx))):
                    break
        return False

    if 'halo' in steps:  # 線の外にはみ出した背景の色（3層まで）
        for _ in range(3):
            kill = []
            for y in range(H):
                for x in range(W):
                    if not im.op(y, x) or im.dark(y, x):
                        continue
                    if not any(im.tr(y + dy, x + dx) for dy, dx in N4):
                        continue
                    p = im.c(y, x)
                    if p.max() - p.min() > 45:
                        continue
                    nop = sum(im.op(y + dy, x + dx) for dy, dx in N8)
                    # 線の外側にいるか: ある向きに 暗い線 → その奥に体が2マス以上、反対側は透明（細い紐や手ぬぐいの端は残る）
                    ds = [im.c(y + dy, x + dx) for dy, dx in N8
                          if im.dark(y + dy, x + dx) and im.op(y + 2 * dy, x + 2 * dx) and im.op(y + 3 * dy, x + 3 * dx) and im.tr(y - dy, x - dx)]
                    if not ds:
                        continue
                    isbg = any(0.15 <= t <= 0.8 and r < 24 for t, r in (blend_bg(p, d) for d in ds))  # 線と背景の中間の灰色
                    hang = nop <= 2 and lum(p) > 150  # 線にぶら下がった明るい点
                    white = lum(p) > 200 and any(im.tr(y + dy, x + dx) and im.dark(y - dy, x - dx, 110) and im.op(y - 2 * dy, x - 2 * dx)
                                                 and im.op(y - 3 * dy, x - 3 * dx) for dy, dx in N4)  # 線の真外の白
                    if isbg or hang or white or outside(y, x, p):
                        kill.append((y, x))
            for y, x in kill:
                setp(y, x, None)
    if 'speck' in steps:  # はぐれたドット（3つまでのかたまり。明るい切れ端は8つまで）
        m = (im.a[..., 3] == 255).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
        for i in range(1, n):
            if st[i, 4] <= 3 or (st[i, 4] <= 8 and float(np.mean(im.a[lab == i][:, :3] @ LW)) > 170):
                for y, x in zip(*np.nonzero(lab == i)):
                    setp(y, x, None)
    if 'line' in steps:  # 明るい縁で線が抜けた所: 外の空いた所に面した透明なマスに、近くの線の色で1ドット
        add = {}
        for y in range(H):
            for x in range(W):
                if not im.op(y, x) or lum(im.c(y, x)) < 140:
                    continue
                if any(im.dark(y + dy, x + dx, 110) for dy, dx in N4):
                    continue
                for dy, dx in N4:
                    ty, tx = y + dy, x + dx
                    if not (0 <= ty < H and 0 <= tx < W) or im.a[ty, tx, 3] != 0:
                        continue
                    if not (im.tr(ty + dy, tx + dx) and im.tr(ty + 2 * dy, tx + 2 * dx)):
                        continue  # 袋の穴などの狭い所には足さない
                    add[(ty, tx)] = 1
        add = [k for k in add if any(((k[0] + dy, k[1] + dx) in add) or im.dark(k[0] + dy, k[1] + dx, 110) for dy, dx in N8)]  # ぽつんと1つは足さない
        darks = [tuple(im.a[y, x, :3]) for y in range(H) for x in range(W) if im.dark(y, x, 75)]
        cols = []
        for ty, tx in add:
            near = [tuple(im.a[yy, xx, :3]) for yy in range(ty - 3, ty + 4) for xx in range(tx - 3, tx + 4) if im.dark(yy, xx, 75)]
            cols.append(Counter(near or darks).most_common(1)[0][0])
        for (ty, tx), col in zip(add, cols):
            setp(ty, tx, np.array(col, np.uint8))
    return im.a


# ---- 1. 形の欠け ----

def find_bag(a):
    """右に離れた袋のかたまりと、お客の指先（袋のすぐ左上の、体のいちばん右）"""
    m = (a[..., 3] > 0).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    cand = [i for i in range(1, k) if st[i, 4] > 100 and st[i, 0] > 0]  # 体（左端から）ではない大きなかたまり
    if not cand or k < 3:
        return None
    bi = max(cand, key=lambda i: st[i, 0]); x, y, w, h, _ = st[bi]
    main = (lab > 0) & (lab != bi)
    tip = max((np.nonzero(main[r])[0].max(), r) for r in range(max(0, y - 20), y + 8) if main[r].any())
    top = np.nonzero(lab[y] == bi)[0]
    return lab == bi, (x, y, w, h), tip, (top.min() + top.max()) / 2


def hang(a, crop, kc, tip):
    """袋（crop、結び目の横位置 kc）を、結び目が指先の下に来るように置く。手より奥に描く（手のドットは上書きしない）"""
    tx, ty = tip; main = a[..., 3] > 0; out = a.copy()
    ox = int(round(tx - 2 - kc)); oy = ty - 1
    for y, x in zip(*np.nonzero(crop[..., 3] > 0)):
        ny, nx = oy + y, ox + x
        if 0 <= ny < a.shape[0] and 0 <= nx < a.shape[1] and not main[ny, nx]:
            out[ny, nx] = crop[y, x]
    return out


def bag_crop(a, found):
    bag, (x, y, w, h), _, kc = found
    crop = np.zeros((h, w, 4), np.uint8); sub = bag[y:y + h, x:x + w]
    crop[sub] = a[y:y + h, x:x + w][sub]
    return crop, kc - x


def fix_floating_bag(a):
    f = find_bag(a)
    if f is None:
        return a
    crop, kc = bag_crop(a, f)
    out = a.copy(); out[f[0]] = 0
    return hang(out, crop, kc, f[2])


def fix_granny_bag(a):
    """おばあちゃんのポーズ7: 袋と、袋の上に残った店主の手を消し、おじいさんのポーズ7の袋を指先にかける"""
    H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    out = a.copy()
    out[(((xx >= 55) & (yy >= 50)) | ((xx >= 47) & (yy >= 70))) & (yy <= 99)] = 0
    c = out[..., :3].astype(int)
    skin = (out[..., 3] > 0) & (c[..., 0] > c[..., 1] + 25) & (c[..., 1] > c[..., 2])
    tip = max((np.nonzero(skin[r])[0].max(), r) for r in range(58, 71) if skin[r].any())
    donor = load('pose_oldman_7')
    crop, kc = bag_crop(donor, find_bag(donor))
    return hang(out, crop, kc, tip)


def align(dst, src, rows, xr, rng):
    """dst の (y, x) と src の (y + dy, x + dx) がいちばん合うずれ"""
    best = None
    for dx in range(-rng, rng + 1):
        for dy in range(-rng, rng + 1):
            s = n = 0
            for y in rows:
                for x in xr:
                    y2, x2 = y + dy, x + dx
                    n += 1
                    if not (0 <= y2 < src.shape[0] and 0 <= x2 < src.shape[1]):
                        s += 300; continue
                    p, q = dst[y, x], src[y2, x2]
                    if p[3] > 0 and q[3] > 0:
                        s += int(np.abs(p[:3].astype(int) - q[:3].astype(int)).sum())
                    elif (p[3] > 0) != (q[3] > 0):
                        s += 300
            v = s / max(n, 1)
            if best is None or v < best[0]:
                best = (v, dx, dy)
    return best[1], best[2]


def granny3_neck(a):
    """ポーズ3: 抜けた首と襟を、同じ前向きのポーズ4から移す（首の長さの差は縦に少しのばして合わせる）"""
    g4 = load('pose_granny_4'); out = a.copy()
    y0, y1 = 36, 54
    for y in range(y0, y1 + 1):
        t = (y - y0) / (y1 - y0); dy = round(t * -4); dx = round(4 + t * -3)  # 顔の位置合わせ (4, 0) → 胴の位置合わせ (1, -4)
        for x in range(4, 51):
            if y < 40 and a[y, x, 3] > 0:
                continue  # あごは元のまま
            out[y, x] = g4[y + dy, x + dx]
    return out


def granny0_shoulders(a):
    """ポーズ0: 首から肩の横5行の抜けを、似た歩きのポーズ1から埋める（顔も胴も同じずれ (6, 0)）"""
    g1 = load('pose_granny_1'); out = a.copy()
    for y in range(36, 43):
        for x in range(a.shape[1]):
            if a[y, x, 3] == 0 and 0 <= x + 6 < g1.shape[1]:
                out[y, x] = g1[y, x + 6]
    return out


def carry(dst, before, after, rows, by_face=True):
    """直したポーズ（before → after で埋まった所）を、同じ体の別の絵（歩くコマ・顔）の透明な所へ写す"""
    if dst.shape == before.shape and by_face is None:
        dx = dy = 0
    else:
        dx, dy = align(dst, before, range(18, 40), range(40, 85), 30)
    out = dst.copy()
    for y, x in zip(*np.nonzero((before[..., 3] == 0) & (after[..., 3] > 0))):
        if rows[0] <= y < rows[1]:
            wy, wx = y - dy, x - dx
            if 0 <= wy < dst.shape[0] and 0 <= wx < dst.shape[1] and dst[wy, wx, 3] == 0:
                out[wy, wx] = after[y, x]
    return out


KID_KEEP = {1: [(8, 88, 16, 97)], 2: [(0, 86, 40, 106)], 3: [(0, 30, 31, 61), (0, 88, 50, 108)]}  # 靴下・靴底・白いシャツ


def kid_white(a, k):
    """子どもの絵: 元の絵の背景の白が縁に残っている（服の白と同じ色）。外に面した白を、靴下などを除いて消す"""
    a = a.copy(); H, W = a.shape[:2]
    keep = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in KID_KEEP[k]:
        keep[y0:y1, x0:x1] = True
    white = Counter(tuple(c) for c in a[a[..., 3] > 0][:, :3] if c.min() > 245).most_common(1)[0][0]
    for _ in range(4):
        op = a[..., 3] > 0
        wh = op & np.all(a[..., :3] == white, -1) & ~keep
        pad = np.pad(~op, 1, constant_values=True)
        kill = wh & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
        if not kill.any():
            break
        a[kill] = 0
    return a


def erase(a, pts):
    a = a.copy()
    for x, y in pts:
        a[y, x] = 0
    return a


FLOATING_BAG = ['angler', 'beach', 'boy', 'centaur', 'demon', 'gakuran', 'girl', 'hiker', 'oldman', 'student', 'suit', 'witch']
SHAPE = {f'pose_{c}_7': fix_floating_bag for c in FLOATING_BAG}
SHAPE.update({
    'pose_granny_7': fix_granny_bag, 'pose_granny2_7': fix_granny_bag,
    'pose_granny_3': granny3_neck, 'pose_granny_0': granny0_shoulders,
    'pose_yankee_7': lambda a: erase(a, [(x, y) for x in range(92, 97) for y in range(63, 66)] + [(91, 63), (91, 65)]),  # 右の切れ端（店の人の袖）
    'pose_shades_7': lambda a: erase(a, [(x, y) for x in range(a.shape[1]) for y in range(139, a.shape[0])]),  # 靴の下に離れた地面の影のかけら
    'char_kid1': lambda a: kid_white(a, 1), 'char_kid2': lambda a: kid_white(a, 2), 'char_kid3': lambda a: kid_white(a, 3),
})
HOLE_MAX = {'pose_knight_7': 20}  # 肩当ての真ん中の穴
STEPS = {f'char_kid{k}': ('hole', 'speck') for k in (1, 2, 3)}  # 子どもは線を足さない（元の絵がもともと細い線）
SKIP = {'tama_0', 'tama_1', 'tama_2', 'tama_3'}  # タマ殿は参照から描き直したばかり


def snap(orig, new):
    """新しい色を、その絵にもとからある近い色に寄せる。色の表が62色を超えないようにする"""
    have = {tuple(c) for c in orig[orig[..., 3] > 0][:, :3]}
    m = new[..., 3] > 0
    fresh = Counter(tuple(c) for c in new[m][:, :3] if tuple(c) not in have)
    pal = np.array(sorted(have), float) if have else np.zeros((0, 3))
    keep = set()
    budget = MAX_COLORS - len(have)
    remap = {}
    for c, _ in fresh.most_common():
        d = np.abs(pal - np.array(c, float)).sum(1) if len(pal) else np.array([999.0])
        j = int(d.argmin()) if len(pal) else -1
        if (len(pal) and d[j] <= 30) or budget <= 0:
            remap[c] = tuple(int(v) for v in pal[j])
        else:
            keep.add(c); budget -= 1
    out = new.copy()
    for y, x in zip(*np.nonzero(m)):
        c = tuple(out[y, x, :3])
        if c in remap:
            out[y, x, :3] = remap[c]
    return out


def mend_one(name):
    a = load(name)
    b = SHAPE[name](a) if name in SHAPE else a.copy()
    b = clean(b, STEPS.get(name, ('hole', 'gap', 'halo', 'speck', 'line')), HOLE_MAX.get(name, 6))
    return name, a, b


def touches(a, b):
    out = []
    for y, x in zip(*np.nonzero(np.any(a != b, -1))):
        if b[y, x, 3] == 0:
            if a[y, x, 3] != 0:
                out.append({'x': int(x), 'y': int(y), 'color': None})
        elif b[y, x, 3] == 255:
            out.append({'x': int(x), 'y': int(y), 'color': '#%02x%02x%02x' % tuple(int(v) for v in b[y, x, :3])})
    return out


def main(prefixes):
    names = sorted(f[:-4] for f in os.listdir(IMG) if f.endswith('.png') and f.split('_')[0] in ('pose', 'walk', 'surprise', 'angry', 'staff', 'baron', 'char')
                   and f[:-4] not in SKIP)
    if prefixes:
        names = [n for n in names if any(n.startswith(p) for p in prefixes)]
    # 頭巾の付け替えで抜けた所は、歩くコマ・顔の絵にも写す（元のポーズを直してから）
    g0, g0f = load('pose_granny_0'), granny0_shoulders(load('pose_granny_0'))
    g3, g3f = load('pose_granny_3'), granny3_neck(load('pose_granny_3'))
    for i in range(16):
        SHAPE[f'walk_granny_{i}'] = lambda a, g0=g0, g0f=g0f: carry(a, g0, g0f, (36, 43))
    for kind in ('surprise', 'angry'):
        SHAPE[f'{kind}_granny'] = lambda a, g3=g3, g3f=g3f: carry(a, g3, g3f, (36, 55), by_face=None)
    with Pool(8) as pool:
        res = pool.map(mend_one, names)
    design = {}
    for name, a, b in res:
        b = snap(a, b)
        t = touches(a, b)
        if t:
            design[name] = t
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'mend.design.json')
    old = json.load(open(path)) if prefixes and os.path.exists(path) else {}
    old.update(design)
    json.dump(old, open(path, 'w'), ensure_ascii=False)
    print(len(design), '枚', sum(len(v) for v in design.values()), 'ドット →', path)


if __name__ == '__main__':
    main(sys.argv[1:])

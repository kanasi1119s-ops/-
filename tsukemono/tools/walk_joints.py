# 関節（股・膝・足首・肩）で動かす歩きの段取り。  python3 tools/walk_joints.py [名前...]
# 元の絵（assets/editor/<名前>.orig.json）を部品に分け、16コマぶん、部品ごとに関節を軸に回して置いた
# ドット絵エディタの作品（レイヤー×コマ）を作る。仕上げ（手直し・影・確認・書き出し）は tools/editor_joint_walk.mjs がエディタで行う。
#
# 部品（レイヤー。下から）: 影 / 奥の腕 / 奥の脚 / 胴 / 手前の脚 / カバン / 手前の腕 / かご
#   脚は もも（股関節〜膝）・すね（膝〜足首）・足（足首〜つま先）に分け、それぞれ関節を軸に回す。
#   かごの裏に隠れて元の絵にない手前の脚は、奥の脚の部品で まるごと描く（legFrom）
# 動き（1歩＝1周を16コマ。左右の脚は半周ずれ）:
#   股関節: 前へ約24°〜後ろへ約20°。膝関節: 着いている間ほぼまっすぐ、振り出すとき最大約58°曲がる。
#   足関節: かかとから着き、着いている間は靴底が平ら、後ろの足はつま先でけって離れる。
#   体の高さ: 地面に着いている脚で決める（足の裏がいつも地面の行に来る）。浮いた足が地面に食い込むときは膝をもっと曲げる。
#   腕: 肩を軸に、同じ側の脚と反対に振る。かごは手と一緒に動く。カバンは胴と一緒。
# 設定は tools/walk_joints.json（人ごとの関節の位置・部品の範囲）。
#
# 書き出す物（assets/editor/）: <名前>.joint.json（エディタで開く作品）、<名前>.touch.json（手直しのドット・影の範囲）
import json
import math
import os
import sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ED = os.path.join(HERE, '..', 'assets', 'editor')
CFGS = json.load(open(os.path.join(HERE, 'walk_joints.json'), encoding='utf8'))
N = 16
FRAME_MS = 70
PADX, PADY = 12, 4
SHADOW = (30, 22, 16)
SHADOW_OPACITY = 0.32
LAYERS = ['影', '奥の腕', '奥の脚', '胴', '手前の脚', 'カバン', '手前の腕', 'かご']


def curve(keys, t):
    t %= 1.0
    for i in range(len(keys) - 1):
        t0, v0 = keys[i]
        t1, v1 = keys[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            u = (1 - math.cos(math.pi * u)) / 2
            return v0 + (v1 - v0) * u
    return keys[-1][1]


def ang(A, B):  # 0＝真下、＋は前（右）
    return math.degrees(math.atan2(B[1] - A[1], B[0] - A[0]))


def length(A, B):
    return math.hypot(B[0] - A[0], B[1] - A[1])


def seg_dist(P, A, B):
    A = np.array(A, float); B = np.array(B, float); P = np.array(P, float)
    d = B - A
    t = max(0, min(1, np.dot(P - A, d) / max(1e-9, np.dot(d, d))))
    return np.linalg.norm(P - (A + t * d))


def build(name):
    C = CFGS[name]
    p = json.load(open(os.path.join(ED, f'{name}.plan.json'), encoding='utf8'))
    o = json.load(open(os.path.join(ED, f'{name}.orig.json'), encoding='utf8'))
    sym = {s['sym']: tuple(int(s['color'][i:i + 2], 16) for i in (1, 3, 5)) for s in o['symbols']}
    inv = {v: k for k, v in sym.items()}
    H, W = p['h'], p['w']
    img = np.zeros((H, W, 4), np.uint8)
    for y, r in enumerate(o['cels'][0][0]):
        for x, c in enumerate(r):
            if c != '.':
                img[y, x] = (*sym[c], 255)
    al = img[:, :, 3] > 0

    def rows_mask(rows):
        m = np.zeros((H, W), bool)
        for y0, y1, x0, x1 in rows:
            m[y0:y1 + 1, x0:x1 + 1] = True
        return m

    # 部品に分ける
    item = np.zeros((H, W), bool)
    for y, a, b in p['keepRuns']:
        item[y, a:b + 1] = True
    item[C.get('itemMaxRow', H) + 1:] = False  # かごの底より下は脚
    for y in range(H):  # かごの行で、かごより左に残ったドット（ふちの灰色など）もかご
        xs = np.nonzero(item[y])[0]
        if len(xs):
            item[y, :xs.min()] |= al[y, :xs.min()]
    item &= al
    bag = rows_mask(C.get('bag', [])) & al & ~item
    farA = rows_mask(C['farArm']) & al & ~item & ~bag
    nearA = rows_mask(C['nearArm']) & al & ~item & ~bag
    cut = C['cut']
    legzone = al & ~item & ~farA & ~nearA & ~bag
    legzone[:cut] = False
    J = C['joints']
    parts = {(l, s): np.zeros((H, W), bool) for l in ('near', 'far') for s in ('thigh', 'shin', 'foot')}
    for y, x in np.argwhere(legzone):  # いちばん近い骨に
        best = None
        for l in ('near', 'far'):
            j = J[l]
            for s, (a, b) in (('thigh', ('hip', 'knee')), ('shin', ('knee', 'ankle')), ('foot', ('ankle', 'toe'))):
                d = seg_dist((y, x), j[a], j[b])
                if best is None or d < best[0]:
                    best = (d, l, s)
        parts[(best[1], best[2])][y, x] = True
    torso = np.where((al & ~item & ~farA & ~nearA & ~legzone & ~bag)[..., None], img, 0).astype(np.uint8)

    # 手直し（下ごしらえ）: 腕の下に隠れていた胴を、胴のふちの色で2ドットうめる（腕を振っても胴が欠けない）
    def fill_under(arm, direction):
        for y in range(H):
            xs = np.nonzero(arm[y])[0]
            t = np.nonzero(torso[y, :, 3])[0]
            if not len(xs) or not len(t):
                continue
            e = t.min() if direction < 0 else t.max()
            src = torso[y, e].copy()
            rng = range(e - 1, max(e - 3, xs.min() - 1), -1) if direction < 0 else range(e + 1, min(e + 3, xs.max() + 1))
            for x in rng:
                if arm[y, x]:
                    torso[y, x] = src
    fill_under(nearA, -1)
    fill_under(farA, +1)

    measured = {}
    for l in ('near', 'far'):
        j = J[l]
        measured[l] = dict(th=ang(j['hip'], j['knee']), sh=ang(j['knee'], j['ankle']),
                           L1=length(j['hip'], j['knee']), L2=length(j['knee'], j['ankle']))
    # 足の裏の傾き（元の絵）: 足のドットの各列のいちばん下を直線で結んだ角度（＋はつま先が上）
    SOLE = {}
    for l in ('near', 'far'):
        ys, xs = np.nonzero(parts[(l, 'foot')])
        pts = [(x, ys[xs == x].max()) for x in sorted(set(xs))]
        k_ = np.polyfit([q[0] for q in pts], [q[1] for q in pts], 1)[0] if len(pts) > 2 else 0
        SOLE[l] = math.degrees(math.atan(-k_))
    TH, KN, FT = C['thighKeys'], C['kneeKeys'], C['footKeys']
    sole = C['ground']
    Hc, Wc = H + PADY * 2, W + PADX * 2

    def rot_paste(dst, src_mask, pivot_src, pivot_dst, dang):
        """src_mask のドットを pivot_src を軸に dang 度回して pivot_dst に置く。1ドットを3×3の点で調べ、5点以上当たれば置く（色は多数決）"""
        ys, xs = np.nonzero(src_mask)
        if not len(ys):
            return
        th = math.radians(dang); c, s = math.cos(th), math.sin(th)
        pts = np.stack([ys - pivot_src[0], xs - pivot_src[1]], 1).astype(float)
        ry = pts[:, 0] * c - pts[:, 1] * s; rx = pts[:, 0] * s + pts[:, 1] * c
        y0 = int(math.floor(ry.min() + pivot_dst[0])) - 1; y1 = int(math.ceil(ry.max() + pivot_dst[0])) + 1
        x0 = int(math.floor(rx.min() + pivot_dst[1])) - 1; x1 = int(math.ceil(rx.max() + pivot_dst[1])) + 1
        offs = [(a / 3, b / 3) for a in (-1, 0, 1) for b in (-1, 0, 1)]
        for ty in range(max(0, y0), min(dst.shape[0], y1 + 1)):
            for tx in range(max(0, x0), min(dst.shape[1], x1 + 1)):
                hits = {}
                for oy, ox in offs:
                    dy = ty + oy - pivot_dst[0]; dx = tx + ox - pivot_dst[1]
                    sy = dy * c + dx * s; sx = -dy * s + dx * c
                    iy = int(round(sy + pivot_src[0])); ix = int(round(sx + pivot_src[1]))
                    if 0 <= iy < H and 0 <= ix < W and src_mask[iy, ix]:
                        hits[(iy, ix)] = hits.get((iy, ix), 0) + 1
                if sum(hits.values()) >= 5:
                    iy, ix = max(hits, key=hits.get)
                    dst[ty, tx] = img[iy, ix]

    def fk(hip, a_th, a_sh, L1, L2):
        k = (hip[0] + L1 * math.cos(math.radians(a_th)), hip[1] + L1 * math.sin(math.radians(a_th)))
        a = (k[0] + L2 * math.cos(math.radians(a_sh)), k[1] + L2 * math.sin(math.radians(a_sh)))
        return k, a

    def paste_shift(dst, mask, dy, dx):
        for y, x in zip(*np.nonzero(mask)):
            if 0 <= y + dy < Hc and 0 <= x + dx < Wc:
                dst[y + dy, x + dx] = img[y, x]

    frames, touch, shadows = [], [], []
    for f in range(N):
        T = {'far': f / N, 'near': (f / N + 0.5) % 1.0}  # 奥の脚は t=0 で前に着く（元の絵）
        pose = {}
        for l in ('near', 'far'):
            t = T[l]
            src = C.get('legFrom', {}).get(l, l)
            pose[l] = dict(th=curve(TH, t), sh=curve(TH, t) - curve(KN, t), ft=curve(FT, t) - SOLE[src], src=src)

        def draw_leg(dst, l, bob):
            q = pose[l]; j = J[l]; m = measured[l]
            dh = C.get('drawHip', {}).get(l, j['hip'])
            hip = (dh[0] + bob + PADY, dh[1] + PADX)
            k, a = fk(hip, q['th'], q['sh'], m['L1'], m['L2'])
            src = q['src']; ms = measured[src]; js = J[src]
            rot_paste(dst, parts[(src, 'foot')], js['ankle'], a, q['ft'])
            rot_paste(dst, parts[(src, 'shin')], js['knee'], k, q['sh'] - ms['sh'])
            rot_paste(dst, parts[(src, 'thigh')], js['hip'], hip, q['th'] - ms['th'])

        def lowest(l, bob):
            tmp = np.zeros((Hc, Wc, 4), np.uint8)
            draw_leg(tmp, l, bob)
            cnt = (tmp[:, :, 3] > 0).sum(1)
            rows = np.nonzero(cnt >= 2)[0]  # 回して1ドットだけ飛び出た所は数えない
            return (rows.max() if len(rows) else np.nonzero(cnt)[0].max()) - PADY

        stance = [l for l in ('near', 'far') if T[l] < 0.55]
        bob = sole - max(lowest(l, 0) for l in stance)
        for l in ('near', 'far'):
            if l in stance:
                continue
            for _ in range(12):
                if lowest(l, bob) <= sole - 1:
                    break
                pose[l]['sh'] -= 4
        L = {nm: np.zeros((Hc, Wc, 4), np.uint8) for nm in LAYERS}
        armK = C.get('armGain', 0.35)

        def arm_angle(l):
            return -armK * (pose[l]['th'] - measured[l]['th'])
        sh = C['farShoulder']
        rot_paste(L['奥の腕'], farA, sh, (sh[0] + bob + PADY, sh[1] + PADX), arm_angle('far'))
        draw_leg(L['奥の脚'], 'far', bob)
        for y, x in zip(*np.nonzero(torso[:, :, 3])):
            L['胴'][y + bob + PADY, x + PADX] = torso[y, x]
        draw_leg(L['手前の脚'], 'near', bob)
        paste_shift(L['カバン'], bag, bob + PADY, PADX)
        na = arm_angle('near')
        sh = C['nearShoulder']
        rot_paste(L['手前の腕'], nearA, sh, (sh[0] + bob + PADY, sh[1] + PADX), na)
        hand = C['nearHand']
        th = math.radians(na); dy = hand[0] - sh[0]; dx = hand[1] - sh[1]
        ox = round(dy * math.sin(th) + dx * math.cos(th) - dx); oy = round(dy * math.cos(th) - dx * math.sin(th) - dy)
        paste_shift(L['かご'], item, oy + bob + PADY, ox + PADX)
        for nm in LAYERS:
            L[nm][sole + PADY + 1:] = 0  # 地面より下にはみ出たドットは消す
        # 手直しのドット: 重ねた絵で、左右か上下を囲まれた透明なドット（部品を動かしてできたすき間）。となりの色で
        comp = np.zeros((Hc, Wc, 4), np.uint8)
        for nm in LAYERS[1:]:
            m_ = L[nm][:, :, 3] > 0
            comp[m_] = L[nm][m_]
        fixes = []
        for _ in range(2):
            m_ = comp[:, :, 3] > 0
            new = []
            for y in range(1, Hc - 1):
                for x in range(1, Wc - 1):
                    if m_[y, x]:
                        continue
                    if m_[y, x - 1] and m_[y, x + 1]:
                        new.append((y, x, comp[y, x - 1].copy()))
                    elif m_[y - 1, x] and m_[y + 1, x]:
                        new.append((y, x, comp[y - 1, x].copy()))
            for y, x, c in new:
                comp[y, x] = c
                fixes.append([int(y), int(x), inv[tuple(int(v) for v in c[:3])]])
        touch.append(fixes)
        # 影: 地面に着いている足の下に、足の幅より少し広いだ円
        g = sole + PADY
        xs = np.nonzero(comp[g - 1, :, 3] | comp[g, :, 3])[0]
        x0, x1 = (int(xs.min()) - 3, int(xs.max()) + 3) if len(xs) else (PADX, PADX + W)
        shadows.append([g, max(0, x0), min(Hc - 1, g + 2), min(Wc - 1, x1)])
        frames.append(L)

    # エディタの作品（レイヤー×コマ）
    shadow_sym = next(c for c in '!#$%&*+-=?@^~' if c not in sym)
    symbols = list(o['symbols']) + [{'sym': shadow_sym, 'label': '影', 'color': '#%02x%02x%02x' % SHADOW}]

    def rows_of(Lr):
        return [''.join(inv[tuple(int(v) for v in Lr[y, x, :3])] if Lr[y, x, 3] else '.' for x in range(Wc)) for y in range(Hc)]
    proj = {'format': 'sunshine-pixel', 'version': 2, 'width': Wc, 'height': Hc, 'symbols': symbols,
            'layers': [{'name': nm, 'visible': True, 'opacity': SHADOW_OPACITY if nm == '影' else 1} for nm in LAYERS],
            'frames': [{'dur': FRAME_MS} for _ in range(N)],
            'cels': [[rows_of(frames[f][nm]) for f in range(N)] for nm in LAYERS], 'layer': 0, 'frame': 0}
    with open(os.path.join(ED, f'{name}.joint.json'), 'w', encoding='utf8') as fh:
        json.dump(proj, fh, ensure_ascii=False)
    with open(os.path.join(ED, f'{name}.touch.json'), 'w', encoding='utf8') as fh:
        json.dump({'fixes': touch, 'shadows': shadows, 'shadowSym': shadow_sym, 'ground': sole + PADY,
                   'padLeft': PADX, 'padBottom': Hc - 1 - (sole + PADY)}, fh, ensure_ascii=False)
    print(f'{name}: {N}コマ {Wc}×{Hc}・手直し {sum(len(t) for t in touch)}ドット')


if __name__ == '__main__':
    for nm in (sys.argv[1:] or list(CFGS)):
        build(nm)

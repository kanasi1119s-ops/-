# 関節で動かす歩きの「手順表」を作る。  python3 tools/walk_rig.py [名前...]
# 実際の作業（部品に分ける・回す・動かす・手直し・影・書き出し）は、ドット絵エディタで tools/editor_rig_walk.mjs が行う。
# ここでは、エディタの「回す（角度・軸）」と同じ計算（rotate_cells）で、各コマの各部品を何度回して何マス動かすかを決め、
# 足の裏が地面に来る高さ・浮いた足が地面に食い込まない膝の曲げを前もって求める。
#
# 部品（レイヤー。下から）: 影 / 奥の腕 / 奥の足 / 奥のすね / 奥のもも / 胴 / 手前の足 / 手前のすね / 手前のもも / カバン / 手前の腕 / かご / 手直し
#   もも＝股関節〜膝、すね＝膝〜足首、足＝足首〜つま先。かごの裏で元の絵にない手前の脚は、奥の脚のレイヤーを複製して作る（legFrom）
# 動き（1歩＝1周を16コマ。左右の脚は半周ずれ）:
#   股関節: 前へ約24°〜後ろへ約20°。膝関節: 着いている間ほぼまっすぐ、振り出すとき最大約58°曲がる。
#   足関節: かかとから着き、着いている間は靴底が平ら、後ろの足はつま先でけって離れる。
#   体の高さ: 地面に着いている脚で決める（足の裏がいつも地面の行に来る）。浮いた足が地面に食い込むなら膝をもっと曲げる。
#   腕: 肩を軸に、同じ側の脚と反対に振る。かごは手と一緒、カバンは胴と一緒に動く。
# 設定: tools/walk_joints.json（人ごとの関節の位置・部品の範囲・角度の動き）
# 書き出す物: assets/editor/<名前>.rig.json（エディタの手順）、assets/editor/<名前>.rigsim.json（手順どおりに作ったときの絵。エディタの結果と照らし合わせる）
import json
import math
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ED = os.path.join(HERE, '..', 'assets', 'editor')
CFGS = json.load(open(os.path.join(HERE, 'walk_joints.json'), encoding='utf8'))
N = 16
FRAME_MS = 70
PADX, PADY = 12, 4
SHADOW = (30, 22, 16)
SHADOW_OPACITY = 0.32
SEG = ('foot', 'shin', 'thigh')
JNAME = {'thigh': '股関節', 'shin': '膝', 'foot': '足首'}
LNAME = {('far', 'foot'): '奥の足', ('far', 'shin'): '奥のすね', ('far', 'thigh'): '奥のもも',
         ('near', 'foot'): '手前の足', ('near', 'shin'): '手前のすね', ('near', 'thigh'): '手前のもも'}
LAYERS = ['影', '奥の腕', '奥の足', '奥のすね', '奥のもも', '胴', '手前の足', '手前のすね', '手前のもも', 'カバン', '手前の腕', 'かご']


def jsround(v):  # JavaScript の Math.round と同じ（.5 は上へ）
    return int(math.floor(v + 0.5))


def rotate_cells(cells, r0, c0, deg, pr, pc):
    """エディタの rotateCells と同じ計算。cells は文字の2次元リスト（'.' は透明）。＋で時計回り"""
    th = deg * math.pi / 180
    cs, sn = math.cos(th), math.sin(th)
    h, w = len(cells), len(cells[0])

    def fwd(r, c):
        y, x = r - pr, c - pc
        return pr + x * sn + y * cs, pc + x * cs - y * sn
    corners = [fwd(r0 - 0.5, c0 - 0.5), fwd(r0 - 0.5, c0 + w - 0.5), fwd(r0 + h - 0.5, c0 - 0.5), fwd(r0 + h - 0.5, c0 + w - 0.5)]
    R0 = math.floor(min(q[0] for q in corners)); C0 = math.floor(min(q[1] for q in corners))
    R1 = math.ceil(max(q[0] for q in corners)); C1 = math.ceil(max(q[1] for q in corners))
    offs = [-1 / 3, 0, 1 / 3]
    out = []
    for tr in range(R0, R1 + 1):
        row = []
        for tc in range(C0, C1 + 1):
            hits = {}; n = 0; best = '.'; bn = 0
            for oy in offs:
                for ox in offs:
                    y = tr + oy - pr; x = tc + ox - pc
                    sr = jsround(pr + y * cs - x * sn); sc = jsround(pc + x * cs + y * sn)
                    i, j = sr - r0, sc - c0
                    if 0 <= i < h and 0 <= j < w and cells[i][j] != '.':
                        k = i * w + j; hits[k] = hits.get(k, 0) + 1; n += 1
                        if hits[k] > bn:
                            bn = hits[k]; best = cells[i][j]
            row.append(best if n >= 5 else '.')
        out.append(row)
    return out, R0, C0


def stamp(grid, cells, r, c):
    H, W = len(grid), len(grid[0])
    for i, row in enumerate(cells):
        for j, s in enumerate(row):
            if s != '.' and 0 <= r + i < H and 0 <= c + j < W:
                grid[r + i][c + j] = s


def apply_op(grid, op):
    """エディタでの1つの操作（全体を選ぶ → 回す → 動かす → 確定）を、同じように行う"""
    H, W = len(grid), len(grid[0])
    cells = [row[:] for row in grid]
    r, c = 0, 0
    if op.get('deg'):
        cells, r, c = rotate_cells(cells, 0, 0, op['deg'], op['pr'], op['pc'])
    out = [['.'] * W for _ in range(H)]
    stamp(out, cells, r + op.get('dy', 0), c + op.get('dx', 0))
    return out


def curve(keys, t):
    t %= 1.0
    for i in range(len(keys) - 1):
        t0, v0 = keys[i]; t1, v1 = keys[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0); u = (1 - math.cos(math.pi * u)) / 2
            return v0 + (v1 - v0) * u
    return keys[-1][1]


def ang(A, B):  # 0＝真下、＋は前（右）。エディタの角度（＋で時計回り）は、この符号を反対にしたもの
    return math.degrees(math.atan2(B[1] - A[1], B[0] - A[0]))


def seg_dist(P, A, B):
    A = np.array(A, float); B = np.array(B, float); P = np.array(P, float)
    d = B - A
    t = max(0, min(1, np.dot(P - A, d) / max(1e-9, np.dot(d, d))))
    return np.linalg.norm(P - (A + t * d))


def runs(mask):
    out = []
    for y in range(mask.shape[0]):
        x = 0
        while x < mask.shape[1]:
            if mask[y, x]:
                s = x
                while x + 1 < mask.shape[1] and mask[y, x + 1]:
                    x += 1
                out.append([int(y), int(s), int(x)])
            x += 1
    return out


def build(name):
    C = CFGS[name]
    p = json.load(open(os.path.join(ED, f'{name}.plan.json'), encoding='utf8'))
    o = json.load(open(os.path.join(ED, f'{name}.orig.json'), encoding='utf8'))
    H0, W0 = p['h'], p['w']
    H, W = H0 + PADY * 2, W0 + PADX * 2
    # 余白をつけた元の絵（エディタで開く）
    rows0 = o['cels'][0][0]
    grid = [['.'] * W for _ in range(H)]
    for y, r in enumerate(rows0):
        for x, ch in enumerate(r):
            grid[y + PADY][x + PADX] = ch
    al = np.array([[ch != '.' for ch in row] for row in grid])

    def J(pt):  # 元の絵の座標 → 余白つきの座標
        return [pt[0] + PADY, pt[1] + PADX]

    def rows_mask(rr):
        m = np.zeros((H, W), bool)
        for y0, y1, x0, x1 in rr:
            m[y0 + PADY:y1 + PADY + 1, x0 + PADX:x1 + PADX + 1] = True
        return m
    # 部品の範囲
    item = np.zeros((H, W), bool)
    for y, a, b in p['keepRuns']:
        item[y + PADY, a + PADX:b + PADX + 1] = True
    item[C.get('itemMaxRow', H0) + 1 + PADY:] = False
    for y in range(H):
        xs = np.nonzero(item[y])[0]
        if len(xs):
            item[y, :xs.min()] |= al[y, :xs.min()]
    item &= al
    bag = rows_mask(C.get('bag', [])) & al & ~item
    farA = rows_mask(C['farArm']) & al & ~item & ~bag
    nearA = rows_mask(C['nearArm']) & al & ~item & ~bag
    legzone = al & ~item & ~farA & ~nearA & ~bag
    legzone[:C['cut'] + PADY] = False
    joints = {l: {k: J(v) for k, v in C['joints'][l].items()} for l in ('near', 'far')}
    seg = {(l, s): np.zeros((H, W), bool) for l in ('near', 'far') for s in SEG}
    for y, x in np.argwhere(legzone):
        best = None
        for l in ('near', 'far'):
            j = joints[l]
            for s, (a, b) in (('thigh', ('hip', 'knee')), ('shin', ('knee', 'ankle')), ('foot', ('ankle', 'toe'))):
                d = seg_dist((y, x), j[a], j[b])
                if best is None or d < best[0]:
                    best = (d, l, s)
        seg[(best[1], best[2])][y, x] = True
    torso = al & ~item & ~farA & ~nearA & ~legzone & ~bag
    G = np.array(grid)
    # 胴の手直し: 腕の下に隠れていた胴を、胴のふちの色で2ドット（腕を振っても胴が欠けない）
    torso_fill = []
    for arm, d in ((nearA, -1), (farA, +1)):
        for y in range(H):
            xs = np.nonzero(arm[y])[0]; t = np.nonzero(torso[y])[0]
            if not len(xs) or not len(t):
                continue
            e = t.min() if d < 0 else t.max()
            rng = range(e - 1, max(e - 3, xs.min() - 1), -1) if d < 0 else range(e + 1, min(e + 3, xs.max() + 1))
            for x in rng:
                if arm[y, x]:
                    torso_fill.append([int(y), int(x), str(G[y, e])])
    masks = {'奥の腕': farA, '胴': torso, 'カバン': bag, '手前の腕': nearA, 'かご': item}
    for (l, s), nm in LNAME.items():
        if l == 'far' or C.get('legFrom', {}).get('near') != 'far':
            masks[nm] = seg[(l, s)]
    leg_from = C.get('legFrom', {}).get('near')  # 'far' なら、手前の脚は奥の脚のレイヤーを複製して作る
    # 元の絵の角度・長さ
    meas = {}
    for l in ('near', 'far'):
        j = joints[l]
        meas[l] = dict(th=ang(j['hip'], j['knee']), sh=ang(j['knee'], j['ankle']),
                       L1=math.dist(j['hip'], j['knee']), L2=math.dist(j['knee'], j['ankle']))
    sole_tilt = {}
    for l in ('near', 'far'):
        ys, xs = np.nonzero(seg[(l, 'foot')])
        pts = [(x, ys[xs == x].max()) for x in sorted(set(xs))]
        k_ = np.polyfit([q[0] for q in pts], [q[1] for q in pts], 1)[0] if len(pts) > 2 else 0
        sole_tilt[l] = math.degrees(math.atan(-k_))
    TH, KN, FT = C['thighKeys'], C['kneeKeys'], C['footKeys']
    ground = C['ground'] + PADY
    base = {nm: [[(G[y, x] if masks[nm][y, x] else '.') for x in range(W)] for y in range(H)] for nm in masks}
    for y, x, ch in torso_fill:
        base['胴'][y][x] = ch
    if leg_from == 'far':
        for s in SEG:
            base[LNAME[('near', s)]] = [row[:] for row in base[LNAME[('far', s)]]]

    def leg_ops(l, q, bob):
        """脚の3つの部品の操作。q: th（もも）・sh（すね）・ft（足）の角度。回す軸は元の絵の関節、行き先は動かした関節"""
        src = leg_from if (l == 'near' and leg_from) else l
        js, ms = joints[src], meas[src]
        dh = J(C.get('drawHip', {}).get(l, C['joints'][l]['hip']))
        hip = (dh[0] + bob, dh[1])
        knee = (hip[0] + meas[l]['L1'] * math.cos(math.radians(q['th'])), hip[1] + meas[l]['L1'] * math.sin(math.radians(q['th'])))
        ank = (knee[0] + meas[l]['L2'] * math.cos(math.radians(q['sh'])), knee[1] + meas[l]['L2'] * math.sin(math.radians(q['sh'])))
        ops = {}
        for s, piv, dst, a in (('thigh', js['hip'], hip, q['th'] - ms['th']), ('shin', js['knee'], knee, q['sh'] - ms['sh']),
                               ('foot', js['ankle'], ank, q['ft'])):
            ops[LNAME[(l, s)]] = {'deg': round(-a, 1), 'pr': piv[0], 'pc': piv[1],
                                  'dy': jsround(dst[0] - piv[0]), 'dx': jsround(dst[1] - piv[1]), 'joint': JNAME[s]}
        return ops

    def lowest(nm_list, ops):
        low = -1
        for nm in nm_list:
            g = apply_op(base[nm], ops[nm])
            cnt = [sum(ch != '.' for ch in row) for row in g]
            rows = [i for i, c_ in enumerate(cnt) if c_ >= 2]  # 回して1ドットだけ飛び出た所は数えない
            if rows:
                low = max(low, max(rows))
        return low
    plan_frames = []
    for f in range(N):
        T = {'far': f / N, 'near': (f / N + 0.5) % 1.0}  # 奥の脚は t=0 で前に着く（元の絵）
        q = {}
        for l in ('near', 'far'):
            src = leg_from if (l == 'near' and leg_from) else l
            q[l] = dict(th=curve(TH, T[l]), sh=curve(TH, T[l]) - curve(KN, T[l]), ft=curve(FT, T[l]) - sole_tilt[src])
        stance = [l for l in ('near', 'far') if T[l] < 0.55]
        lw = max(lowest([LNAME[(l, s)] for s in SEG], leg_ops(l, q[l], 0)) for l in stance)
        bob = ground - lw
        for l in ('near', 'far'):
            if l in stance:
                continue
            for _ in range(12):
                if lowest([LNAME[(l, s)] for s in SEG], leg_ops(l, q[l], bob)) <= ground - 1:
                    break
                q[l]['sh'] -= 4
        ops = {}
        for l in ('near', 'far'):
            ops.update(leg_ops(l, q[l], bob))
        armK = C.get('armGain', 0.35)
        for nm, l, key in (('奥の腕', 'far', 'farShoulder'), ('手前の腕', 'near', 'nearShoulder')):
            sh = J(C[key]); a = -armK * (q[l]['th'] - meas[l]['th'])
            ops[nm] = {'deg': round(-a, 1), 'pr': sh[0], 'pc': sh[1], 'dy': bob, 'dx': 0, 'joint': '肩'}
        sh = J(C['nearShoulder']); hand = J(C['nearHand'])
        th = math.radians(-ops['手前の腕']['deg'])
        dy = hand[0] - sh[0]; dx = hand[1] - sh[1]
        ops['かご'] = {'deg': 0, 'dy': jsround(dy * math.cos(th) - dx * math.sin(th) - dy) + bob, 'dx': jsround(dy * math.sin(th) + dx * math.cos(th) - dx)}
        ops['胴'] = {'deg': 0, 'dy': bob, 'dx': 0}
        ops['カバン'] = {'deg': 0, 'dy': bob, 'dx': 0}
        plan_frames.append({'t': [round(T['near'], 3), round(T['far'], 3)], 'bob': bob, 'ops': ops})
    # 手順どおりに作ったときの絵（エディタの結果と照らし合わせる）
    sim = []
    for fr in plan_frames:
        cel = {}
        for nm in masks.keys() | set(LNAME.values()):
            g = apply_op(base[nm], fr['ops'][nm])
            for y in range(ground + 1, H):
                g[y] = ['.'] * W  # 地面より下にはみ出たドットは消す（エディタでも消す）
            cel[nm] = [''.join(r) for r in g]
        sim.append(cel)
    shadow_sym = next(ch for ch in '!#$%&*+-=?@^~' if ch not in {s['sym'] for s in o['symbols']})
    rig = {'name': name, 'w': W, 'h': H, 'padLeft': PADX, 'padTop': PADY, 'ground': ground, 'frames': N, 'frameMs': FRAME_MS,
           'layers': LAYERS, 'shadow': {'sym': shadow_sym, 'color': '#%02x%02x%02x' % SHADOW, 'opacity': SHADOW_OPACITY},
           'orig': {'format': 'sunshine-pixel', 'version': 2, 'width': W, 'height': H,
                    'symbols': o['symbols'] + [{'sym': shadow_sym, 'label': '影', 'color': '#%02x%02x%02x' % SHADOW}],
                    'layers': [{'name': 'からだ', 'visible': True, 'opacity': 1}], 'frames': [{'dur': FRAME_MS}],
                    'cels': [[[''.join(r) for r in grid]]], 'layer': 0, 'frame': 0},
           'parts': {nm: runs(m) for nm, m in masks.items()}, 'legFrom': leg_from, 'torsoFill': torso_fill,
           'plan': plan_frames}
    with open(os.path.join(ED, f'{name}.rig.json'), 'w', encoding='utf8') as fh:
        json.dump(rig, fh, ensure_ascii=False)
    with open(os.path.join(ED, f'{name}.rigsim.json'), 'w', encoding='utf8') as fh:
        json.dump(sim, fh, ensure_ascii=False)
    print(f'{name}: {N}コマ {W}×{H}・部品 {len(masks) + (3 if leg_from else 0)}・高さ {[fr["bob"] for fr in plan_frames]}')


if __name__ == '__main__':
    for nm in (sys.argv[1:] or list(CFGS)):
        build(nm)

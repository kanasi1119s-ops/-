# 歩くアニメの段取り（元の絵の脚・服をそのまま動かす）。  python3 tools/walk_plan.py
# 元の「歩く」絵（ポーズ集の0番）のドットを崩さず、エディタの「範囲選択・切り取り・貼り付け・左右反転・動かす・だ円」だけで
# 8コマの歩きを作るための手順を書き出す。実際にエディタを動かすのは tools/editor_walk.mjs。
#
# 8コマ（右へ歩く）。歩きの基本（前の一歩 → すれ違い → 反対の足の一歩 → すれ違い。一歩ごとに前に出る足を入れ替える）どおり:
#   0 奥の足が前に着く（元の絵）    1 体が沈む・手前の足のかかとが上がる  2 すれ違い（手前の足は体の後ろで上がる） 3 手前の足が前へ伸びる
#   4 手前の足が前に着く             5 体が沈む・奥の足のかかとが上がる    6 すれ違い（奥の足は体の後ろで上がる）   7 奥の足が前へ伸びる
#   手前の脚＝絵の左側の脚（上のレイヤー）、奥の脚＝右側の脚（下のレイヤー）
# ・脚は股（スカートはすそ）から下を、手前の脚と奥の脚に分ける（元のドットのまま）。腰を軸に、1行ずつ横へずらして前後に振る（せん断）。
#   上げる足は、ひざを前へ出し、すねを持ち上げる。着いている足は同じ高さのまま、体の下を後ろへ動く
# ・影: いちばん下のレイヤーに、足もとのだ円（半透明）。歩幅に合わせて伸び縮みする
# ・服の揺れ: スカート・着物のすそを1ドットずつ揺らす
# ・体の上下: 一歩のコマで体が1ドット沈む
#
# 人ごとに assets/editor/ へ: <名前>.orig.json（エディタで開く元の絵）、<名前>.ref.png（下絵）、<名前>.plan.json（手順）
import json
import os
import numpy as np
from PIL import Image
from walk_prep import SPEC, TRACE, IMG, OUT, SYMS, SKIP, drop_specks, trace_legs

FRAME_MS = 110
PAD_T, PAD_B = 1, 2  # 上: 体が沈むぶん（余裕）、下: 影のぶん
SHADOW = (30, 22, 16)
SHADOW_OPACITY = 0.32
BOB = [0, 1, 0, 0, 0, 1, 0, 0]          # 体を下げる量（一歩の直後に沈む）
HEM = [0, -1, -1, 0, 0, 1, 1, 0]        # すその揺れ（一歩ごとに前後へ）


def bbox(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return [int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())]


def runs_px(px):
    """画素の並びを、行ごとの横のつながり [行, 左, 右] にする（消しゴムで1回ずつなぞる）。"""
    out = []
    by = {}
    for y, x in px:
        by.setdefault(y, []).append(x)
    for y in sorted(by):
        xs = sorted(by[y])
        s0 = p = xs[0]
        for x in xs[1:]:
            if x != p + 1:
                out.append([y, s0, p]); s0 = x
            p = x
        out.append([y, s0, p])
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    index = []
    for name, poses in TRACE['poses'].items():
        if name in SKIP or name not in SPEC:
            continue
        t = SPEC[name]
        src = Image.open(os.path.join(IMG, f'pose_{name}_0.png')).convert('RGBA')
        a = drop_specks(np.array(src))
        h0, w0 = a.shape[:2]
        info = trace_legs(a[:, :, 3] > 0)
        if not info:
            print('脚が見つからない:', name)
            continue
        H, W = h0 + PAD_T + PAD_B, w0
        canvas = np.zeros((H, W, 4), np.uint8)
        canvas[PAD_T:PAD_T + h0] = a
        Image.fromarray(canvas).save(os.path.join(OUT, f'{name}.ref.png'))
        palette, rows = {}, []
        for y in range(H):
            row = ''
            for x in range(W):
                if canvas[y, x, 3]:
                    c = tuple(int(v) for v in canvas[y, x, :3])
                    if c not in palette:
                        palette[c] = SYMS[len(palette)]
                    row += palette[c]
                else:
                    row += '.'
            rows.append(row)
        shadow_sym = SYMS[len(palette)]
        symbols = [{'sym': s_, 'label': f'色{s_}', 'color': '#%02x%02x%02x' % c} for c, s_ in palette.items()]
        symbols.append({'sym': shadow_sym, 'label': '影', 'color': '#%02x%02x%02x' % SHADOW})
        orig = {'format': 'sunshine-pixel', 'version': 2, 'width': W, 'height': H, 'symbols': symbols,
                'layers': [{'name': 'からだ', 'visible': True, 'opacity': 1}], 'frames': [{'dur': FRAME_MS}], 'cels': [[rows]], 'layer': 0, 'frame': 0}
        al = canvas[:, :, 3] > 0
        sole = info['bottom'] + PAD_T
        cut = t['cut'] + PAD_T
        head = int(np.nonzero(al.any(1))[0].min())
        hip = cut - 2 if not t.get('skirt') else round(sole - 0.47 * (sole - head))  # 腰（脚を振る軸）
        keep = [[k[0] + PAD_T, k[1], k[2] + PAD_T, k[3]] for k in t.get('keep', [])]
        kept = np.zeros_like(al)
        for k in keep:
            kept[k[0]:k[2] + 1, k[1]:k[3] + 1] = True
        leg = al & ~kept
        leg[:cut] = False
        # 行ごとに、奥の脚（左）と手前の脚（右）の境の列を決める。2本に分かれている行はすき間の真ん中、
        # くっついている行は、上下の分かれている行から補間する
        def runs_of(row):
            out, x, n = [], 0, len(row)
            while x < n:
                if row[x]:
                    s0 = x
                    while x < n and row[x]:
                        x += 1
                    out.append((s0, x - 1))
                else:
                    x += 1
            return out
        L0, R0 = info['L'], info['R']
        split = {}
        for y in range(cut, sole + 1):
            rr = [r for r in runs_of(leg[y]) if r[1] - r[0] >= 0]
            if len(rr) >= 2:
                # いちばん大きなすき間
                gaps = [(rr[i + 1][0] - rr[i][1], (rr[i][1] + rr[i + 1][0]) / 2) for i in range(len(rr) - 1)]
                split[y] = max(gaps)[1]
        # くっついている行は、その行の脚の幅のまん中で分ける（2本が並んでいる）。分かれている行の境とつながるよう、
        # 上下の分かれている行に近いほど、その境に寄せる
        known = sorted(split)
        if not known:
            print('脚が分けられない:', name)
            continue
        for y in range(cut, sole + 1):
            if y in split:
                continue
            rr = runs_of(leg[y])
            if not rr:
                split[y] = split[min(known, key=lambda k: abs(k - y))]
                continue
            x0 = min(r[0] for r in rr); x1 = max(r[1] for r in rr)
            mid = (x0 + x1 + 1) / 2
            near = min(known, key=lambda k: abs(k - y))
            wgt = max(0.0, 1 - abs(near - y) / 4)  # 4行はなれたら真ん中だけ
            split[y] = mid * (1 - wgt) + split[near] * wgt
        # 元の絵（右向き・少し手前向き）では、左側の脚が手前、右側（前に出ている足）が奥
        front_px = [(y, x) for y in range(cut, sole + 1) for x in range(W) if leg[y, x] and x < split[y]]
        back_px = [(y, x) for y in range(cut, sole + 1) for x in range(W) if leg[y, x] and x >= split[y]]
        def foot_center(px):
            ys = [y for y, _ in px]
            yb = max(ys)
            xs = [x for y, x in px if y >= yb - 1]
            return (min(xs) + max(xs)) / 2
        fb, ff = foot_center(back_px), foot_center(front_px)
        # 脚はそれぞれ自分の腰の下で前後に振る（手前の脚は手前の列、奥の脚は奥の列。前に出た足が反対の足の位置に行かない）
        top = cut + max(2, (sole - cut) // 4)
        def hip_center(px):
            xs = [x for y, x in px if y <= top]
            return sum(xs) / len(xs)
        hips = {'back': hip_center(back_px), 'front': hip_center(front_px)}
        s = max(2.0, ((fb - hips['back']) + (hips['front'] - ff)) / 2 * t.get('stride', 1.0))
        L = max(2, min(3, round((sole - hip) * 0.12 * t.get('lift', 1.0))))  # 足を上げる高さ（脚が切れないよう3ドットまで）
        # 8コマの足の位置（腰からの横の位置を歩幅 s の倍数で。上げる高さ）。前=手前の脚、奥=奥の脚
        # 参考（歩きのドット絵の基本）: すれ違いでは、支える脚は体の真下でまっすぐ、浮いた脚は ひざを前・足を体の後ろで持ち上げる
        keys = [  # (手前 x, 手前 上げ, 奥 x, 奥 上げ)。元の絵は 手前の足が後ろ・奥の足が前
            (-1.0, 0, 1.0, 0),      # 0 一歩: 奥の足がかかとから着く・手前の足はつま先（元の絵）
            (-0.9, 1, 0.6, 0),      # 1 体が沈む・手前の足のかかとが上がる
            (-0.3, L, 0.0, 0),      # 2 すれ違い: 奥の脚は真下でまっすぐ、手前の足は体の後ろで持ち上がる（ひざは前）
            (0.75, 1, -0.5, 1),     # 3 手前の足が前へ伸びる・奥のかかとが上がる
            (1.0, 0, -1.0, 0),      # 4 反対の一歩: 手前の足が前に着く・奥の足はつま先
            (0.6, 0, -0.9, 1),      # 5 体が沈む・奥の足のかかとが上がる
            (0.0, 0, -0.3, L),      # 6 すれ違い: 手前の脚は真下でまっすぐ、奥の足は体の後ろで持ち上がる
            (-0.5, 1, 0.75, 1),     # 7 奥の足が前へ伸びる・手前のかかとが上がる
        ]
        orig_x = {'front': (ff - hips['front']) / s, 'back': (fb - hips['back']) / s}
        ops, shadows = [], []
        kr = hip + (sole - hip) * 0.5  # ひざ
        for f, (xf, lf, xb, lb) in enumerate(keys):
            feet = []
            for side, tx, lift in (('back', xb, lb), ('front', xf, lf)):
                dfoot = (tx - orig_x[side]) * s  # 足先の横の移動
                bend = lift >= 2
                # 上げる足: ひざは腰より2ドット前（元の脚のひざの位置からの移動に直す）、すねは後ろへたたむ
                knee_dx = (2 - orig_x[side] * s * 0.5) if bend else dfoot * 0.5
                rows = []
                for y in range(cut, sole + 1):
                    if y <= kr:
                        u = (y - hip) / max(1, kr - hip)
                        dx = knee_dx * u if bend else dfoot * (y - hip) / max(1, sole - hip)
                        dy = 0
                    else:
                        u = (y - kr) / max(1, sole - kr)
                        dx = (knee_dx + (dfoot - knee_dx) * u) if bend else dfoot * (y - hip) / max(1, sole - hip)
                        dy = -round(lift * u) if bend else (-lift if y >= sole - 2 else 0)
                    rows.append((y, round(dx), dy))
                # 隣の行とのずれは1ドットまで（細い脚がちぎれないように）。足先が届かなければ歩幅を少し小さくする
                prev = 0
                for i, (y, dx, dy) in enumerate(rows):
                    dx = max(prev - 1, min(prev + 1, dx))
                    rows[i] = (y, dx, dy)
                    prev = dx
                # 同じずらし方の行をまとめて1回で動かす（上の行から）
                i = 0
                while i < len(rows):
                    j = i
                    while j + 1 < len(rows) and rows[j + 1][1:] == rows[i][1:]:
                        j += 1
                    y0, dx, dy = rows[i]
                    if dx or dy:
                        ops.append({'frame': f, 'layer': side, 'rect': [y0, 0, rows[j][0], W - 1], 'flip': False, 'dx': dx, 'dy': dy})
                    i = j + 1
                if lift == 0:
                    feet.append(hips[side] + orig_x[side] * s + rows[-1][1])
            # 影: 着いている足のあいだ（足が1本なら、その足のまわり）
            if feet:
                x0 = min(feet) - 5
                x1 = max(feet) + 5
                shadows.append({'frame': f, 'rect': [sole, max(0, round(x0)), min(H - 1, sole + 2), min(W - 1, round(x1))]})
        back_rect = [cut, 0, H - 1, W - 1]
        body_ops = []
        for f in range(8):
            if BOB[f]:
                body_ops.append({'frame': f, 'dy': BOB[f]})
        hem = None
        if t.get('skirt'):
            hem = {'rect': [max(0, cut - 4), 0, cut - 1, W - 1], 'seq': HEM}
        plan = {'name': name, 'w': W, 'h': H, 'padTop': PAD_T, 'padBottom': PAD_B, 'frameMs': FRAME_MS, 'frames': 8,
                'shadow': {'sym': shadow_sym, 'opacity': SHADOW_OPACITY}, 'keep': keep,
                'legs': [cut, 0, H - 1, W - 1],  # 脚のレイヤーへ切り取る範囲
                'eraseBack': runs_px(front_px),  # 奥の脚のレイヤーから消す（手前の脚のぶん）
                'eraseFront': runs_px(back_px),  # 手前の脚のレイヤーから消す（奥の脚のぶん）
                'ops': ops, 'shadows': shadows, 'bob': body_ops, 'hem': hem,
                'note': f'腰 {hip}行・足の裏 {sole}行・歩幅 {s:.1f}・上げ {L}'}
        with open(os.path.join(OUT, f'{name}.orig.json'), 'w', encoding='utf8') as f:
            json.dump(orig, f, ensure_ascii=False)
        with open(os.path.join(OUT, f'{name}.plan.json'), 'w', encoding='utf8') as f:
            json.dump(plan, f, ensure_ascii=False, indent=1)
        index.append(name)
        print(f'{name}: {plan["note"]}・操作 {len(ops)}')
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf8') as f:
        json.dump(index, f, ensure_ascii=False)


if __name__ == '__main__':
    main()

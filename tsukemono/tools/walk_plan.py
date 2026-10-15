# 歩くアニメの段取り（元の絵の脚・服をそのまま動かす）。  python3 tools/walk_plan.py
# 元の「歩く」絵（ポーズ集の0番）のドットを崩さず、エディタの「範囲選択・切り取り・貼り付け・左右反転・動かす・だ円」だけで
# 8コマの歩きを作るための手順を書き出す。実際にエディタを動かすのは tools/editor_walk.mjs。
#
# 8コマ（右へ歩く。前脚=手前の脚（右）、後ろ脚=奥の脚（左））。脚の絵は反転せず、元の絵の位置と真ん中の間を行き来する:
#   0 一歩（元の絵）                  体が沈む
#   1 足が寄る・奥の足が浮く
#   2 足がそろう・奥の足が上がる（体がいちばん高い）
#   3 足が開く・奥の足が下りる
#   4 一歩（元の絵）                  体が沈む
#   5 足が寄る・手前の足が浮く
#   6 足がそろう・手前の足が上がる
#   7 足が開く・手前の足が下りる
# ・すね は帯に分けて動かす（ひざに近い帯ほど少し）。上げる足を一歩ごとに入れ替えるので、左右の足が交互に出て見える
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
BOB = [1, 0, 0, 0, 1, 0, 0, 0]          # 体を下げる量（一歩で沈む）
HEM = [0, -1, -1, 0, 0, 1, 1, 0]        # すその揺れ（一歩ごとに前後へ）


def bbox(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return [int(ys.min()), int(xs.min()), int(ys.max()), int(xs.max())]


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
        knee = cut if t.get('skirt') else cut + round((sole - cut) * 0.4)
        L, R = info['L'], info['R']
        split = (L[1] + R[0] + 1) // 2
        keep = [[k[0] + PAD_T, k[1], k[2] + PAD_T, k[3]] for k in t.get('keep', [])]
        kept = np.zeros_like(al)
        for k in keep:
            kept[k[0]:k[2] + 1, k[1]:k[3] + 1] = True
        leg = al & ~kept
        legmask = {'back': leg.copy(), 'front': leg.copy()}
        legmask['back'][:, split:] = False
        legmask['front'][:, :split] = False
        for m in legmask.values():
            m[:knee] = False
        # 帯: すね（ひざ〜靴の上）を最大3つ、靴（下の3行）
        shoe0 = max(knee, sole - 2)
        span = shoe0 - knee
        n = 0 if span <= 0 else 3 if span >= 9 else 2 if span >= 4 else 1
        bands = [[knee + round(span * i / n), knee + round(span * (i + 1) / n) - 1] for i in range(n)] + [[shoe0, sole]]
        # 帯ごとの、前脚・後ろ脚の枠と中心
        def band_box(side, r0, r1):
            m = legmask[side].copy()
            m[:r0] = False
            m[r1 + 1:] = False
            return bbox(m)
        info_b = []
        for bi, (r0, r1) in enumerate(bands):
            bb = {s: band_box(s, r0, r1) for s in ('back', 'front')}
            if not bb['back'] or not bb['front']:
                info_b.append(None)
                continue
            cb = (bb['back'][1] + bb['back'][3]) / 2
            cf = (bb['front'][1] + bb['front'][3]) / 2
            info_b.append({'rows': [r0, r1], 'box': bb, 'cb': cb, 'cf': cf, 'shoe': bi == len(bands) - 1, 'depth': (bi + 1) / len(bands)})
        # コマごとの、各帯の動き
        #   pos: 0=元の位置 1=真ん中 2=入れ替わった位置。flip=すねを反転
        stride_mul = t.get('stride', 1.0)
        seq = [  # (後ろ脚 pos, 後ろ脚 lift, 前脚 pos, 前脚 lift, flip)
            (0, 0, 0, 0, False),
            (0.5, 1, 0.5, 0, False),
            (1, 2, 1, 0, False),
            (0.5, 1, 0.5, 0, False),
            (0, 0, 0, 0, False),
            (0.5, 0, 0.5, 1, False),
            (1, 0, 1, 2, False),
            (0.5, 0, 0.5, 1, False),
        ]
        ops, shadows = [], []
        for f, (pb, lb, pf, lf, flip) in enumerate(seq):
            feet = []
            for b in info_b:
                if not b:
                    continue
                cb, cf = b['cb'], b['cf']
                mid = (cb + cf) / 2
                k = b['depth'] if not b['shoe'] else 1.0
                def target(c0, other, p):
                    # 0→1: 元の位置から真ん中へ、1→2: 真ん中から相手の位置へ（歩幅の倍率をかける）
                    if p <= 1:
                        return c0 + (mid - c0) * p
                    return mid + (other - mid) * (p - 1) * stride_mul
                for side, c0, other, p, lift in (('back', cb, cf, pb, lb), ('front', cf, cb, pf, lf)):
                    dx = round((target(c0, other, p) - c0) * (k if not b['shoe'] else 1.0))
                    dy = -(lift if b['shoe'] else max(0, lift - 1) if b['depth'] > 0.5 else 0)
                    do_flip = flip and not b['shoe']
                    if dx or dy or do_flip:
                        ops.append({'frame': f, 'layer': side, 'rect': b['box'][side], 'flip': do_flip, 'dx': dx, 'dy': dy})
                    if b['shoe']:
                        bx = b['box'][side]
                        feet.append((bx[1] + dx, bx[3] + dx, lift))
            # 影: 足もとのだ円（上がった足のぶんは少し縮める）
            if feet:
                x0 = min(fx0 for fx0, _, _ in feet) - 1
                x1 = max(fx1 for _, fx1, _ in feet) + 1
                if any(l >= 2 for _, _, l in feet):
                    x0 += 1; x1 -= 1
                shadows.append({'frame': f, 'rect': [sole, max(0, x0), min(H - 1, sole + 2), min(W - 1, x1)]})
        body_ops = []
        for f in range(8):
            if BOB[f]:
                body_ops.append({'frame': f, 'dy': BOB[f]})
        hem = None
        if t.get('skirt'):
            hem = {'rect': [max(0, cut - 4), 0, cut - 1, W - 1], 'seq': HEM}
        plan = {'name': name, 'w': W, 'h': H, 'padTop': PAD_T, 'padBottom': PAD_B, 'frameMs': FRAME_MS, 'frames': 8,
                'shadow': {'sym': shadow_sym, 'opacity': SHADOW_OPACITY}, 'keep': keep,
                'back': [knee, 0, H - 1, split - 1], 'front': [knee, split, H - 1, W - 1],
                'ops': ops, 'shadows': shadows, 'bob': body_ops, 'hem': hem,
                'note': f'ひざ {knee}行・足の裏 {sole}行・境 {split}列・帯 {len(bands)}'}
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

# 歩くアニメの段取り（元の絵の脚をそのまま動かす）。  python3 tools/walk_plan.py
# 元の「歩く」絵（ポーズ集の0番）を崩さず、エディタの「範囲選択・切り取り・貼り付け・動かす」だけで動きをつける。
# 人ごとに assets/editor/ へ:
#   <名前>.orig.json … エディタで開く元の絵（レイヤー1枚・フレーム1つ。上に1行の余白）
#   <名前>.ref.png   … 下絵（元の絵）
#   <名前>.plan.json … エディタでの手順に使う範囲（持ち物・後ろ脚・前脚の枠、ずらす帯と量）
# 4コマ: 0 元の絵（足を開いた一歩） → 1 足がそろう（すね・足を真ん中へ寄せ、後ろの足を上げる） → 2 元の絵 → 3 足がそろう
import json
import os
import numpy as np
from PIL import Image
from walk_prep import SPEC, TRACE, IMG, OUT, SYMS, SKIP, drop_specks, trace_legs

FRAME_MS = 150
PAD = 1


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
        H, W = h0 + PAD, w0
        canvas = np.zeros((H, W, 4), np.uint8)
        canvas[PAD:] = a
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
        symbols = [{'sym': s_, 'label': f'色{s_}', 'color': '#%02x%02x%02x' % c} for c, s_ in palette.items()]
        orig = {'format': 'sunshine-pixel', 'version': 2, 'width': W, 'height': H, 'symbols': symbols,
                'layers': [{'name': 'からだ', 'visible': True, 'opacity': 1}], 'frames': [{'dur': FRAME_MS}], 'cels': [[rows]], 'layer': 0, 'frame': 0}
        # 範囲（余白ぶん1行下げた座標）
        bottom = info['bottom'] + PAD
        cut = t['cut'] + PAD
        knee = cut if t.get('skirt') else cut + round((bottom - cut) * 0.4)
        L, R = info['L'], info['R']
        split = (L[1] + R[0] + 1) // 2  # 足元で左右の脚を分ける列
        keep = [[k[0] + PAD, k[1], k[2] + PAD, k[3]] for k in t.get('keep', [])]
        gap = ((R[0] + R[1]) - (L[0] + L[1])) / 2  # 足と足の間（中心どうし）
        d = max(1, round(gap * 0.45))  # 足と足の間の半分くらいまで寄せる
        span = bottom - knee + 1
        n = 3 if span >= 6 else 2 if span >= 3 else 1
        bands = []
        for i in range(n):
            r0 = knee + round(span * i / n)
            r1 = knee + round(span * (i + 1) / n) - 1
            k = round(d * (i + 1) / n)
            bands.append({'rows': [r0, r1], 'shift': k, 'lift': 1 if i == n - 1 else 0})
        plan = {'name': name, 'w': W, 'h': H, 'pad': PAD, 'frameMs': FRAME_MS, 'frames': 4,
                'keep': keep,
                'back': [knee, 0, bottom, split - 1],  # 後ろ脚（左）の枠
                'front': [knee, split, bottom, W - 1],  # 前脚（右）の枠
                'bands': bands,
                'note': f'ひざ {knee}行・足元 {bottom}行・境 {split}列・寄せる量 {d}'}
        with open(os.path.join(OUT, f'{name}.orig.json'), 'w', encoding='utf8') as f:
            json.dump(orig, f, ensure_ascii=False)
        with open(os.path.join(OUT, f'{name}.plan.json'), 'w', encoding='utf8') as f:
            json.dump(plan, f, ensure_ascii=False, indent=1)
        index.append(name)
        print(f'{name}: {plan["note"]}')
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf8') as f:
        json.dump(index, f, ensure_ascii=False)


if __name__ == '__main__':
    main()

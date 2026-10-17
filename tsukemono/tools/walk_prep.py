# 歩くアニメをドット絵エディタで作るための下準備。  python3 tools/walk_prep.py
# 人ごとに、次の2つを書き出す（assets/editor/）:
#   <名前>.start.json … エディタの「作品を開く」で読む、はじめの作品
#                        レイヤー: 後ろ脚（空）・前脚（空）・からだ（元の絵から、ひざ下の脚を外したもの）／フレーム1つ
#   <名前>.plan.json  … エディタで描く手順（コマごとの体の上下と、脚の線・靴の位置）
#   <名前>.ref.png    … 下絵（元の絵。エディタの「下絵」に敷いてなぞる）
# 実際に描くのは tools/editor_walk.mjs（エディタをブラウザで動かして、ツールで描く）。
#
# 歩きの6コマ（右向き。A=前に出ている脚、B=後ろの脚）:
#   0 右足が前に着く  1 体が沈む・左足が離れる  2 左足が通り過ぎる（体がいちばん高い）
#   3 左足が前に着く  4 体が沈む・右足が離れる  5 右足が通り過ぎる
import json
import math
import os
from collections import Counter
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'assets', 'img')
OUT = os.path.join(HERE, '..', 'assets', 'editor')
trace = open(os.path.join(HERE, '..', 'assets', 'trace.js'), encoding='utf8').read()
TRACE = json.loads(trace[trace.index('{'):trace.rindex('}') + 1])
SKIP = {'keeper', 'centaur'}  # 店主は歩かない。ケンタウロスは脚が4本
SYMS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
FRAME_MS = 110
PAD = 2  # 体が浮くぶん、上に余白（768×432: 2ドット）
# 人ごとの手直し: stride=歩幅の倍率、lift=足を上げる高さの倍率、hip=腰の高さ（行）
# 人ごとの指定（元の絵を方眼で見て決めた）:
#   cut   … この行から下を脚として描き直す（ズボンは股のあたり、スカート・着物はすそ）
#   keep  … 消さずに残す持ち物の枠 [上の行, 左の列, 下の行, 右の列]（かご・袋。脚はこの後ろを通る）
#   skirt … すそから下だけ脚が見える人（腰はすその中に隠れる）
#   stride / lift … 歩幅・足の上げ方の倍率（長いすその人は小さく）
SPEC = {
    'woman': {'cut': 132, 'skirt': True, 'stride': 0.55, 'lift': 0.35},
    'granny': {'cut': 128, 'skirt': True, 'stride': 0.55, 'lift': 0.35},
    'granny2': {'cut': 128, 'skirt': True, 'stride': 0.55, 'lift': 0.35},
    'oldman': {'cut': 94, 'keep': [[88, 0, 134, 24]], 'stride': 0.85},
    'boy': {'cut': 92, 'keep': [[70, 0, 98, 24]], 'skirt': True, 'color': (205, 140, 100)},  # 脚は肌の色（靴下の白を拾わない）
    'girl': {'cut': 92, 'keep': [[70, 0, 98, 20]], 'skirt': True},
    'student': {'cut': 98, 'keep': [[74, 0, 110, 26]], 'skirt': True},
    'gakuran': {'cut': 92, 'keep': [[74, 0, 112, 26]]},
    'blazer': {'cut': 102, 'keep': [[82, 0, 116, 26]], 'skirt': True},
    'yankee': {'cut': 98, 'keep': [[86, 0, 118, 30]]},
    'suit': {'cut': 96, 'keep': [[92, 0, 126, 28]]},
    'shades': {'cut': 94, 'keep': [[86, 0, 118, 32]]},
    'volley': {'cut': 92, 'keep': [[84, 0, 114, 26]], 'skirt': True},
    'soccer': {'cut': 94, 'keep': [[84, 0, 112, 24]], 'skirt': True},
    'racer': {'cut': 92, 'keep': [[86, 0, 116, 28]], 'skirt': True},
    'karate': {'cut': 90, 'keep': [[86, 0, 116, 26]]},
    'samurai': {'cut': 128, 'keep': [[82, 0, 116, 28]], 'skirt': True, 'stride': 0.6, 'lift': 0.4},
    'beach': {'cut': 88, 'keep': [[82, 0, 114, 26]], 'skirt': True},
    'parasol': {'cut': 140, 'keep': [[94, 8, 146, 36]], 'skirt': True, 'stride': 0.5, 'lift': 0.3},
    'angler': {'cut': 104, 'keep': [[96, 10, 134, 44]]},
    'hiker': {'cut': 100, 'keep': [[88, 0, 118, 26]]},
    'knight': {'cut': 104, 'keep': [[94, 0, 122, 28]], 'skirt': True},
    'alien': {'cut': 94, 'keep': [[78, 0, 112, 24]]},
    'witch': {'cut': 132, 'keep': [[80, 0, 132, 64]], 'skirt': True, 'stride': 0.55, 'lift': 0.35},
    'demon': {'cut': 112, 'keep': [[94, 0, 122, 28]], 'skirt': True},
}


def runs(row):
    out, x, n = [], 0, len(row)
    while x < n:
        if row[x]:
            s = x
            while x < n and row[x]:
                x += 1
            out.append((s, x - 1))
        else:
            x += 1
    return out


def drop_specks(a):
    h, w = a.shape[:2]
    seen = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] and not seen[y, x]:
                stack, comp = [(y, x)], []
                seen[y, x] = True
                while stack:
                    cy, cx = stack.pop()
                    comp.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and a[ny, nx, 3] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
                if len(comp) < 12:  # 768×432: 1倍のときの3ドット相当
                    for cy, cx in comp:
                        a[cy, cx] = 0
    return a


def trace_legs(alpha):
    """足元から上へ、左右の脚の連なりをたどる。脚の外（かご・袋）は追わない。"""
    h, w = alpha.shape
    bottom = max(y for y in range(h) if alpha[y].any())
    ref = None
    for y in range(bottom, max(0, bottom - 8), -1):
        big = [r for r in runs(alpha[y]) if r[1] - r[0] >= 2]
        if len(big) >= 2:
            ref = (y, *sorted(sorted(big, key=lambda r: r[1] - r[0], reverse=True)[:2]))
            break
    if not ref:
        return None
    yr, L, R = ref
    legs = {}
    # 足元より下（靴の底）
    for y in range(yr, bottom + 1):
        rr = [r for r in runs(alpha[y]) if r[1] >= L[0] - 2 and r[0] <= R[1] + 2]
        if rr:
            legs[y] = (min(r[0] for r in rr), max(r[1] for r in rr))
    # 上へ: 2本に分かれている間（すねが見えている範囲）。幅が急に広がったら止める（すそ・かご）
    l, r = L, R
    top = yr
    limit = bottom - int(h * 0.33)
    for y in range(yr - 1, limit - 1, -1):
        rr = [q for q in runs(alpha[y]) if q[1] >= l[0] - 2 and q[0] <= r[1] + 2]
        if len(rr) < 2:
            break
        nl, nr = rr[0], rr[-1]
        if nl[0] < l[0] - 2 or nr[1] > r[1] + 2:
            break
        l, r = nl, nr
        legs[y] = (l[0], r[1])
        top = y
    return {'bottom': bottom, 'top': top, 'legs': legs, 'L': L, 'R': R}


def colors_of(a, info, cut, kept):
    """脚の色（前・後ろ）と靴の色。cut の少し下（太もも・すね）と、足元の行から取る。持ち物の枠は見ない。"""
    bottom = info['bottom']
    mid = (info['L'][1] + info['R'][0]) / 2
    def pix(y0, y1, side):
        out = []
        for y in range(y0, y1 + 1):
            for x in range(a.shape[1]):
                if a[y, x, 3] and not kept(y, x) and ((x < mid) == (side == 'L')):
                    out.append(tuple(int(v) for v in a[y, x, :3]))
        return out
    def mode(cs):
        if not cs:
            return None
        dmin = min(sum(c) for c in cs)
        cs2 = [c for c in cs if sum(c) > dmin + 40] or cs  # ふちの暗い色は除く
        return Counter(cs2).most_common(1)[0][0]
    y0, y1 = cut + 1, min(bottom - 3, cut + 3)
    if y1 < y0:
        y0, y1 = max(0, bottom - 4), bottom - 2
    front = mode(pix(y0, y1, 'R')) or (90, 80, 70)
    front = tuple(info.get('color') or front)
    back = tuple(max(0, int(v * 0.75)) for v in front)  # 後ろの脚は前の脚を少し暗く
    shoe = mode(pix(bottom - 1, bottom, 'L') + pix(bottom - 1, bottom, 'R')) or (60, 45, 35)
    return front, back, shoe


def ik(hip, foot, a, b):
    """2本の骨（もも a・すね b）で腰から足首へ。ひざは前（右）に曲がる。"""
    hx, hy = hip
    fx, fy = foot
    dx, dy = fx - hx, fy - hy
    d = max(0.01, math.hypot(dx, dy))
    d2 = min(d, a + b - 0.01)
    # 腰からの角度
    base = math.atan2(dy, dx)
    cosk = (a * a + d2 * d2 - b * b) / (2 * a * d2)
    k = math.acos(max(-1, min(1, cosk)))
    ang = base - k  # 前に出る向き（右）へ曲げる: y下向きなので -k で右側
    knee = (hx + a * math.cos(ang), hy + a * math.sin(ang))
    if knee[0] < min(hx, fx) - 0.5:  # 念のため、ひざが後ろに曲がったら反対側に
        ang = base + k
        knee = (hx + a * math.cos(ang), hy + a * math.sin(ang))
    return knee


def main():
    os.makedirs(OUT, exist_ok=True)
    index = []
    for name, poses in TRACE['poses'].items():
        if name in SKIP:
            continue
        src = Image.open(os.path.join(IMG, f'pose_{name}_0.png')).convert('RGBA')
        a = drop_specks(np.array(src))
        h0, w0 = a.shape[:2]
        info = trace_legs(a[:, :, 3] > 0)
        if not info:
            print('脚が見つからない:', name)
            continue
        t = SPEC.get(name, {})
        body = a.copy()
        H, W = h0 + PAD, w0
        cut = t['cut']
        keep = t.get('keep', [])
        kept = lambda y, x: any(k[0] <= y <= k[2] and k[1] <= x <= k[3] for k in keep)
        # からだ: cut の行から下を消す（持ち物の枠は残す）
        for y in range(cut, h0):
            for x in range(w0):
                if not kept(y, x):
                    body[y, x] = 0
        head0 = next(y for y in range(h0) if a[y, :, 3].any())
        hip0 = round(info['bottom'] - 0.46 * (info['bottom'] - head0)) if t.get('skirt') else cut - 2
        info['top'] = cut
        info['color'] = t.get('color')
        front, back, shoe = colors_of(a, info, cut, kept)
        canvas = np.zeros((H, W, 4), np.uint8)
        canvas[PAD:] = body
        ref = np.zeros((H, W, 4), np.uint8)
        ref[PAD:] = np.array(src)
        Image.fromarray(ref).save(os.path.join(OUT, f'{name}.ref.png'))
        # 色を記号に
        palette, rows = {}, []
        def sym_of(c):
            if c not in palette:
                palette[c] = SYMS[len(palette)]
            return palette[c]
        for y in range(H):
            row = ''
            for x in range(W):
                row += sym_of(tuple(int(v) for v in canvas[y, x, :3])) if canvas[y, x, 3] else '.'
            rows.append(row)
        leg_syms = {k: sym_of(c) for k, c in (('front', front), ('back', back), ('shoe', shoe))}
        if len(palette) > len(SYMS) - 8:
            print('色が多すぎる:', name, len(palette))
            continue
        hexs = lambda c: '#%02x%02x%02x' % c
        symbols = [{'sym': s, 'label': {leg_syms['front']: '前脚', leg_syms['back']: '後ろ脚', leg_syms['shoe']: '靴'}.get(s, f'色{s}'), 'color': hexs(c)} for c, s in palette.items()]
        empty = ['.' * W for _ in range(H)]
        start = {'format': 'sunshine-pixel', 'version': 2, 'width': W, 'height': H, 'symbols': symbols,
                 'layers': [{'name': '後ろ脚', 'visible': True, 'opacity': 1}, {'name': '前脚', 'visible': True, 'opacity': 1}, {'name': 'からだ', 'visible': True, 'opacity': 1}],
                 'frames': [{'dur': FRAME_MS}], 'cels': [[empty], [empty], [rows]], 'layer': 2, 'frame': 0}
        # ---- 歩きの手順 ----
        bottom = info['bottom'] + PAD  # 靴の底の行
        ankle = bottom - 1
        head = next(y for y in range(H) if canvas[y, :, 3].any())
        hip_y = hip0 + PAD
        top_runs = runs(a[info['top'], :, 3] > 0)
        lx = (info['L'][0] + info['L'][1]) / 2
        rx = (info['R'][0] + info['R'][1]) / 2
        hx = (lx + rx) / 2
        leg_len = ankle - hip_y
        thigh = leg_len * 0.5
        shin = leg_len - thigh
        s = max(2.0, leg_len * 0.30 * t.get('stride', 1.0))
        lift = max(2, round(leg_len * 0.20 * t.get('lift', 1.0)))
        wl = sorted((x1 - x0 + 1) for y, (x0, x1) in info['legs'].items() if info['top'] <= y <= bottom - PAD - 3)
        width_total = wl[len(wl) // 2] if wl else 6
        gap = info['R'][0] - info['L'][1] - 1
        leg_w = max(3, min(4, round((width_total - max(0, gap)) / 2)))  # 縁取りをかけても中の色が残る太さ
        if not t.get('skirt'):
            leg_w = 4  # ズボンは太め（もも5・すね4）
        # コマごと: 体の上下 dy（+が下）、A（右脚）と B（左脚）の足首の位置、かかと上げ（toe）・持ち上げ（swing）
        keys = [
            {'dy': 1, 'A': (s, 0, 'heel'), 'B': (-s, 0, 'toe')},
            {'dy': 1, 'A': (s * 0.35, 0, 'flat'), 'B': (-s * 0.7, 2, 'toe')},
            {'dy': 0, 'A': (-s * 0.25, 0, 'flat'), 'B': (s * 0.1, lift, 'swing')},
            {'dy': 1, 'A': (-s, 0, 'toe'), 'B': (s, 0, 'heel')},
            {'dy': 1, 'A': (-s * 0.7, 2, 'toe'), 'B': (s * 0.35, 0, 'flat')},
            {'dy': 0, 'A': (s * 0.1, lift, 'swing'), 'B': (-s * 0.25, 0, 'flat')},
        ]
        frames = []
        for k in keys:
            hip = (hx, hip_y + k['dy'])
            fr = {'dy': k['dy'], 'legs': {}}
            for leg, layer, sym in (('B', 0, leg_syms['back']), ('A', 1, leg_syms['front'])):
                fx, up, kind = k[leg]
                foot = (hx + fx, ankle - up)
                knee = ik(hip, foot, thigh, shin)
                # A は前に出ている側の色（明るい）、B は後ろ（暗い）。入れ替わっても色は脚ごとに固定
                fr['legs'][leg] = {
                    'layer': layer, 'sym': sym, 'width': leg_w,
                    'hip': [round(hip[1]), round(hip[0])], 'knee': [round(knee[1]), round(knee[0])], 'ankle': [round(foot[1]), round(foot[0])],
                    'shoe': kind,
                }
            frames.append(fr)
        plan = {'name': name, 'w': W, 'h': H, 'pad': PAD, 'frameMs': FRAME_MS, 'shoe': leg_syms['shoe'], 'frames': frames,
                'note': f'腰 {hip_y}行・脚の長さ {leg_len}・歩幅 {s:.1f}・脚の太さ {leg_w}'}
        with open(os.path.join(OUT, f'{name}.start.json'), 'w', encoding='utf8') as f:
            json.dump(start, f, ensure_ascii=False)
        with open(os.path.join(OUT, f'{name}.plan.json'), 'w', encoding='utf8') as f:
            json.dump(plan, f, ensure_ascii=False, indent=1)
        index.append(name)
        print(f'{name}: {plan["note"]}・色{len(palette)}')
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf8') as f:
        json.dump(index, f, ensure_ascii=False)


if __name__ == '__main__':
    main()
